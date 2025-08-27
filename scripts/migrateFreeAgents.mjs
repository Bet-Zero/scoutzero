// scripts/migrateFreeAgents.mjs
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  getDoc,
  setDoc,
  writeBatch,
  doc,
} from 'firebase/firestore';

// Direct, hardcoded config (from firebaseConfig.node.js)
const firebaseConfig = {
  apiKey: 'AIzaSyAXv8xJd08cDsM0X6hlMXZuWns-jwn3Lz8',
  authDomain: 'scoutzero-bf1ae.firebaseapp.com',
  projectId: 'scoutzero-bf1ae',
  storageBucket: 'scoutzero-bf1ae.appspot.com',
  messagingSenderId: '105500121903',
  appId: '1:105500121903:web:119be1873ef2885949dfda',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateFreeAgents() {
  try {
    const metaRef = doc(db, 'meta', 'freeAgents');
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      console.log('No free agents found in meta.');
      return;
    }

    const freeAgents = metaSnap.data().pool || [];
    const batch = writeBatch(db);

    for (const agent of freeAgents) {
      const id = agent.id || agent.name;
      const newDocRef = doc(db, 'freeAgents', id);
      batch.set(newDocRef, agent);
    }

    await batch.commit();
    console.log(
      `✅ Migrated ${freeAgents.length} free agents to 'freeAgents' collection`
    );
  } catch (err) {
    console.error('❌ Migration failed:', err);
  }
}

migrateFreeAgents();
