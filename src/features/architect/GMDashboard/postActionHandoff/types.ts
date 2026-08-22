/**
 * FILE: src/features/architect/GMDashboard/postActionHandoff/types.ts
 * PURPOSE: Stage 2B post-action receipt model + pure derivation from committed mutation results.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * The receipt is a session-scoped UI signal: a derived view of what just
 * committed. It is NEVER a source of truth, never persisted, and never written
 * to Firestore. Authority remains with the mutation pipeline / committed world
 * event stream; this type only restates what the pipeline already returned.
 */

import {
  computeDeadMoneyForYear,
  type TeamDeadMoneySourcesLike,
} from '@/features/architect/utils/capTotals/deadMoneyForYear';
import {
  createCanonicalTeamTotalsSnapshot,
  type TeamCapSheetLike,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import type { PersistMutationResult } from '../hooks/useArchitectActions.types';
import type { ArchitectTeamPlanSaveStatus } from '../hooks/teamPlanSaveState';
import type { WorldAdvanceAftermath } from '../components/SeasonAdvanceModal';

export type ArchitectPostActionReceiptKind =
  | 'trade'
  | 'signing'
  | 'signAndTrade'
  | 'offerSheet'
  | 'contractAction'
  | 'seasonAdvance';

export type ArchitectPostActionReceiptAuthority =
  | 'committed-world'
  | 'local-only';

export type ArchitectPostActionPersistenceStatus =
  | 'world-saved'
  | 'local-only'
  | 'staged-draft'
  | 'saving'
  | 'save-failed'
  | 'unknown';

export interface ArchitectPostActionPersistence {
  status: ArchitectPostActionPersistenceStatus;
  saveStateStatus: ArchitectTeamPlanSaveStatus | 'unknown';
  label: string;
  detail: string;
}

export type ArchitectPostActionImpactArea =
  | 'roster'
  | 'cap'
  | 'exceptions'
  | 'rights'
  | 'deadMoney'
  | 'contract';

export type ArchitectPostActionImpactDeltaUnit =
  | 'currency'
  | 'count'
  | 'status'
  | 'text';

export interface ArchitectPostActionImpactDelta {
  key: string;
  label: string;
  unit: ArchitectPostActionImpactDeltaUnit;
  before: number | string | boolean | null;
  after: number | string | boolean | null;
  delta: number | null;
}

export interface ArchitectPostActionImpactSection {
  status: 'available' | 'partial' | 'not-applicable' | 'unavailable';
  summary: string;
  deltas: ArchitectPostActionImpactDelta[];
}

export interface ArchitectPostActionImpact {
  actionType: string;
  mutationType: string;
  teamCode: string | null;
  playerId: string | null;
  playerName: string | null;
  affectedSeasons: string[];
  roster: ArchitectPostActionImpactSection;
  cap: ArchitectPostActionImpactSection;
  exceptions: ArchitectPostActionImpactSection;
  rights: ArchitectPostActionImpactSection;
  deadMoney: ArchitectPostActionImpactSection;
  contract: ArchitectPostActionImpactSection;
  notes: string[];
}

export interface ArchitectReceiptActionContext {
  actionType?: string;
  headlineOverride?: string;
  message?: string;
  playerId?: string | number | null;
  playerName?: string | null;
  affectedSeasons?: Array<string | number | null | undefined>;
  effectAreas?: ArchitectPostActionImpactArea[];
  notes?: string[];
}

export interface ArchitectPostActionReceipt {
  kind: ArchitectPostActionReceiptKind;
  actionType: string;
  eventId: string | null;
  occurredAt: string | null;
  headline: string;
  changedTeamCodes: string[];
  primaryTeamCode: string | null;
  primaryPlayerIds: string[];
  message?: string;
  persistence: ArchitectPostActionPersistence;
  impact: ArchitectPostActionImpact;
  authority: ArchitectPostActionReceiptAuthority;
}

const HEADLINE_BY_KIND: Record<ArchitectPostActionReceiptKind, string> = {
  trade: 'Trade applied',
  signing: 'Free agent signed',
  signAndTrade: 'Sign-and-trade applied',
  offerSheet: 'Offer sheet updated',
  contractAction: 'Contract updated',
  seasonAdvance: 'Season advanced',
};

const HEADLINE_BY_MUTATION_TYPE: Record<string, string> = {
  storeOfferSheet: 'Offer sheet stored',
  matchOfferSheet: 'Offer sheet matched',
  declineOfferSheet: 'Offer sheet declined',
  finalizeMatchedOfferSheet: 'Matched offer sheet finalized',
  finalizeDeclinedOfferSheet: 'Declined offer sheet finalized',
  extendPlayer: 'Extension saved',
  waivePlayer: 'Waive/buyout saved',
  renounceRights: 'Rights renounced',
  setExceptions: 'Exceptions updated',
  setDeadCap: 'Dead money updated',
  optionDecision: 'Option decision saved',
};

const KIND_BY_MUTATION_TYPE: Record<string, ArchitectPostActionReceiptKind> = {
  executeTrade: 'trade',
  signFreeAgent: 'signing',
  signAndTrade: 'signAndTrade',
  storeOfferSheet: 'offerSheet',
  matchOfferSheet: 'offerSheet',
  declineOfferSheet: 'offerSheet',
  finalizeMatchedOfferSheet: 'offerSheet',
  finalizeDeclinedOfferSheet: 'offerSheet',
};

const ACTION_TYPE_BY_MUTATION_TYPE: Record<string, string> = {
  executeTrade: 'trade',
  signFreeAgent: 'free-agent-signing',
  signAndTrade: 'sign-and-trade',
  storeOfferSheet: 'offer-sheet',
  matchOfferSheet: 'offer-sheet-match',
  declineOfferSheet: 'offer-sheet-decline',
  finalizeMatchedOfferSheet: 'offer-sheet-finalize-matched',
  finalizeDeclinedOfferSheet: 'offer-sheet-finalize-declined',
  extendPlayer: 'extension',
  waivePlayer: 'waive-buyout',
  renounceRights: 'renounce-rights',
  setExceptions: 'manual-exception-edit',
  setDeadCap: 'manual-dead-money-edit',
  optionDecision: 'option-decision',
};

const EFFECT_AREAS_BY_MUTATION_TYPE: Record<
  string,
  ArchitectPostActionImpactArea[]
> = {
  executeTrade: ['roster', 'cap', 'exceptions'],
  signFreeAgent: ['roster', 'cap', 'exceptions', 'contract'],
  signAndTrade: ['roster', 'cap', 'exceptions', 'contract'],
  storeOfferSheet: ['contract'],
  // BZE-191: match/decline now resolve the offer sheet atomically (player +
  // cap move), so they carry the same roster/cap effects as finalize.
  matchOfferSheet: ['roster', 'cap', 'contract'],
  declineOfferSheet: ['roster', 'cap', 'contract'],
  finalizeMatchedOfferSheet: ['roster', 'cap', 'contract'],
  finalizeDeclinedOfferSheet: ['roster', 'cap', 'contract'],
  extendPlayer: ['contract', 'cap'],
  waivePlayer: ['roster', 'deadMoney', 'cap'],
  renounceRights: ['rights', 'cap'],
  setExceptions: ['exceptions'],
  setDeadCap: ['deadMoney', 'cap'],
  optionDecision: ['roster', 'rights', 'cap', 'contract'],
};

const PERSISTENCE_BY_AUTHORITY: Record<
  ArchitectPostActionReceiptAuthority,
  ArchitectPostActionPersistence
> = {
  'committed-world': {
    status: 'world-saved',
    saveStateStatus: 'saved',
    label: 'Committed world',
    detail:
      'Saved to the active Team Plan world. History and compare can use this saved action.',
  },
  'local-only': {
    status: 'local-only',
    saveStateStatus: 'local-only',
    label: 'Local only',
    detail:
      'Applied only to this sandbox/base result. It was not saved to Team Plan history.',
  },
};

export function kindForMutationType(
  mutationType: string
): ArchitectPostActionReceiptKind {
  return KIND_BY_MUTATION_TYPE[mutationType] ?? 'contractAction';
}

function extractEventId(result: PersistMutationResult): string | null {
  const event = result?.event;
  if (!event) return null;
  if (typeof (event as { eventId?: string }).eventId === 'string') {
    return (event as { eventId: string }).eventId;
  }
  if (typeof (event as { id?: string }).id === 'string') {
    return (event as { id: string }).id;
  }
  return null;
}

function extractOccurredAt(result: PersistMutationResult): string | null {
  const event = result?.event as
    | {
        occurredAt?: string;
        timestamp?: string;
      }
    | null
    | undefined;
  return event?.occurredAt || event?.timestamp || null;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const toCleanString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const uniqueStrings = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = toCleanString(value);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
};

const OFFER_SHEET_MUTATION_TYPES = new Set([
  'storeOfferSheet',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
]);

function labelTeam(role: string, teamCode: string | null): string {
  return teamCode ? `${role} ${teamCode}` : role.toLowerCase();
}

function extractOfferSheetReceiptDetails(
  payload: unknown,
  result?: PersistMutationResult | null
) {
  const record = asRecord(payload);
  const metadata = asRecord(result?.metadata);
  const contract = asRecord(record?.contract);
  const salaryRows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];

  return {
    offeringTeamCode:
      toCleanString(record?.offeringTeamCode) ||
      toCleanString(record?.teamCode) ||
      toCleanString(metadata?.offeringTeamCode) ||
      toCleanString(metadata?.offeringTeam),
    homeTeamCode:
      toCleanString(record?.homeTeamCode) ||
      toCleanString(metadata?.homeTeamCode) ||
      toCleanString(metadata?.homeTeam),
    playerId:
      toCleanString(record?.playerId) ||
      toCleanString(metadata?.playerId) ||
      null,
    affectedSeasons: uniqueStrings([
      record?.seasonKey,
      metadata?.seasonKey,
      ...salaryRows.map((row) => asRecord(row)?.season),
    ]),
  };
}

