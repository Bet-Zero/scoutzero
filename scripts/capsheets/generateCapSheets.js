// generateCapSheets.js
import {
  db,
  collection,
  getDocs,
  setDoc,
  doc,
} from '../firebaseConfig.node.js';

const generateCapSheets = async () => {
  console.log('📦 Loading players...');
  const playerSnap = await getDocs(collection(db, 'players'));
  const players = [];
  playerSnap.forEach((doc) => players.push({ id: doc.id, ...doc.data() }));

  const teamCapSheets = {};

  for (const player of players) {
    const team = player.bio?.Team?.toLowerCase();
    const contract = player.contract;
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

    // 🆕 Add age and position from bio
    const age = player.bio?.age ?? null;
    const position = player.bio?.positionFull || player.bio?.position || null;

    // Push player entry to team
    sheet.players.push({
      name: player.name,
      display_name: player.display_name || player.name,
      player_id: player.player_id || null,
      age: player.bio?.AGE ?? null,
      position: player.bio?.Position ?? null,
      height: player.bio?.HT ?? null,
      weight: player.bio?.WT ?? null,
      contract_clean,
    });
  }

  console.log('🛠 Uploading team cap sheets...');
  for (const [teamId, capSheet] of Object.entries(teamCapSheets)) {
    await setDoc(doc(db, 'teams', teamId), { capSheet }, { merge: true });
    console.log(`✅ Saved cap sheet for: ${teamId}`);
  }

  console.log(
    '🎉 Done! Clean contract data with age and position saved in cap sheets.'
  );
};

generateCapSheets();
