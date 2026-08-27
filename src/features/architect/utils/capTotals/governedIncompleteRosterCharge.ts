import { getPlayerCapHitForYear, isTwoWayContract } from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsByEndYear } from '@/features/architect/utils/capHolds';
import type { CapHold } from '@/features/architect/utils/capHolds';
import {
  governingCalendarDate,
  governingDayStartInstant,
  isSupportedSalaryCapYear,
  resolveGovernedSeasonEnvelope,
} from '@/features/architect/utils/governedSeason';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';
import {
  GovernedUnsignedFirstRoundPickStateZ,
  isGovernedMoney,
  type GovernedIncompleteRosterResolution,
} from '@/schemas/governedIncompleteRosterCharge';

export type { GovernedIncompleteRosterResolution } from '@/schemas/governedIncompleteRosterCharge';

type UnknownRecord = Record<string, unknown>;

export interface IncompleteRosterTeamLike extends UnknownRecord {
  id?: unknown;
  teamId?: unknown;
  teamCode?: unknown;
  worldId?: unknown;
  players?: unknown[] | null;
  capHolds?: unknown[] | null;
  offerSheets?: unknown[] | null;
  salaryBookInputs?: unknown;
}

export interface LegacyIncompleteRosterResolution {
  mode: 'legacy-compatibility';
  status: 'complete';
  activeWindow: null;
  window: null;
  counts: {
    underContract: number;
    veteranFreeAgentAmounts: 0;
    offerSheets: 0;
    unsignedFirstRoundPicks: 0;
    total: number;
  };
  threshold: number;
  missingSlots: number;
  chargePerSlot: number;
  amount: number;
  canonLeafIds: readonly ['CBA2-A01.1'];
  missingInputs: [];
  reason: string;
}

export type IncompleteRosterResolution =
  | GovernedIncompleteRosterResolution
  | LegacyIncompleteRosterResolution;

