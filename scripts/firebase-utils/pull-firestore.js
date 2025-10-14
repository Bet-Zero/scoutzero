// Firestore Structure Inspector with Subcollections (ES Module version)

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

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
    console.log('Inspecting players_v2 collection with subcollections...\n');

    await inspectCollection('players_v2', 2);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
