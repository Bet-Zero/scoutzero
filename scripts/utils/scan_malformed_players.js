const admin = require("firebase-admin");
const fs = require("fs");

// Replace this path with your service account key
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const DELETE_BAD_ENTRIES = false; // Toggle this to true if you want auto-deletion

(async () => {
  const snapshot = await db.collection("players").get();

  console.log(`🔍 Scanning ${snapshot.size} players...\n`);

  let badDocs = [];

  snapshot.forEach((doc) => {
    const player = doc.data();
    const name = player.display_name || player.name || 'UNKNOWN';
  
    if (name.toLowerCase().includes('lebron')) {
      console.warn(`🕵️ Found LeBron Variant: ${doc.id}`);
      console.log({
        name: player.name,
        display_name: player.display_name,
        contract: player.contract,
        bio: player.bio,
      });
      console.log("———");
    }
  });
  
  console.log(`\n✅ Done. Found ${badDocs.length} malformed entries.`);
})();
