import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as seasonManagerModule from '@/features/architect/utils/seasonManager';

describe('E95 seasonManager compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const seasonManagerShimPath = path.join(srcRoot, 'utils/seasonManager.js');
  const seasonManagerAuthorityPath = path.join(srcRoot, 'utils/seasonManager.ts');
  const expectedExports = [
    'advanceSeason',
    'advanceSeasonInWorld',
    'processSeasonTransition',
    'resolveDraftPickConveyanceForYear',
    'resolveDraftPickSwapsForYear',
  ] as const;
  const expectedSourceOrder = [
    'advanceSeason',
    'processSeasonTransition',
    'advanceSeasonInWorld',
    'resolveDraftPickSwapsForYear',
    'resolveDraftPickConveyanceForYear',
  ] as const;

  it('seasonManager.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(seasonManagerShimPath, 'utf-8').trim();

    expect(source).toBe(
      "// Phase E95 compatibility shim. Authoritative implementation lives in ./seasonManager.ts.\nexport * from './seasonManager.ts';"
    );
  });

  it('explicit .js import exposes the same named API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/seasonManager.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedExports).sort()
    );
    expect(Object.keys(seasonManagerModule).sort()).toEqual(
      Array.from(expectedExports).sort()
    );
    expect('default' in explicitJsModule).toBe(false);

    for (const exportName of expectedExports) {
      expect(explicitJsModule[exportName]).toBe(seasonManagerModule[exportName]);
    }
  });

  it('seasonManager.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(seasonManagerAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedSourceOrder));
    expect(source).not.toContain('export default');
  });
});
