// scripts/upload/firebaseHelpers.node.js
const { db } = require('../firebaseConfig.node.js');
const { setDoc, getDoc, getDocs, collection, doc } = require('firebase/firestore');

// Upload a player to Firestore
async function uploadPlayer(playerId, playerData) {
  try {
    await setDoc(doc(db, 'players', playerId), playerData, { merge: true });
    console.log(`✅ Uploaded player: ${playerId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error uploading player ${playerId}:`, error);
    return false;
  }
}

// Get a player from Firestore
async function getPlayer(playerId) {
  try {
    const docRef = doc(db, 'players', playerId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: playerId, ...docSnap.data() };
    } else {
      console.log(`No player found with ID: ${playerId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error getting player ${playerId}:`, error);
    return null;
  }
}

// Get all players from Firestore
async function getAllPlayers() {
  try {
    const snapshot = await getDocs(collection(db, 'players'));
    const players = [];
    
    snapshot.forEach(doc => {
      players.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`📊 Retrieved ${players.length} players from Firestore`);
    return players;
  } catch (error) {
    console.error('❌ Error getting all players:', error);
    return [];
  }
}

// Batch upload players
async function batchUploadPlayers(playersData, batchSize = 50) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  console.log(`🚀 Starting batch upload of ${playersData.length} players...`);
  
  for (let i = 0; i < playersData.length; i += batchSize) {
    const batch = playersData.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(playersData.length / batchSize)}...`);
    
    const promises = batch.map(async (playerData) => {
      const playerId = playerData.player_id || playerData.id;
      if (!playerId) {
        results.failed++;
        results.errors.push('Missing player_id for player data');
        return false;
      }
      
      const success = await uploadPlayer(playerId, playerData);
      if (success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`Failed to upload ${playerId}`);
      }
      return success;
    });
    
    await Promise.all(promises);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < playersData.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`\n📈 Batch upload complete:`);
  console.log(`  ✅ Success: ${results.success}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log(`\n🚨 Errors encountered:`);
    results.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more errors`);
    }
  }
  
  return results;
}

// Archive player grades for historical tracking
async function archivePlayerGrade(playerId, gradeData, season = null) {
  try {
    const currentSeason = season || new Date().getFullYear();
    const archiveData = {
      ...gradeData,
      timestamp: Date.now(),
      season: currentSeason,
      archived_date: new Date().toISOString()
    };
    
    // Store in grade history subcollection
    const archiveRef = doc(db, 'players', playerId, 'gradeHistory', `${currentSeason}_${Date.now()}`);
    await setDoc(archiveRef, archiveData);
    
    console.log(`📚 Archived grade for player ${playerId} (Season ${currentSeason})`);
    return true;
  } catch (error) {
    console.error(`❌ Error archiving grade for ${playerId}:`, error);
    return false;
  }
}

module.exports = {
  uploadPlayer,
  getPlayer,
  getAllPlayers,
  batchUploadPlayers,
  archivePlayerGrade
};