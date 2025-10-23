// Firestore Structure Inspector with Subcollections (ES Module version)

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function inspectSubcollections(docRef, docId, depth = 0) {
  const indent = '  '.repeat(depth);
  const subcollections = await docRef.listCollections();

  for (const subcollection of subcollections) {
    console.log(`${indent}📁 Subcollection: ${subcollection.id}`);

    const subDocs = await subcollection.limit(2).get();

    subDocs.forEach((subDoc, index) => {
      console.log(
        `${indent}  --- Sub-document ${index + 1} (ID: ${subDoc.id}) ---`
      );
      console.log(
        `${indent}  ${JSON.stringify(subDoc.data(), null, 2).replace(/\n/g, '\n' + indent + '  ')}`
      );
    });
  }
}

async function savePlayerData(playerName, playerData, outputDir = './output') {
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Create filename from player name
  const filename = `${playerName.replace(/\s+/g, '_').toLowerCase()}_data.json`;
  const filepath = join(outputDir, filename);

  // Save the data
  writeFileSync(filepath, JSON.stringify(playerData, null, 2), 'utf8');

  console.log(`\n💾 Player data saved to: ${filepath}`);
  return filepath;
}

async function findPlayerByName(playerName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Searching for player: ${playerName}`);
  console.log('='.repeat(60));

  const allPlayerData = [];

  // Try different query approaches since we don't know the exact field structure
  const queries = [
    db.collection('players_v2').where('name', '==', playerName),
    db.collection('players_v2').where('displayName', '==', playerName),
    db.collection('players_v2').where('fullName', '==', playerName),
  ];

  for (const query of queries) {
    try {
      const snapshot = await query.get();
      if (!snapshot.empty) {
        console.log(
          `Found ${snapshot.size} document(s) matching "${playerName}"\n`
        );

        for (const doc of snapshot.docs) {
          console.log(`\n--- Document ID: ${doc.id} ---`);
          const docData = doc.data();
          console.log(JSON.stringify(docData, null, 2));

          // Collect subcollections data
          const subcollections = await doc.ref.listCollections();
          const subcollectionData = {};

          for (const subcollection of subcollections) {
            const subDocs = await subcollection.get();
            subcollectionData[subcollection.id] = {};

            subDocs.forEach((subDoc) => {
              subcollectionData[subcollection.id][subDoc.id] = subDoc.data();
            });
          }

          // Check for subcollections (display)
          await inspectSubcollections(doc.ref, doc.id, 1);

          // Store complete player data
          allPlayerData.push({
            id: doc.id,
            data: docData,
            subcollections: subcollectionData,
            timestamp: new Date().toISOString(),
          });
        }

        // Save to file
        if (allPlayerData.length > 0) {
          await savePlayerData(playerName, allPlayerData);
        }

        return true;
      }
    } catch (error) {
      // Field might not exist, continue to next query
      continue;
    }
  }

  // If exact match fails, try case-insensitive search by scanning all documents
  console.log(
    `No exact match found. Scanning all documents for "${playerName}"...`
  );

  const allDocs = await db.collection('players_v2').get();
  const matches = [];

  for (const doc of allDocs.docs) {
    const data = doc.data();
    // Check various potential name fields
    const nameFields = [
      'name',
      'displayName',
      'fullName',
      'firstName',
      'lastName',
    ];

    for (const field of nameFields) {
      if (
        data[field] &&
        data[field].toLowerCase().includes(playerName.toLowerCase())
      ) {
        matches.push({ doc, matchField: field });
        break;
      }
    }

    // Also check if the document ID contains the name
    if (doc.id.toLowerCase().includes(playerName.toLowerCase())) {
      matches.push({ doc, matchField: 'document_id' });
    }
  }

  if (matches.length > 0) {
    console.log(`Found ${matches.length} partial match(es):\n`);

    for (const { doc, matchField } of matches) {
      console.log(
        `\n--- Document ID: ${doc.id} (matched on: ${matchField}) ---`
      );
      const docData = doc.data();
      console.log(JSON.stringify(docData, null, 2));

      // Collect subcollections data
      const subcollections = await doc.ref.listCollections();
      const subcollectionData = {};

      for (const subcollection of subcollections) {
        const subDocs = await subcollection.get();
        subcollectionData[subcollection.id] = {};

        subDocs.forEach((subDoc) => {
          subcollectionData[subcollection.id][subDoc.id] = subDoc.data();
        });
      }

      // Check for subcollections (display)
      await inspectSubcollections(doc.ref, doc.id, 1);

      // Store complete player data
      allPlayerData.push({
        id: doc.id,
        data: docData,
        subcollections: subcollectionData,
        matchField: matchField,
        timestamp: new Date().toISOString(),
      });
    }

    // Save to file
    if (allPlayerData.length > 0) {
      await savePlayerData(playerName, allPlayerData);
    }

    return true;
  }

  console.log(`No documents found containing "${playerName}"`);
  return false;
}

async function inspectCollection(collectionName, sampleSize = 2) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Collection: ${collectionName}`);
  console.log('='.repeat(60));

  const snapshot = await db.collection(collectionName).limit(sampleSize).get();

  if (snapshot.empty) {
    console.log('Collection is empty\n');
    return;
  }

  console.log(`Total documents sampled: ${snapshot.size}\n`);

  for (const doc of snapshot.docs) {
    console.log(`\n--- Document ID: ${doc.id} ---`);
    console.log(JSON.stringify(doc.data(), null, 2));

    // Check for subcollections
    await inspectSubcollections(doc.ref, doc.id, 1);
  }

  // Analyze structure from first document
  const firstDoc = snapshot.docs[0].data();
  console.log('\n--- Field Types (Top Level) ---');
  Object.entries(firstDoc).forEach(([key, value]) => {
    console.log(
      `${key}: ${typeof value} ${Array.isArray(value) ? '(array)' : ''}`
    );
  });
}

async function main() {
  try {
    // Check if a specific player name was provided as command line argument
    const playerName = process.argv[2];

    if (playerName) {
      console.log(`Searching for specific player: ${playerName}`);
      const found = await findPlayerByName(playerName);

      if (!found) {
        console.log('\nFalling back to general collection inspection...\n');
        await inspectCollection('players_v2', 2);
      }
    } else {
      console.log('Inspecting players_v2 collection with subcollections...\n');
      console.log(
        'Usage: node pull-firestore.js "Player Name" to search for specific player\n'
      );

      await inspectCollection('players_v2', 2);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
