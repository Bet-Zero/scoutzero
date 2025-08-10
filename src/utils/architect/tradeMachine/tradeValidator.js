// tradeValidator.js - Combined Complete Version
import {
  calculateAllowableIncoming,
  getSalaryForYear,
  getApronStatus,
  formatCurrency,
  wouldExceedHardCap,
  getIncomingCeilingViaFaException,
} from '@/utils/architect/tradeHelpers.js'; // 🆕 .js extension kept for Vite
import { CBA_MECHANICS } from '@/utils/architect/cbaMechanics.js';
import {
  buildFirstRoundCalendar,
  passesStepienRule,
} from '@/utils/architect/stepienUtils.js';
import { BYC_PERCENT } from '@/utils/architect/cbaConstants.js';
import { passesRosterWindow } from '@/utils/architect/rosterUtils.js';
import { validationFlags } from '@/config/validationFlags.js';
import {
  createTPE,
  isExpiredTPE,
  canUseTPE,
  isCurrentSeasonTPE,
  SECOND_APRON_TPE_BLOCK,
} from '@/utils/architect/tradeMachine/tpeUtils.js';
import {
  getTeamFaExceptionBuckets,
  canUseFaException,
  allocateFaExceptionToIncoming,
  summarizeFaExceptionUsage,
  isFaExceptionEligibleType,
} from '@/utils/architect/faExceptionUtils.js';
import { markHardCapTriggered } from '@/utils/architect/hardCapTriggers.js';
import { isFrozenPick } from '@/utils/architect/draftPickUtils.js';
import {
  isWithinMoratorium,
  violates30Day,
  violates2MonthAggregation,
} from '@/utils/architect/timingUtils.js';
import { collectConsentViolations } from '@/utils/architect/consentUtils.js';
import { isMeaningfulProtection } from '@/utils/architect/tradeMachine/tradeUtils.js';
import debug from '@/utils/architect/tradeMachine/tradeDebug.js';

import {
  CBA_THRESHOLDS,
  MAX_FUTURE_PICK_YEARS,
} from '@/utils/architect/tradeMachine/cbaConstants.js';
import { enforceSecondApronHandcuffs } from '@/utils/architect/tradeMachine/rules/enforceSecondApronHandcuffs.js';
import { enforceRosterWindow } from '@/utils/architect/tradeMachine/rules/enforceRosterWindow.js';
import { enforceConsent } from '@/utils/architect/tradeMachine/rules/enforceConsent.js';
import { enforceEligibility } from '@/utils/architect/tradeMachine/rules/enforceEligibility.js';
import { enforceTiming } from '@/utils/architect/tradeMachine/rules/enforceTiming.js';
import { validateTradeExceptions } from '@/utils/architect/tradeMachine/validators/validateTradeExceptions.js';
import { validateFaExceptionUsage } from '@/utils/architect/tradeMachine/validators/validateFaExceptionUsage.js';
import { validateDraftPicks } from '@/utils/architect/tradeMachine/validators/validateDraftPicks.js';
import { validateCash } from '@/utils/architect/tradeMachine/validators/validateCash.js';
import { validateSignAndTrade } from '@/utils/architect/tradeMachine/validators/validateSignAndTrade.js';
import { validateBYC } from '@/utils/architect/tradeMachine/validators/validateBYC.js';
import { validateSecondApronRules } from '@/utils/architect/tradeMachine/validators/validateSecondApronRules.js';
import { validateAllNewRules } from '@/utils/architect/tradeMachine/validators/validateAllNewRules.js';
import {
  getMatchingValue,
  computeMatchingValues,
} from '@/utils/architect/tradeMachine/matchingValues.js';

// ==== Cap settings normalization ====
const toNum = (v) => (Number.isFinite(v) ? v : Number(v)) || 0;
const toSeasonKey = (endYear) => `${endYear - 1}-${String(endYear).slice(-2)}`;

function normalizeCaps(raw = {}) {
  return {
    salaryCap: toNum(
      raw.salaryCap ?? raw.cap ?? raw.softCap ?? raw.salary_cap ?? raw.soft_cap
    ),
    firstApron: toNum(
      raw.firstApron ??
        raw.apron1 ??
        raw.first_apron ??
        raw.taxApron1 ??
        raw.firstTaxApron
    ),
    secondApron: toNum(
      raw.secondApron ??
        raw.apron2 ??
        raw.second_apron ??
        raw.taxApron2 ??
        raw.secondTaxApron
    ),
    taxLine: toNum(
      raw.taxLine ?? raw.tax ?? raw.luxuryTaxLine ?? raw.luxuryTax
    ),
    fullMLE: toNum(raw.fullMLE ?? raw.mle),
    roomMLE: toNum(raw.roomMLE ?? raw.rmle),
    bae: toNum(raw.bae),
  };
}

