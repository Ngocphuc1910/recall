'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  PRIORITY_DEFINITIONS,
  type AddItemDraft,
  type Category,
  type MetaState,
  type RecallItem,
  type Settings,
  type StagedHighlight,
  type SyncRequest,
} from '@recall/contracts';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  ensureSignedIn,
  getFriendlyAuthError,
  signInWithGoogle as signInWithGooglePopup,
  signOutUser,
  upgradeAnonymousWithGoogle,
} from './firebase';
import {
  addRecallItem,
  approveStagedHighlights,
  deleteRecallItem,
  importFromJson,
  markRecall,
  rejectStagedHighlights,
  requestAppleBooksSync,
  subscribeToItems,
  subscribeToMeta,
  subscribeToStagedHighlights,
  subscribeToSyncRequests,
  updateRecallItem,
  updateStagedHighlightCategory,
  updateStagedHighlightPriority,
} from './repository';

export function useRecallData() {
  const [uid, setUid] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<RecallItem[]>([]);
  const [stagedHighlights, setStagedHighlights] = useState<StagedHighlight[]>([]);
  const [syncRequests, setSyncRequests] = useState<SyncRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        setIsAnonymous(user.isAnonymous);
        return;
      }

      try {
        const signedIn = await ensureSignedIn();
        setUid(signedIn.uid);
        setIsAnonymous(signedIn.isAnonymous);
      } catch (nextError) {
        setError(getFriendlyAuthError(nextError));
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) {
      return;
    }

    setLoading(true);

    const cleanups = [
      subscribeToMeta(
        uid,
        (value: MetaState) => {
          setCategories(value.categories);
          setSettings(value.settings);
          setLoading(false);
        },
        setError
      ),
      subscribeToItems(uid, setItems, setError),
      subscribeToStagedHighlights(uid, setStagedHighlights, setError),
      subscribeToSyncRequests(uid, setSyncRequests, setError),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [uid]);

  const todayItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'active' &&
          new Date(item.nextReviewDate).getTime() <= endOfToday()
      ),
    [items]
  );

  const pendingHighlights = useMemo(
    () => stagedHighlights.filter((highlight) => highlight.approvalStatus === 'pending'),
    [stagedHighlights]
  );

  return {
    uid,
    isAnonymous,
    categories,
    settings,
    items,
    stagedHighlights,
    syncRequests,
    todayItems,
    pendingHighlights,
    loading,
    error,
    priorityDefinitions: PRIORITY_DEFINITIONS,
    addItem: (draft: AddItemDraft) => addRecallItem(draft, settings),
    updateItem: updateRecallItem,
    deleteItem: deleteRecallItem,
    markRecall,
    updateStagedHighlightCategory,
    updateStagedHighlightPriority: (id: string, priorityCode: number) => {
      const priority = PRIORITY_DEFINITIONS.find((entry) => entry.code === priorityCode);
      return updateStagedHighlightPriority(id, priorityCode, priority?.label ?? 'Medium');
    },
    approveHighlights: (highlights: StagedHighlight[]) =>
      approveStagedHighlights(highlights, items, settings),
    rejectHighlights: (ids: string[]) => rejectStagedHighlights(ids),
    requestAppleBooksSync: () => requestAppleBooksSync(syncRequests),
    importFromJson: (rawJson: string) =>
      importFromJson(rawJson, categories, settings, items, stagedHighlights),
    signInWithGoogle: async () => {
      try {
        const user = await signInWithGooglePopup();
        setUid(user.uid);
        setIsAnonymous(user.isAnonymous);
        setError(null);
      } catch (nextError) {
        setError(getFriendlyAuthError(nextError));
        throw nextError;
      }
    },
    upgradeWithGoogle: async () => {
      try {
        const user = await upgradeAnonymousWithGoogle();
        setUid(user.uid);
        setIsAnonymous(user.isAnonymous);
        setError(null);
      } catch (nextError) {
        setError(getFriendlyAuthError(nextError));
        throw nextError;
      }
    },
    signOut: async () => {
      try {
        await signOutUser();
        setError(null);
      } catch (nextError) {
        setError(getFriendlyAuthError(nextError));
        throw nextError;
      }
    },
  };
}

function endOfToday() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}
