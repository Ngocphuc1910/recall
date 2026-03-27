'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
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
