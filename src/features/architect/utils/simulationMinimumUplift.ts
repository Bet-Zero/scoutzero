/**
 * CBA2-C07.3 reading for SIMULATION 2025-26 contracts. Kept dependency-free so
 * both the money baseline and the governed trade salary basis can use it.
 */
/**
 * Official 2025-26 Minimum Annual Salary scale for zero, one and two Years of
 * Service. These are the amounts the accepted release itself carries (for
 * example full-season one-year Minimum contracts at $1,272,870 and $2,296,274).
 * The app-wide 2025-26 scale in data/minimumSalaryScales.ts is a labelled
 * projection and must not be used for money that reaches a ledger.
 */
export const SIMULATION_2025_26_MINIMUMS = Object.freeze({
  0: 1_272_870,
  1: 2_048_494,
  2: 2_296_274,
});

/** Days in the 2025-26 Regular Season, the proration base for Minimum contracts. */
export const SIMULATION_2025_26_SEASON_DAYS = 174;

/**
 * Later-season amounts of Minimum contracts signed in an earlier season by a
 * zero-YOS free agent, with the two-YOS amount the Apron counts instead. The
 * 2024-25 pair is the one the BZE-345 CHI/TOR reconciliation verified (Jamison
 * Battle). The 2023-24 two-YOS Year 3 amount is not retained, so the current
 * season's two-YOS minimum is used as a stated upper bound.
 */
export const SIMULATION_EARLIER_MINIMUMS: Readonly<
  Record<string, { amount: number; twoYos: number | null }>
> = Object.freeze({
  '2024-25': { amount: 1_955_377, twoYos: 2_191_897 },
  '2023-24': { amount: 2_221_677, twoYos: null },
});

export const SIMULATION_MINIMUM_UPLIFT_ASSUMPTION =
  'CBA2-C07.3: a Minimum contract signed as a free agent with zero or one Years of Service counts at the two-YOS minimum. ' +
  'Years of Service is read from the exact full or prorated minimum amount, a draft pick signed in his draft year is treated as signed by the club holding his rights, ' +
  'and a missing earlier-year two-YOS amount uses the current two-YOS minimum as an upper bound.';

/** What C07.3 needs to know about one contract counted in 2025-26 Team Salary. */
export interface MinimumUpliftCandidate {
  /** The 2025-26 Salary counted in Team Salary (full or prorated). */
  amount: number;
  /** Cap charge, when known; a reimbursed veteran Minimum charges less. */
  capHit?: number | null;
  signedUsing?: string | null;
  /** First season of the contract, e.g. '2025-26'; null when unknown. */
  startSeason?: string | null;
  draftYear?: string | null;
}

export type ContractRow = {
  season?: unknown;
  salary?: unknown;
  capHit?: unknown;
  incentives?: { unlikely?: unknown } | null;
};
export type SourceDoc = Record<string, unknown> & {
  playerId?: unknown;
  bio?: { draftYear?: unknown } | null;
  contract?: {
    signedUsing?: unknown;
    salariesByYear?: ContractRow[] | null;
  } | null;
};

export type MinimumUplift =
  | { status: 'none' }
  | {
      status: 'qualifying';
      yearsOfService: 0 | 1;
      days: number;
      uplift: number;
      /** True when the uplift uses the stated upper bound. */
      bounded: boolean;
    }
  | { status: 'unresolved'; reason: string };

export function money(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : null;
}

const EXCLUDED_MECHANISMS = new Set([
  'Two Way',
  'Rookie Exception',
  'Second Round Rookie Exception',
]);

/** CBA2-C07.3 for one contract counted in 2025-26 Team Salary. */
export function minimumUpliftFor(
  candidate: MinimumUpliftCandidate
): MinimumUplift {
  const { amount, capHit, signedUsing, startSeason, draftYear } = candidate;
  if (!Number.isSafeInteger(amount) || amount <= 0) return { status: 'none' };
  if (signedUsing && EXCLUDED_MECHANISMS.has(signedUsing)) {
    return { status: 'none' };
  }
  // A reimbursed veteran one-season Minimum charges the two-YOS amount.
  if (capHit != null && capHit < amount) return { status: 'none' };
  // Unknown start: an amount that is exactly a later-year zero-YOS Minimum is
  // read as that earlier signing (conservative), otherwise as this season's.
  const season =
    startSeason ??
    Object.entries(SIMULATION_EARLIER_MINIMUMS).find(
      ([, earlier]) => earlier.amount === amount
    )?.[0] ??
    '2025-26';
  if (draftYear && draftYear === season.slice(0, 4)) return { status: 'none' };
  const twoYos = SIMULATION_2025_26_MINIMUMS[2];
  if (amount >= twoYos) return { status: 'none' };

  if (season !== '2025-26') {
    const earlier = SIMULATION_EARLIER_MINIMUMS[season];
    if (!earlier || earlier.amount !== amount) return { status: 'none' };
    return {
      status: 'qualifying',
      yearsOfService: 0,
      days: SIMULATION_2025_26_SEASON_DAYS,
      uplift: (earlier.twoYos ?? twoYos) - amount,
      bounded: earlier.twoYos === null,
    };
  }

  const days = SIMULATION_2025_26_SEASON_DAYS;
  const matches: Array<{ yos: 0 | 1 | 2; d: number }> = [];
  for (const yos of [0, 1, 2] as const) {
    for (let d = 1; d <= days; d += 1) {
      if (
        Math.round((SIMULATION_2025_26_MINIMUMS[yos] * d) / days) === amount
      ) {
        matches.push({ yos, d });
      }
    }
  }
  if (matches.length === 0) return { status: 'none' };
  if (matches.length > 1) {
    return {
      status: 'unresolved',
      reason: 'The amount matches more than one Years of Service reading.',
    };
  }
  const [{ yos, d }] = matches;
  if (yos === 2) return { status: 'none' };
  return {
    status: 'qualifying',
    yearsOfService: yos,
    days: d,
    uplift: Math.round((twoYos * d) / days) - amount,
    bounded: false,
  };
}

/** C07.3 for a rostered contract in its retained source-document form. */
export function simulationMinimumUplift(
  doc: SourceDoc,
  season = '2025-26'
): MinimumUplift {
  const contract = doc.contract;
  const rows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const row = rows.find((r) => r?.season === season);
  const amount = money(row?.salary);
  if (!row || amount === null) return { status: 'none' };
  const draftYear = doc.bio?.draftYear;
  return minimumUpliftFor({
    amount,
    capHit: money(row.capHit),
    signedUsing:
      typeof contract?.signedUsing === 'string' ? contract.signedUsing : null,
    startSeason: typeof rows[0]?.season === 'string' ? rows[0].season : null,
    draftYear:
      typeof draftYear === 'string' || typeof draftYear === 'number'
        ? String(draftYear)
        : null,
  });
}
