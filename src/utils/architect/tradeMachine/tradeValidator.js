// tradeValidator.js - Complete Fixed Version

// ===== DEBUGGER =====
const debug = {
  enabled: true,
  logs: [],

  write(msg) {
    if (!this.enabled) return;
    this.logs.push(msg);
    console.log(msg);
  },

  logTrade(team) {
    this.write(`\n=== ${team.teamName} ===`);
    this.write(`Current Salary: $${team.team.totalSalary.toLocaleString()}`);
    this.write(
      `Status: ${getApronStatus(team.team.totalSalary, team.context.capSettings)}`
    );
  },

  logSalaries(team) {
    this.write('Outgoing:');
    team.sends.forEach((p) => {
      const salary =
        p.contract_clean?.salaries_by_year?.[team.context.yearKey]?.salary || 0;
      this.write(`- ${p.name}: $${salary.toLocaleString()}`);
    });

    this.write('Incoming:');
    team.incomingPlayers.forEach((p) => {
      const salary =
        p.contract_clean?.salaries_by_year?.[team.context.yearKey]?.salary || 0;
      this.write(`- ${p.name}: $${salary.toLocaleString()}`);
    });

    this.write(
      `Totals: OUT $${team.salaryOut.toLocaleString()} | IN $${team.salaryIn.toLocaleString()}`
    );
  },

  logSecondApron(team, violations) {
    if (!team.overSecondApron && !team.willBeOverSecond) return;

    this.write('Second Apron Rules:');
    this.write(
      `Trade Type: ${team.sends.length}-for-${team.incomingPlayers.length}`
    );

    if (team.sends.length === 1) {
      const outgoing =
        team.sends[0].contract_clean?.salaries_by_year?.[team.context.yearKey]
          ?.salary || 0;
      this.write(`1-to-Many max incoming: $${outgoing.toLocaleString()}`);
    } else {
      this.write('Many-to-Many: pair incoming with outgoing');
    }

    if (violations.length) {
      this.write('Violations:');
      violations.forEach((v) => this.write(`- ${v}`));
    } else {
      this.write('All rules satisfied');
    }
  },

  async flush(file = 'trade-debug.txt') {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      await fs.promises.writeFile(file, this.logs.join('\n'), 'utf8');
    }
  },
};

export { debug as tradeDebug };

// ===== HELPERS =====
const getApronStatus = (salary, { firstApron, secondApron } = {}) => {
  if (secondApron && salary > secondApron) return 'ABOVE 2nd APRON 🔴';
  if (firstApron && salary > firstApron) return 'Above 1st Apron ⚠️';
  return 'Below Aprons ✅';
};

const calculateAllowableIncoming = (team, capSettings) => {
  const { totalSalary, salaryOut, overSecondApron, overFirstApron } = team;
  if (overSecondApron) return salaryOut;
  if (overFirstApron) return salaryOut * 1.1;
  if (totalSalary <= capSettings.cap)
    return salaryOut + 250000 + Math.max(0, capSettings.cap - totalSalary);
  if (salaryOut < 6530000) return salaryOut * 1.75 + 100000;
  if (salaryOut < 19600000) return salaryOut * 1.25 + 100000;
  return salaryOut * 1.25;
};

const getSalaryForYear = (players, year) => {
  return players.reduce((sum, p) => {
    const salary = p.contract_clean?.salaries_by_year?.[year]?.salary || 0;
    return sum + salary;
  }, 0);
};

