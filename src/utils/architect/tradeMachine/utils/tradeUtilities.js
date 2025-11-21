/**
 * Trade utilities and helpers
 * Consolidated from: tradeUtils.js, pickOptions.js, tpeUtils.js, salaryCalculations.js
 */

// Salary matching calculations (from salaryCalculations.js)
export function computeMatchingValues({ teams, yearKey, context = {} }) {
  const { daysUntilTrade = 0, daysInSeason = 177 } = context;

  teams.forEach((team) => {
    team.sends?.forEach((player) => {
      // Base Year Compensation
      if (player.isBaseYear) {
        const bycValue = Math.max(
          player.previousSalary,
          player.newSalary * 0.5
        );
        player.matchOutgoing = bycValue;
        player.matchIncoming = player.newSalary;
        return;
      }

      // Trade Kicker
      if (player.tradeKicker) {
        const fullKickerAmount = player.salary * (player.tradeKicker / 100);
        const proRatedKicker =
          fullKickerAmount * ((daysInSeason - daysUntilTrade) / daysInSeason);
        const effectiveKicker = player.waiveKickerAmount
          ? Math.min(proRatedKicker, player.waiveKickerAmount)
          : proRatedKicker;

        player.matchOutgoing = player.salary;
        player.matchIncoming = player.salary + effectiveKicker;
        return;
      }

      // Poison Pill (Extension) - only for rookie scale contracts
      // Check isRookieScale flag from new schema
      const contract = player.contract || player.primaryContract;
      const isRookieScale = contract?.isRookieScale || player.isRookieScale || false;
      const isPoisonPill = player.isPoisonPill || isRookieScale;
      
      if (isPoisonPill && player.extensionYears?.length) {
        const extensionTotal = player.extensionYears.reduce(
          (sum, year) => sum + year.salary,
          0
        );
        const avgSalary =
          (player.salary + extensionTotal) / (1 + player.extensionYears.length);
        player.matchOutgoing = player.salary;
        player.matchIncoming = avgSalary;
        return;
      }

      // Default case
      player.matchOutgoing = player.salary;
      player.matchIncoming = player.salary;
    });
  });
}

// TPE utilities (from tpeUtils.js)
export const SECOND_APRON_TPE_BLOCK = 'Second apron team cannot use trade exceptions';

export function isPriorYearTPE(tpe, season) {
  const created = tpe?.season ?? tpe?.createdSeason ?? tpe?.createdAtSeason ?? season;
  return created < season;
}

export function isCurrentSeasonTPE(tpe, season) {
  const created = tpe?.season ?? tpe?.createdSeason ?? tpe?.createdAtSeason ?? season;
  return created === season;
}

// Backwards compatibility alias
export const isCurrentYearTPE = isCurrentSeasonTPE;

export function hasPriorYearTPE(appliedTPEs, currentSeason) {
  if (!Array.isArray(appliedTPEs)) return false;
  return appliedTPEs.some((tpe) => isPriorYearTPE(tpe, currentSeason));
}

export function createTPE({ teamCtx, outgoing, incoming, tradeDate }) {
  if (!teamCtx.isOverCap) return null;
  const amt = Math.max(0, outgoing - incoming);
  if (amt <= 0) return null;
  const baseDate = tradeDate ? new Date(tradeDate) : new Date();
  const expiry = new Date(baseDate);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return {
    amount: Math.round(amt),
    createdSeason: baseDate.getUTCFullYear(),
    expiryISO: expiry.toISOString(),
  };
}

export function isExpiredTPE(tpe, onDate) {
  const expiry = tpe?.expiryISO || tpe?.expiryDate;
  if (!expiry) return false;
  return new Date(onDate).getTime() > new Date(expiry).getTime();
}

export function canUseTPE(teamCtx, tpe, { currentSeason, onDate }) {
  if (!tpe || isExpiredTPE(tpe, onDate)) return false;
  // Second-apron logic handled upstream; this helper only checks expiry.
  return true;
}

// Date and formatting utilities (from tradeUtils.js)
export const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight
  return expiry <= today;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatSalary = (amount) => `$${(amount || 0).toLocaleString()}`;

export const isMeaningfulProtection = (protection) => {
  if (!protection) return false;
  return (
    /top\s*[1-9]\d*/i.test(protection) ||
    /lottery/i.test(protection) ||
    /1-14/i.test(protection)
  );
};

// Pick options and configurations (from pickOptions.js)
export const getPickOptions = () => [
  { label: 'Unprotected', value: '' },
  { label: 'Protected Top 3', value: 'Top 3' },
  { label: 'Protected Top 5', value: 'Top 5' },
  { label: 'Protected Top 8', value: 'Top 8' },
  { label: 'Protected Top 10', value: 'Top 10' },
  { label: 'Lottery Protected', value: 'Lottery' },
  { label: 'Protected Top 20', value: 'Top 20' },
  { label: 'Swap (+)', value: 'Swap (+)' },
  { label: 'Swap (-)', value: 'Swap (-)' },
];