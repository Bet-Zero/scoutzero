/**
 * Utilities for trade export payload construction.
 */

type TradeExceptionId = string | number | null;

interface TradeSendLike {
  absorptionMode?: string | null;
  tpeId?: TradeExceptionId;
}

/**
 * Extract unique TPE IDs actually used for absorption from a sends array.
 * Canonical encoding: absorptionMode === 'TPE' && tpeId is truthy.
 *
 * @param {Array} sends - Array of outgoing player objects from a trade slot
 * @returns {string[]} De-duplicated array of TPE ID strings
 */
export function extractUsedTpeIds(sends: TradeSendLike[] | null | undefined) {
  if (!Array.isArray(sends)) return [];
  const ids: TradeExceptionId[] = [];
  for (const p of sends) {
    if (p.absorptionMode === 'TPE' && p.tpeId) {
      ids.push(p.tpeId);
    }
  }
  return [...new Set(ids)];
}
