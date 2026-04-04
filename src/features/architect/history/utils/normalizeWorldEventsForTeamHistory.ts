type GenericRecord = Record<string, unknown>;

type DisplaySection = {
  title: string;
  lines: string[];
};

type MutationDisplayConfig = {
  category: string;
  type: string;
};

const MUTATION_DISPLAY_CONFIG: Record<string, MutationDisplayConfig> = {
  executeTrade: {
    category: 'trade',
    type: 'Trade Executed',
  },
  signFreeAgent: {
    category: 'free-agency',
    type: 'Signed Free Agent',
  },
  signAndTrade: {
    category: 'trade',
    type: 'Sign-and-Trade Executed',
  },
  storeOfferSheet: {
    category: 'offer-sheet',
    type: 'Offer Sheet Stored',
  },
  matchOfferSheet: {
    category: 'offer-sheet',
    type: 'Offer Sheet Matched',
  },
  declineOfferSheet: {
    category: 'offer-sheet',
    type: 'Offer Sheet Declined',
  },
  finalizeMatchedOfferSheet: {
    category: 'offer-sheet',
    type: 'Offer Sheet Finalized (Matched)',
  },
  finalizeDeclinedOfferSheet: {
    category: 'offer-sheet',
    type: 'Offer Sheet Finalized (Declined)',
  },
  waivePlayer: {
    category: 'cap-transaction',
    type: 'Waive Player',
  },
  waiveAndStretch: {
    category: 'cap-transaction',
    type: 'Waive & Stretch',
  },
  buyoutPlayer: {
    category: 'cap-transaction',
    type: 'Buyout Player',
  },
  extendPlayer: {
    category: 'contract',
    type: 'Extension Signed',
  },
  optionDecision: {
    category: 'contract',
    type: 'Option Decision',
  },
  renounceRights: {
    category: 'free-agency',
    type: 'Rights Renounced',
  },
  setExceptions: {
    category: 'entitlements',
    type: 'Exceptions Updated',
  },
  useException: {
    category: 'entitlements',
    type: 'Exception Used',
  },
  createTradeException: {
    category: 'entitlements',
    type: 'TPE Created',
  },
  useTradeException: {
    category: 'entitlements',
    type: 'TPE Used',
  },
  setDeadCap: {
    category: 'cap-transaction',
    type: 'Dead Cap Updated',
  },
};

const PIPELINE_CATEGORY_DISPLAY_MAP: Record<string, string> = {
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

function asObject(input: unknown): GenericRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as GenericRecord;
}

