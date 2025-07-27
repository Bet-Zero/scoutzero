// tradeValidator.js - Enhanced Version

// Rule definitions with detailed messages
const TRADE_RULES = {
  salaryMatching: {
    test: (team, context) => {
      if (team.sends.some((p) => p.acquiredViaTPE)) return true;

      const allowable = calculateAllowableIncoming(
        team.totalSalary,
        team.salaryOut,
        context.capSettings
      );

      return team.salaryIn <= allowable;
    },
    message: (team, context) => {
      const allowable = calculateAllowableIncoming(
        team.totalSalary,
        team.salaryOut,
        context.capSettings
      );
      return `Incoming salary (${formatCurrency(team.salaryIn)}) exceeds allowable amount (${formatCurrency(allowable)})`;
    },
  },

  hardCap: {
    test: (team) => {
      if (!team.hardCapTriggered) return true;
      return team.projectedSalary <= team.hardCapLimit;
    },
    message: (team) =>
      `Violates ${team.hardCapTriggered} hard cap by ${formatCurrency(team.projectedSalary - team.hardCapLimit)}`,
  },

  secondApron: {
    test: (team) => {
      if (!team.willBeOverSecond) return true;

      const violations = [];

      // No aggregating multiple players
      if (team.sends.length > 1) {
        violations.push("Can't aggregate multiple player salaries");
      }

      // Can't take back more salary
      if (team.salaryIn > team.salaryOut) {
        violations.push("Can't take back more salary than sent out");
      }

      // No cash considerations
      if (team.sends.some((p) => p.cashConsideration > 0)) {
        violations.push("Can't include cash in trades");
      }

      team.secondApronViolations = violations;
      return violations.length === 0;
    },
    message: (team) => team.secondApronViolations?.join('; ') || '',
  },

  stepienRule: {
    test: (team) => {
      const futureFirsts = [...team.picksOut, ...(team.team.picks || [])]
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

          // Both picks must have meaningful protection
          if (!isMeaningfulProtection(pick1?.protection)) return false;
          if (!isMeaningfulProtection(pick2?.protection)) return false;
        }
      }
      return true;
    },
    message: 'Violates Stepien Rule (consecutive unprotected future 1sts)',
  },

  tradeException: {
    test: (team, context) => {
      return team.sends.every((p) => {
        if (!p.acquiredViaTPE) return true;

        const tpe = team.team.tradeExceptions?.find((t) => t.id === p.tpeId);
        if (!tpe) return false;

        const salary =
          p.contract_clean?.salaries_by_year?.[context.yearKey]?.salary || 0;
        const expired =
          tpe.expirationDate && new Date(tpe.expirationDate) < new Date();

        return salary <= tpe.amount && !tpe.isUsed && !expired;
      });
    },
    message: 'Invalid trade exception usage',
  },
};

// Helper function for Stepien Rule protections
function isMeaningfulProtection(protection) {
  if (!protection) return false;
  // Example - "Top 5 protected" is meaningful
  return (
    /top\s*\d+/i.test(protection) ||
    /lottery/i.test(protection) ||
    /1-14/i.test(protection)
  );
}

// Enhanced validateTrade function
export function validateTrade({ teams, capProjections, currentYear }) {
  const yearKey = currentYear;
  const capSettings =
    capProjections[`${currentYear}-${String(currentYear + 1).slice(-2)}`] || {};

  // Precompute all financials and flags
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
    const hardCapLimit = getHardCapLimit(team.team, capSettings);

    return {
      ...team,
      salaryOut,
      salaryIn,
      projectedSalary,
      overCap: team.team.totalSalary > capSettings.cap,
      willBeOverFirst: projectedSalary > (capSettings.firstApron || Infinity),
      willBeOverSecond: projectedSalary > (capSettings.secondApron || Infinity),
      hardCapTriggered: team.team.hardCapTriggered,
      hardCapLimit,
      overHardCap: hardCapLimit ? projectedSalary > hardCapLimit : false,
      apronStatus: getApronStatus(projectedSalary, capSettings),
    };
  });

  // Apply all rules
  const validatedResults = teamResults.map((team) => {
    const violations = [];
    const checks = {};

    // Test each rule
    Object.entries(TRADE_RULES).forEach(([ruleName, rule]) => {
      const passes = rule.test(team, {
        teams: teamResults,
        capSettings,
        yearKey,
      });

      checks[ruleName] = passes;
      if (!passes) {
        violations.push(
          typeof rule.message === 'function'
            ? rule.message(team, { teams: teamResults, capSettings })
            : rule.message
        );
      }
    });

    return {
      ...team,
      legal: violations.length === 0,
      violations,
      checks,
    };
  });

  // Generate summary
  const summaryByTeamIndex = teamResults.map((t, i) => ({
    teamName: t.team.teamName,
    playersOut: t.sends.map((p) => p.name),
    playersIn: getIncomingPlayers(t.team.id, teams),
    picksOut: t.picksOut,
    picksIn: getIncomingPicks(t.team.id, teams),
    rosterDelta: getIncomingPlayers(t.team.id, teams).length - t.sends.length,
    capDelta: t.projectedSalary - t.team.totalSalary,
    usedTPEs: t.sends
      .filter((p) => p.acquiredViaTPE)
      .map((p) => ({
        id: p.tpeId,
        player: p.name,
        amount: p.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0,
      })),
  }));

  return {
    overallLegal: validatedResults.every((r) => r.legal),
    teamResults: validatedResults,
    summaryByTeamIndex,
    reason:
      validatedResults.flatMap((r) => r.violations).join('; ') ||
      'Trade complies with all CBA rules',
  };
}
