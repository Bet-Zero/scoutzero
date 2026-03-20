import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_BASE = '@/features/architect/utils/capLegalityValidation';
const RETIRED_SHIM_PATH = path.resolve(
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
  it('resolves named exports and default export via extensionless and TS-authority imports after shim retirement', async () => {
    const extensionless = await import(MODULE_BASE);
    const authority = await import(`${MODULE_BASE}.ts`);

    for (const exportName of EXPECTED_NAMED_EXPORTS) {
      expect(extensionless[exportName]).toBeDefined();
      expect(authority[exportName]).toBe(extensionless[exportName]);
    }

    expect(authority.default).toBe(extensionless.default);
    expect(Object.keys(extensionless.default)).toEqual(
      EXPECTED_DEFAULT_EXPORT_MEMBERS
    );

    for (const member of EXPECTED_DEFAULT_EXPORT_MEMBERS) {
      expect(extensionless.default[member]).toBe(extensionless[member]);
      expect(authority.default[member]).toBe(authority[member]);
    }
  });

  it('retired js shim path is absent', () => {
    expect(fs.existsSync(RETIRED_SHIM_PATH)).toBe(false);
  });
});
