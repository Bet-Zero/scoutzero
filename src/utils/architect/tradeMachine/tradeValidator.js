// tradeValidator.js - Complete Debuggable Version

// ===== DEBUG SETUP (DELETE WHEN DONE) =====
const debug = {
  enabled: true,
  log: (rule, data) => {
    if (!debug.enabled) return;
    console.groupCollapsed(`[VALIDATION] ${rule}`);
    console.table({
      Team: data.team.teamName,
      Status: data.result ? '✅ PASS' : '❌ FAIL',
      ...data.details,
    });
    console.groupEnd();
  },
  wrap:
    (name, testFn) =>
    (...args) => {
      const result = testFn(...args);
      debug.log(name, {
        team: args[0].team,
        result,
        details: {
          'Outgoing Salary': args[0].salaryOut,
          'Incoming Salary': args[0].salaryIn,
          'Projected Salary': args[0].projectedSalary,
          'Apron Status': getApronStatus(
            args[0].projectedSalary,
            args[1]?.capSettings
          ),
          ...(args[0].picksOut?.length
            ? { 'Traded Picks': args[0].picksOut.length }
            : {}),
        },
      });
      return result;
    },
};
// ===== END DEBUG SETUP =====

// Helper functions
const getApronStatus = (salary, { firstApron, secondApron } = {}) => {
  if (secondApron && salary > secondApron) return 'Above 2nd Apron';
  if (firstApron && salary > firstApron) return 'Above 1st Apron';
  return 'Below Aprons';
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

// Rule Definitions
const TRADE_RULES = {
  salaryMatching: {
    test: debug.wrap('Salary Matching', (team, context) => {
      if (team.sends.some((p) => p.acquiredViaTPE)) return true;
      return (
        team.salaryIn <= calculateAllowableIncoming(team, context.capSettings)
      );
    }),
    message: (team, context) => {
      const allowable = calculateAllowableIncoming(team, context.capSettings);
      return `Salary matching violation: Incoming $${team.salaryIn.toLocaleString()} exceeds allowable $${allowable.toLocaleString()}`;
    },
  },

  hardCap: {
    test: debug.wrap('Hard Cap', (team) => {
      if (!team.hardCapLimit) return true;
      return team.projectedSalary <= team.hardCapLimit;
    }),
    message: (team) =>
      `Would exceed ${team.hardCapTriggered} hard cap by $${(team.projectedSalary - team.hardCapLimit).toLocaleString()}`,
  },

  secondApron: {
    test: debug.wrap('Second Apron', (team) => {
      const violations = [];
      if (team.overSecondApron) {
        if (team.sends.length > 1) violations.push('No salary aggregation');
        if (team.salaryIn > team.salaryOut)
          violations.push("Can't take back more salary");
      }
      if (
        !team.overSecondApron &&
        team.willBeOverSecond &&
        team.sends.length > 1
      ) {
        violations.push('Trade would cross 2nd apron with aggregation');
      }
      team.secondApronViolations = violations;
      return violations.length === 0;
    }),
    message: (team) => team.secondApronViolations.join('; '),
  },

  stepienRule: {
    test: debug.wrap('Stepien Rule', (team) => {
      if (!team.picksOut?.length) return true;
      const futureFirsts = team.picksOut
        .filter((p) => (p.round === '1st' || p.round === 1) && !p.isSwap)
        .map((p) => parseInt(p.year))
        .sort((a, b) => a - b);
      for (let i = 1; i < futureFirsts.length; i++) {
        if (futureFirsts[i] === futureFirsts[i - 1] + 1) {
          const pick1 = team.picksOut.find(
            (p) => parseInt(p.year) === futureFirsts[i - 1]
          );
          const pick2 = team.picksOut.find(
            (p) => parseInt(p.year) === futureFirsts[i]
          );
          if (!isMeaningfulProtection(pick1?.protection)) return false;
          if (!isMeaningfulProtection(pick2?.protection)) return false;
        }
      }
      return true;
    }),
    message:
      'Stepien Rule violation: Consecutive future first-round picks without adequate protection',
  },

  tradeException: {
    test: debug.wrap('Trade Exception', (team, context) => {
      return team.sends.every((p) => {
        if (!p.acquiredViaTPE) return true;
        const tpe = team.team.tradeExceptions?.find((t) => t.id === p.tpeId);
        return (
          tpe &&
          p.contract_clean?.salaries_by_year?.[context.yearKey]?.salary <=
            tpe.amount &&
          !tpe.isUsed &&
          (!tpe.expirationDate || new Date(tpe.expirationDate) > new Date())
        );
      });
    }),
    message: 'Invalid trade exception usage',
  },
};

// Main Validation Function
export function validateTrade({ teams, capProjections, currentYear }) {
  const yearKey = currentYear;
  const capSettings =
    capProjections[`${currentYear}-${String(currentYear + 1).slice(-2)}`] || {};

  // 1. Calculate pre-trade and projected values
  const teamResults = teams.map((team) => {
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

    const projectedSalary = team.team.totalSalary - salaryOut + salaryIn;
    const currentApronStatus = getApronStatus(
      team.team.totalSalary,
      capSettings
    );
    const projectedApronStatus = getApronStatus(projectedSalary, capSettings);
    const hasSignAndTrade = team.sends.some((p) => p.signAndTrade);

    return {
      ...team,
      salaryOut,
      salaryIn,
      projectedSalary,
      overCap: team.team.totalSalary > capSettings.cap,
      overFirstApron: currentApronStatus === 'Above 1st Apron',
      overSecondApron: currentApronStatus === 'Above 2nd Apron',
      willBeOverFirst: projectedApronStatus === 'Above 1st Apron',
      willBeOverSecond: projectedApronStatus === 'Above 2nd Apron',
      hardCapTriggered: hasSignAndTrade
        ? 'FirstApron'
        : team.team.hardCapTriggered,
      hardCapLimit: hasSignAndTrade
        ? capSettings.firstApron
        : team.team.hardCapTriggered === 'FirstApron'
          ? capSettings.firstApron
          : team.team.hardCapTriggered === 'SecondApron'
            ? capSettings.secondApron
            : null,
      apronStatus: projectedApronStatus,
    };
  });

  // 2. Apply all validation rules
  const validatedResults = teamResults.map((team) => {
    const violations = [];
    const checks = {};
    Object.entries(TRADE_RULES).forEach(([ruleName, rule]) => {
      const passes = rule.test(team, {
        teams: teamResults,
        capSettings,
        yearKey,
      });
      checks[ruleName] = passes;
      if (!passes)
        violations.push(
          typeof rule.message === 'function'
            ? rule.message(team, { teams: teamResults, capSettings })
            : rule.message
        );
    });
    return { ...team, legal: violations.length === 0, violations, checks };
  });

  // 3. Generate summary
  return {
    overallLegal: validatedResults.every((r) => r.legal),
    teamResults: validatedResults,
    reason:
      validatedResults.flatMap((r) => r.violations).join('; ') ||
      'Trade complies with all CBA rules',
  };
}

// Helper functions
function isMeaningfulProtection(protection) {
  if (!protection) return false;
  return (
    /top\s*[1-9]\d*/i.test(protection) ||
    /lottery/i.test(protection) ||
    /1-14/i.test(protection)
  );
}

function getSalaryForYear(players, year) {
  return players.reduce((sum, p) => {
    const salary = p.contract_clean?.salaries_by_year?.[year]?.salary || 0;
    return sum + salary;
  }, 0);
}
