// tradeValidator.js - Combined Complete Version
import {
  calculateAllowableIncoming,
  getSalaryForYear,
  getApronStatus,
  formatCurrency,
  wouldExceedHardCap,
  getIncomingCeilingViaFaException,
} from '@/utils/architect/tradeHelpers.js';
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
} from '@/utils/architect/faExceptionUtils.js';
import { validateSecondApronRules } from './validators/validateSecondApronRules.js';
import { validateTradeExceptions } from './validators/validateTradeExceptions.js';
import { validateSignAndTrade } from './validators/validateSignAndTrade.js';
import { validateSalaryMatching } from './validators/validateSalaryMatching.js';
import { validateRoster } from './validators/validateRoster.js';
import { validateHardCap } from './validators/validateHardCap.js';
import { validateStepien } from './validators/validateStepien.js';
import { validateFaExceptionUsage } from './validators/validateFaExceptionUsage.js';
import { validateCash } from './validators/validateCash.js'; // ← ADD THIS MISSING IMPORT
import debug from '@/utils/architect/tradeMachine/tradeDebug.js';
import { computeMatchingValues, getMatchingValue } from './matchingValues.js';
import { isMeaningfulProtection } from './tradeUtils.js';

// Import individual enforcement functions
import { enforceConsent } from './rules/enforceConsent.js';
import { enforceEligibility } from './rules/enforceEligibility.js';
import { enforceTiming } from './rules/enforceTiming.js';
import { enforceRosterWindow } from './rules/enforceRosterWindow.js';
import { enforceSecondApronHandcuffs } from './rules/enforceSecondApronHandcuffs.js';

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
  const { context, salaryOut = 0, teamTotalSalary = 0 } = team;
  const { capSettings = {}, yearKey } = context || {};
  const { salaryCap = 0, firstApron = 0, secondApron = 0 } = capSettings;

  // Teams above second apron can only take back equal salary
  if (teamTotalSalary >= secondApron) {
    return salaryOut;
  }

  // Teams above first apron limited to 100% matching
  if (teamTotalSalary >= firstApron) {
    return salaryOut;
  }

  // Under-cap teams can take salary up to the cap
  if (teamTotalSalary < salaryCap) {
    return salaryCap - teamTotalSalary;
  }

  // Over-cap teams use standard bands - return the total allowable ceiling
  const margin = getAllowableIncomingMargin(team);
  return salaryOut + margin; // This gives us the total allowable incoming amount
};

