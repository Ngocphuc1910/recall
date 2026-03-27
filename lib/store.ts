import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  db,
  ensureSignedIn,
  getFirebaseErrorMessage,
  getUserItemsCollection,
  getUserMetaRef,
  getUserStagedHighlightRef,
  getUserStagedHighlightsCollection,
  getUserSyncRequestsCollection,
  subscribeToAuth,
} from './firebase';
import {
  buildImportDedupKey,
  ImportActionOptions,
  ImportResult,
  parseImportJson,
} from './import';
import { createNewItem, getDueItems, getNextReview } from './srs';
import {
  Category,
  DEFAULT_CATEGORIES,
  DEFAULT_PRIORITY_CODE,
  DEFAULT_SETTINGS,
  PriorityCode,
  RecallItem,
  Settings,
  StagedHighlight,
  SyncRequest,
  getPriorityDefinition,
  normalizePriorityCode,
  normalizePriorityLabel,
} from './types';

type CloudAuthStatus = 'idle' | 'connecting' | 'connected' | 'error';
type CloudSyncStatus = 'local' | 'syncing' | 'synced' | 'error';
type ToastTone = 'success' | 'warning' | 'destructive';

interface ToastState {
  message: string;
  tone: ToastTone;
}

interface PersistedRecallState {
  items: RecallItem[];
  categories: Category[];
  settings: Settings;
}

interface RecallStore extends PersistedRecallState {
  stagedHighlights: StagedHighlight[];
  syncRequests: SyncRequest[];
  hasHydrated: boolean;
  cloudAuthStatus: CloudAuthStatus;
  cloudSyncStatus: CloudSyncStatus;
  cloudUserId: string | null;
  cloudError: string | null;
  lastSyncedAt: number | null;
  toast: ToastState | null;

