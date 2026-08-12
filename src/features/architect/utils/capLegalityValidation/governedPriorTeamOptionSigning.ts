/**
 * Governed CBA2-C16.7 enforcement for a Prior Team re-signing after it
 * declines a Rookie Scale Team Option.
 *
 * This validator is pure. It consumes the saved-world cap hold and immutable
 * contract-event ledger that BZE-275 created, authenticates their relationship,
 * and compares only first-year Salary plus Unlikely Bonuses to the declined
 * Salary. It deliberately does not generalize into other option or signing
 * routes.
 */

import { ContractEventLedgerPayloadZ } from '@/schemas/contractEventLedger';
import type { ContractEventRecord } from '@/schemas/contractEventLedger';
import {
  createContractEventLedger,
  walkChain,
  type LifecycleEventLedger,
} from '@/features/architect/utils/contractHistory';
import { canonicalStringify } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import type {
  CapLegalityViolation,
  MutationCapHold,
  MutationContract,
  MutationPlayer,
  MutationTeam,
  MutationValidationResult,
} from './schema';

const AUTHORITY_RULE = 'governed_rookie_option_signing_record_invalid';
const CEILING_RULE = 'governed_rookie_option_offer_exceeds_ceiling';

function toExactCents(amount: number): number | null {
  const scaled = amount * 100;
  const cents = Math.round(scaled);
  const floatingPointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Number.isSafeInteger(cents) &&
    Math.abs(scaled - cents) <= floatingPointTolerance
    ? cents
    : null;
}

type AuthorityFailureKind =
  | 'missing'
  | 'duplicate'
  | 'malformed'
  | 'unauthenticated'
  | 'mismatch'
  | 'stale';

type GovernedDecline = {
  ledger: LifecycleEventLedger;
  event: ContractEventRecord;
  declinedSalary: number;
  salaryCapYear: number;
};

export type ValidateGovernedPriorTeamOptionSigningParams = {
  team: MutationTeam;
  player: MutationPlayer;
  contract: MutationContract | null | undefined;
  worldId?: string | null;
  year: number;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
};

function playerIdOf(player: MutationPlayer): string {
  return String(player.playerId || player.player_id || player.id || '').trim();
}

function teamIdOf(team: MutationTeam): string {
  return String(team.teamCode || team.code || '').trim();
}

