const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let appInstance = null;

function resolveServiceAccountPath() {
  const envPath = process.env.SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) return path.resolve(process.cwd(), envPath);

  const defaultCandidates = [
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(__dirname, '..', 'serviceAccountKey.json'),
  ];

  for (const candidate of defaultCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function initFirestore() {
  if (appInstance) return getFirestore();

  const saPath = resolveServiceAccountPath();
  if (saPath && fs.existsSync(saPath)) {
    const buffer = fs.readFileSync(saPath, 'utf8');
    const credentials = JSON.parse(buffer);
    appInstance = initializeApp({ credential: cert(credentials) });
  } else {
    appInstance = initializeApp({ credential: applicationDefault() });
  }

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

module.exports = {
  initFirestore,
  resolveServiceAccountPath,
};
