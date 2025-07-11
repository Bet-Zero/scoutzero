export function validateTrade({ 
    teamASends, 
    teamBSends, 
    teamAPicksOut, 
    teamBPicksOut, 
    capSettings, 
    currentYear, 
    teamAHardCapped, 
    teamBHardCapped,
    teamA,
    teamB
  }) {
  const yearKey = `${currentYear}-${String(currentYear + 1).slice(-2)}`;
  const teamASalaryOut = teamASends.reduce(
      (sum, p) => sum + (p.contract_clean?.yearly?.[yearKey] || 0), 0);
  const teamBSalaryOut = teamBSends.reduce(
      (sum, p) => sum + (p.contract_clean?.yearly?.[yearKey] || 0), 0);
    
    const teamASalaryIn = teamBSalaryOut;
    const teamBSalaryIn = teamASalaryOut;
  
    // Team A validation
    const teamAValid = isTradeLegal({
      salaryOut: teamASalaryOut,
      salaryIn: teamASalaryIn,
      hardCapped: teamAHardCapped,
      tpes: extractTPEs(teamA),
      team: teamA,
      capSettings
    });
  
    // Team B validation
    const teamBValid = isTradeLegal({
      salaryOut: teamBSalaryOut,
      salaryIn: teamBSalaryIn,
      hardCapped: teamBHardCapped,
      tpes: extractTPEs(teamB),
      team: teamB,
      capSettings
    });
  
    if (!teamAValid.allowed) {
      return { 
        legal: false, 
        reason: `Team A cannot take back that much salary. ${teamAValid.reason}` 
      };
    }
  
    if (!teamBValid.allowed) {
      return { 
        legal: false, 
        reason: `Team B cannot take back that much salary. ${teamBValid.reason}` 
      };
    }
  
    // Check Stepien Rule (can't trade consecutive future 1sts)
    if (hasStepienViolation(teamAPicksOut)) {
      return { 
        legal: false, 
        reason: "Team A violates Stepien Rule (trading consecutive future 1sts)" 
      };
    }
  
    if (hasStepienViolation(teamBPicksOut)) {
      return { 
        legal: false, 
        reason: "Team B violates Stepien Rule (trading consecutive future 1sts)" 
      };
    }
  
    return { legal: true };
  }
  
  function isTradeLegal({ 
    salaryOut, 
    salaryIn, 
    hardCapped, 
    tpes, 
    team,
    capSettings 
  }) {
    const allowable = salaryOut * 1.25 + 100000;
    const underCap = team.totalSalary < capSettings.cap;
  
    // 1. Under cap teams can absorb salary
    if (underCap) {
      const capRoom = capSettings.cap - team.totalSalary;
      if (salaryIn <= salaryOut + capRoom) {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        reason: `Needs $${salaryIn - salaryOut} cap space but only has $${capRoom}` 
      };
    }
  
    // 2. Hard capped teams (from sign-and-trade or using full MLE)
    if (hardCapped && salaryIn > salaryOut) {
      return { 
        allowed: false, 
        reason: "Hard capped team cannot take back more salary than it sends out" 
      };
    }
  
    // 3. Standard 125% rule
    if (salaryIn <= allowable) {
      return { allowed: true };
    }
  
    // 4. Try trade exceptions
    const tpeMatch = tpes.find(tpe => tpe.amount >= salaryIn);
    if (tpeMatch) {
      return { allowed: true, usedTPE: tpeMatch };
    }
  
    return { 
      allowed: false, 
      reason: `Receiving $${salaryIn}, allowed only $${allowable.toLocaleString()} under 125% rule` 
    };
  }
  
  function extractTPEs(teamCapSheet) {
    const now = new Date();
    return (teamCapSheet.tradeExceptions || [])
      .filter(tpe => new Date(tpe.expires) > now && tpe.amount > 0);
  }
  
  function hasStepienViolation(picksOut) {
    const yearsOut = picksOut
      .filter(p => p.round === '1st')
      .map(p => p.year)
      .sort();
    
    // Check for consecutive years
    for (let i = 1; i < yearsOut.length; i++) {
      if (yearsOut[i] === yearsOut[i-1] + 1) {
        return true;
      }
    }
    return false;
  }