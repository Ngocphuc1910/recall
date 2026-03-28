import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  getRedirectResult,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  AccountLinkCode,
  AccountMembership,
  AccountMigrationReport,
  AccountProfile,
  AuthProviderId,
  Category,
  RecallItem,
  ResolvedSession,
  Settings,
  StagedHighlight,
  SyncRequest,
} from './types';
import { buildImportDedupKey } from './import';

const firebaseConfig = {
  apiKey: 'AIzaSyBBhmqhwgAhvzmgXobBPcIbLaIquj5TlwY',
  authDomain: 'recall-memory-20260326.firebaseapp.com',
  projectId: 'recall-memory-20260326',
  storageBucket: 'recall-memory-20260326.firebasestorage.app',
  messagingSenderId: '1038616079340',
  appId: '1:1038616079340:web:30f3c5a0e6b9f595d96ec9',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const googleProvider = new GoogleAuthProvider();

export const auth = getOrCreateAuth();
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-southeast1');

let signInPromise: Promise<User> | null = null;
let redirectResultPromise: Promise<void> | null = null;
let lastResolvedUid: string | null = null;
let resolvedSessionPromise: Promise<ResolvedSession> | null = null;
let lastRedirectError: unknown = null;
const migratedLegacyUids = new Set<string>();

function getOrCreateAuth(): Auth {
  return getAuth(app);
}

export async function ensureSignedIn(): Promise<User> {
  await maybeHandleRedirectResult();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (!signInPromise) {
    signInPromise = signInAnonymously(auth)
      .then((credential) => credential.user)
      .finally(() => {
        signInPromise = null;
      });
  }

  return signInPromise;
}

export async function ensureResolvedSession(): Promise<ResolvedSession> {
  const user = await ensureSignedIn();

  if (resolvedSessionPromise && lastResolvedUid === user.uid) {
    return resolvedSessionPromise;
  }

  lastResolvedUid = user.uid;
  resolvedSessionPromise = resolveOrCreateSession(user);
  return resolvedSessionPromise;
}

export function subscribeToAuth(listener: (user: User | null) => void) {
  return onAuthStateChanged(auth, listener);
}

export function subscribeToResolvedSession(
  listener: (session: ResolvedSession | null) => void,
  onError?: (error: unknown) => void
) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      lastResolvedUid = null;
      resolvedSessionPromise = null;
      listener(null);
      return;
    }

    try {
      const session = await ensureResolvedSession();
      listener(session);
    } catch (error) {
      onError?.(error);
    }
  });
}

export async function startGoogleRedirectAuth() {
  if (Platform.OS !== 'web') {
    throw new Error('Google redirect auth is only available on web.');
  }

  await maybeHandleRedirectResult();

  if (auth.currentUser?.isAnonymous) {
    await linkWithRedirect(auth.currentUser, googleProvider);
    return;
  }

  await signInWithRedirect(auth, googleProvider);
}

export async function signOutCurrentUser() {
  await signOut(auth);
  lastResolvedUid = null;
  resolvedSessionPromise = null;
}

export async function createAccountLinkCode() {
  const callable = httpsCallable<void, AccountLinkCode>(functions, 'createAccountLinkCode');
  const result = await callable();
  return result.data;
}

export async function redeemAccountLinkCode(code: string) {
  const callable = httpsCallable<{ code: string }, { accountId: string; merged: boolean }>(
    functions,
    'redeemAccountLinkCode'
  );
  const result = await callable({ code });
  lastResolvedUid = null;
  resolvedSessionPromise = null;
  return result.data;
}

export async function migrateLegacyUserData() {
  const callable = httpsCallable<void, AccountMigrationReport>(
    functions,
    'migrateLegacyUserData'
  );
  const result = await callable();
  return result.data;
}

export function getAccountProfileRef(accountId: string) {
  return doc(db, 'accounts', accountId, 'meta', 'profile');
}

export function getAccountMetaRef(accountId: string) {
  return doc(db, 'accounts', accountId, 'meta', 'state');
}

export function getAccountItemsCollection(accountId: string) {
  return collection(db, 'accounts', accountId, 'items');
}

export function getAccountItemRef(accountId: string, itemId: string) {
  return doc(db, 'accounts', accountId, 'items', itemId);
}

export function getAccountStagedHighlightsCollection(accountId: string) {
  return collection(db, 'accounts', accountId, 'stagedHighlights');
}

