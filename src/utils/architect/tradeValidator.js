export function validateTrade({
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
  const yearKey = currentYear;
  const key = `${currentYear}-${String((currentYear + 1) % 100).padStart(2, '0')}`;
  const capSettings = capProjections[key] || {};

  const getSalary = (players) =>
    players.reduce(
      (sum, p) =>
        sum + (p.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0),
      0
    );

  const teamASalaryOut = getSalary(teamASends);
  const teamBSalaryOut = getSalary(teamBSends);
  const teamASalaryIn = teamBSalaryOut;
  const teamBSalaryIn = teamASalaryOut;

  const teamAResult = evaluateTeam({
    team: teamA,
    salaryOut: teamASalaryOut,
    salaryIn: teamASalaryIn,
    rosterOut: teamASends.length,
    rosterIn: teamBSends.length,
    hardCapped: teamAHardCapped,
    capSettings,
  });

  const teamBResult = evaluateTeam({
    team: teamB,
    salaryOut: teamBSalaryOut,
    salaryIn: teamBSalaryIn,
    rosterOut: teamBSends.length,
    rosterIn: teamASends.length,
    hardCapped: teamBHardCapped,
    capSettings,
  });

  const firstApron = capSettings.firstApron || Infinity;

  if (teamASends.some((p) => p.signAndTrade)) {
    if (teamASends.length > 1) {
      teamAResult.legal = false;
      teamAResult.reason =
        'Sign-and-trade player must be traded alone, and receiving team cannot exceed first apron.';
    }
    if (teamBResult.projectedSalary > firstApron) {
      teamBResult.legal = false;
      teamBResult.reason =
        'Sign-and-trade player must be traded alone, and receiving team cannot exceed first apron.';
    }
  }

  if (teamBSends.some((p) => p.signAndTrade)) {
    if (teamBSends.length > 1) {
      teamBResult.legal = false;
      teamBResult.reason =
        'Sign-and-trade player must be traded alone, and receiving team cannot exceed first apron.';
    }
    if (teamAResult.projectedSalary > firstApron) {
      teamAResult.legal = false;
      teamAResult.reason =
        'Sign-and-trade player must be traded alone, and receiving team cannot exceed first apron.';
    }
  }

  const teamResults = [teamAResult, teamBResult];
  let overallLegal = teamResults.every((r) => r.legal);
  let reason = 'All teams comply with trade rules.';

  if (overallLegal) {
    if (hasStepienViolation(teamAPicksOut)) {
      overallLegal = false;
      teamResults[0].legal = false;
      teamResults[0].reason = 'Violates Stepien Rule';
      reason = 'Team A violates Stepien Rule (trading consecutive future 1sts)';
    } else if (hasStepienViolation(teamBPicksOut)) {
      overallLegal = false;
      teamResults[1].legal = false;
      teamResults[1].reason = 'Violates Stepien Rule';
      reason = 'Team B violates Stepien Rule (trading consecutive future 1sts)';
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
