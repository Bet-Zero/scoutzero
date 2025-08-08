import { getSalaryForYear } from '@/utils/architect/tradeHelpers.js';

export function validateSecondApronRules(team) {
  const { teamTotalSalary } = team;
  const { capSettings } = team.context;
  const { secondApron } = capSettings;
  const { cashSent = 0, salaryIn, salaryOut } = team;
  const violations = [];

  if (teamTotalSalary >= secondApron) {
    if (cashSent > 0) {
      violations.push('Second apron team cannot include cash in trades');
    }
    if (salaryIn > salaryOut) {
      violations.push('Second apron team cannot receive more salary than sent');
    }
  }

  if (!team.overSecondApron && !team.willBeOverSecond) return violations;

  const outgoingSalaries = team.sends
    .map((p) => getSalaryForYear(p, team.context.yearKey))
    .sort((a, b) => b - a);

  const incomingSalaries = team.incomingPlayers
    .map((p) => getSalaryForYear(p, team.context.yearKey))
    .sort((a, b) => b - a);

  // 1-to-Many rule - Each incoming must be <= single outgoing
  if (team.sends.length === 1) {
    const maxOutgoing = outgoingSalaries[0];
    incomingSalaries.forEach((incoming) => {
      if (incoming > maxOutgoing) {
        violations.push(
          `Second apron restriction: Incoming salary $${incoming.toLocaleString()} ` +
            `exceeds single outgoing salary $${maxOutgoing.toLocaleString()}`
        );
      }
    });
  }
  // Many-to-Many rule - Must pair salaries in descending order
  else {
    incomingSalaries.forEach((incoming, i) => {
      const correspondingOutgoing = outgoingSalaries[i] || 0;
      if (incoming > correspondingOutgoing) {
        violations.push(
          `Second apron salary pairing violation: ` +
            `Incoming $${incoming.toLocaleString()} > Outgoing $${correspondingOutgoing.toLocaleString()}`
        );
      }
    });
  }

  // Total salary cannot increase
  const totalOutgoing = outgoingSalaries.reduce((a, b) => a + b, 0);
  const totalIncoming = incomingSalaries.reduce((a, b) => a + b, 0);
  if (totalIncoming > totalOutgoing) {
    violations.push(
      `Second apron teams cannot increase total salary: ` +
        `Incoming $${totalIncoming.toLocaleString()} > Outgoing $${totalOutgoing.toLocaleString()}`
    );
  }

  return violations;
}
