/**
 * FILE: src/tests/architect/teamLoader.compatibility.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E64 teamLoader TS authority + JS shim split.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-12: E64 - Added compatibility checks for teamLoader.ts authority and teamLoader.js shim.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as teamLoaderModule from '@/features/architect/utils/teamLoader';
import {
  getTeam,
  getLeague,
  getPlayer,
  mergePlayerOverride,
} from '@/features/architect/utils/teamLoader';

describe('E64 teamLoader compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const teamLoaderDeletedPath = path.join(srcRoot, 'utils/teamLoader.js');
  const teamLoaderAuthorityPath = path.join(srcRoot, 'utils/teamLoader.ts');

  it('teamLoader.js is absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(teamLoaderDeletedPath)).toBe(false);
  });

  it('extensionless import exposes the same named API as the surviving authority', () => {
    const source = fs.readFileSync(teamLoaderAuthorityPath, 'utf-8');

    expect(Object.keys(teamLoaderModule).sort()).toEqual([
      'getLeague',
      'getPlayer',
      'getTeam',
      'mergePlayerOverride',
    ]);
    expect(teamLoaderModule.getTeam).toBe(getTeam);
    expect(teamLoaderModule.getLeague).toBe(getLeague);
    expect(teamLoaderModule.getPlayer).toBe(getPlayer);
    expect(teamLoaderModule.mergePlayerOverride).toBe(mergePlayerOverride);
    expect(source).toContain('export async function getTeam');
    expect(source).toContain('export function mergePlayerOverride');
  });
});