function buildOfferSheetReceiptMessage(
  mutationType: string,
  payload: unknown,
  result?: PersistMutationResult | null
): string | undefined {
  const details = extractOfferSheetReceiptDetails(payload, result);
  const offeringTeam = labelTeam('offering team', details.offeringTeamCode);
  const incumbentTeam = labelTeam('incumbent team', details.homeTeamCode);

  switch (mutationType) {
    case 'storeOfferSheet':
      return `Offer sheet stored for ${offeringTeam}; ${incumbentTeam} must match or decline before any roster move is final.`;
    case 'matchOfferSheet':
      return `${incumbentTeam} matched the offer sheet; ${offeringTeam} does not add the player.`;
    case 'declineOfferSheet':
      return `${incumbentTeam} declined the offer sheet; ${offeringTeam} adds the player.`;
    case 'finalizeMatchedOfferSheet':
      return `Matched offer sheet finalized: ${incumbentTeam} retains the player, and ${offeringTeam} does not add the player.`;
    case 'finalizeDeclinedOfferSheet':
      return `Declined offer sheet finalized: ${offeringTeam} adds the player, and ${incumbentTeam} no longer carries the pending sheet.`;
    default:
      return undefined;
  }
}

function resolveReceiptActionContext({
  mutationType,
  result = null,
  payload,
  actionContext = null,
}: {
  mutationType: string;
  result?: PersistMutationResult | null;
  payload?: unknown;
  actionContext?: ArchitectReceiptActionContext | null;
}): ArchitectReceiptActionContext | null {
  if (!OFFER_SHEET_MUTATION_TYPES.has(mutationType)) {
    return actionContext;
  }

  const details = extractOfferSheetReceiptDetails(payload, result);
  const defaults: ArchitectReceiptActionContext = {
    actionType: ACTION_TYPE_BY_MUTATION_TYPE[mutationType],
    headlineOverride: HEADLINE_BY_MUTATION_TYPE[mutationType],
    message: buildOfferSheetReceiptMessage(mutationType, payload, result),
    playerId: details.playerId,
    affectedSeasons: details.affectedSeasons,
    effectAreas: EFFECT_AREAS_BY_MUTATION_TYPE[mutationType],
    notes: [
      'Offer sheet remains pending until the home team matches, declines, or finalizes the lifecycle.',
    ],
  };

  if (!actionContext) {
    return defaults;
  }

  return {
    actionType: actionContext.actionType || defaults.actionType,
    headlineOverride:
      actionContext.headlineOverride || defaults.headlineOverride,
    message: actionContext.message || defaults.message,
    playerId: actionContext.playerId ?? defaults.playerId,
    playerName: actionContext.playerName ?? defaults.playerName,
    affectedSeasons:
      actionContext.affectedSeasons ?? defaults.affectedSeasons,
    effectAreas: actionContext.effectAreas ?? defaults.effectAreas,
    notes: uniqueStrings([
      ...(defaults.notes || []),
      ...(actionContext.notes || []),
    ]),
  };
}

