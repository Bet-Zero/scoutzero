/**
 * FILE: src/tests/architect/finalSharedFilterBlockers.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the final shared filter runtime blocker TS authorities and legacy shim surfaces.
 * OWNERSHIP: Feature: architect/shared-runtime-blockers
 *
 * HISTORY:
 *  - 2026-03-20: Added focused compatibility proof for the final three shared filter blocker migrations.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const filtersRoot = path.resolve(__dirname, '../../shared/components/ui/filters');

const moduleCases = [
  {
    label: 'BadgeFilterSelect',
    shimPath: path.join(filtersRoot, 'BadgeFilterSelect.jsx'),
    expectedShimSource: "export { default } from './BadgeFilterSelect.tsx';",
    extensionlessSpecifier: '@/shared/components/ui/filters/BadgeFilterSelect',
    authoritySpecifier:
      '../../shared/components/ui/filters/BadgeFilterSelect.tsx',
    explicitShimSpecifier:
      '../../shared/components/ui/filters/BadgeFilterSelect.jsx',
  },
  {
    label: 'RangeSelector',
    shimPath: path.join(filtersRoot, 'RangeSelector.jsx'),
    expectedShimSource: "export { default } from './RangeSelector.tsx';",
    extensionlessSpecifier: '@/shared/components/ui/filters/RangeSelector',
    authoritySpecifier: '../../shared/components/ui/filters/RangeSelector.tsx',
    explicitShimSpecifier: '../../shared/components/ui/filters/RangeSelector.jsx',
  },
  {
    label: 'RoleChecklist',
    shimPath: path.join(filtersRoot, 'RoleChecklist.jsx'),
    expectedShimSource: "export { default } from './RoleChecklist.tsx';",
    extensionlessSpecifier: '@/shared/components/ui/filters/RoleChecklist',
    authoritySpecifier: '../../shared/components/ui/filters/RoleChecklist.tsx',
    explicitShimSpecifier: '../../shared/components/ui/filters/RoleChecklist.jsx',
  },
] as const;

describe('Architect final shared filter blocker compatibility guardrails', () => {
  it('tracks the exact 3-file migration scope', () => {
    expect(moduleCases).toHaveLength(3);
  });

  for (const moduleCase of moduleCases) {
    it(`keeps ${moduleCase.label} legacy file present as an exact shim`, () => {
      expect(fs.existsSync(moduleCase.shimPath)).toBe(true);
      expect(fs.readFileSync(moduleCase.shimPath, 'utf-8').trim()).toBe(
        moduleCase.expectedShimSource
      );
    });
  }

  for (const moduleCase of moduleCases) {
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
});
