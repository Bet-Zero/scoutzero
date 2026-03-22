/**
 * FILE: src/tests/architect/sharedRuntimeBlockers.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the Architect shared runtime blocker TS authorities and current public import surfaces.
 * OWNERSHIP: Feature: architect/shared-runtime-blockers
 *
 * HISTORY:
 *  - 2026-03-20: Added focused compatibility proof for the six shared runtime blocker migrations.
 *  - 2026-03-22: Retargeted the guardrail away from obsolete shim-presence requirements to the current TS-authority standard.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const sharedRoot = path.resolve(__dirname, '../../shared');
const componentRoot = path.join(sharedRoot, 'components');
const contractsRoot = path.join(sharedRoot, 'utils/contracts');

const defaultModuleCases = [
  {
    label: 'TeamLogo',
    authorityPath: path.join(componentRoot, 'TeamLogo.tsx'),
    retiredShimPath: path.join(componentRoot, 'TeamLogo.jsx'),
    extensionlessSpecifier: '@/shared/components/TeamLogo',
    authoritySpecifier: '../../shared/components/TeamLogo.tsx',
  },
  {
    label: 'BirdRightsIcon',
    authorityPath: path.join(componentRoot, 'BirdRightsIcon.tsx'),
    retiredShimPath: path.join(componentRoot, 'BirdRightsIcon.jsx'),
    extensionlessSpecifier: '@/shared/components/BirdRightsIcon',
    authoritySpecifier: '../../shared/components/BirdRightsIcon.tsx',
  },
  {
    label: 'TeamSelectDropdown',
    authorityPath: path.join(componentRoot, 'TeamSelectDropdown.tsx'),
    retiredShimPath: path.join(componentRoot, 'TeamSelectDropdown.jsx'),
    extensionlessSpecifier: '@/shared/components/TeamSelectDropdown',
    authoritySpecifier: '../../shared/components/TeamSelectDropdown.tsx',
  },
  {
    label: 'MultiSelectFilter',
    authorityPath: path.join(componentRoot, 'ui/filters/MultiSelectFilter.tsx'),
    retiredShimPath: path.join(componentRoot, 'ui/filters/MultiSelectFilter.jsx'),
    extensionlessSpecifier: '@/shared/components/ui/filters/MultiSelectFilter',
    authoritySpecifier: '../../shared/components/ui/filters/MultiSelectFilter.tsx',
  },
] as const;

const namedModuleCases = [
  {
    label: 'Dialog',
    authorityPath: path.join(componentRoot, 'ui/Dialog.tsx'),
    retiredShimPath: path.join(componentRoot, 'ui/Dialog.jsx'),
    extensionlessSpecifier: '@/shared/components/ui/Dialog',
    authoritySpecifier: '../../shared/components/ui/Dialog.tsx',
    expectedExportNames: ['Dialog', 'DialogContent'],
  },
  {
    label: 'contractParser',
    authorityPath: path.join(contractsRoot, 'contractParser.ts'),
    retiredShimPath: path.join(contractsRoot, 'contractParser.js'),
    extensionlessSpecifier: '@/shared/utils/contracts/contractParser',
    authoritySpecifier: '../../shared/utils/contracts/contractParser.ts',
    expectedExportNames: ['parseContractSituation'],
  },
] as const;

describe('Architect shared runtime blocker compatibility guardrails', () => {
  it('tracks the exact 6-file migration scope', () => {
    expect(defaultModuleCases).toHaveLength(4);
    expect(namedModuleCases).toHaveLength(2);
  });

  for (const moduleCase of [...defaultModuleCases, ...namedModuleCases]) {
    it(`keeps ${moduleCase.label} TS authority present and retires the obsolete shim path`, () => {
      expect(fs.existsSync(moduleCase.authorityPath)).toBe(true);
      expect(fs.existsSync(moduleCase.retiredShimPath)).toBe(false);
    });
  }

  for (const moduleCase of defaultModuleCases) {
    it(`preserves ${moduleCase.label} default-only parity across extensionless and authority imports`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);

      expect(Object.keys(extensionlessModule)).toEqual(['default']);
      expect(Object.keys(authorityModule)).toEqual(['default']);
      expect(extensionlessModule.default).toBe(authorityModule.default);
    });
  }

  for (const moduleCase of namedModuleCases) {
    it(`preserves ${moduleCase.label} named export parity across extensionless and authority imports`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);
      const expectedExportNames = Array.from(moduleCase.expectedExportNames);

      expect(Object.keys(extensionlessModule).sort()).toEqual(
        expectedExportNames
      );
      expect(Object.keys(authorityModule).sort()).toEqual(expectedExportNames);
      expect('default' in extensionlessModule).toBe(false);
      expect('default' in authorityModule).toBe(false);

      for (const exportName of expectedExportNames) {
        const extensionlessRecord = extensionlessModule as Record<string, unknown>;
        const authorityRecord = authorityModule as Record<string, unknown>;

        expect(extensionlessRecord[exportName]).toBe(authorityRecord[exportName]);
      }
    });
  }
});
