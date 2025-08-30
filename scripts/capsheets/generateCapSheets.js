// scripts/capsheets/generateCapSheets.js
import { db } from '../firebaseConfig.node.js';
import { getDocs, collection, doc, setDoc } from 'firebase/firestore';

async function generateCapSheets() {
  try {
    console.log('🏀 Generating cap sheets for all teams...');
    
    // Get all players
    const playerSnap = await getDocs(collection(db, 'players'));
    const players = [];
    
    playerSnap.forEach(doc => {
      const data = doc.data();
      if (data.team && data.contract_summary) {
        players.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    console.log(`📊 Processing ${players.length} players with contract data...`);
    
    // Group by team
    const teamData = {};
    const currentYear = new Date().getFullYear();
    
    players.forEach(player => {
      const team = player.team;
      if (!teamData[team]) {
        teamData[team] = {
          players: [],
          totalSalaryByYear: {},
          totalCommitted: 0,
          lastUpdated: Date.now()
        };
      }
      
      teamData[team].players.push({
        player_id: player.id,
        name: player.display_name || player.name,
        contract_clean: player.contract_summary,
        position: player.bio?.position || player.formattedPosition,
        age: player.bio?.age || player.age,
        height: player.bio?.height || player.heightInInches,
        weight: player.bio?.weight
      });
      
      // Calculate salary totals by year
      if (player.contract_summary?.salaries_by_year) {
        Object.entries(player.contract_summary.salaries_by_year).forEach(([year, salaryData]) => {
          const yearNum = parseInt(year);
          if (yearNum >= currentYear) {
            if (!teamData[team].totalSalaryByYear[year]) {
              teamData[team].totalSalaryByYear[year] = 0;
            }
            teamData[team].totalSalaryByYear[year] += salaryData.salary || 0;
            
            if (yearNum === currentYear) {
              teamData[team].totalCommitted += salaryData.salary || 0;
            }
          }
        });
      }
    });
    
    // Generate and save cap sheets
    const promises = Object.entries(teamData).map(async ([teamId, data]) => {
      const capSheet = {
        players: data.players,
        totalSalaryByYear: data.totalSalaryByYear,
        totalCommitted: data.totalCommitted,
        lastUpdated: data.lastUpdated,
        generated: Date.now()
      };
      
      await setDoc(doc(db, 'teams', teamId), { capSheet }, { merge: true });
      console.log(`✅ Generated cap sheet for ${teamId}`);
      return { teamId, playerCount: data.players.length, totalCommitted: data.totalCommitted };
    });
    
    const results = await Promise.all(promises);
    
    console.log('\n📋 Cap Sheet Generation Complete:');
    results.forEach(({ teamId, playerCount, totalCommitted }) => {
      console.log(`  ${teamId}: ${playerCount} players, $${(totalCommitted / 1000000).toFixed(1)}M committed`);
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ Error generating cap sheets:', error);
    throw error;
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  generateCapSheets()
    .then(() => {
      console.log('\n🎉 All cap sheets generated successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to generate cap sheets:', error);
      process.exit(1);
    });
}

export { generateCapSheets };