// ===== RULES =====
const TRADE_RULES = {
  salaryMatching: {
    test: (team) => {
      if (team.sends.some((p) => p.acquiredViaTPE)) return true;
      const allowable = calculateAllowableIncoming(
        team,
        team.context.capSettings
      );
      const passes = team.salaryIn <= allowable;

      debug.write('');
      debug.write('Salary Matching:');
      debug.write(
        `Allowed: $${allowable.toLocaleString()} | Actual: $${team.salaryIn.toLocaleString()}`
      );
      debug.write(passes ? 'PASS' : 'FAIL');

      return passes;
    },
    message: (team) => {
      const allowable = calculateAllowableIncoming(
        team,
        team.context.capSettings
      );
      return `Salary mismatch: Incoming $${team.salaryIn.toLocaleString()} > allowed $${allowable.toLocaleString()}`;
    },
  },

  secondApron: {
    test: (team) => {
      const violations = [];
      if (!team.overSecondApron && !team.willBeOverSecond) return true;

      const outgoing = team.sends
        .map(
          (p) =>
            p.contract_clean?.salaries_by_year?.[team.context.yearKey]
              ?.salary || 0
        )
        .sort((a, b) => b - a);

      const incoming = team.incomingPlayers
        .map(
          (p) =>
            p.contract_clean?.salaries_by_year?.[team.context.yearKey]
              ?.salary || 0
        )
        .sort((a, b) => b - a);

      // 1-to-Many Rule
      if (team.sends.length === 1) {
        const maxOut = outgoing[0];
        incoming.forEach((s, i) => {
          if (s > maxOut) {
            violations.push(
              `${team.incomingPlayers[i]?.name} ($${s.toLocaleString()}) > outgoing ($${maxOut.toLocaleString()})`
            );
          }
        });
      }
      // Many-to-Many Rule
      else {
        incoming.forEach((s, i) => {
          const outSalary = outgoing[i] || 0;
          if (s > outSalary) {
            const outName = team.sends[i]?.name || 'N/A';
            violations.push(
              `${team.incomingPlayers[i]?.name} ($${s.toLocaleString()}) > ${outName} ($${outSalary.toLocaleString()})`
            );
          }
        });
      }

      // Total salary check
      if (team.salaryIn > team.salaryOut) {
        violations.push(
          `Total incoming > outgoing by $${(team.salaryIn - team.salaryOut).toLocaleString()}`
        );
      }

      team.secondApronViolations = violations;
      debug.logSecondApron(team, violations);
      return violations.length === 0;
    },
    message: (team) => team.secondApronViolations.join('\n'),
  },
};

// ===== MAIN VALIDATOR =====
export function validateTrade({ teams, capProjections, currentYear }) {
  const yearKey = currentYear;
  const capSettings =
    capProjections[`${currentYear}-${String(currentYear + 1).slice(-2)}`] || {};

  // First pass - calculate basic data
  const initialTeams = teams.map((team) => {
    const salaryOut = getSalaryForYear(team.sends, yearKey);
    const salaryIn = teams.reduce((sum, t) => {
      if (t.team.id === team.team.id) return sum;
      return (
        sum +
        getSalaryForYear(
          t.sends.filter((p) => !p.tradeTo || p.tradeTo === team.team.id),
          yearKey
        )
      );
    }, 0);

    return {
      ...team,
      salaryOut,
      salaryIn,
      projectedSalary: team.team.totalSalary - salaryOut + salaryIn,
      context: { capSettings, yearKey },
    };
  });

  // Second pass - add apron status and cross-references
  const teamResults = initialTeams.map((team) => {
    const currentStatus = getApronStatus(team.team.totalSalary, capSettings);
    const projectedStatus = getApronStatus(team.projectedSalary, capSettings);

    return {
      ...team,
      overSecondApron: currentStatus.includes('2nd APRON'),
      willBeOverSecond: projectedStatus.includes('2nd APRON'),
      context: { ...team.context, teams: initialTeams },
    };
  });

  // Validate each team
  const validatedTeams = teamResults.map((team) => {
    debug.logTrade(team);
    debug.logSalaries(team);

    const violations = [];
    Object.values(TRADE_RULES).forEach((rule) => {
      if (!rule.test(team)) {
        violations.push(rule.message(team));
      }
    });

    return {
      ...team,
      legal: violations.length === 0,
      violations,
    };
  });

  return {
    overallLegal: validatedTeams.every((t) => t.legal),
    teamResults: validatedTeams,
    reason:
      validatedTeams.flatMap((t) => t.violations).join('; ') || 'Valid trade',
  };
}
