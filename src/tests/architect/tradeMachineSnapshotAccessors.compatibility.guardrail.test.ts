/**
 * FILE: src/tests/architect/tradeMachineSnapshotAccessors.compatibility.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E69 Trade Machine snapshot/accessor TS authorities and JS shims.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-12: E69 - Added compatibility checks for snapshot/accessor TS authorities and JS shims.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  computeRemainingRoom,
  getDisplayAllowableIncoming,
  getOfficialSalaryMatchingSnapshot,
  getOfficialSnapshotByIndex,
  getOfficialSnapshotByTeamId,
} from '@/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot';
import {
  getTeamSnapshot,
  getTeamSnapshotByIndex,
  getTradeSnapshot,
} from '@/features/architect/hooks/useTradeMachineSnapshot';

describe('E69 Trade Machine snapshot/accessor compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const selectorDeletedPath = path.join(
    srcRoot,
    'tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js'
  );
  const accessorShimPath = path.join(srcRoot, 'hooks/useTradeMachineSnapshot.js');
  const selectorAuthorityPath = path.join(
    srcRoot,
    'tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts'
  );

  it('getOfficialSalaryMatchingSnapshot.js is absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(selectorDeletedPath)).toBe(false);
  });

  it('useTradeMachineSnapshot.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(accessorShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './useTradeMachineSnapshot.ts';");
  });

  it('selector authority still exposes the same named API through extensionless imports', () => {
    const source = fs.readFileSync(selectorAuthorityPath, 'utf-8');
    const extensionlessApi = {
      computeRemainingRoom,
      getDisplayAllowableIncoming,
      getOfficialSalaryMatchingSnapshot,
      getOfficialSnapshotByIndex,
      getOfficialSnapshotByTeamId,
    };

    expect(Object.keys(extensionlessApi).sort()).toEqual([
      'computeRemainingRoom',
      'getDisplayAllowableIncoming',
      'getOfficialSalaryMatchingSnapshot',
      'getOfficialSnapshotByIndex',
      'getOfficialSnapshotByTeamId',
    ]);
    expect(source).toContain('export function getOfficialSalaryMatchingSnapshot');
    expect(source).toContain('export function getDisplayAllowableIncoming');
    expect(source).toContain('export function computeRemainingRoom');
  });

  it('accessor explicit .js import exposes the same named API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/hooks/useTradeMachineSnapshot.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'getTeamSnapshot',
      'getTeamSnapshotByIndex',
      'getTradeSnapshot',
    ]);
    expect('default' in explicitJsModule).toBe(false);
    expect(explicitJsModule.getTeamSnapshot).toBe(getTeamSnapshot);
    expect(explicitJsModule.getTeamSnapshotByIndex).toBe(getTeamSnapshotByIndex);
    expect(explicitJsModule.getTradeSnapshot).toBe(getTradeSnapshot);
  });
});
