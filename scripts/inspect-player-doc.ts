
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'scoutzero-bf1ae',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

connectFirestoreEmulator(db, '127.0.0.1', 8082);

async function checkData() {
  try {
    const q = query(collection(db, 'players_v2'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.size > 0) {
      console.log('Document ID:', snapshot.docs[0].id);
      console.log('Data:', JSON.stringify(snapshot.docs[0].data(), null, 2));
    } else {
      console.log('No documents found in players_v2');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkData().then(() => process.exit(0));