// Accept either the raw team or a wrapper { team } / { sourceTeam } / { ctx }
function getTeamObject(teamLike) {
  if (!teamLike) return null;
  return teamLike.team || teamLike.sourceTeam || teamLike.ctx || teamLike;
}

// Resolve pre-trade payroll from whatever field exists
function resolvePayroll(team) {
  if (!team) return 0;
  const candidates = [
    team.postTradeStatus?.projectedSalary,
    team.preTradeStatus?.projectedSalary,
    team.projectedSalary,
    team.teamTotalSalary,
    team.totalSalary,
    team.payroll,
  ];
  for (const v of candidates) {
    const n = toNum(v);
    if (n > 0) return n;
  }
  return 0;
}

// ==== Allowed Incoming Margin (no pooled TPEs; only add actually-used) ====
function getAllowableIncomingMargin(teamLike) {
  const team = getTeamObject(teamLike);
  const capSettings = team?.context?.capSettings || {};
  const yearKey = team?.context?.yearKey;

  const secondApron = toNum(capSettings.secondApron);
  const salaryCap = toNum(capSettings.salaryCap);
  const payroll = resolvePayroll(team);

  // Apron clamp
  const isAtOrAboveSecondApron =
    team?.postTradeStatus?.isAtOrAboveSecondApron ??
    (secondApron > 0 ? payroll >= secondApron : false);
  if (isAtOrAboveSecondApron || team?.postTradeStatus?.isAtOrAboveFirstApron) {
    console.log('[getAllowableIncomingMargin]', {
      team: team?.nickname || team?.name || team?.id,
      teamTotalSalary: payroll,
      secondApron,
      isAtOrAboveSecondApron: true,
      marginAboutToReturn: 0,
    });
    return 0;
  }

  // Below-cap = cap room
  if (salaryCap && payroll < salaryCap) {
    const margin = Math.max(0, salaryCap - payroll);
    console.log('[getAllowableIncomingMargin]', {
      team: team?.nickname || team?.name || team?.id,
      teamTotalSalary: payroll,
      secondApron,
      isAtOrAboveSecondApron: false,
      marginAboutToReturn: margin,
    });
    return margin;
  }

  // Over-cap bands WITHOUT pooled TPEs
  const baseNoTPE = calculateAllowableIncoming(
    payroll,
    team.salaryOut || 0,
    team.incomingPlayers || [],
    /* tradeExceptions */ [], // ← stop pooling all TPEs
    capSettings,
    yearKey
  );

  // Add only actually USED buckets
  const usedTPE = (team.incomingPlayers || [])
    .filter((p) => p.absorptionMode === 'TPE')
    .reduce((sum, p) => sum + toNum(p.matchIncoming || p.tpeAmount || 0), 0);

  const faUsage = (team.incomingPlayers || [])
    .filter((p) => p.absorptionMode === 'FA_EXCEPTION')
    .reduce((sum, p) => sum + toNum(p.matchIncoming || 0), 0);

  const margin = baseNoTPE + usedTPE + faUsage;

  console.log('[getAllowableIncomingMargin]', {
    team: team?.nickname || team?.name || team?.id,
    teamTotalSalary: payroll,
    secondApron,
    isAtOrAboveSecondApron: false,
    marginAboutToReturn: margin,
  });
  return margin;
}