  addItem: (partial: {
    content: string;
    detail?: string;
    categoryId: string;
    source?: string;
    intervals?: number[];
    priorityCode?: PriorityCode;
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

  requestAppleBooksSync: () => Promise<void>;
  updateStagedHighlightCategory: (
    id: string,
    categoryId: string
  ) => Promise<void>;
  updateStagedHighlightPriority: (
    id: string,
    priorityCode: PriorityCode
  ) => Promise<void>;
  approveStagedHighlight: (id: string) => Promise<void>;
  rejectStagedHighlight: (id: string) => Promise<void>;
  approveAllPendingStagedHighlights: () => Promise<void>;
  rejectAllPendingStagedHighlights: () => Promise<void>;
  setPendingHighlightsCategory: (categoryId: string) => Promise<void>;

  getTodayItems: () => RecallItem[];
  getItemById: (id: string) => RecallItem | undefined;
  getCategoryById: (id: string) => Category | undefined;
  showToast: (message: string, tone?: ToastTone) => void;
  hideToast: () => void;
  initializeCloudSync: () => void;
}

interface RemoteMeta {
  categories: Category[];
  settings: Settings;
}

let authUnsubscribe: (() => void) | null = null;
let metaUnsubscribe: (() => void) | null = null;
let itemsUnsubscribe: (() => void) | null = null;
let stagedHighlightsUnsubscribe: (() => void) | null = null;
let syncRequestsUnsubscribe: (() => void) | null = null;
let currentUid: string | null = null;
let isApplyingRemoteState = false;
let remoteMetaLoaded = false;
let remoteItemsLoaded = false;
let remoteMetaState: RemoteMeta | null = null;
let remoteItemsState: RecallItem[] = [];
let remoteItemIds = new Set<string>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let signInRequested = false;

export const useStore = create<RecallStore>()(
  persist(
    (set, get) => ({
      items: [],
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS,
      stagedHighlights: [],
      syncRequests: [],
      hasHydrated: false,
      cloudAuthStatus: 'idle',
      cloudSyncStatus: 'local',
      cloudUserId: null,
      cloudError: null,
      lastSyncedAt: null,
      toast: null,

      addItem: (partial) => {
        const item = createNewItem({
          ...partial,
          intervals: partial.intervals ?? get().settings.defaultIntervals,
          priorityCode: partial.priorityCode ?? DEFAULT_PRIORITY_CODE,
        });

        set((state) => ({ items: [item, ...state.items] }));
        scheduleCloudSync(get, set);
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
        scheduleCloudSync(get, set);
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
        scheduleCloudSync(get, set);
      },

      archiveItem: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, status: 'archived' as const } : item
          ),
        }));
        scheduleCloudSync(get, set);
      },

      markRecalled: (id) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            const updates = getNextReview(item, true);
            return { ...item, ...updates };
          }),
        }));
        scheduleCloudSync(get, set);
      },

      markForgotten: (id) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            const updates = getNextReview(item, false);
            return { ...item, ...updates };
          }),
        }));
        scheduleCloudSync(get, set);
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
        scheduleCloudSync(get, set);
      },

      deleteCategory: (id) => {
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        }));
        scheduleCloudSync(get, set);
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
        scheduleCloudSync(get, set);
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

        const dedupeKeys = buildAllDedupeKeys(state.items, state.stagedHighlights);
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
            priorityCode: getPriorityDefinition(row.meta?.style).code,
            priorityLabel: getPriorityDefinition(row.meta?.style).label,
            externalId: row.externalId,
            sourceAssetId: parsed.source?.assetId,
            sourceProvider: parsed.source?.provider,
            locationCfi: row.meta?.locationCfi,
            highlightedAt: row.meta?.highlightedAt,
            highlightStyle: row.meta?.style,
            createdAt: parseCreatedAtFromHighlightedAt(row.meta?.highlightedAt),
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
          scheduleCloudSync(get, set);
        }

        return {
          ...resultBase,
          imported: itemsToImport.length,
          skippedDuplicates,
        };
      },

      requestAppleBooksSync: async () => {
        const uid = await ensureCurrentUid(set);
        const existingRequest = get().syncRequests.find(
          (request) =>
            request.source === 'apple_books' &&
            (request.status === 'pending' || request.status === 'running')
        );

        if (existingRequest) {
          return;
        }

        const requestRef = doc(getUserSyncRequestsCollection(uid));
        const now = Date.now();

        await setDoc(requestRef, {
          id: requestRef.id,
          source: 'apple_books',
          status: 'pending',
          requestedAt: now,
          lastSeenAt: now,
        });
      },

      updateStagedHighlightCategory: async (id, categoryId) => {
        const uid = await ensureCurrentUid(set);

        await updateDoc(getUserStagedHighlightRef(uid, id), {
          categoryId,
          categoryStatus: 'chosen',
          updatedAt: Date.now(),
        });
      },

      updateStagedHighlightPriority: async (id, priorityCode) => {
        const uid = await ensureCurrentUid(set);
        const priority = getPriorityDefinition(priorityCode);

        await updateDoc(getUserStagedHighlightRef(uid, id), {
          priorityCode: priority.code,
          priorityLabel: priority.label,
          updatedAt: Date.now(),
        });
      },

      approveStagedHighlight: async (id) => {
        const uid = await ensureCurrentUid(set);
        const stagedHighlight = get().stagedHighlights.find(
          (highlight) => highlight.id === id
        );

        if (
          !stagedHighlight ||
          !stagedHighlight.categoryId ||
          stagedHighlight.categoryStatus !== 'chosen'
        ) {
          return;
        }

        const itemAlreadyExists = get().items.some(
          (item) => getRecallItemDedupKey(item) === stagedHighlight.dedupeKey
        );

        if (!itemAlreadyExists) {
          const item = createNewItem({
            content: stagedHighlight.content,
            detail: stagedHighlight.detail,
            source: stagedHighlight.source,
            categoryId: stagedHighlight.categoryId,
            intervals: get().settings.defaultIntervals,
            priorityCode: stagedHighlight.priorityCode,
            priorityLabel: stagedHighlight.priorityLabel,
            externalId: stagedHighlight.externalId,
            sourceAssetId: stagedHighlight.sourceAssetId,
            sourceProvider: stagedHighlight.sourceProvider,
            locationCfi: stagedHighlight.locationCfi,
            highlightedAt: stagedHighlight.highlightedAt,
            highlightStyle: stagedHighlight.highlightStyle,
            createdAt: stagedHighlight.createdAt,
          });

          set((state) => ({
            items: [item, ...state.items],
          }));
          scheduleCloudSync(get, set);
        }

        await updateDoc(getUserStagedHighlightRef(uid, id), {
          approvalStatus: 'approved',
          importStatus: itemAlreadyExists ? 'skipped_duplicate' : 'imported',
          approvedAt: Date.now(),
          updatedAt: Date.now(),
        });
      },

      rejectStagedHighlight: async (id) => {
        const uid = await ensureCurrentUid(set);

        await updateDoc(getUserStagedHighlightRef(uid, id), {
          approvalStatus: 'rejected',
          rejectedAt: Date.now(),
          updatedAt: Date.now(),
        });
      },

      approveAllPendingStagedHighlights: async () => {
        const uid = await ensureCurrentUid(set);
        const pendingHighlights = get().stagedHighlights.filter(
          (highlight) =>
            highlight.approvalStatus === 'pending' &&
            highlight.categoryStatus === 'chosen' &&
            !!highlight.categoryId
        );

        if (pendingHighlights.length === 0) {
          return;
        }

        const dedupeKeys = new Set(
          get().items.map((item) => getRecallItemDedupKey(item))
        );
        const approvedAt = Date.now();
        const itemsToAdd: RecallItem[] = [];
        const stagedUpdates = pendingHighlights.map((highlight) => {
          const isDuplicate = dedupeKeys.has(highlight.dedupeKey);

          if (!isDuplicate) {
            dedupeKeys.add(highlight.dedupeKey);
            itemsToAdd.push(
              createNewItem({
                content: highlight.content,
                detail: highlight.detail,
                source: highlight.source,
                categoryId: highlight.categoryId as string,
                intervals: get().settings.defaultIntervals,
                priorityCode: highlight.priorityCode,
                priorityLabel: highlight.priorityLabel,
                externalId: highlight.externalId,
                sourceAssetId: highlight.sourceAssetId,
                sourceProvider: highlight.sourceProvider,
                locationCfi: highlight.locationCfi,
                highlightedAt: highlight.highlightedAt,
                highlightStyle: highlight.highlightStyle,
                createdAt: highlight.createdAt,
              })
            );
          }

          return {
            id: highlight.id,
            approvalStatus: 'approved' as const,
            importStatus: isDuplicate
              ? ('skipped_duplicate' as const)
              : ('imported' as const),
            approvedAt,
            updatedAt: approvedAt,
          };
        });

        const batch = writeBatch(db);

        itemsToAdd.forEach((item) => {
          batch.set(getUserItemRef(uid, item.id), sanitizeForFirestore(item));
        });

        stagedUpdates.forEach((update) => {
          batch.update(getUserStagedHighlightRef(uid, update.id), update);
        });

        await batch.commit();

        set((state) => ({
          items: [...itemsToAdd, ...state.items],
          stagedHighlights: state.stagedHighlights.map((highlight) => {
            const stagedUpdate = stagedUpdates.find(
              (update) => update.id === highlight.id
            );
            return stagedUpdate ? { ...highlight, ...stagedUpdate } : highlight;
          }),
        }));
      },

      rejectAllPendingStagedHighlights: async () => {
        const uid = await ensureCurrentUid(set);
        const pendingHighlights = get().stagedHighlights.filter(
          (highlight) => highlight.approvalStatus === 'pending'
        );

        if (pendingHighlights.length === 0) {
          return;
        }

        const now = Date.now();
        const batch = writeBatch(db);

        pendingHighlights.forEach((highlight) => {
          batch.update(getUserStagedHighlightRef(uid, highlight.id), {
            approvalStatus: 'rejected',
            rejectedAt: now,
            updatedAt: now,
          });
        });

        await batch.commit();

        set((state) => ({
          stagedHighlights: state.stagedHighlights.map((highlight) =>
            highlight.approvalStatus === 'pending'
              ? {
                  ...highlight,
                  approvalStatus: 'rejected',
                  rejectedAt: now,
                  updatedAt: now,
                }
              : highlight
          ),
        }));
      },

      setPendingHighlightsCategory: async (categoryId) => {
        const uid = await ensureCurrentUid(set);
        const pendingHighlights = get().stagedHighlights.filter(
          (highlight) =>
            highlight.approvalStatus === 'pending' &&
            highlight.categoryId !== categoryId
        );

        if (pendingHighlights.length === 0) {
          return;
        }

        const batch = writeBatch(db);
        const now = Date.now();

        pendingHighlights.forEach((highlight) => {
          batch.update(getUserStagedHighlightRef(uid, highlight.id), {
            categoryId,
            categoryStatus: 'chosen',
            updatedAt: now,
          });
        });

        await batch.commit();
      },

      getTodayItems: () => getDueItems(get().items),

      getItemById: (id) => get().items.find((item) => item.id === id),

      getCategoryById: (id) => get().categories.find((c) => c.id === id),

      showToast: (message, tone = 'success') => {
        if (toastTimer) {
          clearTimeout(toastTimer);
        }

        set({ toast: { message, tone } });

        toastTimer = setTimeout(() => {
          set({ toast: null });
          toastTimer = null;
        }, 2200);
      },

      hideToast: () => {
        if (toastTimer) {
          clearTimeout(toastTimer);
          toastTimer = null;
        }

        set({ toast: null });
      },

      initializeCloudSync: () => {
        if (authUnsubscribe) {
          return;
        }

        set({
          cloudAuthStatus: 'connecting',
          cloudSyncStatus: currentUid ? 'syncing' : 'local',
          cloudError: null,
        });

        authUnsubscribe = subscribeToAuth((user) => {
          if (!user) {
            currentUid = null;
            detachRemoteListeners(set);
            set({
              cloudAuthStatus: 'connecting',
              cloudSyncStatus: 'local',
              cloudUserId: null,
            });

            if (!signInRequested) {
              signInRequested = true;
              ensureSignedIn().catch((error) => {
                set({
                  cloudAuthStatus: 'error',
                  cloudSyncStatus: 'error',
                  cloudError: getFirebaseErrorMessage(error),
                });
              });
            }
            return;
          }

          signInRequested = false;

          if (
            currentUid === user.uid &&
            metaUnsubscribe &&
            itemsUnsubscribe &&
            stagedHighlightsUnsubscribe &&
            syncRequestsUnsubscribe
          ) {
            set({
              cloudAuthStatus: 'connected',
              cloudUserId: user.uid,
              cloudError: null,
            });
            return;
          }

          currentUid = user.uid;
          attachRemoteListeners(user.uid, set, get);
        });

        ensureSignedIn().catch((error) => {
          set({
            cloudAuthStatus: 'error',
            cloudSyncStatus: 'error',
            cloudError: getFirebaseErrorMessage(error),
          });
        });
      },
    }),
    {
      name: 'recall-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        categories: state.categories,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          useStore.setState({
            items: state.items.map(normalizeRecallItem),
          });
        }
        state?.initializeCloudSync();
        if (state) {
          useStore.setState({ hasHydrated: true });
        }
      },
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

  const booksCategory = categories.find((category) => category.id === 'books');
  if (booksCategory) return booksCategory.id;

  const quotesCategory = categories.find((category) => category.id === 'quotes');
  if (quotesCategory) return quotesCategory.id;

  const otherCategory = categories.find((category) => category.id === 'other');
  if (otherCategory) return otherCategory.id;

  return categories[0]?.id ?? 'other';
}

