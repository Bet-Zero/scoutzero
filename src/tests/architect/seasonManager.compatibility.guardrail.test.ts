import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as seasonManagerModule from '@/features/architect/utils/seasonManager';
import * as seasonManagerLegacyModule from '@/features/architect/utils/seasonManagerLegacy';

describe('E95 seasonManager compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const seasonManagerShimPath = path.join(srcRoot, 'utils/seasonManager.js');
  const seasonManagerAuthorityPath = path.join(srcRoot, 'utils/seasonManager.ts');
  const seasonManagerLegacyAuthorityPath = path.join(
    srcRoot,
    'utils/seasonManagerLegacy.ts'
  );
  const seasonManagerAuthoritySpecifier =
    '../../features/architect/utils/seasonManager.ts';
  const seasonManagerLegacyAuthoritySpecifier =
    '../../features/architect/utils/seasonManagerLegacy.ts';
  const expectedAuthoritativeExports = [
    'advanceSeasonInWorld',
    'resolveDraftPickConveyanceForYear',
    'resolveDraftPickSwapsForYear',
  ] as const;
  const expectedLegacyExports = [
    'advanceSeasonLegacy',
    'processSeasonTransitionLegacy',
  ] as const;
  // Wave 4 Step 1: resolveDraftPickSwapsForYear and resolveDraftPickConveyanceForYear moved to
  // seasonManager.draftResolution.ts and re-exported here; only advanceSeasonInWorld is defined in the source
  const expectedAuthoritativeSourceOrder = [
    'advanceSeasonInWorld',
  ] as const;
  const expectedLegacySourceOrder = [
    'advanceSeasonLegacy',
    'processSeasonTransitionLegacy',
  ] as const;

  it('deletes the seasonManager.js compatibility shim', () => {
    expect(fs.existsSync(seasonManagerShimPath)).toBe(false);
  });

  it('extensionless imports expose the same authoritative API as the TS authority', async () => {
    // Compatibility invariant: every required canonical name still exists
    // on both surfaces and they reference the same function. Stage 6B:
    // later refactors split internal helpers into seasonManager.helpers.ts
    // which is re-exported via `export *`. Those re-exports are non-
    // breaking — callers never relied on the export surface being closed
    // — so accept any superset that still includes the required names.
    const authorityModule = await import(seasonManagerAuthoritySpecifier);

    const authorityKeys = new Set(Object.keys(authorityModule));
    const extensionlessKeys = new Set(Object.keys(seasonManagerModule));
    for (const name of expectedAuthoritativeExports) {
      expect(authorityKeys.has(name), `authority must export ${name}`).toBe(true);
      expect(
        extensionlessKeys.has(name),
        `extensionless module must export ${name}`
      ).toBe(true);
    }
    expect('default' in authorityModule).toBe(false);

    for (const exportName of expectedAuthoritativeExports) {
      expect(authorityModule[exportName]).toBe(seasonManagerModule[exportName]);
    }
  });

  it('extensionless imports expose the same legacy API as the TS legacy authority', async () => {
    const legacyAuthorityModule = await import(
      seasonManagerLegacyAuthoritySpecifier
    );

    expect(Object.keys(legacyAuthorityModule).sort()).toEqual(
      Array.from(expectedLegacyExports).sort()
    );
    expect(Object.keys(seasonManagerLegacyModule).sort()).toEqual(
      Array.from(expectedLegacyExports).sort()
    );
    expect('default' in legacyAuthorityModule).toBe(false);

    for (const exportName of expectedLegacyExports) {
      expect(legacyAuthorityModule[exportName]).toBe(
        seasonManagerLegacyModule[exportName]
      );
    }
  });

  it('seasonManager.ts preserves authoritative-only export order and has no default export', () => {
    const source = fs.readFileSync(seasonManagerAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedAuthoritativeSourceOrder));
    expect(source).not.toContain('export async function advanceSeason(');
    expect(source).not.toContain('export async function processSeasonTransition(');
    expect(source).not.toContain('export default');
  });

  it('seasonManagerLegacy.ts owns the renamed legacy export order and has no default export', () => {
    const source = fs.readFileSync(seasonManagerLegacyAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedLegacySourceOrder));
    expect(source).toContain('export async function advanceSeasonLegacy(');
    expect(source).toContain(
      'export async function processSeasonTransitionLegacy('
    );
    expect(source).not.toContain('export default');
  });
});
