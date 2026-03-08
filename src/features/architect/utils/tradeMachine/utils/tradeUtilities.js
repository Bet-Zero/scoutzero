/**
 * Trade utilities and helpers
 * Consolidated from: tradeUtils.js, pickOptions.js, tpeUtils.js
 * Note: Salary matching calculations moved to computeMatchingValues.js
 */

import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe.js';

// TPE utilities (from tpeUtils.js)
export const SECOND_APRON_TPE_BLOCK =
  'Second apron team cannot use trade exceptions';

export function isPriorYearTPE(tpe, season) {
  const created =
    tpe?.season ?? tpe?.createdSeason ?? tpe?.createdAtSeason ?? season;
  return created < season;
}

export function isCurrentSeasonTPE(tpe, season) {
  const created =
    tpe?.season ?? tpe?.createdSeason ?? tpe?.createdAtSeason ?? season;
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
  const rounded = Math.round(amt);
  return {
    amount: rounded,
    totalAmount: rounded, // Canonical schema field
    remainingAmount: rounded, // Full capacity at creation
    remaining: rounded, // UI alias
    createdSeason: baseDate.getUTCFullYear(),
    expiresOn: expiry.toISOString(), // Canonical schema field (Phase 1)
    expirationDate: expiry.toISOString(), // UI alias
  };
}

export function isExpiredTPE(tpe, onDate) {
  const expiry = tpe?.expiresOn || tpe?.expiryISO || tpe?.expiryDate;
  if (!expiry) return false;
  return new Date(onDate).getTime() > new Date(expiry).getTime();
}

