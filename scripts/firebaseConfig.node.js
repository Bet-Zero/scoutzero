// scripts/firebaseConfig.node.js  (ESM)
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

let db = null;

try {
  if (fs.existsSync(keyPath)) {
    const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(creds) });
    db = getFirestore();
    console.log('✅ Firebase initialized successfully');
  } else {
    console.log('⚠️  Firebase credentials not found - running in offline mode');
    console.log('💡 Place serviceAccountKey.json in project root to enable Firebase features');
  }
} catch (error) {
  console.log('⚠️  Firebase initialization failed - running in offline mode');
  console.log('💡 Error:', error.message);
}

export { db };

// Minimal wrappers so your existing scripts barely change:
export const collection = (dbInst, ...segs) =>
  dbInst ? dbInst.collection(segs.join('/')) : null;
export const doc = (dbInst, ...segs) =>
  dbInst ? dbInst.collection(segs.slice(0, -1).join('/')).doc(segs.at(-1)) : null;
export const getDocs = (q) => q ? q.get() : Promise.resolve({ docs: [] }); // QuerySnapshot
export const setDoc = (ref, data, opts) =>
  ref ? (opts?.merge ? ref.set(data, { merge: true }) : ref.set(data)) : Promise.resolve();
export const updateDoc = (ref, data) => ref ? ref.update(data) : Promise.resolve();
export const serverTimestamp = () => FieldValue ? FieldValue.serverTimestamp() : new Date();
