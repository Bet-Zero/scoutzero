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
