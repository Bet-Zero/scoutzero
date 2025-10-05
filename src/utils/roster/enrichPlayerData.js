import { POSITION_MAP } from '../roles';

/**
 * Enrich player data with computed/convenience fields
 * This adds helpful derived fields from the v2 schema structure
 * 
 * IMPORTANT: This function assumes data is in v2 format ONLY
 * No legacy fallbacks - data must come from subcollections
 */
export function enrichPlayerData(playerData) {
  const rawPosition = playerData.bio?.position;
  const formattedPosition = POSITION_MAP[rawPosition] || rawPosition || '—';

  // Get contract data from contracts subcollection
  const salaryMap = {};
  const contractData = playerData.contracts ? Object.values(playerData.contracts)[0] : null;
  const annualSalaries = contractData?.salariesByYear || [];
  
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

  // Get current season stats from seasons subcollection
  let currentStats = {};
  if (playerData.seasons) {
    const seasons = Object.entries(playerData.seasons);
    if (seasons.length > 0) {
      const [, seasonData] = seasons.sort((a, b) => b[0].localeCompare(a[0]))[0];
      currentStats = seasonData.stats || {};
    }
  }

  // Get evaluation data from evaluations subcollection
  let evaluationData = {};
  if (playerData.evaluations) {
    const evals = Object.values(playerData.evaluations);
    if (evals.length > 0) {
      evaluationData = evals[0]; // Use first evaluation
    }
  }

  return {
    ...playerData,
    formattedPosition,
    heightInInches: playerData.bio?.height || 0,
    weight: playerData.bio?.weight || 0,
    age: playerData.bio?.age || 0,
    headshotUrl: `/assets/headshots/${playerData.bio?.playerId || playerData.id}.png`,
    offenseRole: evaluationData.roles?.offense1 || '—',
    defenseRole: evaluationData.roles?.defense1 || '—',
    shootingProfile: evaluationData.shootingProfile || '—',
    subRoles: {
      offense: evaluationData.subRoles?.offense || [],
      defense: evaluationData.subRoles?.defense || [],
    },
    traits: evaluationData.traits || {},
    badges: evaluationData.badges || [],
    overallGrade: evaluationData.overallGrade,
    salaryByYear: salaryMap,
    PPG: currentStats.PTS ?? null,
    RPG: currentStats.REB ?? null,
    APG: currentStats.AST ?? null,
    ...currentStats,
  };
}
