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
  // Support old two-team signature by converting to teams array
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

  const getSalary = (players) =>
    players.reduce(
      (sum, p) =>
        sum + (p.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0),
      0
    );

  // Precompute outgoing salary and roster counts
  const salaryOut = teams.map((t) => getSalary(t.sends || []));
  const rosterOut = teams.map((t) => (t.sends || []).length);

  // Incoming is sum of all other teams' outgoing
  const salaryIn = teams.map((_, idx) =>
    salaryOut.reduce((sum, val, j) => (j === idx ? sum : sum + val), 0)
  );
  const rosterIn = teams.map((_, idx) =>
    teams.reduce(
      (sum, t, j) => (j === idx ? sum : sum + (t.sends || []).length),
      0
    )
  );

  const teamResults = teams.map((t, idx) =>
    evaluateTeam({
      team: t.team,
      salaryOut: salaryOut[idx],
      salaryIn: salaryIn[idx],
      rosterOut: rosterOut[idx],
      rosterIn: rosterIn[idx],
      hardCapped: t.hardCapped ?? t.team?.hardCapped,
      capSettings,
    })
  );

  const firstApron = capSettings.firstApron || Infinity;

  teams.forEach((t, idx) => {
    if (t.sends?.some((p) => p.signAndTrade)) {
      if ((t.sends || []).length > 1) {
        teamResults[idx].legal = false;
        teamResults[idx].reason =
          'Sign-and-trade player must be traded alone, and receiving team cannot exceed first apron.';
      }
      teamResults.forEach((res, j) => {
        if (j !== idx && res.projectedSalary > firstApron) {
          res.legal = false;
          res.reason =
            'Sign-and-trade player must be traded alone, and receiving team cannot exceed first apron.';
        }
      });
    }
  });

  let overallLegal = teamResults.every((r) => r.legal);
  let reason = 'All teams comply with trade rules.';

  if (overallLegal) {
    for (let i = 0; i < teams.length; i++) {
      if (hasStepienViolation(teams[i].picksOut || [])) {
        overallLegal = false;
        teamResults[i].legal = false;
        teamResults[i].reason = 'Violates Stepien Rule';
        reason = `Team ${i + 1} violates Stepien Rule (trading consecutive future 1sts)`;
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

function evaluateTeam({
  team,
  salaryOut,
  salaryIn,
  rosterOut,
  rosterIn,
  hardCapped,
  capSettings,
}) {
  const { cap = 0, firstApron = Infinity } = capSettings;
  const overCap = team.totalSalary > cap;
  const capRoom = Math.max(0, cap - team.totalSalary);

  let allowable = 0;

  if (!overCap) {
    allowable = salaryOut + 250000 + capRoom;
  } else if (salaryOut < 6530000) {
    allowable = salaryOut * 1.75 + 100000;
  } else if (salaryOut < 19600000) {
    allowable = salaryOut * 1.25 + 100000;
  } else {
    allowable = salaryOut * 1.25;
  }

  const projectedSalary = team.totalSalary - salaryOut + salaryIn;
  const apronStatus =
    projectedSalary > firstApron ? 'Above 1st Apron' : 'Under 1st Apron';

  if (salaryIn > allowable) {
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

  if (hardCapped && projectedSalary > firstApron) {
    return {
      teamId: team.teamId || team.id,
      legal: false,
      reason: 'Exceeds first apron hard cap',
      salaryIn,
      salaryOut,
      projectedSalary,
      apronStatus,
    };
  }

  const finalRoster = team.players.length - rosterOut + rosterIn;
  if (finalRoster < 12 || finalRoster > 15) {
    return {
      teamId: team.teamId || team.id,
      legal: false,
      reason: 'Roster size out of bounds',
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

function hasStepienViolation(picksOut) {
  const yearsOut = picksOut
    .filter((p) => p.round === '1st')
    .map((p) => p.year)
    .sort();

  // Check for consecutive years
  for (let i = 1; i < yearsOut.length; i++) {
    if (yearsOut[i] === yearsOut[i - 1] + 1) {
      return true;
    }
  }
  return false;
}
