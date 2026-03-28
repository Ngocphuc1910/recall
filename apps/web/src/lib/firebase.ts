'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const auth = getAuth(app);
export const db = getFirestore(app);

let signInPromise: Promise<User> | null = null;

export async function ensureSignedIn() {
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

export async function signInOrLinkWithGoogle() {
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    const result = await linkWithPopup(currentUser, googleProvider);
    return result.user;
  }

  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser() {
  await signOut(auth);
}

export function getFriendlyAuthError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    switch (error.code) {
      case 'auth/operation-not-allowed':
        return 'Google sign-in is disabled in Firebase Auth.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in popup.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was cancelled before it finished.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in Firebase Authentication.';
      case 'auth/credential-already-in-use':
        return 'This Google account is already linked to another Recall account. Sign in there and migrate data once.';
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

  return 'Unable to complete authentication.';
}
