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
  createAccountLinkCode as requestAccountLinkCode,
  db,
  ensureResolvedSession,
  getFirebaseErrorMessage,
  getAccountItemRef,
  getAccountItemsCollection,
  getAccountMetaRef,
  getAccountStagedHighlightRef,
  getAccountStagedHighlightsCollection,
  getAccountSyncRequestsCollection,
  redeemAccountLinkCode as redeemLinkCode,
  signOutCurrentUser,
  startAppleSignIn,
  startGooglePopupAuth,
  startGooglePopupSignIn,
  subscribeToResolvedSession,
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
  AccountLinkCode,
  PriorityCode,
  RecallItem,
  ResolvedSession,
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
  cloudAccountId: string | null;
  cloudProvider: string | null;
  cloudIsAnonymous: boolean;
  cloudIsStableAccount: boolean;
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
  ) => Promise<ImportResult>;

  requestAppleBooksSync: () => Promise<void>;
  updateStagedHighlightCategory: (
    id: string,
    categoryId: string
  ) => Promise<void>;
  updateStagedHighlightPriority: (
    id: string,
    priorityCode: PriorityCode
  ) => Promise<void>;
  updateStagedHighlightFields: (
    id: string,
    fields: { content: string; detail: string; source: string; categoryId: string; priorityCode: PriorityCode }
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
  startAppleUpgrade: () => Promise<void>;
  startGoogleUpgrade: () => Promise<void>;
  startGoogleLogin: () => Promise<void>;
  createAccountLinkCode: () => Promise<AccountLinkCode>;
  redeemAccountLinkCode: (code: string) => Promise<void>;
  signOutCloudUser: () => Promise<void>;
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
let currentSession: ResolvedSession | null = null;
let isApplyingRemoteState = false;
let remoteMetaLoaded = false;
let remoteItemsLoaded = false;
let remoteMetaState: RemoteMeta | null = null;
let remoteItemsState: RecallItem[] = [];
let remoteItemIds = new Set<string>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

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
      cloudAccountId: null,
      cloudProvider: null,
      cloudIsAnonymous: true,
      cloudIsStableAccount: false,
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

      bulkImportFromJson: async (rawJson, options) => {
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
        const highlightsToStage: StagedHighlight[] = [];
        let skippedDuplicates = 0;

        parsed.validItems.forEach((row) => {
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

          const priority = getPriorityDefinition(row.meta?.style);
          const resolvedCategoryId = resolveImportCategoryId(row.categoryId, state.categories);
          const now = Date.now();

          const highlight: StagedHighlight = {
            id: '',
            content: row.content,
            detail: row.detail ?? '',
            categoryId: resolvedCategoryId,
            categoryStatus: 'chosen',
            source: mappedSource,
            priorityCode: priority.code,
            priorityLabel: priority.label,
            dedupeKey,
            approvalStatus: 'pending',
            importStatus: 'staged',
            syncedAt: now,
            createdAt: parseCreatedAtFromHighlightedAt(row.meta?.highlightedAt) ?? now,
            updatedAt: now,
          };

          // Only set optional fields if they have a value — Firestore rejects undefined
          if (row.externalId) highlight.externalId = row.externalId;
          if (parsed.source?.assetId) highlight.sourceAssetId = parsed.source.assetId;
          if (parsed.source?.provider) highlight.sourceProvider = parsed.source.provider;
          if (row.meta?.locationCfi) highlight.locationCfi = row.meta.locationCfi;
          if (row.meta?.highlightedAt) highlight.highlightedAt = row.meta.highlightedAt;
          if (row.meta?.style !== undefined) highlight.highlightStyle = row.meta.style;

          highlightsToStage.push(highlight);
        });

        if (skippedDuplicates > 0) {
          resultBase.warnings.push(
            `Skipped ${skippedDuplicates} duplicate item${
              skippedDuplicates === 1 ? '' : 's'
            }.`
          );
        }

        if (!options?.dryRun && highlightsToStage.length > 0) {
          const session = await ensureCurrentSession(set);
          const batch = writeBatch(db);
          const staged: StagedHighlight[] = [];

          highlightsToStage.forEach((highlight) => {
            const ref = doc(getAccountStagedHighlightsCollection(session.accountId));
            const withId = { ...highlight, id: ref.id };
            batch.set(ref, withId);
            staged.push(withId);
          });

          await batch.commit();

          set((current) => ({
            stagedHighlights: [...staged, ...current.stagedHighlights],
          }));
        }

        return {
          ...resultBase,
          imported: highlightsToStage.length,
          skippedDuplicates,
        };
      },

      requestAppleBooksSync: async () => {
        const session = await ensureCurrentSession(set);
        const existingRequest = get().syncRequests.find(
          (request) =>
            request.source === 'apple_books' &&
            (request.status === 'pending' || request.status === 'running')
        );

        if (existingRequest) {
          return;
        }

        if (!session.isStableAccount) {
          throw new Error(
            'A stable signed-in account is required before requesting Apple Books sync.'
          );
        }

        const requestRef = doc(getAccountSyncRequestsCollection(session.accountId));
        const now = Date.now();

        await setDoc(requestRef, {
          id: requestRef.id,
          source: 'apple_books',
          status: 'pending',
          requestedAt: now,
          requestedByAuthUid: session.authUid,
          requestedByProvider: session.provider,
          lastSeenAt: now,
        });
      },

      updateStagedHighlightCategory: async (id, categoryId) => {
        const session = await ensureCurrentSession(set);

        await updateDoc(getAccountStagedHighlightRef(session.accountId, id), {
          categoryId,
          categoryStatus: 'chosen',
          updatedAt: Date.now(),
        });
      },

      updateStagedHighlightPriority: async (id, priorityCode) => {
        const session = await ensureCurrentSession(set);
        const priority = getPriorityDefinition(priorityCode);

        await updateDoc(getAccountStagedHighlightRef(session.accountId, id), {
          priorityCode: priority.code,
          priorityLabel: priority.label,
          updatedAt: Date.now(),
        });
      },

      updateStagedHighlightFields: async (id, fields) => {
        const session = await ensureCurrentSession(set);
        const priority = getPriorityDefinition(fields.priorityCode);

        await updateDoc(getAccountStagedHighlightRef(session.accountId, id), {
          content: fields.content,
          detail: fields.detail,
          source: fields.source,
          categoryId: fields.categoryId,
          categoryStatus: 'chosen',
          priorityCode: priority.code,
          priorityLabel: priority.label,
          updatedAt: Date.now(),
        });
      },

      approveStagedHighlight: async (id) => {
        const session = await ensureCurrentSession(set);
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

        await updateDoc(getAccountStagedHighlightRef(session.accountId, id), {
          approvalStatus: 'approved',
          importStatus: itemAlreadyExists ? 'skipped_duplicate' : 'imported',
          approvedAt: Date.now(),
          updatedAt: Date.now(),
        });
      },

      rejectStagedHighlight: async (id) => {
        const session = await ensureCurrentSession(set);

        await updateDoc(getAccountStagedHighlightRef(session.accountId, id), {
          approvalStatus: 'rejected',
          rejectedAt: Date.now(),
          updatedAt: Date.now(),
        });
      },

      approveAllPendingStagedHighlights: async () => {
        const session = await ensureCurrentSession(set);
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
          batch.set(getAccountItemRef(session.accountId, item.id), sanitizeForFirestore(item));
        });

        stagedUpdates.forEach((update) => {
          batch.update(getAccountStagedHighlightRef(session.accountId, update.id), update);
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
        const session = await ensureCurrentSession(set);
        const pendingHighlights = get().stagedHighlights.filter(
          (highlight) => highlight.approvalStatus === 'pending'
        );

        if (pendingHighlights.length === 0) {
          return;
        }

        const now = Date.now();
        const batch = writeBatch(db);

        pendingHighlights.forEach((highlight) => {
          batch.update(getAccountStagedHighlightRef(session.accountId, highlight.id), {
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
        const session = await ensureCurrentSession(set);
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
          batch.update(getAccountStagedHighlightRef(session.accountId, highlight.id), {
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

      startGoogleUpgrade: async () => {
        await startGooglePopupAuth();
      },

      startGoogleLogin: async () => {
        await startGooglePopupSignIn();
        currentSession = await ensureResolvedSession();
        attachRemoteListeners(currentSession, set, get);
      },

      startAppleUpgrade: async () => {
        await startAppleSignIn();
      },

      createAccountLinkCode: async () => {
        const session = await ensureCurrentSession(set);
        if (!session.isStableAccount) {
          throw new Error('Upgrade to a stable account before generating a link code.');
        }
        return requestAccountLinkCode();
      },

      redeemAccountLinkCode: async (code) => {
        const session = await ensureCurrentSession(set);
        if (!session.isStableAccount) {
          throw new Error('Upgrade to a stable account before redeeming a link code.');
        }

        await redeemLinkCode(code.trim());
        currentSession = await ensureResolvedSession();
        attachRemoteListeners(currentSession, set, get);
      },

      signOutCloudUser: async () => {
        await signOutCurrentUser();
        currentSession = null;
        detachRemoteListeners(set);
        set({
          cloudAuthStatus: 'idle',
          cloudSyncStatus: 'local',
          cloudUserId: null,
          cloudAccountId: null,
          cloudProvider: null,
          cloudIsAnonymous: true,
          cloudIsStableAccount: false,
          cloudError: null,
        });
      },

      initializeCloudSync: () => {
        if (authUnsubscribe) {
          return;
        }

        set({
          cloudAuthStatus: 'connecting',
          cloudSyncStatus: currentSession ? 'syncing' : 'local',
          cloudError: null,
        });

        authUnsubscribe = subscribeToResolvedSession((session) => {
          if (!session) {
            currentSession = null;
            detachRemoteListeners(set);
            set({
              cloudAuthStatus: 'connecting',
              cloudSyncStatus: 'local',
              cloudUserId: null,
              cloudAccountId: null,
              cloudProvider: null,
              cloudIsAnonymous: true,
              cloudIsStableAccount: false,
            });
            return;
          }

          if (
            currentSession?.authUid === session.authUid &&
            currentSession?.accountId === session.accountId &&
            metaUnsubscribe &&
            itemsUnsubscribe &&
            stagedHighlightsUnsubscribe &&
            syncRequestsUnsubscribe
          ) {
            set({
              cloudAuthStatus: 'connected',
              cloudUserId: session.authUid,
              cloudAccountId: session.accountId,
              cloudProvider: session.provider,
              cloudIsAnonymous: session.isAnonymous,
              cloudIsStableAccount: session.isStableAccount,
              cloudError: null,
            });
            return;
          }

          currentSession = session;
          attachRemoteListeners(session, set, get);
        }, (error) => {
          set({
            cloudAuthStatus: 'error',
            cloudSyncStatus: 'error',
            cloudError: getFirebaseErrorMessage(error),
          });
        });

        ensureResolvedSession().catch((error) => {
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
  session: ResolvedSession,
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
    cloudUserId: session.authUid,
    cloudAccountId: session.accountId,
    cloudProvider: session.provider,
    cloudIsAnonymous: session.isAnonymous,
    cloudIsStableAccount: session.isStableAccount,
    cloudError: null,
    stagedHighlights: [],
    syncRequests: [],
  });

  metaUnsubscribe = onSnapshot(
    getAccountMetaRef(session.accountId),
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
    query(getAccountItemsCollection(session.accountId), orderBy('createdAt', 'desc')),
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
    query(
      getAccountStagedHighlightsCollection(session.accountId),
      orderBy('syncedAt', 'desc')
    ),
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
      getAccountSyncRequestsCollection(session.accountId),
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
  if (!currentSession || isApplyingRemoteState) {
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
  if (!currentSession) {
    return;
  }

  const state = getPersistedState(get);
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const accountId = currentSession.accountId;
  const metaRef = getAccountMetaRef(accountId);

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
      batch.set(getAccountItemRef(accountId, item.id), sanitizeForFirestore(item));
    });
  });

  remoteItemIds.forEach((itemId) => {
    if (localItemIds.has(itemId)) {
      return;
    }

    operations.push((batch) => {
      batch.delete(getAccountItemRef(accountId, itemId));
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

async function ensureCurrentSession(
  set: (
    partial:
      | Partial<RecallStore>
      | ((state: RecallStore) => Partial<RecallStore>),
    replace?: false
  ) => void
) {
  if (currentSession) {
    return currentSession;
  }

  set({
    cloudAuthStatus: 'connecting',
    cloudError: null,
  });
  const session = await ensureResolvedSession();
  currentSession = session;
  set({
    cloudAuthStatus: 'connected',
    cloudUserId: session.authUid,
    cloudAccountId: session.accountId,
    cloudProvider: session.provider,
    cloudIsAnonymous: session.isAnonymous,
    cloudIsStableAccount: session.isStableAccount,
  });
  return session;
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
