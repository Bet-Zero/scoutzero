/**
 * Wave 25 Step 1: Private types, constants, and utility functions extracted from
 * normalizeWorldEventsForTeamHistory.ts (lines 1–565).
 */

export type GenericRecord = Record<string, unknown>;

export type DisplaySection = {
  title: string;
  lines: string[];
};

type MutationDisplayConfig = {
  category: string;
  type: string;
};

export const MUTATION_DISPLAY_CONFIG: Record<string, MutationDisplayConfig> = {
  executeTrade: { category: 'trade', type: 'Trade Executed' },
  signFreeAgent: { category: 'free-agency', type: 'Signed Free Agent' },
  signAndTrade: { category: 'trade', type: 'Sign-and-Trade Executed' },
  storeOfferSheet: { category: 'offer-sheet', type: 'Offer Sheet Stored' },
  matchOfferSheet: { category: 'offer-sheet', type: 'Offer Sheet Matched' },
  declineOfferSheet: { category: 'offer-sheet', type: 'Offer Sheet Declined' },
  finalizeMatchedOfferSheet: { category: 'offer-sheet', type: 'Offer Sheet Finalized (Matched)' },
  finalizeDeclinedOfferSheet: { category: 'offer-sheet', type: 'Offer Sheet Finalized (Declined)' },
  waivePlayer: { category: 'cap-transaction', type: 'Waive Player' },
  waiveAndStretch: { category: 'cap-transaction', type: 'Waive & Stretch' },
  buyoutPlayer: { category: 'cap-transaction', type: 'Buyout Player' },
  extendPlayer: { category: 'contract', type: 'Extension Signed' },
  optionDecision: { category: 'contract', type: 'Option Decision' },
  renounceRights: { category: 'free-agency', type: 'Rights Renounced' },
  setExceptions: { category: 'entitlements', type: 'Exceptions Updated' },
  useException: { category: 'entitlements', type: 'Exception Used' },
  createTradeException: { category: 'entitlements', type: 'TPE Created' },
  useTradeException: { category: 'entitlements', type: 'TPE Used' },
  setDeadCap: { category: 'cap-transaction', type: 'Dead Cap Updated' },
};

export const PIPELINE_CATEGORY_DISPLAY_MAP: Record<string, string> = {
  trade: 'trade',
  signing: 'free-agency',
  waive: 'cap-transaction',
  renounce: 'free-agency',
  unknown: 'world-event',
};

export type TeamHistoryWorldEventRow = {
  id: string;
  category: string;
  type: string;
  timestamp: string | null;
  occurredAt: string | null;
  teamCodes: string[];
  teamsInvolved: string[];
  playerIds: string[];
  primaryDeltas: string;
  capDelta: number | null;
  summary: string;
  detailSections: DisplaySection[];
  eventId: string | null;
  operationId: string | null;
  mutationType: string | null;
  beforeTotalsByTeam: GenericRecord;
  afterTotalsByTeam: GenericRecord;
  raw: GenericRecord;
};

export type TeamHistoryEventDisplayOptions = {
  teamCode?: string | null;
  teamNameLookup?: Record<string, string>;
  playerNameLookup?: Record<string, string>;
};

export function asObject(input: unknown): GenericRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as GenericRecord;
}

export function toArrayOfStrings(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

export function uniqueStrings(input: unknown[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  input.forEach((value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    values.push(normalized);
  });

  return values;
}

export function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function hasEntries(input: GenericRecord): boolean {
  return Object.keys(input).length > 0;
}

export function pushSection(
  sections: DisplaySection[],
  title: string,
  lines: (string | null | undefined)[]
) {
  const cleaned = lines
    .map((line) => String(line || '').trim())
    .filter(Boolean);
  if (cleaned.length > 0) {
    sections.push({ title, lines: cleaned });
  }
}

export function formatCurrency(value: unknown): string | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return `$${numericValue.toLocaleString()}`;
}

export function formatRightOfFirstRefusal(value: string): string {
  switch (value) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'not-applicable':
      return 'Not applicable';
    default:
      return value;
  }
}

