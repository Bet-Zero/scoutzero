import { POSITION_MAP } from '@/utils/roles/roleUtils';

/**
 * Enrich player data with computed/convenience fields
 * This handles the v2 nested schema structure only
 *
 * Expected v2 structure:
 * - bio: { displayName, position, height, weight, age, team, etc. }
 * - contracts: { [contractId]: { salariesByYear, etc. } }
 * - seasons: { [seasonId]: { stats, team, etc. } }
 * - evaluations: { [evalId]: { roles, traits, badges, etc. } }
 */
export function enrichPlayerData(playerData) {
  if (!playerData) return null;

  // v2 nested position data (ONLY v2 structure)
  const rawPosition = playerData.bio?.position;
  const formattedPosition = POSITION_MAP[rawPosition] || rawPosition || '—';

  // Determine the primary contract (first contract document)
  let primaryContractId = null;
  let primaryContract = null;
  if (playerData.contracts && Object.keys(playerData.contracts).length > 0) {
    const [firstId, firstContract] = Object.entries(playerData.contracts).sort(
      ([a], [b]) => a.localeCompare(b)
    )[0];
    primaryContractId = firstId;
    primaryContract = firstContract || null;
  }

  const salaryMap = {};
  const annualSalaries = primaryContract?.salariesByYear || [];

  annualSalaries.forEach((s) => {
    const key = s.year || s.season;
    if (!key) return;

    let raw = s.salary;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[\$,]/g, '').trim();
      if (cleaned.endsWith('M')) {
        const value = parseFloat(cleaned.slice(0, -1));
        salaryMap[key] = Number.isFinite(value) ? value : null;
      } else {
        const value = parseFloat(cleaned);
        salaryMap[key] = Number.isFinite(value) ? value / 1_000_000 : null;
      }
    } else if (typeof raw === 'number') {
      salaryMap[key] = raw / 1_000_000;
    } else {
      salaryMap[key] = null;
    }

    if (Number.isNaN(salaryMap[key])) {
      salaryMap[key] = null;
    }
  });

  // v2 stats data from seasons subcollection
  let latestSeasonId = null;
  let latestSeasonStats = {};
  let latestSeasonMeta = {};
  if (playerData.seasons && Object.keys(playerData.seasons).length > 0) {
    const [seasonId, seasonData] = Object.entries(playerData.seasons).sort(
      ([a], [b]) => b.localeCompare(a)
    )[0];
    latestSeasonId = seasonId;
    latestSeasonStats = seasonData?.stats || {};
    latestSeasonMeta = seasonData?.meta || {};
  }

  // v2 evaluation data from evaluations subcollection (use first entry)
  let evaluationData = {};
  if (
    playerData.evaluations &&
    Object.keys(playerData.evaluations).length > 0
  ) {
    const [evaluation] = Object.values(playerData.evaluations);
    evaluationData = evaluation || {};
  }

  return {
    ...playerData,
    // Convenience fields sourced exclusively from v2 structure
    name: playerData.bio?.displayName || '',
    formattedPosition,
    heightInInches: playerData.bio?.height || 0,
    weight: playerData.bio?.weight || 0,
    age: playerData.bio?.age || 0,
    team: playerData.bio?.display?.team || null,
    headshotUrl: `/assets/headshots/${
      playerData.bio?.playerId || playerData.id
    }.png`,
    offenseRole: evaluationData.roles?.offense1 || '—',
    defenseRole: evaluationData.roles?.defense1 || '—',
    shootingProfile: evaluationData.shootingProfile || '—',
    subRoles: {
      offense: evaluationData.subRoles?.offense || [],
      defense: evaluationData.subRoles?.defense || [],
    },
    traits: evaluationData.traits || {},
    badges: evaluationData.badges || [],
    overallGrade: evaluationData.overallGrade ?? null,
    salaryByYear: salaryMap,
    latestSeasonId,
    latestSeasonStats,
    latestSeasonMeta,
    primaryContractId,
    primaryContract,
    primaryEvaluation: evaluationData,
    PPG: latestSeasonStats.PTS ?? null,
    RPG: latestSeasonStats.REB ?? null,
    APG: latestSeasonStats.AST ?? null,
    ...latestSeasonStats,
  };
}
