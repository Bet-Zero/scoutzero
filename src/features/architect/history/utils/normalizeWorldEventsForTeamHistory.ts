type GenericRecord = Record<string, unknown>;

type DisplaySection = {
  title: string;
  lines: string[];
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

function inferCategory(mutationType: string): string {
  const normalized = mutationType.toLowerCase();
  if (normalized.includes('trade')) {
    return 'trade';
  }
  if (normalized.includes('waive') || normalized.includes('buyout')) {
    return 'cap-transaction';
  }
  if (
    normalized.includes('exception') ||
    normalized.includes('mle') ||
    normalized.includes('tpe')
  ) {
    return 'entitlements';
  }
  if (normalized.includes('pick') || normalized.includes('draft')) {
    return 'draft';
  }
  if (
    normalized.includes('sign') ||
    normalized.includes('offer') ||
    normalized.includes('renounce')
  ) {
    return 'free-agency';
  }
  return 'world-event';
}

function formatMutationLabel(mutationType: string): string {
  const labels: Record<string, string> = {
    executeTrade: 'Trade Executed',
    signFreeAgent: 'Signed Free Agent',
    signAndTrade: 'Sign-and-Trade Executed',
    waivePlayer: 'Waive Player',
    extendPlayer: 'Extension Signed',
    renounceRights: 'Rights Renounced',
    optionDecision: 'Option Decision',
    storeOfferSheet: 'Offer Sheet Stored',
    matchOfferSheet: 'Offer Sheet Matched',
    declineOfferSheet: 'Offer Sheet Declined',
    finalizeMatchedOfferSheet: 'Offer Sheet Finalized (Matched)',
    finalizeDeclinedOfferSheet: 'Offer Sheet Finalized (Declined)',
    setExceptions: 'Exceptions Updated',
    setException: 'Exceptions Updated',
    setDeadCap: 'Dead Cap Updated',
    useException: 'Exception Used',
    createTradeException: 'TPE Created',
    useTradeException: 'TPE Used',
  };

  if (labels[mutationType]) {
    return labels[mutationType];
  }

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

function resolveSummary(
  mutationType: string,
  summaryCandidate: string | null,
  fallbackAvailable: boolean
) {
  if (summaryCandidate) {
    return summaryCandidate;
  }
  if (!fallbackAvailable) {
    return `${formatMutationLabel(mutationType)} (details unavailable)`;
  }
  return formatMutationLabel(mutationType);
}

function buildSummary({
  mutationType,
  teamCodes,
  activeTeamCode,
  playerIds,
  metadata,
}: {
  mutationType: string;
  teamCodes: string[];
  activeTeamCode: string | null;
  playerIds: string[];
  metadata: GenericRecord;
}): string {
  const metadataSummary =
    typeof metadata.summary === 'string' && metadata.summary.trim()
      ? metadata.summary.trim()
      : null;
  if (metadataSummary) {
    return metadataSummary;
  }

  const counterpart =
    teamCodes.find((code) => code && code !== activeTeamCode) || null;
  const primaryPlayer =
    playerIds[0] ||
    (typeof metadata.playerId === 'string' ? metadata.playerId : null) ||
    (typeof metadata.playerName === 'string' ? metadata.playerName : null);

  switch (mutationType) {
    case 'executeTrade':
      return counterpart
        ? `Trade Executed vs ${counterpart}`
        : 'Trade Executed';
    case 'signFreeAgent':
    case 'finalizeDeclinedOfferSheet':
      return primaryPlayer
        ? `Signed FA: ${primaryPlayer}`
        : 'Signed Free Agent';
    case 'signAndTrade':
      return counterpart
        ? `Sign-and-Trade Executed vs ${counterpart}`
        : 'Sign-and-Trade Executed';
    case 'waivePlayer':
      return primaryPlayer ? `Waived: ${primaryPlayer}` : 'Waive Processed';
    case 'waiveAndStretch':
      return primaryPlayer
        ? `Waive & Stretch: ${primaryPlayer}`
        : 'Waive & Stretch Processed';
    case 'buyoutPlayer':
      return primaryPlayer ? `Buyout: ${primaryPlayer}` : 'Buyout Processed';
    default:
      return formatMutationLabel(mutationType);
  }
}

function readCapDelta(
  beforeTotalsByTeam: GenericRecord,
  afterTotalsByTeam: GenericRecord,
  teamCodes: string[],
  activeTeamCode: string | null
): number | null {
  const primaryTeam =
    (activeTeamCode && teamCodes.includes(activeTeamCode) && activeTeamCode) ||
    teamCodes[0] ||
    null;

  if (!primaryTeam) {
    return null;
  }

  const before = asObject(beforeTotalsByTeam[primaryTeam]);
  const after = asObject(afterTotalsByTeam[primaryTeam]);
  const beforeValue = Number(before.totalCapAllocations);
  const afterValue = Number(after.totalCapAllocations);

  if (!Number.isFinite(beforeValue) || !Number.isFinite(afterValue)) {
    return null;
  }

  return afterValue - beforeValue;
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
    (typeof raw.mutationType === 'string' && raw.mutationType) ||
    (typeof raw.type === 'string' && raw.type) ||
    'unknown';
  const mutationType = normalizeMutationType(String(rawMutationType));

  const teamCodes = toArrayOfStrings(raw.teamCodes);
  const teamsAffected = toArrayOfStrings(raw.teamsAffected);
  const teamsInvolved = teamCodes.length > 0 ? teamCodes : teamsAffected;

  const metadataPlayerIds = toArrayOfStrings(metadata.playerIds);
  const metadataPlayersTraded = toArrayOfStrings(metadata.playersTraded);
  const playerIds =
    toArrayOfStrings(raw.playerIds).length > 0
      ? toArrayOfStrings(raw.playerIds)
      : metadataPlayerIds.length > 0
        ? metadataPlayerIds
        : metadataPlayersTraded;

  const occurredAt = toIsoString(raw.occurredAt) || toIsoString(raw.timestamp);
  const timestamp = toIsoString(raw.timestamp) || occurredAt;

  const beforeTotalsByTeam = asObject(raw.beforeTotalsByTeam);
  const afterTotalsByTeam = asObject(raw.afterTotalsByTeam);
  const capDelta = readCapDelta(
    beforeTotalsByTeam,
    afterTotalsByTeam,
    teamsInvolved,
    teamCode ? String(teamCode).trim() : null
  );

  const eventId =
    (typeof raw.eventId === 'string' && raw.eventId) ||
    (typeof raw.id === 'string' && raw.id) ||
    null;
  const operationId =
    (typeof raw.operationId === 'string' && raw.operationId) || null;

  const detailSections: DisplaySection[] = [];

  const primaryTeamsLine =
    teamsInvolved.length > 0
      ? teamsInvolved
          .map((code) => formatTeamLabel(code, teamNameLookup))
          .filter(Boolean)
          .join(' ↔ ')
      : null;

  const metadataPlayerName =
    (typeof mutationMetadata.playerName === 'string' &&
      mutationMetadata.playerName) ||
    (typeof metadata.playerName === 'string' && metadata.playerName) ||
    null;
  const metadataPlayerId =
    (typeof mutationMetadata.playerId === 'string' &&
      mutationMetadata.playerId) ||
    (typeof metadata.playerId === 'string' && metadata.playerId) ||
    null;

  const firstPlayerToken =
    playerIds[0] || metadataPlayerId || metadataPlayerName;
  const firstPlayerLabel = firstPlayerToken
    ? formatPlayerLabel(firstPlayerToken, playerNameLookup)
    : null;

  const contract =
    asObject(mutationMetadata.contract).years ||
    asObject(mutationMetadata.contract).firstYearSalary ||
    asObject(metadata.contract).years ||
    asObject(metadata.contract).firstYearSalary
      ? asObject(mutationMetadata.contract).years ||
        asObject(mutationMetadata.contract).firstYearSalary
        ? asObject(mutationMetadata.contract)
        : asObject(metadata.contract)
      : {};

  const capDeltaLine =
    capDelta === null
      ? null
      : `Cap allocation delta: ${capDelta > 0 ? '+' : ''}$${capDelta.toLocaleString()}`;

  let summaryCandidate: string | null =
    (typeof mutationMetadata.summary === 'string' &&
      mutationMetadata.summary.trim()) ||
    (typeof metadata.summary === 'string' && metadata.summary.trim()) ||
    null;

  switch (mutationType) {
    case 'executeTrade': {
      summaryCandidate =
        summaryCandidate ||
        (primaryTeamsLine ? `Trade executed: ${primaryTeamsLine}` : null);

      const playersMoved =
        toArrayOfStrings(diffSummary.playersMoved).length > 0
          ? toArrayOfStrings(diffSummary.playersMoved)
          : playerIds;
      const picksMoved =
        toArrayOfStrings(diffSummary.picksMoved).length > 0
          ? toArrayOfStrings(diffSummary.picksMoved)
          : toArrayOfStrings(metadata.entitlementsTraded);

      pushSection(
        detailSections,
        'Players',
        playersMoved.map((player) =>
          formatPlayerLabel(player, playerNameLookup)
        )
      );
      pushSection(detailSections, 'Picks', picksMoved);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Cap Delta', [capDeltaLine]);
      break;
    }
    case 'signFreeAgent':
    case 'signAndTrade':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      const destinationTeam =
        (typeof mutationMetadata.teamCode === 'string' &&
          mutationMetadata.teamCode) ||
        (typeof metadata.teamCode === 'string' && metadata.teamCode) ||
        teamsInvolved[0] ||
        null;
      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel && destinationTeam
          ? `${formatMutationLabel(mutationType)}: ${firstPlayerLabel} → ${destinationTeam}`
          : null);

      const years = contract.years;
      const firstYearSalary = formatCurrency(contract.firstYearSalary);

      pushSection(detailSections, 'Players', [firstPlayerLabel]);
      pushSection(detailSections, 'Contract', [
        years ? `Years: ${years}` : null,
        firstYearSalary ? `First year salary: ${firstYearSalary}` : null,
      ]);
      pushSection(detailSections, 'Exceptions', [
        (typeof mutationMetadata.signedUsing === 'string' &&
          mutationMetadata.signedUsing) ||
        (typeof metadata.signedUsing === 'string' && metadata.signedUsing)
          ? `Rights/exception used: ${mutationMetadata.signedUsing || metadata.signedUsing}`
          : null,
      ]);
      pushSection(detailSections, 'Cap Delta', [capDeltaLine]);
      break;
    }
    case 'waivePlayer':
    case 'extendPlayer':
    case 'optionDecision':
    case 'renounceRights': {
      summaryCandidate =
        summaryCandidate ||
        (firstPlayerLabel
          ? `${formatMutationLabel(mutationType)}: ${firstPlayerLabel}`
          : null);

      const stretched =
        mutationMetadata.stretched === true || metadata.stretched === true;
      const deadCapAmount =
        formatCurrency(mutationMetadata.deadCapAmount) ||
        formatCurrency(metadata.deadCapAmount);
      const optionType =
        (typeof mutationMetadata.optionType === 'string' &&
          mutationMetadata.optionType) ||
        (typeof metadata.optionType === 'string' && metadata.optionType) ||
        null;
      const accepted = mutationMetadata.accepted ?? metadata.accepted;

      pushSection(detailSections, 'Players', [firstPlayerLabel]);
      pushSection(detailSections, 'Contract', [
        mutationType === 'extendPlayer' && mutationMetadata.extensionYears
          ? `Extension years: ${mutationMetadata.extensionYears}`
          : null,
        mutationType === 'optionDecision' && optionType
          ? `Option type: ${optionType}`
          : null,
        mutationType === 'optionDecision' && typeof accepted === 'boolean'
          ? `Decision: ${accepted ? 'Accepted' : 'Declined'}`
          : null,
      ]);
      pushSection(detailSections, 'Exceptions', [
        mutationType === 'waivePlayer' && stretched
          ? 'Stretch provision applied'
          : null,
        mutationType === 'waivePlayer' && deadCapAmount
          ? `Dead cap amount: ${deadCapAmount}`
          : null,
      ]);
      pushSection(detailSections, 'Cap Delta', [capDeltaLine]);
      break;
    }
    case 'setExceptions':
    case 'setDeadCap': {
      const exceptionChanges = toArrayOfStrings(diffSummary.exceptionChanges);
      const deadCapChanges = toArrayOfStrings(diffSummary.deadCapChanges);
      summaryCandidate =
        summaryCandidate ||
        (primaryTeamsLine
          ? `${formatMutationLabel(mutationType)}: ${primaryTeamsLine}`
          : null);

      pushSection(
        detailSections,
        'Exceptions',
        mutationType === 'setExceptions'
          ? [
              ...exceptionChanges,
              exceptionChanges.length === 0 ? 'Exceptions updated' : null,
            ]
          : []
      );
      pushSection(
        detailSections,
        'Contract',
        mutationType === 'setDeadCap'
          ? [
              ...deadCapChanges,
              deadCapChanges.length === 0 ? 'Dead cap updated' : null,
            ]
          : []
      );
      pushSection(detailSections, 'Cap Delta', [capDeltaLine]);
      break;
    }
    default: {
      pushSection(
        detailSections,
        'Players',
        playerIds
          .slice(0, 5)
          .map((player) => formatPlayerLabel(player, playerNameLookup))
      );
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Cap Delta', [capDeltaLine]);
      break;
    }
  }

  const hasMeaningfulDetails = detailSections.length > 0;
  const summary = resolveSummary(
    mutationType,
    summaryCandidate,
    hasMeaningfulDetails
  );
  const type = formatMutationLabel(mutationType);

  return {
    id: eventId || operationId || `world-event-${Date.now()}`,
    category:
      (typeof raw.category === 'string' && raw.category) ||
      inferCategory(mutationType),
    type,
    timestamp,
    occurredAt,
    teamCodes: teamsInvolved,
    teamsInvolved,
    playerIds,
    primaryDeltas: type,
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