export function getAccountStagedHighlightRef(accountId: string, highlightId: string) {
  return doc(db, 'accounts', accountId, 'stagedHighlights', highlightId);
}

export function getAccountSyncRequestsCollection(accountId: string) {
  return collection(db, 'accounts', accountId, 'syncRequests');
}

export function getAccountSyncRequestRef(accountId: string, requestId: string) {
  return doc(db, 'accounts', accountId, 'syncRequests', requestId);
}

export function getMembershipRef(authUid: string) {
  return doc(db, 'memberships', authUid);
}

export function getLegacyUserMetaRef(uid: string) {
  return doc(db, 'users', uid, 'meta', 'state');
}

export function getLegacyUserItemsCollection(uid: string) {
  return collection(db, 'users', uid, 'items');
}

export function getLegacyUserStagedHighlightsCollection(uid: string) {
  return collection(db, 'users', uid, 'stagedHighlights');
}

export function getLegacyUserSyncRequestsCollection(uid: string) {
  return collection(db, 'users', uid, 'syncRequests');
}

async function maybeHandleRedirectResult() {
  if (Platform.OS !== 'web') {
    return;
  }

  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth)
      .then(() => undefined)
      .catch((error) => {
        lastRedirectError = error;
      });
  }

  await redirectResultPromise;
}

async function resolveOrCreateSession(user: User): Promise<ResolvedSession> {
  const provider = getPrimaryProvider(user);
  const membershipRef = getMembershipRef(user.uid);
  let session: ResolvedSession;

  await runTransaction(db, async (transaction) => {
    const membershipSnapshot = await transaction.get(membershipRef);
    let membership: AccountMembership;

    if (!membershipSnapshot.exists()) {
      const accountId = doc(collection(db, 'accounts')).id;
      membership = buildMembership(user, accountId, provider);
      transaction.set(membershipRef, membership);
      transaction.set(getAccountProfileRef(accountId), buildProfile(user, provider), {
        merge: false,
      });
    } else {
      membership = membershipSnapshot.data() as AccountMembership;
      const updatedMembership = syncMembership(user, membership, provider);
      if (updatedMembership) {
        transaction.set(membershipRef, updatedMembership, { merge: true });
        membership = {
          ...membership,
          ...updatedMembership,
        };
      }
    }

    session = {
      authUid: user.uid,
      accountId: membership.accountId,
      provider,
      isAnonymous: user.isAnonymous,
      isStableAccount: !user.isAnonymous && membership.status === 'active',
    };
  });

  await maybeBootstrapLegacyData(session!);

  return session!;
}

function buildMembership(
  user: User,
  accountId: string,
  provider: AuthProviderId
): AccountMembership {
  const now = Date.now();
  return {
    accountId,
    providers: [provider],
    primaryProvider: provider,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    createdAt: now,
    lastLoginAt: now,
    status: user.isAnonymous ? 'anonymous' : 'active',
  };
}

function buildProfile(user: User, provider: AuthProviderId): AccountProfile {
  const now = Date.now();
  return {
    createdAt: now,
    updatedAt: now,
    ownerAuthUid: user.uid,
    linkedProviders: [provider],
    migrationState: 'pending_legacy_bootstrap',
    status: 'active',
    mergedFromAccountIds: [],
  };
}

function syncMembership(
  user: User,
  membership: AccountMembership,
  provider: AuthProviderId
) {
  const nextProviders = new Set(membership.providers ?? []);
  nextProviders.add(provider);

  const nextStatus = user.isAnonymous ? 'anonymous' : 'active';
  const changed =
    membership.primaryProvider !== provider ||
    membership.status !== nextStatus ||
    membership.email !== (user.email ?? null) ||
    membership.displayName !== (user.displayName ?? null) ||
    !membership.providers.includes(provider);

  if (!changed) {
    return {
      lastLoginAt: Date.now(),
    } satisfies Partial<AccountMembership>;
  }

  return {
    providers: Array.from(nextProviders),
    primaryProvider: provider,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    lastLoginAt: Date.now(),
    status: nextStatus,
  } satisfies Partial<AccountMembership>;
}

