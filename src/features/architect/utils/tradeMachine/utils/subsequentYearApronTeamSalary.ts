/**
 * CBA2-A05.15 to A05.17: the post-Regular-Season dual-year test.
 *
 * From the day after the last Regular Season game through June 30, a trade in
 * Transaction Restrictions Table rows E through J (here F, H and I) must also
 * keep the team's Apron Team Salary for the next Salary Cap Year at or below
 * that row's Apron Level. CBA2-A05.17 fixes how that next-year amount is
 * computed: every Team and Player Option for that year is exercised, no Early
 * Termination Option is exercised, the team makes no further transactions, a
 * player who may still earn a Higher Max salary earns it, and the next year's
 * Cap and Apron Levels equal the current year's.
 *
 * This module computes that amount for one team as it would stand right after
 * the trade, from the Contracts the team will hold. It fails closed: any
 * Contract it cannot read for the next year makes the result needs-input.
 *
 * Apron Team Salary composition used (CBA2-C07):
 * - each Standard Contract's next-year Salary plus its unlikely bonuses
 *   (C06.1, C07.2); Two-Way Contracts are excluded;
 * - next-year dead money from waived Contracts;
 * - the zero/one-YOS Minimum uplift (C07.3), bounded above by the two-YOS
 *   minimum less the player's next-year Salary;
 * - Free Agent Amounts (C07.5), unsigned First Round Pick amounts (C07.7),
 *   exception amounts (C07.9) and incomplete-roster charges (C07.11) are
 *   excluded from Apron Team Salary and are not added;
 * - grievance exposure (C07.4), outstanding Qualifying Offers or First
 *   Refusal amounts (C07.6), Required Tenders (C07.8) and Second Round Pick
 *   Exception amounts (C07.10) are added only when the world records them; a
 *   pending incoming Offer Sheet makes the result needs-input.
 */
import {
  getScaleForSeason,
  isOfficialScaleSeason,
} from '@/features/architect/data/minimumSalaryScales';
import {
  toEndYear,
  toSeasonKey,
} from '@/features/architect/utils/seasonFormat';
import {
  tradeMinimumUpliftFor,
  tradeUpliftPlayerId,
} from './tradeMinimumUplift';

type UnknownRecord = Record<string, unknown>;

export const SUBSEQUENT_YEAR_APRON_LEAVES = Object.freeze([
  'CBA2-A05.15',
  'CBA2-A05.17',
] as const);

export type SubsequentYearApronLine = {
  kind:
    | 'contract'
    | 'unlikely-bonus'
    | 'higher-max'
    | 'dead-money'
    | 'minimum-uplift';
  playerId: string | null;
  amount: number;
};

export type SubsequentYearApronTeamSalary =
  | {
      status: 'ready';
      salaryCapYear: number;
      season: string;
      amount: number;
      lines: SubsequentYearApronLine[];
      assumptions: string[];
      canonLeafIds: readonly string[];
    }
  | {
      status: 'needs-input';
      salaryCapYear: number | null;
      missingInputs: string[];
      reason: string;
    };

export type SubsequentYearApronInput = {
  /** The team's pre-trade record (players, deadCap, salaryBookInputs). */
  team: UnknownRecord | null | undefined;
  outgoingPlayers: readonly UnknownRecord[];
  incomingPlayers: readonly UnknownRecord[];
  /** Current-year zero/one-YOS Minimum uplift of each incoming player. */
  incomingUpliftByPlayer: ReadonlyMap<string, number>;
  /** Current Salary Cap Year (end year, e.g. 2026 for 2025-26). */
  salaryCapYear: number | null | undefined;
  asOfDate: string | null | undefined;
  /** Current-year Salary Cap; next year's is assumed equal (A05.17). */
  salaryCap: number | null | undefined;
};

const HIGHER_MAX_SHARE = 0.3;

