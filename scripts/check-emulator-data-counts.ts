
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, query } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'scoutzero-bf1ae',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

connectFirestoreEmulator(db, '127.0.0.1', 8082);

async function checkData() {
  const collections = ['architect_baseTeams', 'architect_basePlayers', 'players_v2'];
  
  for (const colName of collections) {
    try {
      console.log(`Checking collection: ${colName}`);
      const snapshot = await getDocs(collection(db, colName));
      console.log(`  Found ${snapshot.size} documents in ${colName}`);
    } catch (error) {
      console.error(`  Error checking ${colName}:`, error.message);
    }
  }
}

checkData().then(() => process.exit(0));
