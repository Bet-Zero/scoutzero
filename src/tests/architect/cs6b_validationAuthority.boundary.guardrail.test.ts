import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const useCapValidationPath = path.join(
  repoRoot,
  'features/architect/hooks/useCapValidation.ts'
);
const editContractModalPath = path.join(
  repoRoot,
  'shared/components/EditContractModal.tsx'
);
// Stage 6B: EditContractModal was split into co-located helper/types
// modules. The validation-authority type/state builders moved to
// EditContractModal.helpers.ts and the type lives in
// EditContractModal.types.ts. Concatenate the trio so the source-scan
// invariants remain findable.
const editContractModalHelpersPath = path.join(
  repoRoot,
  'shared/components/EditContractModal.helpers.ts'
);
const editContractModalTypesPath = path.join(
  repoRoot,
  'shared/components/EditContractModal.types.ts'
);

const useCapValidationSource = fs.readFileSync(useCapValidationPath, 'utf8');
const editContractModalSource =
  fs.readFileSync(editContractModalPath, 'utf8') +
  (fs.existsSync(editContractModalHelpersPath)
    ? fs.readFileSync(editContractModalHelpersPath, 'utf8')
    : '') +
  (fs.existsSync(editContractModalTypesPath)
    ? fs.readFileSync(editContractModalTypesPath, 'utf8')
    : '');

describe('CS-6B validation authority boundary guardrails', () => {
  it('keeps authoritative preflight ownership out of useCapValidation', () => {
    expect(useCapValidationSource).not.toContain('signAndTradePreflight');
    expect(useCapValidationSource).not.toContain('offerSheetPreflight');
    expect(useCapValidationSource).not.toContain('isOfferSheet');
    expect(useCapValidationSource).not.toContain(
      'Authoritative sign-and-trade preflight is unavailable.'
    );
    expect(useCapValidationSource).not.toContain(
      'Authoritative offer sheet preflight is unavailable.'
    );
  });

  it('keeps EditContractModal split between advisory modal checks and authoritative preflight', () => {
    expect(editContractModalSource).toContain(
      "type ValidationAuthority = 'advisory-modal' | 'authoritative-preflight';"
    );
    expect(editContractModalSource).toContain(
      'buildAdvisoryModalValidationState'
    );
    expect(editContractModalSource).toContain(
      'buildAuthoritativePreflightState'
    );
    expect(editContractModalSource).toContain(
      "validationState.authority === 'advisory-modal'"
    );
    expect(editContractModalSource).toContain("disclosureTitle: 'Modal guardrails'");
    expect(editContractModalSource).toContain(
      "disclosureTitle: 'Authoritative preflight'"
    );
  });
});
