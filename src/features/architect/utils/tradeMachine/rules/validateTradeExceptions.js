/**
 * Validates trade exception usage in trades
 */

import {
  isPriorYearTPE,
  isExpiredTPE,
  createTPE,
  buildCanonicalTeamTpeUsage,
} from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers.js';
import { SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';
import { isSecondApronTeam as checkSecondApron } from '../utils/capUtils.js';

export function validateTradeExceptions(team) {
  const violations = [];
  const {
    teamTotalSalary = 0,
    context = {},
    incomingPlayers = [],
    outgoingPlayers = [],
    sends = [],
    appliedTPEs = [], // Use appliedTPEs from trade input
    tradeExceptions = [], // Legacy: TPE objects from team
    salaryOut = 0,
    salaryIn = 0,
  } = team;

  const { capSettings = {}, yearKey } = context;
  // The authoritative validator path normalizes tradeDate upstream.
  // TPE expiry must read that canonical field, not ambient machine time.
  const canonicalTradeDate = context.tradeDate || new Date().toISOString();

  // Extract numeric year from yearKey (e.g., '2025-2026' -> 2025)
  // Fallback to current year if yearKey is not provided
  const numericYear = yearKey
    ? typeof yearKey === 'string'
      ? parseInt(yearKey.split('-')[0])
      : yearKey
    : new Date().getFullYear();

  const canonicalTpeUsage = buildCanonicalTeamTpeUsage({
    team,
    incomingPlayers,
    appliedTPEs,
    tradeExceptions,
  });
  const { usedTpes, unresolvedPlayers, usesTpe } = canonicalTpeUsage;

  // FAIL-CLOSED: Reject absorptionMode='TPE' without explicit tpeId
  unresolvedPlayers.forEach(({ player, tpeId, reason }) => {
    const playerName = player?.name || player?.displayName || 'Unknown';

    if (reason === 'missingTpeId') {
      violations.push(
        `Player ${playerName} has absorptionMode='TPE' but no tpeId specified`
      );
      return;
    }

    if (reason === 'missingOnTeam') {
      violations.push(
        `Player ${playerName} references tpeId '${tpeId}' which does not exist on this team`
      );
    }
  });

  // Check for second apron TPE restrictions based on canonical TPE usage
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const isSecondApronTeam = checkSecondApron(
    { totalSalary: teamTotalSalary },
    capSettings
  );

  if (isSecondApronTeam && usesTpe) {
    const hasPriorYearTPE = usedTpes.some(({ tpe }) =>
      tpe ? isPriorYearTPE(tpe, numericYear) : false
    );

    if (hasPriorYearTPE) {
      violations.push(SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED);
    }
  }

  // For teams below second apron, TPE usage is allowed (including prior-year TPEs)
  // Only check for basic TPE validation like expiration and capacity

  // Check for TPE + outgoing salary aggregation using canonical usage detection
  const hasOutgoingSalary =
    Number(salaryOut || 0) > 0 ||
    [...(outgoingPlayers || []), ...(sends || [])].some(
      (player) => Number(player?.matchOutgoing ?? player?.salary ?? 0) > 0
    );
  if (usesTpe && hasOutgoingSalary) {
    violations.push('Cannot aggregate trade exception with outgoing salary');
  }

  // Process each TPE actually used in the canonical validator path
  usedTpes.forEach(({ tpe, tpeId, totalUsage }) => {
    const tpeViolations = [];
    if (!tpe) return;

    // Check if TPE has already been fully consumed
    if (tpe.isUsed || tpe.isBeingUsed) {
      tpeViolations.push(`Trade exception ${tpe.id || tpeId} already being processed`);
      violations.push(...tpeViolations);
      return;
    }

    if (isExpiredTPE(tpe, canonicalTradeDate)) {
      tpeViolations.push(`Trade exception ${tpe.id || tpeId} is expired`);
    }

    // Check if total usage exceeds TPE capacity
    const tpeAmount = tpe.amount || 0;
    if (totalUsage > tpeAmount) {
      tpeViolations.push(
        `TPE usage ${formatCurrency(totalUsage)} exceeds TPE capacity ${formatCurrency(tpeAmount)} - TPE is too small`
      );
    }

    // If no violations, apply the TPE usage
    if (tpeViolations.length === 0) {
      const nextRemaining = tpeAmount - totalUsage;
      tpe.remaining = nextRemaining;
      tpe.remainingAmount = nextRemaining;
      tpe.isUsed = nextRemaining === 0;

      if (tpe.sourceRef && tpe.sourceRef !== tpe) {
        tpe.sourceRef.remaining = nextRemaining;
        tpe.sourceRef.remainingAmount = nextRemaining;
        tpe.sourceRef.isUsed = nextRemaining === 0;
      }
    }

    violations.push(...tpeViolations);
  });

  // Check if team should create a new TPE (when sending out more than receiving)
  const salaryDifference = salaryOut - salaryIn;
  let createdTPE = null;

  if (salaryDifference > 0 && teamTotalSalary > (capSettings.salaryCap || 0)) {
    // Create TPE for the salary difference
    createdTPE = createTPE({
      teamCtx: { isOverCap: true },
      outgoing: salaryOut,
      incoming: salaryIn,
      tradeDate: canonicalTradeDate,
    });
  }

  const result = {
    passed: violations.length === 0,
    violations,
    message: violations.length ? violations[0] : 'TPE usage validated',
    details: violations.join('; '),
    createdTPE, // Include created TPE in result
  };

  return result;
}
