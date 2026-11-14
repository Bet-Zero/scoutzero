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
  simulationFinancialBaseline?: { classification?: unknown } | null;
  draftBaseline?: { classification?: unknown } | null;
}

/** The assumptions that apply to a world, or none when it is not SIMULATION. */
export function simulationAssumptionsForWorld(
  metadata: SimulationWorldMarkers | null | undefined
): readonly SimulationAssumption[] {
  const money =
    metadata?.simulationFinancialBaseline?.classification === 'SIMULATION';
  const draft = metadata?.draftBaseline?.classification === 'simulation';
  return [...(money ? [...MONEY, ...TRADES] : []), ...(draft ? DRAFT : [])];
}
