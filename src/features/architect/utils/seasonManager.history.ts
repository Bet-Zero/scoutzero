/** Immutable Season Advance history, reconciliation, and fail-closed checks. */

import { AUTHORITATIVE_WORLD_TEAM_CODES } from './mutationPipeline.helpers';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import { toEndYear } from './seasonFormat';
import { createContractEventLedger } from './contractHistory';
import { ContractEventLedgerPayloadZ } from '@/schemas/contractEventLedger';
import {
  SeasonHistoryRecordZ,
  SeasonTransitionManifestZ,
  type SeasonContractTransitionEvent,
  type SeasonHistoryRecord,
  type SeasonTransitionManifest,
} from '@/schemas/seasonTransition';
import {
  TeamSalaryBookInputsZ,
  type SeasonCloseApronMeasurement,
} from '@/schemas/salaryBooks';
import type { OffseasonOptionDecisionMap } from './offseason/resolveOffseasonTransition';
import type { SeasonAdvanceAuthority } from './seasonManager.authority';

type UnknownRecord = Record<string, unknown>;

export type PreparedSeasonAdvanceTeam = {
  teamCode: string;
  beforeTeam: UnknownRecord;
  committedTeam: UnknownRecord;
  beforeTotals: UnknownRecord;
  afterTotals: UnknownRecord;
  historyRecord: SeasonHistoryRecord;
  teamRecord: SeasonTransitionManifest['teamRecords'][number];
};

type OptionEventReference = NonNullable<
  SeasonContractTransitionEvent['sourceContractEvent']
>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const playerId = (player: UnknownRecord): string | null =>
  stringValue(player.player_id ?? player.playerId ?? player.id);

const contractId = (
  ...players: Array<UnknownRecord | undefined>
): string | null => {
  for (const player of players) {
    const contract =
      player && isRecord(player.contract) ? player.contract : null;
    const id = stringValue(contract?.contractId ?? contract?.id);
    if (id) return id;
  }
  return null;
};

function jsonClone(value: unknown): unknown {
  return value === undefined
    ? null
    : (JSON.parse(JSON.stringify(value)) as unknown);
}

function entitlementState(team: UnknownRecord): UnknownRecord {
  return {
    entitlementIds: jsonClone(team.entitlementIds ?? []),
    draftPicks: jsonClone(team.draftPicks ?? []),
    draftPicksInventory: jsonClone(team.draftPicksInventory ?? []),
    draftPicksObligations: jsonClone(team.draftPicksObligations ?? []),
    draftPicksContested: jsonClone(team.draftPicksContested ?? []),
  };
}

export function assertThirtyTeamLeague(teams: readonly UnknownRecord[]): void {
  const expected = new Set<string>(AUTHORITATIVE_WORLD_TEAM_CODES);
  const actual = teams.map((team) => stringValue(team.teamCode));
  const unique = new Set(
    actual.filter((code): code is string => code !== null)
  );
  const missing = [...expected].filter((code) => !unique.has(code));
  const unexpected = [...unique].filter((code) => !expected.has(code));
  if (
    teams.length !== AUTHORITATIVE_WORLD_TEAM_CODES.length ||
    actual.some((code) => code === null) ||
    unique.size !== AUTHORITATIVE_WORLD_TEAM_CODES.length ||
    missing.length > 0 ||
    unexpected.length > 0
  ) {
    throw new Error(
      `Season Advance requires exactly the governed 30-team league. Missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}; loaded: ${teams.length}.`
    );
  }
}

function normalizeOptionType(value: unknown): 'player' | 'team' | 'eto' | null {
  const normalized = stringValue(value)?.toLowerCase() ?? '';
  if (normalized === 'eto' || normalized.includes('early termination')) {
    return 'eto';
  }
  if (normalized === 'player' || normalized.includes('player')) return 'player';
  if (normalized === 'team' || normalized.includes('team')) return 'team';
  return null;
}

type RequiredOption = {
  teamCode: string;
  playerId: string;
  optionType: 'player' | 'team' | 'eto';
};

