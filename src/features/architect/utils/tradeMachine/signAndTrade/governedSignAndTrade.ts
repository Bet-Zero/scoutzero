import {
  GovernedSignAndTradeAuthorityZ,
  GovernedSignAndTradeProposalZ,
  type GovernedSignAndTradeAuthority,
} from '@/schemas/governedSignAndTrade';
import {
  SeasonHistoryRecordZ,
  SeasonTransitionManifestZ,
  type SeasonHistoryRecord,
  type SeasonTransitionManifest,
} from '@/schemas/seasonTransition';
import { GovernedOfferSheetEvidenceZ } from '@/schemas/governedOfferSheet';
import {
  createRightsEventLedger,
  projectRightsStateAsOf,
} from '@/features/architect/utils/rightsHistory';
import {
  isWithinSalaryCapYear,
  resolveGovernedSeasonEnvelope,
} from '@/features/architect/utils/governedSeason';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import type {
  ArchitectMutationContract,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline.types';

export const GOVERNED_SIGN_AND_TRADE_CANON_LEAVES = Object.freeze([
  'CBA2-A07.1',
  'CBA2-A07.2',
  'CBA2-A07.3',
  'CBA2-A07.4',
  'CBA2-A07.5',
  'CBA2-A07.6',
  'CBA2-A07.7',
  'CBA2-A07.8',
  'CBA2-A07.9',
  'CBA2-A07.10',
  'CBA2-A03.4',
  'CBA2-A03.9',
  'CBA2-A03.13',
  'CBA2-C14.16',
  'CBA2-L03.15',
  'CBA2-L02.1',
] as const);

type SnapshotReceipt = Readonly<{ exists: boolean; digest: string | null }>;

export type GovernedSignAndTradeEvidenceBundle = Readonly<{
  worldId: string;
  sourceTeamId: string;
  destinationTeamId: string;
  playerId: string;
  worldMetadata: Record<string, unknown>;
  sourceTeam: ArchitectMutationTeamRecord;
  destinationTeam: ArchitectMutationTeamRecord;
  sourcePlayerDocument: Record<string, unknown> | null;
  destinationPlayerDocument: Record<string, unknown> | null;
  immutableBasePlayer: ArchitectMutationPlayerRecord | null;
  transitionManifest: unknown;
  seasonHistories: readonly unknown[];
  snapshots: Readonly<{
    worldMetadata: SnapshotReceipt;
    sourceTeam: SnapshotReceipt;
    destinationTeam: SnapshotReceipt;
    sourcePlayer: SnapshotReceipt;
    destinationPlayer: SnapshotReceipt;
    seasonHistory: SnapshotReceipt;
    transitionManifest: SnapshotReceipt;
  }>;
}>;

type GovernedSignAndTradeBuildRequest = {
  evidence: GovernedSignAndTradeEvidenceBundle;
  contract: unknown;
  proposal: unknown;
  operationId: string;
  authoringIdentity: string;
  recordedAt: string;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const playerId = (value: unknown): string => {
  const candidate = record(value);
  const bio = record(candidate?.bio);
  return String(
    candidate?.player_id ||
      candidate?.playerId ||
      candidate?.id ||
      bio?.playerId ||
      ''
  ).trim();
};

const playerName = (value: unknown): string => {
  const candidate = record(value);
  const bio = record(candidate?.bio);
  return String(
    candidate?.displayName ||
      candidate?.playerName ||
      candidate?.name ||
      bio?.displayName ||
      ''
  ).trim();
};

const money = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;

const seasonBefore = (season: string): string | null => {
  const match = season.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const start = Number(match[1]);
  return `${start - 1}-${String(start % 100).padStart(2, '0')}`;
};

function requireExactSnapshot(receipt: SnapshotReceipt, label: string): void {
  if (!receipt.exists || !receipt.digest) {
    throw new Error(
      `Governed sign-and-trade requires an exact local ${label}.`
    );
  }
}

function requireMatchingSnapshot(
  receipt: SnapshotReceipt,
  value: unknown | null,
  label: string
): void {
  const exists = value !== null;
  if (
    receipt.exists !== exists ||
    (exists
      ? receipt.digest !== mutationSnapshotDigest(value)
      : receipt.digest !== null)
  ) {
    throw new Error(
      `Governed sign-and-trade ${label} receipt does not match its saved-world evidence.`
    );
  }
}

function activeRootAmount(
  root: Record<string, unknown>,
  kind: string,
  salaryCapYear: number
): number {
  const rows = Array.isArray(root.amountRecords) ? root.amountRecords : [];
  const matches = rows.filter((entry) => {
    const row = record(entry);
    return (
      row?.kind === kind &&
      row.salaryCapYear === salaryCapYear &&
      row.recordStatus === 'current'
    );
  });
  const amount = money(record(matches[0])?.amount);
  if (matches.length !== 1 || amount === null) {
    throw new Error(
      `Governed sign-and-trade requires one current ${kind} amount record.`
    );
  }
  return amount;
}

function validateTiming(
  transactionAt: string,
  salaryCapYear: number,
  regularSeasonOpening: string
): void {
  if (!isWithinSalaryCapYear(transactionAt, salaryCapYear)) {
    throw new Error(
      'The sign-and-trade transaction instant and Salary Cap Year do not agree.'
    );
  }
  if (transactionAt.slice(0, 10) >= regularSeasonOpening) {
    throw new Error(
      'A sign-and-trade must be completed before the governed Regular Season opening.'
    );
  }
  const year = salaryCapYear - 1;
  const instant = Date.parse(transactionAt);
  const moratoriumStart = Date.parse(`${year}-07-01T00:01:00-04:00`);
  const moratoriumEnd = Date.parse(`${year}-07-06T12:00:00-04:00`);
  if (instant >= moratoriumStart && instant <= moratoriumEnd) {
    throw new Error(
      'This sign-and-trade instant is inside the governed July Moratorium.'
    );
  }
}

function validateContract(
  contractInput: unknown,
  salaryCapYear: number,
  proposal: ReturnType<typeof GovernedSignAndTradeProposalZ.parse>,
  signingBirdType: 'Full Bird' | 'Early Bird' | 'Non-Bird'
) {
  const rawContract = record(contractInput);
  const contract = rawContract as ArchitectMutationContract | null;
  const rows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const contractYears = Number(
    contract?.contractYears ?? contract?.years ?? rows.length
  );
  const suppliedContractYears = Number(
    contract?.contractYears ?? contractYears
  );
  const suppliedYears = Number(contract?.years ?? contractYears);
  if (
    !Number.isInteger(contractYears) ||
    contractYears < 3 ||
    contractYears > 4 ||
    rows.length !== contractYears ||
    suppliedContractYears !== contractYears ||
    suppliedYears !== contractYears
  ) {
    throw new Error(
      'A governed sign-and-trade Contract requires exactly three or four annual rows.'
    );
  }
  if (
    contract?.tradeKicker != null ||
    rawContract?.signingBonus != null ||
    rawContract?.bonuses != null
  ) {
    throw new Error(
      'Signing bonuses, trade kickers, and unsupported compensation variants are outside this sign-and-trade route.'
    );
  }
  const expectedSigningMechanism =
    signingBirdType === 'Full Bird'
      ? 'FULL_BIRD'
      : signingBirdType === 'Early Bird'
        ? 'EARLY_BIRD'
        : 'NON_BIRD';
  const claimedSigningMechanism = String(
    contract?.signedUsing || rawContract?.exceptionType || ''
  )
    .trim()
    .toUpperCase()
    .replaceAll(' ', '_');
  if (
    claimedSigningMechanism &&
    claimedSigningMechanism !== 'NONE' &&
    claimedSigningMechanism !== expectedSigningMechanism
  ) {
    throw new Error(
      'The sign-and-trade Contract must use its authenticated Bird-rights route and may not use a barred or conflicting Exception.'
    );
  }
  const normalizedRows = rows.map((row, index) => {
    const salary = money(row.salary);
    const capHit = money(row.capHit);
    const option = row.option ?? row.optionType ?? null;
    if (
      row.season !== toSeasonCode(salaryCapYear + index) ||
      salary === null ||
      salary <= 0 ||
      capHit !== salary ||
      typeof row.guaranteed !== 'boolean' ||
      (index === 0 && row.guaranteed !== true) ||
      ![null, 'PO', 'TO', 'ETO'].includes(option as null | string)
    ) {
      throw new Error(
        `Sign-and-trade Contract row ${index + 1} has a wrong season, unsupported amount, protection, Cap Hit, or option.`
      );
    }
    const incentives = record(row.incentives);
    const likely = money(incentives?.likely) ?? 0;
    const unlikely = money(incentives?.unlikely) ?? 0;
    if (likely !== 0 || money(row.tradeBonus) !== null) {
      throw new Error(
        'Likely incentives and Trade Bonuses are not authorable in the supported sign-and-trade route.'
      );
    }
    if (
      (index === 0 && unlikely !== proposal.firstSeasonUnlikelyBonuses) ||
      (index > 0 && unlikely !== 0)
    ) {
      throw new Error(
        'The authored Contract must contain exactly the authenticated first-season unlikely bonus.'
      );
    }
    return {
      season: row.season,
      salary,
      capHit,
      guaranteed: row.guaranteed,
      guaranteedAmount: row.guaranteed ? salary : 0,
      option: option as 'PO' | 'TO' | 'ETO' | null,
      likelyBonuses: likely,
      unlikelyBonuses: unlikely,
    };
  });
  const nonOptionYears = normalizedRows.filter(
    (row) => row.option === null
  ).length;
  if (nonOptionYears < 3 || normalizedRows[0].option !== null) {
    throw new Error(
      'A governed sign-and-trade requires three non-option years and no first-year option.'
    );
  }
  const raiseLimit =
    normalizedRows[0].salary * (signingBirdType === 'Non-Bird' ? 0.05 : 0.08);
  normalizedRows.slice(1).forEach((row, index) => {
    if (Math.abs(row.salary - normalizedRows[index].salary) > raiseLimit) {
      throw new Error(
        'A sign-and-trade annual Salary change exceeds the governed rights-route limit.'
      );
    }
  });
  const totalValue = normalizedRows.reduce((sum, row) => sum + row.salary, 0);
  const averageAnnualValue = Math.round(totalValue / contractYears);
  if (
    (contract?.contractType != null &&
      String(contract.contractType).trim() !== 'Sign & Trade') ||
    (contract?.firstYearGuaranteed != null &&
      contract.firstYearGuaranteed !== true) ||
    (rawContract?.base != null &&
      rawContract.base !== normalizedRows[0].salary) ||
    (contract?.totalValue != null && contract.totalValue !== totalValue) ||
    (contract?.averageAnnualValue != null &&
      contract.averageAnnualValue !== averageAnnualValue)
  ) {
    throw new Error(
      'The sign-and-trade Contract summary conflicts with its governed annual rows.'
    );
  }
  return {
    rows: normalizedRows,
    contractYears,
    nonOptionYears,
    totalValue,
    averageAnnualValue,
  };
}

function simulatedPostSigningTeamSalary({
  team,
  player,
  playerIdentifier,
  contract,
  salaryCapYear,
  transactionAt,
}: {
  team: ArchitectMutationTeamRecord;
  player: ArchitectMutationPlayerRecord;
  playerIdentifier: string;
  contract: ArchitectMutationContract;
  salaryCapYear: number;
  transactionAt: string;
}): number {
  const cloned = JSON.parse(
    JSON.stringify(team)
  ) as ArchitectMutationTeamRecord;
  const players = Array.isArray(cloned.players) ? cloned.players : [];
  const index = players.findIndex(
    (candidate) => playerId(candidate) === playerIdentifier
  );
  const signedPlayer = { ...player, contract, teamCode: cloned.teamCode };
  cloned.players =
    index >= 0
      ? players.map((candidate, candidateIndex) =>
          candidateIndex === index ? signedPlayer : candidate
        )
      : [...players, signedPlayer];
  cloned.roster = Array.from(
    new Set([
      ...(Array.isArray(cloned.roster) ? cloned.roster.map(String) : []),
      playerIdentifier,
    ])
  );
  cloned.capHolds = (cloned.capHolds || []).filter(
    (hold) => String(hold.playerId || '') !== playerIdentifier
  );
  const totals = createCanonicalTeamTotalsSnapshot(cloned, salaryCapYear, {
    asOfDate: transactionAt,
  });
  if (totals.teamSalary === null || !Number.isSafeInteger(totals.teamSalary)) {
    throw new Error(
      'The source Team Salary book is incomplete after the proposed signing.'
    );
  }
  return totals.teamSalary;
}

export function buildGovernedSignAndTradeAuthority(
  request: GovernedSignAndTradeBuildRequest
): GovernedSignAndTradeAuthority {
  const { evidence } = request;
  Object.entries(evidence.snapshots).forEach(([label, receipt]) => {
    if (
      (label === 'sourcePlayer' || label === 'destinationPlayer') &&
      !receipt.exists &&
      receipt.digest === null
    ) {
      return;
    }
    requireExactSnapshot(receipt, label);
  });
  requireMatchingSnapshot(
    evidence.snapshots.worldMetadata,
    evidence.worldMetadata,
    'world metadata'
  );
  requireMatchingSnapshot(
    evidence.snapshots.sourceTeam,
    evidence.sourceTeam,
    'source Team'
  );
  requireMatchingSnapshot(
    evidence.snapshots.destinationTeam,
    evidence.destinationTeam,
    'destination Team'
  );
  requireMatchingSnapshot(
    evidence.snapshots.sourcePlayer,
    evidence.sourcePlayerDocument,
    'source player override'
  );
  requireMatchingSnapshot(
    evidence.snapshots.destinationPlayer,
    evidence.destinationPlayerDocument,
    'destination player override'
  );
  requireMatchingSnapshot(
    evidence.snapshots.transitionManifest,
    evidence.transitionManifest,
    'season-transition manifest'
  );
  const proposal = GovernedSignAndTradeProposalZ.parse(request.proposal);
  if (Date.parse(request.recordedAt) < Date.parse(proposal.transactionAt)) {
    throw new Error(
      'Sign-and-trade authoring provenance cannot predate the transaction.'
    );
  }
  if (evidence.sourceTeamId === evidence.destinationTeamId) {
    throw new Error('Sign-and-trade source and destination Teams must differ.');
  }
  const sourceSnapshotTeamId = String(
    evidence.sourceTeam.teamCode || record(evidence.sourceTeam)?.teamId || ''
  )
    .trim()
    .toUpperCase();
  const destinationSnapshotTeamId = String(
    evidence.destinationTeam.teamCode ||
      record(evidence.destinationTeam)?.teamId ||
      ''
  )
    .trim()
    .toUpperCase();
  if (
    sourceSnapshotTeamId !== evidence.sourceTeamId ||
    destinationSnapshotTeamId !== evidence.destinationTeamId
  ) {
    throw new Error(
      'The saved-world Team snapshots do not match the routed sign-and-trade identities.'
    );
  }
  const metadataSeason = String(
    evidence.worldMetadata.currentSeason || ''
  ).trim();
  const metadataYear = Number(evidence.worldMetadata.currentYear);
  const worldDate = String(evidence.worldMetadata.asOfDate || '').slice(0, 10);
  if (
    !metadataSeason ||
    !Number.isInteger(metadataYear) ||
    metadataSeason !== toSeasonCode(metadataYear) ||
    proposal.transactionAt.slice(0, 10) !== worldDate
  ) {
    throw new Error(
      'The saved-world season, Salary Cap Year, date, and proposed transaction instant must agree exactly.'
    );
  }
  const envelope = resolveGovernedSeasonEnvelope({
    asOfDate: proposal.transactionAt,
    salaryCapYear: metadataYear,
    requiredAuthority: 'official',
    team: {
      teamId: evidence.destinationTeamId,
      teamCode: evidence.destinationTeamId,
      worldId: evidence.worldId,
    },
  });
  const salaryCap = envelope.systemLevels['salary-cap'].amount;
  const opening = envelope.calendar.regularSeasonOpening?.value;
  if (
    envelope.status !== 'complete' ||
    !envelope.inputManifest ||
    salaryCap === null ||
    !opening
  ) {
    throw new Error(
      envelope.unavailableReasons[0] ||
        'Official season, calendar, and Salary Cap authority is unavailable.'
    );
  }
  validateTiming(proposal.transactionAt, metadataYear, opening);

  const manifest = SeasonTransitionManifestZ.parse(evidence.transitionManifest);
  const histories = evidence.seasonHistories.map((entry) =>
    SeasonHistoryRecordZ.parse(entry)
  );
  const priorSeason = seasonBefore(metadataSeason);
  if (
    !priorSeason ||
    manifest.worldId !== evidence.worldId ||
    manifest.fromSeason !== priorSeason ||
    manifest.toSeason !== metadataSeason ||
    manifest.toSalaryCapYear !== metadataYear ||
    histories.length !== 30
  ) {
    throw new Error(
      'BZE-289 season-transition authority does not match this world and season.'
    );
  }
  if (
    Date.parse(proposal.transactionAt) <
    Math.max(
      Date.parse(manifest.transitionEffectiveAt),
      Date.parse(manifest.committedAt)
    )
  ) {
    throw new Error(
      'The sign-and-trade transaction cannot predate the authenticated Season Advance.'
    );
  }
  const manifestHistoryIds = new Set(
    manifest.teamRecords.map((team) => team.historyId)
  );
  if (
    new Set(histories.map((history) => history.historyId)).size !== 30 ||
    histories.some(
      (history) =>
        history.worldId !== evidence.worldId ||
        history.transitionId !== manifest.transitionId ||
        !manifestHistoryIds.has(history.historyId)
    )
  ) {
    throw new Error(
      'The 30-team season history set is incomplete, conflicting, or belongs to another transition.'
    );
  }
  const manifestRecordByTeam = new Map(
    manifest.teamRecords.map((entry) => [entry.teamCode, entry])
  );
  for (const history of histories) {
    const manifestRecord = manifestRecordByTeam.get(history.teamCode);
    const contractEventIds = history.contractEvents
      .map((event) => event.eventId)
      .sort();
    const manifestContractEventIds = [
      ...(manifestRecord?.contractEventIds || []),
    ].sort();
    if (
      !manifestRecord ||
      manifestRecord.historyId !== history.historyId ||
      history.fromSeason !== manifest.fromSeason ||
      history.toSeason !== manifest.toSeason ||
      history.seasonCloseDate !== manifest.seasonCloseDate ||
      history.transitionEffectiveAt !== manifest.transitionEffectiveAt ||
      history.preAdvanceStateDigest !==
        mutationSnapshotDigest(history.preAdvanceState) ||
      history.finalRosterDigest !==
        mutationSnapshotDigest(history.finalRoster) ||
      manifestRecord.preAdvanceStateDigest !== history.preAdvanceStateDigest ||
      manifestRecord.finalRosterDigest !== history.finalRosterDigest ||
      manifestRecord.seasonCloseApronMeasurementDigest !==
        mutationSnapshotDigest(history.seasonCloseApronMeasurement) ||
      manifestRecord.entitlementStateDigest !==
        history.entitlementStateDigest ||
      mutationSnapshotDigest(contractEventIds) !==
        mutationSnapshotDigest(manifestContractEventIds)
    ) {
      throw new Error(
        `The ${history.teamCode} season-close history conflicts with the immutable league transition manifest.`
      );
    }
  }
  const rosterMatches = histories.flatMap((history) =>
    history.finalRoster
      .filter((candidate) => playerId(candidate) === evidence.playerId)
      .map((candidate) => ({ history, player: candidate }))
  );
  if (
    rosterMatches.length !== 1 ||
    rosterMatches[0].history.teamCode !== evidence.sourceTeamId
  ) {
    throw new Error(
      'The player is not authenticated exactly once on the source Team’s prior-season final roster.'
    );
  }
  const rosterMatch = rosterMatches[0];
  requireMatchingSnapshot(
    evidence.snapshots.seasonHistory,
    rosterMatch.history,
    'source season history'
  );
  const sourceManifestRecord = manifest.teamRecords.find(
    (entry) => entry.teamCode === evidence.sourceTeamId
  );
  if (
    !sourceManifestRecord ||
    sourceManifestRecord.historyId !== rosterMatch.history.historyId ||
    sourceManifestRecord.finalRosterDigest !==
      rosterMatch.history.finalRosterDigest ||
    sourceManifestRecord.seasonCloseApronMeasurementDigest !==
      mutationSnapshotDigest(rosterMatch.history.seasonCloseApronMeasurement)
  ) {
    throw new Error(
      'The source Team’s final roster or season-close Apron identity conflicts with the league transition manifest.'
    );
  }

  const livePlayers = evidence.sourceTeam.players || [];
  const livePlayer = livePlayers.find(
    (candidate) => playerId(candidate) === evidence.playerId
  );
  if (!livePlayer) {
    throw new Error(
      'The source Team snapshot does not contain the sign-and-trade player.'
    );
  }
  if (evidence.destinationPlayerDocument) {
    throw new Error(
      'The receiving Team already has a conflicting saved-world player override.'
    );
  }
  if (evidence.sourcePlayerDocument) {
    const overrideTeamId = String(
      evidence.sourcePlayerDocument.teamCode ||
        evidence.sourcePlayerDocument.teamId ||
        ''
    )
      .trim()
      .toUpperCase();
    if (
      playerId(evidence.sourcePlayerDocument) !== evidence.playerId ||
      overrideTeamId !== evidence.sourceTeamId ||
      mutationSnapshotDigest(evidence.sourcePlayerDocument.contract ?? null) !==
        mutationSnapshotDigest(livePlayer.contract ?? null)
    ) {
      throw new Error(
        'The source player override conflicts with the saved Team roster, identity, or Contract state.'
      );
    }
  }
  const activeOfferSheetMirrors = [
    ...(evidence.sourceTeam.offerSheets || []),
    ...(evidence.sourceTeam.incomingOfferSheets || []),
    ...(evidence.destinationTeam.offerSheets || []),
    ...(evidence.destinationTeam.incomingOfferSheets || []),
  ];
  if (
    activeOfferSheetMirrors.some(
      (sheet) => String(sheet.playerId || '') === evidence.playerId
    )
  ) {
    throw new Error('A pending Offer Sheet bars this sign-and-trade route.');
  }
  if (livePlayer.futureContract) {
    throw new Error(
      'A player with a future Contract or extension cannot use this sign-and-trade route.'
    );
  }
  const activeLiveContractRows = Array.isArray(
    livePlayer.contract?.salariesByYear
  )
    ? livePlayer.contract.salariesByYear.filter(
        (row) =>
          row.season === metadataSeason &&
          money(row.salary ?? row.capHit) !== null &&
          Number(row.salary ?? row.capHit) > 0
      )
    : [];
  if (activeLiveContractRows.length > 0) {
    throw new Error(
      'A player with active current-Season Contract Salary is not an eligible free agent for sign-and-trade.'
    );
  }

  const ledger = createRightsEventLedger(evidence.sourceTeam.rightsLedger);
  const rights = projectRightsStateAsOf({
    ledger,
    worldId: evidence.worldId,
    teamId: evidence.sourceTeamId,
    playerId: evidence.playerId,
    asOfDate: proposal.transactionAt.slice(0, 10),
    salaryCapYear: metadataYear,
  });
  if (
    rights.status !== 'available' ||
    !rights.ledgerReference ||
    !rights.stateReference ||
    !rights.birdType ||
    !rights.signingBirdType ||
    rights.signingBirdType === 'None' ||
    !rights.freeAgentStatus ||
    !rights.rightOfFirstRefusal
  ) {
    throw new Error(
      rights.reasons[0] ||
        'Complete dated Bird-right and free-agent authority is unavailable.'
    );
  }
  const root = ledger.events.find(
    (event) =>
      event.eventKind === 'rights-established' &&
      event.playerId === evidence.playerId &&
      event.salaryCapYear === metadataYear &&
      event.recordStatus === 'current'
  );
  if (!root || root.eventKind !== 'rights-established') {
    throw new Error('The current rights-establishment root is unavailable.');
  }
  if (root.priorContract.wasOneSeasonMinimumContract) {
    throw new Error(
      'A prior one-Season Minimum Contract requires authenticated League-reimbursement authority that this V1 does not invent.'
    );
  }
  const rootRecord = root as unknown as Record<string, unknown>;
  const priorSalary = activeRootAmount(
    rootRecord,
    'prior-regular-salary',
    metadataYear
  );
  const priorSigningBonusAllocation = activeRootAmount(
    rootRecord,
    'prior-signing-bonus-allocation',
    metadataYear
  );
  const earnedPerformanceBonuses = activeRootAmount(
    rootRecord,
    'earned-performance-bonuses',
    metadataYear
  );
  const applicableMinimum = activeRootAmount(
    rootRecord,
    'applicable-minimum-salary',
    metadataYear
  );
  const applicableMaximum = activeRootAmount(
    rootRecord,
    'applicable-maximum-salary',
    metadataYear
  );
  const priorRosterContract = record(record(rosterMatch.player)?.contract);
  const priorRosterRows = Array.isArray(priorRosterContract?.salariesByYear)
    ? priorRosterContract.salariesByYear
        .map(record)
        .filter((row): row is Record<string, unknown> => row !== null)
        .filter((row) => row.season === priorSeason)
    : [];
  const priorRosterRow = priorRosterRows[0];
  const priorRosterSalary = money(priorRosterRow?.salary);
  const priorRosterIncentives = record(priorRosterRow?.incentives);
  const priorLikelyBonuses = money(priorRosterIncentives?.likely) ?? 0;
  const priorUnlikelyBonuses = money(priorRosterIncentives?.unlikely) ?? 0;
  if (
    priorRosterRows.length !== 1 ||
    priorRosterSalary === null ||
    priorRosterSalary !== priorSalary ||
    (priorRosterRow?.incentives != null && !priorRosterIncentives)
  ) {
    throw new Error(
      'The prior Contract compensation in BZE-289 final-roster history conflicts with dated rights authority.'
    );
  }
  if (
    priorLikelyBonuses !== 0 ||
    priorUnlikelyBonuses !== 0 ||
    priorSigningBonusAllocation !== 0 ||
    earnedPerformanceBonuses !== 0
  ) {
    throw new Error(
      'Prior-Contract bonus compensation is outside this V1 and cannot be collapsed into guessed Non-Qualifying Veteran component ceilings.'
    );
  }
  const rfaEvidence = GovernedOfferSheetEvidenceZ.safeParse(
    evidence.immutableBasePlayer?.rfaContext?.governedEvidence
  );
  let qualifyingOfferTotal = 0;
  if (rights.freeAgentStatus === 'RFA') {
    if (
      !rfaEvidence.success ||
      rfaEvidence.data.status !== 'known' ||
      rfaEvidence.data.worldId !== evidence.worldId ||
      rfaEvidence.data.homeTeamId !== evidence.sourceTeamId ||
      rfaEvidence.data.playerId !== evidence.playerId ||
      rfaEvidence.data.salaryCapYear !== metadataYear ||
      rfaEvidence.data.qualifyingOffer.recordStatus !== 'current'
    ) {
      throw new Error(
        'RFA sign-and-trade requires matching immutable qualifying-offer evidence.'
      );
    }
    qualifyingOfferTotal = rfaEvidence.data.qualifyingOffer.amount;
  }

  const contractShape = validateContract(
    request.contract,
    metadataYear,
    proposal,
    rights.signingBirdType
  );
  const firstRow = contractShape.rows[0];
  const salaryPlusUnlikely =
    firstRow.salary + proposal.firstSeasonUnlikelyBonuses;
  const nonQualifyingVeteranFirstYearCeiling = Math.min(
    applicableMaximum,
    Math.max(
      Math.floor(priorSalary * 1.2),
      Math.floor(applicableMinimum * 1.2),
      qualifyingOfferTotal
    )
  );
  if (salaryPlusUnlikely > applicableMaximum) {
    throw new Error(
      'First-season Salary plus unlikely bonuses exceeds the applicable Maximum Salary.'
    );
  }
  if (salaryPlusUnlikely > Math.floor(salaryCap * 0.25)) {
    throw new Error(
      'This V1 cannot authenticate the 5th Year Eligible Higher Max predicate, so Salary plus unlikely bonuses above 25% of the Salary Cap is unavailable.'
    );
  }
  if (
    proposal.physicalExam.status === 'passed' &&
    proposal.physicalExam.designatedByTeam !== evidence.destinationTeamId
  ) {
    throw new Error(
      'The assignee Team must designate any conditional physical examination.'
    );
  }
  if (
    proposal.physicalExam.status === 'passed' &&
    Date.parse(proposal.physicalExam.examinedAt) >
      Date.parse(proposal.transactionAt)
  ) {
    throw new Error(
      'The authenticated physical examination cannot occur after the transaction.'
    );
  }
  if (proposal.physicalExam.status === 'passed') {
    throw new Error(
      'A conditional physical examination requires an authenticated assignee-designated examination record that this V1 does not invent.'
    );
  }
  const authoredContract = {
    contractType: 'Sign & Trade',
    contractYears: contractShape.contractYears,
    years: contractShape.contractYears,
    firstYearGuaranteed: true,
    signedUsing:
      rights.signingBirdType === 'Full Bird'
        ? 'FULL_BIRD'
        : rights.signingBirdType === 'Early Bird'
          ? 'EARLY_BIRD'
          : 'NON_BIRD',
    signingTeam: evidence.sourceTeamId,
    signingDate: proposal.transactionAt,
    base: firstRow.salary,
    totalValue: contractShape.totalValue,
    averageAnnualValue: contractShape.averageAnnualValue,
    salariesByYear: contractShape.rows.map((row) => ({
      ...row,
      guaranteedAmount: row.guaranteedAmount,
      optionType: row.option,
      incentives: {
        likely: row.likelyBonuses,
        unlikely: row.unlikelyBonuses,
      },
    })),
  } as ArchitectMutationContract;
  const postSigningSourceTeamSalary = simulatedPostSigningTeamSalary({
    team: evidence.sourceTeam,
    player: livePlayer,
    playerIdentifier: evidence.playerId,
    contract: authoredContract,
    salaryCapYear: metadataYear,
    transactionAt: proposal.transactionAt,
  });
  const bycTriggered =
    (rights.signingBirdType === 'Full Bird' ||
      rights.signingBirdType === 'Early Bird') &&
    postSigningSourceTeamSalary > salaryCap &&
    salaryPlusUnlikely > nonQualifyingVeteranFirstYearCeiling;
  const assignorSalary = bycTriggered
    ? Math.max(priorSalary, Math.floor(firstRow.salary * 0.5))
    : firstRow.salary;

  return GovernedSignAndTradeAuthorityZ.parse({
    authorityVersion: 1,
    status: 'ready',
    worldId: evidence.worldId,
    sourceTeamId: evidence.sourceTeamId,
    destinationTeamId: evidence.destinationTeamId,
    playerId: evidence.playerId,
    playerName: playerName(livePlayer) || playerName(rosterMatch.player),
    salaryCapYear: metadataYear,
    seasonKey: metadataSeason,
    transactionAt: proposal.transactionAt,
    proposal,
    seasonEvidence: {
      priorSeason,
      currentSeason: metadataSeason,
      historyId: rosterMatch.history.historyId,
      historyDigest: mutationSnapshotDigest(rosterMatch.history),
      transitionId: manifest.transitionId,
      transitionManifestDigest: mutationSnapshotDigest(manifest),
      finalRosterDigest: rosterMatch.history.finalRosterDigest,
      finalRosterPlayerDigest: mutationSnapshotDigest(rosterMatch.player),
      seasonCloseApronMeasurementDigest:
        sourceManifestRecord.seasonCloseApronMeasurementDigest,
    },
    rightsEvidence: {
      ledgerId: rights.ledgerReference.ledgerId,
      ledgerVersion: rights.ledgerReference.ledgerVersion,
      ledgerDigest: mutationSnapshotDigest(ledger),
      stateId: rights.stateReference.stateId,
      stateVersion: rights.stateReference.stateVersion,
      birdType: rights.birdType,
      signingBirdType: rights.signingBirdType,
      freeAgentStatus: rights.freeAgentStatus,
      rightOfFirstRefusal: rights.rightOfFirstRefusal,
      consumedEventIds: rights.consumedEventIds,
    },
    contract: {
      contractDigest: mutationSnapshotDigest(authoredContract),
      contractYears: contractShape.contractYears,
      nonOptionYears: contractShape.nonOptionYears,
      firstSeasonFullyProtected: true,
      signedUsing: authoredContract.signedUsing,
      rows: contractShape.rows,
      firstSeasonSalary: firstRow.salary,
      firstSeasonLikelyBonuses: firstRow.likelyBonuses,
      firstSeasonUnlikelyBonuses: firstRow.unlikelyBonuses,
    },
    salaryTreatment: {
      salaryCap,
      priorContractFinalSalary: priorSalary,
      applicableMinimumSalary: applicableMinimum,
      applicableMaximumSalary: applicableMaximum,
      qualifyingOfferTotal,
      nonQualifyingVeteranFirstYearCeiling,
      firstSeasonSalaryPlusUnlikely: salaryPlusUnlikely,
      postSigningSourceTeamSalary,
      bycTriggered,
      poisonPillTriggered: false,
      assignorSalary,
      assigneeSalary: firstRow.salary,
      assigneeRoomAmount: salaryPlusUnlikely,
    },
    snapshots: {
      ...evidence.snapshots,
      seasonHistorySet: histories
        .map((history) => ({
          historyId: history.historyId,
          teamId: history.teamCode,
          digest: mutationSnapshotDigest(history),
        }))
        .sort((left, right) => left.teamId.localeCompare(right.teamId)),
    },
    seasonInputManifest: envelope.inputManifest,
    authoringIdentity: request.authoringIdentity,
    operationId: request.operationId,
    recordedAt: request.recordedAt,
    canonLeafIds: GOVERNED_SIGN_AND_TRADE_CANON_LEAVES,
    proof: {
      canonCandidateCommit: envelope.registry.canonCandidateCommit,
      canonSha256: envelope.registry.canonSha256,
    },
  });
}

export function findGovernedSignAndTradeHistory(
  histories: readonly SeasonHistoryRecord[],
  teamId: string
): SeasonHistoryRecord | null {
  return histories.find((history) => history.teamCode === teamId) ?? null;
}

export function parseGovernedSignAndTradeTransition(
  value: unknown
): SeasonTransitionManifest {
  return SeasonTransitionManifestZ.parse(value);
}