function extractPayloadTeamCodes(payload: unknown): string[] {
  const record = asRecord(payload);
  if (!record) return [];
  const values: unknown[] = [
    record.teamCode,
    record.homeTeamCode,
    record.offeringTeamCode,
  ];
  if (Array.isArray(record.teams)) {
    for (const team of record.teams) {
      values.push(asRecord(team)?.teamCode);
    }
  }
  return uniqueStrings(values);
}

function extractPayloadPlayerIds(payload: unknown): string[] {
  const record = asRecord(payload);
  if (!record) return [];
  const values: unknown[] = [record.playerId];
  if (Array.isArray(record.teams)) {
    for (const team of record.teams) {
      const teamRecord = asRecord(team);
      const sends = Array.isArray(teamRecord?.sends) ? teamRecord.sends : [];
      for (const player of sends) {
        values.push(asRecord(player)?.playerId);
      }
    }
  }
  return uniqueStrings(values);
}

function extractPayloadPlayerName(payload: unknown): string | null {
  const record = asRecord(payload);
  return (
    toCleanString(record?.playerName) ||
    toCleanString(record?.name) ||
    toCleanString(record?.displayName)
  );
}

function extractChangedTeamCodes(
  result: PersistMutationResult,
  payload?: unknown,
  primaryTeamCode?: string | null
): string[] {
  const teams = result?.changedTeams || [];
  const codes: unknown[] = [primaryTeamCode];
  for (const entry of teams) {
    codes.push(entry?.teamCode);
  }
  if (codes.length === 0 && Array.isArray(result?.writesSummary?.teamCodes)) {
    codes.push(...result.writesSummary.teamCodes);
  } else if (Array.isArray(result?.writesSummary?.teamCodes)) {
    codes.push(...result.writesSummary.teamCodes);
  }
  codes.push(...extractPayloadTeamCodes(payload));
  return uniqueStrings(codes);
}