function requiredOptions(
  teams: readonly UnknownRecord[],
  toSeason: string
): Map<string, RequiredOption> {
  const toYear = toEndYear(toSeason);
  const required = new Map<string, RequiredOption>();
  for (const team of teams) {
    const teamCode = stringValue(team.teamCode);
    if (!teamCode) continue;
    const players = Array.isArray(team.players) ? team.players : [];
    for (const rawPlayer of players) {
      if (!isRecord(rawPlayer)) continue;
      const id = playerId(rawPlayer);
      const contract = isRecord(rawPlayer.contract) ? rawPlayer.contract : null;
      const rows = Array.isArray(contract?.salariesByYear)
        ? contract.salariesByYear.filter(
            (row) =>
              isRecord(row) &&
              toEndYear(stringValue(row.season)) === toYear &&
              stringValue(row.option) !== null
          )
        : [];
      if (rows.length > 1) {
        throw new Error(
          `Conflicting option rows for ${teamCode}/${id || 'missing-player-id'} in ${toSeason}.`
        );
      }
      if (rows.length === 0) continue;
      const optionType = normalizeOptionType((rows[0] as UnknownRecord).option);
      if (!id || !optionType) {
        throw new Error(
          `Unsupported option authority for ${teamCode}/${id || 'missing-player-id'} in ${toSeason}.`
        );
      }
      if (required.has(id)) {
        throw new Error(`Conflicting league option identity for player ${id}.`);
      }
      required.set(id, { teamCode, playerId: id, optionType });
    }
  }
  return required;
}

