/**
 * FILE: src/shared/utils/contracts/optionType.ts
 * PURPOSE: Single source of truth for contract salary-row "option" values.
 *
 * The canonical stored format is the SHORT codes ('PO' | 'TO' | 'ETO' | null),
 * matching the Zod schema (`src/schemas/common.ts` OptionTypeZ) and the contract
 * parser. This helper canonicalizes any inbound form (short codes OR the legacy
 * long-form 'Player Option' / 'Team Option' strings) to the canonical short code
 * so validators and parsers agree on one format and can't drift apart.
 *
 *  - PO  = Player Option
 *  - TO  = Team Option
 *  - ETO = Early Termination Option
 */

/** Canonical (non-null) option codes. */
export type OptionCode = 'PO' | 'TO' | 'ETO';

/** Canonical option value including the no-option case. */
export type OptionValue = OptionCode | null;

/** The set of valid canonical option codes. */
export const VALID_OPTION_CODES: readonly OptionCode[] = ['PO', 'TO', 'ETO'];

/**
 * Canonicalize any inbound option value to the canonical short code.
 *
 * Accepts short codes ('PO'/'TO'/'ETO'), the legacy long-form strings
 * ('Player Option'/'Team Option'/'Early Termination Option'), case-insensitively.
 * Returns `null` for empty/absent values AND for unrecognized garbage — callers
 * that need to distinguish "no option" from "invalid option" should check the
 * raw value for presence before calling, or use `isRecognizedOption`.
 */
export function canonicalizeOptionType(option: unknown): OptionValue {
  if (option === null || option === undefined || option === '') return null;
  const opt = String(option).trim().toUpperCase();
  if (opt === 'PO' || opt.includes('PLAYER')) return 'PO';
  if (opt === 'TO' || opt.includes('TEAM')) return 'TO';
  if (opt === 'ETO' || opt.includes('EARLY')) return 'ETO';
  return null;
}

/**
 * True when `option` is a recognized option value (a known code/long-form, OR
 * an explicit absence of an option). Returns false only for non-empty values
 * that don't map to any known option — i.e. genuinely invalid data.
 */
export function isRecognizedOption(option: unknown): boolean {
  if (option === null || option === undefined || option === '') return true;
  return canonicalizeOptionType(option) !== null;
}
