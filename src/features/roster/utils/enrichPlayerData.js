/**
 * FILE: src/features/roster/utils/enrichPlayerData.js
 * PURPOSE: Normalize players_v2 data into UI-friendly contract, stats, and evaluation fields.
 * OWNERSHIP: Feature: roster (player data enrichment)
 *
 * HISTORY:
 *  - 2026-01-21: Updated by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import { POSITION_MAP } from '@/shared/utils/roles/roleUtils';
import { normalizeBlurbs } from '@/shared/utils/blurbs';

/**
 * Normalize playerId for headshot path lookup
 * Handles special characters (e.g., kristaps_porzingis -> kristaps_porziņģis)
 */
function normalizeHeadshotId(playerId) {
  if (!playerId) return 'default';
  // Normalize special characters - convert to ASCII-friendly version
  return playerId
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Get headshot path, trying normalized version first, then falling back to original
 */
function getHeadshotPath(playerId) {
  if (!playerId) return '/assets/headshots/default.png';
  const normalized = normalizeHeadshotId(playerId);
  // Try normalized first (handles special characters)
  return `/assets/headshots/${normalized}.png`;
}

/**
 * Calculate age from date of birth (DOB)
 * @param {string} dob - Date of birth in ISO format (YYYY-MM-DD) or other parseable format
 * @returns {number|null} - Age in years, or null if DOB is invalid
 */
function calculateAgeFromDOB(dob) {
  if (!dob) return null;
  
  try {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

const hasOwn = (obj, key) =>
  obj && Object.prototype.hasOwnProperty.call(obj, key);

const pickEvaluationDoc = (evaluations = {}) => {
  if (!evaluations || typeof evaluations !== 'object') return null;
  if (evaluations.current) return evaluations.current;
  const values = Object.values(evaluations);
  return values.length > 0 ? values[0] : null;
};

const normalizeShootingProfile = (value) => {
  if (typeof value !== 'string') return '';
  if (value.trim() === '—') return '';
  return value;
};

const normalizeSubRoles = (viewSub, subSub) => ({
  offense: Array.isArray(subSub?.offense)
    ? subSub.offense
    : Array.isArray(viewSub?.offense)
      ? viewSub.offense
      : [],
  defense: Array.isArray(subSub?.defense)
    ? subSub.defense
    : Array.isArray(viewSub?.defense)
      ? viewSub.defense
      : [],
});

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

  // Prioritize denormalized views from main document, fallback to subcollections
  // Contract data: use currentContractView if available
  let salaryMap = {};
  let primaryContractId = null;
  let primaryContract = null;
  
  // Build primaryContract from currentContractView for easier access
  if (playerData.currentContractView?.salaryByYear) {
    // Use denormalized salaryByYear from main document
    const denormalizedSalaries = playerData.currentContractView.salaryByYear;
    Object.keys(denormalizedSalaries).forEach((year) => {
      const salary = denormalizedSalaries[year];
      salaryMap[year] = typeof salary === 'number' ? salary / 1_000_000 : null;
    });
    
    // Create a primaryContract-like structure from currentContractView
    // Convert salaryByYear object to array format for backward compatibility
    const salariesArray = Object.entries(denormalizedSalaries).map(([year, salary]) => ({
      year: parseInt(year, 10),
      salary: typeof salary === 'number' ? salary : null,
    })).sort((a, b) => a.year - b.year);
    
    primaryContract = {
      salariesByYear: salariesArray,
      freeAgency: {
        freeAgentYear: playerData.currentContractView.freeAgentYear,
        freeAgentType: playerData.currentContractView.freeAgentType,
      },
      contractType: playerData.currentContractView.contractType,
      options: playerData.currentContractView.options || [],
      birdRights: playerData.currentContractView.birdRights,
      yearsRemaining: playerData.currentContractView.yearsRemaining,
      averageAnnualValue: playerData.currentContractView.averageAnnualValue,
      maxType: playerData.currentContractView.maxType,
    };
  } else {
    // Fallback to contracts subcollection
    if (playerData.contracts && Object.keys(playerData.contracts).length > 0) {
      const [firstId, firstContract] = Object.entries(playerData.contracts).sort(
        ([a], [b]) => a.localeCompare(b)
      )[0];
      primaryContractId = firstId;
      primaryContract = firstContract || null;
    }

    const annualSalaries = primaryContract?.salariesByYear || [];
    annualSalaries.forEach((s) => {
      const key = s.year || s.season;
      if (!key) return;

      let raw = s.salary;
      if (typeof raw === 'string') {
        const cleaned = raw.replace(/[$,]/g, '').trim();
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
  }

  // Stats data: use currentSeasonStats if available
  let latestSeasonId = null;
  let latestSeasonStats = {};
  let latestSeasonMeta = {};
  
  if (playerData.currentSeasonStats) {
    // Use denormalized stats from main document
    latestSeasonStats = playerData.currentSeasonStats;
  } else if (playerData.seasons && Object.keys(playerData.seasons).length > 0) {
    // Fallback to seasons subcollection
    const [seasonId, seasonData] = Object.entries(playerData.seasons).sort(
      ([a], [b]) => b.localeCompare(a)
    )[0];
    latestSeasonId = seasonId;
    latestSeasonStats = seasonData?.stats || {};
    latestSeasonMeta = seasonData?.meta || {};
  }

  // Evaluation data: merge currentEvaluationView with evaluations/current (preferred)
  const evaluationView = playerData.currentEvaluationView || {};
  const evaluationDoc = pickEvaluationDoc(playerData.evaluations);

  const roles = {
    ...(evaluationView.roles || {}),
    ...(evaluationDoc?.roles || {}),
  };

  const traits = {
    ...(evaluationView.traits || {}),
    ...(evaluationDoc?.traits || {}),
  };

  const subRoles = normalizeSubRoles(
    evaluationView.subRoles,
    evaluationDoc?.subRoles
  );

  const shootingProfileRaw = hasOwn(evaluationDoc, 'shootingProfile')
    ? evaluationDoc.shootingProfile
    : evaluationView.shootingProfile;
  const shootingProfile = normalizeShootingProfile(shootingProfileRaw);

  const twoWay = hasOwn(evaluationDoc, 'twoWay')
    ? evaluationDoc.twoWay
    : evaluationView.twoWay;

  const badges = hasOwn(evaluationDoc, 'badges')
    ? Array.isArray(evaluationDoc.badges)
      ? evaluationDoc.badges
      : []
    : Array.isArray(evaluationView.badges)
      ? evaluationView.badges
      : [];

  const overallGrade = hasOwn(evaluationDoc, 'overallGrade')
    ? evaluationDoc.overallGrade
    : evaluationView.overallGrade;

  const blurbs = hasOwn(evaluationDoc, 'blurbs')
    ? normalizeBlurbs(evaluationDoc.blurbs)
    : normalizeBlurbs(evaluationView.blurbs);

  const evaluationData = {
    ...evaluationView,
    ...(evaluationDoc || {}),
    roles,
    traits,
    subRoles,
    shootingProfile,
    twoWay,
    badges,
    overallGrade,
    blurbs,
  };

  // Calculate age from DOB if age is not available
  const age = playerData.bio?.age || calculateAgeFromDOB(playerData.bio?.dob) || 0;

  return {
    ...playerData,
    // Convenience fields sourced exclusively from v2 structure
    name: playerData.bio?.displayName || '',
    formattedPosition,
    heightInInches: playerData.bio?.height || 0,
    weight: playerData.bio?.weight || 0,
    age,
    team: playerData.bio?.display?.team || null,
    headshotUrl: getHeadshotPath(playerData.bio?.playerId || playerData.id),
    offenseRole: evaluationData.roles?.offense1 || '—',
    defenseRole: evaluationData.roles?.defense1 || '—',
    shootingProfile,
    twoWay: Number.isFinite(evaluationData.twoWay)
      ? evaluationData.twoWay
      : null,
    blurbs,
    subRoles,
    traits: evaluationData.traits || {},
    badges,
    overallGrade: evaluationData.overallGrade ?? null,
    salaryByYear: salaryMap,
    latestSeasonId,
    latestSeasonStats,
    latestSeasonMeta,
    primaryContractId,
    primaryContract,
    primaryEvaluation: evaluationData,
    // Expose currentContractView for easy access
    currentContractView: playerData.currentContractView,
    currentEvaluationView: playerData.currentEvaluationView,
    currentSeasonStats: playerData.currentSeasonStats,
    PPG: latestSeasonStats.PTS ?? null,
    RPG: latestSeasonStats.REB ?? null,
    APG: latestSeasonStats.AST ?? null,
    ...latestSeasonStats,
  };
}
