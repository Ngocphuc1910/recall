import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  User,
} from 'firebase/auth';
import {
  Firestore,
  collection,
  doc,
  getFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBBhmqhwgAhvzmgXobBPcIbLaIquj5TlwY',
  authDomain: 'recall-memory-20260326.firebaseapp.com',
  projectId: 'recall-memory-20260326',
  storageBucket: 'recall-memory-20260326.firebasestorage.app',
  messagingSenderId: '1038616079340',
  appId: '1:1038616079340:web:30f3c5a0e6b9f595d96ec9',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getOrCreateAuth();
export const db = getFirestore(app);

let signInPromise: Promise<User> | null = null;

function getOrCreateAuth(): Auth {
  return getAuth(app);
}

export async function ensureSignedIn(): Promise<User> {
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

export function subscribeToAuth(listener: (user: User | null) => void) {
  return onAuthStateChanged(auth, listener);
}

export function getUserMetaRef(uid: string) {
  return doc(db, 'users', uid, 'meta', 'state');
}

export function getUserItemsCollection(uid: string) {
  return collection(db, 'users', uid, 'items');
}

export function getUserStagedHighlightsCollection(uid: string) {
  return collection(db, 'users', uid, 'stagedHighlights');
}

export function getUserStagedHighlightRef(uid: string, highlightId: string) {
  return doc(db, 'users', uid, 'stagedHighlights', highlightId);
}

export function getUserSyncRequestsCollection(uid: string) {
  return collection(db, 'users', uid, 'syncRequests');
}

export function getUserSyncRequestRef(uid: string, requestId: string) {
  return doc(db, 'users', uid, 'syncRequests', requestId);
}

export function getFirebaseErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error.code === 'auth/operation-not-allowed') {
      return 'Anonymous sign-in is disabled in Firebase Auth. Enable it in Firebase Console to turn on sync.';
    }

    return error.code;
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
