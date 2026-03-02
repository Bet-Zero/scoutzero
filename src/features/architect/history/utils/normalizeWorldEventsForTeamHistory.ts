type GenericRecord = Record<string, unknown>;

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
  eventId: string | null;
  operationId: string | null;
  mutationType: string | null;
  beforeTotalsByTeam: GenericRecord;
  afterTotalsByTeam: GenericRecord;
  raw: GenericRecord;
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
    waiveAndStretch: 'Waive & Stretch',
    buyoutPlayer: 'Buyout',
    extendPlayer: 'Extension Signed',
    renounceRights: 'Rights Renounced',
    optionDecision: 'Option Decision',
    storeOfferSheet: 'Offer Sheet Stored',
    matchOfferSheet: 'Offer Sheet Matched',
    declineOfferSheet: 'Offer Sheet Declined',
    finalizeMatchedOfferSheet: 'Offer Sheet Finalized (Matched)',
    finalizeDeclinedOfferSheet: 'Offer Sheet Finalized (Declined)',
    setException: 'Exception Updated',
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

export function normalizeWorldEventsForTeamHistory(
  rawEvents: GenericRecord[],
  activeTeamCode?: string | null
): TeamHistoryWorldEventRow[] {
  const normalizedTeamCode = activeTeamCode
    ? String(activeTeamCode).trim()
    : null;

  const rows = (Array.isArray(rawEvents) ? rawEvents : []).map(
    (rawInput, index) => {
      const raw = asObject(rawInput);
      const metadata = asObject(raw.metadata);
      const mutationTypeRaw =
        (typeof raw.mutationType === 'string' && raw.mutationType) ||
        (typeof raw.type === 'string' && raw.type) ||
        'unknown';
      const mutationType = String(mutationTypeRaw);

      const teamCodes = toArrayOfStrings(raw.teamCodes);
      const teamsAffected = toArrayOfStrings(raw.teamsAffected);
      const teamsInvolved = teamCodes.length > 0 ? teamCodes : teamsAffected;

      const playerIds =
        toArrayOfStrings(raw.playerIds).length > 0
          ? toArrayOfStrings(raw.playerIds)
          : toArrayOfStrings(metadata.playerIds).length > 0
            ? toArrayOfStrings(metadata.playerIds)
            : toArrayOfStrings(metadata.playersTraded);

      const occurredAt =
        toIsoString(raw.occurredAt) || toIsoString(raw.timestamp);
      const timestamp = toIsoString(raw.timestamp) || occurredAt;

      const beforeTotalsByTeam = asObject(raw.beforeTotalsByTeam);
      const afterTotalsByTeam = asObject(raw.afterTotalsByTeam);
      const capDelta = readCapDelta(
        beforeTotalsByTeam,
        afterTotalsByTeam,
        teamsInvolved,
        normalizedTeamCode
      );

      const eventId =
        (typeof raw.eventId === 'string' && raw.eventId) ||
        (typeof raw.id === 'string' && raw.id) ||
        null;

      const type = formatMutationLabel(mutationType);

      return {
        id: eventId || `world-event-${index}`,
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
        summary: buildSummary({
          mutationType,
          teamCodes: teamsInvolved,
          activeTeamCode: normalizedTeamCode,
          playerIds,
          metadata,
        }),
        eventId,
        operationId:
          (typeof raw.operationId === 'string' && raw.operationId) || null,
        mutationType,
        beforeTotalsByTeam,
        afterTotalsByTeam,
        raw,
      };
    }
  );

  return rows.sort((a, b) => {
    const aTime = Date.parse(String(a.occurredAt || a.timestamp || ''));
    const bTime = Date.parse(String(b.occurredAt || b.timestamp || ''));
    const safeA = Number.isFinite(aTime) ? aTime : 0;
    const safeB = Number.isFinite(bTime) ? bTime : 0;
    return safeB - safeA;
  });
}
