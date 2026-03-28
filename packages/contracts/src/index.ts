export type PriorityCode = 1 | 2 | 3 | 4 | 5;
export type PriorityLabel =
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Critical'
  | 'MindFuck';

export type RecallStatus = 'active' | 'archived';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ImportStatus = 'staged' | 'imported' | 'skipped_duplicate';
export type CategoryStatus = 'unset' | 'chosen';
export type SyncRequestStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SyncSource = 'apple_books';
export type ThemePreference = 'light' | 'dark' | 'system';
export type AccountStatus = 'active' | 'merged' | 'disabled';
export type MembershipStatus = 'anonymous' | 'active' | 'merged' | 'disabled';
export type AccountMigrationState =
  | 'pending_legacy_bootstrap'
  | 'migrating'
  | 'complete'
  | 'not_needed';
export type LinkCodeStatus = 'pending' | 'redeemed' | 'expired' | 'cancelled';
export type AuthProviderId =
  | 'anonymous'
  | 'google.com'
  | 'apple.com'
  | 'password'
  | 'unknown'
  | (string & {});

export interface PriorityDefinition {
  code: PriorityCode;
  label: PriorityLabel;
  color: string;
}

export interface RecallItem {
  id: string;
  content: string;
  detail: string;
  categoryId: string;
  source: string;
  priorityCode: PriorityCode;
  priorityLabel: PriorityLabel;
  externalId?: string;
  sourceAssetId?: string;
  sourceProvider?: string;
  locationCfi?: string;
  highlightedAt?: string;
  highlightStyle?: number;
  createdAt: number;
  nextReviewDate: number;
  currentInterval: number;
  intervalIndex: number;
  intervals: number[];
  reviewCount: number;
  lastReviewedAt: number | null;
  status: RecallStatus;
}

export interface StagedHighlight {
  id: string;
  content: string;
  detail: string;
  categoryId: string | null;
  categoryStatus: CategoryStatus;
  source: string;
  priorityCode: PriorityCode;
  priorityLabel: PriorityLabel;
  dedupeKey: string;
  approvalStatus: ApprovalStatus;
  importStatus: ImportStatus;
  sourceProvider?: string;
  externalId?: string;
  sourceAssetId?: string;
  locationCfi?: string;
  highlightedAt?: string;
  highlightStyle?: number;
  raw?: Record<string, unknown>;
  syncedAt: number;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  rejectedAt?: number;
}

export interface SyncRequest {
  id: string;
  source: SyncSource;
  status: SyncRequestStatus;
  requestedAt: number;
  requestedByAuthUid?: string;
  requestedByProvider?: AuthProviderId;
  startedAt?: number;
  completedAt?: number;
  lastSeenAt?: number;
  resultSummary?: string;
  error?: string;
}

export interface AccountMembership {
  accountId: string;
  providers: AuthProviderId[];
  primaryProvider: AuthProviderId;
  email?: string | null;
  displayName?: string | null;
  createdAt: number;
  lastLoginAt: number;
  status: MembershipStatus;
}

export interface AccountProfile {
  createdAt: number;
  updatedAt: number;
  ownerAuthUid: string;
  linkedProviders: AuthProviderId[];
  migrationState: AccountMigrationState;
  status: AccountStatus;
  mergedFromAccountIds?: string[];
  mergedIntoAccountId?: string;
  mergedAt?: number;
}

export interface ResolvedSession {
  authUid: string;
  accountId: string;
  provider: AuthProviderId;
  isAnonymous: boolean;
  isStableAccount: boolean;
}

export interface AccountLinkCode {
  code: string;
  targetAccountId: string;
  createdByAuthUid: string;
  createdAt: number;
  expiresAt: number;
  claimedByAuthUid?: string;
  claimedAt?: number;
  status: LinkCodeStatus;
}

