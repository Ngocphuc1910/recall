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