function extractPrimaryPlayerIds(
  result: PersistMutationResult,
  payload?: unknown,
  actionContext?: ArchitectReceiptActionContext | null
): string[] {
  const updates = result?.changedPlayers || [];
  const ids: unknown[] = [actionContext?.playerId];
  for (const entry of updates) {
    ids.push(entry?.playerId);
  }
  if (Array.isArray(result?.writesSummary?.playerIds)) {
    ids.push(...result.writesSummary.playerIds);
  }
  ids.push(...extractPayloadPlayerIds(payload));
  ids.push(asRecord(result?.metadata)?.playerId);
  return uniqueStrings(ids);
}

export interface DeriveReceiptFromMutationResultArgs {
  mutationType: string;
  result: PersistMutationResult;
  primaryTeamCode?: string | null;
  occurredAt?: string | null;
  headlineOverride?: string;
  payload?: unknown;
  actionContext?: ArchitectReceiptActionContext | null;
}

export interface DeriveReceiptFromTeamSnapshotsArgs
  extends Omit<DeriveReceiptFromMutationResultArgs, 'result'> {
  result?: PersistMutationResult | null;
  beforeTeam: unknown;
  afterTeam: unknown;
  selectedYear: number;
  primaryPlayerIds?: string[];
  authority?: ArchitectPostActionReceiptAuthority;
}

function persistenceForAuthority(
  authority: ArchitectPostActionReceiptAuthority
): ArchitectPostActionPersistence {
  return PERSISTENCE_BY_AUTHORITY[authority];
}

function actionTypeForMutation(
  mutationType: string,
  actionContext?: ArchitectReceiptActionContext | null
): string {
  return (
    actionContext?.actionType ||
    ACTION_TYPE_BY_MUTATION_TYPE[mutationType] ||
    mutationType
  );
}

function effectAreasForMutation(
  mutationType: string,
  actionContext?: ArchitectReceiptActionContext | null
): Set<ArchitectPostActionImpactArea> {
  return new Set(
    actionContext?.effectAreas ||
      EFFECT_AREAS_BY_MUTATION_TYPE[mutationType] ||
      ['cap']
  );
}

function emptySection(
  status: ArchitectPostActionImpactSection['status'],
  summary: string,
  deltas: ArchitectPostActionImpactDelta[] = []
): ArchitectPostActionImpactSection {
  return { status, summary, deltas };
}

const notApplicableSection = (summary = 'No direct effect expected.') =>
  emptySection('not-applicable', summary);

function rosterCount(team: unknown): number | null {
  const record = asRecord(team);
  if (!record) return null;
  if (Array.isArray(record.players)) return record.players.length;
  if (Array.isArray(record.roster)) return record.roster.length;
  return null;
}

function arrayCount(team: unknown, key: string): number | null {
  const value = asRecord(team)?.[key];
  return Array.isArray(value) ? value.length : null;
}

