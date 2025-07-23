// src/utils/architect/extensionRules.js

import {
  differenceInMonths,
  addYears,
  parseISO,
  isBefore,
  startOfDay,
} from 'date-fns';

const ESTIMATED_AVERAGE_SALARY = 11100000; // Replace with real value
const SUPERMAX_PERCENT = 0.35;
const STANDARD_EXTENSION_PERCENT = 1.4;
const TRADE_EXTENSION_PERCENT = 1.2;
const OLD_TRADE_EXTENSION_PERCENT = 1.05;

// -------------- Primary Exports --------------

export const isExtensionEligible = (player, currentYear) => {
  return getExtensionEligibilityReason(player, currentYear) === 'Eligible';
};

export const getExtensionEligibilityReason = (player, currentYear) => {
  const now = new Date();
  const contract = player?.contract_clean;
  if (!contract) return 'Missing contract';

  const signed = player?.signedDate ? parseISO(player.signedDate) : null;
  if (!signed) return 'Missing signed date';

  if (contract.contractType === 'TwoWay')
    return 'Two-way contracts not eligible';
  if (differenceInMonths(now, signed) < 6)
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

export const getExtensionEligibilityDate = (player) => {
  const contract = player?.contract_clean;
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

export const getExtensionMaxDetails = (player, capSettings) => {
  const contract = player?.contract_clean;
  const salaries = contract?.salaries_by_year || {};
  const now = new Date();
  const yearKeys = Object.keys(salaries)
    .map(Number)
    .sort((a, b) => a - b);
  const currentYear = now.getFullYear();
  const nextYear = yearKeys.find((y) => y >= currentYear);
  const baseSalary = salaries[nextYear]?.salary || 0;

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
    ESTIMATED_AVERAGE_SALARY * STANDARD_EXTENSION_PERCENT
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
