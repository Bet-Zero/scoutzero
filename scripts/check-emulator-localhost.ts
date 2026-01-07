
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'scoutzero-bf1ae',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Connecting to localhost:8082...');
connectFirestoreEmulator(db, 'localhost', 8082);

async function checkData() {
  try {
    const q = query(collection(db, 'architect_baseTeams'), limit(1));
    const snapshot = await getDocs(q);
    console.log(`  Found ${snapshot.size} documents`);
  } catch (error) {
    console.error(`  Error:`, error.message);
  }
}

checkData().then(() => process.exit(0));
