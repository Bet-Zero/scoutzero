/**
 * FILE: computeMatchingValues.js
 * PURPOSE: Deprecated wrapper - use matchingValues.js for canonical implementation
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2025-12-27: Deprecated in favor of matchingValues.js
 * LINKS: matchingValues.js
 */

/**
 * @deprecated This module is deprecated. Use matchingValues.js instead.
 * 
 * This file now re-exports from the canonical matchingValues.js module
 * to maintain backwards compatibility with existing imports.
 * 
 * The canonical implementation in matchingValues.js handles:
 * - Base Year Compensation (BYC)
 * - Trade kickers with proration
 * - Poison pill averaging for rookie scale contracts
 * 
 * @see matchingValues.js for the canonical implementation
 */
export { computeMatchingValues, getMatchingValue } from './matchingValues.js';
