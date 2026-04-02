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
  const expectedAuthoritativeSourceOrder = [
    'advanceSeasonInWorld',
    'resolveDraftPickSwapsForYear',
    'resolveDraftPickConveyanceForYear',
  ] as const;
  const expectedLegacySourceOrder = [
    'advanceSeasonLegacy',
    'processSeasonTransitionLegacy',
  ] as const;

  it('deletes the seasonManager.js compatibility shim', () => {
    expect(fs.existsSync(seasonManagerShimPath)).toBe(false);
  });

  it('extensionless imports expose the same authoritative API as the TS authority', async () => {
    const authorityModule = await import(seasonManagerAuthoritySpecifier);

    expect(Object.keys(authorityModule).sort()).toEqual(
      Array.from(expectedAuthoritativeExports).sort()
    );
    expect(Object.keys(seasonManagerModule).sort()).toEqual(
      Array.from(expectedAuthoritativeExports).sort()
    );
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
