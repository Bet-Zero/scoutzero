/**
 * Trade Machine root public barrel.
 * Canonical surface: `validateTrade`.
 * Lower-level rules and helpers should be imported from `tradeMachine/rules`
 * or `tradeMachine/utils` directly.
 *
 * HISTORY:
 *  - 2026-03-27: TM-4D - Narrowed the root barrel to the canonical validator.
 *  - 2026-03-20: E131 - TS-backed the Trade Machine public barrel and retired index.js
 */

export { validateTrade } from './engine/tradeValidator';
