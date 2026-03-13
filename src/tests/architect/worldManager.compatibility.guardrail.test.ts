import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as worldManagerModule from '@/features/architect/utils/worldManager';

describe('E73 worldManager compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const worldManagerShimPath = path.join(srcRoot, 'utils/worldManager.js');
  const worldManagerAuthorityPath = path.join(srcRoot, 'utils/worldManager.ts');
  const expectedExports = [
    'archiveWorld',
    'branchWorld',
    'clearDraftPositions',
    'createWorld',
    'deleteWorld',
    'fixWorldOwnership',
    'getDraftPositions',
    'getDraftPositionsMap',
    'getWorldMetadata',
    'listUserWorlds',
    'purgeWorld',
    'saveDraftPositions',
    'updateWorldMetadata',
    'updateWorldStats',
    'validateDraftPositionsMap',
  ] as const;
  const expectedSourceOrder = [
    'createWorld',
    'getWorldMetadata',
    'listUserWorlds',
    'updateWorldMetadata',
    'archiveWorld',
    'deleteWorld',
    'purgeWorld',
    'branchWorld',
    'updateWorldStats',
    'getDraftPositions',
    'getDraftPositionsMap',
    'validateDraftPositionsMap',
    'saveDraftPositions',
    'clearDraftPositions',
    'fixWorldOwnership',
  ] as const;

  it('worldManager.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(worldManagerShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './worldManager.ts';");
  });

  it('explicit .js import exposes the same named API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/worldManager.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedExports)
    );
    expect(Object.keys(worldManagerModule).sort()).toEqual(
      Array.from(expectedExports)
    );
    expect('default' in explicitJsModule).toBe(false);

    for (const exportName of expectedExports) {
      expect(explicitJsModule[exportName]).toBe(worldManagerModule[exportName]);
    }
  });

  it('worldManager.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(worldManagerAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:async )?function (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedSourceOrder));
    expect(source).not.toContain('export default');
  });
});
