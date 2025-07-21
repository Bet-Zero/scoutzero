// tradeValidator.js

import { getSalaryForYear } from '@/utils/architect/tradeHelpers';

export function validateTrade({
  teams,
  teamASends,
  teamBSends,
  teamAPicksOut,
  teamBPicksOut,
  capProjections,
  currentYear,
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
    return {
      teamName: t.team.teamName,
      ...evaluateTeam({
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
      }),
    };
  });

  // Enforce Sign-and-Trade pairing + apron compliance
  teams.forEach((t, idx) => {
    if (t.sends.some((p) => p.signAndTrade)) {
      if ((t.sends || []).length > 1) {
        teamResults[idx].legal = false;
        teamResults[idx].reason = 'Sign-and-trade player must be traded alone.';
      }
      teamResults.forEach((res, j) => {
        const projected = res.projectedSalary;
        if (j !== idx && projected > (capSettings.firstApron || Infinity)) {
          res.legal = false;
          res.reason =
            'Receiving team exceeds first apron with a sign-and-trade.';
        }
      });
    }
  });

  // Stepien Rule check (simplified)
  let overallLegal = teamResults.every((r) => r.legal);
  let reason = 'All teams comply with trade rules.';

  if (overallLegal) {
    for (let i = 0; i < teams.length; i++) {
      if (hasStepienViolation(teams[i].picksOut || [])) {
        overallLegal = false;
        teamResults[i].legal = false;
        teamResults[i].reason =
          'Violates Stepien Rule (consecutive future 1sts).';
        reason = teamResults[i].reason;
        break;
      }
    }
  } else {
    reason = teamResults
      .filter((r) => !r.legal)
      .map((r) => r.reason)
      .join(' ');
  }

  return { overallLegal, teamResults, reason };
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

  // Roster size validation
  const finalRoster = team.players.length - rosterOut + rosterIn;
  if (finalRoster > 15) {
    return {
      teamId: team.teamId || team.id,
      legal: false,
      reason: 'Roster limit exceeded (15 max)',
      salaryIn,
      salaryOut,
      projectedSalary,
      apronStatus,
    };
  }

  // 2nd Apron: No aggregation
  if ((overSecond || willBeOverSecond) && outgoingCount > 1) {
    return {
      teamId: team.teamId || team.id,
      legal: false,
      reason: '2nd Apron Rule: Cannot aggregate multiple salaries in trade',
      salaryIn,
      salaryOut,
      projectedSalary,
      apronStatus,
    };
  }

  // 1st Apron: Cannot receive more than sent
  if ((overFirst || willBeOverFirst) && salaryIn > salaryOut) {
    return {
      teamId: team.teamId || team.id,
      legal: false,
      reason: '1st Apron Rule: Cannot receive more salary than sent',
      salaryIn,
      salaryOut,
      projectedSalary,
      apronStatus,
    };
  }

  // Hard cap enforcement
  if (hardCapped && projectedSalary > firstApron) {
    return {
      teamId: team.teamId || team.id,
      legal: false,
      reason: 'Hard cap exceeded (1st Apron)',
      salaryIn,
      salaryOut,
      projectedSalary,
      apronStatus,
    };
  }

  // Standard over-cap matching
  if (overCap && salaryIn > allowableIn) {
    return {
      teamId: team.teamId || team.id,
      legal: false,
      reason: 'Incoming salary exceeds allowed amount',
      salaryIn,
      salaryOut,
      projectedSalary,
      apronStatus,
    };
  }

  return {
    teamId: team.teamId || team.id,
    legal: true,
    reason: '',
    salaryIn,
    salaryOut,
    projectedSalary,
    apronStatus,
  };
}

// =========================
// Stepien Rule Checker
// =========================

function hasStepienViolation(picksOut) {
  const years = picksOut
    .filter((p) => p.round === '1st' || p.round === 1)
    .map((p) => parseInt(p.year))
    .sort((a, b) => a - b);

  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) return true;
  }
  return false;
}
