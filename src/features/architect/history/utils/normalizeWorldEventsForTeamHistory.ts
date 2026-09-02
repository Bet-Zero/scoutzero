// Wave 25 Step 1: private types, constants, and utilities extracted to submodule
export * from './normalizeWorldEventsForTeamHistory.utils';
import {
  asObject,
  buildCapDeltaContext,
  buildContractLines,
  buildFallbackEventId,
  buildSpecificChangeLines,
  deriveTradePickLines,
  expandTradePickLines,
  firstNonEmptyString,
  formatCurrency,
  formatMutationLabel,
  formatPlayerLabel,
  formatRightOfFirstRefusal,
  formatTeamLabel,
  getFirstSpecificChangeLine,
  isSafePlayerDisplayName,
  isGenericSummary,
  normalizeMutationType,
  pushSection,
  resolveContractSummary,
  resolveDisplayCategory,
  resolveSummary,
  toArrayOfStrings,
  toIsoString,
  uniqueStrings,
  type DisplaySection,
  type GenericRecord,
  type TeamHistoryEventDisplayOptions,
  type TeamHistoryWorldEventRow,
} from './normalizeWorldEventsForTeamHistory.utils';
import { GovernedSignAndTradeReceiptZ } from '@/schemas/governedSignAndTrade';
import { GovernedCashReceiptZ } from '@/schemas/governedCashConsideration';

