// SCSP: validateSecondApronRules.js — FULL FILE REPLACEMENT
import { getSalaryForYear } from '@/utils/architect/tradeHelpers.js';

/**
 * Enforce Second Apron “no aggregation” with a greedy 1:1 matcher.
 * Also enforces: no cash, cannot increase salary, and 100% band (incoming ≤ single outgoing).
 *
 * Works with either source array your UI fills:
 * - outgoing: team.outgoingPlayers  OR team.sends
 * - incoming: team.incomingPlayers  OR team.receives
 */
export function validateSecondApronRules(team) {
  const ctx = team?.context || {};
  const { capSettings, yearKey } = ctx;
  const { secondApron } = capSettings || {};
  const teamTotalSalary = team?.teamTotalSalary ?? 0;

  const violations = [];
  if (!secondApron || teamTotalSalary < secondApron) return violations;

  const cashSent = team?.cashSent ?? 0;
  const salaryIn = team?.salaryIn ?? 0;
  const salaryOut = team?.salaryOut ?? 0;

  if (cashSent > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }
  if (salaryIn > salaryOut) {
    violations.push('Second apron team cannot receive more salary than sent');
  }

  // Normalize sources so we never miss due to array name mismatches.
  const outgoingSrc =
    (Array.isArray(team?.outgoingPlayers) && team.outgoingPlayers.length
      ? team.outgoingPlayers
      : Array.isArray(team?.sends)
        ? team.sends
        : []) || [];

  const incomingSrc =
    (Array.isArray(team?.incomingPlayers) && team.incomingPlayers.length
      ? team.incomingPlayers
      : Array.isArray(team?.receives)
        ? team.receives
        : []) || [];

  const outgoingSalaries = outgoingSrc
    .map((p) => getSalaryForYear(p, yearKey))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b); // ascending for greedy

  const incomingSalaries = incomingSrc
    .map((p) => getSalaryForYear(p, yearKey))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a); // descending for greedy

  // Greedy 1:1 pairing: each incoming must be covered by ONE outgoing >= incoming.
  // This forbids combining multiple outgoing salaries to cover a single incoming.
  let oi = 0;
  for (const inc of incomingSalaries) {
    while (oi < outgoingSalaries.length && outgoingSalaries[oi] < inc) oi++;
    if (oi >= outgoingSalaries.length) {
      violations.push(
        'Second apron: cannot aggregate multiple outgoing salaries to acquire a single incoming player'
      );
      break;
    }
    oi++; // consume that one outgoing slot
  }

  // Total salary cannot increase (redundant safeguard).
  const totalOut = outgoingSalaries.reduce((a, b) => a + b, 0);
  const totalIn = incomingSalaries.reduce((a, b) => a + b, 0);
  if (totalIn > totalOut) {
    violations.push(
      `Second apron teams cannot increase total salary: Incoming $${totalIn.toLocaleString()} > Outgoing $${totalOut.toLocaleString()}`
    );
  }

  return violations;
}