function holdPlayerId(hold: MutationCapHold): string {
  return String(hold.playerId ?? '').trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rawLedgerIsRelated(
  value: unknown,
  playerId: string,
  linkedEventIds: ReadonlySet<string>
): boolean {
  const record = asRecord(value);
  const events = record?.events;
  if (!Array.isArray(events)) return false;
  return events.some((entry) => {
    const event = asRecord(entry);
    if (!event) return false;
    return (
      String(event.playerId ?? '').trim() === playerId ||
      linkedEventIds.has(String(event.eventId ?? '').trim())
    );
  });
}

function authorityMessage(kind: AuthorityFailureKind): string {
  switch (kind) {
    case 'missing':
      return 'This re-signing needs its linked declined-option record before the offer can be checked. No changes were saved.';
    case 'duplicate':
      return 'This re-signing has more than one declined-option record or cap hold. Resolve the duplicate before continuing. No changes were saved.';
    case 'stale':
      return 'This re-signing cannot proceed because the declined-option record is no longer the current Contract event. No changes were saved.';
    case 'malformed':
      return 'This re-signing cannot proceed because the declined-option record is incomplete. No changes were saved.';
    case 'unauthenticated':
      return 'This re-signing cannot proceed because the declined-option record has no authenticated author. No changes were saved.';
    case 'mismatch':
      return 'This re-signing cannot proceed because the declined-option record no longer matches this player, Prior Team, Contract, Season, or amount. No changes were saved.';
  }
}

function blocked(
  kind: AuthorityFailureKind,
  detail: string
): MutationValidationResult {
  const violation: CapLegalityViolation = {
    rule: AUTHORITY_RULE,
    message: authorityMessage(kind),
    severity: 'error',
    failureKind: kind,
    detail,
  };
  return { valid: false, violations: [violation], warnings: [] };
}

function allowed(): MutationValidationResult {
  return { valid: true, violations: [], warnings: [] };
}

function currentContractChain(
  ledger: LifecycleEventLedger,
  event: ContractEventRecord
): ContractEventRecord[] | null {
  return walkChain(
    ledger.events.filter(
      (entry) =>
        entry.recordStatus === 'current' &&
        entry.worldId === event.worldId &&
        entry.contractId === event.contractId
    )
  );
}

function inspectRookieScaleDecline({
  ledger,
  event,
  worldId,
  teamId,
  playerId,
}: {
  ledger: LifecycleEventLedger;
  event: ContractEventRecord;
  worldId: string;
  teamId: string;
  playerId: string;
}):
  | { status: 'not-applicable' }
  | { status: 'invalid'; kind: AuthorityFailureKind; detail: string }
  | { status: 'applicable'; decline: GovernedDecline } {
  if (event.eventKind !== 'option-decline') {
    return { status: 'not-applicable' };
  }

  if (event.resultingState.terms.isRookieScale !== true) {
    return { status: 'not-applicable' };
  }

  if (!event.authoringIdentity?.trim()) {
    return {
      status: 'invalid',
      kind: 'unauthenticated',
      detail: 'The governed option decline has no authenticated author identity.',
    };
  }

  if (
    event.worldId !== worldId ||
    event.teamId !== teamId ||
    event.playerId !== playerId
  ) {
    return {
      status: 'invalid',
      kind: 'mismatch',
      detail:
        'The linked option event has a different world, team, or player identity.',
    };
  }

  if (ledger.ledgerId !== `${worldId}:${event.contractId}:contract`) {
    return {
      status: 'invalid',
      kind: 'mismatch',
      detail:
        'The Contract ledger identity does not match the linked Contract.',
    };
  }

  if (
    ledger.events.some(
      (entry) =>
        entry.contractId !== event.contractId ||
        entry.worldId !== worldId ||
        entry.teamId !== teamId ||
        entry.playerId !== playerId
    )
  ) {
    return {
      status: 'invalid',
      kind: 'mismatch',
      detail:
        'The linked ledger mixes Contract, world, team, or player identities.',
    };
  }

  const chain = currentContractChain(ledger, event);
  if (!chain) {
    return {
      status: 'invalid',
      kind: 'malformed',
      detail: 'The linked Contract event chain cannot be replayed as one line.',
    };
  }

  const eventIndex = chain.findIndex(
    (entry) =>
      entry.eventId === event.eventId &&
      entry.eventVersion === event.eventVersion
  );
  if (eventIndex < 0) {
    return {
      status: 'invalid',
      kind: 'missing',
      detail: 'The linked event is not a current event in its Contract chain.',
    };
  }
  if (eventIndex !== chain.length - 1) {
    return {
      status: 'invalid',
      kind: 'stale',
      detail: 'A later Contract event succeeds the linked option decline.',
    };
  }

  const predecessor = chain[eventIndex - 1];
  if (
    !predecessor ||
    event.predecessorEventId !== predecessor.eventId ||
    event.predecessorContractVersion !== predecessor.resultingContractVersion ||
    event.resultingContractVersion !== predecessor.resultingContractVersion + 1
  ) {
    return {
      status: 'invalid',
      kind: 'malformed',
      detail:
        'The option decline does not consume the immediately preceding Contract version.',
    };
  }

  const predecessorState = predecessor.resultingState;
  const resultingState = event.resultingState;
  const predecessorSalaries = predecessorState.terms.salaries;
  const resultingSalaries = resultingState.terms.salaries;
  const optionIndex = resultingSalaries.length;
  const declinedRow = predecessorSalaries[optionIndex];
  const declinedYear = toEndYear(declinedRow?.season);

  if (
    predecessorState.terms.isRookieScale !== true ||
    predecessorState.terms.contractLength !== 4 ||
    predecessorSalaries.length !== 4 ||
    (optionIndex !== 2 && optionIndex !== 3) ||
    !declinedRow ||
    declinedRow.option !== 'TO' ||
    declinedRow.optionHolder !== 'team' ||
    declinedRow.optionUsed !== null ||
    !Number.isInteger(declinedYear)
  ) {
    return {
      status: 'invalid',
      kind: 'malformed',
      detail:
        'The predecessor Contract does not establish the declined third- or fourth-Season Rookie Scale Team Option.',
    };
  }

  if (
    resultingState.terms.contractLength !== resultingSalaries.length ||
    canonicalStringify(resultingSalaries) !==
      canonicalStringify(predecessorSalaries.slice(0, optionIndex))
  ) {
    return {
      status: 'invalid',
      kind: 'mismatch',
      detail:
        'The resulting Contract is not the exact prefix created by the option decline.',
    };
  }

  const contractEndsAt = declinedRow.optionDecisionTerms?.contractEndsAt.value;
  const expectedEventId = `${event.contractId}:to:${toSeasonCode(
    declinedYear as number
  )}:decline:v${event.resultingContractVersion}`;
  const freeAgency = resultingState.terms.freeAgency;
  if (
    contractEndsAt !== event.effectiveAt ||
    event.eventId !== expectedEventId ||
    freeAgency.type !== 'UFA' ||
    freeAgency.year !== declinedYear ||
    freeAgency.hasOption !== false
  ) {
    return {
      status: 'invalid',
      kind: 'mismatch',
      detail:
        'The decline decision, effective boundary, event identity, or resulting Free Agency Season conflicts with the Contract.',
    };
  }

  const declinedSalary = declinedRow.salary;
  if (
    typeof declinedSalary !== 'number' ||
    !Number.isFinite(declinedSalary) ||
    declinedSalary < 0 ||
    toExactCents(declinedSalary) === null
  ) {
    return {
      status: 'invalid',
      kind: 'malformed',
      detail:
        'The declined option Salary is not established as a finite amount.',
    };
  }

  return {
    status: 'applicable',
    decline: {
      ledger,
      event,
      declinedSalary,
      salaryCapYear: declinedYear as number,
    },
  };
}

function findEventMatches(
  ledgers: readonly LifecycleEventLedger[],
  eventId: string
): Array<{ ledger: LifecycleEventLedger; event: ContractEventRecord }> {
  return ledgers.flatMap((ledger) =>
    ledger.events
      .filter(
        (event) => event.recordStatus === 'current' && event.eventId === eventId
      )
      .map((event) => ({ ledger, event }))
  );
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function validateGovernedPriorTeamOptionSigning({
  team,
  player,
  contract,
  worldId: worldIdInput,
  year,
  asOfDate,
  dateDefaulted = false,
}: ValidateGovernedPriorTeamOptionSigningParams): MutationValidationResult {
  const playerId = playerIdOf(player);
  const teamId = teamIdOf(team);
  const worldId = String(worldIdInput ?? '').trim();
  if (!teamId || !playerId) {
    return blocked('missing', 'Team or player identity is missing.');
  }
  const playerHolds = (team.capHolds || []).filter(
    (hold) => holdPlayerId(hold) === playerId
  );
  const linkedEventIds = new Set(
    playerHolds
      .map((hold) => String(hold.governedContractEventId ?? '').trim())
      .filter(Boolean)
  );
  const assertedGovernedHold = playerHolds.some(
    (hold) =>
      hold.priorTeamOfferCeiling !== undefined ||
      String(hold.governedContractEventId ?? '').trim().length > 0
  );

  const rawLedgers = Array.isArray(team.contractEventLedgers)
    ? team.contractEventLedgers
    : [];
  const ledgers: LifecycleEventLedger[] = [];
  for (const rawLedger of rawLedgers) {
    const related = rawLedgerIsRelated(rawLedger, playerId, linkedEventIds);
    const parsed = ContractEventLedgerPayloadZ.safeParse(rawLedger);
    if (!parsed.success) {
      if (related || assertedGovernedHold) {
        return blocked(
          'malformed',
          'A related Contract ledger payload is malformed.'
        );
      }
      continue;
    }
    try {
      ledgers.push(createContractEventLedger(parsed.data));
    } catch (error) {
      if (related || assertedGovernedHold) {
        return blocked(
          'malformed',
          error instanceof Error
            ? error.message
            : 'A related Contract event chain is malformed.'
        );
      }
    }
  }

  const linkedMatches = [...linkedEventIds].flatMap((eventId) =>
    findEventMatches(ledgers, eventId)
  );
  if (assertedGovernedHold && linkedEventIds.size === 0) {
    return blocked(
      'missing',
      'The cap hold does not identify its governed Contract event.'
    );
  }
  if (linkedEventIds.size > 1 || linkedMatches.length > 1) {
    return blocked(
      'duplicate',
      'The cap hold resolves to more than one current Contract event.'
    );
  }
  if (assertedGovernedHold && linkedMatches.length === 0) {
    return blocked('missing', 'The linked Contract event is missing.');
  }

  const applicable: GovernedDecline[] = [];
  for (const ledger of ledgers) {
    for (const event of ledger.events) {
      if (
        event.recordStatus !== 'current' ||
        event.playerId !== playerId ||
        event.eventKind !== 'option-decline' ||
        event.resultingState.terms.isRookieScale !== true
      ) {
        continue;
      }
      const inspected = inspectRookieScaleDecline({
        ledger,
        event,
        worldId,
        teamId,
        playerId,
      });
      if (inspected.status === 'invalid') {
        return blocked(inspected.kind, inspected.detail);
      }
      if (inspected.status === 'applicable') applicable.push(inspected.decline);
    }
  }

  if (applicable.length > 1) {
    return blocked(
      'duplicate',
      'More than one current Rookie Scale option decline applies to this player.'
    );
  }

  if (applicable.length === 0) {
    const linked = linkedMatches[0];
    if (linked) {
      const inspected = inspectRookieScaleDecline({
        ...linked,
        worldId,
        teamId,
        playerId,
      });
      if (inspected.status === 'invalid') {
        return blocked(inspected.kind, inspected.detail);
      }
    }
    if (playerHolds.some((hold) => hold.priorTeamOfferCeiling !== undefined)) {
      return blocked(
        'mismatch',
        'A Prior Team offer ceiling is present without an applicable Rookie Scale option decline.'
      );
    }
    return allowed();
  }

  const decline = applicable[0];
  if (!worldId) {
    return blocked('missing', 'World identity is missing.');
  }
  if (dateDefaulted || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate || '')) {
    return blocked(
      'missing',
      'An explicit governed Team Plan date is required.'
    );
  }
  if (decline.event.effectiveAt.slice(0, 10) > (asOfDate as string)) {
    return blocked(
      'stale',
      'The option decline is not yet effective at the Team Plan date.'
    );
  }
  if (year !== decline.salaryCapYear) {
    return blocked(
      'stale',
      'The option decline belongs to a different Salary Cap Year.'
    );
  }

  if (playerHolds.length !== 1) {
    return blocked(
      playerHolds.length === 0 ? 'missing' : 'duplicate',
      'The player must have exactly one cap hold for the governed decline.'
    );
  }
  const hold = playerHolds[0];
  if (hold.active !== true || hold.isSigned === true) {
    return blocked('stale', 'The linked cap hold is not active and unsigned.');
  }
  if (hold.governedContractEventId !== decline.event.eventId) {
    return blocked(
      'mismatch',
      'The cap hold links to a different Contract event.'
    );
  }
  if (hold.priorTeamOfferCeiling !== decline.declinedSalary) {
    return blocked(
      'mismatch',
      'The cap-hold ceiling does not equal the declined option Salary.'
    );
  }
  const expectedHoldSeason = toSeasonCode(decline.salaryCapYear);
  if (hold.season !== expectedHoldSeason) {
    return blocked(
      'mismatch',
      'The cap-hold Season does not match the declined option Season.'
    );
  }
  const governedFreeAgentAmount =
    decline.event.resultingState.terms.freeAgency.capHold;
  if (
    typeof governedFreeAgentAmount !== 'number' ||
    !Number.isFinite(governedFreeAgentAmount) ||
    hold.amount !== governedFreeAgentAmount
  ) {
    return blocked(
      'mismatch',
      'The cap-hold amount does not match the governed Free Agent Amount.'
    );
  }

  const firstYear = contract?.salariesByYear?.[0];
  const firstYearSalary = firstYear?.salary;
  const firstYearUnlikely = firstYear?.incentives?.unlikely ?? 0;
  if (
    !firstYear ||
    toEndYear(firstYear.season) !== year ||
    typeof firstYearSalary !== 'number' ||
    !Number.isFinite(firstYearSalary) ||
    firstYearSalary < 0 ||
    typeof firstYearUnlikely !== 'number' ||
    !Number.isFinite(firstYearUnlikely) ||
    firstYearUnlikely < 0
  ) {
    return blocked(
      'malformed',
      'The proposed first-year Salary or Unlikely Bonuses are missing or invalid.'
    );
  }

  const governedOfferAmount = firstYearSalary + firstYearUnlikely;
  const firstYearSalaryCents = toExactCents(firstYearSalary);
  const firstYearUnlikelyCents = toExactCents(firstYearUnlikely);
  const declinedSalaryCents = toExactCents(decline.declinedSalary);
  if (
    firstYearSalaryCents === null ||
    firstYearUnlikelyCents === null ||
    declinedSalaryCents === null
  ) {
    return blocked(
      'malformed',
      'Salary, Unlikely Bonuses, and the declined option ceiling must be exact cent-denominated amounts.'
    );
  }
  const governedOfferCents = firstYearSalaryCents + firstYearUnlikelyCents;
  if (governedOfferCents > declinedSalaryCents) {
    return {
      valid: false,
      violations: [
        {
          rule: CEILING_RULE,
          message: `This offer exceeds the Prior Team's ${formatMoney(
            decline.declinedSalary
          )} limit after declining the Rookie Scale Team Option. First-year Salary plus Unlikely Bonuses is ${formatMoney(
            governedOfferAmount
          )}. No changes were saved.`,
          severity: 'error',
          firstYearSalary,
          firstYearUnlikelyBonuses: firstYearUnlikely,
          governedOfferAmount,
          priorTeamOfferCeiling: decline.declinedSalary,
          canonLeafId: 'CBA2-C16.7',
        },
      ],
      warnings: [],
    };
  }

  return allowed();
}