function currencyChange(value: number): string {
  if (value === 0) return '$0';
  const prefix = value > 0 ? '+' : '-';
  return `${prefix}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function countChange(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : String(value);
}

function deriveRosterSection(
  beforeTeam: unknown,
  afterTeam: unknown,
  effectAreas: Set<ArchitectPostActionImpactArea>
): ArchitectPostActionImpactSection {
  const before = rosterCount(beforeTeam);
  const after = rosterCount(afterTeam);
  const changed = before !== null && after !== null && before !== after;
  if (!effectAreas.has('roster') && !changed) {
    return notApplicableSection();
  }
  if (before === null || after === null) {
    return emptySection(
      'partial',
      'Roster effect is expected, but before/after roster counts are not available.'
    );
  }
  const delta = after - before;
  return emptySection(
    'available',
    delta === 0
      ? `Roster count stayed at ${after}.`
      : `Roster count changed ${before} -> ${after} (${countChange(delta)}).`,
    [
      {
        key: 'rosterCount',
        label: 'Roster count',
        unit: 'count',
        before,
        after,
        delta,
      },
    ]
  );
}

function deriveCapSection(
  beforeTeam: unknown,
  afterTeam: unknown,
  selectedYear: number,
  effectAreas: Set<ArchitectPostActionImpactArea>,
  asOfDate: string | null
): ArchitectPostActionImpactSection {
  if (!effectAreas.has('cap')) {
    return notApplicableSection();
  }

  try {
    const before = createCanonicalTeamTotalsSnapshot(
      beforeTeam as TeamCapSheetLike,
      selectedYear,
      { asOfDate }
    );
    const after = createCanonicalTeamTotalsSnapshot(
      afterTeam as TeamCapSheetLike,
      selectedYear,
      { asOfDate }
    );
    const space = (delta: number | null) => delta === null ? null : -delta;
    const beforeCapSpace = space(before.bookDeltas.vsCap);
    const afterCapSpace = space(after.bookDeltas.vsCap);
    const beforeTaxSpace = space(before.bookDeltas.vsLuxuryTax);
    const afterTaxSpace = space(after.bookDeltas.vsLuxuryTax);
    const beforeFirstApronSpace = space(before.bookDeltas.vsFirstApron);
    const afterFirstApronSpace = space(after.bookDeltas.vsFirstApron);
    const beforeSecondApronSpace = space(before.bookDeltas.vsSecondApron);
    const afterSecondApronSpace = space(after.bookDeltas.vsSecondApron);
    const delta = (beforeValue: number | null, afterValue: number | null) =>
      beforeValue === null || afterValue === null ? null : afterValue - beforeValue;
    const capSpaceDelta = delta(beforeCapSpace, afterCapSpace);
    const complete = [
      before.teamSalary,
      after.teamSalary,
      before.apronTeamSalary,
      after.apronTeamSalary,
      before.taxSalary,
      after.taxSalary,
    ].every((value) => value !== null);

    return emptySection(
      complete ? 'available' : 'partial',
      capSpaceDelta === null
        ? `Salary-book impact needs governed input for ${selectedYear}.`
        : capSpaceDelta === 0
        ? `Cap space unchanged for ${selectedYear}.`
        : `Cap space changed ${currencyChange(capSpaceDelta)} for ${selectedYear}.`,
      [
        {
          key: 'capSpace',
          label: 'Cap space',
          unit: 'currency',
          before: beforeCapSpace,
          after: afterCapSpace,
          delta: capSpaceDelta,
        },
        {
          key: 'teamSalary',
          label: 'Team Salary',
          unit: 'currency',
          before: before.teamSalary,
          after: after.teamSalary,
          delta: delta(before.teamSalary, after.teamSalary),
        },
        {
          key: 'apronTeamSalary',
          label: 'Apron Team Salary',
          unit: 'currency',
          before: before.apronTeamSalary,
          after: after.apronTeamSalary,
          delta: delta(before.apronTeamSalary, after.apronTeamSalary),
        },
        {
          key: 'taxSalary',
          label: 'Tax Salary',
          unit: 'currency',
          before: before.taxSalary,
          after: after.taxSalary,
          delta: delta(before.taxSalary, after.taxSalary),
        },
        {
          key: 'taxSpace',
          label: 'Tax space',
          unit: 'currency',
          before: beforeTaxSpace,
          after: afterTaxSpace,
          delta: delta(beforeTaxSpace, afterTaxSpace),
        },
        {
          key: 'firstApronSpace',
          label: 'First apron space',
          unit: 'currency',
          before: beforeFirstApronSpace,
          after: afterFirstApronSpace,
          delta: delta(beforeFirstApronSpace, afterFirstApronSpace),
        },
        {
          key: 'secondApronSpace',
          label: 'Second apron space',
          unit: 'currency',
          before: beforeSecondApronSpace,
          after: afterSecondApronSpace,
          delta: delta(beforeSecondApronSpace, afterSecondApronSpace),
        },
      ]
    );
  } catch (error) {
    return emptySection(
      'unavailable',
      error instanceof Error
        ? `Cap impact unavailable: ${error.message}`
        : 'Cap impact unavailable.'
    );
  }
}

function comparable(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

function formatExceptionValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value.length} TPE${value.length === 1 ? '' : 's'}`;
  }
  const record = asRecord(value);
  if (!record) {
    return value == null ? 'none' : String(value);
  }

  const available =
    typeof record.available === 'boolean'
      ? record.available
      : typeof record.enabled === 'boolean'
        ? record.enabled
        : null;
  const remaining =
    toFiniteNumber(record.remainingAmount) ??
    toFiniteNumber(record.amountRemaining);
  const used = toFiniteNumber(record.usedAmount);

  const parts: string[] = [];
  if (available !== null) {
    parts.push(available ? 'available' : 'unavailable');
  }
  if (remaining !== null) {
    parts.push(`$${Math.round(remaining).toLocaleString()} remaining`);
  }
  if (used !== null) {
    parts.push(`$${Math.round(used).toLocaleString()} used`);
  }
  return parts.length ? parts.join(', ') : 'present';
}

function deriveExceptionsSection(
  beforeTeam: unknown,
  afterTeam: unknown,
  effectAreas: Set<ArchitectPostActionImpactArea>
): ArchitectPostActionImpactSection {
  const before = asRecord(asRecord(beforeTeam)?.exceptions) || {};
  const after = asRecord(asRecord(afterTeam)?.exceptions) || {};
  const keys = uniqueStrings([...Object.keys(before), ...Object.keys(after)]);
  const changedKeys = keys.filter(
    (key) => comparable(before[key]) !== comparable(after[key])
  );

  if (!effectAreas.has('exceptions') && changedKeys.length === 0) {
    return notApplicableSection();
  }

  if (changedKeys.length === 0) {
    return emptySection('available', 'Exception ledger unchanged.');
  }

  return emptySection(
    'available',
    `${changedKeys.length} exception ${changedKeys.length === 1 ? 'entry' : 'entries'} changed.`,
    changedKeys.slice(0, 8).map((key) => ({
      key: `exception:${key}`,
      label: key,
      unit: 'text',
      before: formatExceptionValue(before[key]),
      after: formatExceptionValue(after[key]),
      delta: null,
    }))
  );
}

