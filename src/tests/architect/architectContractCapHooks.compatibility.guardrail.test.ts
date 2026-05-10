import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  useCapValidation,
  buildSigningGuardrails,
  useCapValidation as namedUseCapValidation,
} from '@/features/architect/hooks/useCapValidation';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';

describe('E71 architect contract/cap hook compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const playerRulesShimPath = path.join(srcRoot, 'hooks/usePlayerRulesProfiles.js');
  const capValidationShimPath = path.join(srcRoot, 'hooks/useCapValidation.js');

  it('usePlayerRulesProfiles.js shim has been deleted (TS authority owns the surface)', () => {
    expect(fs.existsSync(playerRulesShimPath)).toBe(false);
  });

  it('useCapValidation.js shim has been deleted (TS authority owns the surface)', () => {
    expect(fs.existsSync(capValidationShimPath)).toBe(false);
  });

  it('usePlayerRulesProfiles TS authority exports the expected API', () => {
    expect(typeof usePlayerRulesProfiles).toBe('function');
  });

  it('useCapValidation TS authority exports the expected API', () => {
    expect(typeof useCapValidation).toBe('function');
    expect(typeof buildSigningGuardrails).toBe('function');
    expect(typeof namedUseCapValidation).toBe('function');
  });
});