function formatCashCents(value: number): string {
  return `$${(value / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function sanitizePlayerTokensInSummary(
  summary: string,
  playerTokens: string[],
  formatPlayerToken: (playerToken: string) => string
): string | null {
  const replacements = uniqueStrings(playerTokens)
    .sort((left, right) => right.length - left.length)
    .map((playerToken) => ({
      playerToken,
      replacement: formatPlayerToken(playerToken),
      escapedToken: playerToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    }))
    .filter(({ playerToken, replacement }) => replacement !== playerToken);

  for (const { escapedToken } of replacements) {
    const boundedToken = new RegExp(
      `(^|[^A-Za-z0-9_])${escapedToken}(?=$|[^A-Za-z0-9_])`,
      'g'
    );
    const occurrenceCount = Array.from(summary.matchAll(boundedToken)).length;

    // A repeated token can be both a schema-valid player id and ordinary prose
    // (for example, "cap: Dead cap amount changed"). Without trustworthy
    // occurrence-level provenance, reject that raw summary and let the
    // structured event fallback render instead of guessing.
    if (occurrenceCount > 1) return null;
  }

  if (replacements.length === 0) return summary;

  const replacementByToken = new Map(
    replacements.map(({ playerToken, replacement }) => [
      playerToken,
      replacement,
    ])
  );
  const boundedPlayerTokens = new RegExp(
    `(^|[^A-Za-z0-9_])(${replacements
      .map(({ escapedToken }) => escapedToken)
      .join('|')})(?=$|[^A-Za-z0-9_])`,
    'g'
  );

  return summary.replace(
    boundedPlayerTokens,
    (_match, prefix: string, playerToken: string) =>
      `${prefix}${
        replacementByToken.get(playerToken) || 'Player details unavailable'
      }`
  );
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
  const metadataPlayerId = firstNonEmptyString(
    mutationMetadata.playerId,
    metadata.playerId
  );
  const diffSummaryPlayersMoved = uniqueStrings(
    toArrayOfStrings(diffSummary.playersMoved)
  );
  const idBearingPlayerTokens = new Set([
    ...rawPlayerIds,
    ...metadataPlayerIds,
    ...diffSummaryPlayersMoved,
    ...(metadataPlayerId ? [metadataPlayerId] : []),
  ]);
  const literalCompatibilityPlayerNames = new Set(
    metadataPlayersTraded.filter(
      (playerToken) => !idBearingPlayerTokens.has(playerToken)
    )
  );
  const playerIds =
    rawPlayerIds.length > 0
      ? rawPlayerIds
      : metadataPlayerIds.length > 0
        ? metadataPlayerIds
        : metadataPlayerId
          ? [metadataPlayerId]
          : mutationType === 'executeTrade' &&
              diffSummaryPlayersMoved.length > 0
            ? diffSummaryPlayersMoved
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

  const eventId = firstNonEmptyString(raw.eventId, raw.id) || null;
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
  // Single-player mutations record the display name in their own metadata;
  // merge it into the caller lookup so owner-facing copy prefers real names
  // over raw player ids even when no external lookup is supplied (BZE-218).
  const metadataBoundPlayerId =
    metadataPlayerId || (playerIds.length === 1 ? playerIds[0] : null);
  const effectivePlayerNameLookup: Record<string, string> = {
    ...(metadataBoundPlayerId && metadataPlayerName
      ? { [metadataBoundPlayerId]: metadataPlayerName }
      : {}),
    ...(playerNameLookup || {}),
  };
  const fallbackPlayerToken = metadataBoundPlayerId || metadataPlayerName;
  const displayPlayerTokens =
    playerIds.length > 0
      ? playerIds
      : fallbackPlayerToken
        ? [fallbackPlayerToken]
        : [];
  const formatEventPlayerLabel = (playerToken: string) =>
    !metadataPlayerId &&
    metadataPlayerName &&
    playerToken === metadataPlayerName
      ? isSafePlayerDisplayName(metadataPlayerName)
        ? metadataPlayerName.trim()
        : 'Player details unavailable'
      : formatPlayerLabel(
          playerToken,
          effectivePlayerNameLookup,
          literalCompatibilityPlayerNames.has(playerToken)
        );
  const playerLabels = uniqueStrings(displayPlayerTokens).map((playerToken) =>
    formatEventPlayerLabel(playerToken)
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
  const birdRightsType = firstNonEmptyString(
    mutationMetadata.birdRightsType,
    metadata.birdRightsType
  );
  const freeAgentStatus = firstNonEmptyString(
    mutationMetadata.freeAgentStatus,
    metadata.freeAgentStatus
  );
  const rightOfFirstRefusal = firstNonEmptyString(
    mutationMetadata.rightOfFirstRefusal,
    metadata.rightOfFirstRefusal
  );
  const freeAgentAmountRemoved =
    formatCurrency(mutationMetadata.freeAgentAmountRemoved) ||
    formatCurrency(metadata.freeAgentAmountRemoved);
  const rightsStateId = firstNonEmptyString(
    mutationMetadata.rightsStateId,
    metadata.rightsStateId
  );
  const rightsStateVersion = Number(
    mutationMetadata.rightsStateVersion ?? metadata.rightsStateVersion
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
    diffSummaryPlayersMoved.length > 0
      ? diffSummaryPlayersMoved
      : displayPlayerTokens;
  const tradePlayerLines = tradePlayerTokens.map((playerToken) =>
    formatEventPlayerLabel(playerToken)
  );
  const tradePickLines =
    uniqueStrings(toArrayOfStrings(diffSummary.picksMoved)).length > 0
      ? uniqueStrings(
          expandTradePickLines(toArrayOfStrings(diffSummary.picksMoved))
        )
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
  const firstSpecificDeadCapChange = getFirstSpecificChangeLine('setDeadCap', [
    ...toArrayOfStrings(diffSummary.deadCapChanges),
    ...toArrayOfStrings(metadata.deadCapChanges),
  ]);

  const rawSummary = firstNonEmptyString(
    mutationMetadata.summary,
    metadata.summary
  );
  const sanitizedRawSummary = rawSummary
    ? sanitizePlayerTokensInSummary(
        rawSummary,
        [
          ...rawPlayerIds,
          ...metadataPlayerIds,
          ...metadataPlayersTraded,
          ...tradePlayerTokens,
          ...(metadataPlayerId ? [metadataPlayerId] : []),
          ...(metadataPlayerName &&
          !isSafePlayerDisplayName(
            metadataPlayerName,
            metadataPlayerId || undefined
          )
            ? [metadataPlayerName]
            : []),
        ],
        formatEventPlayerLabel
      )
    : null;
  let summaryCandidate =
    sanitizedRawSummary &&
    !isGenericSummary(sanitizedRawSummary, mutationType, displayType)
      ? sanitizedRawSummary
      : null;

  switch (mutationType) {
    case 'executeTrade': {
      const governedSignAndTradeReceipt =
        GovernedSignAndTradeReceiptZ.safeParse(
          metadata.governedSignAndTradeReceipt
        );
      const governedCashReceipt = GovernedCashReceiptZ.safeParse(
        metadata.governedCashReceipt
      );
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
      pushSection(detailSections, 'Salary Books', capDeltaLines);
      if (governedSignAndTradeReceipt.success) {
        const receipt = governedSignAndTradeReceipt.data;
        const receiptBody = asObject(receipt.tradeReceipt);
        pushSection(detailSections, 'Trade Receipt', [
          `Receipt: ${receipt.receiptId}`,
          `Contract event: ${receipt.contractEventId}`,
          `Hard-cap entry: ${receipt.hardCapEntryId}`,
          `Assignor salary: ${formatCurrency(Number(receiptBody.assignorSalary || 0))}`,
          `Assignee salary: ${formatCurrency(Number(receiptBody.assigneeSalary || 0))}`,
          `Assignee Room amount: ${formatCurrency(Number(receiptBody.assigneeRoomAmount || 0))}`,
          `BYC: ${receiptBody.bycTriggered === true ? 'Applied' : 'Not applicable'}`,
          'Poison pill: Not applicable to this supported S&T route',
          'Persistence verification: Complete',
        ]);
      }
      if (governedCashReceipt.success) {
        const receipt = governedCashReceipt.data;
        pushSection(detailSections, 'Cash Consideration Receipt', [
          `Receipt: ${receipt.receiptId}`,
          `Salary Cap Year: ${receipt.salaryCapYear}`,
          ...receipt.entries.map((entry) =>
            entry.direction === 'PAID'
              ? `${entry.teamId} paid ${formatCashCents(entry.amountCents)} to ${entry.counterpartyTeamId}`
              : `${entry.teamId} received ${formatCashCents(entry.amountCents)} from ${entry.counterpartyTeamId}`
          ),
          'Salary-book cash deltas: $0.00 for every Team',
          'Persistence verification: Complete',
        ]);
      }
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
        destinationTeamLabel
          ? `Destination team: ${destinationTeamLabel}`
          : null,
        signingInstrument
          ? `Rights/exception used: ${signingInstrument}`
          : null,
      ]);
      pushSection(detailSections, 'Salary Books', capDeltaLines);
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
        destinationTeamLabel
          ? `Destination team: ${destinationTeamLabel}`
          : null,
        signingInstrument
          ? `Rights/exception used: ${signingInstrument}`
          : null,
      ]);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Salary Books', capDeltaLines);
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
        destinationTeamLabel
          ? `Destination team: ${destinationTeamLabel}`
          : null,
        signingInstrument
          ? `Rights/exception used: ${signingInstrument}`
          : null,
      ]);
      pushSection(detailSections, 'Teams', [primaryTeamsLine]);
      pushSection(detailSections, 'Salary Books', capDeltaLines);
      break;
    }

    case 'waivePlayer':
    case 'waiveAndStretch':
    case 'buyoutPlayer': {
      const waiverModifiers = [
        stretched ? 'stretch' : null,
        buyout ? 'buyout' : null,
      ]
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
      pushSection(detailSections, 'Salary Books', capDeltaLines);
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
      pushSection(detailSections, 'Salary Books', capDeltaLines);
      break;
    }

    case 'optionDecision': {
      const optionDecisionLabel =
        typeof accepted === 'boolean'
          ? optionType === 'ETO'
            ? accepted
              ? 'ETO exercised'
              : 'ETO not exercised'
            : accepted
              ? `${optionType || 'option'} exercised`
              : `${optionType || 'option'} declined`
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
          ? `Decision: ${
              optionType === 'ETO'
                ? accepted
                  ? 'Exercised — Contract ends at the governed termination boundary'
                  : 'Not exercised — Contract retained'
                : accepted
                  ? 'Exercised — option Season retained'
                  : 'Declined — Contract ends at the governed preceding boundary'
            }`
          : null,
        ...contractLines,
      ]);
      pushSection(detailSections, 'Salary Books', capDeltaLines);
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
        birdRightsType ? `Former status: ${birdRightsType}` : null,
        freeAgentStatus ? `Free agency: ${freeAgentStatus}` : null,
        rightOfFirstRefusal
          ? `Right of First Refusal: ${formatRightOfFirstRefusal(rightOfFirstRefusal)}`
          : null,
        freeAgentAmountRemoved
          ? `Free Agent Amount removed: ${freeAgentAmountRemoved}`
          : null,
        rightsStateId && Number.isInteger(rightsStateVersion)
          ? `Resulting rights state: ${rightsStateId}@v${rightsStateVersion}`
          : null,
        destinationTeamLabel ? `Team: ${destinationTeamLabel}` : null,
      ]);
      pushSection(detailSections, 'Salary Books', capDeltaLines);
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
      pushSection(detailSections, 'Salary Books', capDeltaLines);
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
      pushSection(detailSections, 'Salary Books', capDeltaLines);
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
      pushSection(detailSections, 'Salary Books', capDeltaLines);
      break;
    }
  }

  const hasMeaningfulDetails = detailSections.length > 0;
  const summary = resolveSummary(
    displayType,
    summaryCandidate,
    hasMeaningfulDetails
  );
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
  activeTeamCode?: string | null,
  options: Pick<
    TeamHistoryEventDisplayOptions,
    'playerNameLookup' | 'teamNameLookup'
  > = {}
): TeamHistoryWorldEventRow[] {
  const normalizedTeamCode = activeTeamCode
    ? String(activeTeamCode).trim()
    : null;

  const rows = (Array.isArray(rawEvents) ? rawEvents : []).map((rawInput) =>
    toTeamHistoryEventDisplay(asObject(rawInput), {
      teamCode: normalizedTeamCode,
      playerNameLookup: options.playerNameLookup,
      teamNameLookup: options.teamNameLookup,
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
