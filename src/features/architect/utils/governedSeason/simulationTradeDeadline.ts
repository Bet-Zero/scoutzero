/**
 * Trade deadlines for the official-calendar seasons (V1 item B7).
 *
 * The governed calendar sources certify only the Regular Season endpoints
 * (`uncertifiedFields: ['tradeDeadline']`). Under the owner's simulation
 * standard the deadline is filled by a named assumption: the league's
 * publicly reported date and time. It is not a certified source value.
 *
 * World dates are calendar days. A trade dated on the deadline day is treated
 * as made before 3:00 p.m. Eastern; the next day is after the deadline.
 */
export const SIMULATION_TRADE_DEADLINE_ASSUMPTION = Object.freeze({
  id: 'simulation-trade-deadline',
  statement:
    'The trade deadline is the publicly reported league date: Thursday, February 5, 2026 at 3 p.m. ET for 2025-26 and Thursday, February 11, 2027 at 3 p.m. ET for 2026-27. A trade dated on the deadline day counts as before the deadline. Later seasons have no deadline until one is entered.',
});

const DEADLINES: Readonly<Record<number, string>> = Object.freeze({
  2026: '2026-02-05T15:00:00-05:00',
  2027: '2027-02-11T15:00:00-05:00',
});

export interface SimulationTradeDeadline {
  readonly salaryCapYear: number;
  /** ISO instant with its Eastern offset. */
  readonly instant: string;
  /** The deadline's calendar day in the governing (Eastern) time zone. */
  readonly date: string;
  readonly assumptionId: string;
}

/** The named deadline for a Salary Cap Year, or null when none is entered. */
export function simulationTradeDeadline(
  salaryCapYear: number
): SimulationTradeDeadline | null {
  const instant = DEADLINES[salaryCapYear];
  if (!instant) return null;
  return Object.freeze({
    salaryCapYear,
    instant,
    date: instant.slice(0, 10),
    assumptionId: SIMULATION_TRADE_DEADLINE_ASSUMPTION.id,
  });
}