function attachRemoteListeners(
  uid: string,
  set: (
    partial:
      | Partial<RecallStore>
      | ((state: RecallStore) => Partial<RecallStore>),
    replace?: false
  ) => void,
  get: () => RecallStore
) {
  detachRemoteListeners(set);

  remoteMetaLoaded = false;
  remoteItemsLoaded = false;
  remoteMetaState = null;
  remoteItemsState = [];
  remoteItemIds = new Set<string>();

  set({
    cloudAuthStatus: 'connected',
    cloudSyncStatus: 'syncing',
    cloudUserId: uid,
    cloudError: null,
    stagedHighlights: [],
    syncRequests: [],
  });

  metaUnsubscribe = onSnapshot(
    getUserMetaRef(uid),
    (snapshot) => {
      remoteMetaLoaded = true;
      remoteMetaState = snapshot.exists()
        ? (snapshot.data() as RemoteMeta)
        : null;
      maybeApplyRemoteState(set, get);
    },
    (error) => {
      set({
        cloudSyncStatus: 'error',
        cloudError: getFirebaseErrorMessage(error),
      });
    }
  );

  itemsUnsubscribe = onSnapshot(
    query(getUserItemsCollection(uid), orderBy('createdAt', 'desc')),
    (snapshot) => {
      remoteItemsLoaded = true;
      remoteItemIds = new Set(snapshot.docs.map((itemDoc) => itemDoc.id));
      remoteItemsState = snapshot.docs.map((itemDoc) =>
        normalizeRecallItem({
          ...(itemDoc.data() as RecallItem),
          id: itemDoc.id,
        })
      );
      maybeApplyRemoteState(set, get);
    },
    (error) => {
      set({
        cloudSyncStatus: 'error',
        cloudError: getFirebaseErrorMessage(error),
      });
    }
  );

  stagedHighlightsUnsubscribe = onSnapshot(
    query(getUserStagedHighlightsCollection(uid), orderBy('syncedAt', 'desc')),
    (snapshot) => {
      set({
        stagedHighlights: snapshot.docs.map((highlightDoc) =>
          normalizeStagedHighlight({
            ...(highlightDoc.data() as StagedHighlight),
            id: highlightDoc.id,
          })
        ),
      });
    },
    (error) => {
      set({
        cloudError: getFirebaseErrorMessage(error),
      });
    }
  );

  syncRequestsUnsubscribe = onSnapshot(
    query(
      getUserSyncRequestsCollection(uid),
      orderBy('requestedAt', 'desc'),
      limit(20)
    ),
    (snapshot) => {
      set({
        syncRequests: snapshot.docs.map((requestDoc) => ({
          ...(requestDoc.data() as SyncRequest),
          id: requestDoc.id,
        })),
      });
    },
    (error) => {
      set({
        cloudError: getFirebaseErrorMessage(error),
      });
    }
  );
}

