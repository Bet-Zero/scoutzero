#!/usr/bin/env node
/**
 * Simple script to inspect the user's actual data structure
 */

import { db, collection, getDocs } from './firebaseConfig.node.js';

async function inspectUserData() {
  console.log('🔍 INSPECTING USER DATA STRUCTURE');
  console.log('=================================\n');

  try {
    // Get all players to see the data structure
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const samplePlayers = [];
    let totalPlayers = 0;

    playersSnapshot.forEach(doc => {
      totalPlayers++;
      if (samplePlayers.length < 10) {  // Just get first 10 for inspection
        const data = doc.data();
        samplePlayers.push({
          id: doc.id,
          name: data.Name || data.name || 'Unknown',
          data: data
        });
      }
    });

    console.log(`Total players in database: ${totalPlayers}`);
    console.log(`Inspecting first ${samplePlayers.length} players\n`);

    // Show all unique fields across all players
    const allFields = new Set();
    samplePlayers.forEach(player => {
      Object.keys(player.data).forEach(field => allFields.add(field));
    });

    console.log('ALL FIELDS IN USER DATA:');
    console.log('========================');
    const fieldArray = Array.from(allFields).sort();
    fieldArray.forEach(field => {
      console.log(`- ${field}`);
    });

    console.log('\nSAMPLE PLAYER DATA:');
    console.log('==================');
    samplePlayers.slice(0, 3).forEach(player => {
      console.log(`\nPlayer: ${player.name} (${player.id})`);
      console.log('Fields and values:');
      Object.entries(player.data).forEach(([key, value]) => {
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`  ${key}: ${JSON.stringify(displayValue)}`);
      });
    });

    // Check for potential evaluation fields
    console.log('\nPOTENTIAL EVALUATION FIELDS:');
    console.log('============================');
    const evaluationKeywords = ['grade', 'role', 'tier', 'note', 'evaluation', 'rating', 'rank', 'scout'];
    const potentialEvalFields = fieldArray.filter(field => 
      evaluationKeywords.some(keyword => 
        field.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    if (potentialEvalFields.length > 0) {
      potentialEvalFields.forEach(field => {
        console.log(`- ${field}`);
      });
    } else {
      console.log('No obvious evaluation fields found with keywords:', evaluationKeywords.join(', '));
    }

  } catch (error) {
    console.error('❌ Error inspecting data:', error);
  }
}

inspectUserData();