export function formatSignedCurrency(value: number): string {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}$${Math.abs(value).toLocaleString()}`;
}

export function toIsoString(input: unknown): string | null {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    const millis = Date.parse(input);
    return Number.isFinite(millis) ? new Date(millis).toISOString() : input;
  }

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString();
  }

  const maybeTimestamp = input as { toDate?: () => Date };
  if (typeof maybeTimestamp?.toDate === 'function') {
    const dateValue = maybeTimestamp.toDate();
    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      return dateValue.toISOString();
    }
  }

  return null;
}

export function humanizeMutationType(mutationType: string): string {
  return mutationType
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeMutationType(value: string): string {
  if (value === 'setException') {
    return 'setExceptions';
  }
  return value;
}

export function formatMutationLabel(mutationType: string): string {
  return (
    MUTATION_DISPLAY_CONFIG[mutationType]?.type ||
    humanizeMutationType(mutationType)
  );
}

export function normalizeComparisonValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isGenericSummary(
  summary: string | null,
  mutationType: string,
  displayType: string
): boolean {
  if (!summary) {
    return true;
  }

  const normalizedSummary = normalizeComparisonValue(summary);
  return (
    normalizedSummary === normalizeComparisonValue(displayType) ||
    normalizedSummary === normalizeComparisonValue(mutationType)
  );
}

export function resolveDisplayCategory(
  raw: GenericRecord,
  mutationMetadata: GenericRecord,
  mutationType: string
): string {
  const rawCategory = firstNonEmptyString(raw.category);
  if (rawCategory) {
    return rawCategory;
  }

  const explicitCategory = MUTATION_DISPLAY_CONFIG[mutationType]?.category;
  if (explicitCategory) {
    return explicitCategory;
  }

  const metadataCategory = firstNonEmptyString(mutationMetadata.category);
  if (metadataCategory) {
    return PIPELINE_CATEGORY_DISPLAY_MAP[metadataCategory] || metadataCategory;
  }

  return 'world-event';
}

export function formatTeamLabel(
  teamCode: string,
  teamNameLookup?: Record<string, string>
): string {
  if (!teamCode) {
    return '';
  }
  const teamName = teamNameLookup?.[teamCode];
  return teamName || teamCode;
}

export function formatPlayerLabel(
  playerToken: string,
  playerNameLookup?: Record<string, string>
): string {
  if (!playerToken) {
    return '';
  }
  // Owner-facing copy: show the display name alone when it is known; callers
  // that render normal mode provide the player-name lookup.
  const playerName = playerNameLookup?.[playerToken];
  return playerName || playerToken;
}

export function readTeamCapDelta(
  beforeTotalsByTeam: GenericRecord,
  afterTotalsByTeam: GenericRecord,
  teamCode: string
): number | null {
  if (!teamCode) {
    return null;
  }

  const before = asObject(beforeTotalsByTeam[teamCode]);
  const after = asObject(afterTotalsByTeam[teamCode]);
  const beforeValue = Number(before.teamSalary);
  const afterValue = Number(after.teamSalary);

  if (!Number.isFinite(beforeValue) || !Number.isFinite(afterValue)) {
    return null;
  }

  return afterValue - beforeValue;
}

export function buildCapDeltaContext({
  beforeTotalsByTeam,
  afterTotalsByTeam,
  teamsInvolved,
  activeTeamCode,
  teamNameLookup,
}: {
  beforeTotalsByTeam: GenericRecord;
  afterTotalsByTeam: GenericRecord;
  teamsInvolved: string[];
  activeTeamCode: string | null;
  teamNameLookup?: Record<string, string>;
}): {
  capDelta: number | null;
  lines: string[];
} {
  const orderedTeamCodes = uniqueStrings([
    activeTeamCode || '',
    ...teamsInvolved,
    ...Object.keys(beforeTotalsByTeam),
    ...Object.keys(afterTotalsByTeam),
  ]);

  const bookFields = [
    ['teamSalary', 'Team Salary'],
    ['apronTeamSalary', 'Apron Team Salary'],
    ['taxSalary', 'Tax Salary'],
  ] as const;
  const deltaLines = orderedTeamCodes
    .flatMap((teamCode) => bookFields.map(([field, label]) => {
      const before = Number(asObject(beforeTotalsByTeam[teamCode])[field]);
      const after = Number(asObject(afterTotalsByTeam[teamCode])[field]);
      if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
      const delta = after - before;
      return {
        teamCode,
        field,
        delta,
        line: `${formatTeamLabel(teamCode, teamNameLookup)} ${label}: ${formatSignedCurrency(delta)}`,
      };
    }))
    .filter(
      (
        value
      ): value is {
        teamCode: string;
        field: (typeof bookFields)[number][0];
        delta: number;
        line: string;
      } => Boolean(value)
    );

  const activeTeamDelta =
    activeTeamCode &&
    deltaLines.find(
      (value) => value.teamCode === activeTeamCode && value.field === 'teamSalary'
    )?.delta;

  return {
    capDelta:
      typeof activeTeamDelta === 'number'
        ? activeTeamDelta
        : deltaLines.find((value) => value.field === 'teamSalary')?.delta ?? null,
    lines: deltaLines.map((value) => value.line),
  };
}

export function deriveTradePickLines(metadata: GenericRecord): string[] {
  const picksTraded = toArrayOfStrings(metadata.picksTraded);
  if (picksTraded.length > 0) {
    return picksTraded;
  }

  const legacyEntitlementsTraded = toArrayOfStrings(metadata.entitlementsTraded);
  if (legacyEntitlementsTraded.length > 0) {
    return legacyEntitlementsTraded;
  }

  const entitlementsTraded = asObject(metadata.entitlementsTraded);
  const lines: string[] = [];

  Object.entries(entitlementsTraded).forEach(([teamCode, transfer]) => {
    const transferObject = asObject(transfer);
    const outgoing = toArrayOfStrings(transferObject.out);
    const incoming = toArrayOfStrings(transferObject.in);

    if (outgoing.length > 0) {
      lines.push(`${teamCode}: out ${outgoing.join(', ')}`);
    }
    if (incoming.length > 0) {
      lines.push(`${teamCode}: in ${incoming.join(', ')}`);
    }
  });

  return lines;
}

export function isGenericChangePlaceholder(
  mutationType: string,
  line: string | null | undefined
): boolean {
  const normalized = String(line || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (mutationType === 'setExceptions') {
    return normalized === 'exceptions updated';
  }

  if (mutationType === 'setDeadCap') {
    return normalized === 'dead cap updated';
  }

  return false;
}

export function buildSpecificChangeLines(
  mutationType: string,
  lines: string[],
  emptyMessage: string
): string[] {
  const cleaned = uniqueStrings(lines).filter(
    (line) => !isGenericChangePlaceholder(mutationType, line)
  );
  return cleaned.length > 0 ? cleaned : [emptyMessage];
}

export function getFirstSpecificChangeLine(
  mutationType: string,
  lines: string[]
): string | null {
  return (
    uniqueStrings(lines).find(
      (line) => !isGenericChangePlaceholder(mutationType, line)
    ) || null
  );
}

export function resolveContractSummary(
  mutationMetadata: GenericRecord,
  metadata: GenericRecord
): GenericRecord {
  const mutationContractSummary = asObject(mutationMetadata.contractSummary);
  if (hasEntries(mutationContractSummary)) {
    return mutationContractSummary;
  }

  const mutationContract = asObject(mutationMetadata.contract);
  if (hasEntries(mutationContract)) {
    return mutationContract;
  }

  const contract = asObject(metadata.contract);
  const extensionTerms = asObject(metadata.extensionTerms);
  const contractYears = Number(
    contract.years ||
      contract.contractYears ||
      contract.contractLength ||
      metadata.extensionYears ||
      extensionTerms.years ||
      extensionTerms.contractYears
  );
  const salariesByYear = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear
    : Array.isArray(extensionTerms.salariesByYear)
      ? extensionTerms.salariesByYear
      : [];
  const firstSalaryRow = asObject(salariesByYear[0]);
  const lastSalaryRow = asObject(salariesByYear[salariesByYear.length - 1]);
  const firstYearSalary = Number(
    contract.firstYearSalary ||
      contract.year1Salary ||
      extensionTerms.firstYearSalary ||
      firstSalaryRow.salary ||
      firstSalaryRow.capHit
  );
  const totalValueFromRows = salariesByYear.reduce((sum, row) => {
    const rowObject = asObject(row);
    return sum + (Number(rowObject.salary || rowObject.capHit) || 0);
  }, 0);
  const totalValue = Number(contract.totalValue || metadata.contractValue);

  const resolved = {
    years: Number.isFinite(contractYears) && contractYears > 0 ? contractYears : undefined,
    firstYearSalary:
      Number.isFinite(firstYearSalary) && firstYearSalary > 0
        ? firstYearSalary
        : undefined,
    totalValue:
      Number.isFinite(totalValue) && totalValue > 0
        ? totalValue
        : Number.isFinite(totalValueFromRows) && totalValueFromRows > 0
          ? totalValueFromRows
          : undefined,
    startYear: firstNonEmptyString(firstSalaryRow.season),
    endYear: firstNonEmptyString(lastSalaryRow.season),
  };

  return Object.fromEntries(
    Object.entries(resolved).filter(([, value]) => value != null)
  );
}

export function buildContractLines(contractSummary: GenericRecord): string[] {
  const years = Number(contractSummary.years);
  const firstYearSalary = formatCurrency(contractSummary.firstYearSalary);
  const totalValue = formatCurrency(contractSummary.totalValue);
  const startYear = firstNonEmptyString(contractSummary.startYear);
  const endYear = firstNonEmptyString(contractSummary.endYear);

  return [
    Number.isFinite(years) && years > 0 ? `Years: ${years}` : null,
    firstYearSalary ? `First year salary: ${firstYearSalary}` : null,
    totalValue ? `Total value: ${totalValue}` : null,
    startYear && endYear && startYear !== endYear
      ? `Seasons: ${startYear} → ${endYear}`
      : startYear
        ? `Season: ${startYear}`
        : null,
  ].filter((line): line is string => Boolean(line));
}

export function buildFallbackEventId(
  mutationType: string,
  occurredAt: string | null,
  timestamp: string | null,
  teamsInvolved: string[]
): string {
  const dateToken = occurredAt || timestamp || 'undated';
  const teamToken = teamsInvolved.length > 0 ? teamsInvolved.join('-') : 'teamless';
  return `world-event-${mutationType}-${dateToken}-${teamToken}`;
}

export function resolveSummary(
  displayType: string,
  summaryCandidate: string | null,
  fallbackAvailable: boolean
) {
  if (summaryCandidate) {
    return summaryCandidate;
  }
  if (!fallbackAvailable) {
    return `${displayType} (details unavailable)`;
  }
  return displayType;
}