// Re-export core functions that tests depend on
export { computeMatchingValues };
export { enforceSecondApronHandcuffs };
export { validateTradeExceptions };

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
      salaryOut: toNum(getSalaryForYear?.(t.sends || [], yearKey) || 0),
      context: { capSettings, yearKey },
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

  // Apply BYC/kicker/poison pill conversions before validation
  computeMatchingValues({ teams, yearKey, ...tradeCtx });

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
      sends: team.sends || [],
      picksOut: team.picksOut || [],
    };

    // Allowed ceiling (already includes bands and any actually-used exceptions)
    const allowableIncoming = getIncomingCeilingForTeam(baseTeam);

    // Over by (clamped) and team-level salary-match legality
    const overBy = Math.max(0, salaryIn - allowableIncoming);
    const salaryMatchLegal = overBy <= 0;

    const createdTPE = createTPE({
      teamCtx: baseTeam,
      outgoing: salaryOut,
      incoming: salaryIn,
      tradeDate: tradeCtx.tradeDate,
    });

    return {
      ...baseTeam,
      createdTPE,
      legal: salaryMatchLegal,
      calculations: {
        salaryIn,
        salaryOut,
        salaryMatching: {
          allowedIncoming: allowableIncoming,
          margin: allowableIncoming - salaryOut,
          difference: overBy,
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

  // Run validations in correct order per ORDER_OF_OPERATIONS.md
  const validatedTeams = teamResults.map((team) => {
    // 1. Apply BYC/kicker/poison pill conversions (already done in setup)

    // 2. Validate sign-and-trade rules first (includes hard cap for S&T)
    const signAndTradeResult = validateSignAndTrade(team, tradeCtx);

    // 3. Validate hard cap rules (including S&T hard cap)
    const hardCapResult = validateHardCap(team);

    // 4. Validate second apron handcuffs (only if no S&T hard cap violation)
    let secondApronResult;
    if (
      signAndTradeResult.violations.some((v) => v.includes('hard cap')) ||
      hardCapResult.violations.some((v) => v.includes('hard-cap'))
    ) {
      // Skip second apron validation if S&T hard cap violation detected
      secondApronResult = {
        passed: true,
        violations: [],
        message: 'Deferred to sign-and-trade hard cap rules',
      };
    } else {
      secondApronResult = validateSecondApronRules(team);
    }

    // 5. Validate trade consent & eligibility - these return arrays directly
    const enhancedTradeCtx = { ...tradeCtx, teams }; // Add teams to context for consent enforcement
    const consentViolations = enforceConsent(team, enhancedTradeCtx) || [];
    const eligibilityViolations =
      enforceEligibility(team, enhancedTradeCtx) || [];

    const consentResult = {
      passed: consentViolations.length === 0,
      violations: consentViolations,
      message: 'Consent validated',
    };
    const eligibilityResult = {
      passed: eligibilityViolations.length === 0,
      violations: eligibilityViolations,
      message: 'Eligibility validated',
    };

    // Set passed status based on violations
    consentResult.passed = consentResult.violations.length === 0;
    eligibilityResult.passed = eligibilityResult.violations.length === 0;

    // 6. Validate salary matching (skip for second apron teams with violations)
    let salaryMatchResult;
    if (secondApronResult.violations.length > 0) {
      // Second apron teams with violations skip generic salary matching
      salaryMatchResult = {
        passed: false,
        violations: [],
        message: 'Deferred to second apron rules',
      };
    } else {
      salaryMatchResult = validateSalaryMatching(team);
    }

    // 7. Validate cash rules
    const cashResult = validateCash(team, tradeCtx);

    // 8. Validate draft pick rules
    const stepienResult = validateStepien(team);

    // 9. Validate roster rules
    const rosterResult = validateRoster(team);

    // 10. Validate TPEs and FA exceptions
    const tpeResult = validateTradeExceptions(team);
    const faExceptionResult = validateFaExceptionUsage(team);

    const rules = {
      secondApron: secondApronResult,
      signAndTrade: signAndTradeResult,
      consent: consentResult,
      eligibility: eligibilityResult,
      salaryMatching: salaryMatchResult,
      cash: cashResult,
      stepienRule: stepienResult,
      roster: rosterResult,
      hardCap: hardCapResult,
      tradeExceptions: tpeResult,
      faExceptions: faExceptionResult,
    };

    // Collect all violations with proper prioritization
    const violations = [];

    // Prioritize second apron violations
    if (
      secondApronResult.violations &&
      secondApronResult.violations.length > 0
    ) {
      violations.push(...secondApronResult.violations);
    }

    // Add other violations with null checks
    Object.entries(rules).forEach(([key, result]) => {
      if (
        key !== 'secondApron' &&
        result &&
        !result.passed &&
        result.violations &&
        result.violations.length > 0
      ) {
        violations.push(...result.violations);
      }
    });

    // Check if all validations passed
    const legal = violations.length === 0;

    // Apply hard cap status from Sign-and-Trade validation
    const finalHardCapped =
      team.hardCapped ||
      (signAndTradeResult && signAndTradeResult.hardCapped) ||
      false;

    return {
      ...team,
      rules,
      violations,
      legal,
      hardCapped: finalHardCapped,
      details: violations.join('; ') || 'Valid trade',
    };
  });

  // Overall trade is legal if all teams pass validation
  const legal = validatedTeams.every((team) => team.legal);

  // Find the most specific violation reason for the overall trade result
  let reason = 'Valid trade';
  if (!legal) {
    const failedTeam = validatedTeams.find((t) => !t.legal);
    if (failedTeam && failedTeam.violations.length > 0) {
      // Use the first (most important) violation as the main reason
      reason = failedTeam.violations[0];
    }
  }

  // Create summary for multi-team trades
  const summaryByTeamIndex = validatedTeams.map((team, index) => ({
    teamIndex: index,
    teamName: team.teamName,
    playersIn: team.incomingPlayers.map(
      (p) => p.name || p.id || 'Unknown Player'
    ),
    playersOut: team.outgoingPlayers.map(
      (p) => p.name || p.id || 'Unknown Player'
    ),
    picksIn: team.incomingPicks,
    picksOut: team.outgoingPicks,
    salaryIn: team.salaryIn,
    salaryOut: team.salaryOut,
    capDelta: team.salaryIn - team.salaryOut,
    legal: team.legal,
    violations: team.violations,
  }));

  return {
    legal,
    teamResults: validatedTeams,
    reason,
    summaryByTeamIndex,
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
  debug as tradeDebug,
  enforceSecondApronHandcuffs,
  enforceRosterWindow,
  enforceConsent,
  enforceEligibility,
  enforceTiming,
  validateCash,
  validateStepien,
  validateRoster,
  validateHardCap,
  validateTradeExceptions,
  validateFaExceptionUsage,
  validateSecondApronRules,
  validateSignAndTrade,
};