export function canUseTPE(teamCtx, tpe, { onDate }) {
  if (!tpe || isExpiredTPE(tpe, onDate)) return false;
  // Second-apron logic handled upstream; this helper only checks expiry.
  return true;
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeTpeForValidation(tpe) {
  if (!tpe || typeof tpe !== 'object') return null;

  const amount = toFiniteNumber(tpe.amount ?? tpe.totalAmount);
  const remaining = toFiniteNumber(
    tpe.remaining ?? tpe.remainingAmount ?? amount,
    amount
  );
  const expiresOn =
    tpe.expiresOn ??
    tpe.expirationDate ??
    tpe.expiryISO ??
    tpe.expiryDate ??
    null;

  return {
    ...tpe,
    amount,
    totalAmount: toFiniteNumber(tpe.totalAmount ?? amount, amount),
    remaining,
    remainingAmount: toFiniteNumber(tpe.remainingAmount ?? remaining, remaining),
    expiresOn,
    expirationDate: tpe.expirationDate ?? expiresOn,
    expiryISO: tpe.expiryISO ?? expiresOn,
    expiryDate: tpe.expiryDate ?? expiresOn,
    sourceRef: tpe?.sourceRef || tpe,
  };
}

export function buildCanonicalTeamTpeUsage({
  team,
  incomingPlayers = [],
  appliedTPEs = [],
  tradeExceptions = [],
}) {
  const availableTpeMap = new Map();
  const compatibilityTpes = [
    ...(Array.isArray(tradeExceptions) ? tradeExceptions : []),
    ...(Array.isArray(appliedTPEs) ? appliedTPEs : []),
  ];
  const teamHeldTpes = team?.team ? getTeamTpeList(team.team) : getTeamTpeList(team);

  const addTpe = (rawTpe) => {
    const normalizedTpe = normalizeTpeForValidation(rawTpe);
    if (!normalizedTpe?.id) return;

    const existing = availableTpeMap.get(normalizedTpe.id);
    const mergedTpe = existing
      ? normalizeTpeForValidation({ ...existing, ...normalizedTpe })
      : normalizedTpe;
    mergedTpe.sourceRef =
      existing?.sourceRef || normalizedTpe.sourceRef || rawTpe;

    availableTpeMap.set(
      normalizedTpe.id,
      mergedTpe
    );
  };

  compatibilityTpes.forEach(addTpe);
  teamHeldTpes.forEach(addTpe);

  const tpeAttemptPlayers = (incomingPlayers || []).filter(
    (player) => player?.absorptionMode === 'TPE' || player?.tpeId
  );
  const usageMap = new Map();
  const unresolvedPlayers = [];

  tpeAttemptPlayers.forEach((player) => {
    const tpeId = player?.tpeId || null;
    if (!tpeId) {
      unresolvedPlayers.push({ player, tpeId: null, reason: 'missingTpeId' });
      return;
    }

    const resolvedTpe = availableTpeMap.get(tpeId) || null;
    if (!resolvedTpe) {
      unresolvedPlayers.push({ player, tpeId, reason: 'missingOnTeam' });
    }

    const salary = toFiniteNumber(player?.matchIncoming ?? player?.salary);
    const existingUsage = usageMap.get(tpeId) || {
      tpeId,
      tpe: resolvedTpe,
      players: [],
      totalUsage: 0,
      source: 'playerAssignment',
    };

    existingUsage.players.push(player);
    existingUsage.totalUsage += salary;
    existingUsage.tpe = existingUsage.tpe || resolvedTpe;
    usageMap.set(tpeId, existingUsage);
  });

  compatibilityTpes.forEach((rawTpe) => {
    const normalizedTpe = normalizeTpeForValidation(rawTpe);
    if (!normalizedTpe?.id || usageMap.has(normalizedTpe.id)) return;

    usageMap.set(normalizedTpe.id, {
      tpeId: normalizedTpe.id,
      tpe: availableTpeMap.get(normalizedTpe.id) || normalizedTpe,
      players: [],
      totalUsage: 0,
      source: 'compatibilityInput',
    });
  });

  return {
    availableTpes: Array.from(availableTpeMap.values()),
    usedTpes: Array.from(usageMap.values()),
    unresolvedPlayers,
    usesTpe: tpeAttemptPlayers.length > 0 || usageMap.size > 0,
  };
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

/**
 * Phase 4: Determines if a protection value is "meaningful" for Stepien purposes.
 *
 * Supports:
 * - Legacy string protection: "Top 3", "Lottery", etc.
 * - Pick object with protectionMeta (Option A)
 *
 * Phase 4 Updates:
 * - Normalizes legacy "Swap (+/-)" values to unprotected (defensive)
 * - Supports protectionMeta.type for structured protection
 *
 * @param {string|Object|null|undefined} protectionOrPick - Protection string or pick object
 * @returns {boolean} - True if protection is meaningful
 */
export const isMeaningfulProtection = (protectionOrPick) => {
  // Handle null/undefined
  if (!protectionOrPick) return false;

  // If it's a pick object with protectionMeta, use structured logic
  if (typeof protectionOrPick === 'object' && protectionOrPick.protectionMeta) {
    const { type, maxPosition } = protectionOrPick.protectionMeta;
    // Meaningful types: position, lottery, playoff
    // Non-meaningful types: always (unprotected), never (unconditional)
    if (type === 'always' || type === 'never') {
      return false;
    }
    if (type === 'position' && typeof maxPosition === 'number') {
      return maxPosition > 0;
    }
    if (type === 'lottery' || type === 'playoff') {
      return true;
    }
    return false;
  }

  // Legacy: string protection
  // First normalize to handle legacy "Swap (+/-)" values
  let protection = protectionOrPick;
  if (typeof protectionOrPick === 'object' && protectionOrPick.protection) {
    protection = protectionOrPick.protection;
  }

  if (typeof protection !== 'string') return false;

  // Defensive: treat "Swap (+/-)" as unprotected
  if (protection === 'Swap (+)' || protection === 'Swap (-)') {
    return false;
  }

  // Original regex logic for string protection
  return (
    /top\s*[1-9]\d*/i.test(protection) ||
    /lottery/i.test(protection) ||
    /1-14/i.test(protection)
  );
};

// Pick options and configurations (from pickOptions.js)
// Phase 4: Removed "Swap (+)" and "Swap (-)" entries
// Swap is properly modeled with isSwap, swapType, swapWithTeamId (Phase 2)
export const getPickOptions = () => [
  { label: 'Unprotected', value: '' },
  { label: 'Protected Top 3', value: 'Top 3' },
  { label: 'Protected Top 5', value: 'Top 5' },
  { label: 'Protected Top 8', value: 'Top 8' },
  { label: 'Protected Top 10', value: 'Top 10' },
  { label: 'Lottery Protected', value: 'Lottery' },
  { label: 'Protected Top 20', value: 'Top 20' },
];

/**
 * Phase 4: Normalizes legacy protection values.
 * Converts "Swap (+)" and "Swap (-)" protection strings to unprotected (null).
 * These values were erroneously available in the UI dropdown but never meant
 * anything for protection logic.
 *
 * @param {string|null|undefined} protection - Raw protection value
 * @returns {string|null} - Normalized protection value
 */
export function normalizeProtectionValue(protection) {
  if (!protection) return null;

  // Defensive normalization: treat legacy "Swap (+/-)" as unprotected
  if (protection === 'Swap (+)' || protection === 'Swap (-)') {
    return null;
  }

  return protection;
}