function detachRemoteListeners(
  set: (
    partial:
      | Partial<RecallStore>
      | ((state: RecallStore) => Partial<RecallStore>),
    replace?: false
  ) => void
) {
  metaUnsubscribe?.();
  itemsUnsubscribe?.();
  stagedHighlightsUnsubscribe?.();
  syncRequestsUnsubscribe?.();
  metaUnsubscribe = null;
  itemsUnsubscribe = null;
  stagedHighlightsUnsubscribe = null;
  syncRequestsUnsubscribe = null;
  remoteMetaLoaded = false;
  remoteItemsLoaded = false;
  remoteMetaState = null;
  remoteItemsState = [];
  remoteItemIds = new Set<string>();
  set({
    stagedHighlights: [],
    syncRequests: [],
  });
}

function maybeApplyRemoteState(
  set: (
    partial:
      | Partial<RecallStore>
      | ((state: RecallStore) => Partial<RecallStore>),
    replace?: false
  ) => void,
  get: () => RecallStore
) {
  if (!remoteMetaLoaded || !remoteItemsLoaded) {
    return;
  }

  const hasRemoteData = !!remoteMetaState || remoteItemsState.length > 0;

  if (!hasRemoteData) {
    scheduleCloudSync(get, set, true);
    return;
  }

  isApplyingRemoteState = true;
  set({
    items: remoteItemsState,
    categories: remoteMetaState?.categories ?? get().categories,
    settings: remoteMetaState?.settings ?? get().settings,
    cloudSyncStatus: 'synced',
    cloudError: null,
    lastSyncedAt: Date.now(),
  });
  isApplyingRemoteState = false;
}

