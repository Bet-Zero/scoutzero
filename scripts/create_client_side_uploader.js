#!/usr/bin/env node
/**
 * Client-Side Bio Data Uploader
 * Alternative approach using client-side Firebase SDK instead of service account key
 * Uses the same VITE_FIREBASE_* credentials as the main app
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase config using environment variables (same as the React app)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

function checkFirebaseConfig() {
  console.log("🔍 Checking Firebase configuration...");
  
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log("❌ Missing Firebase environment variables:");
    missing.forEach(varName => console.log(`   ${varName}`));
    console.log("\n💡 Create a .env file in project root with:");
    requiredVars.forEach(varName => console.log(`${varName}=your_value_here`));
    return false;
  }
  
  console.log("✅ All Firebase environment variables found");
  return true;
}

async function loadPlayerData() {
  console.log("📁 Loading player data...");
  
  const playersPath = path.join(__dirname, '..', 'public', 'players.json');
  
  if (!fs.existsSync(playersPath)) {
    throw new Error(`Players file not found: ${playersPath}`);
  }
  
  const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  console.log(`📊 Loaded ${Object.keys(playersData).length} players`);
  
  return playersData;
}

function prepareBioData(playerData) {
  const bioFields = ['Name', 'Team', 'Position', 'HT', 'WT', 'AGE', 'Years Pro', 'Contract', 'Free Agent'];
  
  const bio = {};
  let hasData = false;
  
  bioFields.forEach(field => {
    if (playerData[field] !== undefined && playerData[field] !== null && playerData[field] !== '') {
      bio[field] = playerData[field];
      hasData = true;
    }
  });
  
  return hasData ? bio : null;
}

async function uploadBioDataClientSide(isTestMode = false) {
  console.log(`📤 ${isTestMode ? 'TESTING' : 'UPLOADING'} Bio Data (Client-Side Approach)`);
  console.log("=" * 70);
  
  if (!checkFirebaseConfig()) {
    return;
  }
  
  if (!isTestMode) {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log("✅ Firebase initialized successfully");
  }
  
  const playersData = await loadPlayerData();
  const playerIds = Object.keys(playersData);
  
  let successCount = 0;
  let errorCount = 0;
  
  console.log(`👥 Processing ${playerIds.length} players...`);
  
  for (let i = 0; i < Math.min(playerIds.length, 10); i++) { // Process first 10 for demo
    const playerId = playerIds[i];
    const playerData = playersData[playerId];
    
    const bio = prepareBioData(playerData);
    
    if (!bio) {
      console.log(`⚠️  [${i+1}/${playerIds.length}] ${playerData.Name || playerId}: No bio data`);
      continue;
    }
    
    console.log(`📤 [${i+1}/${playerIds.length}] ${isTestMode ? 'Testing' : 'Uploading'}: ${playerData.Name}`);
    
    if (isTestMode) {
      console.log(`    📋 Bio structure: ${Object.keys(bio).join(', ')}`);
      successCount++;
    } else {
      try {
        const docRef = doc(db, 'players', playerId);
        await updateDoc(docRef, {
          bio: bio,
          last_bio_update: serverTimestamp()
        });
        
        console.log(`    ✅ Updated successfully`);
        successCount++;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  console.log("\n" + "=" * 70);
  console.log(`✅ Successfully ${isTestMode ? 'tested' : 'uploaded'} ${successCount} players`);
  if (errorCount > 0) {
    console.log(`❌ ${errorCount} errors occurred`);
  }
  
  if (isTestMode) {
    console.log("\n💡 Advantages of Client-Side Approach:");
    console.log("   ✅ Uses same credentials as React app");
    console.log("   ✅ No service account key needed");
    console.log("   ✅ Works with existing .env setup");
    console.log("\n⚠️  Limitations:");
    console.log("   🔒 May require Firestore security rule updates");
    console.log("   ⏱️  Slower than server-side batch operations");
    console.log("\n🚀 To upload for real: node scripts/create_client_side_uploader.js");
  }
}

// Check command line arguments
const isTestMode = process.argv.includes('--test');

uploadBioDataClientSide(isTestMode).catch(console.error);