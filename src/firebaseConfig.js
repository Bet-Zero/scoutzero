// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Connect to emulators in development (DEV mode only)
if (import.meta.env.DEV) {
  const host = 'localhost'; // Consistent host for all emulators
  connectFirestoreEmulator(db, host, 8082);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFunctionsEmulator(functions, host, 5001);
  
  console.log('──────────────────────────────────────────────────');
  console.log('🔥 Firebase Emulators Connected');
  console.log(`   Project: ${import.meta.env.VITE_FIREBASE_PROJECT_ID}`);
  console.log(`   Firestore: ${host}:8082`);
  console.log(`   Auth: ${host}:9099`);
  console.log(`   Functions: ${host}:5001`);
  console.log('──────────────────────────────────────────────────');
}
