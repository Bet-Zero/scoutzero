// generateCapSheets.js
import {
  db,
  collection,
  getDocs,
  setDoc,
  doc,
} from '../firebaseConfig.node.js';

const generateCapSheets = async () => {
  if (!db) {
    console.log('⚠️  Firebase not available - cannot generate cap sheets from database');
    console.log('💡 Place serviceAccountKey.json in project root to enable cap sheet generation');
    console.log('📁 Using local player data instead...');
    
    // Try to use local data file
    try {
      const fs = await import('fs');
      const localDataPath = './data/players_merged.json';
      if (fs.existsSync(localDataPath)) {
        const localData = JSON.parse(fs.readFileSync(localDataPath, 'utf8'));
        console.log(`📁 Loaded ${Object.keys(localData).length} players from local file`);
        await generateCapSheetsFromData(localData);
        return;
      } else {
        console.log('❌ No local player data found at ./data/players_merged.json');
        console.log('💡 Run "npm run contracts:update" first to generate player data');
        return;
      }
    } catch (error) {
      console.log('❌ Failed to use local data:', error.message);
      return;
    }
  }
  
  console.log('📦 Loading players from Firebase...');
  const playerSnap = await getDocs(collection(db, 'players'));
  const players = [];
  playerSnap.forEach((doc) => players.push({ id: doc.id, ...doc.data() }));
  
  await generateCapSheetsFromPlayers(players);
};

const generateCapSheetsFromData = async (playersData) => {
  const players = Object.entries(playersData).map(([id, data]) => ({ id, ...data }));
  await generateCapSheetsFromPlayers(players);
};

const generateCapSheetsFromPlayers = async (players) => {
  const teamCapSheets = {};

  for (const player of players) {
    const team = player.bio?.Team?.toLowerCase() || player.Team?.toLowerCase();
    const contract = player.contract || player.Contract;
    if (!team || !contract) continue;

    if (!teamCapSheets[team]) {
      teamCapSheets[team] = {
        players: [],
        totalSalaryByYear: {},
        totalCommitted: 0,
        lastUpdated: Date.now(),
      };
    }

    const sheet = teamCapSheets[team];

    // Merge base + extension, giving priority to extension
    const salariesByYear = {};

    for (const entry of contract.annual_salaries || []) {
      if (!entry?.year || !entry?.salary) continue;
      salariesByYear[entry.year] = {
        salary: entry.salary,
        guaranteed: entry.guaranteed ?? true,
        option: entry.option || null,
        source: 'base',
      };
    }

    for (const entry of contract.extension?.annual_salaries || []) {
      if (!entry?.year || !entry?.salary) continue;
      salariesByYear[entry.year] = {
        salary: entry.salary,
        guaranteed: entry.guaranteed ?? true,
        option: entry.option || null,
        source: 'extension',
      };
    }

    // Build contract_clean block
    const contract_clean = {
      salaries_by_year: {},
      fa_year: contract.free_agency_year || null,
      fa_type: player.free_agent_type || null,
      bird_rights: player.bird_rights || null,
      total_value: 0,
      average_value: 0,
      years: 0,
      has_extension: !!contract.extension,
    };

    let total = 0;
    let yearCount = 0;

    for (const [yearStr, data] of Object.entries(salariesByYear)) {
      const year = parseInt(yearStr);
      contract_clean.salaries_by_year[year] = data;

      sheet.totalSalaryByYear[year] =
        (sheet.totalSalaryByYear[year] || 0) + data.salary;
      sheet.totalCommitted += data.salary;

      total += data.salary;
      yearCount++;
    }

    contract_clean.total_value = total;
    contract_clean.years = yearCount;
    contract_clean.average_value =
      yearCount > 0 ? Math.round(total / yearCount) : 0;

    // Push player entry to team
    sheet.players.push({
      name: player.name || player.Name,
      display_name: player.display_name || player.Name,
      player_id: player.player_id || null,
      age: player.AGE || player.bio?.AGE || null,
      position: player.Position || player.bio?.Position || null,
      height: player.HT || player.bio?.HT || null,
      weight: player.WT || player.bio?.WT || null,
      contract_clean,
    });
  }

  // Save cap sheets - either to Firebase or local file
  if (db) {
    console.log('🛠 Uploading team cap sheets to Firebase...');
    for (const [teamId, capSheet] of Object.entries(teamCapSheets)) {
      await setDoc(doc(db, 'teams', teamId), { capSheet }, { merge: true });
      console.log(`✅ Saved cap sheet for: ${teamId}`);
    }
  } else {
    console.log('💾 Saving team cap sheets to local file...');
    const fs = await import('fs');
    const outputPath = './data/team_cap_sheets.json';
    fs.writeFileSync(outputPath, JSON.stringify(teamCapSheets, null, 2));
    console.log(`✅ Saved cap sheets to: ${outputPath}`);
    console.log(`📊 Generated cap sheets for ${Object.keys(teamCapSheets).length} teams`);
  }

  console.log('🎉 Done! Cap sheets generated successfully.');
};

generateCapSheets();
