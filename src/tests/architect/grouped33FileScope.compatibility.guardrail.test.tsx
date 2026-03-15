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
import getCapPercentage, * as basicArchitectUtilsModule from '@/features/architect/utils/basicArchitectUtils';
import playerRulesProfileTypes from '@/features/architect/utils/playerRulesProfile/types';
import {
  DEV_OFFSEASON_PREVIEW_FLAG,
  OffseasonSection,
} from '@/features/architect/GMDashboard/sections/OffseasonSection';
import ContractEditorModal from '@/features/architect/contract/ContractEditorModal/ContractEditorModal';
import {
  ValidationCache,
  validationCache,
} from '@/features/architect/utils/tradeMachine/cache/validationCache';
import tradeDebug from '@/features/architect/utils/tradeMachine/engine/tradeDebug';
import * as basicArchitectUtilsJsModule from '../../features/architect/utils/basicArchitectUtils.js';
import * as playerRulesProfileTypesJsModule from '../../features/architect/utils/playerRulesProfile/types.js';
import * as OffseasonSectionJsxModule from '../../features/architect/GMDashboard/sections/OffseasonSection.jsx';
import * as ContractEditorModalJsxModule from '../../features/architect/contract/ContractEditorModal/ContractEditorModal.jsx';
import * as validationCacheJsModule from '../../features/architect/utils/tradeMachine/cache/validationCache.js';
import * as tradeDebugJsModule from '../../features/architect/utils/tradeMachine/engine/tradeDebug.js';

describe('Grouped 33-file scope compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const basicArchitectUtilsAuthoritySpecifier =
    '../../features/architect/utils/basicArchitectUtils.ts';
  const playerRulesProfileTypesAuthoritySpecifier =
    '../../features/architect/utils/playerRulesProfile/types.ts';
  const offseasonSectionAuthoritySpecifier =
    '../../features/architect/GMDashboard/sections/OffseasonSection.tsx';
  const contractEditorModalAuthoritySpecifier =
    '../../features/architect/contract/ContractEditorModal/ContractEditorModal.tsx';
  const validationCacheAuthoritySpecifier =
    '../../features/architect/utils/tradeMachine/cache/validationCache.ts';
  const tradeDebugAuthoritySpecifier =
    '../../features/architect/utils/tradeMachine/engine/tradeDebug.ts';
  const readSource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8').trim();

  it('keeps each high-risk legacy file as a pure shim', () => {
    expect(readSource('utils/basicArchitectUtils.js')).toBe(
      "export { default } from './basicArchitectUtils.ts';\nexport * from './basicArchitectUtils.ts';"
    );
    expect(readSource('utils/playerRulesProfile/types.js')).toBe(
      "export { default } from './types.ts';"
    );
    expect(
      readSource('GMDashboard/sections/OffseasonSection.jsx')
    ).toBe("export * from './OffseasonSection.tsx';");
    expect(
      readSource('contract/ContractEditorModal/ContractEditorModal.jsx')
    ).toBe("export { default } from './ContractEditorModal.tsx';");
    expect(
      readSource('utils/tradeMachine/cache/validationCache.js')
    ).toBe("export * from './validationCache.ts';");
    expect(
      readSource('utils/tradeMachine/engine/tradeDebug.js')
    ).toBe("export { default } from './tradeDebug.ts';");
  });

  it('preserves basicArchitectUtils mixed export parity across extensionless, shim, and authority imports', async () => {
    const authorityModule = await import(basicArchitectUtilsAuthoritySpecifier);
    const expectedKeys = [
      'CBA_MECHANICS',
      'attachDefaultPicks',
      'default',
      'generateDefaultPicks',
      'markHardCapTriggered',
    ];

    expect(Object.keys(basicArchitectUtilsModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(basicArchitectUtilsJsModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedKeys);
    expect(basicArchitectUtilsModule.default).toBe(getCapPercentage);
    expect(basicArchitectUtilsJsModule.default).toBe(getCapPercentage);
    expect(authorityModule.default).toBe(getCapPercentage);

    for (const exportName of expectedKeys.filter((key) => key !== 'default')) {
      expect(basicArchitectUtilsJsModule[exportName]).toBe(
        basicArchitectUtilsModule[exportName]
      );
      expect(authorityModule[exportName]).toBe(
        basicArchitectUtilsModule[exportName]
      );
    }
  });

  it('preserves playerRulesProfile/types as a default-only documentation module', async () => {
    const authorityModule = await import(playerRulesProfileTypesAuthoritySpecifier);
    const authoritySource = fs.readFileSync(
      path.join(srcRoot, 'utils/playerRulesProfile/types.ts'),
      'utf-8'
    );

    expect(Object.keys(playerRulesProfileTypesJsModule)).toEqual(['default']);
    expect(Object.keys(authorityModule)).toEqual(['default']);
    expect(playerRulesProfileTypesJsModule.default).toBe(playerRulesProfileTypes);
    expect(authorityModule.default).toBe(playerRulesProfileTypes);
    expect(authoritySource).toContain('@typedef {Object} PlayerRulesProfile');
    expect(authoritySource).toContain('export default {};');
  });

  it('preserves OffseasonSection named export parity across extensionless, shim, and authority imports', async () => {
    const authorityModule = await import(offseasonSectionAuthoritySpecifier);
    const expectedKeys = ['DEV_OFFSEASON_PREVIEW_FLAG', 'OffseasonSection'];

    expect(Object.keys(OffseasonSectionJsxModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedKeys);
    expect(OffseasonSectionJsxModule.DEV_OFFSEASON_PREVIEW_FLAG).toBe(
      DEV_OFFSEASON_PREVIEW_FLAG
    );
    expect(authorityModule.DEV_OFFSEASON_PREVIEW_FLAG).toBe(
      DEV_OFFSEASON_PREVIEW_FLAG
    );
    expect(OffseasonSectionJsxModule.OffseasonSection).toBe(OffseasonSection);
    expect(authorityModule.OffseasonSection).toBe(OffseasonSection);
    expect('default' in OffseasonSectionJsxModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
  });

  it('preserves ContractEditorModal default-only parity across extensionless, shim, and authority imports', async () => {
    const authorityModule = await import(contractEditorModalAuthoritySpecifier);

    expect(Object.keys(ContractEditorModalJsxModule)).toEqual(['default']);
    expect(Object.keys(authorityModule)).toEqual(['default']);
    expect(ContractEditorModalJsxModule.default).toBe(ContractEditorModal);
    expect(authorityModule.default).toBe(ContractEditorModal);
  });

  it('preserves validationCache named export parity across extensionless, shim, and authority imports', async () => {
    const authorityModule = await import(validationCacheAuthoritySpecifier);
    const expectedKeys = ['ValidationCache', 'validationCache'];

    expect(Object.keys(validationCacheJsModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedKeys);
    expect(validationCacheJsModule.ValidationCache).toBe(ValidationCache);
    expect(validationCacheJsModule.validationCache).toBe(validationCache);
    expect(authorityModule.ValidationCache).toBe(ValidationCache);
    expect(authorityModule.validationCache).toBe(validationCache);
    expect('default' in validationCacheJsModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
  });

  it('preserves tradeDebug default-only parity across extensionless, shim, and authority imports', async () => {
    const authorityModule = await import(tradeDebugAuthoritySpecifier);

    expect(Object.keys(tradeDebugJsModule)).toEqual(['default']);
    expect(Object.keys(authorityModule)).toEqual(['default']);
    expect(tradeDebugJsModule.default).toBe(tradeDebug);
    expect(authorityModule.default).toBe(tradeDebug);
  });
});
