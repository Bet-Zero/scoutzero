import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as worldManagerModule from '@/features/architect/utils/worldManager';

describe('E73 worldManager compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const worldManagerDeletedPath = path.join(srcRoot, 'utils/worldManager.js');
  const worldManagerAuthorityPath = path.join(srcRoot, 'utils/worldManager.ts');
  const expectedExports = [
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

  it('worldManager.js is absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(worldManagerDeletedPath)).toBe(false);
  });

  it('extensionless import exposes the same named API as the surviving authority', () => {
    expect(Object.keys(worldManagerModule).sort()).toEqual(
      Array.from(expectedExports)
    );
    expect(worldManagerModule.createWorld).toBeDefined();
    expect(worldManagerModule.updateWorldStats).toBeDefined();
  });

  it('worldManager.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(worldManagerAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:async )?function (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedSourceOrder));
    expect(source).not.toContain('export default');
    expect(source).not.toContain('export async function deleteWorld');
  });
});
