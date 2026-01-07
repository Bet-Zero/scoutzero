
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  projectId: 'scoutzero-bf1ae',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099');

// Note: Client SDK can't list users. 
// I would need Admin SDK to check users easily, or use the REST API.
// But I can check if anything is reachable.

console.log('Auth emulator check...');
// Just a simple check to see if it responds
process.exit(0);
