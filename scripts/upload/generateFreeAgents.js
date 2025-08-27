// scripts/upload/generateFreeAgents.js

import {
  db,
  collection,
  doc,
  setDoc,
  getDocs,
} from '../firebaseConfig.node.js';
import { setDoc, doc, getDocs, collection } from 'firebase/firestore';

const CURRENT_YEAR = 2025;

async function generateFreeAgents() {
  const teamsSnap = await getDocs(collection(db, 'teams'));
  const allPlayers = [];

  teamsSnap.forEach((teamDoc) => {
    const teamData = teamDoc.data();
    const players = teamData.capSheet?.players || [];
    allPlayers.push(...players);
  });

  const freeAgents = allPlayers
    .filter((p) => p.contract_clean?.fa_year === CURRENT_YEAR)
    .map((p) => {
      const lastYear = CURRENT_YEAR - 1;
      const salary =
        p.contract_clean?.salaries_by_year?.[lastYear]?.salary ?? 3000000;

      return {
        player_id: p.player_id,
        name: p.name,
        display_name: p.display_name || p.name,
        position: p.position || '',
        height: p.height || '',
        weight: p.weight || '',
        yearsPro: p.bio?.yearsPro || 0,
        bird_rights: p.contract_clean?.bird_rights || 'None',
        fa_type: p.contract_clean?.fa_type || 'UFA',
        previousSalary: salary,
        askingSalary: salary, // For now, asking = previous
      };
    });

  await setDoc(doc(db, 'meta', 'freeAgents'), {
    pool: freeAgents,
  });

  console.log(
    `✅ Generated ${freeAgents.length} free agents for ${CURRENT_YEAR}`
  );
}

generateFreeAgents().catch((err) => {
  console.error('Error generating free agents:', err);
});
