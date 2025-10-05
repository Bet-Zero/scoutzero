import { POSITION_MAP } from '../roles';

/**
 * Enrich player data with computed/convenience fields
 * This adds helpful derived fields without changing the v2 schema structure
 */
export function enrichPlayerData(playerData) {
  const rawPosition = playerData.bio?.position || playerData.bio?.Position;
  const formattedPosition = POSITION_MAP[rawPosition] || rawPosition || '—';

  // Handle salary data from contracts subcollection or legacy contract field
  const salaryMap = {};
  const contractData = playerData.contracts ? Object.values(playerData.contracts)[0] : playerData.contract;
  const annualSalaries = contractData?.salariesByYear || contractData?.annual_salaries || [];
  
  annualSalaries.forEach((s) => {
    let raw = s.salary;
    if (typeof raw === 'string') {
      raw = raw.replace(/[\$,]/g, '');
      if (raw.includes('M')) {
        raw = raw.replace('M', '');
        salaryMap[s.year || s.season] = parseFloat(raw);
      } else {
        salaryMap[s.year || s.season] = parseFloat(raw) / 1_000_000;
      }
    } else if (typeof raw === 'number') {
      salaryMap[s.year || s.season] = raw / 1_000_000;
    } else {
      salaryMap[s.year || s.season] = null;
    }
    if (isNaN(salaryMap[s.year || s.season])) salaryMap[s.year || s.season] = null;
  });

  // Get current season stats - try from seasons subcollection first, then legacy
  let currentStats = {};
  if (playerData.seasons) {
    // Use most recent season
    const seasons = Object.entries(playerData.seasons);
    if (seasons.length > 0) {
      const [, seasonData] = seasons.sort((a, b) => b[0].localeCompare(a[0]))[0];
      currentStats = seasonData.stats || {};
    }
  } else if (playerData.system?.stats) {
    // Legacy path
    currentStats = playerData.system.stats;
  }

  // Get evaluation data - try from evaluations subcollection first, then legacy
  let evaluationData = {};
  if (playerData.evaluations) {
    const evals = Object.values(playerData.evaluations);
    if (evals.length > 0) {
      evaluationData = evals[0]; // Use first evaluation
    }
  } else {
    // Legacy path - data at root level
    evaluationData = {
      roles: playerData.roles,
      subRoles: playerData.subRoles,
      traits: playerData.traits,
      badges: playerData.badges,
      shootingProfile: playerData.shootingProfile,
    };
  }

  return {
    ...playerData,
    formattedPosition,
    heightInInches: playerData.bio?.height || 0,
    weight: playerData.bio?.weight || 0,
    age: playerData.bio?.age || 0,
    headshotUrl: `/assets/headshots/${playerData.bio?.playerId || playerData.player_id}.png`,
    offenseRole: evaluationData.roles?.offense1 || '—',
    defenseRole: evaluationData.roles?.defense1 || '—',
    shootingProfile: evaluationData.shootingProfile || '—',
    subRoles: {
      offense: evaluationData.subRoles?.offense || [],
      defense: evaluationData.subRoles?.defense || [],
    },
    traits: evaluationData.traits || {},
    badges: evaluationData.badges || [],
    salaryByYear: salaryMap,
    PPG: currentStats.PTS ?? currentStats.PPG ?? null,
    RPG: currentStats.REB ?? currentStats.TRB ?? currentStats.RPG ?? null,
    APG: currentStats.AST ?? currentStats.APG ?? null,
    ...currentStats,
  };
}
