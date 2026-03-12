import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_BASE = '@/features/architect/utils/capLegalityValidation';
const SHIM_PATH = path.resolve(
  __dirname,
  '../../src/features/architect/utils/capLegalityValidation.js'
);

const EXPECTED_NAMED_EXPORTS = [
  'HARD_BLOCK_RULES',
  'SIGNING_YEARS_LIMITS',
  'EXTENSION_YEARS_LIMITS',
  'EXTENSION_FIRST_YEAR_MAX_PERCENT',
  'EXTENSION_MAX_RAISE_PERCENT',
  'OFFER_SHEET_YEARS_MIN',
  'OFFER_SHEET_YEARS_MAX',
  'OFFER_SHEET_MAX_RAISE_PCT',
  'SOFT_WARNING_RULES',
  'getOverridePolicy',
  'isOverrideEnabled',
  'evaluateDataConfidence',
  'resolveSigningMechanism',
  'getSigningYearsLimits',
  'getSigningFirstYearMax',
  'validateSalaryRowSchema',
  'validateGuaranteesPolicy',
  'validateOptionsPolicy',
  'validateContractRows',
  'validateDeadCap',
  'validateExceptions',
  'normalizeSigningTerms',
  'isCapSpaceSigning',
  'getSigningTermsForPlayer',
  'validateSigningRaises',
  'isFinalizingSigning',
  'validateStoreOnlyInvariants',
  'validateOfferSheetTerms',
  'validateSigningTermsAndRaises',
  'getContractLastYearSalary',
  'getExtensionFirstYearSalary',
  'getExtensionYears',
  'getExtensionTermsForPlayer',
  'validateExtensionTermsAndRaises',
  'validateExceptionEligibility',
  'validateSigning',
  'validateWaive',
  'validateExtension',
  'validateOptionDecision',
  'validateRenounceRights',
  'validateOfferSheetResolution',
] as const;

const EXPECTED_DEFAULT_EXPORT_MEMBERS = [
  'validateSigning',
  'validateWaive',
  'validateExtension',
  'validateOptionDecision',
  'validateRenounceRights',
  'getOverridePolicy',
  'isOverrideEnabled',
  'resolveSigningMechanism',
  'getSigningYearsLimits',
  'getSigningFirstYearMax',
  'getSigningTermsForPlayer',
  'validateSigningRaises',
  'validateSigningTermsAndRaises',
  'getContractLastYearSalary',
  'getExtensionFirstYearSalary',
  'getExtensionYears',
  'getExtensionTermsForPlayer',
  'validateExtensionTermsAndRaises',
  'HARD_BLOCK_RULES',
  'SOFT_WARNING_RULES',
  'SIGNING_YEARS_LIMITS',
  'EXTENSION_YEARS_LIMITS',
  'EXTENSION_FIRST_YEAR_MAX_PERCENT',
  'EXTENSION_MAX_RAISE_PERCENT',
  'validateSalaryRowSchema',
  'validateGuaranteesPolicy',
  'validateOptionsPolicy',
  'validateContractRows',
  'validateOfferSheetTerms',
  'OFFER_SHEET_YEARS_MIN',
  'OFFER_SHEET_YEARS_MAX',
  'OFFER_SHEET_MAX_RAISE_PCT',
  'validateStoreOnlyInvariants',
  'validateOfferSheetResolution',
  'isCapSpaceSigning',
] as const;

describe('capLegalityValidation import compatibility', () => {
  it('resolves named exports and default export via extensionless and explicit .js imports', async () => {
    const extensionless = await import(MODULE_BASE);
    const withJs = await import(`${MODULE_BASE}.js`);

    for (const exportName of EXPECTED_NAMED_EXPORTS) {
      expect(extensionless[exportName]).toBeDefined();
      expect(withJs[exportName]).toBe(extensionless[exportName]);
    }

    expect(withJs.default).toBe(extensionless.default);
    expect(Object.keys(extensionless.default)).toEqual(
      EXPECTED_DEFAULT_EXPORT_MEMBERS
    );

    for (const member of EXPECTED_DEFAULT_EXPORT_MEMBERS) {
      expect(extensionless.default[member]).toBe(extensionless[member]);
      expect(withJs.default[member]).toBe(withJs[member]);
    }
  });

  it('kept js file remains a pure compatibility shim', () => {
    const shimContent = fs.readFileSync(SHIM_PATH, 'utf8');

    expect(shimContent).toContain("export * from './capLegalityValidation.ts';");
    expect(shimContent).toContain(
      "export { default } from './capLegalityValidation.ts';"
    );
    expect(shimContent).not.toContain('export const HARD_BLOCK_RULES');
    expect(shimContent).not.toContain('export function validateSigning');
    expect(shimContent).not.toContain(
      'Room Exception unavailable above first apron'
    );
  });
});