function toArrayOfStrings(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

function uniqueStrings(input: unknown[]): string[] {
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

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function hasEntries(input: GenericRecord): boolean {
  return Object.keys(input).length > 0;
}

function pushSection(
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

function formatCurrency(value: unknown): string | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return `$${numericValue.toLocaleString()}`;
}

function formatSignedCurrency(value: number): string {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}$${Math.abs(value).toLocaleString()}`;
}

function toIsoString(input: unknown): string | null {
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

function humanizeMutationType(mutationType: string): string {
  return mutationType
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeMutationType(value: string): string {
  if (value === 'setException') {
    return 'setExceptions';
  }
  return value;
}

function formatMutationLabel(mutationType: string): string {
  return (
    MUTATION_DISPLAY_CONFIG[mutationType]?.type ||
    humanizeMutationType(mutationType)
  );
}

function normalizeComparisonValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isGenericSummary(
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

function resolveDisplayCategory(
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

function formatTeamLabel(
  teamCode: string,
  teamNameLookup?: Record<string, string>
): string {
  if (!teamCode) {
    return '';
  }
  const teamName = teamNameLookup?.[teamCode];
  return teamName ? `${teamCode} (${teamName})` : teamCode;
}

function formatPlayerLabel(
  playerToken: string,
  playerNameLookup?: Record<string, string>
): string {
  if (!playerToken) {
    return '';
  }
  const playerName = playerNameLookup?.[playerToken];
  return playerName ? `${playerName} (${playerToken})` : playerToken;
}

function readTeamCapDelta(
  beforeTotalsByTeam: GenericRecord,
  afterTotalsByTeam: GenericRecord,
  teamCode: string
): number | null {
  if (!teamCode) {
    return null;
  }

  const before = asObject(beforeTotalsByTeam[teamCode]);
  const after = asObject(afterTotalsByTeam[teamCode]);
  const beforeValue = Number(before.totalCapAllocations);
  const afterValue = Number(after.totalCapAllocations);

  if (!Number.isFinite(beforeValue) || !Number.isFinite(afterValue)) {
    return null;
  }

  return afterValue - beforeValue;
}

function buildCapDeltaContext({
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

  const deltaLines = orderedTeamCodes
    .map((teamCode) => {
      const delta = readTeamCapDelta(beforeTotalsByTeam, afterTotalsByTeam, teamCode);
      if (delta === null) {
        return null;
      }
      return {
        teamCode,
        delta,
        line: `${formatTeamLabel(teamCode, teamNameLookup)} total cap allocations: ${formatSignedCurrency(delta)}`,
      };
    })
    .filter(
      (
        value
      ): value is {
        teamCode: string;
        delta: number;
        line: string;
      } => Boolean(value)
    );

  const activeTeamDelta =
    activeTeamCode &&
    deltaLines.find((value) => value.teamCode === activeTeamCode)?.delta;

  return {
    capDelta:
      typeof activeTeamDelta === 'number'
        ? activeTeamDelta
        : deltaLines[0]?.delta ?? null,
    lines: deltaLines.map((value) => value.line),
  };
}

function deriveTradePickLines(metadata: GenericRecord): string[] {
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

function isGenericChangePlaceholder(
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

function buildSpecificChangeLines(
  mutationType: string,
  lines: string[],
  emptyMessage: string
): string[] {
  const cleaned = uniqueStrings(lines).filter(
    (line) => !isGenericChangePlaceholder(mutationType, line)
  );
  return cleaned.length > 0 ? cleaned : [emptyMessage];
}

function getFirstSpecificChangeLine(
  mutationType: string,
  lines: string[]
): string | null {
  return (
    uniqueStrings(lines).find(
      (line) => !isGenericChangePlaceholder(mutationType, line)
    ) || null
  );
}

function resolveContractSummary(
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

function buildContractLines(contractSummary: GenericRecord): string[] {
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

function buildFallbackEventId(
  mutationType: string,
  occurredAt: string | null,
  timestamp: string | null,
  teamsInvolved: string[]
): string {
  const dateToken = occurredAt || timestamp || 'undated';
  const teamToken = teamsInvolved.length > 0 ? teamsInvolved.join('-') : 'teamless';
  return `world-event-${mutationType}-${dateToken}-${teamToken}`;
}

function resolveSummary(
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

export function toTeamHistoryEventDisplay(
  eventInput: GenericRecord,
  {
    teamCode,
    teamNameLookup,
    playerNameLookup,
  }: TeamHistoryEventDisplayOptions = {}
): TeamHistoryWorldEventRow {
  const raw = asObject(eventInput);
  const metadata = asObject(raw.metadata);
  const mutationMetadata = asObject(raw.mutationMetadata);
  const diffSummary = asObject(raw.diffSummary);

  const rawMutationType =
    firstNonEmptyString(raw.mutationType, raw.type) || 'unknown';
  const mutationType = normalizeMutationType(rawMutationType);
  const displayType = formatMutationLabel(mutationType);

  const teamCodes = uniqueStrings(toArrayOfStrings(raw.teamCodes));
  const teamsAffected = uniqueStrings(toArrayOfStrings(raw.teamsAffected));
  const teamsInvolved = teamCodes.length > 0 ? teamCodes : teamsAffected;

  const rawPlayerIds = uniqueStrings(toArrayOfStrings(raw.playerIds));
  const metadataPlayerIds = uniqueStrings(toArrayOfStrings(metadata.playerIds));
  const metadataPlayersTraded = uniqueStrings(
    toArrayOfStrings(metadata.playersTraded)
  );
  const playerIds =
    rawPlayerIds.length > 0
      ? rawPlayerIds
      : metadataPlayerIds.length > 0
        ? metadataPlayerIds
        : metadataPlayersTraded;

  const occurredAt = toIsoString(raw.occurredAt) || toIsoString(raw.timestamp);
  const timestamp = toIsoString(raw.timestamp) || occurredAt;

  const beforeTotalsByTeam = asObject(raw.beforeTotalsByTeam);
  const afterTotalsByTeam = asObject(raw.afterTotalsByTeam);
  const capDeltaContext = buildCapDeltaContext({
    beforeTotalsByTeam,
    afterTotalsByTeam,
    teamsInvolved,
    activeTeamCode: teamCode ? String(teamCode).trim() : null,
    teamNameLookup,
  });
  const capDelta = capDeltaContext.capDelta;
  const capDeltaLines = capDeltaContext.lines;

  const eventId =
    firstNonEmptyString(raw.eventId, raw.id) || null;
  const operationId = firstNonEmptyString(raw.operationId) || null;

  const detailSections: DisplaySection[] = [];

  const primaryTeamsLine =
    teamsInvolved.length > 0
      ? teamsInvolved
          .map((code) => formatTeamLabel(code, teamNameLookup))
          .filter(Boolean)
          .join(' ↔ ')
      : null;

  const metadataPlayerName = firstNonEmptyString(
    mutationMetadata.playerName,
    metadata.playerName
  );
  const metadataPlayerId = firstNonEmptyString(
    mutationMetadata.playerId,
    metadata.playerId
  );
  const fallbackPlayerToken = metadataPlayerId || metadataPlayerName;
  const displayPlayerTokens =
    playerIds.length > 0
      ? playerIds
      : fallbackPlayerToken
        ? [fallbackPlayerToken]
        : [];
  const playerLabels = uniqueStrings(displayPlayerTokens).map((playerToken) =>
    formatPlayerLabel(playerToken, playerNameLookup)
  );
  const firstPlayerLabel = playerLabels[0] || null;

  const contractSummary = resolveContractSummary(mutationMetadata, metadata);
  const contractLines = buildContractLines(contractSummary);

  const destinationTeamCode = firstNonEmptyString(
    mutationMetadata.teamCode,
    metadata.teamCode,
    teamsInvolved[0]
  );
  const destinationTeamLabel = destinationTeamCode
    ? formatTeamLabel(destinationTeamCode, teamNameLookup)
    : null;

  const signingInstrument = firstNonEmptyString(
    mutationMetadata.signedUsing,
    metadata.signedUsing
  );
  const rightsUsed = firstNonEmptyString(
    mutationMetadata.rightsUsed,
    metadata.rightsUsed
  );
  const optionType = firstNonEmptyString(
    mutationMetadata.optionType,
    metadata.optionType
  );
  const accepted =
    typeof mutationMetadata.accepted === 'boolean'
      ? mutationMetadata.accepted
      : typeof metadata.accepted === 'boolean'
        ? metadata.accepted
        : null;
  const deadCapAmount =
    formatCurrency(mutationMetadata.deadCapAmount) ||
    formatCurrency(metadata.deadCapAmount);
  const stretched =
    mutationMetadata.stretched === true || metadata.stretched === true;
  const buyout = mutationMetadata.buyout === true || metadata.buyout === true;

  const tradePlayerTokens =
    uniqueStrings(toArrayOfStrings(diffSummary.playersMoved)).length > 0
      ? uniqueStrings(toArrayOfStrings(diffSummary.playersMoved))
      : displayPlayerTokens;
  const tradePlayerLines = tradePlayerTokens.map((playerToken) =>
    formatPlayerLabel(playerToken, playerNameLookup)
  );
  const tradePickLines =
    uniqueStrings(toArrayOfStrings(diffSummary.picksMoved)).length > 0
      ? uniqueStrings(toArrayOfStrings(diffSummary.picksMoved))
      : uniqueStrings(deriveTradePickLines(metadata));

  const exceptionChangeLines = buildSpecificChangeLines(
    'setExceptions',
    [
      ...toArrayOfStrings(diffSummary.exceptionChanges),
      ...toArrayOfStrings(metadata.exceptionChanges),
    ],
    'No exception change detail was included in this event payload.'
  );
  const deadCapChangeLines = buildSpecificChangeLines(
    'setDeadCap',
    [
      ...toArrayOfStrings(diffSummary.deadCapChanges),
      ...toArrayOfStrings(metadata.deadCapChanges),
    ],
    'No dead cap change detail was included in this event payload.'
  );
  const firstSpecificExceptionChange = getFirstSpecificChangeLine(
    'setExceptions',
    [
      ...toArrayOfStrings(diffSummary.exceptionChanges),
      ...toArrayOfStrings(metadata.exceptionChanges),
    ]
  );
  const firstSpecificDeadCapChange = getFirstSpecificChangeLine(
    'setDeadCap',
    [
      ...toArrayOfStrings(diffSummary.deadCapChanges),
      ...toArrayOfStrings(metadata.deadCapChanges),
    ]
  );

  const rawSummary = firstNonEmptyString(
    mutationMetadata.summary,
    metadata.summary
  );
  let summaryCandidate =
    rawSummary && !isGenericSummary(rawSummary, mutationType, displayType)
      ? rawSummary
      : null;

  switch (mutationType) {
    case 'executeTrade': {
      summaryCandidate =
        summaryCandidate ||
        (primaryTeamsLine
          ? `${displayType}: ${primaryTeamsLine}`
          : firstPlayerLabel
            ? `${displayType}: ${firstPlayerLabel}`
            : tradePickLines[0]
              ? `${displayType}: ${tradePickLines[0]}`
              : null);

      pushSection(detailSections, 'Players', tradePlayerLines);
      pushSection(detailSections, 'Picks', tradePickLines);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'signFreeAgent': {
      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel && destinationTeamLabel
          ? `${displayType}: ${firstPlayerLabel} → ${destinationTeamLabel}`
          : firstPlayerLabel
            ? `${displayType}: ${firstPlayerLabel}`
            : destinationTeamLabel
              ? `${displayType}: ${destinationTeamLabel}`
              : null);

      pushSection(detailSections, 'Player', [firstPlayerLabel]);
      pushSection(detailSections, 'Contract', contractLines);
      pushSection(detailSections, 'Signing Context', [
        destinationTeamLabel ? `Destination team: ${destinationTeamLabel}` : null,
        signingInstrument
          ? `Rights/exception used: ${signingInstrument}`
          : null,
      ]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'signAndTrade': {
      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel && primaryTeamsLine
          ? `${displayType}: ${firstPlayerLabel} (${primaryTeamsLine})`
          : primaryTeamsLine
            ? `${displayType}: ${primaryTeamsLine}`
            : firstPlayerLabel
              ? `${displayType}: ${firstPlayerLabel}`
              : null);

      pushSection(detailSections, 'Player', [firstPlayerLabel]);
      pushSection(detailSections, 'Contract', contractLines);
      pushSection(detailSections, 'Trade Context', [
        destinationTeamLabel ? `Destination team: ${destinationTeamLabel}` : null,
        signingInstrument
          ? `Rights/exception used: ${signingInstrument}`
          : null,
      ]);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'storeOfferSheet':
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel && destinationTeamLabel
          ? `${displayType}: ${firstPlayerLabel} → ${destinationTeamLabel}`
          : firstPlayerLabel
            ? `${displayType}: ${firstPlayerLabel}`
            : primaryTeamsLine
              ? `${displayType}: ${primaryTeamsLine}`
              : null);

      pushSection(detailSections, 'Player', [firstPlayerLabel]);
      pushSection(detailSections, 'Contract', contractLines);
      pushSection(detailSections, 'Offer Sheet', [
        `Stage: ${displayType}`,
        destinationTeamLabel ? `Destination team: ${destinationTeamLabel}` : null,
        signingInstrument
          ? `Rights/exception used: ${signingInstrument}`
          : null,
      ]);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'waivePlayer':
    case 'waiveAndStretch':
    case 'buyoutPlayer': {
      const waiverModifiers = [stretched ? 'stretch' : null, buyout ? 'buyout' : null]
        .filter(Boolean)
        .join(', ');

      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel
          ? `${displayType}: ${firstPlayerLabel}${waiverModifiers ? ` (${waiverModifiers})` : ''}`
          : null);

      pushSection(detailSections, 'Player', [firstPlayerLabel]);
      pushSection(detailSections, 'Waiver', [
        stretched ? 'Stretch provision applied' : null,
        buyout ? 'Buyout recorded' : null,
        deadCapAmount ? `Dead cap amount: ${deadCapAmount}` : null,
      ]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'extendPlayer': {
      const extensionYears = Number(
        mutationMetadata.extensionYears || metadata.extensionYears
      );

      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel ? `${displayType}: ${firstPlayerLabel}` : null);

      pushSection(detailSections, 'Player', [firstPlayerLabel]);
      pushSection(detailSections, 'Extension', [
        Number.isFinite(extensionYears) && extensionYears > 0
          ? `Extension years: ${extensionYears}`
          : null,
        ...contractLines,
      ]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'optionDecision': {
      const optionDecisionLabel =
        typeof accepted === 'boolean'
          ? accepted
            ? 'accepted'
            : 'declined'
          : null;

      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel
          ? `${displayType}: ${firstPlayerLabel}${optionDecisionLabel ? ` (${optionDecisionLabel})` : ''}`
          : optionDecisionLabel
            ? `${displayType}: ${optionDecisionLabel}`
            : null);

      pushSection(detailSections, 'Player', [firstPlayerLabel]);
      pushSection(detailSections, 'Option', [
        optionType ? `Option type: ${optionType}` : null,
        typeof accepted === 'boolean'
          ? `Decision: ${accepted ? 'Accepted' : 'Declined'}`
          : null,
        ...contractLines,
      ]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'renounceRights': {
      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel
          ? `${displayType}: ${firstPlayerLabel}`
          : destinationTeamLabel
            ? `${displayType}: ${destinationTeamLabel}`
            : null);

      pushSection(detailSections, 'Player', [firstPlayerLabel]);
      pushSection(detailSections, 'Rights', [
        rightsUsed ? `Rights action: ${rightsUsed}` : null,
        destinationTeamLabel ? `Team: ${destinationTeamLabel}` : null,
      ]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'setExceptions':
    case 'useException':
    case 'createTradeException':
    case 'useTradeException': {
      summaryCandidate =
        summaryCandidate ||
        (firstSpecificExceptionChange
          ? `${displayType}: ${firstSpecificExceptionChange}`
          : primaryTeamsLine
            ? `${displayType}: ${primaryTeamsLine}`
            : `${displayType} (detail limited)`);

      pushSection(detailSections, 'Exception Changes', exceptionChangeLines);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    case 'setDeadCap': {
      summaryCandidate =
        summaryCandidate ||
        (firstSpecificDeadCapChange
          ? `${displayType}: ${firstSpecificDeadCapChange}`
          : primaryTeamsLine
            ? `${displayType}: ${primaryTeamsLine}`
            : `${displayType} (detail limited)`);

      pushSection(detailSections, 'Dead Cap Changes', deadCapChangeLines);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }

    default: {
      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel
          ? `${displayType}: ${firstPlayerLabel}`
          : primaryTeamsLine
            ? `${displayType}: ${primaryTeamsLine}`
            : `${displayType} (detail limited)`);

      pushSection(detailSections, 'Players', playerLabels.slice(0, 5));
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Event Detail', [
        mutationType === 'unknown'
          ? 'Event payload did not expose a supported mutation type for Team History normalization.'
          : `No event-specific Team History detail mapping exists for ${mutationType}.`,
      ]);
      pushSection(detailSections, 'Cap Allocation', capDeltaLines);
      break;
    }
  }

  const hasMeaningfulDetails = detailSections.length > 0;
  const summary = resolveSummary(displayType, summaryCandidate, hasMeaningfulDetails);
  const category = resolveDisplayCategory(raw, mutationMetadata, mutationType);

  return {
    id:
      eventId ||
      operationId ||
      buildFallbackEventId(mutationType, occurredAt, timestamp, teamsInvolved),
    category,
    type: displayType,
    timestamp,
    occurredAt,
    teamCodes: teamsInvolved,
    teamsInvolved,
    playerIds,
    primaryDeltas: summaryCandidate || displayType,
    capDelta,
    summary,
    detailSections,
    eventId,
    operationId,
    mutationType,
    beforeTotalsByTeam,
    afterTotalsByTeam,
    raw,
  };
}

export function normalizeWorldEventsForTeamHistory(
  rawEvents: GenericRecord[],
  activeTeamCode?: string | null
): TeamHistoryWorldEventRow[] {
  const normalizedTeamCode = activeTeamCode
    ? String(activeTeamCode).trim()
    : null;

  const rows = (Array.isArray(rawEvents) ? rawEvents : []).map((rawInput) =>
    toTeamHistoryEventDisplay(asObject(rawInput), {
      teamCode: normalizedTeamCode,
    })
  );

  return rows.sort((a, b) => {
    const aTime = Date.parse(String(a.occurredAt || a.timestamp || ''));
    const bTime = Date.parse(String(b.occurredAt || b.timestamp || ''));
    const safeA = Number.isFinite(aTime) ? aTime : 0;
    const safeB = Number.isFinite(bTime) ? bTime : 0;
    return safeB - safeA;
  });
}
