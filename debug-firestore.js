// Debug tool to inspect current Firestore structure
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-auth-domain",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-bucket",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "demo-app-id",
};

console.log('🔍 Firestore Structure Inspector');
console.log('================================');

try {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  console.log('📡 Firebase Config:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain
  });

  // Check main collections
  console.log('\n📂 Checking main collections...');
  
  // Check /players collection
  try {
    const playersSnap = await getDocs(collection(db, 'players'));
    console.log(`✅ /players: ${playersSnap.size} documents`);
    if (playersSnap.size > 0) {
      const firstPlayer = playersSnap.docs[0];
      console.log(`   Sample player: ${firstPlayer.id}`);
      console.log(`   Data keys: ${Object.keys(firstPlayer.data()).slice(0, 5).join(', ')}...`);
    }
  } catch (e) {
    console.log(`❌ /players: Error - ${e.message}`);
  }
  
  // Check /seasons collection
  try {
    const seasonsSnap = await getDocs(collection(db, 'seasons'));
    console.log(`✅ /seasons: ${seasonsSnap.size} documents`);
    
    for (const seasonDoc of seasonsSnap.docs) {
      console.log(`\n📅 Season ${seasonDoc.id}:`);
      const seasonData = seasonDoc.data();
      console.log(`   Status: ${seasonData.status || 'unknown'}`);
      console.log(`   Display: ${seasonData.display_name || 'unknown'}`);
      
      // Check subcollections
      try {
        const metadataSnap = await getDocs(collection(db, 'seasons', seasonDoc.id, 'metadata'));
        console.log(`   📋 metadata: ${metadataSnap.size} documents`);
      } catch (e) {
        console.log(`   📋 metadata: Error - ${e.message}`);
      }
      
      try {
        const gradesSnap = await getDocs(collection(db, 'seasons', seasonDoc.id, 'playerGrades'));
        console.log(`   🎯 playerGrades: ${gradesSnap.size} documents`);
      } catch (e) {
        console.log(`   🎯 playerGrades: Error - ${e.message}`);
      }
      
      try {
        const teamDataSnap = await getDocs(collection(db, 'seasons', seasonDoc.id, 'teamData'));
        console.log(`   🏀 teamData: ${teamDataSnap.size} documents`);
      } catch (e) {
        console.log(`   🏀 teamData: Error - ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`❌ /seasons: Error - ${e.message}`);
  }
  
  // Check /teams collection
  try {
    const teamsSnap = await getDocs(collection(db, 'teams'));
    console.log(`\n✅ /teams: ${teamsSnap.size} documents`);
  } catch (e) {
    console.log(`\n❌ /teams: Error - ${e.message}`);
  }
  
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  console.log('\n💡 This might be because:');
  console.log('   - Firebase environment variables are not set');
  console.log('   - Project credentials are missing');
  console.log('   - Network/permissions issues');
}