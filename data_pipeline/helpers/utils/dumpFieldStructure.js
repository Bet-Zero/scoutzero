// scripts/dumpFieldStructure.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 🔐 Firebase config (inline version)
const firebaseConfig = {
  apiKey: 'AIzaSyAXv8xJd08cDsM0X6hlMXZuWns-jwn3Lz8',
  authDomain: 'scoutzero-bf1ae.firebaseapp.com',
  projectId: 'scoutzero-bf1ae',
  storageBucket: 'scoutzero-bf1ae.firebasestorage.app',
  messagingSenderId: '105500121903',
  appId: '1:105500121903:web:119be1873ef2885949dfda',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dumpFieldStructure() {
  const playersCol = collection(db, 'players');
  const snapshot = await getDocs(playersCol);

  const allKeys = new Set();

  snapshot.forEach((doc) => {
    const data = doc.data();
    collectKeysRecursively(data, '', allKeys);
  });

  const sortedKeys = Array.from(allKeys).sort();

  // ✅ Save to file
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(__dirname, 'field_dump.txt');
  fs.writeFileSync(outPath, sortedKeys.join('\n'));

  // ✅ Print to terminal
  console.log('🎯 Unique field paths across all player docs:\n');
  sortedKeys.forEach((key) => console.log(key));
}

function collectKeysRecursively(obj, prefix, set) {
  if (!obj || typeof obj !== 'object') return;

  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    set.add(path);
    collectKeysRecursively(obj[key], path, set);
  }
}

dumpFieldStructure();
