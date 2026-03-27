export type PriorityCode = 1 | 2 | 3 | 4 | 5;
export type PriorityLabel =
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Critical'
  | 'MindFuck';

export interface PriorityDefinition {
  code: PriorityCode;
  label: PriorityLabel;
  color: string;
}

export const PRIORITY_DEFINITIONS: PriorityDefinition[] = [
  { code: 1, label: 'High', color: '#FF9F0A' },
  { code: 2, label: 'Medium', color: '#34C759' },
  { code: 3, label: 'Low', color: '#007AFF' },
  { code: 4, label: 'Critical', color: '#EC4899' },
  { code: 5, label: 'MindFuck', color: '#7C3AED' },
];

export const DEFAULT_PRIORITY_CODE: PriorityCode = 2;

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
  status: 'active' | 'archived';
}

export interface StagedHighlight {
  id: string;
  content: string;
  detail: string;
  categoryId: string | null;
  categoryStatus: 'unset' | 'chosen';
  source: string;
  priorityCode: PriorityCode;
  priorityLabel: PriorityLabel;
  dedupeKey: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  importStatus: 'staged' | 'imported' | 'skipped_duplicate';
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
  source: 'apple_books';
  status: 'pending' | 'running' | 'completed' | 'failed';
  requestedAt: number;
  startedAt?: number;
  completedAt?: number;
  lastSeenAt?: number;
  resultSummary?: string;
  error?: string;
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
  theme: 'light' | 'dark' | 'system';
  reviewQueueMode: 'sequential' | 'random';
  itemReviewMode: 'default' | 'fullscreen';
}

export type NewItem = Omit<
  RecallItem,
  'id' | 'createdAt' | 'nextReviewDate' | 'currentInterval' | 'intervalIndex' | 'reviewCount' | 'lastReviewedAt'
>;

export const DEFAULT_INTERVALS = [1, 2, 3, 7, 14, 30, 60, 120, 240];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'books', name: 'Books', icon: 'book-outline', color: '#007AFF', order: 0 },
  { id: 'vocabulary', name: 'Vocabulary', icon: 'text-outline', color: '#5856D6', order: 1 },
  { id: 'quotes', name: 'Quotes', icon: 'chatbubble-outline', color: '#FF9500', order: 2 },
  { id: 'concepts', name: 'Concepts', icon: 'bulb-outline', color: '#34C759', order: 3 },
  { id: 'other', name: 'Other', icon: 'star-outline', color: '#FF2D55', order: 4 },
];

export const DEFAULT_SETTINGS: Settings = {
  defaultIntervals: DEFAULT_INTERVALS,
  dailyGoal: 20,
  theme: 'system',
  reviewQueueMode: 'sequential',
  itemReviewMode: 'default',
};

export function getPriorityDefinition(
  value: number | string | null | undefined
): PriorityDefinition {
  const normalized = normalizePriorityCode(value);
  return (
    PRIORITY_DEFINITIONS.find((priority) => priority.code === normalized) ??
    PRIORITY_DEFINITIONS[1]
  );
}

export function getPriorityDefinitionFromStyle(
  style: number | null | undefined
): PriorityDefinition {
  return getPriorityDefinition(style);
}

export function getPriorityLabelFromCode(
  value: number | string | null | undefined
): PriorityLabel {
  return getPriorityDefinition(value).label;
}

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

export function normalizePriorityLabel(
  value: string | null | undefined,
  fallbackCode?: number | string | null
): PriorityLabel {
  if (fallbackCode !== undefined && fallbackCode !== null) {
    const parsedFallback =
      typeof fallbackCode === 'string'
        ? Number.parseInt(fallbackCode, 10)
        : Number(fallbackCode);

    if (parsedFallback >= 1 && parsedFallback <= 5) {
      return getPriorityLabelFromCode(parsedFallback);
    }
  }

  if (typeof value === 'string') {
    const matched = PRIORITY_DEFINITIONS.find(
      (priority) => priority.label.toLowerCase() === value.toLowerCase()
    );
    if (matched) {
      return matched.label;
    }
  }

  return getPriorityLabelFromCode(fallbackCode);
}