export interface AccountMigrationReport {
  sourceKind: 'legacy_user' | 'account';
  sourceId: string;
  targetAccountId: string;
  copiedItems: number;
  copiedStagedHighlights: number;
  copiedSyncRequests: number;
  mergedCategories: number;
  performedAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export interface Settings {
  defaultIntervals: number[];
  dailyGoal: number;
  theme: ThemePreference;
  reviewQueueMode: 'sequential' | 'random';
  itemReviewMode: 'default' | 'fullscreen';
}

export interface MetaState {
  categories: Category[];
  settings: Settings;
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

export interface ImportPayloadItem {
  externalId?: string;
  content?: string;
  detail?: string;
  source?: string;
  categoryId?: string;
  intervals?: number[];
  meta?: ImportPayloadItemMeta;
}

export interface ImportPayload {
  version: 1;
  source?: ImportPayloadSource;
  items: ImportPayloadItem[];
}

export interface ImportSummary {
  total: number;
  valid: number;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  warnings: string[];
  errors: string[];
}

export interface AddItemDraft {
  content: string;
  detail?: string;
  source?: string;
  categoryId: string;
  priorityCode?: PriorityCode;
  intervals?: number[];
}

export const DEFAULT_INTERVALS = [1, 2, 3, 7, 14, 30, 60, 120, 240] as const;
export const DEFAULT_PRIORITY_CODE: PriorityCode = 2;

export const PRIORITY_DEFINITIONS: PriorityDefinition[] = [
  { code: 1, label: 'High', color: '#FF9F0A' },
  { code: 2, label: 'Medium', color: '#007AFF' },
  { code: 3, label: 'Low', color: '#34C759' },
  { code: 4, label: 'Critical', color: '#FF3B30' },
  { code: 5, label: 'MindFuck', color: '#DB2777' },
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'books', name: 'Books', icon: 'book.closed', color: '#007AFF', order: 0 },
  { id: 'vocabulary', name: 'Vocabulary', icon: 'textformat.abc', color: '#5856D6', order: 1 },
  { id: 'quotes', name: 'Quotes', icon: 'quote.bubble', color: '#FF9500', order: 2 },
  { id: 'concepts', name: 'Concepts', icon: 'lightbulb', color: '#34C759', order: 3 },
  { id: 'other', name: 'Other', icon: 'sparkles', color: '#FF2D55', order: 4 },
];

export const DEFAULT_SETTINGS: Settings = {
  defaultIntervals: [...DEFAULT_INTERVALS],
  dailyGoal: 20,
  theme: 'system',
  reviewQueueMode: 'sequential',
  itemReviewMode: 'default',
};

export function normalizePriorityCode(
  value: number | string | null | undefined
): PriorityCode {
  const parsed =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);

  if (parsed >= 1 && parsed <= 5) {
    return parsed as PriorityCode;
  }

  return DEFAULT_PRIORITY_CODE;
}

export function getPriorityDefinition(
  value: number | string | null | undefined
): PriorityDefinition {
  const code = normalizePriorityCode(value);
  return (
    PRIORITY_DEFINITIONS.find((priority) => priority.code === code) ??
    PRIORITY_DEFINITIONS[1]
  );
}

export function getPriorityDefinitionFromStyle(style?: number | null) {
  return getPriorityDefinition(style);
}

export function normalizePriorityLabel(
  value: string | null | undefined,
  fallbackCode?: number | string | null
): PriorityLabel {
  const fallback = getPriorityDefinition(fallbackCode).label;

  if (!value) {
    return fallback;
  }

  const matched = PRIORITY_DEFINITIONS.find(
    (priority) => priority.label.toLowerCase() === value.toLowerCase()
  );

  return matched?.label ?? fallback;
}

export function resolveImportCategoryId(
  categoryId: string | undefined,
  categories: Category[]
): string {
  if (categoryId && categories.some((category) => category.id === categoryId)) {
    return categoryId;
  }

  return (
    categories.find((category) => category.id === 'books')?.id ??
    categories.find((category) => category.id === 'quotes')?.id ??
    categories.find((category) => category.id === 'other')?.id ??
    categories[0]?.id ??
    'other'
  );
}

export function buildImportDedupKey(input: {
  externalId?: string;
  sourceAssetId?: string;
  content: string;
  source: string;
  locationCfi?: string;
}): string {
  const externalId = normalizeKeyPart(input.externalId);
  const sourceAssetId = normalizeKeyPart(input.sourceAssetId);

  if (externalId && sourceAssetId) {
    return `external_asset:${externalId}::${sourceAssetId}`;
  }

  if (externalId) {
    return `external:${externalId}`;
  }

  return `content:${normalizeKeyPart(input.content)}::source:${normalizeKeyPart(
    input.source
  )}::cfi:${normalizeKeyPart(input.locationCfi)}`;
}

