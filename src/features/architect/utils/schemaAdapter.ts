/**
 * Trade Input Builder
 *
 * Builds the trade input structure expected by the trade validation API.
 * Combines team baseline state (from getTeam()) with trade-specific data
 * (sends, picksOut, etc.) into the proper structure.
 *
 * The trade validation API expects:
 * {
 *   team: { ...teamState },  // Team's baseline state
 *   sends: [...],            // What this team is sending in THIS trade
 *   picksOut: [...],        // What picks this team is sending
 *   ...
 * }
 *
 * Note: Validators already handle the new schema format (salariesByYear, season codes, etc.),
 * so this only structures the data, it doesn't convert fields.
 *
 * @file src/utils/architect/schemaAdapter.ts
 * @module schemaAdapter
 */

type UnknownRecord = Record<string, unknown>;

interface TotalsLike extends UnknownRecord {
  totalSalary?: number;
  capHit?: number;
}

interface TeamStateLike extends UnknownRecord {
  team?: UnknownRecord | null;
  hardCapped?: boolean;
  teamCode?: string;
  id?: string;
  teamName?: string;
  name?: string;
  abbreviation?: string;
  players?: unknown[];
  roster?: unknown[];
  activeContracts?: unknown[];
  totals?: TotalsLike;
  capHolds?: unknown[];
  deadCap?: unknown[];
  exceptions?: UnknownRecord;
  tradeExceptions?: unknown[];
  mle?: unknown;
  bae?: unknown;
  draftPicks?: unknown[];
}

interface TradeDataLike extends UnknownRecord {
  sends?: unknown[];
  picksOut?: unknown[];
  cashSent?: number;
  cashReceived?: number;
  hardCapped?: boolean;
  appliedTPEs?: unknown[];
  teamState?: TeamStateLike | null;
}

interface TradeInputTeamLike extends TradeDataLike, TeamStateLike {}

interface TradeInputLike extends UnknownRecord {
  teams?: TradeInputTeamLike[];
}

/**
 * Note: Season/year conversion functions removed.
 * Validators use their own utilities (seasonUtils.js, tradeHelpers.js) which
 * already handle the new schema format correctly.
 */

/**
 * Build trade team input structure
 *
 * Combines team baseline state with trade-specific data into the structure
 * expected by the trade validation API.
 *
 * @param {Object} teamState - Team baseline state from getTeam() (flat structure)
 * @param {Object} [tradeData] - Trade-specific data (sends, picksOut, cashSent, etc.)
 * @returns {Object} Trade team input: { team: {...teamState}, sends: [], picksOut: [], ... }
 */
export function buildTradeTeamInput(
  teamState: TeamStateLike | null | undefined,
  tradeData: TradeDataLike = {}
): UnknownRecord | null {
  if (!teamState) {
    return null;
  }

  // If teamState already has the expected structure, merge trade data into it
  if (teamState.team && typeof teamState.team === 'object') {
    return {
      ...teamState,
      ...tradeData,
    };
  }

  // Build trade team input structure
  // Structure: { team: {...teamState}, sends: [], picksOut: [], ... }
  return {
    // Trade-specific data at top level
    sends: tradeData.sends || [],
    picksOut: tradeData.picksOut || [],
    cashSent: tradeData.cashSent || 0,
    cashReceived: tradeData.cashReceived || 0,
    hardCapped: tradeData.hardCapped || teamState.hardCapped || false,
    appliedTPEs: tradeData.appliedTPEs || [],

    // Team baseline state nested in team.team
    team: {
      // Team identity
      teamId: teamState.teamCode || teamState.id,
      teamName: teamState.teamName || teamState.name,
      teamCode: teamState.teamCode,
      id: teamState.id || teamState.teamCode?.toLowerCase(),
      code: teamState.teamCode,
      name: teamState.teamName,
      abbreviation: teamState.abbreviation || teamState.teamCode,

      // Team data (validators already handle new schema format)
      players: teamState.players || [],
      roster: teamState.roster || [],
      activeContracts: teamState.activeContracts || [],
      totals: teamState.totals || {},
      // Legacy trade-rule names are an explicit Apron Team Salary bridge.
      // Never source them from generic Cap Sheet aliases.
      totalSalary: teamState.totals?.apronTeamSalary ?? null,
      teamTotalSalary: teamState.totals?.apronTeamSalary ?? null,
      teamSalary: teamState.totals?.teamSalary ?? null,
      apronTeamSalary: teamState.totals?.apronTeamSalary ?? null,
      taxSalary: teamState.totals?.taxSalary ?? null,

      // Cap data
      capHolds: teamState.capHolds || [],
      deadCap: teamState.deadCap || [],
      exceptions: teamState.exceptions || {},
      tradeExceptions: teamState.tradeExceptions || [],
      mle: teamState.mle,
      bae: teamState.bae,
      hardCapped: teamState.hardCapped || false,

      // Draft picks
      draftPicks: teamState.draftPicks || [],
      picks: teamState.draftPicks || [], // Some validators use 'picks'

      // Preserve other team state fields (excluding already-set fields and trade-specific fields)
      // Explicitly exclude fields that were set above and trade-specific fields
      ...Object.fromEntries(
        Object.entries(teamState).filter(([key]) => {
          // Exclude trade-specific fields (should only be at top level)
          if (
            [
              'sends',
              'picksOut',
              'cashSent',
              'cashReceived',
              'appliedTPEs',
            ].includes(key)
          ) {
            return false;
          }
          // Exclude fields that were explicitly set above to prevent overwriting
          const explicitlySetFields = [
            'teamId',
            'teamName',
            'teamCode',
            'id',
            'code',
            'name',
            'abbreviation',
            'players',
            'roster',
            'activeContracts',
            'totals',
            'totalSalary',
            'teamTotalSalary',
            'capHolds',
            'deadCap',
            'exceptions',
            'tradeExceptions',
            'mle',
            'bae',
            'hardCapped',
            'draftPicks',
            'picks',
          ];
          return !explicitlySetFields.includes(key);
        })
      ),
    },
  };
}

