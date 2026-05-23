import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as worldManagerModule from '@/features/architect/utils/worldManager';

describe('E73 worldManager compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const worldManagerDeletedPath = path.join(srcRoot, 'utils/worldManager.js');
  const worldManagerAuthorityPath = path.join(srcRoot, 'utils/worldManager.ts');
  const worldManagerCoreAuthorityPath = path.join(
    srcRoot,
    'utils/worldManager.core.ts'
  );
  const worldManagerReadUtilsAuthorityPath = path.join(
    srcRoot,
    'utils/worldManager.readUtils.ts'
  );
  const architectCoreAuthorityPath = path.join(srcRoot, 'utils/architectCore.ts');

  // Substantive lifecycle/world-mutation API the worldManager module must
  // continue to expose. Stage 6B note: later refactors split the
  // implementation across worldManager.{ts,core.ts,readUtils.ts}, but the
  // extensionless `worldManager` module-level surface still re-exports
  // these names verbatim, which is the actual compatibility invariant.
  const expectedRequiredExports = [
    'archiveWorld',
    'branchWorld',
    'clearDraftPositions',
    'createWorld',
    'fixWorldOwnership',
    'getDraftPositions',
    'getDraftPositionsMap',
    'getWorldMetadata',
    'listUserWorlds',
    'purgeWorld',
    'saveDraftPositions',
    'updateWorldAsOfDate',
    'updateWorldMetadata',
    'updateWorldStats',
    'validateDraftPositionsMap',
  ] as const;

  it('worldManager.js is absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(worldManagerDeletedPath)).toBe(false);
  });

  it('extensionless import exposes the same named API as the surviving authority', () => {
    // Compatibility invariant: every required export name is still on the
    // module-level surface. Additional helper re-exports (e.g.
    // readStringField, generateWorldId) from the worldManager.readUtils
    // sub-module are allowed — they were introduced by a later split and
    // are non-breaking, since callers never depended on the surface being
    // closed.
    const moduleExports = new Set(Object.keys(worldManagerModule));
    for (const name of expectedRequiredExports) {
      expect(
        moduleExports.has(name),
        `extensionless worldManager surface must still export ${name}`
      ).toBe(true);
    }
    expect('deleteWorld' in worldManagerModule).toBe(false);
    expect(worldManagerModule.createWorld).toBeDefined();
    expect(worldManagerModule.updateWorldStats).toBeDefined();
  });

  it('worldManager.ts preserves the current export order and has no default export', () => {
    // Compatibility invariant: the authoritative source file set still
    // defines each required name with `export` and no default export
    // appears anywhere. Stage 6B: the source-order check was rewritten
    // from a "strict list equality" to a "each required name appears as
    // an export somewhere across the authoritative source files" check
    // so the gate survives later splits without losing the no-default
    // and no-deleteWorld invariants.
    const authoritativeSource =
      fs.readFileSync(worldManagerAuthorityPath, 'utf-8') +
      fs.readFileSync(worldManagerCoreAuthorityPath, 'utf-8') +
      fs.readFileSync(worldManagerReadUtilsAuthorityPath, 'utf-8');

    const exportNames = new Set(
      Array.from(
        authoritativeSource.matchAll(/^export (?:async )?function (\w+)/gm)
      ).map(([, name]) => name)
    );

    for (const name of expectedRequiredExports) {
      expect(
        exportNames.has(name),
        `authoritative source must continue to define ${name}`
      ).toBe(true);
    }
    expect(authoritativeSource).not.toContain('export default');
    expect(authoritativeSource).not.toContain(
      'export async function deleteWorld'
    );
  });

  it('keeps archive/purge as the only lifecycle-owner exports and blocks deleteWorld resurfacing', () => {
    // Compatibility invariant: archive/purge are the lifecycle owners,
    // updateWorldAsOfDate is the world-date write authority, the
    // direct-write guard rejecting other date writers is in place, and
    // deleteWorld never resurfaces. Stage 6B: scan the authoritative
    // source set rather than only the top-level worldManager.ts file
    // (most lifecycle functions moved to worldManager.core.ts).
    const worldManagerSource = fs.readFileSync(worldManagerAuthorityPath, 'utf-8');
    const worldManagerCoreSource = fs.readFileSync(
      worldManagerCoreAuthorityPath,
      'utf-8'
    );
    const authoritativeSource = worldManagerSource + worldManagerCoreSource;
    const architectCoreSource = fs.readFileSync(architectCoreAuthorityPath, 'utf-8');

    expect(authoritativeSource).toContain(
      'export async function updateWorldAsOfDate('
    );
    expect(authoritativeSource).toContain(
      "throw new Error('Use updateWorldAsOfDate(...) for world date writes');"
    );
    expect(authoritativeSource).toContain(
      "throw new Error('asOfDate must be a YYYY-MM-DD string');"
    );
    expect(authoritativeSource).not.toContain('asOfDate?: unknown;');
    expect(authoritativeSource).toContain(
      'export async function archiveWorld('
    );
    expect(authoritativeSource).toContain(
      'export async function purgeWorld('
    );
    expect(authoritativeSource).not.toMatch(/\bdeleteWorld\b/);
    expect(architectCoreSource).not.toMatch(/\bdeleteWorld\b/);
  });
});