function deriveRightsSection(
  beforeTeam: unknown,
  afterTeam: unknown,
  effectAreas: Set<ArchitectPostActionImpactArea>
): ArchitectPostActionImpactSection {
  const before = arrayCount(beforeTeam, 'capHolds');
  const after = arrayCount(afterTeam, 'capHolds');
  const changed = before !== null && after !== null && before !== after;
  if (!effectAreas.has('rights') && !changed) {
    return notApplicableSection();
  }
  if (before === null || after === null) {
    return emptySection(
      'partial',
      'Rights/cap-hold effect is expected, but cap-hold counts are not available.'
    );
  }
  const delta = after - before;
  return emptySection(
    'available',
    delta === 0
      ? `Cap hold count stayed at ${after}.`
      : `Cap hold count changed ${before} -> ${after} (${countChange(delta)}).`,
    [
      {
        key: 'capHoldCount',
        label: 'Cap holds',
        unit: 'count',
        before,
        after,
        delta,
      },
    ]
  );
}

function deriveDeadMoneySection(
  beforeTeam: unknown,
  afterTeam: unknown,
  selectedYear: number,
  effectAreas: Set<ArchitectPostActionImpactArea>
): ArchitectPostActionImpactSection {
  const beforeCount = arrayCount(beforeTeam, 'deadCap');
  const afterCount = arrayCount(afterTeam, 'deadCap');
  const beforeAmount = computeDeadMoneyForYear(
    beforeTeam as TeamDeadMoneySourcesLike,
    selectedYear
  );
  const afterAmount = computeDeadMoneyForYear(
    afterTeam as TeamDeadMoneySourcesLike,
    selectedYear
  );
  const countChanged =
    beforeCount !== null && afterCount !== null && beforeCount !== afterCount;
  const amountChanged = beforeAmount !== afterAmount;
  if (!effectAreas.has('deadMoney') && !countChanged && !amountChanged) {
    return notApplicableSection();
  }

  const deltas: ArchitectPostActionImpactDelta[] = [
    {
      key: 'currentYearDeadMoney',
      label: `${selectedYear} dead money`,
      unit: 'currency',
      before: beforeAmount,
      after: afterAmount,
      delta: afterAmount - beforeAmount,
    },
  ];
  if (beforeCount !== null && afterCount !== null) {
    deltas.unshift({
      key: 'deadCapEntryCount',
      label: 'Dead-money entries',
      unit: 'count',
      before: beforeCount,
      after: afterCount,
      delta: afterCount - beforeCount,
    });
  }

  const amountDelta = afterAmount - beforeAmount;
  return emptySection(
    'available',
    amountDelta === 0
      ? `${selectedYear} dead money unchanged.`
      : `${selectedYear} dead money changed ${currencyChange(amountDelta)}.`,
    deltas
  );
}

function deriveContractSection(
  actionContext: ArchitectReceiptActionContext | null | undefined,
  effectAreas: Set<ArchitectPostActionImpactArea>
): ArchitectPostActionImpactSection {
  if (!effectAreas.has('contract')) {
    return notApplicableSection();
  }
  const seasons = uniqueStrings(actionContext?.affectedSeasons || []);
  return emptySection(
    seasons.length > 0 ? 'available' : 'partial',
    seasons.length > 0
      ? `Contract terms changed for ${seasons.join(', ')}.`
      : 'Contract terms changed; affected seasons were not included in the receipt context.'
  );
}

function buildGenericImpact({
  mutationType,
  primaryTeamCode = null,
  primaryPlayerIds = [],
  playerName = null,
  actionContext = null,
}: {
  mutationType: string;
  primaryTeamCode?: string | null;
  primaryPlayerIds?: string[];
  playerName?: string | null;
  actionContext?: ArchitectReceiptActionContext | null;
}): ArchitectPostActionImpact {
  const effectAreas = effectAreasForMutation(mutationType, actionContext);
  const partial = (area: ArchitectPostActionImpactArea, summary: string) =>
    effectAreas.has(area)
      ? emptySection('partial', summary)
      : notApplicableSection();

  return {
    actionType: actionTypeForMutation(mutationType, actionContext),
    mutationType,
    teamCode: primaryTeamCode,
    playerId: primaryPlayerIds[0] || toCleanString(actionContext?.playerId),
    playerName: actionContext?.playerName || playerName,
    affectedSeasons: uniqueStrings(actionContext?.affectedSeasons || []),
    roster: partial(
      'roster',
      'Roster impact committed, but before/after counts are not available in this receipt.'
    ),
    cap: partial(
      'cap',
      'Cap impact committed, but exact before/after totals are not available in this receipt.'
    ),
    exceptions: partial(
      'exceptions',
      'Exception/right impact committed, but before/after ledger values are not available in this receipt.'
    ),
    rights: partial(
      'rights',
      'Rights/cap-hold impact committed, but before/after cap-hold values are not available in this receipt.'
    ),
    deadMoney: partial(
      'deadMoney',
      'Dead-money impact committed, but before/after values are not available in this receipt.'
    ),
    contract: deriveContractSection(actionContext, effectAreas),
    notes: uniqueStrings(actionContext?.notes || []),
  };
}

