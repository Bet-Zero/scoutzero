import { getPlayerCapHitForYear, isTwoWayContract } from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsByEndYear } from '@/features/architect/utils/capHolds';
import type { CapHold } from '@/features/architect/utils/capHolds';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';
import { GovernedUnsignedFirstRoundPickStateZ } from '@/schemas/governedIncompleteRosterCharge';

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

export interface GovernedIncompleteRosterResolution {
  mode: 'governed';
  status: 'complete' | 'needs-input' | 'not-evaluated';
  activeWindow: boolean | null;
  window: { opens: string; closes: string } | null;
  counts: {
    underContract: number;
    veteranFreeAgentAmounts: number;
    offerSheets: number;
    unsignedFirstRoundPicks: number;
    total: number;
  } | null;
  threshold: 12;
  missingSlots: number | null;
  chargePerSlot: number | null;
  amount: number | null;
  canonLeafIds: readonly ['CBA2-C03.1', 'CBA2-C03.2', 'CBA2-C07.11'];
  missingInputs: string[];
  reason: string;
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

const isMoney = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  Number.isSafeInteger(Math.round(value * 100)) &&
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

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

  const envelope = resolveGovernedSeasonEnvelope({
    asOfDate,
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
        : ['governedSeason.calendar.regularSeasonOpening']
    );
  }

  const opens = `${salaryCapYear - 1}-07-01`;
  const closes = envelope.calendar.regularSeasonOpening.value;
  const date = asOfDate.slice(0, 10);
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

  if (!isMoney(args.zeroYosMinimum) || args.zeroYosMinimumSource !== 'real') {
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
    if (!playerId || !isMoney(capHit) || capHit <= 0) {
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
    .forEach((hold, index) => {
      if (!identity(hold as unknown as UnknownRecord) || !isMoney(hold.amount) || !hold.governedContractEventId) {
        missing.push(`team.capHolds[${index}].governedVeteranFreeAgentAmount`);
        return;
      }
      if (register(hold.playerId, 'veteran-free-agent-amount', `team.capHolds[${index}]`)) {
        veteranFreeAgentAmounts += 1;
      }
    });

  let offerSheets = 0;
  (Array.isArray(team.offerSheets) ? team.offerSheets : []).forEach((value, index) => {
    const record = asRecord(value);
    if (record?.status !== 'PENDING_MATCH') return;
    const parsed = GovernedOfferSheetLifecycleZ.safeParse(record.governedLifecycle);
    if (
      !parsed.success ||
      parsed.data.status !== 'pending-match' ||
      parsed.data.offeringTeamId !== teamCode ||
      parsed.data.salaryCapYear !== salaryCapYear
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
    const rookieHoldsByPlayer = new Map(rookieHolds.map((hold) => [hold.playerId, hold]));
    for (const [index, entry] of pickState.data.entries.entries()) {
      const hold = rookieHoldsByPlayer.get(entry.playerId);
      if (!hold || hold.amount !== entry.teamSalaryAmount) {
        missing.push(`salaryBookInputs.unsignedFirstRoundPickState.entries[${index}].teamSalaryAmount`);
        continue;
      }
      rookieHoldsByPlayer.delete(entry.playerId);
      if (register(entry.playerId, 'unsigned-first-round-pick', `salaryBookInputs.unsignedFirstRoundPickState.entries[${index}]`)) {
        unsignedFirstRoundPicks += 1;
      }
    }
    if (rookieHoldsByPlayer.size > 0) {
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
