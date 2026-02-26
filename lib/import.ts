import { DEFAULT_INTERVALS } from './types';

interface UnknownRecord {
  [key: string]: unknown;
}

export interface ImportPayloadSource {
  provider?: string;
  bookTitle?: string;
  assetId?: string;
}

export interface ImportPayloadItemMeta {
  locationCfi?: string;
  highlightedAt?: string;
  style?: number;
}

export interface ParsedImportItem {
  rowIndex: number;
  externalId?: string;
  content: string;
  detail?: string;
  source?: string;
  categoryId?: string;
  intervals: number[];
  meta?: ImportPayloadItemMeta;
}

export interface ImportInvalidRow {
  rowIndex: number;
  reason: string;
}

export interface ParseImportJsonResult {
  total: number;
  source?: ImportPayloadSource;
  validItems: ParsedImportItem[];
  invalidRows: ImportInvalidRow[];
  warnings: string[];
  errors: string[];
}

export interface ImportResult {
  total: number;
  valid: number;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  warnings: string[];
  errors: string[];
  invalidRows: ImportInvalidRow[];
}

export interface ImportActionOptions {
  dryRun?: boolean;
}

export interface ImportDedupKeyInput {
  externalId?: string;
  sourceAssetId?: string;
  content: string;
  source: string;
  locationCfi?: string;
}

export function parseImportJson(
  rawJson: string,
  defaultIntervals: number[] = DEFAULT_INTERVALS
): ParseImportJsonResult {
  const result: ParseImportJsonResult = {
    total: 0,
    source: undefined,
    validItems: [],
    invalidRows: [],
    warnings: [],
    errors: [],
  };

  if (!rawJson.trim()) {
    result.errors.push('Please paste a JSON payload before validating.');
    return result;
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawJson);
  } catch {
    result.errors.push('Invalid JSON format.');
    return result;
  }

  if (!isRecord(parsedPayload)) {
    result.errors.push('Payload must be a JSON object.');
    return result;
  }

  if (parsedPayload.version !== 1) {
    result.errors.push('Unsupported payload version. Expected version: 1.');
    return result;
  }

  result.source = parseSource(parsedPayload.source);

  if (!Array.isArray(parsedPayload.items)) {
    result.errors.push('Payload must include an items array.');
    return result;
  }

  result.total = parsedPayload.items.length;

  parsedPayload.items.forEach((rawItem, itemIndex) => {
    const rowIndex = itemIndex + 1;

    if (!isRecord(rawItem)) {
      result.invalidRows.push({
        rowIndex,
        reason: 'Item must be an object.',
      });
      return;
    }

    const content = trimString(rawItem.content);
    if (!content) {
      result.invalidRows.push({
        rowIndex,
        reason: 'Missing required non-empty content.',
      });
      return;
    }

    const normalizedIntervals = normalizeIntervals(
      rawItem.intervals,
      defaultIntervals
    );
    if (normalizedIntervals.warning) {
      result.warnings.push(`Row ${rowIndex}: ${normalizedIntervals.warning}`);
    }

    const meta = parseMeta(rawItem.meta, rowIndex, result.warnings);

    result.validItems.push({
      rowIndex,
      externalId: trimString(rawItem.externalId),
      content,
      detail: trimString(rawItem.detail),
      source: trimString(rawItem.source),
      categoryId: trimString(rawItem.categoryId),
      intervals: normalizedIntervals.value,
      meta,
    });
  });

  return result;
}

export function buildImportDedupKey(input: ImportDedupKeyInput): string {
  const externalId = normalizeKeyPart(input.externalId);
  const sourceAssetId = normalizeKeyPart(input.sourceAssetId);

  if (externalId && sourceAssetId) {
    return `external_asset:${externalId}::${sourceAssetId}`;
  }

  if (externalId) {
    return `external:${externalId}`;
  }

  const normalizedContent = normalizeKeyPart(input.content);
  const normalizedSource = normalizeKeyPart(input.source);
  const normalizedLocationCfi = normalizeKeyPart(input.locationCfi);

  return `content:${normalizedContent}::source:${normalizedSource}::cfi:${normalizedLocationCfi}`;
}

function parseSource(rawSource: unknown): ImportPayloadSource | undefined {
  if (!isRecord(rawSource)) return undefined;

  const provider = trimString(rawSource.provider);
  const bookTitle = trimString(rawSource.bookTitle);
  const assetId = trimString(rawSource.assetId);

  if (!provider && !bookTitle && !assetId) return undefined;

  return { provider, bookTitle, assetId };
}

function parseMeta(
  rawMeta: unknown,
  rowIndex: number,
  warnings: string[]
): ImportPayloadItemMeta | undefined {
  if (rawMeta === undefined) return undefined;
  if (!isRecord(rawMeta)) {
    warnings.push(`Row ${rowIndex}: meta must be an object, ignored.`);
    return undefined;
  }

  const locationCfi = trimString(rawMeta.locationCfi);
  const highlightedAt = trimString(rawMeta.highlightedAt);
  const style = normalizeStyle(rawMeta.style);

  if (
    locationCfi === undefined &&
    highlightedAt === undefined &&
    style === undefined
  ) {
    return undefined;
  }

  return { locationCfi, highlightedAt, style };
}

function normalizeIntervals(
  rawIntervals: unknown,
  fallbackIntervals: number[]
): { value: number[]; warning?: string } {
  const fallback = cloneIntervals(fallbackIntervals);

  if (rawIntervals === undefined) {
    return { value: fallback };
  }

  if (!Array.isArray(rawIntervals) || rawIntervals.length === 0) {
    return {
      value: fallback,
      warning: 'Invalid intervals. Using default intervals.',
    };
  }

  const parsed = rawIntervals.map((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim()) return Number(value);
    return NaN;
  });

  const valid = parsed.every((value) => Number.isInteger(value) && value > 0);
  if (!valid) {
    return {
      value: fallback,
      warning: 'Intervals must be positive integers. Using default intervals.',
    };
  }

  return { value: parsed as number[] };
}

function normalizeStyle(rawStyle: unknown): number | undefined {
  if (typeof rawStyle !== 'number' || !Number.isFinite(rawStyle)) {
    return undefined;
  }
  return rawStyle;
}

function trimString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeKeyPart(value: string | undefined): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cloneIntervals(intervals: number[]): number[] {
  const normalized = intervals
    .filter((value) => Number.isInteger(value) && value > 0)
    .map((value) => value);

  if (normalized.length > 0) return normalized;
  return [...DEFAULT_INTERVALS];
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