function scheduleCloudSync(
  get: () => RecallStore,
  set: (
    partial:
      | Partial<RecallStore>
      | ((state: RecallStore) => Partial<RecallStore>),
    replace?: false
  ) => void,
  immediate = false
) {
  if (!currentUid || isApplyingRemoteState) {
    return;
  }

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  set({
    cloudSyncStatus: 'syncing',
    cloudError: null,
  });

  const delay = immediate ? 0 : 400;
  syncTimer = setTimeout(() => {
    pushStateToCloud(get, set).catch((error) => {
      set({
        cloudSyncStatus: 'error',
        cloudError: getFirebaseErrorMessage(error),
      });
    });
  }, delay);
}

async function pushStateToCloud(
  get: () => RecallStore,
  set: (
    partial:
      | Partial<RecallStore>
      | ((state: RecallStore) => Partial<RecallStore>),
    replace?: false
  ) => void
) {
  if (!currentUid) {
    return;
  }

  const state = getPersistedState(get);
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const metaRef = getUserMetaRef(currentUid);

  operations.push((batch) => {
    batch.set(metaRef, {
      categories: state.categories,
      settings: state.settings,
      updatedAt: serverTimestamp(),
    });
  });

  const localItemIds = new Set<string>();
  state.items.forEach((item) => {
    localItemIds.add(item.id);
    operations.push((batch) => {
      batch.set(getUserItemRef(currentUid as string, item.id), sanitizeForFirestore(item));
    });
  });

  remoteItemIds.forEach((itemId) => {
    if (localItemIds.has(itemId)) {
      return;
    }

    operations.push((batch) => {
      batch.delete(getUserItemRef(currentUid as string, itemId));
    });
  });

  await commitInChunks(operations);

  set({
    cloudSyncStatus: 'synced',
    cloudError: null,
    lastSyncedAt: Date.now(),
  });
}