function buildImpactFromSnapshots({
  mutationType,
  beforeTeam,
  afterTeam,
  selectedYear,
  primaryTeamCode = null,
  primaryPlayerIds = [],
  playerName = null,
  actionContext = null,
  asOfDate = null,
}: {
  mutationType: string;
  beforeTeam: unknown;
  afterTeam: unknown;
  selectedYear: number;
  primaryTeamCode?: string | null;
  primaryPlayerIds?: string[];
  playerName?: string | null;
  actionContext?: ArchitectReceiptActionContext | null;
  asOfDate?: string | null;
}): ArchitectPostActionImpact {
  const effectAreas = effectAreasForMutation(mutationType, actionContext);
  return {
    actionType: actionTypeForMutation(mutationType, actionContext),
    mutationType,
    teamCode: primaryTeamCode,
    playerId: primaryPlayerIds[0] || toCleanString(actionContext?.playerId),
    playerName: actionContext?.playerName || playerName,
    affectedSeasons: uniqueStrings(actionContext?.affectedSeasons || []),
    roster: deriveRosterSection(beforeTeam, afterTeam, effectAreas),
    cap: deriveCapSection(beforeTeam, afterTeam, selectedYear, effectAreas, asOfDate),
    exceptions: deriveExceptionsSection(beforeTeam, afterTeam, effectAreas),
    rights: deriveRightsSection(beforeTeam, afterTeam, effectAreas),
    deadMoney: deriveDeadMoneySection(
      beforeTeam,
      afterTeam,
      selectedYear,
      effectAreas
    ),
    contract: deriveContractSection(actionContext, effectAreas),
    notes: uniqueStrings(actionContext?.notes || []),
  };
}

function buildReceiptMessage(
  impact: ArchitectPostActionImpact,
  actionContext?: ArchitectReceiptActionContext | null
): string | undefined {
  if (actionContext?.message?.trim()) {
    return actionContext.message.trim();
  }
  const summaries = [
    impact.roster,
    impact.cap,
    impact.deadMoney,
    impact.exceptions,
    impact.rights,
    impact.contract,
  ]
    .filter((section) => section.status !== 'not-applicable')
    .map((section) => section.summary)
    .filter(Boolean);

  return summaries.length ? summaries.slice(0, 2).join(' ') : undefined;
}

/**
 * Derive a post-action receipt from an already-successful mutation result.
 * Returns null if the result is missing or unsuccessful — the receipt must
 * never represent a failed/throwing apply.
 */
export function deriveReceiptFromMutationResult({
  mutationType,
  result,
  primaryTeamCode = null,
  occurredAt = null,
  headlineOverride,
  payload,
  actionContext = null,
}: DeriveReceiptFromMutationResultArgs): ArchitectPostActionReceipt | null {
  if (
    !result ||
    result.success !== true ||
    result.skipped === true ||
    result.persistedToWorld === false ||
    result.appliedToLocalState === false
  ) {
    return null;
  }

  const kind = kindForMutationType(mutationType);
  const resolvedActionContext = resolveReceiptActionContext({
    mutationType,
    result,
    payload,
    actionContext,
  });
  const changedTeamCodes = extractChangedTeamCodes(
    result,
    payload,
    primaryTeamCode
  );
  const primaryPlayerIds = extractPrimaryPlayerIds(
    result,
    payload,
    resolvedActionContext
  );
  const eventId = extractEventId(result);
  const headline =
    resolvedActionContext?.headlineOverride ||
    headlineOverride ||
    HEADLINE_BY_MUTATION_TYPE[mutationType] ||
    HEADLINE_BY_KIND[kind];
  const playerName =
    resolvedActionContext?.playerName ||
    extractPayloadPlayerName(payload) ||
    toCleanString(asRecord(result?.metadata)?.playerName);
  const impact = buildGenericImpact({
    mutationType,
    primaryTeamCode,
    primaryPlayerIds,
    playerName,
    actionContext: resolvedActionContext,
  });

  return {
    kind,
    actionType: impact.actionType,
    eventId,
    occurredAt: occurredAt || extractOccurredAt(result),
    headline,
    changedTeamCodes,
    primaryTeamCode: primaryTeamCode || null,
    primaryPlayerIds,
    message: buildReceiptMessage(impact, resolvedActionContext),
    persistence: persistenceForAuthority('committed-world'),
    impact,
    authority: 'committed-world',
  };
}