export function parseCreatedAtFromHighlightedAt(
  highlightedAt?: string
): number | undefined {
  if (!highlightedAt) {
    return undefined;
  }

  const parsed = new Date(highlightedAt).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createNewItem(
  partial: AddItemDraft & {
    externalId?: string;
    sourceAssetId?: string;
    sourceProvider?: string;
    locationCfi?: string;
    highlightedAt?: string;
    highlightStyle?: number;
    createdAt?: number;
    status?: RecallStatus;
  },
  defaultIntervals: number[] = [...DEFAULT_INTERVALS]
): RecallItem {
  const now = Date.now();
  const intervals =
    partial.intervals && partial.intervals.length > 0
      ? partial.intervals
      : defaultIntervals;
  const priority = getPriorityDefinition(
    partial.priorityCode ?? partial.highlightStyle
  );

  return {
    id: generateId(),
    content: partial.content.trim(),
    detail: partial.detail?.trim() ?? '',
    categoryId: partial.categoryId,
    source: partial.source?.trim() ?? '',
    priorityCode: priority.code,
    priorityLabel: normalizePriorityLabel(undefined, priority.code),
    externalId: partial.externalId,
    sourceAssetId: partial.sourceAssetId,
    sourceProvider: partial.sourceProvider,
    locationCfi: partial.locationCfi,
    highlightedAt: partial.highlightedAt,
    highlightStyle: partial.highlightStyle,
    createdAt:
      typeof partial.createdAt === 'number' && Number.isFinite(partial.createdAt)
        ? partial.createdAt
        : now,
    nextReviewDate: now + (intervals[0] ?? 1) * 24 * 60 * 60 * 1000,
    currentInterval: intervals[0] ?? 1,
    intervalIndex: 0,
    intervals,
    reviewCount: 0,
    lastReviewedAt: null,
    status: partial.status ?? 'active',
  };
}

export function getNextReview(
  item: RecallItem,
  recalled: boolean
): Pick<
  RecallItem,
  'intervalIndex' | 'currentInterval' | 'nextReviewDate' | 'reviewCount' | 'lastReviewedAt'
> {
  const now = Date.now();

  if (recalled) {
    const nextIndex = Math.min(item.intervalIndex + 1, item.intervals.length - 1);
    const nextInterval = item.intervals[nextIndex];
    return {
      intervalIndex: nextIndex,
      currentInterval: nextInterval,
      nextReviewDate: now + nextInterval * 24 * 60 * 60 * 1000,
      reviewCount: item.reviewCount + 1,
      lastReviewedAt: now,
    };
  }

  const firstInterval = item.intervals[0] ?? 1;
  return {
    intervalIndex: 0,
    currentInterval: firstInterval,
    nextReviewDate: now + firstInterval * 24 * 60 * 60 * 1000,
    reviewCount: item.reviewCount + 1,
    lastReviewedAt: now,
  };
}

export function parseImportJson(
  rawJson: string,
  categories: Category[],
  settings: Settings,
  existingItems: RecallItem[],
  stagedHighlights: StagedHighlight[]
): { summary: ImportSummary; items: RecallItem[] } {
  if (!rawJson.trim()) {
    return {
      summary: emptySummary(['Please paste a JSON payload before importing.']),
      items: [],
    };
  }

  let payload: ImportPayload;
  try {
    payload = JSON.parse(rawJson) as ImportPayload;
  } catch {
    return {
      summary: emptySummary(['Invalid JSON format.']),
      items: [],
    };
  }

  if (payload.version !== 1 || !Array.isArray(payload.items)) {
    return {
      summary: emptySummary(['Unsupported payload version or missing items array.']),
      items: [],
    };
  }

  const dedupeKeys = new Set<string>();
  existingItems.forEach((item) =>
    dedupeKeys.add(
      buildImportDedupKey({
        externalId: item.externalId,
        sourceAssetId: item.sourceAssetId,
        content: item.content,
        source: item.source,
        locationCfi: item.locationCfi,
      })
    )
  );
  stagedHighlights.forEach((highlight) => dedupeKeys.add(highlight.dedupeKey));

  const warnings: string[] = [];
  const items: RecallItem[] = [];
  let skippedInvalid = 0;
  let skippedDuplicates = 0;
  let valid = 0;

  payload.items.forEach((row, index) => {
    const content = row.content?.trim();
    if (!content) {
      skippedInvalid += 1;
      warnings.push(`Row ${index + 1}: Missing required non-empty content.`);
      return;
    }

    valid += 1;
    const source = row.source?.trim() || payload.source?.bookTitle || '';
    const dedupeKey = buildImportDedupKey({
      externalId: row.externalId,
      sourceAssetId: payload.source?.assetId,
      content,
      source,
      locationCfi: row.meta?.locationCfi,
    });

    if (dedupeKeys.has(dedupeKey)) {
      skippedDuplicates += 1;
      return;
    }

    dedupeKeys.add(dedupeKey);
    items.push(
      createNewItem(
        {
          content,
          detail: row.detail,
          source,
          categoryId: resolveImportCategoryId(row.categoryId, categories),
          priorityCode: getPriorityDefinitionFromStyle(row.meta?.style).code,
          intervals: row.intervals ?? settings.defaultIntervals,
          externalId: row.externalId,
          sourceAssetId: payload.source?.assetId,
          sourceProvider: payload.source?.provider,
          locationCfi: row.meta?.locationCfi,
          highlightedAt: row.meta?.highlightedAt,
          highlightStyle: row.meta?.style,
          createdAt: parseCreatedAtFromHighlightedAt(row.meta?.highlightedAt),
        },
        settings.defaultIntervals
      )
    );
  });

  return {
    summary: {
      total: payload.items.length,
      valid,
      imported: items.length,
      skippedDuplicates,
      skippedInvalid,
      warnings,
      errors: [],
    },
    items,
  };
}

function emptySummary(errors: string[]): ImportSummary {
  return {
    total: 0,
    valid: 0,
    imported: 0,
    skippedDuplicates: 0,
    skippedInvalid: 0,
    warnings: [],
    errors,
  };
}

function normalizeKeyPart(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
