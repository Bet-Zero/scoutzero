/**
 * Validates trade exception usage in trades
 */

import {
  isPriorYearTPE,
  isExpiredTPE,
  createTPE,
} from '@/utils/architect/tradeMachine/tpeUtils.js';
import { formatCurrency } from '@/utils/architect/tradeHelpers.js';
import { validationCache } from './validationCache.js';
import debug from '../debug.js';

export function validateTradeExceptions(team) {
  const violations = [];
  const {
    teamTotalSalary = 0,
    context = {},
    incomingPlayers = [],
    outgoingPlayers = [],
    sends = [],
    teamName = 'Unknown Team',
    appliedTPEs = [], // Use appliedTPEs from trade input
    tradeExceptions = [], // Legacy: TPE objects from team
    salaryOut = 0,
    salaryIn = 0,
  } = team;

  const { capSettings = {}, yearKey } = context;
  const { secondApron = 0 } = capSettings;

  // Extract numeric year from yearKey (e.g., '2025-2026' -> 2025)
  // Fallback to current year if yearKey is not provided
  const numericYear = yearKey
    ? typeof yearKey === 'string'
      ? parseInt(yearKey.split('-')[0])
      : yearKey
    : new Date().getFullYear();

  // Determine which TPE pattern we're using
  const usingAppliedTPEs = appliedTPEs.length > 0;
  const tpesToProcess = usingAppliedTPEs ? appliedTPEs : tradeExceptions;

  // Check for second apron TPE restrictions (only for trade validator pattern)
  const isSecondApronTeam = teamTotalSalary >= secondApron;

  if (isSecondApronTeam && tpesToProcess.length > 0 && usingAppliedTPEs) {
    // Check if any TPE is from prior year
    const hasPriorYearTPE = tpesToProcess.some((tpe) =>
      isPriorYearTPE(tpe, numericYear)
    );

    if (hasPriorYearTPE) {
      violations.push('Second apron: prior-year TPEs cannot be used.');
    } else {
      // Current year TPEs also blocked for second apron teams
      violations.push('Second apron team cannot use trade exceptions');
    }
  }

  // Check for TPE + outgoing salary aggregation (only for trade validator pattern)
  const hasOutgoingSalary =
    (sends || []).length > 0 || (outgoingPlayers || []).length > 0;
  if (tpesToProcess.length > 0 && hasOutgoingSalary && usingAppliedTPEs) {
    violations.push('Cannot aggregate trade exception with outgoing salary');
  }

  // Process each TPE
  tpesToProcess.forEach((tpe) => {
    const tpeViolations = [];

    // Check if TPE has already been fully consumed
    if (tpe.isUsed || tpe.isBeingUsed) {
      tpeViolations.push(`Trade exception ${tpe.id} already being processed`);
      violations.push(...tpeViolations);
      return;
    }

    // Check if TPE is expired using multiple possible date properties
    const currentDate = new Date();
    if (tpe.expiryISO && isExpiredTPE(tpe, currentDate.toISOString())) {
      tpeViolations.push(`Trade exception ${tpe.id} is expired`);
    } else if (tpe.expiryDate) {
      const expiryDate = new Date(tpe.expiryDate);
      if (currentDate > expiryDate) {
        tpeViolations.push(`Trade exception ${tpe.id} is expired`);
      }
    }

    // Find players using this TPE
    const playersUsingTPE = incomingPlayers.filter((p) => p.tpeId === tpe.id);
    let totalUsage = 0;

    playersUsingTPE.forEach((player) => {
      const playerSalary = player.salary || player.matchIncoming || 0;
      totalUsage += playerSalary;
    });

    // Check if total usage exceeds TPE capacity
    const tpeAmount = tpe.amount || 0;
    if (totalUsage > tpeAmount) {
      tpeViolations.push(
        `TPE usage ${formatCurrency(totalUsage)} exceeds TPE capacity ${formatCurrency(tpeAmount)} - TPE is too small`
      );
    }

    // If no violations, apply the TPE usage
    if (tpeViolations.length === 0) {
      tpe.remaining = tpeAmount - totalUsage;
      tpe.isUsed = tpe.remaining === 0;
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
      tradeDate: context.tradeDate || new Date().toISOString(),
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