async function commitInChunks(
  operations: Array<(batch: ReturnType<typeof writeBatch>) => void>
) {
  const chunkSize = 400;

  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(index, index + chunkSize).forEach((operation) => {
      operation(batch);
    });
    await batch.commit();
  }
}

async function ensureCurrentUid(
  set: (
    partial:
      | Partial<RecallStore>
      | ((state: RecallStore) => Partial<RecallStore>),
    replace?: false
  ) => void
) {
  if (currentUid) {
    return currentUid;
  }

  set({
    cloudAuthStatus: 'connecting',
    cloudError: null,
  });
  const user = await ensureSignedIn();
  currentUid = user.uid;
  set({
    cloudAuthStatus: 'connected',
    cloudUserId: user.uid,
  });
  return user.uid;
}

function normalizeRecallItem(item: RecallItem): RecallItem {
  const priority = getPriorityDefinition(
    item.priorityCode ?? item.highlightStyle ?? DEFAULT_PRIORITY_CODE
  );
  const highlightedCreatedAt = parseCreatedAtFromHighlightedAt(item.highlightedAt);

  return {
    ...item,
    priorityCode: normalizePriorityCode(item.priorityCode ?? priority.code),
    priorityLabel: normalizePriorityLabel(
      item.priorityLabel,
      item.priorityCode ?? priority.code
    ),
    createdAt:
      highlightedCreatedAt ??
      (typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now()),
  };
}

function normalizeStagedHighlight(highlight: StagedHighlight): StagedHighlight {
  const priority = getPriorityDefinition(
    highlight.priorityCode ?? highlight.highlightStyle ?? DEFAULT_PRIORITY_CODE
  );
  const highlightedCreatedAt = parseCreatedAtFromHighlightedAt(
    highlight.highlightedAt
  );

  return {
    ...highlight,
    priorityCode: normalizePriorityCode(
      highlight.priorityCode ?? priority.code
    ),
    priorityLabel: normalizePriorityLabel(
      highlight.priorityLabel,
      highlight.priorityCode ?? priority.code
    ),
    createdAt:
      highlightedCreatedAt ??
      (typeof highlight.createdAt === 'number' &&
      Number.isFinite(highlight.createdAt)
        ? highlight.createdAt
        : Date.now()),
  };
}

function parseCreatedAtFromHighlightedAt(highlightedAt?: string): number | undefined {
  if (!highlightedAt) {
    return undefined;
  }

  const parsed = new Date(highlightedAt).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildAllDedupeKeys(
  items: RecallItem[],
  stagedHighlights: StagedHighlight[]
) {
  const dedupeKeys = new Set<string>();

  items.forEach((item) => {
    dedupeKeys.add(getRecallItemDedupKey(item));
  });

  stagedHighlights.forEach((highlight) => {
    dedupeKeys.add(highlight.dedupeKey);
  });

  return dedupeKeys;
}

function getPersistedState(get: () => RecallStore): PersistedRecallState {
  const state = get();
  return {
    items: state.items,
    categories: state.categories,
    settings: state.settings,
  };
}

function getUserItemRef(uid: string, itemId: string) {
  return doc(db, 'users', uid, 'items', itemId);
}

function getRecallItemDedupKey(item: RecallItem) {
  return buildImportDedupKey({
    externalId: item.externalId,
    sourceAssetId: item.sourceAssetId,
    content: item.content,
    source: item.source,
    locationCfi: item.locationCfi,
  });
}

function sanitizeForFirestore(value: unknown): any {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'object' && item !== null
        ? sanitizeForFirestore(item)
        : item
    );
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (entryValue === undefined) {
        return [];
      }

      if (Array.isArray(entryValue)) {
        return [[key, entryValue]];
      }

      if (typeof entryValue === 'object' && entryValue !== null) {
        return [[key, sanitizeForFirestore(entryValue)]];
      }

      return [[key, entryValue]];
    })
  );
}
