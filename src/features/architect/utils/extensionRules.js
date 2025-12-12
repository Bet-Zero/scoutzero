// src/utils/architect/extensionRules.js

/**
 * @deprecated This module is deprecated in favor of the Salary Engine.
 * Use `@/features/architect/utils/salaryEngine` instead.
 *
 * Migration:
 * - `isExtensionEligible(player, year)` → `getExtensionProfile(ctx).eligibility.isEligible`
 * - `getExtensionEligibilityReason(player, year)` → `getExtensionProfile(ctx).eligibility.reason`
 * - `getExtensionMaxDetails(player, caps)` → `getExtensionProfile(ctx).terms`
 *
 * The Salary Engine provides consistent timing and cap handling via RuleContext.
 *
 * @see src/features/architect/utils/salaryEngine/README.md for migration guide
 */

import {
  differenceInMonths,
  addYears,
  parseISO,
  isBefore,
  startOfDay,
} from 'date-fns';
import { DEFAULT_AVERAGE_SALARY } from './cbaConstants.js';

const SUPERMAX_PERCENT = 0.35;
const STANDARD_EXTENSION_PERCENT = 1.4;
const TRADE_EXTENSION_PERCENT = 1.2;
const OLD_TRADE_EXTENSION_PERCENT = 1.05;

// -------------- Primary Exports (DEPRECATED) --------------

/**
 * @deprecated Use `getExtensionProfile(ctx).eligibility.isEligible` from salaryEngine instead.
 * @param {Object} player - Player data object
 * @param {number} currentYear - Current season end year
 * @returns {boolean} Whether player is extension eligible
 */
export const isExtensionEligible = (player, currentYear) => {
  return getExtensionEligibilityReason(player, currentYear) === 'Eligible';
};

/**
 * @deprecated Use `getExtensionProfile(ctx).eligibility.reason` from salaryEngine instead.
 * @param {Object} player - Player data object
 * @param {number} currentYear - Current season end year
 * @returns {string} Eligibility reason or 'Eligible'
 */
export const getExtensionEligibilityReason = (player, currentYear) => {
  const now = new Date();
  // Use Architect contract shape (BasePlayerContractZ)
  const contract = player?.contract;
  if (!contract) return 'Missing contract';

  const signed = player?.signedDate ? parseISO(player.signedDate) : null;
  // Relaxed rule: If missing signed date, assume eligible for timing checks
  // if (!signed) return 'Missing signed date'; 

  if (contract.contractType === 'TwoWay')
    return 'Two-way contracts not eligible';
  if (signed && differenceInMonths(now, signed) < 6)
    return 'Must wait 6 months after signing';
  if (contract.originalLength <= 2)
    return 'Must be on a contract 3+ years long';
  if (player.usedETO)
    return 'Cannot extend after using Early Termination Option';
  if (
    player.lastRenegotiatedDate &&
    differenceInMonths(now, parseISO(player.lastRenegotiatedDate)) < 36
  )
    return 'Must wait 3 years after renegotiation >10%';
  if (
    player.lastTradedDate &&
    differenceInMonths(now, parseISO(player.lastTradedDate)) < 6
  )
    return 'Cannot extend within 6 months of being traded';

  if (contract.optionDeclined && !contract.extensionIncludesTwoGuaranteed)
    return 'Declined option requires 2 guaranteed years in extension';

  // Rookie Scale Extensions
  if (contract.contractType === 'RookieScale') {
    if (!player.draftYear) return 'Missing draft year';
    if (currentYear !== player.draftYear + 3)
      return 'Rookie extensions only allowed between 3rd and 4th seasons';
  }

  const eligibilityDate = getExtensionEligibilityDate(player);
  if (eligibilityDate && isBefore(now, eligibilityDate)) {
    return `Extension allowed after ${eligibilityDate.toLocaleDateString()}`;
  }

  return 'Eligible';
};

/**
 * @deprecated Use `getExtensionProfile(ctx).eligibility.eligibleDate` from salaryEngine instead.
 * @param {Object} player - Player data object
 * @returns {Date|null} Date when extension becomes eligible
 */
export const getExtensionEligibilityDate = (player) => {
  const contract = player?.contract;
  if (!contract || !player?.signedDate) return null;
  const signed = parseISO(player.signedDate);

  if (contract.originalLength === 3 || contract.originalLength === 4) {
    return addYears(signed, 2);
  }
  if (contract.originalLength >= 5) {
    return addYears(signed, 3);
  }
  return null;
};

