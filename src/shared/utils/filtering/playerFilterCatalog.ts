/**
 * FILE: src/shared/utils/filtering/playerFilterCatalog.ts
 * PURPOSE: Single source of truth for filter/sort wiring documentation.
 *          Used by contract tests and dev diagnostics to detect unwired filters.
 *
 * OWNERSHIP: Feature: table/filtering
 *
 * HISTORY:
 *  - 2026-02-01: Created for Phase 2S Filter Wiring Contract
 *
 * LINKS:
 *  - Master Audit: docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md
 *  - Return Package: return_packages/scouting/PHASE_2S_FILTER_WIRING_CONTRACT.md
 */

export interface FilterCatalogEntry {
  /** The filter key from playerFilterDefaults */
  key: string;
  /** Human-readable label for the filter */
  label: string;
  /** Filter type: 'string' | 'number' | 'boolean' | 'array' | 'range' */
  type: 'string' | 'number' | 'boolean' | 'array' | 'range' | 'nested';
  /** UI component(s) that set this filter */
  uiSources: string[];
  /** File path containing the predicate logic */
  predicateFile: string;
  /** Function name or line range of the predicate */
  predicateLocation: string;
  /** Player field path(s) the predicate reads */
  playerFieldPaths: string[];
  /** Known valid values (for enumerated types) */
  valueDomain?: string[] | number[];
  /** Notes about normalization or mapping */
  notes?: string;
  /** Whether this filter is currently wired and working */
  status: 'wired' | 'broken' | 'deprecated';
}

/**
 * Complete catalog of all player filters.
 * This is the single source of truth for filter wiring.
 */
