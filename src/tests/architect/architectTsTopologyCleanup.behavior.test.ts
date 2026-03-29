/**
 * FILE: src/tests/architect/architectTsTopologyCleanup.behavior.test.ts
 * PURPOSE: Runtime continuity proof for the Architect shared-barrel TS topology cleanup pass.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: Added export-surface and caller-import continuity proof for the shared filters/contracts barrel cleanup.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');

const filtersBarrelSpecifier = '@/shared/components/ui/filters';
const filtersAuthoritySpecifier = '../../shared/components/ui/filters/index.ts';
const filtersCompatSpecifier = '../../shared/components/ui/filters/index.js';
const multiSelectAuthoritySpecifier =
  '../../shared/components/ui/filters/MultiSelectFilter.tsx';

const contractsBarrelSpecifier = '@/shared/utils/contracts';
const contractsAuthoritySpecifier = '../../shared/utils/contracts/index.ts';
const contractsCompatSpecifier = '../../shared/utils/contracts/index.js';
const contractUtilsAuthoritySpecifier =
  '../../shared/utils/contracts/contractUtils.ts';
const seasonNormalizerAuthoritySpecifier =
  '../../shared/utils/contracts/seasonNormalizer.ts';
const contractParserAuthoritySpecifier =
  '../../shared/utils/contracts/contractParser.ts';

const callerCases = [
  {
    label: 'FreeAgencyFilterBar',
    filePath:
      'src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx',
    expectedSpecifier: filtersBarrelSpecifier,
    exportName: 'FreeAgencyFilterBar',
    moduleSpecifier:
      '../../features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx',
    timeout: 5000,
  },
  {
    label: 'TradeExportCapture',
    filePath: 'src/features/architect/tradeMachine/TradeExportCapture.tsx',
    expectedSpecifier: contractsBarrelSpecifier,
    exportName: 'default',
    moduleSpecifier:
      '../../features/architect/tradeMachine/TradeExportCapture.tsx',
    timeout: 15000,
  },
] as const;

describe('Architect TS topology cleanup behavior', () => {
  it('keeps the filters extensionless barrel export surface aligned with the TS authority', async () => {
    const extensionlessModule = await import(filtersBarrelSpecifier);
    const authorityModule = await import(filtersAuthoritySpecifier);
    const compatModule = await import(filtersCompatSpecifier);
    const multiSelectAuthority = await import(multiSelectAuthoritySpecifier);
    const expectedExportNames = [
      'BadgeFilterSelect',
      'MultiSelectFilter',
      'RangeSelector',
      'RoleChecklist',
    ];

    expect(Object.keys(extensionlessModule).sort()).toEqual(expectedExportNames);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedExportNames);
    expect(Object.keys(compatModule).sort()).toEqual(expectedExportNames);

    for (const exportName of expectedExportNames) {
      expect(extensionlessModule[exportName as keyof typeof extensionlessModule]).toBe(
        authorityModule[exportName as keyof typeof authorityModule]
      );
      expect(compatModule[exportName as keyof typeof compatModule]).toBe(
        authorityModule[exportName as keyof typeof authorityModule]
      );
    }

    expect(extensionlessModule.MultiSelectFilter).toBe(
      multiSelectAuthority.default
    );
  });

  it('keeps the contracts extensionless barrel export surface aligned with the TS authority', async () => {
    const extensionlessModule = await import(contractsBarrelSpecifier);
    const authorityModule = await import(contractsAuthoritySpecifier);
    const compatModule = await import(contractsCompatSpecifier);
    const contractUtilsAuthority = await import(contractUtilsAuthoritySpecifier);
    const seasonNormalizerAuthority = await import(
      seasonNormalizerAuthoritySpecifier
    );
    const contractParserAuthority = await import(contractParserAuthoritySpecifier);
    const expectedExportNames = [
      'compareSeason',
      'getCurrentSeasonYear',
      'getYearsRemaining',
      'isSeasonActive',
      'isSeasonExpired',
      'isSeasonFuture',
      'normalizeSeason',
      'parseContractSituation',
      'seasonStartYear',
    ];

    expect(Object.keys(extensionlessModule).sort()).toEqual(expectedExportNames);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedExportNames);
    expect(Object.keys(compatModule).sort()).toEqual(expectedExportNames);

    for (const exportName of expectedExportNames) {
      expect(extensionlessModule[exportName as keyof typeof extensionlessModule]).toBe(
        authorityModule[exportName as keyof typeof authorityModule]
      );
      expect(compatModule[exportName as keyof typeof compatModule]).toBe(
        authorityModule[exportName as keyof typeof authorityModule]
      );
    }

    expect(extensionlessModule.getCurrentSeasonYear).toBe(
      contractUtilsAuthority.getCurrentSeasonYear
    );
    expect(extensionlessModule.normalizeSeason).toBe(
      seasonNormalizerAuthority.normalizeSeason
    );
    expect(extensionlessModule.parseContractSituation).toBe(
      contractParserAuthority.parseContractSituation
    );
  });

  for (const callerCase of callerCases) {
    it(`keeps ${callerCase.label} on the expected extensionless barrel specifier`, () => {
      const source = fs.readFileSync(path.join(repoRoot, callerCase.filePath), 'utf-8');
      expect(source).toContain(`from '${callerCase.expectedSpecifier}'`);
    });

    it(`keeps ${callerCase.label} importable after the topology cleanup`, async () => {
      const module = await import(callerCase.moduleSpecifier);
      expect(
        module[callerCase.exportName as keyof typeof module]
      ).toBeTruthy();
    }, callerCase.timeout);
  }
});
