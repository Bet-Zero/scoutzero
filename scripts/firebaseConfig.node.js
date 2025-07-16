import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAXv8xJd08cDsM0X6hlMXZuWns-jwn3Lz8',
  authDomain: 'scoutzero-bf1ae.firebaseapp.com',
  projectId: 'scoutzero-bf1ae',
  storageBucket: 'scoutzero-bf1ae.firebasestorage.app',
  messagingSenderId: '105500121903',
  appId: '1:105500121903:web:119be1873ef2885949dfda',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