export const PLAYER_FILTER_CATALOG: FilterCatalogEntry[] = [
  // ===== BASIC FILTERS =====
  {
    key: 'nameSearch',
    label: 'Name Search',
    type: 'string',
    uiSources: ['PlayerTableHeader/index.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L38-46',
    playerFieldPaths: ['bio.displayName', 'bio.name'],
    notes: 'Case-insensitive substring match',
    status: 'wired',
  },
  {
    key: 'team',
    label: 'Team',
    type: 'string',
    uiSources: ['TopControlsBar.tsx', 'MetadataFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L49-61',
    playerFieldPaths: ['bio.display.teamId'],
    notes:
      'Expects 3-letter team code (e.g., "BOS"). Slug mapping handled in predicate.',
    status: 'wired',
  },
  {
    key: 'position',
    label: 'Position',
    type: 'string',
    uiSources: ['TopControlsBar.tsx', 'MetadataFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L63-65',
    playerFieldPaths: ['formattedPosition'],
    valueDomain: ['Guard', 'Wing', 'Forward', 'Big', 'Center'],
    notes: 'Uses expandPositionGroup for group matching',
    status: 'wired',
  },
  {
    key: 'showFreeAgents',
    label: 'Show Free Agents',
    type: 'boolean',
    uiSources: ['MetadataFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L34-41',
    playerFieldPaths: ['bio.display.teamId', 'bio.display.team'],
    notes:
      'When false, excludes players with teamId="FREE" or team="Free Agent"',
    status: 'wired',
  },

  // ===== PHYSICAL FILTERS =====
  {
    key: 'minHeight',
    label: 'Min Height',
    type: 'number',
    uiSources: ['PhysicalFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L67-72',
    playerFieldPaths: ['heightInInches'],
    notes: 'Height in inches',
    status: 'wired',
  },
  {
    key: 'maxHeight',
    label: 'Max Height',
    type: 'number',
    uiSources: ['PhysicalFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L67-72',
    playerFieldPaths: ['heightInInches'],
    notes: 'null means no max',
    status: 'wired',
  },
  {
    key: 'minWeight',
    label: 'Min Weight',
    type: 'number',
    uiSources: ['PhysicalFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L74-79',
    playerFieldPaths: ['weight'],
    notes: 'Weight in lbs',
    status: 'wired',
  },
  {
    key: 'maxWeight',
    label: 'Max Weight',
    type: 'number',
    uiSources: ['PhysicalFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L74-79',
    playerFieldPaths: ['weight'],
    status: 'wired',
  },
  {
    key: 'minAge',
    label: 'Min Age',
    type: 'number',
    uiSources: ['PhysicalFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L81-86',
    playerFieldPaths: ['age'],
    status: 'wired',
  },
  {
    key: 'maxAge',
    label: 'Max Age',
    type: 'number',
    uiSources: ['PhysicalFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L81-86',
    playerFieldPaths: ['age'],
    status: 'wired',
  },

  // ===== CONTRACT FILTERS =====
  {
    key: 'minSalary',
    label: 'Min Salary',
    type: 'number',
    uiSources: ['ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L88-102',
    playerFieldPaths: ['salaryByYear'],
    notes: 'In millions. Uses salaryYear filter for year context.',
    status: 'wired',
  },
  {
    key: 'maxSalary',
    label: 'Max Salary',
    type: 'number',
    uiSources: ['ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L88-102',
    playerFieldPaths: ['salaryByYear'],
    notes: 'In millions. Uses salaryYear filter for year context.',
    status: 'wired',
  },
  {
    key: 'salaryYear',
    label: 'Salary Year',
    type: 'number',
    uiSources: ['TopControlsBar.tsx', 'ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L88-102 (used as context)',
    playerFieldPaths: [],
    notes: 'Context for salary/option filters, not a predicate itself',
    status: 'wired',
  },
  {
    key: 'includeMissingSalary',
    label: 'Include Missing Salary',
    type: 'boolean',
    uiSources: ['ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L95-96',
    playerFieldPaths: [],
    notes: 'When salary filter active: true=include unknown, false=exclude',
    status: 'wired',
  },
  {
    key: 'freeAgentYear',
    label: 'Free Agent Year',
    type: 'string',
    uiSources: ['ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L104-112',
    playerFieldPaths: ['freeAgentYear'],
    valueDomain: [
      '2025',
      '2026',
      '2027',
      '2028',
      '2029',
      '2030',
      '2031',
      '2032',
    ],
    notes:
      'Stored as string, compared with parseInt. Field from enrichPlayerData.',
    status: 'wired',
  },
  {
    key: 'freeAgentType',
    label: 'Free Agent Type',
    type: 'string',
    uiSources: ['ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L114-116',
    playerFieldPaths: ['freeAgentType'],
    valueDomain: ['UFA', 'RFA', 'TWO_WAY', 'SFA', 'NONE'],
    notes:
      'Normalized by enrichPlayerData from currentContractView or bio.display',
    status: 'wired',
  },
  {
    key: 'birdRights',
    label: 'Bird Rights',
    type: 'string',
    uiSources: ['ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L118-120',
    playerFieldPaths: ['birdRightsStatus'],
    valueDomain: ['None', 'Non-Bird', 'Early Bird', 'Bird', 'Two-Way'],
    notes: 'Uses birdRightsStatus (normalized string) not birdRights (object)',
    status: 'wired',
  },
  {
    key: 'optionTypes',
    label: 'Option Types',
    type: 'array',
    uiSources: ['ContractFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L130-135',
    playerFieldPaths: ['optionByYear'],
    valueDomain: ['PO', 'TO', 'ETO'],
    notes: 'Year-specific. Uses salaryYear filter for context.',
    status: 'wired',
  },

  // ===== EVALUATION FILTERS =====
  {
    key: 'min_overall_grade',
    label: 'Min Overall Grade',
    type: 'number',
    uiSources: ['OverallGradeFilter.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L122-136',
    playerFieldPaths: ['overallGrade'],
    notes: 'Excludes players without grade when filter is active',
    status: 'wired',
  },
  {
    key: 'max_overall_grade',
    label: 'Max Overall Grade',
    type: 'number',
    uiSources: ['OverallGradeFilter.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L122-136',
    playerFieldPaths: ['overallGrade'],
    status: 'wired',
  },
  {
    key: 'offenseRole',
    label: 'Offense Role',
    type: 'string',
    uiSources: ['TopControlsBar.tsx', 'RoleFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L138-147',
    playerFieldPaths: ['offenseRole', 'primaryEvaluation.roles.offense2'],
    notes: 'Case-insensitive includes match on primary or secondary role',
    status: 'wired',
  },
  {
    key: 'defenseRole',
    label: 'Defense Role',
    type: 'string',
    uiSources: ['TopControlsBar.tsx', 'RoleFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L149-158',
    playerFieldPaths: ['defenseRole', 'primaryEvaluation.roles.defense2'],
    notes: 'Case-insensitive includes match on primary or secondary role',
    status: 'wired',
  },
  {
    key: 'shootingProfile',
    label: 'Shooting Profile',
    type: 'string',
    uiSources: ['TopControlsBar.tsx', 'RoleFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L160-164',
    playerFieldPaths: ['shootingProfile'],
    valueDomain: ['Elite', 'Plus', 'Capable', 'Willing', 'Hesitant', 'Non'],
    status: 'wired',
  },
  {
    key: 'subRoles',
    label: 'Sub-Roles',
    type: 'nested',
    uiSources: ['RoleFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L166-181',
    playerFieldPaths: ['subRoles.offense', 'subRoles.defense'],
    notes: 'Nested object with offense and defense arrays. Uses "every" match.',
    status: 'wired',
  },
  {
    key: 'badges',
    label: 'Badges',
    type: 'array',
    uiSources: ['BadgeFilters.tsx'],
    predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
    predicateLocation: 'filterPlayers L245-249',
    playerFieldPaths: ['badges'],
    notes: 'Uses "every" match with null guard',
    status: 'wired',
  },

  // ===== STAT FILTERS =====
  ...generateStatFilters(),

  // ===== TRAIT FILTERS =====
  ...generateTraitFilters(),
];

/**
 * Generate stat filter entries dynamically
 */
function generateStatFilters(): FilterCatalogEntry[] {
  const statMappings = [
    { key: 'PPG', field: 'PTS', label: 'Points Per Game' },
    { key: 'RPG', field: 'REB', label: 'Rebounds Per Game' },
    { key: 'APG', field: 'AST', label: 'Assists Per Game' },
    { key: 'FGP', field: 'FG%', label: 'Field Goal %' },
    { key: 'TPP', field: '3PT%', label: 'Three Point %' },
    { key: 'FTP', field: 'FT%', label: 'Free Throw %' },
    { key: 'eFGP', field: 'eFG%', label: 'Effective FG %' },
    { key: 'MIN', field: 'MIN', label: 'Minutes Per Game' },
    { key: 'G', field: 'GP', label: 'Games Played' },
  ];

  const entries: FilterCatalogEntry[] = [];

  for (const stat of statMappings) {
    entries.push({
      key: `min_${stat.key}`,
      label: `Min ${stat.label}`,
      type: 'number',
      uiSources: ['StatFilters.tsx'],
      predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
      predicateLocation: 'filterPlayers passesStat L207-223',
      playerFieldPaths: [stat.field],
      notes: stat.key.endsWith('P')
        ? 'Percentage stats stored as decimal, multiplied by 100'
        : undefined,
      status: 'wired',
    });
    entries.push({
      key: `max_${stat.key}`,
      label: `Max ${stat.label}`,
      type: 'number',
      uiSources: ['StatFilters.tsx'],
      predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
      predicateLocation: 'filterPlayers passesStat L207-223',
      playerFieldPaths: [stat.field],
      status: 'wired',
    });
  }

  return entries;
}

/**
 * Generate trait filter entries dynamically
 */
function generateTraitFilters(): FilterCatalogEntry[] {
  const traits = [
    'Defense',
    'Energy',
    'Feel',
    'IQ',
    'Passing',
    'Playmaking',
    'Rebounding',
    'Shooting',
  ];
  const entries: FilterCatalogEntry[] = [];

  for (const trait of traits) {
    entries.push({
      key: `min_${trait}`,
      label: `Min ${trait}`,
      type: 'number',
      uiSources: ['TraitFilters.tsx'],
      predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
      predicateLocation: 'filterPlayers passesTrait L225-243',
      playerFieldPaths: [`traits.${trait}`],
      status: 'wired',
    });
    entries.push({
      key: `max_${trait}`,
      label: `Max ${trait}`,
      type: 'number',
      uiSources: ['TraitFilters.tsx'],
      predicateFile: 'src/shared/utils/filtering/playerFilterUtils.ts',
      predicateLocation: 'filterPlayers passesTrait L225-243',
      playerFieldPaths: [`traits.${trait}`],
      status: 'wired',
    });
  }

  return entries;
}

/**
 * Get all filter keys from the catalog
 */
export function getCatalogFilterKeys(): string[] {
  return PLAYER_FILTER_CATALOG.map((entry) => entry.key);
}

/**
 * Get all player field paths that filters depend on
 */
export function getRequiredPlayerFields(): string[] {
  const fields = new Set<string>();
  for (const entry of PLAYER_FILTER_CATALOG) {
    for (const path of entry.playerFieldPaths) {
      fields.add(path);
    }
  }
  return Array.from(fields);
}

/**
 * Validate that a player object has all required fields
 * Returns array of missing field paths
 */
export function validatePlayerFields(
  player: Record<string, unknown>
): string[] {
  const missing: string[] = [];
  const requiredFields = getRequiredPlayerFields();

  for (const fieldPath of requiredFields) {
    if (!fieldPath) continue; // Skip empty paths (like salaryYear context)

    const value = getNestedValue(player, fieldPath);
    // Only flag as missing if it's explicitly undefined (not null or 0)
    if (value === undefined) {
      missing.push(fieldPath);
    }
  }

  return missing;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Get filter entries by status
 */
export function getFiltersByStatus(
  status: 'wired' | 'broken' | 'deprecated'
): FilterCatalogEntry[] {
  return PLAYER_FILTER_CATALOG.filter((entry) => entry.status === status);
}

/**
 * Get entry by filter key
 */
export function getFilterEntry(key: string): FilterCatalogEntry | undefined {
  return PLAYER_FILTER_CATALOG.find((entry) => entry.key === key);
}

