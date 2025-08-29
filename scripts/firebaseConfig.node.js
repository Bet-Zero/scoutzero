// scripts/firebaseConfig.node.js
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

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

module.exports = { db };