// tradeValidator.js - Combined Complete Version
import {
  calculateAllowableIncoming,
  getSalaryForYear,
  getApronStatus,
  formatCurrency,
} from '@/utils/architect/tradeHelpers.js'; // 🆕 .js extension kept for Vite
import { wouldExceedHardCap } from '@/utils/architect/hardCapUtils.js';
import { CBA_MECHANICS } from '@/utils/architect/cbaMechanics.js';

// ===== DEBUGGER =====
const debug = {
  enabled: false,
  logs: [],
  records: [],

  /**
   * Append a message to the debug log. The message is printed to the
   * console for immediate visibility and stored so it can be flushed to
   * a text file later on.
   */
  write(msg = '', meta = {}) {
    if (!this.enabled) return;
    if (msg !== '' || this.logs.length > 0) {
      this.logs.push(msg);
      this.records.push({
        msg,
        time: new Date(),
        team: meta.team,
        rule: meta.rule,
        salary: meta.salary || false,
      });
    }
    console.log(msg);
  },

  log(msg, meta = {}) {
    this.write(msg, meta);
  },

  logTrade(team) {
    this.log('', { team: team.team.teamName });
    this.log(`=== ${team.team.teamName} ===`, { team: team.team.teamName });
    this.log(`Current Salary: ${formatCurrency(team.team.totalSalary)}`, {
      team: team.team.teamName,
    });
    this.log(
      `Status: ${getApronStatus(team.team.totalSalary, team.context.capSettings)}`,
      { team: team.team.teamName }
    );
  },

  logSalaries(team) {
    this.log('Outgoing:', { team: team.team.teamName, salary: true });
    (team.sends || []).forEach((p) => {
      const salary =
        p.contract_clean?.salaries_by_year?.[team.context.yearKey]?.salary || 0;
      this.log(`  - ${p.name}: ${formatCurrency(salary)}`, {
        team: team.team.teamName,
        salary: true,
      });
    });

    this.log('Incoming:', { team: team.team.teamName, salary: true });
    (team.incomingPlayers || []).forEach((p) => {
      const salary =
        p.contract_clean?.salaries_by_year?.[team.context.yearKey]?.salary || 0;
      this.log(`  - ${p.name}: ${formatCurrency(salary)}`, {
        team: team.team.teamName,
        salary: true,
      });
    });

    this.log(
      `Totals: OUT ${formatCurrency(team.salaryOut)} | IN ${formatCurrency(team.salaryIn)}`,
      { team: team.team.teamName, salary: true }
    );
  },

  logSecondApron(team, violations) {
    if (!team.overSecondApron && !team.willBeOverSecond) return;

    this.log('Second Apron Rules:', {
      team: team.team.teamName,
      rule: 'secondApron',
    });
    this.log(
      `Trade Type: ${team.sends.length}-for-${team.incomingPlayers.length}`,
      {
        team: team.team.teamName,
        rule: 'secondApron',
      }
    );

    if (team.sends.length === 1) {
      const outgoing =
        team.sends[0].contract_clean?.salaries_by_year?.[team.context.yearKey]
          ?.salary || 0;
      this.log(`1-to-Many max incoming: ${formatCurrency(outgoing)}`, {
        team: team.team.teamName,
        rule: 'secondApron',
      });
    } else {
      this.log('Many-to-Many: pair incoming with outgoing', {
        team: team.team.teamName,
        rule: 'secondApron',
      });
    }

    if (violations.length) {
      this.log('Violations:', {
        team: team.team.teamName,
        rule: 'secondApron',
      });
      violations.forEach((v) =>
        this.log(`  - ${v}`, { team: team.team.teamName, rule: 'secondApron' })
      );
    } else {
      this.log('All rules satisfied', {
        team: team.team.teamName,
        rule: 'secondApron',
      });
    }

    // Spacer between team logs for readability
    this.log('', { team: team.team.teamName, rule: 'secondApron' });
  },

  async flush(file = 'trade-debug.txt') {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      await fs.promises.writeFile(file, this.logs.join('\n'), 'utf8');
      console.log(`\nDebug log written to ${file}`);
    }
  },

  flushToUI({ showSalary = true, team = null, rule = null } = {}) {
    return this.records
      .filter((r) => {
        if (!showSalary && r.salary) return false;
        if (team && r.team !== team) return false;
        if (rule && r.rule !== rule) return false;
        return true;
      })
      .map((r) => `${r.time.toLocaleTimeString()} - ${r.msg}`);
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

const isMeaningfulProtection = (protection) => {
  if (!protection) return false;
  return (
    /top\s*[1-9]\d*/i.test(protection) ||
    /lottery/i.test(protection) ||
    /1-14/i.test(protection)
  );
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
  // Prevent TPEs already flagged as “in use” elsewhere (concurrent usage)
  if (team.tradeExceptions?.some((e) => e.isBeingUsed)) {
    team.tradeExceptions
      .filter((e) => e.isBeingUsed)
      .forEach((e) =>
        violations.push(
          `TPE ${e.id} is already being processed in another transaction`
        )
      );
  }
  const usedTPEs = new Map(); // Track usage during this validation

  const yearKey = team?.context?.yearKey ?? new Date().getFullYear();

  team.incomingPlayers.forEach((player) => {
    if (!player.acquiredViaTPE) return;

    const tpe = team.tradeExceptions.find((e) => e.id === player.tpeId);
    if (!tpe) {
      violations.push(`No valid TPE found for ${player.name}`);
      return;
    }

    // Check for concurrent usage in THIS validation pass
    if (usedTPEs.has(tpe.id)) {
      violations.push(
        `TPE ${tpe.id} is being used multiple times in this trade`
      );
      return;
    }
    const incoming = getSalaryForYear(player, yearKey);
    // === INSERT inside validateTradeExceptions ===
    if (new Date(tpe.expiryDate) < new Date()) {
      violations.push(`Trade exception ${tpe.id} is expired`);
      return;
    }
    if (incoming > tpe.amount) {
      violations.push(`Trade exception ${tpe.id} is too small`);
      return;
    }
    tpe.remaining = tpe.amount - incoming;
    tpe.isUsed = tpe.remaining === 0;
  });

  // Apply changes if no violations
  if (violations.length === 0) {
    usedTPEs.forEach((value, tpeId) => {
      const tpeIndex = team.tradeExceptions.findIndex((e) => e.id === tpeId);
      team.tradeExceptions[tpeIndex].remaining = value.newRemaining;
      team.tradeExceptions[tpeIndex].isUsed = value.newRemaining <= 0;
    });
  }

  return violations;
}

// DRAFT PICKS VALIDATION
export function validateDraftPicks(team, allTeams) {
  const violations = [];
  const currentYear = new Date().getFullYear();

  const unprotectedYears = (team.tradedPicks || [])
    .filter(
      (p) =>
        (p.round === 1 || p.round === '1st') &&
        !p.isSwap &&
        !isMeaningfulProtection(p.protection) &&
        !p.via
    )
    .map((p) => parseInt(p.year, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < unprotectedYears.length; i++) {
    if (unprotectedYears[i] === unprotectedYears[i - 1] + 1) {
      violations.push(
        `Cannot trade ${unprotectedYears[i - 1]} and ${unprotectedYears[i]} 1st-round picks`
      );
    }
  }

  const limit = currentYear + CBA_THRESHOLDS.STEPIEN_YEARS;
  const distantPicks = (team.tradedPicks || []).filter((p) => p.year > limit);
  if (distantPicks.length > 0) {
    violations.push(`Cannot trade picks beyond ${limit} (7 years out)`);
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
  const signAndTradeCount = team.sends.filter((p) => p.signAndTrade).length;

  if (sntPlayers.length > 0) {
    // === INSERT right after sign-and-trade aggregation check ===
    if (
      signAndTradeCount > 0 &&
      (team.sends.length > 1 || team.picksOut.length)
    ) {
      violations.push('Sign-and-trade player must be traded alone');
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
function validateSecondApronRules(team) {
  const { teamTotalSalary } = team;
  const { capSettings } = team.context;
  const { secondApron } = capSettings;
  const { cashSent = 0, salaryIn, salaryOut } = team;
  const violations = [];

  if (teamTotalSalary >= secondApron) {
    if (cashSent > 0) {
      violations.push('Second apron team cannot include cash in trades');
    }
    if (salaryIn > salaryOut) {
      violations.push('Second apron team cannot receive more salary than sent');
    }
  }

  if (!team.overSecondApron && !team.willBeOverSecond) return violations;

  const outgoingSalaries = team.sends
    .map((p) => getSalaryForYear(p, team.context.yearKey))
    .sort((a, b) => b - a);

  const incomingSalaries = team.incomingPlayers
    .map((p) => getSalaryForYear(p, team.context.yearKey))
    .sort((a, b) => b - a);

  // 1-to-Many rule - Each incoming must be <= single outgoing
  if (team.sends.length === 1) {
    const maxOutgoing = outgoingSalaries[0];
    incomingSalaries.forEach((incoming) => {
      if (incoming > maxOutgoing) {
        violations.push(
          `Second apron restriction: Incoming salary $${incoming.toLocaleString()} ` +
            `exceeds single outgoing salary $${maxOutgoing.toLocaleString()}`
        );
      }
    });
  }
  // Many-to-Many rule - Must pair salaries in descending order
  else {
    incomingSalaries.forEach((incoming, i) => {
      const correspondingOutgoing = outgoingSalaries[i] || 0;
      if (incoming > correspondingOutgoing) {
        violations.push(
          `Second apron salary pairing violation: ` +
            `Incoming $${incoming.toLocaleString()} > Outgoing $${correspondingOutgoing.toLocaleString()}`
        );
      }
    });
  }

  // Total salary cannot increase
  const totalOutgoing = outgoingSalaries.reduce((a, b) => a + b, 0);
  const totalIncoming = incomingSalaries.reduce((a, b) => a + b, 0);
  if (totalIncoming > totalOutgoing) {
    violations.push(
      `Second apron teams cannot increase total salary: ` +
        `Incoming $${totalIncoming.toLocaleString()} > Outgoing $${totalOutgoing.toLocaleString()}`
    );
  }

  return violations;
}

// MAIN NEW RULES VALIDATOR
export function validateAllNewRules(team, allTeams) {
  return [
    ...validateTradeExceptions(team),
    ...validateDraftPicks(team, allTeams),
    ...validateCash(team),
    ...validateSignAndTrade(team),
    ...validateBYC(team),
    ...validateSecondApronRules(team),
  ];
}
/** ------------------------------------------------------------------------
 * getMatchingValue(player, year, isOutgoing)
 * A minimal replacement for the legacy helper the tests expect.
 * ▸ For BYC players: outgoing counts 50 % of salary (incoming full).
 * ▸ For Poison-Pill (rookie max ext.): outgoing uses current salary,
 *   incoming uses average of extension (already baked into salaryByYear).
 * -----------------------------------------------------------------------*/
const getMatchingValue = (player, yearKey, isOutgoing = false) => {
  const base = getSalaryForYear(player, yearKey);

  if (!isOutgoing) return base; // incoming side – full value

  if (player.isBYC) return base * 0.5; // basic BYC
  if (player.isPoisonPill) return player.currentSalary || base; // PPP

  return base;
};

// ===== RULES =====
const TRADE_RULES = {
  salaryMatching: {
    test: (team) => {
      if (team.sends.some((p) => p.acquiredViaTPE)) return true;

      if (debug.enabled) {
        debug.log(`🧪 Salary Matching – ${team.teamName}`, {
          team: team.teamName,
        });
      }

      // === INSERT in salary-matching section ===
      const margin = calculateAllowableIncoming(
        team.teamTotalSalary,
        team.salaryOut,
        team.incomingPlayers,
        team.tradeExceptions,
        team.context.capSettings,
        team.context.yearKey
      );
      const passes = team.salaryIn <= team.salaryOut + margin;

      if (debug.enabled) {
        debug.log(
          `💵 Incoming: ${formatCurrency(team.salaryIn)} | ` +
            `Allowed: ${formatCurrency(team.salaryOut + margin)} – ` +
            (passes ? '✅ PASS' : '❌ FAIL'),
          { team: team.teamName, salary: true }
        );
      }

      return passes;
    },

    message: (team) => {
      const margin = calculateAllowableIncoming(
        team.teamTotalSalary,
        team.salaryOut,
        team.incomingPlayers,
        team.tradeExceptions,
        team.context.capSettings,
        team.context.yearKey
      );
      const allowable = team.salaryOut + margin;
      return (
        `Salary mismatch: Incoming ${formatCurrency(team.salaryIn)} ` +
        `> Allowed ${formatCurrency(allowable)}`
      );
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
      // === Stepien rule check (7-year limit) ===
      const farthestYear = Math.max(
        ...(team.picksOut || []).map((p) => +p.year || 0),
        0
      );
      if (farthestYear - team.context.yearKey > 7) {
        return false;
      }
      return !(team.picksOut || []).some((p) => p.year > limit);
    },
    message: (team) =>
      `Cannot trade picks beyond ${team.context.yearKey + MAX_FUTURE_PICK_YEARS} (7 years out)`,
  },
};

// ===== MAIN VALIDATOR =====
export function validateTrade({ teams, capProjections, currentYear }) {
  // Helper functions
  const isExpired = (dateStr) => dateStr && new Date(dateStr) < new Date();
  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';

  const yearKey = currentYear;
  const capSettings =
    capProjections[`${currentYear}-${String(currentYear + 1).slice(-2)}`] || {};

  // ======================
  // VALIDATOR IMPLEMENTATIONS
  // ======================

  const validateSalaryMatching = (team) => {
    if (!team || typeof team !== 'object') {
      return {
        passed: false,
        violations: ['Invalid team data provided'],
        message: 'Validation failed - no team data',
        details: '',
      };
    }

    const {
      salaryOut,
      salaryIn,
      teamTotalSalary,
      incomingPlayers,
      tradeExceptions,
      context,
    } = team;
    const margin = calculateAllowableIncoming(
      teamTotalSalary,
      salaryOut,
      incomingPlayers,
      tradeExceptions,
      context.capSettings,
      context.yearKey
    );
    const passes = salaryIn <= margin + salaryOut;

    return {
      passed: passes,
      violations: passes
        ? []
        : [
            `Incoming salary exceeds allowable amount by ${formatCurrency(
              salaryIn - (salaryOut + margin)
            )}`,
          ],
      message: passes ? 'Valid salary match' : 'Salary mismatch',
      details: passes
        ? ''
        : `Outgoing: ${formatCurrency(
            salaryOut
          )} | Incoming: ${formatCurrency(salaryIn)} | Allowed: ${formatCurrency(
            salaryOut + margin
          )}`,
    };
  };

  // Helper function for detailed breakdown
  function getCalculationBreakdown(
    teamSalary,
    salaryOut,
    incomingPlayers,
    tpes,
    capSettings,
    yearKey
  ) {
    const parts = [];
    const { cap, firstApron, secondApron } = capSettings;

    // Determine status
    if (teamSalary > secondApron) {
      parts.push(
        `• Team is above second apron (${formatCurrency(
          teamSalary
        )} > ${formatCurrency(secondApron)})`
      );
      parts.push(
        `• Can only take back equal salary: ${formatCurrency(salaryOut)}`
      );
    } else if (teamSalary > firstApron) {
      parts.push(
        `• Team is above first apron (${formatCurrency(
          teamSalary
        )} > ${formatCurrency(firstApron)})`
      );
      parts.push(
        `• Can take back 110% of outgoing: ${formatCurrency(salaryOut * 1.1)}`
      );
    } else if (teamSalary > cap) {
      parts.push(
        `• Team is over cap (${formatCurrency(teamSalary)} > ${formatCurrency(
          cap
        )})`
      );

      if (salaryOut <= 6_500_000) {
        parts.push(
          `• Tier 1 (≤$6.5M): 175% + $100k = ${formatCurrency(
            salaryOut * 1.75 + 100_000
          )}`
        );
      } else if (salaryOut <= 19_600_000) {
        parts.push(
          `• Tier 2 ($6.5M-$19.6M): 125% + $100k = ${formatCurrency(
            salaryOut * 1.25 + 100_000
          )}`
        );
      } else {
        parts.push(
          `• Tier 3 (>$19.6M): 125% = ${formatCurrency(salaryOut * 1.25)}`
        );
      }
    } else {
      parts.push(
        `• Team is under cap (${formatCurrency(teamSalary)} ≤ ${formatCurrency(
          cap
        )})`
      );
      const capSpace = cap - teamSalary;
      parts.push(
        `• Outgoing + $100k + cap space = ${formatCurrency(
          salaryOut + 100_000 + capSpace
        )}`
      );
    }

    // Add TPEs if available
    const tpeAmount = tpes.reduce((sum, tpe) => {
      if (tpe.isUsed) return sum;
      const remaining = tpe.remaining ?? tpe.amount;
      return sum + remaining;
    }, 0);

    if (tpeAmount > 0) {
      parts.push(`• Added ${formatCurrency(tpeAmount)} from trade exceptions`);
    }

    // Add minimum salary exceptions
    const minException = incomingPlayers.reduce((sum, player) => {
      const salary = getSalaryForYear(player, yearKey);
      return salary <= CBA_THRESHOLDS.MIN_SALARY ? sum + salary : sum;
    }, 0);

    if (minException > 0) {
      parts.push(
        `• Added ${formatCurrency(minException)} from minimum salary exceptions`
      );
    }

    return parts.join('\n');
  }

  const validateSecondApronRules = (team) => {
    const violations = [];
    if (!team.calculations.apronStatus.willBeOverSecond) {
      return {
        passed: true,
        violations,
        message: 'Below second apron',
        details: '',
      };
    }

    const outgoing = team.outgoingPlayers
      .map((p) => getMatchingValue(p, yearKey, /* isOutgoing? */ true))
      .sort((a, b) => b - a);
    const incoming = team.incomingPlayers
      .map((p) => getMatchingValue(p, yearKey, /* isOutgoing? */ false))
      .sort((a, b) => b - a);

    if (outgoing.length === 1) {
      const maxOut = outgoing[0];
      incoming.forEach((s) => {
        if (s > maxOut)
          violations.push(
            `Incoming ${formatCurrency(s)} > outgoing ${formatCurrency(maxOut)}`
          );
      });
    } else {
      incoming.forEach((s, i) => {
        if (s > (outgoing[i] || 0))
          violations.push(
            `Pair ${i + 1}: ${formatCurrency(s)} > ${formatCurrency(
              outgoing[i]
            )}`
          );
      });
    }

    if (team.cashSent > 0)
      violations.push('Second apron teams cannot send cash');

    return {
      passed: violations.length === 0,
      violations,
      message: violations.length
        ? 'Second apron violation'
        : 'Second apron compliant',
      details: violations.join('; '),
    };
  };

  const validateSignAndTrade = (team) => {
    const sntPlayers = team.incomingPlayers.filter((p) => p.signAndTrade);
    if (sntPlayers.length === 0) {
      return {
        passed: true,
        violations: [],
        message: 'No sign-and-trade players',
        details: '',
      };
    }
    const signAndTradeCount = team.outgoingPlayers.filter(
      (p) => p.signAndTrade
    ).length;
    const violations = [];
    if (
      signAndTradeCount > 0 &&
      (team.outgoingPlayers.length > 1 || team.outgoingPicks.length)
    ) {
      violations.push('Sign-and-trade player must be traded alone');
    }
    if (team.projectedSalary > capSettings.firstApron)
      violations.push(
        `Would exceed first apron (${formatCurrency(capSettings.firstApron)})`
      );

    sntPlayers.forEach((p) => {
      const years = p.contractYears || p.contract_clean?.years || 0;
      if (years < 3 || years > 4)
        violations.push(`S&T contract must be 3-4 years (${p.name}: ${years})`);
    });

    return {
      passed: violations.length === 0,
      violations,
      message: violations.length ? 'S&T violation' : 'S&T valid',
      details: violations.join('; '),
    };
  };

  const validateStepienRule = (team) => {
    const violations = [];
    const firsts = team.outgoingPicks
      .filter(
        (p) =>
          (p.round === 1 || p.round === '1st') &&
          !p.isSwap &&
          !isMeaningfulProtection(p.protection)
      )
      .map((p) => parseInt(p.year))
      .sort((a, b) => a - b);

    for (let i = 1; i < firsts.length; i++) {
      if (firsts[i] === firsts[i - 1] + 1) {
        violations.push('Violates Stepien Rule (consecutive future 1sts).');
        break;
      }
    }

    const farthestYear = Math.max(
      ...team.outgoingPicks.map((p) => +p.year || 0),
      0
    );
    if (farthestYear - currentYear > 7) {
      violations.push('Cannot trade picks beyond 7 years');
    }

    return {
      passed: violations.length === 0,
      violations,
      message: violations.length ? 'Stepien violation' : 'Stepien compliant',
      details: violations.join('; '),
    };
  };

  const validateTradeExceptions = (team) => {
    const violations = [];
    const usedTPEs = new Set();

    team.incomingPlayers.forEach((p) => {
      if (!p.acquiredViaTPE) return;
      const tpe = team.tradeExceptions?.find((e) => e.id === p.tpeId);
      const incoming = getSalaryForYear(p, yearKey);

      if (!tpe) {
        violations.push(`No TPE found for ${p.name}`);
        return;
      }
      if (new Date(tpe.expiryDate) < new Date()) {
        violations.push(`Trade exception ${tpe.id} is expired`);
        return;
      }
      if (incoming > tpe.amount) {
        violations.push(`Trade exception ${tpe.id} is too small`);
        return;
      }
      tpe.remaining = tpe.amount - incoming;
      tpe.isUsed = tpe.remaining === 0;

      if (usedTPEs.has(tpe.id)) {
        violations.push(`TPE ${tpe.id} used multiple times`);
        return;
      }
    });

    return {
      passed: violations.length === 0,
      violations,
      message: violations.length ? 'TPE violation' : 'TPE usage valid',
      details: violations.join('; '),
    };
  };

  // ======================
  // MAIN VALIDATION FLOW
  // ======================

  // Process teams and calculate financials
  const teamResults = teams.map((team) => {
    const incomingPlayers = [];
    const incomingPicks = [];
    let cashReceived = 0;

    teams.forEach((t) => {
      if (t.team?.id === team.team?.id) return;
      incomingPlayers.push(
        ...(t.sends || []).filter(
          (p) => !p.tradeTo || p.tradeTo === team.team?.id
        )
      );
      incomingPicks.push(
        ...(t.picksOut || []).filter(
          (p) => !p.toTeamId || p.toTeamId === team.team?.id
        )
      );
      if (t.cashSent) cashReceived += t.cashSent;
    });

    const salaryOut = (team.sends || []).reduce(
      (sum, p) => sum + getMatchingValue(p, yearKey, /* isOutgoing */ true),
      0
    );
    const salaryIn = incomingPlayers.reduce(
      (sum, p) => sum + getMatchingValue(p, yearKey, /* isOutgoing */ false),
      0
    );
    const teamTotalSalary = team.team?.totalSalary || 0;
    const projectedSalary =
      (team.team?.totalSalary || 0) - salaryOut + salaryIn;

    const initialRosterCount = team.team?.players?.length || 0;
    const projectedRosterCount =
      initialRosterCount - (team.sends?.length || 0) + incomingPlayers.length;

    const currentStatus = getApronStatus(
      team.team?.totalSalary || 0,
      capSettings
    );
    const projectedStatus = getApronStatus(projectedSalary, capSettings);

    return {
      teamId: team.team?.id,
      teamName: team.team?.teamName || 'Unknown Team',
      team: team.team,
      salaryOut,
      salaryIn,
      incomingPlayers,
      incomingPicks,
      outgoingPlayers: team.sends || [],
      outgoingPicks: team.picksOut || [],
      projectedSalary,
      teamTotalSalary,
      initialRosterCount,
      projectedRosterCount,
      currentApronStatus: currentStatus,
      projectedApronStatus: projectedStatus,
      capSpace: (capSettings.cap || 0) - projectedSalary,
      hardCapped: team.hardCapped || false,
      cashSent: team.cashSent || 0,
      cashReceived: cashReceived,
      tradeExceptions: team.team?.tradeExceptions || [],
      context: { capSettings, yearKey },
      calculations: {
        salaryMatching: {
          allowableIncoming: calculateAllowableIncoming(
            team.teamTotalSalary,
            salaryOut,
            incomingPlayers,
            team.team?.tradeExceptions || [],
            yearKey
          ),
          difference:
            salaryIn -
            calculateAllowableIncoming(
              team.teamTotalSalary,
              salaryOut,
              incomingPlayers,
              team.team?.tradeExceptions || [],
              yearKey
            ),
        },
        apronStatus: {
          current: currentStatus,
          projected: projectedStatus,
          overSecondApron: currentStatus.includes('2nd Apron'),
          willBeOverSecond: projectedStatus.includes('2nd Apron'),
        },
      },
    };
  });

  // Run all validations
  const validatedTeams = teamResults.map((team) => {
    const rules = {
      salaryMatching: validateSalaryMatching(team),
      hardCap: (() => {
        const hitsHardCap = wouldExceedHardCap(
          team.team,
          team.projectedSalary,
          capSettings
        );
        return {
          passed: !hitsHardCap,
          message: hitsHardCap
            ? 'Hard cap exceeded (1st Apron)'
            : 'Hard-cap compliant',
          details: hitsHardCap
            ? `Projected salary ${formatCurrency(team.projectedSalary)}`
            : '',
          violations: hitsHardCap ? ['Hard cap exceeded (1st Apron)'] : [],
        };
      })(),
      signAndTrade: validateSignAndTrade(team),
      stepienRule: validateStepienRule(team),
      secondApron: validateSecondApronRules(team),
      rosterCount: {
        passed:
          team.projectedRosterCount <= CBA_MECHANICS.MAX_STANDARD_CONTRACTS,
        message: `Roster count must be at most ${CBA_MECHANICS.MAX_STANDARD_CONTRACTS}`,
        details: `Projected count: ${team.projectedRosterCount}`,
        violations:
          team.projectedRosterCount > CBA_MECHANICS.MAX_STANDARD_CONTRACTS
            ? [
                `Roster count ${team.projectedRosterCount} exceeds limit of ${CBA_MECHANICS.MAX_STANDARD_CONTRACTS}`,
              ]
            : [],
      },
      tradeExceptions: validateTradeExceptions(team),
    };

    const checks = Object.fromEntries(
      Object.entries(rules).map(([k, v]) => [k, v.passed])
    );

    const violations = Object.values(rules).flatMap((r) => r.violations);
    return {
      ...team,
      rules,
      checks,
      violations,
      legal: violations.length === 0,
      ruleResults: Object.entries(rules).map(([name, result]) => ({
        name,
        passed: result.passed,
        message: result.message,
        details: result.details,
      })),
      beforeSalary: team.teamTotalSalary,
      afterSalary: team.projectedSalary,
      beforeRoster: team.initialRosterCount,
      afterRoster: team.projectedRosterCount,
    };
  });

  // Final result
  return {
    legal: validatedTeams.every((t) => t.legal),
    teamResults: validatedTeams,
    summaryByTeamIndex: validatedTeams.map((team) => {
      const {
        incomingPlayers,
        outgoingPlayers,
        incomingPicks,
        outgoingPicks,
        salaryIn,
        salaryOut,
        cashReceived,
        cashSent,
      } = team;
      const summary = {
        teamName: team.teamName,
        playersIn: incomingPlayers.map((p) => p.name || 'Unknown'),
        playersOut: outgoingPlayers,
        picksIn: incomingPicks,
        picksOut: outgoingPicks,
        salaryDelta: salaryIn - salaryOut,
        cashDelta: (cashReceived ?? 0) - (cashSent ?? 0),
        rosterDelta: team.incomingPlayers.length - team.outgoingPlayers.length,
        capDelta: team.salaryIn - team.salaryOut,
        apronStatus: team.projectedApronStatus,
        projectedSalary: team.projectedSalary,
        beforeSalary: team.beforeSalary,
        afterSalary: team.afterSalary,
        beforeRoster: team.beforeRoster,
        afterRoster: team.afterRoster,
      };
      return summary;
    }),
    reason:
      validatedTeams.flatMap((t) => t.violations).join('; ') || 'Valid trade',
    timestamp: new Date().toISOString(),
  };
}

export function hasStepienViolation(picks = []) {
  const years = picks
    .filter(
      (p) =>
        (p.round === 1 || p.round === '1st') &&
        !p.isSwap &&
        !isMeaningfulProtection(p.protection) &&
        !p.via
    )
    .map((p) => parseInt(p.year, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) return true;
  }
  return false;
}

export { debug as tradeDebug };
