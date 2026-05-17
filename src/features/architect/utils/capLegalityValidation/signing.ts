/**
 * FILE: src/features/architect/utils/capLegalityValidation/signing.ts
 * PURPOSE: Signing validation helpers and validateSigning — extracted from capLegalityValidation.ts (Wave 4 Step 2c).
 * OWNERSHIP: Feature: architect/core
 */


// Wave 31 Step 1: primitive helpers extracted to submodule
export * from './signing.helpers';
// Wave 31 Step 2: validation functions extracted to submodule
export * from './signing.validators';
// Wave 7 Step 4: contract row schema validators extracted to submodule
export * from './signing.contractValidators';


// Wave 7 Step 5: signing terms builders extracted to submodule
export * from './signing.terms';
// Wave 10 Step 2: validateSigning orchestrator extracted to submodule
export * from './signing.validate';
// Wave 10 Step 1: offer-sheet resolution extracted to submodule
export * from './signing.offerSheetResolution';