const LEAVES = Object.freeze([
  'CBA2-C03.1',
  'CBA2-C03.2',
  'CBA2-C07.11',
] as const);

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const identity = (record: UnknownRecord): string | null => {
  const value = record.playerId ?? record.player_id ?? record.id;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const unavailable = (
  reason: string,
  missingInputs: string[],
  activeWindow: boolean | null = null,
  window: GovernedIncompleteRosterResolution['window'] = null
): GovernedIncompleteRosterResolution => ({
  mode: 'governed',
  status: 'needs-input',
  activeWindow,
  window,
  counts: null,
  threshold: 12,
  missingSlots: null,
  chargePerSlot: null,
  amount: null,
  canonLeafIds: LEAVES,
  missingInputs,
  reason,
});

export function resolveGovernedIncompleteRosterCharge(args: {
  team: IncompleteRosterTeamLike | null | undefined;
  salaryCapYear: number;
  asOfDate: string | null;
  zeroYosMinimum: number;
  zeroYosMinimumSource: 'real' | 'projected';
}): GovernedIncompleteRosterResolution {
  const { team, salaryCapYear, asOfDate } = args;
  const teamId = stringValue(team?.teamId ?? team?.id ?? team?.teamCode);
  const teamCode = stringValue(team?.teamCode);
  if (!team || !teamId || !teamCode || !asOfDate) {
    return unavailable(
      'Incomplete-roster charges require the saved-world date and exact team identity.',
      [
        ...(!asOfDate ? ['context.asOfDate'] : []),
        ...(!teamId ? ['context.team.teamId'] : []),
        ...(!teamCode ? ['context.team.teamCode'] : []),
      ]
    );
  }

  const date = governingCalendarDate(asOfDate);
  const governedInstant = governingDayStartInstant(asOfDate);
  if (
    !date ||
    !governedInstant ||
    !isSupportedSalaryCapYear(salaryCapYear)
  ) {
    return unavailable(
      'Incomplete-roster charges require a valid saved-world date and Salary Cap Year.',
      [
        ...(!date || !governedInstant ? ['context.asOfDate'] : []),
        ...(!isSupportedSalaryCapYear(salaryCapYear)
          ? ['context.salaryCapYear']
          : []),
      ]
    );
  }

  const opens = `${salaryCapYear - 1}-07-01`;
  if (date < opens) {
    return {
      mode: 'governed',
      status: 'complete',
      activeWindow: false,
      window: { opens, closes: null },
      counts: {
        underContract: 0,
        veteranFreeAgentAmounts: 0,
        offerSheets: 0,
        unsignedFirstRoundPicks: 0,
        total: 0,
      },
      threshold: 12,
      missingSlots: 0,
      chargePerSlot: 0,
      amount: 0,
      canonLeafIds: LEAVES,
      missingInputs: [],
      reason:
        'No incomplete-roster charge applies before the governed offseason window opens.',
    };
  }

  const envelope = resolveGovernedSeasonEnvelope({
    asOfDate: governedInstant,
    salaryCapYear,
    requiredAuthority: 'official',
    team: {
      teamId,
      teamCode,
      ...(stringValue(team.worldId) ? { worldId: stringValue(team.worldId)! } : {}),
    },
  });
  if (
    envelope.status !== 'complete' ||
    envelope.calendar.state !== 'available' ||
    !envelope.calendar.regularSeasonOpening
  ) {
    return unavailable(
      'The official Regular Season opening is unavailable for this saved-world date.',
      envelope.missingInputs.length
        ? [...envelope.missingInputs]
        : ['governedSeason.calendar.regularSeasonOpening'],
      null,
      { opens, closes: null }
    );
  }

  const closes = envelope.calendar.regularSeasonOpening.value;
  const activeWindow = date >= opens && date < closes;
  const window = { opens, closes };
  if (!activeWindow) {
    return {
      mode: 'governed',
      status: 'complete',
      activeWindow: false,
      window,
      counts: {
        underContract: 0,
        veteranFreeAgentAmounts: 0,
        offerSheets: 0,
        unsignedFirstRoundPicks: 0,
        total: 0,
      },
      threshold: 12,
      missingSlots: 0,
      chargePerSlot: 0,
      amount: 0,
      canonLeafIds: LEAVES,
      missingInputs: [],
      reason: 'No incomplete-roster charge applies outside the governed offseason window.',
    };
  }

  if (
    !isGovernedMoney(args.zeroYosMinimum) ||
    args.zeroYosMinimum <= 0 ||
    args.zeroYosMinimumSource !== 'real'
  ) {
    return unavailable(
      'The official zero-years-of-service Minimum Salary is unavailable.',
      ['governedSeason.minimumSalaryScale.yos0'],
      true,
      window
    );
  }

  const missing: string[] = [];
  const categoryByIdentity = new Map<string, string>();
  const register = (playerId: string, category: string, path: string) => {
    const previous = categoryByIdentity.get(playerId);
    if (previous) {
      missing.push(`${path}:duplicate-with:${previous}:${playerId}`);
      return false;
    }
    categoryByIdentity.set(playerId, category);
    return true;
  };

  let underContract = 0;
  for (const [index, value] of (Array.isArray(team.players) ? team.players : []).entries()) {
    const player = asRecord(value);
    if (!player || isTwoWayContract(player)) continue;
    const playerId = identity(player);
    const capHit = getPlayerCapHitForYear(player, salaryCapYear);
    if (!playerId || !isGovernedMoney(capHit) || capHit <= 0) {
      missing.push(`team.players[${index}].currentTeamSalaryContract`);
      continue;
    }
    if (register(playerId, 'under-contract', `team.players[${index}]`)) {
      underContract += 1;
    }
  }

  const activeHolds = getActiveUnsignedCapHoldsByEndYear(
    team.capHolds as CapHold[] | null | undefined,
    salaryCapYear
  );
  const rookieHolds = activeHolds.filter((hold) =>
    `${hold.type ?? ''} ${hold.reason ?? ''}`.toLowerCase().includes('rookie')
  );
  let veteranFreeAgentAmounts = 0;
  activeHolds
    .filter((hold) => !rookieHolds.includes(hold))
    .forEach((hold) => {
      const index = (Array.isArray(team.capHolds) ? team.capHolds : []).indexOf(
        hold
      );
      const path =
        index >= 0
          ? `team.capHolds[${index}]`
          : `team.capHolds[identity:${String(hold.playerId ?? 'missing')}]`;
      const playerId = stringValue(hold.playerId);
      if (
        !playerId ||
        !isGovernedMoney(hold.amount) ||
        !hold.governedContractEventId
      ) {
        missing.push(`${path}.governedVeteranFreeAgentAmount`);
        return;
      }
      if (register(playerId, 'veteran-free-agent-amount', path)) {
        veteranFreeAgentAmounts += 1;
      }
    });

  let offerSheets = 0;
  const season = toSeasonKey(salaryCapYear);
  (Array.isArray(team.offerSheets) ? team.offerSheets : []).forEach((value, index) => {
    const record = asRecord(value);
    if (record?.status !== 'PENDING_MATCH') return;
    const parsed = GovernedOfferSheetLifecycleZ.safeParse(record.governedLifecycle);
    if (
      !parsed.success ||
      parsed.data.status !== 'pending-match' ||
      parsed.data.offeringTeamId !== teamCode ||
      parsed.data.salaryCapYear !== salaryCapYear ||
      !season ||
      !parsed.data.reservations.offeringTeam.some(
        (reservation) =>
          reservation.season === season &&
          isGovernedMoney(reservation.amount) &&
          reservation.amount > 0
      )
    ) {
      missing.push(`team.offerSheets[${index}].governedLifecycle`);
      return;
    }
    if (register(parsed.data.playerId, 'offer-sheet', `team.offerSheets[${index}]`)) {
      offerSheets += 1;
    }
  });

  const salaryInputs = asRecord(team.salaryBookInputs);
  const pickState = GovernedUnsignedFirstRoundPickStateZ.safeParse(
    salaryInputs?.unsignedFirstRoundPickState
  );
  let unsignedFirstRoundPicks = 0;
  if (!pickState.success || pickState.data.status !== 'ready') {
    missing.push('salaryBookInputs.unsignedFirstRoundPickState');
  } else if (
    pickState.data.teamCode !== teamCode ||
    pickState.data.salaryCapYear !== salaryCapYear
  ) {
    missing.push('salaryBookInputs.unsignedFirstRoundPickState.identity');
  } else {
    const remainingRookieHolds = [...rookieHolds];
    rookieHolds.forEach((hold) => {
      if (!stringValue(hold.playerId)) {
        const index = (Array.isArray(team.capHolds) ? team.capHolds : []).indexOf(
          hold
        );
        missing.push(
          index >= 0
            ? `team.capHolds[${index}].playerId`
            : 'team.capHolds[rookie].playerId'
        );
      }
    });
    for (const [index, entry] of pickState.data.entries.entries()) {
      const holdIndex = remainingRookieHolds.findIndex(
        (hold) => stringValue(hold.playerId) === entry.playerId
      );
      const hold =
        holdIndex >= 0 ? remainingRookieHolds[holdIndex] : undefined;
      if (!hold || hold.amount !== entry.teamSalaryAmount) {
        missing.push(`salaryBookInputs.unsignedFirstRoundPickState.entries[${index}].teamSalaryAmount`);
        continue;
      }
      remainingRookieHolds.splice(holdIndex, 1);
      if (register(entry.playerId, 'unsigned-first-round-pick', `salaryBookInputs.unsignedFirstRoundPickState.entries[${index}]`)) {
        unsignedFirstRoundPicks += 1;
      }
    }
    if (remainingRookieHolds.length > 0) {
      missing.push('salaryBookInputs.unsignedFirstRoundPickState.unmatchedRookieHolds');
    }
  }

  if (missing.length > 0) {
    return unavailable(
      'The four governed incomplete-roster categories do not reconcile to one exact Team Salary state.',
      missing,
      true,
      window
    );
  }

  const total = underContract + veteranFreeAgentAmounts + offerSheets + unsignedFirstRoundPicks;
  const missingSlots = Math.max(0, 12 - total);
  return {
    mode: 'governed',
    status: 'complete',
    activeWindow: true,
    window,
    counts: {
      underContract,
      veteranFreeAgentAmounts,
      offerSheets,
      unsignedFirstRoundPicks,
      total,
    },
    threshold: 12,
    missingSlots,
    chargePerSlot: args.zeroYosMinimum,
    amount: missingSlots * args.zeroYosMinimum,
    canonLeafIds: LEAVES,
    missingInputs: [],
    reason: missingSlots
      ? 'The governed offseason roster count is below twelve.'
      : 'The governed offseason roster count is at least twelve.',
  };
}
