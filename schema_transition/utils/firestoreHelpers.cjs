const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let appInstance = null;
let dbInstance = null;

function resolveServiceAccountPath() {
  const candidates = [
    process.env.SA_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(__dirname, '..', 'serviceAccountKey.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function initFirestore() {
  if (dbInstance) return dbInstance;

  const serviceAccountPath = resolveServiceAccountPath();

  if (serviceAccountPath) {
    // Use service account key
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8')
    );
    appInstance = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Try application default credentials
    try {
      appInstance = admin.initializeApp();
    } catch (error) {
      throw new Error(
        'Firebase Admin SDK initialization failed. Please provide a service account key file or set up Application Default Credentials.\n' +
          'Expected locations:\n' +
          '- Environment variable SA_PATH or GOOGLE_APPLICATION_CREDENTIALS\n' +
          '- ./serviceAccountKey.json\n' +
          '- ./schema_transition/serviceAccountKey.json\n\n' +
          `Original error: ${error.message}`
      );
    }
  }

  dbInstance = admin.firestore();
  return dbInstance;
}

module.exports = {
  initFirestore,
  resolveServiceAccountPath,
};
