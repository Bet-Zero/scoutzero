import { getSalaryForYear } from '@/utils/architect/tradeHelpers';
import defaultCapProjections from '@/utils/architect/capProjections';

// Rule definitions
const TRADE_RULES = {
  salaryMatching: {
    test: (team, context) => {
      if (team.sends.some((p) => p.acquiredViaTPE)) return true;
      return (
        team.salaryIn <=
        calculateAllowableIncoming(
          team.totalSalary,
          team.salaryOut,
          context.capSettings
        )
      );
    },
    message: 'Incoming salary exceeds CBA limits',
  },
  stepienRule: {
    test: (team) => {
      const futureFirsts = [...team.picksOut, ...(team.team.picks || [])]
        .filter((p) => (p.round === '1st' || p.round === 1) && !p.isSwap)
        .map((p) => parseInt(p.year));

      futureFirsts.sort((a, b) => a - b);

      for (let i = 1; i < futureFirsts.length; i++) {
        if (futureFirsts[i] === futureFirsts[i - 1] + 1) {
          const pick1 = team.picksOut.find(
            (p) => parseInt(p.year) === futureFirsts[i - 1]
          );
          const pick2 = team.picksOut.find(
            (p) => parseInt(p.year) === futureFirsts[i]
          );
          if (!pick1?.protection && !pick2?.protection) return false;
        }
      }
      return true;
    },
    message: 'Violates Stepien Rule (consecutive unprotected future 1sts)',
  },
  secondApronRestrictions: {
    test: (team, context) => {
      if (!team.willBeOverSecond) return true;

      const violations = [];
      if (team.sends.length > 1) {
        violations.push('Cannot aggregate multiple player salaries');
      }
      if (team.salaryIn > team.salaryOut) {
        violations.push('Cannot take back more salary than sent out');
      }
      if (team.sends.some((p) => p.cashConsideration > 0)) {
        violations.push('Cannot include cash in trades');
      }

      return violations.length === 0;
    },
    message: (team) => team.secondApronViolations?.join('; ') || '',
  },
};

export function validateTrade({ teams, capProjections, currentYear }) {
  const yearKey = currentYear;
  const capSettings =
    capProjections[`${currentYear}-${String(currentYear + 1).slice(-2)}`] ||
    defaultCapProjections;

  // Precompute financials
  const teamResults = teams.map((team) => {
    const salaryOut = getSalaryForYear(team.sends, yearKey);
    const salaryIn = teams.reduce(
      (sum, t) =>
        t.team.id === team.team.id
          ? sum
          : sum +
            getSalaryForYear(
              t.sends.filter((p) => !p.tradeTo || p.tradeTo === team.team.id),
              yearKey
            ),
      0
    );

    const projectedSalary = team.team.totalSalary - salaryOut + salaryIn;

    return {
      ...team,
      salaryOut,
      salaryIn,
      projectedSalary,
      overCap: team.team.totalSalary > capSettings.cap,
      willBeOverFirst: projectedSalary > (capSettings.firstApron || Infinity),
      willBeOverSecond: projectedSalary > (capSettings.secondApron || Infinity),
      apronStatus: getApronStatus(projectedSalary, capSettings),
    };
  });

  // Apply rules
  const validatedResults = teamResults.map((team) => {
    const violations = Object.entries(TRADE_RULES)
      .filter(
        ([_, rule]) => !rule.test(team, { teams: teamResults, capSettings })
      )
      .map(([_, rule]) =>
        typeof rule.message === 'function' ? rule.message(team) : rule.message
      );

    return {
      ...team,
      legal: violations.length === 0,
      violations,
      checks: Object.fromEntries(
        Object.keys(TRADE_RULES).map((rule) => [
          rule,
          !violations.some((v) => v.includes(TRADE_RULES[rule].message)),
        ])
      ),
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
      validatedResults.flatMap((r) => r.violations).join(' ') ||
      'Trade complies with CBA rules',
  };
}

// Helper functions
function calculateAllowableIncoming(
  totalSalary,
  salaryOut,
  { cap, firstApron }
) {
  const overCap = totalSalary > cap;
  if (!overCap) return salaryOut + 250000 + Math.max(0, cap - totalSalary);
  if (salaryOut < 6_530_000) return salaryOut * 1.75 + 100_000;
  if (salaryOut < 19_600_000) return salaryOut * 1.25 + 100_000;
  return salaryOut * 1.25;
}

function getApronStatus(salary, { firstApron, secondApron }) {
  if (salary > secondApron) return 'Above 2nd Apron';
  if (salary > firstApron) return 'Above 1st Apron';
  return 'Below Aprons';
}

function getIncomingPlayers(teamId, allTeams) {
  return allTeams
    .flatMap((t) =>
      t.team.id === teamId
        ? []
        : t.sends.filter((p) => !p.tradeTo || p.tradeTo === teamId)
    )
    .map((p) => p.name);
}

function getIncomingPicks(teamId, allTeams) {
  return allTeams.flatMap((t) =>
    t.team.id === teamId
      ? []
      : t.picksOut.filter((p) => !p.toTeamId || p.toTeamId === teamId)
  );
}
