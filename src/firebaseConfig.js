// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyAXv8xJd08cDsM0X6hlMXZuWns-jwn3Lz8',
  authDomain: 'scoutzero-bf1ae.firebaseapp.com',
  projectId: 'scoutzero-bf1ae',
  storageBucket: 'scoutzero-bf1ae.firebasestorage.app',
  messagingSenderId: '105500121903',
  appId: '1:105500121903:web:119be1873ef2885949dfda',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Named export for Firestore
export const db = getFirestore(app);
