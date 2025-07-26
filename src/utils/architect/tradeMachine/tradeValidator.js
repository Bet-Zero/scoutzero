// tradeValidator.js

import { getSalaryForYear } from '@/utils/architect/tradeHelpers';
import defaultCapProjections from '@/utils/architect/capProjections';

export function validateTrade({
  teams,
  teamASends,
  teamBSends,
  teamAPicksOut,
  teamBPicksOut,
  capProjections = defaultCapProjections,
  currentYear = new Date().getFullYear(),
  teamAHardCapped,
  teamBHardCapped,
  teamA,
  teamB,
}) {
  // Support old 2-team signature
  if (!Array.isArray(teams)) {
    teams = [
      {
        team: teamA,
        sends: teamASends || [],
        picksOut: teamAPicksOut || [],
        hardCapped: teamAHardCapped,
      },
      {
        team: teamB,
        sends: teamBSends || [],
        picksOut: teamBPicksOut || [],
        hardCapped: teamBHardCapped,
      },
    ].filter((t) => t.team);
  }

  const yearKey = currentYear;
  const key = `${currentYear}-${String((currentYear + 1) % 100).padStart(2, '0')}`;
  const capSettings = capProjections[key] || {};

  // Precompute salary in/out
  const salaryOut = teams.map((t) => getSalaryForYear(t.sends, yearKey));
  const salaryIn = teams.map((_, idx) =>
    teams.reduce(
      (sum, t, j) =>
        j === idx ? sum : sum + getSalaryForYear(t.sends, yearKey),
      0
    )
  );
  const rosterOut = teams.map((t) => t.sends.length);
  const rosterIn = teams.map((_, idx) =>
    teams.reduce((sum, t, j) => (j === idx ? sum : sum + t.sends.length), 0)
  );

  const teamResults = teams.map((t, idx) => {
    const evaluation = evaluateTeam({
      team: t.team,
      salaryOut: salaryOut[idx],
      salaryIn: salaryIn[idx],
      rosterOut: rosterOut[idx],
      rosterIn: rosterIn[idx],
      hardCapped: t.hardCapped ?? t.team?.hardCapped,
      signAndTrade: t.sends.some((p) => p.signAndTrade),
      outgoingCount: t.sends.length,
      incomingCount: rosterIn[idx],
      capSettings,
    });

    return {
      teamName: t.team.teamName,
      ...evaluation,
      checks: {
        ...evaluation.checks,
        signAndTrade: true,
        stepien: true,
      },
    };
  });

  // Enforce Sign-and-Trade pairing + apron compliance
  teams.forEach((t, idx) => {
    if (t.sends.some((p) => p.signAndTrade)) {
      if ((t.sends || []).length > 1) {
        teamResults[idx].reasons.push(
          'Sign-and-trade player must be traded alone.'
        );
        teamResults[idx].checks.signAndTrade = false;
      }
      teamResults.forEach((res, j) => {
        const projected = res.projectedSalary;
        if (j !== idx && projected > (capSettings.firstApron || Infinity)) {
          res.reasons.push(
            'Receiving team exceeds first apron with a sign-and-trade.'
          );
          res.checks.signAndTrade = false;
        }
      });
    }
  });

  // Stepien Rule check (simplified)
  teams.forEach((t, i) => {
    if (hasStepienViolation(t.picksOut || [])) {
      teamResults[i].reasons.push(
        'Violates Stepien Rule (consecutive future 1sts).'
      );
      teamResults[i].checks.stepien = false;
    }
  });

  teamResults.forEach((res) => {
    res.legal = res.reasons.length === 0;
    res.reason = res.reasons.join(' ');
  });

  const overallLegal = teamResults.every((r) => r.legal);
  const reason =
    teamResults
      .filter((r) => !r.legal)
      .map((r) => r.reason)
      .join(' ') || 'All teams comply with trade rules.';

  const summaryByTeamIndex = teams.map((t, idx) => {
    if (!t.team) return null;
    const playersIn = [];
    const picksIn = [];
    teams.forEach((other, j) => {
      if (j !== idx && other.team) {
        other.sends.forEach((pl) => {
          if (!pl.tradeTo || pl.tradeTo === t.team.id || pl.tradeTo === t.team.teamId) {
            playersIn.push(pl);
          }
        });
        other.picksOut.forEach((p) => {
          if (
            !p.toTeamId ||
            p.toTeamId === t.team.id ||
            p.toTeamId === t.team.teamId
          ) {
            picksIn.push(p);
          }
        });
      }
    });
    const currentSalary = t.team.totalSalary || 0;
    const projectedSalary = teamResults[idx].projectedSalary;
    return {
      teamName: t.team.teamName,
      playersOut: t.sends.map((p) => p.name),
      playersIn: playersIn.map((p) => p.name),
      picksOut: t.picksOut,
      picksIn,
      rosterDelta: playersIn.length - t.sends.length,
      capDelta: projectedSalary - currentSalary,
    };
  });

  return { overallLegal, teamResults, reason, summaryByTeamIndex };
}