export function deriveReceiptFromTeamSnapshots({
  mutationType,
  result = null,
  beforeTeam,
  afterTeam,
  selectedYear,
  primaryTeamCode = null,
  primaryPlayerIds = [],
  occurredAt = null,
  headlineOverride,
  payload,
  actionContext = null,
  authority = 'committed-world',
}: DeriveReceiptFromTeamSnapshotsArgs): ArchitectPostActionReceipt | null {
  const resolvedActionContext = resolveReceiptActionContext({
    mutationType,
    result,
    payload,
    actionContext,
  });

  if (authority === 'committed-world' && result) {
    const baseReceipt = deriveReceiptFromMutationResult({
      mutationType,
      result,
      primaryTeamCode,
      occurredAt,
      headlineOverride,
      payload,
      actionContext: resolvedActionContext,
    });
    if (!baseReceipt) return null;

    const mergedPlayerIds = uniqueStrings([
      ...baseReceipt.primaryPlayerIds,
      ...primaryPlayerIds,
      resolvedActionContext?.playerId,
    ]);
    const impact = buildImpactFromSnapshots({
      mutationType,
      beforeTeam,
      afterTeam,
      selectedYear,
      primaryTeamCode,
      primaryPlayerIds: mergedPlayerIds,
      playerName: baseReceipt.impact.playerName,
      actionContext: resolvedActionContext,
      asOfDate: occurredAt || extractOccurredAt(result),
    });

    return {
      ...baseReceipt,
      actionType: impact.actionType,
      primaryPlayerIds: mergedPlayerIds,
      message: buildReceiptMessage(impact, resolvedActionContext),
      impact,
    };
  }

  const kind = kindForMutationType(mutationType);
  const changedTeamCodes = uniqueStrings([
    primaryTeamCode,
    ...extractPayloadTeamCodes(payload),
  ]);
  const mergedPlayerIds = uniqueStrings([
    ...primaryPlayerIds,
    resolvedActionContext?.playerId,
    ...extractPayloadPlayerIds(payload),
  ]);
  const playerName =
    resolvedActionContext?.playerName || extractPayloadPlayerName(payload);
  const impact = buildImpactFromSnapshots({
    mutationType,
    beforeTeam,
    afterTeam,
    selectedYear,
    primaryTeamCode,
    primaryPlayerIds: mergedPlayerIds,
    playerName,
    actionContext: resolvedActionContext,
    asOfDate: occurredAt,
  });

  return {
    kind,
    actionType: impact.actionType,
    eventId: null,
    occurredAt: occurredAt || new Date().toISOString(),
    headline:
      resolvedActionContext?.headlineOverride ||
      headlineOverride ||
      HEADLINE_BY_MUTATION_TYPE[mutationType] ||
      HEADLINE_BY_KIND[kind],
    changedTeamCodes,
    primaryTeamCode: primaryTeamCode || null,
    primaryPlayerIds: mergedPlayerIds,
    message: buildReceiptMessage(impact, resolvedActionContext),
    persistence: persistenceForAuthority(authority),
    impact,
    authority,
  };
}

export interface DeriveSeasonAdvanceReceiptArgs {
  aftermath: WorldAdvanceAftermath;
  primaryTeamCode?: string | null;
}

/**
 * Derive a conservative receipt for a successful committed offseason
 * advance from authoritative aftermath data. Headline includes the next
 * season label when available.
 */
export function deriveSeasonAdvanceReceipt({
  aftermath,
  primaryTeamCode = null,
}: DeriveSeasonAdvanceReceiptArgs): ArchitectPostActionReceipt | null {
  if (!aftermath || typeof aftermath.nextWorldSeason !== 'string') {
    return null;
  }
  const headline = aftermath.nextWorldSeason
    ? `Season advanced to ${aftermath.nextWorldSeason}`
    : HEADLINE_BY_KIND.seasonAdvance;
  const impact = buildGenericImpact({
    mutationType: 'seasonAdvance',
    primaryTeamCode,
    actionContext: {
      actionType: 'season-advance',
      headlineOverride: headline,
      effectAreas: ['roster', 'cap', 'exceptions', 'rights', 'deadMoney'],
      notes: [
        'Season advance receipt is based on authoritative offseason aftermath.',
      ],
    },
  });
  return {
    kind: 'seasonAdvance',
    actionType: 'season-advance',
    eventId: null,
    occurredAt: null,
    headline,
    changedTeamCodes: primaryTeamCode ? [primaryTeamCode] : [],
    primaryTeamCode: primaryTeamCode || null,
    primaryPlayerIds: [],
    message: buildReceiptMessage(impact),
    persistence: persistenceForAuthority('committed-world'),
    impact,
    authority: 'committed-world',
  };
}
