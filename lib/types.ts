export interface RecallItem {
  id: string;
  content: string;
  detail: string;
  categoryId: string;
  source: string;
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
};