export const getIncomingCeilingForTeam = (team) => {
  if (team.absorptionMode === 'FA_EXCEPTION' && team.bucketType) {
    return getIncomingCeilingViaFaException(team, team.bucketType);
  }
  return team.salaryOut + getAllowableIncomingMargin(team);
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
      const margin = getAllowableIncomingMargin(team);
      const diff = team.salaryIn - team.salaryOut; // incoming minus outgoing
      const passes = diff <= margin && diff >= 0;

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
      const margin = getAllowableIncomingMargin(team);
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
export function validateTrade({
  teams,
  capProjections,
  currentYear,
  tradeCtx = {},
}) {
  // ==== Cap settings for selected season (normalized) ====
  const seasonKey = toSeasonKey(currentYear);
  const rawCaps =
    capProjections?.[seasonKey] || capProjections?.[currentYear] || {};
  const capSettings = normalizeCaps(rawCaps);
  const yearKey = currentYear;

  console.log('[capSettings]', {
    seasonKey,
    salaryCap: capSettings.salaryCap,
    secondApron: capSettings.secondApron,
  });

  // ==== Preserve payroll + attach context + seed salaryOut ====
  teams = (teams || []).map((t) => {
    const raw = t.team || t;

    const base = toNum(
      raw.projectedSalary ??
        raw.teamTotalSalary ??
        raw.totalSalary ??
        raw.payroll
    );
    const safeTeam = {
      ...raw,
      teamTotalSalary: toNum(raw.teamTotalSalary ?? raw.totalSalary ?? base),
      projectedSalary: toNum(raw.projectedSalary ?? base), // seed; recomputed later
      salaryOut: toNum(getSalaryForYear?.(t.sends || [], yearKey) || 0), // <<< add this
      context: { capSettings, yearKey }, // <<< and this
    };

    return {
      ...t,
      team: safeTeam,
      preTradeStatus: {
        ...(t.preTradeStatus || {}),
        projectedSalary: toNum(
          t.preTradeStatus?.projectedSalary ?? safeTeam.projectedSalary
        ),
      },
      postTradeStatus: {
        ...(t.postTradeStatus || {}),
        projectedSalary: toNum(
          t.postTradeStatus?.projectedSalary ?? safeTeam.projectedSalary
        ),
      },
    };
  });
  // Helper functions
  const isExpired = (dateStr) => dateStr && new Date(dateStr) < new Date();
  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';

  computeMatchingValues({ teams, yearKey });

  const teamNameMap = Object.fromEntries(
    teams.map((t) => [t.team?.id, t.team?.teamName])
  );

  const notify = tradeCtx?.notifier || {};
  const rejectMsg = (msg) => {
    if (notify.reject) notify.reject(msg);
  };

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

    const allowable = getAllowableIncomingMargin(team);
    const diff = salaryIn - salaryOut; // + if taking more back

    // can always send out more than comes back
    const passes = diff <= allowable;

    return {
      passed: passes,
      violations: passes
        ? []
        : [
            `Incoming salary exceeds allowable amount by $${(
              diff - allowable
            ).toLocaleString()}`,
          ],
      message: passes ? 'Valid salary match' : 'Salary mismatch',
      details: passes
        ? ''
        : `Outgoing: ${formatCurrency(salaryOut)} | Incoming: ${formatCurrency(
            salaryIn
          )} | Allowed Margin: ${formatCurrency(allowable)}`,
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
        `• Can only take back equal salary: ${formatCurrency(salaryOut)}`
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
    const {
      teamTotalSalary,
      cashReceived,
      cashSent,
      salaryIn,
      salaryOut,
      context,
    } = team;
    const { capSettings } = context;

    if (teamTotalSalary > capSettings.secondApron) {
      if ((cashReceived || 0) > 0 || (cashSent || 0) > 0)
        violations.push('Second apron team cannot include cash in trades.');

      if (salaryIn > salaryOut)
        violations.push(
          'Second apron team cannot receive more salary than sent.'
        );
    }

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
    const violations = [];
    const {
      outgoingPlayers,
      incomingPlayers,
      projectedSalary,
      context,
      outgoingPicks = [],
    } = team;
    const { capSettings } = context;

    const sntOutPlayers = outgoingPlayers.filter((p) => p.signAndTrade);
    const sntInPlayers = incomingPlayers.filter((p) => p.signAndTrade);
    const anySnt = sntOutPlayers.length > 0 || sntInPlayers.length > 0;

    if (!anySnt) {
      return {
        passed: true,
        violations: [],
        message: 'S&T valid',
        details: '',
      };
    }

    if (tradeCtx.offseason === false) {
      violations.push('S&T only in offseason.');
    }

    if (sntOutPlayers.length > 0) {
      if (outgoingPlayers.length > 1 || outgoingPicks.length) {
        violations.push('Sign-and-trade player must be traded alone.');
      }
      sntOutPlayers.forEach((p) => {
        const teamId = team.team?.id ?? team.teamId;
        if (p.originTeamId && p.originTeamId !== teamId) {
          violations.push(
            "Sign-and-trade must be executed by player's original team."
          );
        }
      });
    }

    if (sntInPlayers.length > 0) {
      if (
        team.usedTaxpayerMLEThisSeason ||
        team.team?.usedTaxpayerMLEThisSeason
      ) {
        violations.push(
          'Teams using taxpayer MLE cannot receive sign-and-trade players.'
        );
      }
      if (
        wouldExceedHardCap(
          { hardCapTriggered: 'FirstApron' },
          projectedSalary,
          capSettings
        )
      ) {
        violations.push('S&T triggers hard-cap breach.');
      }
      team.hardCapped = true;
      if (team.team) team.team.hardCapTriggered = true;
      sntInPlayers.forEach((player) => {
        const years = player.contractYears || player.contract_clean?.years || 0;
        const correctYears = years >= 3 && years <= 4;
        if (!correctYears) {
          violations.push('S&T contract must be 3-4 years.');
        }
        if (player.firstYearGuaranteed === false) {
          violations.push('S&T first year must be guaranteed.');
        }
      });
    }

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

  // ======================
  // MAIN VALIDATION FLOW
  // ======================

  // Process teams and calculate financials
  const teamResults = teams.map((team, idx) => {
    const incomingPlayers = [];
    const incomingPicks = [];
    let cashReceived = 0;

    teams.forEach((t, j) => {
      if (j === idx) return;
      const fromTeamId = t.team.id ?? j;
      const defaultDest = j === 0 ? 1 : 0;
      const players = (t.sends || [])
        .filter((p) => {
          if (p.tradeTo !== undefined) {
            const destIndex = teams.findIndex(
              (tt) => tt.team?.id === p.tradeTo
            );
            return destIndex === idx;
          }
          return defaultDest === idx;
        })
        .map((p) => ({ ...p, fromTeamId }));
      incomingPlayers.push(...players);
      const picks = (t.picksOut || []).filter((p) => {
        if (p.toTeamId !== undefined) {
          const destIndex = teams.findIndex((tt) => tt.team?.id === p.toTeamId);
          return destIndex === idx;
        }
        return defaultDest === idx;
      });
      incomingPicks.push(...picks);
      if (t.cashSent && defaultDest === idx) cashReceived += t.cashSent;
    });

    const tradeExceptions = (team.team?.tradeExceptions || []).slice();

    // Mark incoming players as TPE acquisitions when applied TPEs are present
    if (Array.isArray(team.appliedTPEs) && team.appliedTPEs.length) {
      let i = 0;
      team.appliedTPEs.forEach((tpe) => {
        const player = incomingPlayers[i];
        const id = tpe.id || `applied-${i}`;
        if (player) {
          player.acquiredViaTPE = true;
          player.absorptionMode = 'TPE';
          player.tpeId = id;
        }
        tradeExceptions.push({ ...tpe, id });
        i += 1;
      });
    }

    const salaryOut = (team.sends || []).reduce(
      (sum, p) => sum + (p.matchOutgoing ?? getMatchingValue(p, yearKey, true)),
      0
    );
    const salaryIn = incomingPlayers.reduce(
      (sum, p) =>
        sum + (p.matchIncoming ?? getMatchingValue(p, yearKey, false)),
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
    const postTradeStatus = {
      isAtOrAboveSecondApron:
        typeof capSettings.secondApron === 'number'
          ? projectedSalary >= capSettings.secondApron
          : false,
      isAtOrAboveFirstApron:
        typeof capSettings.firstApron === 'number'
          ? projectedSalary >= capSettings.firstApron
          : false,
    };
    const isOverCap = teamTotalSalary > (capSettings.cap || 0);

    const baseTeam = {
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
      postTradeStatus,
      capSpace: (capSettings.cap || 0) - projectedSalary,
      isOverCap,
      totalSalary: teamTotalSalary,
      capRoom: (capSettings.cap || 0) - projectedSalary,
      hardCapped: team.hardCapped || false,
      cashSent: team.cashSent || 0,
      cashReceived: cashReceived,
      tradeExceptions,
      appliedTPEs: team.appliedTPEs || [],
      context: { capSettings, yearKey, tradeDate: tradeCtx.tradeDate },
    };

    // Allowed ceiling (already includes bands and any actually-used exceptions)
    const allowableIncoming = getIncomingCeilingForTeam(baseTeam);

    // Over by (clamped) and team-level salary-match legality
    const overBy = Math.max(0, salaryIn - allowableIncoming);
    const salaryMatchLegal = overBy <= 0; // <= with no rounding issues in your numbers

    const createdTPE = createTPE({
      teamCtx: baseTeam,
      outgoing: salaryOut,
      incoming: salaryIn,
      tradeDate: tradeCtx.tradeDate,
    });

    return {
      ...baseTeam,
      createdTPE,
      legal: salaryMatchLegal, // <<< give each team a legal flag
      calculations: {
        salaryIn, // useful for UI
        salaryOut, // useful for UI
        salaryMatching: {
          allowedIncoming: allowableIncoming, // <<< name it clearly as *allowed*
          margin: allowableIncoming - salaryOut, // optional: expose margin for debugging
          difference: overBy, // <<< non-negative “over by” for display
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
    const seasonKey = team.context.yearKey;
    const handcuffViolations = enforceSecondApronHandcuffs(team, tradeCtx);
    const handcuffPass = handcuffViolations.length === 0;
    const capStatus = {
      isAboveSecond: team.currentApronStatus.includes('2nd Apron'),
    };
    const teamIsAtOrAboveSecondApron =
      capStatus.isAboveSecond || team.postTradeStatus.isAtOrAboveSecondApron;
    const signAndTradeResult = validateSignAndTrade(team);
    const consentArr = enforceConsent(
      team,
      { ...tradeCtx, teamNames: teamNameMap },
      { reject: rejectMsg }
    );
    const consentPass =
      consentArr.length === 0 || validationFlags.consent === 'warn';
    const consentViolations = consentArr;
    const consentDetails = '';
    const signAndTradePass = signAndTradeResult.passed;
    const reacqViolations = enforceEligibility(
      team,
      {
        now: tradeCtx.tradeDate,
        wasTradedAwayWithinOneYear: tradeCtx.wasTradedAwayWithinOneYear,
      },
      { reject: rejectMsg }
    );
    const reacqPass =
      reacqViolations.length === 0 || validationFlags.reAcquisition === 'warn';

    // --- Salary matching (2023 CBA + TPE)
    const allowable = getIncomingCeilingForTeam(team);
    const salaryPass = team.salaryIn <= allowable;

    // --- Cash limitations
    const cashCheck = validateCash(team, {
      season: seasonKey,
      tradesHistory: tradeCtx.tradesHistory || [],
    });
    const cashPass =
      cashCheck.passed || validationFlags.seasonalCash === 'warn';

    // --- Second-apron aggregation (max from any single opponent ≤ max salary you send out)
    let aggregationPass = true;
    let aggregationViolation = '';
    if (capStatus.isAboveSecond) {
      const tally = {};
      team.incomingPlayers.forEach((p) => {
        tally[p.fromTeamId] =
          (tally[p.fromTeamId] || 0) + getSalaryForYear(p, seasonKey);
      });
      const maxFromOneClub = Math.max(...Object.values(tally), 0);
      const maxSent = Math.max(
        ...team.outgoingPlayers.map((p) => getSalaryForYear(p, seasonKey)),
        0
      );
      const totalIncoming = team.incomingPlayers.reduce(
        (sum, p) => sum + getSalaryForYear(p, seasonKey),
        0
      );
      const distinctSources = Object.keys(tally).length;
      if (
        maxFromOneClub > maxSent ||
        (distinctSources > 1 && totalIncoming > maxSent)
      ) {
        aggregationPass = false;
        aggregationViolation =
          distinctSources > 1 || team.outgoingPlayers.length > 1
            ? 'Second apron team cannot aggregate salaries'
            : 'Second apron team cannot receive more salary than sent';
      }
    }

    const stepienCalendar = buildFirstRoundCalendar({
      existingPicks: team.team.picks,
      picksOfferedInTrade: team.outgoingPicks,
    });
    const farthestYear = Math.max(
      ...team.outgoingPicks.map((p) => +p.year || 0),
      seasonKey
    );
    const stepienViolations = [];
    if (!passesStepienRule(stepienCalendar)) {
      stepienViolations.push(
        'Violates Stepien Rule (consecutive future 1sts).'
      );
    }
    if (farthestYear - seasonKey > 7) {
      stepienViolations.push('Cannot trade picks beyond 7 years out.');
    }
    if (
      team.outgoingPicks.some((p) =>
        isFrozenPick(p, {
          teamId: team.teamId,
          teamIsAtOrAboveSecondApron,
          currentSeason: seasonKey,
        })
      )
    ) {
      stepienViolations.push(
        'Second apron team cannot trade its own 7-year-out first-round pick.'
      );
    }
    const stepienPass = stepienViolations.length === 0;

    const currentTwoWay = team.team?.twoWayPlayers?.length || 0;
    const outgoingTwoWay = (team.outgoingPlayers || []).filter(
      (p) => p.isTwoWay
    ).length;
    const incomingTwoWay = team.incomingPlayers.filter(
      (p) => p.isTwoWay
    ).length;
    const projectedTwoWay = currentTwoWay - outgoingTwoWay + incomingTwoWay;
    const rosterCheck = passesRosterWindow(
      {
        players: Array(Math.max(0, team.projectedRosterCount || 0)),
        twoWayPlayers: Array(Math.max(0, projectedTwoWay)),
      },
      { require14to15: true }
    );
    const rosterCnt = rosterCheck.standard;
    const twoWayCnt = rosterCheck.twoWays;
    const rosterStandardViolation = rosterCheck.reasons.find((r) =>
      r.startsWith('Standard')
    );
    const twoWayViolation = rosterCheck.reasons.find((r) =>
      r.startsWith('Two-way')
    );
    const rosterPass =
      !rosterStandardViolation || validationFlags.rosterEnforcement === 'warn';
    const twoWayRosterPass =
      !twoWayViolation || validationFlags.twoWayRoster === 'warn';

    const capSheet = team.hardCapped
      ? { ...team.team, hardCapTriggered: 'FirstApron' }
      : team.team;
    const hardCapPass = !wouldExceedHardCap(
      capSheet,
      team.projectedSalary,
      capSettings
    );
    const hardCapMsg =
      capSheet.hardCapTriggered === 'SecondApron'
        ? 'Hard cap exceeded (2nd Apron)'
        : 'Hard cap exceeded (1st Apron)';

    const rules = {
      signAndTrade: signAndTradeResult,
      secondApron: {
        passed: handcuffPass,
        message: handcuffPass
          ? 'Second apron handcuffs satisfied'
          : 'Second apron violation',
        details: handcuffViolations.join('; ') || 'Second apron restrictions',
        violations: handcuffViolations,
      },
      salaryMatching: {
        passed: salaryPass,
        message: salaryPass ? 'Salary match valid' : 'Salary mismatch',
        details: `Incoming ${formatCurrency(
          team.salaryIn
        )} vs. allowed ${formatCurrency(allowable)}`,
        violations: salaryPass
          ? []
          : ['Incoming salary exceeds allowable amount.'],
      },
      cash: {
        passed: cashPass,
        message: cashPass ? 'Cash valid' : cashCheck.violations[0],
        details: cashCheck.violations.slice(1).join('; '),
        violations: cashPass ? [] : cashCheck.violations,
      },
      aggregation: {
        passed: aggregationPass,
        message: aggregationPass ? 'Aggregation valid' : 'Aggregation invalid',
        details: aggregationViolation || 'Second apron aggregation check',
        violations: aggregationPass ? [] : [aggregationViolation],
      },
      stepienRule: {
        passed: stepienPass,
        message: stepienPass ? 'Stepien compliant' : 'Stepien violation',
        details: 'Stepien Rule restrictions apply',
        violations: stepienViolations,
      },
      roster: {
        passed: rosterPass,
        message: rosterPass ? 'Roster size valid' : rosterStandardViolation,
        details: `Projected size: ${rosterCnt}`,
        violations:
          rosterPass || validationFlags.rosterEnforcement === 'warn'
            ? []
            : [rosterStandardViolation],
      },
      twoWayRoster: {
        passed: twoWayRosterPass,
        message: twoWayRosterPass ? 'Two-way slots valid' : twoWayViolation,
        details: twoWayRosterPass ? '' : `Two-way count: ${twoWayCnt}`,
        violations:
          twoWayRosterPass || validationFlags.twoWayRoster === 'warn'
            ? []
            : [twoWayViolation],
      },
      hardCap: {
        passed: hardCapPass,
        message: hardCapPass ? 'Hard-cap compliant' : 'Hard-cap violation',
        details: `Projected salary ${formatCurrency(
          team.projectedSalary
        )} would exceed hard cap.`,
        violations: hardCapPass ? [] : [hardCapMsg],
      },
      consent: {
        passed: consentPass,
        message: consentPass
          ? 'Player consent satisfied'
          : consentViolations[0],
        details: consentPass ? '' : consentDetails,
        violations:
          consentPass || validationFlags.consent === 'warn'
            ? []
            : consentViolations,
      },
      reAcquisition: {
        passed: reacqPass,
        message: reacqPass
          ? 'Re-acquisition bar satisfied'
          : reacqViolations[0],
        details: reacqViolations.slice(1).join('; '),
        violations:
          reacqPass || validationFlags.reAcquisition === 'warn'
            ? []
            : reacqViolations,
      },
      tradeExceptions: (() => {
        const tpeViolations = validateTradeExceptions(team);
        return {
          passed: tpeViolations.length === 0,
          violations: tpeViolations,
          message: tpeViolations.length ? 'TPE violation' : 'TPE usage valid',
          details: tpeViolations.join('; '),
        };
      })(),
      faException: (() => {
        const faViolations = validateFaExceptionUsage(team, validationFlags);
        return {
          passed: faViolations.length === 0,
          violations: faViolations,
          message: faViolations.length
            ? 'FA Exception violation'
            : 'FA Exception usage valid',
          details: faViolations.join('; '),
        };
      })(),
    };

    const violations = [
      ...rules.signAndTrade.violations,
      ...rules.secondApron.violations,
      ...rules.hardCap.violations,
      ...rules.salaryMatching.violations,
      ...rules.aggregation.violations,
      ...rules.cash.violations,
      ...rules.stepienRule.violations,
      ...rules.roster.violations,
      ...rules.twoWayRoster.violations,
      ...rules.consent.violations,
      ...rules.reAcquisition.violations,
      ...rules.tradeExceptions.violations,
      ...rules.faException.violations,
    ];
    const teamPass =
      signAndTradePass &&
      handcuffPass &&
      salaryPass &&
      cashPass &&
      aggregationPass &&
      stepienPass &&
      hardCapPass &&
      rosterPass &&
      twoWayRosterPass &&
      consentPass &&
      reacqPass &&
      rules.faException.passed;

    return {
      ...team,
      rules,
      checks: {
        signAndTradePass,
        handcuffPass,
        salaryPass,
        cashPass,
        aggregationPass,
        stepienPass,
        hardCapPass,
        rosterPass,
        twoWayRosterPass,
        consentPass,
        reacqPass,
      },
      violations,
      legal: violations.length === 0,
      ceilingUsed: allowable,
      rosterCnt: rosterCnt,
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
  const overallLegal = validatedTeams.every((t) => t.legal !== false);

  return {
    overallLegal, // what useTradeMachine reads
    legal: overallLegal, // backward-compat
    teamResults: validatedTeams,
    summaryByTeamIndex: validatedTeams.map((team) => {
      const {
        incomingPlayers = [],
        outgoingPlayers = [],
        incomingPicks = [],
        outgoingPicks = [],
        salaryIn = 0,
        salaryOut = 0,
        cashReceived = 0,
        cashSent = 0,
      } = team;

      return {
        teamName: team.teamName,
        playersIn: incomingPlayers.map((p) => p.name),
        playersOut: outgoingPlayers.map((p) => p.name),
        picksIn: incomingPicks,
        picksOut: outgoingPicks,
        salaryDelta: salaryIn - salaryOut,
        cashDelta: cashReceived - cashSent,
        rosterDelta:
          (team.incomingPlayers?.length || 0) -
          (team.outgoingPlayers?.length || 0),
        capDelta: salaryIn - salaryOut,
        apronStatus: team.projectedApronStatus,
        projectedSalary: team.projectedSalary,
        beforeSalary: team.beforeSalary,
        afterSalary: team.afterSalary,
        beforeRoster: team.beforeRoster,
        afterRoster: team.afterRoster,
      };
    }),
    reason:
      validatedTeams.flatMap((t) => t.violations || []).join('; ') ||
      'Valid trade',
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

export {
  computeMatchingValues,
  debug as tradeDebug,
  enforceSecondApronHandcuffs,
  enforceRosterWindow,
  enforceConsent,
  enforceEligibility,
  enforceTiming,
  validateTradeExceptions,
  validateFaExceptionUsage,
  validateDraftPicks,
  validateCash,
  validateSignAndTrade,
  validateBYC,
  validateSecondApronRules,
  validateAllNewRules,
};
