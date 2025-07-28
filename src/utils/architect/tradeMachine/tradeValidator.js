// tradeValidator.js - Combined Complete Version

// ===== DEBUGGER =====
const debug = {
  enabled: true,
  logs: [],

  /**
   * Append a message to the debug log. The message is printed to the
   * console for immediate visibility and stored so it can be flushed to
   * a text file later on.
   */
  write(msg = '') {
    if (!this.enabled) return;
    if (msg !== '' || this.logs.length > 0) {
      this.logs.push(msg);
    }
    console.log(msg);
  },

  logTrade(team) {
    this.write('');
    this.write(`=== ${team.team.teamName} ===`);
    this.write(`Current Salary: ${formatSalary(team.team.totalSalary)}`);
    this.write(
      `Status: ${getApronStatus(team.team.totalSalary, team.context.capSettings)}`
    );
  },

  logSalaries(team) {
    this.write('Outgoing:');
    team.sends.forEach((p) => {
      const salary =
        p.contract_clean?.salaries_by_year?.[team.context.yearKey]?.salary || 0;
      this.write(`  - ${p.name}: ${formatSalary(salary)}`);
    });

    this.write('Incoming:');
    team.incomingPlayers.forEach((p) => {
      const salary =
        p.contract_clean?.salaries_by_year?.[team.context.yearKey]?.salary || 0;
      this.write(`  - ${p.name}: ${formatSalary(salary)}`);
    });

    this.write(
      `Totals: OUT ${formatSalary(team.salaryOut)} | IN ${formatSalary(team.salaryIn)}`
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
      this.write(`1-to-Many max incoming: ${formatSalary(outgoing)}`);
    } else {
      this.write('Many-to-Many: pair incoming with outgoing');
    }

    if (violations.length) {
      this.write('Violations:');
      violations.forEach((v) => this.write(`  - ${v}`));
    } else {
      this.write('All rules satisfied');
    }

    // Spacer between team logs for readability
    this.write('');
  },

  async flush(file = 'trade-debug.txt') {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      await fs.promises.writeFile(file, this.logs.join('\n'), 'utf8');
      console.log(`\nDebug log written to ${file}`);
    }
  },
};

// ===== UTILITIES =====
const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight
  return expiry <= today;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatSalary = (amount) => `$${(amount || 0).toLocaleString()}`;

const getApronStatus = (salary, { firstApron, secondApron } = {}) => {
  if (secondApron && salary > secondApron) return 'ABOVE 2nd APRON 🔴';
  if (firstApron && salary > firstApron) return 'Above 1st Apron ⚠️';
  return 'Below Aprons ✅';
};

// ===== CBA CONSTANTS =====
const CBA_THRESHOLDS = {
  FIRST_APRON: 172_295_000,
  SECOND_APRON: 182_794_000,
  MIN_SALARY: 1_119_563,
  MAX_CASH: 7_100_000,
  TRADE_BUFFER: 100_000,
  STEPIEN_YEARS: 7,
};

const MAX_FUTURE_PICK_YEARS = 7;

// ===== TRADE EXCEPTION VALIDATION =====
export function validateTradeExceptions(team) {
  const violations = [];

  team.incomingPlayers.forEach((player) => {
    if (!player.acquiredViaTPE) return;

    const tpeIndex = team.tradeExceptions.findIndex(
      (e) => e.id === player.tpeId
    );
    if (tpeIndex === -1) {
      violations.push(`No TPE found for ${player.name}`);
      return;
    }

    const tpe = team.tradeExceptions[tpeIndex];
    const remaining =
      typeof tpe.remaining === 'number' ? tpe.remaining : tpe.amount;
    const expiry = tpe.expiry || tpe.expirationDate;

    // Check for concurrent usage
    if (tpe.isBeingUsed) {
      violations.push(`TPE ${tpe.id} is already being processed`);
      return;
    }

    // Validate TPE
    if (remaining < player.salary) {
      violations.push(
        `TPE too small for ${player.name}\n` +
          `- Available: $${remaining.toLocaleString()}\n` +
          `- Required: $${player.salary.toLocaleString()}`
      );
    } else if (isExpired(expiry)) {
      violations.push(`TPE expired on ${formatDate(expiry)}`);
    } else {
      // Lock and update TPE
      team.tradeExceptions[tpeIndex] = {
        ...tpe,
        isBeingUsed: true,
        remaining: remaining - player.salary,
        isUsed: remaining - player.salary <= 0,
      };
    }
  });

  return violations;
}

// DRAFT PICKS VALIDATION
export function validateDraftPicks(team, allTeams) {
  const violations = [];
  const currentYear = new Date().getFullYear();

  // Stepien Rule (no consecutive 1sts)
  const tradedFirsts = team.tradedPicks
    .filter((p) => p.round === 1 && !p.isProtected)
    .map((p) => p.year)
    .sort();

  for (let i = 0; i < tradedFirsts.length - 1; i++) {
    if (tradedFirsts[i + 1] === tradedFirsts[i] + 1) {
      violations.push(
        `Cannot trade ${tradedFirsts[i]} and ${tradedFirsts[i + 1]} 1st-round picks`
      );
    }
  }

  const limit = currentYear + CBA_THRESHOLDS.STEPIEN_YEARS;
  const distantPicks = team.tradedPicks.filter((p) => p.year > limit);
  if (distantPicks.length > 0) {
    violations.push(`Cannot trade picks beyond ${limit} (7 years out)`);
  }

  return violations;
}

