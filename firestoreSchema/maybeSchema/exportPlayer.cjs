const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function exportPlayer(playerName) {
  try {
    const playerRef = db.collection('players').doc(playerName);
    const docSnap = await playerRef.get();

    if (!docSnap.exists) {
      console.error(`❌ No document found for ${playerName}`);
      return;
    }

    const data = docSnap.data();
    const fileName = `${playerName.replace(/\s+/g, '_').toLowerCase()}_before.json`;
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));

    console.log(`✅ Exported ${playerName} data to ${fileName}`);
  } catch (err) {
    console.error('Error exporting player:', err);
  }
}

exportPlayer('wendell_carter_jr');
