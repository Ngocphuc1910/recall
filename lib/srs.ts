import { RecallItem, DEFAULT_INTERVALS } from './types';

export function createNewItem(
  partial: {
    content: string;
    detail?: string;
    categoryId: string;
    source?: string;
    intervals?: number[];
    status?: 'active' | 'archived';
    externalId?: string;
    sourceAssetId?: string;
    sourceProvider?: string;
    locationCfi?: string;
    highlightedAt?: string;
    highlightStyle?: number;
  }
): RecallItem {
  const now = Date.now();
  const intervals = partial.intervals ?? DEFAULT_INTERVALS;
  return {
    id: generateId(),
    content: partial.content,
    detail: partial.detail ?? '',
    categoryId: partial.categoryId,
    source: partial.source ?? '',
    externalId: partial.externalId,
    sourceAssetId: partial.sourceAssetId,
    sourceProvider: partial.sourceProvider,
    locationCfi: partial.locationCfi,
    highlightedAt: partial.highlightedAt,
    highlightStyle: partial.highlightStyle,
    createdAt: now,
    nextReviewDate: addDays(now, intervals[0]),
    currentInterval: intervals[0],
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
): Partial<RecallItem> {
  const now = Date.now();

  if (recalled) {
    const nextIndex = Math.min(
      item.intervalIndex + 1,
      item.intervals.length - 1
    );
    const nextInterval = item.intervals[nextIndex];
    return {
      intervalIndex: nextIndex,
      currentInterval: nextInterval,
      nextReviewDate: addDays(now, nextInterval),
      reviewCount: item.reviewCount + 1,
      lastReviewedAt: now,
    };
  } else {
    return {
      intervalIndex: 0,
      currentInterval: item.intervals[0],
      nextReviewDate: addDays(now, item.intervals[0]),
      reviewCount: item.reviewCount + 1,
      lastReviewedAt: now,
    };
  }
}

export function isDueToday(item: RecallItem): boolean {
  const today = startOfDay(Date.now());
  const dueDate = startOfDay(item.nextReviewDate);
  return dueDate <= today && item.status === 'active';
}

export function getDueItems(items: RecallItem[]): RecallItem[] {
  return items.filter(isDueToday);
}

export function getIntervalLabel(days: number): string {
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days === 7) return '1 week';
  if (days < 30) return `${Math.round(days / 7)} weeks`;
  if (days === 30) return '1 month';
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}

function addDays(timestamp: number, days: number): number {
  return timestamp + days * 24 * 60 * 60 * 1000;
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