// ROSTER LIMITS VALIDATION
export function validateRosterLimits(team) {
  const violations = [];
  const postTradeRosterSize =
    team.currentRoster.length - team.sends.length + team.incomingPlayers.length;

  if (postTradeRosterSize > 15) {
    violations.push(`Roster would exceed 15 players (${postTradeRosterSize})`);
  }

  if (postTradeRosterSize < 14) {
    violations.push(
      `Roster would fall below 14 players (${postTradeRosterSize})`
    );
  }

  return violations;
}

// CASH CONSIDERATIONS VALIDATION
export function validateCash(team) {
  const violations = [];

  if (team.cashSent > CBA_THRESHOLDS.MAX_CASH) {
    violations.push(
      `Cash sent ($${team.cashSent}) exceeds $${CBA_THRESHOLDS.MAX_CASH} limit`
    );
  }

  if ((team.overSecondApron || team.willBeOverSecond) && team.cashSent > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }

  return violations;
}

// SIGN-AND-TRADE RULES VALIDATION
export function validateSignAndTrade(team) {
  const violations = [];
  const sntPlayers = team.incomingPlayers.filter(
    (p) => p.isSignAndTrade || p.signAndTrade
  );

  if (sntPlayers.length > 0) {
    // Player must be traded alone
    if (team.sends.length > 1) {
      violations.push('Sign-and-trade player must be traded alone.');
    }

    // Hard cap check against dynamic first apron
    const firstApron =
      team.context.capSettings?.firstApron ?? CBA_THRESHOLDS.FIRST_APRON;
    if (team.projectedSalary > firstApron) {
      violations.push('Sign-and-trade would hard-cap team at 1st apron');
    }

    // Contract length check
    sntPlayers.forEach((p) => {
      const years = p.contractYears ?? p.years ?? 0;
      if (years < 3 || years > 4) {
        violations.push(`S&T contract for ${p.name} must be 3-4 years`);
      }
    });
  }

  return violations;
}

// BASE YEAR COMPENSATION VALIDATION
export function validateBYC(team) {
  const violations = [];

  team.incomingPlayers.forEach((p) => {
    if (p.isBYC) {
      const bycValue = p.previousSalary * 1.2;
      if (p.salary > bycValue) {
        violations.push(
          `BYC restriction: ${p.name}'s salary ($${p.salary}) > 120% of previous ($${bycValue})`
        );
      }
    }
  });

  return violations;
}

// SECOND APRON AGGREGATION VALIDATION
export function validateSecondApronAggregation(team) {
  const violations = [];
  if (!team.overSecondApron && !team.willBeOverSecond) return violations;

  const outgoing = team.sends.map((p) => p.salary || 0).sort((a, b) => b - a);
  const incoming = team.incomingPlayers
    .map((p) => p.salary || 0)
    .sort((a, b) => b - a);

  let aggregated = false;
  if (team.sends.length === 1) {
    const maxOut = outgoing[0];
    incoming.forEach((s) => {
      if (s > maxOut) aggregated = true;
    });
  } else {
    incoming.forEach((s, i) => {
      if (s > (outgoing[i] || 0)) aggregated = true;
    });
  }

  if (aggregated) {
    violations.push('Second apron team cannot aggregate salaries');
  }
  if (
    incoming.reduce((a, b) => a + b, 0) > outgoing.reduce((a, b) => a + b, 0)
  ) {
    violations.push('Second apron team cannot receive more salary than sent');
  }

  return violations;
}

// MAIN NEW RULES VALIDATOR
export function validateAllNewRules(team, allTeams) {
  return [
    ...validateTradeExceptions(team),
    ...validateDraftPicks(team, allTeams),
    ...validateRosterLimits(team),
    ...validateCash(team),
    ...validateSignAndTrade(team),
    ...validateBYC(team),
    ...validateSecondApronAggregation(team),
  ];
}

// ===== HELPERS =====
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

      let aggregated = false;

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
        incoming.forEach((s) => {
          if (s > maxOut) aggregated = true;
        });
      }
      // Many-to-Many Rule
      incoming.forEach((s, i) => {
        const outgoingSalary = outgoing[i] || 0;
        if (s > outgoingSalary) aggregated = true;
      });

      if (aggregated) {
        violations.push('Second apron team cannot aggregate salaries');
      }

      // Total salary check
      if (team.salaryIn > team.salaryOut) {
        violations.push(
          'Second apron team cannot receive more salary than sent'
        );
      }

      team.secondApronViolations = violations;
      debug.logSecondApron(team, violations);
      return violations.length === 0;
    },
    message: (team) => team.secondApronViolations.join('\n'),
  },

  cashRestrictions: {
    test: (team) => {
      if (!team.overSecondApron && !team.willBeOverSecond) return true;
      return (team.cashSent || 0) === 0;
    },
    message: () => 'Second apron team cannot include cash in trades',
  },

  futurePicks: {
    test: (team) => {
      const limit = team.context.yearKey + MAX_FUTURE_PICK_YEARS;
      return !(team.picksOut || []).some((p) => p.year > limit);
    },
    message: (team) =>
      `Cannot trade picks beyond ${team.context.yearKey + MAX_FUTURE_PICK_YEARS} (7 years out)`,
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
      picksOut: team.picksOut || [],
      cashSent: team.cashSent || 0,
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
      picksOut: team.picksOut,
      cashSent: team.cashSent,
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

    // Add new rules validations
    const newRuleViolations = validateAllNewRules(team, initialTeams);
    violations.push(...newRuleViolations);

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

export { debug as tradeDebug };
