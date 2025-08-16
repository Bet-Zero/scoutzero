/**
 * Validates trade exception usage in trades
 */

import {
  isPriorYearTPE,
  isExpiredTPE,
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
    teamName = 'Unknown Team',
    tradeExceptions = [], // Use tradeExceptions instead of appliedTPEs
  } = team;

  const { capSettings = {}, yearKey } = context;
  const { secondApron = 0 } = capSettings;

  // Process each trade exception
  tradeExceptions.forEach((tpe) => {
    // Validate this specific TPE usage
    const tpeViolations = [];

    // Check if TPE has already been fully consumed
    if (tpe.isUsed || tpe.isBeingUsed) {
      tpeViolations.push(`Trade exception ${tpe.id} already being processed`);
      violations.push(...tpeViolations); // Add violations immediately
      return; // Skip further processing for this TPE
    }

    // Check if TPE is expired using expiryDate property
    if (tpe.expiryDate) {
      const expiryDate = new Date(tpe.expiryDate);
      const currentDate = new Date();
      if (currentDate > expiryDate) {
        tpeViolations.push(`Trade exception ${tpe.id} is expired`);
      }
    }

    // Find players using this TPE
    const playersUsingTPE = incomingPlayers.filter((p) => p.tpeId === tpe.id);
    let totalUsage = 0;

    playersUsingTPE.forEach((player) => {
      const playerSalary = player.salary || 0;
      totalUsage += playerSalary;
    });

    // Check if total usage exceeds TPE capacity
    const tpeAmount = tpe.amount || 0;
    if (totalUsage > tpeAmount) {
      tpeViolations.push(
        `TPE usage ${totalUsage} exceeds TPE capacity ${tpeAmount} - TPE is too small`
      );
    }

    // If no violations, apply the TPE usage
    if (tpeViolations.length === 0) {
      // Update TPE properties
      tpe.remaining = tpeAmount - totalUsage;
      tpe.isUsed = tpe.remaining === 0;
    }

    // Add any violations to the main list
    violations.push(...tpeViolations);
  });

  const result = {
    passed: violations.length === 0,
    violations,
    message: violations.length ? violations[0] : 'TPE usage validated',
    details: violations.join('; '),
  };

  return result;
}
