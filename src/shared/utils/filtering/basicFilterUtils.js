// Consolidated basic filtering utilities
// Merged from: teamOptions.js, addPlayerUtils.js

import { TeamListFull } from '@/constants/teamList';

const normalizeTeamKey = (value) =>
  value
    .toString()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const TEAM_CODE_LOOKUP = TeamListFull.reduce((map, team) => {
  const code = team.code.toUpperCase();
  map.set(team.code.toLowerCase(), code);
  map.set(team.id.toLowerCase(), code);
  map.set(team.teamName.toLowerCase(), code);
  map.set(team.nickname.toLowerCase(), code);
  map.set(normalizeTeamKey(team.teamName), code);
  map.set(normalizeTeamKey(team.nickname), code);
  return map;
}, new Map());

export const normalizeTeamCode = (value) => {
  if (value === null || value === undefined) return '';
  const raw = value.toString().trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (TEAM_CODE_LOOKUP.has(lower)) return TEAM_CODE_LOOKUP.get(lower);
  const normalized = normalizeTeamKey(raw);
  if (TEAM_CODE_LOOKUP.has(normalized)) return TEAM_CODE_LOOKUP.get(normalized);
  if (raw.length === 3) return raw.toUpperCase();
  return raw;
};

/**
 * Normalize free agent type to canonical values
 * Schema canonical values: UFA, RFA, SFA, TWO_WAY, NONE
 * UI filter values: ufa, rfa, sfa, two_way, none, to, po, eto
 */
export const normalizeFreeAgentType = (value) => {
  if (value === null || value === undefined) return '';
  const raw = value.toString().trim().toLowerCase();
  if (!raw || raw === 'any' || raw === 'any type') return '';

  // Canonical schema values (uppercase in data)
  if (raw === 'ufa' || raw === 'unrestricted' || raw === 'unrestricted fa')
    return 'ufa';
  if (raw === 'rfa' || raw === 'restricted' || raw === 'restricted fa')
    return 'rfa';
  if (raw === 'sfa') return 'sfa';
  if (
    raw === 'two_way' ||
    raw === 'two-way' ||
    raw === 'two way' ||
    raw === 'twoway' ||
    raw === '2-way' ||
    raw === '2w'
  )
    return 'two_way';
  if (raw === 'none') return 'none';

  // Options (not FA types but used in filter)
  if (raw === 'team option' || raw === 'team_option') return 'to';
  if (raw === 'player option' || raw === 'player_option') return 'po';
  if (raw === 'early termination option' || raw === 'eto') return 'eto';

  return raw;
};

/**
 * Get player's free agent type from multiple possible field locations
 * Checks in priority order:
 * 1. currentContractView.freeAgentType (denormalized view)
 * 2. bio.display.freeAgentType (legacy field)
 * 3. primaryContract.freeAgency.freeAgentType (subcollection)
 * 4. freeAgentType (top-level enriched field)
 *
 * @param {Object} player - Player object (can be enriched or raw)
 * @returns {string|null} - Canonical FA type (lowercase) or null if not found
 */
export const getPlayerFreeAgentType = (player) => {
  if (!player) return null;

  // Check all known field locations
  const rawType =
    player.currentContractView?.freeAgentType ||
    player.bio?.display?.freeAgentType ||
    player.primaryContract?.freeAgency?.freeAgentType ||
    player.freeAgentType ||
    null;

  if (!rawType) return null;

  // Normalize from schema values (UFA, RFA, etc.) to filter values (ufa, rfa, etc.)
  const normalized = normalizeFreeAgentType(rawType);
  return normalized || null;
};

// Export full team objects for use across filters and dropdowns
export const teamOptions = TeamListFull;

/**
 * Check if a player has a specific option type (PO, TO, ETO) in any year.
 * Uses the same field paths as Players Table filtering (optionByYear from enrichPlayerData).
 *
 * @param {Object} player - Enriched player object with options array or optionByYear map
 * @param {'to'|'po'|'eto'} optionType - The option type to check for (lowercase)
 * @returns {boolean} - True if player has the specified option type
 */
export const playerHasOptionType = (player, optionType) => {
  if (!player || !optionType) return false;

  const normalizedType = optionType.toUpperCase(); // Options stored as 'PO', 'TO', 'ETO'

  // Check optionByYear map (enriched player format - used by Players Table)
  const optionByYear = player.optionByYear || player.original?.optionByYear;
  if (optionByYear && typeof optionByYear === 'object') {
    const hasOption = Object.values(optionByYear).some(
      (opt) => opt?.toUpperCase?.() === normalizedType
    );
    if (hasOption) return true;
  }

  // Check options array (AddPlayerDrawer processed format)
  const options = player.options || player.original?.options;
  if (Array.isArray(options)) {
    const hasOption = options.some((opt) => {
      const type = opt?.type || opt;
      return type?.toUpperCase?.() === normalizedType;
    });
    if (hasOption) return true;
  }

  return false;
};

/**
 * Check if a player has a two-way contract.
 * Uses the same logic as isTwoWayContract from roster/utils/contractUtils.js
 * but also supports enriched player formats used in AddPlayerDrawer.
 *
 * @param {Object} player - Player object (enriched or raw)
 * @returns {boolean} - True if player has a two-way contract
 */
export const isPlayerTwoWay = (player) => {
  if (!player) return false;

  // Get the actual player data (may be nested in 'original' for AddPlayerDrawer format)
  const p = player.original || player;

  // Check contract fields for two-way indicator
  const contract =
    p.contract ||
    p.primaryContract ||
    (p.contracts ? Object.values(p.contracts)[0] : null) ||
    p.contractView ||
    p.currentContractView ||
    null;

  const fieldsToCheck = [
    typeof contract?.signedUsing === 'string' ? contract.signedUsing : null,
    typeof contract?.contractType === 'string' ? contract.contractType : null,
  ];

  return fieldsToCheck.some(
    (val) =>
      typeof val === 'string' &&
      ['two-way', 'two way', 'two_way'].some((keyword) =>
        val.toLowerCase().includes(keyword)
      )
  );
};

// Default filters for add player functionality
export const getDefaultAddPlayerFilters = () => ({
  team: '',
  position: '',
  offenseRole: '',
  defenseRole: '',
  subRoles: { offense: [], defense: [] },
  shootingProfile: '',
  badges: [],
  minSalary: undefined,
  maxSalary: undefined,
  freeAgentYear: '',
  freeAgentStatus: '', // Renamed from freeAgentType - now only UFA/RFA
  contractFeature: '', // New: TO/PO/ETO/Two-Way
});
