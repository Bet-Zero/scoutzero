/**
 * FILE: src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E111 shared contract pocket TS authorities and JS/JSX shims.
 * OWNERSHIP: Feature: architect/shared-contract-pocket
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import EditContractModal from '@/shared/components/EditContractModal';
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

  it('keeps each JS/JSX file as a pure compatibility shim', () => {
    const editContractModalShim = fs
      .readFileSync(path.join(componentRoot, 'EditContractModal.jsx'), 'utf-8')
      .trim();
    const contractUtilsShim = fs
      .readFileSync(path.join(contractsRoot, 'contractUtils.js'), 'utf-8')
      .trim();
    const seasonNormalizerShim = fs
      .readFileSync(path.join(contractsRoot, 'seasonNormalizer.js'), 'utf-8')
      .trim();

    expect(editContractModalShim).toBe(
      "export { default } from './EditContractModal.tsx';"
    );
    expect(contractUtilsShim).toBe("export * from './contractUtils.ts';");
    expect(seasonNormalizerShim).toBe("export * from './seasonNormalizer.ts';");
  });

  it('preserves EditContractModal default-only parity across extensionless, JSX shim, and TSX authority imports', async () => {
    const explicitJsxModule = await import(
      '../../shared/components/EditContractModal.jsx'
    );
    const explicitTsxModule = await import(editContractModalTsxSpecifier);

    expect(Object.keys(EditContractModalModule)).toEqual(['default']);
    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(Object.keys(explicitTsxModule)).toEqual(['default']);
    expect(EditContractModalModule.default).toBe(EditContractModal);
    expect(explicitJsxModule.default).toBe(EditContractModal);
    expect(explicitTsxModule.default).toBe(EditContractModal);
  });

  it('preserves contractUtils named-only parity across extensionless, JS shim, and TS authority imports', async () => {
    const explicitJsModule = await import(
      '../../shared/utils/contracts/contractUtils.js'
    );
    const explicitTsModule = await import(contractUtilsTsSpecifier);

    expect(Object.keys(ContractUtilsModule).sort()).toEqual(
      Array.from(expectedContractUtilsExports)
    );
    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedContractUtilsExports)
    );
    expect(Object.keys(explicitTsModule).sort()).toEqual(
      Array.from(expectedContractUtilsExports)
    );
    expect('default' in ContractUtilsModule).toBe(false);
    expect('default' in explicitJsModule).toBe(false);
    expect('default' in explicitTsModule).toBe(false);

    for (const exportName of expectedContractUtilsExports) {
      expect(explicitJsModule[exportName]).toBe(ContractUtilsModule[exportName]);
      expect(explicitTsModule[exportName]).toBe(ContractUtilsModule[exportName]);
    }
  });

  it('preserves seasonNormalizer named-only parity across extensionless, JS shim, and TS authority imports', async () => {
    const explicitJsModule = await import(
      '../../shared/utils/contracts/seasonNormalizer.js'
    );
    const explicitTsModule = await import(seasonNormalizerTsSpecifier);

    expect(Object.keys(SeasonNormalizerModule).sort()).toEqual(
      Array.from(expectedSeasonNormalizerExports)
    );
    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedSeasonNormalizerExports)
    );
    expect(Object.keys(explicitTsModule).sort()).toEqual(
      Array.from(expectedSeasonNormalizerExports)
    );
    expect('default' in SeasonNormalizerModule).toBe(false);
    expect('default' in explicitJsModule).toBe(false);
    expect('default' in explicitTsModule).toBe(false);

    for (const exportName of expectedSeasonNormalizerExports) {
      expect(explicitJsModule[exportName]).toBe(
        SeasonNormalizerModule[exportName]
      );
      expect(explicitTsModule[exportName]).toBe(
        SeasonNormalizerModule[exportName]
      );
    }
  });
});