export const SUBSEQUENT_YEAR_APRON_ASSUMPTIONS = Object.freeze({
  options:
    'Every Team and Player Option for next season is treated as exercised and no Early Termination Option as exercised (CBA2-A05.17).',
  noTransactions:
    'The team is assumed to make no further transactions this Salary Cap Year (CBA2-A05.17).',
  levels:
    "Next season's Cap and Apron Levels are assumed equal to this season's (CBA2-A05.17).",
  recorded:
    'Grievance exposure, outstanding Qualifying Offers, Required Tenders and Second Round Pick Exception amounts count only when the world records them. A Contract ending this season with no recorded extension pays nothing next season.',
  minimumUplift:
    "A Minimum uplift carried into next season is bounded above by next season's two-YOS minimum less the player's Salary.",
  higherMax:
    'A Rookie Scale player in his final Rookie Scale season with a maximum extension is assumed to earn the Higher Max (30% of the Cap) next season.',
});

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const money = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;

function isTwoWay(player: UnknownRecord): boolean {
  const contract = asRecord(player.contract);
  const type = String(player.contractType ?? contract?.contractType ?? '')
    .trim()
    .toLowerCase();
  return (
    type === 'two-way' ||
    player.isTwoWay === true ||
    contract?.isTwoWay === true
  );
}

function rowsFor(contract: UnknownRecord | null, endYear: number) {
  const rows = Array.isArray(contract?.salariesByYear)
    ? (contract!.salariesByYear as unknown[])
    : [];
  return rows
    .map(asRecord)
    .filter(
      (row): row is UnknownRecord =>
        row !== null && toEndYear(row.season as string) === endYear
    );
}

/** A row that will not pay next season: voided, or an option already declined. */
function rowIsInactive(row: UnknownRecord): boolean {
  return (
    row.voidedByExtension === true ||
    (typeof row.option === 'string' &&
      row.option.trim() !== '' &&
      row.optionUsed === false)
  );
}

function playerNextYear(
  player: UnknownRecord,
  currentYear: number,
  nextYear: number,
  salaryCap: number
):
  | {
      ok: true;
      salary: number;
      lines: SubsequentYearApronLine[];
      higherMax: boolean;
    }
  | { ok: false; missing: string } {
  const playerId = tradeUpliftPlayerId(player) || null;
  const label = playerId ?? 'unknown-player';
  const contract = asRecord(player.contract);
  const future = asRecord(player.futureContract);
  if (!contract && !future) {
    return { ok: false, missing: `players.${label}.contract` };
  }
  const candidates = [
    ...rowsFor(contract, nextYear),
    ...rowsFor(future, nextYear),
  ];
  const active = candidates.filter((row) => !rowIsInactive(row));
  if (active.length > 1) {
    return {
      ok: false,
      missing: `players.${label}.nextSeasonSalary.duplicate`,
    };
  }
  if (active.length === 0) {
    if (candidates.length > 0) {
      return { ok: true, salary: 0, lines: [], higherMax: false };
    }
    const lastYears = [contract, future]
      .filter((value): value is UnknownRecord => value !== null)
      .map((value) => toEndYear(value.endSeason as string));
    if (lastYears.some((year) => year === null)) {
      return { ok: false, missing: `players.${label}.contract.endSeason` };
    }
    // An expiring Contract with no recorded extension pays nothing next
    // season (the stored record omits an empty futureContract).
    if (lastYears.every((year) => (year as number) < nextYear)) {
      return { ok: true, salary: 0, lines: [], higherMax: false };
    }
    return { ok: false, missing: `players.${label}.nextSeasonSalary` };
  }
  const row = active[0];
  const incentives = asRecord(row.incentives);
  const likely = money(incentives?.likely ?? 0);
  const unlikely = money(incentives?.unlikely ?? 0);
  const capHit = money(row.capHit);
  const salary = money(row.salary);
  if (
    likely === null ||
    unlikely === null ||
    (capHit === null && salary === null)
  ) {
    return { ok: false, missing: `players.${label}.nextSeasonSalary.amount` };
  }
  if (
    row.tradeBonus !== null &&
    row.tradeBonus !== undefined &&
    Number(row.tradeBonus) !== 0
  ) {
    return { ok: false, missing: `players.${label}.nextSeasonTradeBonus` };
  }
  // A recorded cap hit already includes likely bonuses; a bare salary does not.
  let base = capHit ?? (salary as number) + likely;
  let higherMax = false;
  const isFinalRookieScaleSeason =
    contract?.isRookieScale === true &&
    toEndYear(contract.endSeason as string) === currentYear;
  if (isFinalRookieScaleSeason && future?.isMaxContract === true) {
    const higherMaxSalary = Math.round(salaryCap * HIGHER_MAX_SHARE);
    if (higherMaxSalary > base) {
      base = higherMaxSalary;
      higherMax = true;
    }
  }
  const lines: SubsequentYearApronLine[] = [
    { kind: higherMax ? 'higher-max' : 'contract', playerId, amount: base },
  ];
  if (unlikely > 0) {
    lines.push({ kind: 'unlikely-bonus', playerId, amount: unlikely });
  }
  return { ok: true, salary: base, lines, higherMax };
}

