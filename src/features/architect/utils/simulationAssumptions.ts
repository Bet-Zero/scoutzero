/**
 * Every named SIMULATION assumption a world can rest on, in one list the
 * product shows (V1 item D4). Each entry restates a rule already applied in
 * code; the statements are taken from, or summarise, the module that applies
 * it, so the list cannot claim more than the engine does.
 */
import { SIMULATION_DRAFT_ASSUMPTIONS } from './simulationDraftBaseline';
import { SIMULATION_TAX_SALARY_ASSUMPTION } from './simulationFinancialInputs';
import { SIMULATION_MINIMUM_UPLIFT_ASSUMPTION } from './simulationMinimumUplift';
import { SIMULATION_TRADE_DEADLINE_ASSUMPTION } from './governedSeason/simulationTradeDeadline';

export type SimulationAssumptionArea = 'Money' | 'Trades' | 'Draft picks';

export interface SimulationAssumption {
  readonly id: string;
  readonly area: SimulationAssumptionArea;
  readonly title: string;
  readonly statement: string;
}

const MONEY: readonly SimulationAssumption[] = [
  {
    id: 'unidentified-grievance-and-tenders',
    area: 'Money',
    title: 'Grievances and Required Tenders',
    statement:
      'Unidentified grievance exposure (CBA2-C07.4) and first-round Required Tenders (CBA2-C07.8) are assumed not applicable where no liability or credible signal is recorded. Known liabilities still count.',
  },
  {
    id: 'unknown-bonuses-none',
    area: 'Money',
    title: 'Unknown bonuses',
    statement:
      'Performance bonuses that are not in the public record count as $0 (CBA2-C07.2). Known bonuses still count.',
  },
  {
    id: 'minimum-uplift',
    area: 'Money',
    title: 'Minimum contract uplift',
    statement: SIMULATION_MINIMUM_UPLIFT_ASSUMPTION,
  },
  {
    id: 'tax-salary-baseline',
    area: 'Money',
    title: 'Tax Salary starting point',
    statement: SIMULATION_TAX_SALARY_ASSUMPTION,
  },
  {
    id: 'empty-cash-ledger',
    area: 'Money',
    title: 'Cash already moved this season',
    statement:
      'No cash was paid or received in trades during 2025-26 before the world date unless the world records it, so the full annual cash limits (CBA2-A08.4 to A08.6) are available at the start.',
  },
];

const TRADES: readonly SimulationAssumption[] = [
  {
    id: 'starting-roster-acquisitions',
    area: 'Trades',
    title: 'Starting-roster acquisition history',
    statement:
      'For a newly built June 5, 2026 SIMULATION baseline, no unreported exception acquisition in the preceding two months is assumed for its original roster. Known dated signings and recorded aggregation restrictions override that assumption. A signing with an unknown method is conservatively treated as using an exception. Every subsequent governed trade records its actual acquisition method and world date; copies preserve that history. Older worlds without this baseline record need acquisition input for aggregation.',
  },
  {
    id: 'minimum-stacking-classification',
    area: 'Trades',
    title: 'Minimum-player stacking',
    statement:
      'After the Regular Season, the minimum-stacking rule uses next season’s Contract compensation. A retained Minimum Exception signing is treated as paying the applicable minimum in every covered season. Other methods are not automatically treated as above the minimum: without an exact applicable minimum table cell, classification stays unknown and blocks a three-or-more-player aggregation with fewer players returning when it could exceed the one-minimum limit.',
  },
  {
    id: 'june5-postseason-rosters',
    area: 'Trades',
    title: 'June 5 postseason rosters',
    statement:
      'On June 5, 2026, New York and San Antonio are still in the Finals (NBA Communications, 2026 Finals game notes). Their Standard Contract players are treated as postseason roster members and cannot be traded; Two-Way players are not postseason roster members. Other teams have finished. This conservative roster assumption can block a player who was omitted from a finalist’s postseason roster.',
  },
  {
    id: 'exception-proration-reserve',
    area: 'Trades',
    title: 'Exception balance after January 10',
    statement:
      'Exception-use dates before this world are incomplete. After the trade deadline, we reserve the maximum January 10 daily reduction, using the full annual exception as the January 10 unused upper bound, and subtract all recorded use. Reduction stops at the Regular Season end; available dollars round down. This can refuse a trade that exact dated use would permit. The full unused balance remains available through the deadline.',
  },
  {
    id: SIMULATION_TRADE_DEADLINE_ASSUMPTION.id,
    area: 'Trades',
    title: 'Trade deadline',
    statement: SIMULATION_TRADE_DEADLINE_ASSUMPTION.statement,
  },
];

const DRAFT_TITLES: Record<
  (typeof SIMULATION_DRAFT_ASSUMPTIONS)[number]['id'],
  string
