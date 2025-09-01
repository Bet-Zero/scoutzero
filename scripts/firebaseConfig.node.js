// scripts/firebaseConfig.node.js  (ESM)
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(creds) });
export const db = getFirestore();

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