// =========================
// Per-Team Trade Evaluation
// =========================

function evaluateTeam({
  team,
  salaryOut,
  salaryIn,
  rosterOut,
  rosterIn,
  hardCapped,
  signAndTrade,
  outgoingCount,
  incomingCount,
  capSettings,
}) {
  const {
    cap = 0,
    firstApron = Infinity,
    secondApron = Infinity,
  } = capSettings;

  const totalSalary = team.totalSalary || 0;
  const projectedSalary = totalSalary - salaryOut + salaryIn;
  const overCap = totalSalary > cap;
  const overFirst = totalSalary > firstApron;
  const overSecond = totalSalary > secondApron;
  const willBeOverFirst = projectedSalary > firstApron;
  const willBeOverSecond = projectedSalary > secondApron;

  const apronStatus =
    projectedSalary > secondApron
      ? 'Above 2nd Apron'
      : projectedSalary > firstApron
        ? 'Above 1st Apron'
        : 'Under Aprons';

  const capRoom = Math.max(0, cap - totalSalary);
  let allowableIn = 0;

  if (!overCap) {
    allowableIn = salaryOut + 250000 + capRoom;
  } else if (salaryOut < 6530000) {
    allowableIn = salaryOut * 1.75 + 100000;
  } else if (salaryOut < 19600000) {
    allowableIn = salaryOut * 1.25 + 100000;
  } else {
    allowableIn = salaryOut * 1.25;
  }

  const reasons = [];
  const checks = {
    secondApronAggregation: true,
    firstApronLimit: true,
    hardCap: true,
    salaryMatching: true,
  };

  // 2nd Apron: No aggregation
  if ((overSecond || willBeOverSecond) && outgoingCount > 1) {
    reasons.push('2nd Apron Rule: Cannot aggregate multiple salaries in trade');
    checks.secondApronAggregation = false;
  }

  // 1st Apron: Cannot receive more than sent
  if ((overFirst || willBeOverFirst) && salaryIn > salaryOut) {
    reasons.push('1st Apron Rule: Cannot receive more salary than sent');
    checks.firstApronLimit = false;
  }

  // Hard cap enforcement
  if (hardCapped && projectedSalary > firstApron) {
    reasons.push('Hard cap exceeded (1st Apron)');
    checks.hardCap = false;
  }

  // Standard over-cap matching
  if (overCap && salaryIn > allowableIn) {
    reasons.push('Incoming salary exceeds allowed amount');
    checks.salaryMatching = false;
  }

  return {
    teamId: team.teamId || team.id,
    legal: reasons.length === 0,
    reason: reasons.join(' '),
    reasons,
    salaryIn,
    salaryOut,
    projectedSalary,
    totalSalary,
    capRoom,
    willBeOverFirst,
    willBeOverSecond,
    overCap,
    overFirst,
    overSecond,
    cap,
    firstApron,
    secondApron,
    apronStatus,
    checks,
  };
}

// =========================
// Stepien Rule Checker
// =========================

function hasStepienViolation(picksOut) {
  const years = picksOut
    .filter(
      (p) => (p.round === '1st' || p.round === 1) && !p.protection && !p.isSwap
    )
    .map((p) => parseInt(p.year, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) return true;
  }
  return false;
}

export { hasStepienViolation };
