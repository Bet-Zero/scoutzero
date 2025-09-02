// scripts/firebaseConfig.node.js  (ESM)
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Try multiple credential locations with graceful fallback
function initializeFirebase() {
  const credentialPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    './serviceAccountKey.json',
    '../serviceAccountKey.json'
  ];

  for (const keyPath of credentialPaths) {
    if (keyPath && fs.existsSync(keyPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        initializeApp({ credential: cert(creds) });
        console.log(`✅ Firebase initialized with credentials: ${keyPath}`);
        return getFirestore();
      } catch (error) {
        console.log(`❌ Failed to initialize Firebase with ${keyPath}: ${error.message}`);
      }
    }
  }

  // If no credentials found, throw informative error
  console.log('❌ Firebase credentials not found!');
  console.log('💡 Place serviceAccountKey.json in project root or set GOOGLE_APPLICATION_CREDENTIALS');
  throw new Error('Firebase credentials not found');
}

export const db = initializeFirebase();

// Minimal wrappers so your existing scripts barely change:
export const collection = (dbInst, ...segs) =>
  dbInst.collection(segs.join('/'));
export const doc = (dbInst, ...segs) =>
  dbInst.collection(segs.slice(0, -1).join('/')).doc(segs.at(-1));
export const getDocs = (q) => q.get(); // QuerySnapshot
export const setDoc = (ref, data, opts) =>
  opts?.merge ? ref.set(data, { merge: true }) : ref.set(data);
export const updateDoc = (ref, data) => ref.update(data);
export const serverTimestamp = () => FieldValue.serverTimestamp();