function needsInput(
  salaryCapYear: number | null,
  missingInputs: string[],
  reason: string
): SubsequentYearApronTeamSalary {
  return {
    status: 'needs-input',
    salaryCapYear,
    missingInputs: [...new Set(missingInputs)],
    reason,
  };
}

export function computeSubsequentYearApronTeamSalary(
  input: SubsequentYearApronInput
): SubsequentYearApronTeamSalary {
  const currentYear =
    typeof input.salaryCapYear === 'number' &&
    Number.isInteger(input.salaryCapYear)
      ? input.salaryCapYear
      : null;
  const nextYear = currentYear === null ? null : currentYear + 1;
  const season = nextYear === null ? null : toSeasonKey(nextYear);
  const salaryCap = money(input.salaryCap);
  const team = asRecord(input.team);
  const missing: string[] = [];
  if (currentYear === null || nextYear === null || !season) {
    missing.push('salaryCapYear');
  }
  if (salaryCap === null || salaryCap === 0) missing.push('salaryCap');
  if (!team || !Array.isArray(team.players)) missing.push('team.players');
  if (!team || !Array.isArray(team.deadCap)) missing.push('team.deadCap');
  if (missing.length > 0) {
    return needsInput(
      nextYear,
      missing,
      "Next season's Apron Team Salary needs the team's Contracts, dead money and the Salary Cap Year."
    );
  }
  const year = currentYear as number;
  const next = nextYear as number;
  const seasonKey = season as string;
  const cap = salaryCap as number;
  const record = team as UnknownRecord;

  const pendingOfferSheets = (
    Array.isArray(record.incomingOfferSheets) ? record.incomingOfferSheets : []
  ).filter((sheet) => {
    const status = String(asRecord(sheet)?.status ?? '').toUpperCase();
    return status === 'PENDING' || status === 'PENDING_MATCH';
  });
  if (pendingOfferSheets.length > 0) {
    return needsInput(
      next,
      ['team.incomingOfferSheets.firstRefusalAmount'],
      'A pending Offer Sheet adds its First Refusal amount to next season’s Apron Team Salary (CBA2-C07.6); that is not modelled here.'
    );
  }

  const scale = isOfficialScaleSeason(seasonKey)
    ? getScaleForSeason(seasonKey)
    : null;
  const twoYosMinimum = money(scale?.[2]);

  // Apply re-validates a post-trade snapshot whose roster already holds the
  // incoming players and no longer holds the outgoing ones; either form gives
  // the same roster here.
  const outgoingIds = new Set(
    [...input.outgoingPlayers, ...input.incomingPlayers].map((player) =>
      tradeUpliftPlayerId(player)
    )
  );
  const staying = (record.players as unknown[])
    .map(asRecord)
    .filter((player): player is UnknownRecord => player !== null)
    .filter((player) => !outgoingIds.has(tradeUpliftPlayerId(player)));
  const roster = [
    ...staying.map((player) => ({ player, incoming: false })),
    ...input.incomingPlayers.map((player) => ({ player, incoming: true })),
  ];

  const lines: SubsequentYearApronLine[] = [];
  const assumptions = new Set<string>([
    SUBSEQUENT_YEAR_APRON_ASSUMPTIONS.options,
    SUBSEQUENT_YEAR_APRON_ASSUMPTIONS.noTransactions,
    SUBSEQUENT_YEAR_APRON_ASSUMPTIONS.levels,
    SUBSEQUENT_YEAR_APRON_ASSUMPTIONS.recorded,
  ]);
  const seen = new Set<string>();
  for (const { player, incoming } of roster) {
    if (isTwoWay(player)) continue;
    const playerId = tradeUpliftPlayerId(player);
    if (!playerId) {
      missing.push('players.identity');
      continue;
    }
    if (seen.has(playerId)) {
      missing.push(`players.${playerId}.duplicate`);
      continue;
    }
    seen.add(playerId);
    const nextYearResult = playerNextYear(player, year, next, cap);
    if (!nextYearResult.ok) {
      missing.push(nextYearResult.missing);
      continue;
    }
    lines.push(...nextYearResult.lines);
    if (nextYearResult.higherMax) {
      assumptions.add(SUBSEQUENT_YEAR_APRON_ASSUMPTIONS.higherMax);
    }
    if (nextYearResult.salary <= 0) continue;
    let currentUplift = 0;
    if (incoming) {
      currentUplift = input.incomingUpliftByPlayer.get(playerId) ?? 0;
    } else {
      const uplift = tradeMinimumUpliftFor(
        record.salaryBookInputs,
        playerId,
        input.asOfDate
      );
      if (uplift.status !== 'ready') {
        missing.push(`players.${playerId}.minimumUplift`);
        continue;
      }
      currentUplift = uplift.amount;
    }
    if (currentUplift > 0) {
      if (twoYosMinimum === null) {
        missing.push(`minimumSalaryScale.${seasonKey}.yos2`);
        continue;
      }
      const bound = twoYosMinimum - nextYearResult.salary;
      if (bound > 0) {
        lines.push({ kind: 'minimum-uplift', playerId, amount: bound });
        assumptions.add(SUBSEQUENT_YEAR_APRON_ASSUMPTIONS.minimumUplift);
      }
    }
  }

  for (const [index, value] of (record.deadCap as unknown[]).entries()) {
    const entry = asRecord(value);
    const byYear = Array.isArray(entry?.amountByYear)
      ? (entry!.amountByYear as unknown[])
      : null;
    if (!entry || !byYear) {
      missing.push(`team.deadCap[${index}].amountByYear`);
      continue;
    }
    for (const row of byYear.map(asRecord)) {
      if (!row || toEndYear(row.season as string) !== next) continue;
      const amount = money(row.amount);
      if (amount === null) {
        missing.push(`team.deadCap[${index}].amount`);
        continue;
      }
      if (amount > 0) {
        lines.push({
          kind: 'dead-money',
          playerId: typeof entry.playerId === 'string' ? entry.playerId : null,
          amount,
        });
      }
    }
  }

  if (missing.length > 0) {
    return needsInput(
      next,
      missing,
      "Next season's Apron Team Salary cannot be computed from the team's recorded Contracts."
    );
  }
  return {
    status: 'ready',
    salaryCapYear: next,
    season: seasonKey,
    amount: lines.reduce((sum, line) => sum + line.amount, 0),
    lines,
    assumptions: [...assumptions],
    canonLeafIds: SUBSEQUENT_YEAR_APRON_LEAVES,
  };
}