function matchingOptionEvent(
  team: UnknownRecord,
  requirement: RequiredOption,
  decision: 'exercise' | 'decline',
  effectiveAt: string
): OptionEventReference {
  const rawLedgers = Array.isArray(team.contractEventLedgers)
    ? team.contractEventLedgers
    : [];
  const expectedKind =
    requirement.optionType === 'eto' ? `eto-${decision}` : `option-${decision}`;
  const matches: OptionEventReference[] = [];

  for (const rawLedger of rawLedgers) {
    const payload = ContractEventLedgerPayloadZ.parse(rawLedger);
    const ledger = createContractEventLedger(payload);
    for (const event of ledger.events) {
      if (
        event.recordStatus === 'current' &&
        event.playerId === requirement.playerId &&
        event.teamId === requirement.teamCode &&
        event.eventKind === expectedKind &&
        Date.parse(event.effectiveAt) <= Date.parse(effectiveAt)
      ) {
        matches.push({
          ledgerId: ledger.ledgerId,
          ledgerVersion: ledger.ledgerVersion,
          eventId: event.eventId,
          eventVersion: event.eventVersion,
          eventKind: event.eventKind as OptionEventReference['eventKind'],
        });
      }
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Explicit option decision for ${requirement.teamCode}/${requirement.playerId} requires exactly one current immutable governed contract event; found ${matches.length}.`
    );
  }
  return matches[0];
}

/**
 * Validate every league option decision before team processing. Extras,
 * omissions, wrong-year/type entries, and missing immutable event authority all
 * fail before any transaction write is staged.
 */
export function resolveCompleteOptionAuthority(args: {
  teams: readonly UnknownRecord[];
  optionDecisions: OffseasonOptionDecisionMap;
  toSeason: string;
  transitionEffectiveAt: string;
}): Map<string, OptionEventReference> {
  const required = requiredOptions(args.teams, args.toSeason);
  const decisionKeys = Object.keys(args.optionDecisions);
  const extras = decisionKeys.filter((key) => !required.has(key));
  const missing = [...required.keys()].filter(
    (key) => !Object.prototype.hasOwnProperty.call(args.optionDecisions, key)
  );
  if (extras.length > 0 || missing.length > 0) {
    throw new Error(
      `Option decisions are incomplete or conflicting. Missing: ${missing.join(', ') || 'none'}; unsupported extras: ${extras.join(', ') || 'none'}.`
    );
  }

  const byTeam = new Map(
    args.teams.map((team) => [stringValue(team.teamCode), team])
  );
  const references = new Map<string, OptionEventReference>();
  for (const [id, requirement] of required) {
    const rawDecision = args.optionDecisions[id];
    if (!isRecord(rawDecision)) {
      throw new Error(`Option decision for ${id} must be an explicit object.`);
    }
    const decision = rawDecision.decision;
    const optionType = normalizeOptionType(rawDecision.optionType);
    if (
      (decision !== 'exercise' && decision !== 'decline') ||
      rawDecision.season !== args.toSeason ||
      optionType !== requirement.optionType
    ) {
      throw new Error(
        `Option decision for ${id} has a wrong-year, malformed, or conflicting decision/type.`
      );
    }
    const team = byTeam.get(requirement.teamCode);
    if (!team) throw new Error(`Missing option team ${requirement.teamCode}.`);
    references.set(
      id,
      matchingOptionEvent(
        team,
        requirement,
        decision,
        args.transitionEffectiveAt
      )
    );
  }
  return references;
}

export function assertEntitlementsPreserved(
  beforeTeam: UnknownRecord,
  afterTeam: UnknownRecord,
  teamCode: string
): string {
  const before = mutationSnapshotDigest(entitlementState(beforeTeam));
  const after = mutationSnapshotDigest(entitlementState(afterTeam));
  if (before !== after) {
    throw new Error(
      `Required entitlement transition for ${teamCode} is unsupported under the preserved CBA2-A12.3/CBA2-L09.2 boundary.`
    );
  }
  return before;
}

export function requireSeasonCloseApronMeasurement(
  team: UnknownRecord,
  authority: SeasonAdvanceAuthority,
  teamCode: string
): SeasonCloseApronMeasurement {
  const parsedInputs = TeamSalaryBookInputsZ.safeParse(team.salaryBookInputs);
  if (!parsedInputs.success) {
    throw new Error(
      `Missing or malformed governed salary-book inputs for ${teamCode}.`
    );
  }
  const measurement = parsedInputs.data.seasonCloseApronMeasurement;
  if (
    !measurement ||
    measurement.teamCode !== teamCode ||
    measurement.seasonKey !== authority.fromSeason ||
    measurement.salaryCapYear !== authority.fromSalaryCapYear ||
    measurement.regularSeasonClosing !== authority.seasonCloseDate
  ) {
    throw new Error(
      `Missing, wrong-year, stale, or conflicting season-close Apron measurement for ${teamCode}.`
    );
  }
  return measurement;
}

export function assertCompleteIndependentBooks(
  totals: UnknownRecord,
  authority: SeasonAdvanceAuthority,
  teamCode: string
): void {
  const books = isRecord(totals.salaryBooks) ? totals.salaryBooks : null;
  const context = books && isRecord(books.context) ? books.context : null;
  const ledgers = books && isRecord(books.ledgers) ? books.ledgers : null;
  const complete = (key: string) =>
    ledgers &&
    isRecord(ledgers[key]) &&
    ledgers[key].status === 'complete' &&
    typeof ledgers[key].total === 'number' &&
    Number.isFinite(ledgers[key].total);
  if (
    books?.status !== 'complete' ||
    context?.salaryCapYear !== authority.toSalaryCapYear ||
    context?.asOfDate !== authority.transitionEffectiveAt ||
    !complete('teamSalary') ||
    !complete('apronTeamSalary') ||
    !complete('taxSalary')
  ) {
    throw new Error(
      `Independent Team/Apron/Tax books are incomplete or divergent for ${teamCode}.`
    );
  }
}

function contractTransitionEvents(args: {
  worldId: string;
  teamCode: string;
  transitionId: string;
  beforeTeam: UnknownRecord;
  afterTeam: UnknownRecord;
  effectiveAt: string;
  optionDecisions: OffseasonOptionDecisionMap;
  optionReferences: Map<string, OptionEventReference>;
}): SeasonContractTransitionEvent[] {
  const beforePlayers = new Map(
    (Array.isArray(args.beforeTeam.players)
      ? args.beforeTeam.players.filter(isRecord)
      : []
    ).map((player) => [playerId(player), player])
  );
  const afterPlayers = new Map(
    (Array.isArray(args.afterTeam.players)
      ? args.afterTeam.players.filter(isRecord)
      : []
    ).map((player) => [playerId(player), player])
  );
  const events: SeasonContractTransitionEvent[] = [];
  const changedPlayerIds = new Set([
    ...beforePlayers.keys(),
    ...afterPlayers.keys(),
  ]);
  changedPlayerIds.delete(null);
  for (const id of changedPlayerIds) {
    if (!id) continue;
    const beforePlayer = beforePlayers.get(id);
    const afterPlayer = afterPlayers.get(id);
    const beforeContract =
      beforePlayer && isRecord(beforePlayer.contract)
        ? beforePlayer.contract
        : null;
    const afterContract =
      afterPlayer && isRecord(afterPlayer.contract)
        ? afterPlayer.contract
        : null;
    if (!beforeContract && !afterContract) continue;
    const beforeDigest = mutationSnapshotDigest(beforeContract);
    const afterDigest = mutationSnapshotDigest(afterContract);
    if (beforeDigest === afterDigest) continue;
    const rawDecision = args.optionDecisions[id];
    const decision = isRecord(rawDecision) ? rawDecision.decision : null;
    const eventKind =
      decision === 'exercise'
        ? 'option-exercised'
        : decision === 'decline'
          ? 'option-declined'
          : !beforeContract && afterContract
            ? 'contract-activated'
            : afterContract
              ? 'contract-rolled'
              : 'contract-expired';
    events.push({
      eventId: `${args.transitionId}:${args.teamCode}:${id}:contract`,
      eventVersion: 1,
      eventKind,
      worldId: args.worldId,
      teamCode: args.teamCode,
      playerId: id,
      contractId: contractId(beforePlayer, afterPlayer),
      effectiveAt: args.effectiveAt,
      beforeContract: jsonClone(
        beforeContract
      ) as SeasonContractTransitionEvent['beforeContract'],
      afterContract: jsonClone(
        afterContract
      ) as SeasonContractTransitionEvent['afterContract'],
      beforeContractDigest: beforeDigest,
      afterContractDigest: afterDigest,
      sourceContractEvent: args.optionReferences.get(id) ?? null,
      canonLeafIds:
        eventKind === 'option-exercised' || eventKind === 'option-declined'
          ? ['CBA2-L02.1']
          : ['CBA2-L06.2'],
    });
  }
  return events;
}

function finalRosterSnapshot(team: UnknownRecord, teamCode: string): unknown[] {
  if (!Array.isArray(team.roster) || !Array.isArray(team.players)) {
    throw new Error(
      `Prior-season final roster authority is missing for ${teamCode}.`
    );
  }
  const playersById = new Map<string, UnknownRecord>();
  for (const rawPlayer of team.players) {
    if (!isRecord(rawPlayer)) {
      throw new Error(
        `Prior-season final roster contains malformed player state for ${teamCode}.`
      );
    }
    const id = playerId(rawPlayer);
    if (!id || playersById.has(id)) {
      throw new Error(
        `Prior-season final roster contains missing or duplicate player identity for ${teamCode}.`
      );
    }
    playersById.set(id, rawPlayer);
  }
  const rosterIds = team.roster.map((entry) =>
    typeof entry === 'string'
      ? stringValue(entry)
      : isRecord(entry)
        ? playerId(entry)
        : null
  );
  if (
    rosterIds.some((id) => id === null) ||
    new Set(rosterIds).size !== rosterIds.length ||
    rosterIds.length !== playersById.size ||
    rosterIds.some((id) => !id || !playersById.has(id))
  ) {
    throw new Error(
      `Prior-season final roster is incomplete or conflicting for ${teamCode}.`
    );
  }
  return rosterIds.map((id) => jsonClone(playersById.get(id as string)));
}

export function buildPreparedSeasonAdvanceTeam(args: {
  worldId: string;
  transitionId: string;
  teamCode: string;
  beforeTeam: UnknownRecord;
  committedTeam: UnknownRecord;
  beforeTotals: UnknownRecord;
  afterTotals: UnknownRecord;
  authority: SeasonAdvanceAuthority;
  authorityDigest: string;
  optionDecisions: OffseasonOptionDecisionMap;
  optionReferences: Map<string, OptionEventReference>;
}): PreparedSeasonAdvanceTeam {
  const measurement = requireSeasonCloseApronMeasurement(
    args.beforeTeam,
    args.authority,
    args.teamCode
  );
  assertCompleteIndependentBooks(
    args.afterTotals,
    args.authority,
    args.teamCode
  );
  const entitlementStateDigest = assertEntitlementsPreserved(
    args.beforeTeam,
    args.committedTeam,
    args.teamCode
  );
  const finalRoster = finalRosterSnapshot(args.beforeTeam, args.teamCode);
  const historyId = `${args.authority.fromSeason}__${args.teamCode}`;
  const contractEvents = contractTransitionEvents({
    worldId: args.worldId,
    teamCode: args.teamCode,
    transitionId: args.transitionId,
    beforeTeam: args.beforeTeam,
    afterTeam: args.committedTeam,
    effectiveAt: args.authority.transitionEffectiveAt,
    optionDecisions: args.optionDecisions,
    optionReferences: args.optionReferences,
  });
  const historyRecord = SeasonHistoryRecordZ.parse({
    schemaVersion: 'season-history-v1',
    historyId,
    transitionId: args.transitionId,
    worldId: args.worldId,
    teamCode: args.teamCode,
    fromSeason: args.authority.fromSeason,
    toSeason: args.authority.toSeason,
    seasonCloseDate: args.authority.seasonCloseDate,
    transitionEffectiveAt: args.authority.transitionEffectiveAt,
    preAdvanceState: jsonClone(args.beforeTeam),
    preAdvanceStateDigest: mutationSnapshotDigest(args.beforeTeam),
    finalRoster,
    finalRosterDigest: mutationSnapshotDigest(finalRoster),
    seasonCloseApronMeasurement: measurement,
    beforeTotals: jsonClone(args.beforeTotals),
    afterTotals: jsonClone(args.afterTotals),
    contractEvents,
    entitlementStateDigest,
    authorityDigest: args.authorityDigest,
  });
  return {
    teamCode: args.teamCode,
    beforeTeam: args.beforeTeam,
    committedTeam: args.committedTeam,
    beforeTotals: args.beforeTotals,
    afterTotals: args.afterTotals,
    historyRecord,
    teamRecord: {
      teamCode: args.teamCode,
      historyId,
      preAdvanceStateDigest: historyRecord.preAdvanceStateDigest,
      committedStateDigest: mutationSnapshotDigest(args.committedTeam),
      finalRosterDigest: historyRecord.finalRosterDigest,
      seasonCloseApronMeasurementDigest: mutationSnapshotDigest(measurement),
      entitlementStateDigest,
      contractEventIds: contractEvents.map((event) => event.eventId),
      booksStatus: 'complete',
    },
  };
}

export function buildSeasonTransitionManifest(args: {
  transitionId: string;
  operationId: string;
  eventId: string;
  worldId: string;
  occurredAt: string;
  authority: SeasonAdvanceAuthority;
  authorityDigest: string;
  preAdvanceMetadataDigest: string;
  teams: PreparedSeasonAdvanceTeam[];
}): SeasonTransitionManifest {
  return SeasonTransitionManifestZ.parse({
    schemaVersion: 'season-transition-manifest-v1',
    transitionId: args.transitionId,
    operationId: args.operationId,
    eventId: args.eventId,
    worldId: args.worldId,
    fromSeason: args.authority.fromSeason,
    toSeason: args.authority.toSeason,
    fromSalaryCapYear: args.authority.fromSalaryCapYear,
    toSalaryCapYear: args.authority.toSalaryCapYear,
    seasonCloseDate: args.authority.seasonCloseDate,
    transitionEffectiveAt: args.authority.transitionEffectiveAt,
    committedAt: args.occurredAt,
    authority: jsonClone(args.authority),
    authorityDigest: args.authorityDigest,
    entitlementBoundary: jsonClone(args.authority.entitlementBoundary),
    preAdvanceMetadataDigest: args.preAdvanceMetadataDigest,
    teamRecords: args.teams.map((team) => team.teamRecord),
    reconciliation: {
      expectedTeamCount: 30,
      preparedTeamCount: args.teams.length,
      completeBookCount: args.teams.filter(
        (team) => team.teamRecord.booksStatus === 'complete'
      ).length,
      historyRecordCount: args.teams.filter((team) => team.historyRecord)
        .length,
      entitlementPreservationCount: args.teams.filter(
        (team) => Boolean(team.teamRecord.entitlementStateDigest)
      ).length,
    },
    canonLeafIds: ['CBA2-L02.1', 'CBA2-L06.2', 'CBA2-L08.1', 'CBA2-L09.2'],
  });
}