/**
 * Adapt player data for validators
 *
 * Note: Validators already handle the new schema format, so this is mainly
 * for ensuring consistent field names. Most validators read directly from
 * contract.salariesByYear, contract.birdRights, etc.
 *
 * @param {Object} playerData - Player data from new schema
 * @param {number} [_currentYear] - Current year (unused, kept for API compatibility)
 * @returns {Object} Player data (minimal adaptation needed)
 */
export function adaptPlayerForValidator(
  playerData: UnknownRecord | null | undefined,
  _currentYear: number | null = null
): UnknownRecord | null {
  void _currentYear; // Unused parameter kept for API compatibility
  if (!playerData) {
    return null;
  }

  // Validators already handle new schema format, so just ensure consistent field names
  return {
    ...playerData,
    // Ensure name fields are present for validators that expect them
    name: playerData.name || playerData.displayName || playerData.player_id,
    displayName: playerData.displayName || playerData.name,
    player_id: playerData.player_id || playerData.id,
    // Contract structure is already correct (validators read from contract.salariesByYear)
  };
}

/**
 * Adapt contract data for validators
 *
 * Note: Validators already handle the new schema format (salariesByYear with season codes),
 * so this function is minimal. Kept for API compatibility.
 *
 * @param {Object} contract - Contract data from new schema
 * @param {number} [_currentYear] - Current year (unused, kept for API compatibility)
 * @returns {Object} Contract data (no adaptation needed)
 */
export function adaptContractForValidator(
  contract: UnknownRecord | null | undefined,
  _currentYear: number | null = null
): UnknownRecord | null {
  void _currentYear; // Unused parameter kept for API compatibility
  if (!contract) {
    return null;
  }

  // Validators already read from contract.salariesByYear, contract.birdRights, etc.
  // No adaptation needed - return as-is
  return contract;
}

/**
 * Build trade input structure
 *
 * Builds the complete trade input structure by combining team states
 * with trade-specific data for each team.
 *
 * @param {Object} tradeInput - Trade input with teams array
 * @param {number} [_currentYear] - Current year (unused, kept for API compatibility)
 * @returns {Object} Trade input with properly structured teams
 */
export function buildTradeInput(
  tradeInput: TradeInputLike | null | undefined,
  _currentYear: number | null = null
): TradeInputLike | null | undefined {
  void _currentYear; // Unused parameter kept for API compatibility
  if (!tradeInput || !tradeInput.teams) {
    return tradeInput;
  }

  return {
    ...tradeInput,
    teams: tradeInput.teams
      .map((team) => buildTradeTeamInput(team.teamState || team, team))
      .filter((team): team is UnknownRecord => team !== null),
  };
}

/**
 * @deprecated Use buildTradeTeamInput instead
 * @see buildTradeTeamInput
 */
export const adaptTeamForValidator = buildTradeTeamInput;

/**
 * @deprecated Use buildTradeInput instead
 * @see buildTradeInput
 */
export const adaptTradeInputForValidator = buildTradeInput;

/**
 * Note: Trade bonus extraction removed.
 * Validators read directly from contract.salariesByYear[].tradeBonus
 * using their own utilities.
 */
