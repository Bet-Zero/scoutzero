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
    id: 'exception-term-limit-on-acquisition',
    area: 'Trades',
    title: 'Exception term limits in trades',
    statement:
      'When a player is acquired with the Non-Taxpayer Mid-Level, Bi-Annual or Room Mid-Level Exception, the contract may have no more seasons left than a signing with that exception allows (4, 2 and 3). This can refuse a legal trade but never allows an illegal one.',
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
