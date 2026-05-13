/**
 * FILE: src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx
 * PURPOSE: Narrow compatibility proof for the highest-risk shim/export surfaces in the grouped 33-file TS migration.
 * OWNERSHIP: Feature: architect/trade-machine
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getCapPercentage } from '@/features/architect/utils/basicArchitectUtils';
import * as basicArchitectUtilsModule from '@/features/architect/utils/basicArchitectUtils';
import playerRulesProfileTypes from '@/features/architect/utils/playerRulesProfile/types';
import {
  DEV_OFFSEASON_PREVIEW_FLAG,
  OffseasonSection,
} from '@/features/architect/GMDashboard/sections/OffseasonSection';
import { ContractEditorModal } from '@/features/architect/contract/ContractEditorModal/ContractEditorModal';
import {
  ValidationCache,
  validationCache,
} from '@/features/architect/utils/tradeMachine/cache/validationCache';
import { debug as tradeDebug } from '@/features/architect/utils/tradeMachine/engine/tradeDebug';

describe('Grouped 33-file scope compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const basicArchitectUtilsAuthoritySpecifier =
    '../../features/architect/utils/basicArchitectUtils.ts';
  const playerRulesProfileTypesAuthoritySpecifier =
    '../../features/architect/utils/playerRulesProfile/types.ts';
  const offseasonSectionExtensionlessSpecifier =
    '../../features/architect/GMDashboard/sections/OffseasonSection';
  const offseasonSectionAuthoritySpecifier =
    '../../features/architect/GMDashboard/sections/OffseasonSection.tsx';
  const contractEditorModalAuthoritySpecifier =
    '../../features/architect/contract/ContractEditorModal/ContractEditorModal.tsx';
  const validationCacheExtensionlessSpecifier =
    '@/features/architect/utils/tradeMachine/cache/validationCache';
  const validationCacheAuthoritySpecifier =
    '../../features/architect/utils/tradeMachine/cache/validationCache.ts';
  const tradeDebugExtensionlessSpecifier =
    '@/features/architect/utils/tradeMachine/engine/tradeDebug';
  const tradeDebugAuthoritySpecifier =
    '../../features/architect/utils/tradeMachine/engine/tradeDebug.ts';
  const readSource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8').trim();

  it('deletes the retired basicArchitectUtils.js and playerRulesProfile/types.js shims', () => {
    expect(
      fs.existsSync(path.join(srcRoot, 'utils/basicArchitectUtils.js'))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(srcRoot, 'utils/playerRulesProfile/types.js'))
    ).toBe(false);
  });

  it('deletes the ContractEditorModal.jsx compatibility shim', () => {
    expect(
      fs.existsSync(path.join(srcRoot, 'contract/ContractEditorModal/ContractEditorModal.jsx'))
    ).toBe(false);
  });

  it('deletes the OffseasonSection.jsx compatibility shim', () => {
    expect(
      fs.existsSync(
        path.join(srcRoot, 'GMDashboard/sections/OffseasonSection.jsx')
      )
    ).toBe(false);
  });

  it('deletes the tradeDebug.js compatibility shim', () => {
    expect(
      fs.existsSync(path.join(srcRoot, 'utils/tradeMachine/engine/tradeDebug.js'))
    ).toBe(false);
  });

  it('deletes the validationCache.js compatibility shim', () => {
    expect(
      fs.existsSync(
        path.join(srcRoot, 'utils/tradeMachine/cache/validationCache.js')
      )
    ).toBe(false);
  });

  // updated: Wave 3 export-shape change — basicArchitectUtils is now named-only (see commits 10f5fed7, 692f4f8a)
  it('preserves basicArchitectUtils named export parity across extensionless and authority imports', async () => {
    const authorityModule = await import(basicArchitectUtilsAuthoritySpecifier);
    const expectedKeys = [
      'CBA_MECHANICS',
      'attachDefaultPicks',
      'generateDefaultPicks',
      'getCapPercentage',
      'markHardCapTriggered',
    ];

    expect(Object.keys(basicArchitectUtilsModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedKeys);
    expect(basicArchitectUtilsModule.getCapPercentage).toBe(getCapPercentage);
    expect(authorityModule.getCapPercentage).toBe(getCapPercentage);

    for (const exportName of expectedKeys) {
      const tsModuleRecord = basicArchitectUtilsModule as Record<string, unknown>;
      const authorityRecord = authorityModule as Record<string, unknown>;
      expect(authorityRecord[exportName]).toBe(
        tsModuleRecord[exportName]
      );
    }
  });

  it('preserves playerRulesProfile/types as a default-only documentation module', async () => {
    const authorityModule = await import(playerRulesProfileTypesAuthoritySpecifier);
    const authoritySource = fs.readFileSync(
      path.join(srcRoot, 'utils/playerRulesProfile/types.ts'),
      'utf-8'
    );

    expect(Object.keys(authorityModule)).toEqual(['default']);
    expect(authorityModule.default).toBe(playerRulesProfileTypes);
    expect(authoritySource).toContain('@typedef {Object} PlayerRulesProfile');
    expect(authoritySource).toContain('export default {};');
  });

  it('preserves OffseasonSection named export parity across extensionless and authority imports', async () => {
    const extensionlessModule = await import(offseasonSectionExtensionlessSpecifier);
    const authorityModule = await import(offseasonSectionAuthoritySpecifier);
    const expectedKeys = ['DEV_OFFSEASON_PREVIEW_FLAG', 'OffseasonSection'];

    expect(Object.keys(extensionlessModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedKeys);
    expect(extensionlessModule.DEV_OFFSEASON_PREVIEW_FLAG).toBe(
      DEV_OFFSEASON_PREVIEW_FLAG
    );
    expect(authorityModule.DEV_OFFSEASON_PREVIEW_FLAG).toBe(
      DEV_OFFSEASON_PREVIEW_FLAG
    );
    expect(extensionlessModule.OffseasonSection).toBe(OffseasonSection);
    expect(authorityModule.OffseasonSection).toBe(OffseasonSection);
    expect('default' in extensionlessModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
  });

  it('preserves ContractEditorModal default-only parity across extensionless and authority imports', async () => {
    const authorityModule = await import(contractEditorModalAuthoritySpecifier);

    expect(Object.keys(authorityModule)).toEqual(['default']);
    expect(authorityModule.default).toBe(ContractEditorModal);
  });

  it('preserves validationCache named export parity across extensionless and authority imports', async () => {
    const extensionlessModule = await import(validationCacheExtensionlessSpecifier);
    const authorityModule = await import(validationCacheAuthoritySpecifier);
    const expectedKeys = ['ValidationCache', 'validationCache'];

    expect(Object.keys(extensionlessModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedKeys);
    expect(extensionlessModule.ValidationCache).toBe(ValidationCache);
    expect(extensionlessModule.validationCache).toBe(validationCache);
    expect(authorityModule.ValidationCache).toBe(ValidationCache);
    expect(authorityModule.validationCache).toBe(validationCache);
    expect('default' in extensionlessModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
  });

  it('preserves tradeDebug default-only parity across extensionless and authority imports', async () => {
    const extensionlessModule = await import(tradeDebugExtensionlessSpecifier);
    const authorityModule = await import(tradeDebugAuthoritySpecifier);

    expect(Object.keys(extensionlessModule)).toEqual(['default']);
    expect(Object.keys(authorityModule)).toEqual(['default']);
    expect(extensionlessModule.default).toBe(tradeDebug);
    expect(authorityModule.default).toBe(tradeDebug);
  });
});
