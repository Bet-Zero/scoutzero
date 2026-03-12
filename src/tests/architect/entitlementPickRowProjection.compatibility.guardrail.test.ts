/**
 * FILE: src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E66 entitlementPickRowProjection TS authority + JS shim split.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-12: E66 - Added compatibility checks for entitlementPickRowProjection.ts authority and JS shim.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getPickRowDisplayLabel,
  getPickRowSecondaryText,
  projectEntitlementToPickRow,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';

describe('E66 entitlementPickRowProjection compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const shimPath = path.join(
    srcRoot,
    'utils/entitlements/entitlementPickRowProjection.js'
  );

  it('entitlementPickRowProjection.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(shimPath, 'utf-8');

    expect(source).toContain(
      "export * from './entitlementPickRowProjection.ts';"
    );
    expect(source).not.toContain('const PROTECTION_PATTERNS');
    expect(source).not.toContain('export const projectEntitlementToPickRow');
    expect(source).not.toContain('formatEntitlementTermsShort');
  });

  it('explicit .js import exposes the same named API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/entitlements/entitlementPickRowProjection.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'getPickRowDisplayLabel',
      'getPickRowSecondaryText',
      'projectEntitlementToPickRow',
    ]);
    expect('default' in explicitJsModule).toBe(false);
    expect(explicitJsModule.projectEntitlementToPickRow).toBe(
      projectEntitlementToPickRow
    );
    expect(explicitJsModule.getPickRowDisplayLabel).toBe(
      getPickRowDisplayLabel
    );
    expect(explicitJsModule.getPickRowSecondaryText).toBe(
      getPickRowSecondaryText
    );
  });
});
