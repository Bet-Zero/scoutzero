import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import useCapValidation, {
  buildSigningGuardrails,
  useCapValidation as namedUseCapValidation,
} from '@/features/architect/hooks/useCapValidation';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';

describe('E71 architect contract/cap hook compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const playerRulesShimPath = path.join(srcRoot, 'hooks/usePlayerRulesProfiles.js');
  const capValidationShimPath = path.join(srcRoot, 'hooks/useCapValidation.js');

  it('usePlayerRulesProfiles.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(playerRulesShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './usePlayerRulesProfiles.ts';");
  });

  it('useCapValidation.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(capValidationShimPath, 'utf-8').trim();

    expect(source).toBe(
      "export * from './useCapValidation.ts';\nexport { default } from './useCapValidation.ts';"
    );
  });

  it('usePlayerRulesProfiles explicit .js import matches extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/hooks/usePlayerRulesProfiles.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'usePlayerRulesProfiles',
    ]);
    expect('default' in explicitJsModule).toBe(false);
    expect(explicitJsModule.usePlayerRulesProfiles).toBe(usePlayerRulesProfiles);
  });

  it('useCapValidation explicit .js import matches extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/hooks/useCapValidation.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'buildSigningGuardrails',
      'default',
      'useCapValidation',
    ]);
    expect('default' in explicitJsModule).toBe(true);
    expect(explicitJsModule.buildSigningGuardrails).toBe(buildSigningGuardrails);
    expect(explicitJsModule.useCapValidation).toBe(namedUseCapValidation);
    expect(explicitJsModule.default).toBe(useCapValidation);
  });
});
