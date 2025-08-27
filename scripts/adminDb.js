// DO NOT commit serviceAccountKey.json
const fs = require('fs');
const admin = require('firebase-admin');

const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(creds) });
const db = admin.firestore();
module.exports = { db };
