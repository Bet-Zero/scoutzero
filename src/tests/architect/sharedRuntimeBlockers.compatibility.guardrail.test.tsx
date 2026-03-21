/**
 * FILE: src/tests/architect/sharedRuntimeBlockers.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the Architect shared runtime blocker TS authorities and legacy shim surfaces.
 * OWNERSHIP: Feature: architect/shared-runtime-blockers
 *
 * HISTORY:
 *  - 2026-03-20: Added focused compatibility proof for the six shared runtime blocker migrations.
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
    shimPath: path.join(componentRoot, 'TeamLogo.jsx'),
    expectedShimSource: "export { default } from './TeamLogo.tsx';",
    extensionlessSpecifier: '@/shared/components/TeamLogo',
    authoritySpecifier: '../../shared/components/TeamLogo.tsx',
    explicitShimSpecifier: '../../shared/components/TeamLogo.jsx',
  },
  {
    label: 'BirdRightsIcon',
    shimPath: path.join(componentRoot, 'BirdRightsIcon.jsx'),
    expectedShimSource: "export { default } from './BirdRightsIcon.tsx';",
    extensionlessSpecifier: '@/shared/components/BirdRightsIcon',
    authoritySpecifier: '../../shared/components/BirdRightsIcon.tsx',
    explicitShimSpecifier: '../../shared/components/BirdRightsIcon.jsx',
  },
  {
    label: 'TeamSelectDropdown',
    shimPath: path.join(componentRoot, 'TeamSelectDropdown.jsx'),
    expectedShimSource: "export { default } from './TeamSelectDropdown.tsx';",
    extensionlessSpecifier: '@/shared/components/TeamSelectDropdown',
    authoritySpecifier: '../../shared/components/TeamSelectDropdown.tsx',
    explicitShimSpecifier: '../../shared/components/TeamSelectDropdown.jsx',
  },
  {
    label: 'MultiSelectFilter',
    shimPath: path.join(componentRoot, 'ui/filters/MultiSelectFilter.jsx'),
    expectedShimSource:
      "export { default } from './MultiSelectFilter.tsx';",
    extensionlessSpecifier: '@/shared/components/ui/filters/MultiSelectFilter',
    authoritySpecifier: '../../shared/components/ui/filters/MultiSelectFilter.tsx',
    explicitShimSpecifier: '../../shared/components/ui/filters/MultiSelectFilter.jsx',
  },
] as const;

const namedModuleCases = [
  {
    label: 'Dialog',
    shimPath: path.join(componentRoot, 'ui/Dialog.jsx'),
    expectedShimSource: "export * from './Dialog.tsx';",
    extensionlessSpecifier: '@/shared/components/ui/Dialog',
    authoritySpecifier: '../../shared/components/ui/Dialog.tsx',
    explicitShimSpecifier: '../../shared/components/ui/Dialog.jsx',
    expectedExportNames: ['Dialog', 'DialogContent'],
  },
  {
    label: 'contractParser',
    shimPath: path.join(contractsRoot, 'contractParser.js'),
    expectedShimSource: "export * from './contractParser.ts';",
    extensionlessSpecifier: '@/shared/utils/contracts/contractParser',
    authoritySpecifier: '../../shared/utils/contracts/contractParser.ts',
    explicitShimSpecifier: '../../shared/utils/contracts/contractParser.js',
    expectedExportNames: ['parseContractSituation'],
  },
] as const;

describe('Architect shared runtime blocker compatibility guardrails', () => {
  it('tracks the exact 6-file migration scope', () => {
    expect(defaultModuleCases).toHaveLength(4);
    expect(namedModuleCases).toHaveLength(2);
  });

  for (const moduleCase of [...defaultModuleCases, ...namedModuleCases]) {
    it(`keeps ${moduleCase.label} legacy file present as an exact shim`, () => {
      expect(fs.existsSync(moduleCase.shimPath)).toBe(true);
      expect(fs.readFileSync(moduleCase.shimPath, 'utf-8').trim()).toBe(
        moduleCase.expectedShimSource
      );
    });
  }

  for (const moduleCase of defaultModuleCases) {
    it(`preserves ${moduleCase.label} default-only parity across extensionless, authority, and explicit shim imports`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);
      const explicitShimModule = await import(moduleCase.explicitShimSpecifier);

      expect(Object.keys(extensionlessModule)).toEqual(['default']);
      expect(Object.keys(authorityModule)).toEqual(['default']);
      expect(Object.keys(explicitShimModule)).toEqual(['default']);
      expect(extensionlessModule.default).toBe(authorityModule.default);
      expect(explicitShimModule.default).toBe(authorityModule.default);
    });
  }

  for (const moduleCase of namedModuleCases) {
    it(`preserves ${moduleCase.label} named export parity across extensionless, authority, and explicit shim imports`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);
      const explicitShimModule = await import(moduleCase.explicitShimSpecifier);
      const expectedExportNames = Array.from(moduleCase.expectedExportNames);

      expect(Object.keys(extensionlessModule).sort()).toEqual(
        expectedExportNames
      );
      expect(Object.keys(authorityModule).sort()).toEqual(expectedExportNames);
      expect(Object.keys(explicitShimModule).sort()).toEqual(
        expectedExportNames
      );
      expect('default' in extensionlessModule).toBe(false);
      expect('default' in authorityModule).toBe(false);
      expect('default' in explicitShimModule).toBe(false);

      for (const exportName of expectedExportNames) {
        const extensionlessRecord = extensionlessModule as Record<string, unknown>;
        const authorityRecord = authorityModule as Record<string, unknown>;
        const explicitShimRecord = explicitShimModule as Record<string, unknown>;

        expect(extensionlessRecord[exportName]).toBe(authorityRecord[exportName]);
        expect(explicitShimRecord[exportName]).toBe(authorityRecord[exportName]);
      }
    });
  }
});
