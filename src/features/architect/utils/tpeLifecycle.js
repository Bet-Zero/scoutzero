/**
 * TPE Lifecycle Management
 *
 * Handles lifecycle events for Trade Exceptions (TPEs), specifically expiration
 * during season transitions.
 *
 * @file src/features/architect/utils/tpeLifecycle.js
 */

import { toEndYear } from './seasonFormat';

/**
 * Process Trade Exceptions during season transition
 *
 * Filters out minimal TPEs that expire before the start of the new season.
 *
 * @param {Array} tradeExceptions - List of TPE objects from team.tradeExceptions
 * @param {string} toSeason - Target season code (e.g. "2026-27")
 * @returns {Object} Result { hasChanges, activeTPEs, expiredTPEs }
 */
// Helper to get canonical expiry date string
export function getTpeExpiryISO(tpe) {
  if (!tpe) return null;
  return tpe.expiresOn || tpe.expiryISO || tpe.expiryDate || null;
}

export function processTradeExceptions(tradeExceptions, toSeason) {
  // Defensive check
  if (!tradeExceptions || !Array.isArray(tradeExceptions) || tradeExceptions.length === 0) {
    return {
      hasChanges: false,
      activeTPEs: [],
      expiredTPEs: [],
    };
  }

  // 1. Determine new season start boundary: July 1 of "toSeason" year
  // e.g. "2026-27" -> toEndYear=2027 -> startYear=2026 -> 2026-07-01
  const endYear = toEndYear(toSeason);
  if (!endYear) {
    console.warn(`[TPE] Could not determine end year for season "${toSeason}". Skipping TPE expiration.`);
    // Fail safe: return everything as is
    return {
      hasChanges: false,
      activeTPEs: tradeExceptions,
      expiredTPEs: [],
    };
  }

  const startYear = endYear - 1;
  // Create boundary date in UTC to avoid timezone issues (July 1st, 00:00:00 UTC)
  const seasonStartBoundary = new Date(Date.UTC(startYear, 6, 1)); // Month is 0-indexed: 6 = July

  const activeTPEs = [];
  const expiredTPEs = [];
  let hasChanges = false;

  for (const tpe of tradeExceptions) {
    // 2. Determine expiry date
    // Support expiresOn (canonical) and expiryISO (legacy) via helper
    const expiryStr = getTpeExpiryISO(tpe);

    if (!expiryStr) {
      // No expiry date? Keep it safe. 
      // TPEs without expiry shouldn't happen in valid schema, but we shouldn't delete data we don't understand.
      activeTPEs.push(tpe);
      continue;
    }

    const expiryDate = new Date(expiryStr);

    // Check validity
    if (isNaN(expiryDate.getTime())) {
      console.warn('[TPE] Invalid expiry date found:', expiryStr, tpe);
      activeTPEs.push(tpe);
      continue;
    }

    // 3. Compare
    // If expiry < boundary, it is expired.
    // If expiry >= boundary, it is active (expires IN the new season or later).
    if (expiryDate.getTime() < seasonStartBoundary.getTime()) {
      expiredTPEs.push({
        ...tpe,
        // Ensure we preserve the date string used for decision
        _expiryParams: {
          expiryStr,
          boundaryStr: seasonStartBoundary.toISOString()
        }
      });
      hasChanges = true;
    } else {
      // 4. Backfill (Phase 2)
      // If expiresOn is missing but we found a valid expiryStr from legacy fields, backfill it.
      if (!tpe.expiresOn && expiryStr) {
        activeTPEs.push({
          ...tpe,
          expiresOn: expiryStr
        });
        hasChanges = true;
      } else {
        activeTPEs.push(tpe);
      }
    }
  }

  return {
    hasChanges,
    activeTPEs,
    expiredTPEs,
  };
}
