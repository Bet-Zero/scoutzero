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
import {
  getTeam,
  getLeague,
  getPlayer,
  mergePlayerOverride,
} from '@/features/architect/utils/teamLoader';

describe('E64 teamLoader compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const teamLoaderShimPath = path.join(srcRoot, 'utils/teamLoader.js');

  it('teamLoader.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(teamLoaderShimPath, 'utf-8');

    expect(source).toContain("export * from './teamLoader.ts';");
    expect(source).not.toContain('export async function getTeam');
    expect(source).not.toContain('mergeSalariesByYear');
    expect(source).not.toContain("'ATL'");
  });

  it('explicit .js import exposes the same named API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/teamLoader.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'getLeague',
      'getPlayer',
      'getTeam',
      'mergePlayerOverride',
    ]);
    expect('default' in explicitJsModule).toBe(false);
    expect(explicitJsModule.getTeam).toBe(getTeam);
    expect(explicitJsModule.getLeague).toBe(getLeague);
    expect(explicitJsModule.getPlayer).toBe(getPlayer);
    expect(explicitJsModule.mergePlayerOverride).toBe(mergePlayerOverride);
  });
});
