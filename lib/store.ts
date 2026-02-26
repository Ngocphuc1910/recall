import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RecallItem,
  Category,
  Settings,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
} from './types';
import { createNewItem, getNextReview, getDueItems } from './srs';
import {
  parseImportJson,
  buildImportDedupKey,
  ImportActionOptions,
  ImportResult,
} from './import';

interface RecallStore {
  items: RecallItem[];
  categories: Category[];
  settings: Settings;

  addItem: (partial: {
    content: string;
    detail?: string;
    categoryId: string;
    source?: string;
    intervals?: number[];
  }) => void;
  updateItem: (id: string, updates: Partial<RecallItem>) => void;
  deleteItem: (id: string) => void;
  archiveItem: (id: string) => void;
  markRecalled: (id: string) => void;
  markForgotten: (id: string) => void;

  addCategory: (cat: Omit<Category, 'id' | 'order'>) => void;
  deleteCategory: (id: string) => void;

  updateSettings: (updates: Partial<Settings>) => void;
  bulkImportFromJson: (
    rawJson: string,
    options?: ImportActionOptions
  ) => ImportResult;

  getTodayItems: () => RecallItem[];
  getItemById: (id: string) => RecallItem | undefined;
  getCategoryById: (id: string) => Category | undefined;
}

export const useStore = create<RecallStore>()(
  persist(
    (set, get) => ({
      items: [],
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS,

      addItem: (partial) => {
        const item = createNewItem({
          ...partial,
          intervals: partial.intervals ?? get().settings.defaultIntervals,
        });
        set((state) => ({ items: [item, ...state.items] }));
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      archiveItem: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, status: 'archived' as const } : item
          ),
        }));
      },

      markRecalled: (id) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            const updates = getNextReview(item, true);
            return { ...item, ...updates };
          }),
        }));
      },

      markForgotten: (id) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            const updates = getNextReview(item, false);
            return { ...item, ...updates };
          }),
        }));
      },

      addCategory: (cat) => {
        const id =
          cat.name.toLowerCase().replace(/\s+/g, '_') +
          '_' +
          Date.now().toString(36);
        const order = get().categories.length;
        set((state) => ({
          categories: [...state.categories, { ...cat, id, order }],
        }));
      },

      deleteCategory: (id) => {
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        }));
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      bulkImportFromJson: (rawJson, options) => {
        const state = get();
        const parsed = parseImportJson(rawJson, state.settings.defaultIntervals);

        const resultBase: Omit<ImportResult, 'imported' | 'skippedDuplicates'> = {
          total: parsed.total,
          valid: parsed.validItems.length,
          skippedInvalid: parsed.invalidRows.length,
          warnings: [...parsed.warnings],
          errors: [...parsed.errors],
          invalidRows: parsed.invalidRows,
        };

        if (parsed.errors.length > 0) {
          return {
            ...resultBase,
            imported: 0,
            skippedDuplicates: 0,
          };
        }

        const dedupeKeys = new Set<string>();
        state.items.forEach((item) => {
          dedupeKeys.add(
            buildImportDedupKey({
              externalId: item.externalId,
              sourceAssetId: item.sourceAssetId,
              content: item.content,
              source: item.source,
              locationCfi: item.locationCfi,
            })
          );
        });

        const itemsToImport: RecallItem[] = [];
        let skippedDuplicates = 0;

        parsed.validItems.forEach((row) => {
          const categoryId = resolveImportCategoryId(row.categoryId, state.categories);
          const mappedSource = row.source ?? parsed.source?.bookTitle ?? '';

          const dedupeKey = buildImportDedupKey({
            externalId: row.externalId,
            sourceAssetId: parsed.source?.assetId,
            content: row.content,
            source: mappedSource,
            locationCfi: row.meta?.locationCfi,
          });

          if (dedupeKeys.has(dedupeKey)) {
            skippedDuplicates += 1;
            return;
          }

          dedupeKeys.add(dedupeKey);

          const item = createNewItem({
            content: row.content,
            detail: row.detail,
            source: mappedSource,
            categoryId,
            intervals: row.intervals,
            externalId: row.externalId,
            sourceAssetId: parsed.source?.assetId,
            sourceProvider: parsed.source?.provider,
            locationCfi: row.meta?.locationCfi,
            highlightedAt: row.meta?.highlightedAt,
            highlightStyle: row.meta?.style,
          });

          itemsToImport.push(item);
        });

        if (skippedDuplicates > 0) {
          resultBase.warnings.push(
            `Skipped ${skippedDuplicates} duplicate item${
              skippedDuplicates === 1 ? '' : 's'
            }.`
          );
        }

        if (!options?.dryRun && itemsToImport.length > 0) {
          set((current) => ({
            items: [...itemsToImport, ...current.items],
          }));
        }

        return {
          ...resultBase,
          imported: itemsToImport.length,
          skippedDuplicates,
        };
      },

      getTodayItems: () => getDueItems(get().items),

      getItemById: (id) => get().items.find((item) => item.id === id),

      getCategoryById: (id) => get().categories.find((c) => c.id === id),
    }),
    {
      name: 'recall-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

function resolveImportCategoryId(
  categoryId: string | undefined,
  categories: Category[]
): string {
  if (categoryId && categories.some((category) => category.id === categoryId)) {
    return categoryId;
  }

  const quotesCategory = categories.find((category) => category.id === 'quotes');
  if (quotesCategory) return quotesCategory.id;

  const otherCategory = categories.find((category) => category.id === 'other');
  if (otherCategory) return otherCategory.id;

  return categories[0]?.id ?? 'other';
}
