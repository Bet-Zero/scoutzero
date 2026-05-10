/**
 * FILE: src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E111 shared contract pocket TS authorities after EditContractModal and shared contract-helper shim retirement.
 * OWNERSHIP: Feature: architect/shared-contract-pocket
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EditContractModal } from '@/shared/components/EditContractModal';
import * as EditContractModalModule from '@/shared/components/EditContractModal';
import * as ContractUtilsModule from '@/shared/utils/contracts/contractUtils';
import * as SeasonNormalizerModule from '@/shared/utils/contracts/seasonNormalizer';

describe('E111 shared contract pocket compatibility guardrails', () => {
  const sharedRoot = path.resolve(__dirname, '../../shared');
  const componentRoot = path.join(sharedRoot, 'components');
  const contractsRoot = path.join(sharedRoot, 'utils/contracts');
  const editContractModalTsxSpecifier =
    '../../shared/components/EditContractModal.tsx';
  const contractUtilsTsSpecifier = '../../shared/utils/contracts/contractUtils.ts';
  const seasonNormalizerTsSpecifier =
    '../../shared/utils/contracts/seasonNormalizer.ts';
  const expectedContractUtilsExports = [
    'getCurrentSeasonYear',
    'getYearsRemaining',
  ] as const;
  const expectedSeasonNormalizerExports = [
    'compareSeason',
    'isSeasonActive',
    'isSeasonExpired',
    'isSeasonFuture',
    'normalizeSeason',
    'seasonStartYear',
  ] as const;

  it('removes EditContractModal.jsx plus the retired shared contract helper shim paths', () => {
    expect(
      fs.existsSync(path.join(componentRoot, 'EditContractModal.jsx'))
    ).toBe(false);
    expect(fs.existsSync(path.join(contractsRoot, 'contractUtils.js'))).toBe(
      false
    );
    expect(fs.existsSync(path.join(contractsRoot, 'seasonNormalizer.js'))).toBe(
      false
    );
  });

  it('preserves EditContractModal default-only parity across extensionless and TSX authority imports', async () => {
    const explicitTsxModule = await import(editContractModalTsxSpecifier);

    expect(Object.keys(EditContractModalModule).sort()).toEqual([
      'default',
      'normalizeContractActionResult',
    ]);
    expect(Object.keys(explicitTsxModule).sort()).toEqual([
      'default',
      'normalizeContractActionResult',
    ]);
    expect(EditContractModalModule.default).toBe(EditContractModal);
    expect(explicitTsxModule.default).toBe(EditContractModal);
  });

  it('preserves contractUtils named-only parity across extensionless and TS authority imports', async () => {
    const explicitTsModule = await import(contractUtilsTsSpecifier);

    expect(Object.keys(ContractUtilsModule).sort()).toEqual(
      Array.from(expectedContractUtilsExports)
    );
    expect(Object.keys(explicitTsModule).sort()).toEqual(
      Array.from(expectedContractUtilsExports)
    );
    expect('default' in ContractUtilsModule).toBe(false);
    expect('default' in explicitTsModule).toBe(false);

    for (const exportName of expectedContractUtilsExports) {
      expect(explicitTsModule[exportName]).toBe(ContractUtilsModule[exportName]);
    }
  });

  it('preserves seasonNormalizer named-only parity across extensionless and TS authority imports', async () => {
    const explicitTsModule = await import(seasonNormalizerTsSpecifier);

    expect(Object.keys(SeasonNormalizerModule).sort()).toEqual(
      Array.from(expectedSeasonNormalizerExports)
    );
    expect(Object.keys(explicitTsModule).sort()).toEqual(
      Array.from(expectedSeasonNormalizerExports)
    );
    expect('default' in SeasonNormalizerModule).toBe(false);
    expect('default' in explicitTsModule).toBe(false);

    for (const exportName of expectedSeasonNormalizerExports) {
      expect(explicitTsModule[exportName]).toBe(
        SeasonNormalizerModule[exportName]
      );
    }
  });
});