async function maybeBootstrapLegacyData(session: ResolvedSession) {
  if (migratedLegacyUids.has(session.authUid)) {
    return;
  }

  const profileRef = getAccountProfileRef(session.accountId);
  const legacyMetaRef = getLegacyUserMetaRef(session.authUid);

  const [profileSnapshot, legacyMetaSnapshot, accountMetaSnapshot] = await Promise.all([
    getDoc(profileRef),
    getDoc(legacyMetaRef),
    getDoc(getAccountMetaRef(session.accountId)),
  ]);

  const profile = profileSnapshot.exists()
    ? (profileSnapshot.data() as AccountProfile)
    : null;
  if (profile?.migrationState === 'complete' || profile?.migrationState === 'not_needed') {
    migratedLegacyUids.add(session.authUid);
    return;
  }

  const [legacyItemsSnapshot, legacyHighlightsSnapshot, legacyRequestsSnapshot] =
    await Promise.all([
      getDocs(query(getLegacyUserItemsCollection(session.authUid), orderBy('createdAt', 'desc'))),
      getDocs(
        query(
          getLegacyUserStagedHighlightsCollection(session.authUid),
          orderBy('syncedAt', 'desc')
        )
      ),
      getDocs(
        query(
          getLegacyUserSyncRequestsCollection(session.authUid),
          orderBy('requestedAt', 'desc'),
          limit(20)
        )
      ),
    ]);

  const hasLegacyData =
    legacyMetaSnapshot.exists() ||
    !legacyItemsSnapshot.empty ||
    !legacyHighlightsSnapshot.empty ||
    !legacyRequestsSnapshot.empty;

  if (!hasLegacyData) {
    await setDoc(
      profileRef,
      {
        migrationState: 'not_needed',
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    migratedLegacyUids.add(session.authUid);
    return;
  }

  await setDoc(
    profileRef,
    {
      migrationState: 'migrating',
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  const [accountItemsSnapshot, accountHighlightsSnapshot, accountRequestsSnapshot] =
    await Promise.all([
      getDocs(query(getAccountItemsCollection(session.accountId), orderBy('createdAt', 'desc'))),
      getDocs(
        query(
          getAccountStagedHighlightsCollection(session.accountId),
          orderBy('syncedAt', 'desc')
        )
      ),
      getDocs(
        query(
          getAccountSyncRequestsCollection(session.accountId),
          orderBy('requestedAt', 'desc'),
          limit(20)
        )
      ),
    ]);

  const accountItems = accountItemsSnapshot.docs.map(
    (snapshot) => ({ ...(snapshot.data() as RecallItem), id: snapshot.id }) as RecallItem
  );
  const accountHighlights = accountHighlightsSnapshot.docs.map(
    (snapshot) =>
      ({ ...(snapshot.data() as StagedHighlight), id: snapshot.id }) as StagedHighlight
  );
  const accountRequests = accountRequestsSnapshot.docs.map(
    (snapshot) => ({ ...(snapshot.data() as SyncRequest), id: snapshot.id }) as SyncRequest
  );

  const legacyItems = legacyItemsSnapshot.docs.map(
    (snapshot) => ({ ...(snapshot.data() as RecallItem), id: snapshot.id }) as RecallItem
  );
  const legacyHighlights = legacyHighlightsSnapshot.docs.map(
    (snapshot) =>
      ({ ...(snapshot.data() as StagedHighlight), id: snapshot.id }) as StagedHighlight
  );
  const legacyRequests = legacyRequestsSnapshot.docs.map(
    (snapshot) => ({ ...(snapshot.data() as SyncRequest), id: snapshot.id }) as SyncRequest
  );

  const mergedMeta = mergeMetaState(
    legacyMetaSnapshot.exists()
      ? ((legacyMetaSnapshot.data() as { categories?: Category[]; settings?: Settings }) ?? {})
      : null,
    accountMetaSnapshot.exists()
      ? ((accountMetaSnapshot.data() as { categories?: Category[]; settings?: Settings }) ?? {})
      : null
  );
  const mergedItems = mergeItems(accountItems, legacyItems);
  const mergedHighlights = mergeStagedHighlights(accountHighlights, legacyHighlights);
  const mergedRequests = mergeSyncRequests(accountRequests, legacyRequests);

  const batch = writeBatch(db);

  if (mergedMeta) {
    batch.set(getAccountMetaRef(session.accountId), mergedMeta, { merge: true });
  }

  mergedItems.toWrite.forEach((item) => {
    batch.set(getAccountItemRef(session.accountId, item.id), item, { merge: true });
  });

  mergedHighlights.toWrite.forEach((highlight) => {
    batch.set(getAccountStagedHighlightRef(session.accountId, highlight.id), highlight, {
      merge: true,
    });
  });

  mergedRequests.toWrite.forEach((request) => {
    batch.set(getAccountSyncRequestRef(session.accountId, request.id), request, {
      merge: true,
    });
  });

  batch.set(
    profileRef,
    {
      migrationState: 'complete',
      updatedAt: Date.now(),
      mergedFromAccountIds: profile?.mergedFromAccountIds ?? [],
    },
    { merge: true }
  );

  await batch.commit();
  migratedLegacyUids.add(session.authUid);
}

function mergeMetaState(
  legacy: { categories?: Category[]; settings?: Settings } | null,
  account: { categories?: Category[]; settings?: Settings } | null
) {
  if (!legacy && !account) {
    return null;
  }

  const accountCategories = account?.categories ?? [];
  const mergedCategories = [...accountCategories];
  const existingIds = new Set(accountCategories.map((category) => category.id));

  for (const category of legacy?.categories ?? []) {
    if (!existingIds.has(category.id)) {
      mergedCategories.push(category);
      existingIds.add(category.id);
    }
  }

  return {
    categories: mergedCategories,
    settings: account?.settings ?? legacy?.settings,
    updatedAt: Date.now(),
  };
}

function mergeItems(existing: RecallItem[], incoming: RecallItem[]) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  const dedupeKeys = new Set(existing.map((item) => getRecallItemDedupKey(item)));
  const toWrite: RecallItem[] = [];

  for (const item of incoming) {
    if (byId.has(item.id)) {
      continue;
    }

    const dedupeKey = getRecallItemDedupKey(item);
    if (dedupeKeys.has(dedupeKey)) {
      continue;
    }

    byId.set(item.id, item);
    dedupeKeys.add(dedupeKey);
    toWrite.push(item);
  }

  return { toWrite };
}

function mergeStagedHighlights(existing: StagedHighlight[], incoming: StagedHighlight[]) {
  const byDedupeKey = new Map(existing.map((highlight) => [highlight.dedupeKey, highlight]));
  const toWrite: StagedHighlight[] = [];

  for (const highlight of incoming) {
    const current = byDedupeKey.get(highlight.dedupeKey);
    if (!current) {
      byDedupeKey.set(highlight.dedupeKey, highlight);
      toWrite.push(highlight);
      continue;
    }

    const preferred = choosePreferredHighlight(current, highlight);
    if (preferred.id === current.id) {
      continue;
    }

    byDedupeKey.set(highlight.dedupeKey, preferred);
    toWrite.push(preferred);
  }

  return { toWrite };
}

function choosePreferredHighlight(
  left: StagedHighlight,
  right: StagedHighlight
): StagedHighlight {
  const leftTerminal =
    left.approvalStatus === 'approved' || left.approvalStatus === 'rejected';
  const rightTerminal =
    right.approvalStatus === 'approved' || right.approvalStatus === 'rejected';

  if (leftTerminal && !rightTerminal) return left;
  if (!leftTerminal && rightTerminal) return right;

  return (right.updatedAt ?? 0) >= (left.updatedAt ?? 0) ? right : left;
}

function mergeSyncRequests(existing: SyncRequest[], incoming: SyncRequest[]) {
  const existingIds = new Set(existing.map((request) => request.id));
  const toWrite: SyncRequest[] = [];

  for (const request of incoming) {
    if (existingIds.has(request.id)) {
      continue;
    }

    if (request.status === 'pending' || request.status === 'running') {
      continue;
    }

    existingIds.add(request.id);
    toWrite.push(request);
  }

  return { toWrite };
}

function getPrimaryProvider(user: User): AuthProviderId {
  if (user.isAnonymous) {
    return 'anonymous';
  }

  const provider = user.providerData
    .map((entry) => entry.providerId)
    .find((providerId) => providerId && providerId !== 'firebase');

  return (provider ?? 'unknown') as AuthProviderId;
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

export function getFirebaseErrorMessage(error: unknown): string {
  if (lastRedirectError) {
    error = lastRedirectError;
    lastRedirectError = null;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    switch (error.code) {
      case 'auth/operation-not-allowed':
        return 'Anonymous sign-in is disabled in Firebase Auth. Enable it in Firebase Console to turn on sync.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in Firebase Authentication.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in flow.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was cancelled before it finished.';
      default:
        return error.code;
    }
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Unable to connect to Firebase.';
}

export type { Firestore };