> = {
  'june5-reported-holder': 'Who holds each pick',
  'complete-league-inventory': 'Complete pick inventory',
  'unconditional-transfer-only': 'Which picks can be traded',
  'apron-history-scoped': 'Apron history for frozen picks',
};

const DRAFT: readonly SimulationAssumption[] = SIMULATION_DRAFT_ASSUMPTIONS.map(
  (assumption) => ({
    id: assumption.id,
    area: 'Draft picks' as const,
    title: DRAFT_TITLES[assumption.id],
    statement: assumption.statement,
  })
);

export interface SimulationWorldMarkers {
  simulationFinancialBaseline?: {
    classification?: unknown;
    asOf?: unknown;
  } | null;
  draftBaseline?: { classification?: unknown; assumptions?: unknown } | null;
}

/** The assumptions that apply to a world, or none when it is not SIMULATION. */
export function simulationAssumptionsForWorld(
  metadata: SimulationWorldMarkers | null | undefined
): readonly SimulationAssumption[] {
  const money =
    metadata?.simulationFinancialBaseline?.classification === 'SIMULATION';
  const draft = metadata?.draftBaseline?.classification === 'simulation';
  const asOf = metadata?.simulationFinancialBaseline?.asOf;
  const current =
    typeof asOf === 'string' && asOf >= '2026-07-01' && asOf < '2027-07-01';
  const financial = [
    ...MONEY,
    ...TRADES,
    ...(current
      ? [
          {
            id: 'conflicting-source-guarantees',
            area: 'Money' as const,
            title: 'Conflicting public guarantees',
            statement:
              'Where a public guaranteed amount exceeds the reported salary, its guarantee is unknown in this world. Original values stay in the retained Contract record; salary, cap hit and bonuses are unchanged. Affected current Contracts need clarified inputs before they can be traded. Unrelated players are not blocked by that protection-field conflict.',
          },
        ]
      : []),
    ...(typeof asOf === 'string' && asOf.slice(0, 10) === '2026-11-14'
      ? [
          {
            id: 'current-porzingis-pay-withholding',
            area: 'Money' as const,
            title: 'Porziņģis pay withholding',
            statement:
              'The November 14, 2026 starting package retains Porziņģis’s full $20 million salary. ESPN’s November 4 report says Golden State is withholding pay, without a current player/union dispute or contract voiding. This simulation grants no salary relief, grievance adjustment or Disabled Player Exception from that report; final Tax Salary remains unknown.',
          },
          {
            id: 'current-minnesota-hard-cap',
            area: 'Money' as const,
            title: 'Minnesota hard-cap correction',
            statement:
              'The November 14, 2026 starting package uses a Second Apron hard cap for Minnesota, based on reported salary aggregation and Taxpayer MLE use. This corrects a conflicting public First Apron label that its current payroll exceeds. The source conflict and supporting reports are retained; this is a named simulation determination.',
          },
        ]
      : []),
  ]
    .filter((a) => !current || a.id !== 'june5-postseason-rosters')
    .map((a) => {
      if (!current) return a;
      const statements: Record<string, string> = {
        'minimum-uplift':
          SIMULATION_MINIMUM_UPLIFT_ASSUMPTION +
          ' For older low-salary contracts, current service minus contract age is used only when coherent. Missing earlier minimum cells use the stated upper bound; where interrupted service makes entry YOS unknown, the contract is conservatively treated as potentially qualifying and marked unknown. A retained above-minimum annual contract is not reclassified from its smaller stretched dead-money installment.',
        'tax-salary-baseline':
          'Final 2026–27 Tax Salary is not yet known: its governing baseline is the start of the last Regular Season game. Current Team Salary and Apron Team Salary are evaluated for trades; a future tax assessment is not invented.',
        'empty-cash-ledger':
          'Pre-world 2026–27 cash totals have not been established. Trades involving cash require the missing annual ledger; no-cash trades do not assume that the full cash allowance remains.',
        'starting-roster-acquisitions':
          'Known dated signings and saved-world trades control acquisition restrictions. Starting players without a dated acquisition history need that input before restricted aggregation; no June 5 clearance is carried into this world.',
      };
      return statements[a.id] ? { ...a, statement: statements[a.id] } : a;
    });
  const supplied = metadata?.draftBaseline?.assumptions;
  const draftAssumptions: readonly SimulationAssumption[] = Array.isArray(
    supplied
  )
    ? supplied
        .filter(
          (a): a is { id: string; statement: string } =>
            !!a && typeof a.id === 'string' && typeof a.statement === 'string'
        )
        .map((a) => ({
          ...a,
          area: 'Draft picks',
          title:
            DRAFT_TITLES[a.id as keyof typeof DRAFT_TITLES] ??
            'Draft starting state',
        }))
    : DRAFT;
  return [...(money ? financial : []), ...(draft ? draftAssumptions : [])];
}
