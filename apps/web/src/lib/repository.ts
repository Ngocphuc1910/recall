'use client';

import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  buildImportDedupKey,
  createNewItem,
  getNextReview,
  parseImportJson,
  type AddItemDraft,
  type Category,
  type MetaState,
  type RecallItem,
  type Settings,
  type StagedHighlight,
  type SyncRequest,
} from '@recall/contracts';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, ensureSignedIn } from './firebase';

export function subscribeToMeta(
  uid: string,
  onData: (value: MetaState) => void,
  onError: (message: string) => void
) {
  return onSnapshot(
    doc(db, 'users', uid, 'meta', 'state'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData({
          categories: DEFAULT_CATEGORIES,
          settings: DEFAULT_SETTINGS,
        });
        return;
      }

      const data = snapshot.data() as MetaState;
      onData({
        categories: data.categories ?? DEFAULT_CATEGORIES,
        settings: data.settings ?? DEFAULT_SETTINGS,
      });
    },
    (error) => onError(error.message)
  );
}

export function subscribeToItems(
  uid: string,
  onData: (value: RecallItem[]) => void,
  onError: (message: string) => void
) {
  return onSnapshot(
    query(collection(db, 'users', uid, 'items'), orderBy('createdAt', 'desc')),
    (snapshot) => {
      onData(
        snapshot.docs.map((itemDoc) => ({
          ...(itemDoc.data() as RecallItem),
          id: itemDoc.id,
        }))
      );
    },
    (error) => onError(error.message)
  );
}

export function subscribeToStagedHighlights(
  uid: string,
  onData: (value: StagedHighlight[]) => void,
  onError: (message: string) => void
) {
  return onSnapshot(
    query(
      collection(db, 'users', uid, 'stagedHighlights'),
      orderBy('syncedAt', 'desc')
    ),
    (snapshot) => {
      onData(
        snapshot.docs.map((highlightDoc) => ({
          ...(highlightDoc.data() as StagedHighlight),
          id: highlightDoc.id,
        }))
      );
    },
    (error) => onError(error.message)
  );
}

export function subscribeToSyncRequests(
  uid: string,
  onData: (value: SyncRequest[]) => void,
  onError: (message: string) => void
) {
  return onSnapshot(
    query(
      collection(db, 'users', uid, 'syncRequests'),
      orderBy('requestedAt', 'desc'),
      limit(20)
    ),
    (snapshot) => {
      onData(
        snapshot.docs.map((requestDoc) => ({
          ...(requestDoc.data() as SyncRequest),
          id: requestDoc.id,
        }))
      );
    },
    (error) => onError(error.message)
  );
}

export async function addRecallItem(draft: AddItemDraft, settings: Settings) {
  const user = await ensureSignedIn();
  const item = createNewItem(draft, settings.defaultIntervals);
  await setDoc(doc(db, 'users', user.uid, 'items', item.id), item);
}

export async function updateRecallItem(item: RecallItem) {
  const user = await ensureSignedIn();
  await setDoc(doc(db, 'users', user.uid, 'items', item.id), item, { merge: true });
}

export async function deleteRecallItem(itemId: string) {
  const user = await ensureSignedIn();
  await updateDoc(doc(db, 'users', user.uid, 'items', itemId), {
    status: 'archived',
  });
}

export async function markRecall(item: RecallItem, recalled: boolean) {
  const user = await ensureSignedIn();
  const updates = getNextReview(item, recalled);
  await updateDoc(doc(db, 'users', user.uid, 'items', item.id), updates);
}

export async function updateStagedHighlightCategory(id: string, categoryId: string) {
  const user = await ensureSignedIn();
  await updateDoc(doc(db, 'users', user.uid, 'stagedHighlights', id), {
    categoryId,
    categoryStatus: 'chosen',
    updatedAt: Date.now(),
  });
}

export async function updateStagedHighlightPriority(
  id: string,
  priorityCode: number,
  priorityLabel: string
) {
  const user = await ensureSignedIn();
  await updateDoc(doc(db, 'users', user.uid, 'stagedHighlights', id), {
    priorityCode,
    priorityLabel,
    updatedAt: Date.now(),
  });
}

export async function approveStagedHighlights(
  highlights: StagedHighlight[],
  items: RecallItem[],
  settings: Settings
) {
  const user = await ensureSignedIn();
  const batch = writeBatch(db);
  const dedupeKeys = new Set(
    items.map((item) =>
      buildImportDedupKey({
        externalId: item.externalId,
        sourceAssetId: item.sourceAssetId,
        content: item.content,
        source: item.source,
        locationCfi: item.locationCfi,
      })
    )
  );
  const approvedAt = Date.now();

  for (const highlight of highlights) {
    const isDuplicate = dedupeKeys.has(highlight.dedupeKey);
    if (!isDuplicate) {
      dedupeKeys.add(highlight.dedupeKey);
      const item = createNewItem(
        {
          content: highlight.content,
          detail: highlight.detail,
          source: highlight.source,
          categoryId: highlight.categoryId ?? 'books',
          priorityCode: highlight.priorityCode,
          intervals: settings.defaultIntervals,
          externalId: highlight.externalId,
          sourceAssetId: highlight.sourceAssetId,
          sourceProvider: highlight.sourceProvider,
          locationCfi: highlight.locationCfi,
          highlightedAt: highlight.highlightedAt,
          highlightStyle: highlight.highlightStyle,
          createdAt: highlight.createdAt,
        },
        settings.defaultIntervals
      );
      batch.set(doc(db, 'users', user.uid, 'items', item.id), item);
    }

    batch.update(doc(db, 'users', user.uid, 'stagedHighlights', highlight.id), {
      approvalStatus: 'approved',
      importStatus: isDuplicate ? 'skipped_duplicate' : 'imported',
      approvedAt,
      updatedAt: approvedAt,
    });
  }

  await batch.commit();
}

export async function rejectStagedHighlights(ids: string[]) {
  const user = await ensureSignedIn();
  const batch = writeBatch(db);
  const now = Date.now();

  ids.forEach((id) => {
    batch.update(doc(db, 'users', user.uid, 'stagedHighlights', id), {
      approvalStatus: 'rejected',
      rejectedAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();
}

export async function requestAppleBooksSync(existingRequests: SyncRequest[]) {
  const user = await ensureSignedIn();
  const existing = existingRequests.find(
    (request) =>
      request.source === 'apple_books' &&
      (request.status === 'pending' || request.status === 'running')
  );

  if (existing) {
    return;
  }

  const requestRef = doc(collection(db, 'users', user.uid, 'syncRequests'));
  const now = Date.now();

  await setDoc(requestRef, {
    id: requestRef.id,
    source: 'apple_books',
    status: 'pending',
    requestedAt: now,
    lastSeenAt: now,
  });
}

export function importFromJson(
  rawJson: string,
  categories: Category[],
  settings: Settings,
  items: RecallItem[],
  stagedHighlights: StagedHighlight[]
) {
  return parseImportJson(rawJson, categories, settings, items, stagedHighlights);
}