/**
 * @deprecated Use `getExtensionProfile(ctx).terms` from salaryEngine instead.
 * @param {Object} player - Player data object
 * @param {Object} capSettings - Cap settings with cap, tax, etc.
 * @returns {Object|null} Extension max details or null
 */
export const getExtensionMaxDetails = (player, capSettings) => {
  const contract = player?.contract;
  if (!contract) return null;
  const salaries =
    contract?.salariesByYear ||
    contract?.salaries ||
    {};
  const now = new Date();
  const yearKeys = Array.isArray(salaries)
    ? salaries
        .map((y) => {
          const season = String(y.season);
          if (/^\d{4}-\d{2}$/.test(season)) {
            const tail = parseInt(season.split('-')[1], 10);
            return 2000 + tail;
          }
          const n = parseInt(season, 10);
          return Number.isFinite(n) ? n : null;
        })
        .filter((y) => y != null)
        .sort((a, b) => a - b)
    : Object.keys(salaries)
        .map(Number)
        .sort((a, b) => a - b);
  const currentYear = now.getFullYear();
  const nextYear = yearKeys.find((y) => y >= currentYear);
  let baseSalary = 0;
  if (Array.isArray(salaries)) {
    const seasonEntry = salaries.find((y) => {
      const season = String(y.season);
      if (/^\d{4}-\d{2}$/.test(season)) {
        const tail = parseInt(season.split('-')[1], 10);
        return 2000 + tail === nextYear;
      }
      return String(season) === String(nextYear);
    });
    baseSalary = seasonEntry?.salary || seasonEntry?.capHit || 0;
  } else if (nextYear != null) {
    baseSalary = salaries[nextYear]?.salary || 0;
  }

  if (contract.contractType === 'RookieScale') {
    const rookieTier = getRookieMaxPercent(player);
    return {
      maxYears: 5,
      maxFirstYearSalary: Math.round(capSettings.cap * rookieTier.percent),
      baseRaisePct: 0.08,
      type: 'Rookie Extension',
      basedOn: `${rookieTier.percent * 100}% of cap`,
      notes: rookieTier.reason,
    };
  }

  if (isSupermaxEligible(player)) {
    return {
      maxYears: 5,
      maxFirstYearSalary: Math.round(capSettings.cap * SUPERMAX_PERCENT),
      baseRaisePct: 0.08,
      type: 'Designated Veteran Extension',
      basedOn: '35% of cap',
      notes: 'Meets All-NBA and tenure criteria',
    };
  }

  if (player.lastTradedDate) {
    return {
      maxYears: 2,
      maxFirstYearSalary: baseSalary * OLD_TRADE_EXTENSION_PERCENT,
      baseRaisePct: 0.05,
      type: 'Trade Extension (Pre-2024)',
      basedOn: '105% of current salary',
      notes: 'Restricted by trade rule',
    };
  }

  const floor = Math.max(
    baseSalary * STANDARD_EXTENSION_PERCENT,
    DEFAULT_AVERAGE_SALARY * STANDARD_EXTENSION_PERCENT
  );

  return {
    maxYears: 4,
    maxFirstYearSalary: Math.round(floor),
    baseRaisePct: 0.08,
    type: 'Standard Veteran Extension',
    basedOn: '140% of salary or average salary',
    notes: '',
  };
};

// -------------- Helpers --------------

const getRookieMaxPercent = (player) => {
  const awards = player.awards || [];
  const allNBA = awards.filter(
    (a) => a.type === 'All-NBA' && a.year >= new Date().getFullYear() - 2
  );
  const mvp = awards.find((a) => a.type === 'MVP');
  const dpoy = awards.find((a) => a.type === 'DPOY');

  if (mvp || dpoy) return { percent: 0.3, reason: 'Award (MVP or DPOY)' };
  if (allNBA.length) {
    const team = allNBA[0].team; // 1st, 2nd, 3rd
    if (team === 1) return { percent: 0.3, reason: 'All-NBA 1st Team' };
    if (team === 2) return { percent: 0.27, reason: 'All-NBA 2nd Team' };
    return { percent: 0.26, reason: 'All-NBA 3rd Team' };
  }

  return { percent: 0.25, reason: 'Standard rookie extension' };
};

const isSupermaxEligible = (player) => {
  const awards = player.awards || [];
  const allNBA = awards.filter(
    (a) => a.type === 'All-NBA' && a.year >= new Date().getFullYear() - 2
  );
  const hasTenure = player.years_of_service >= 7; // Stubbed logic
  const sameTeam = true; // Assume for now

  return hasTenure && allNBA.length && sameTeam;
};
