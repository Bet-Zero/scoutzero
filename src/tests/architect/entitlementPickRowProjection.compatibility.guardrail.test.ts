/**
 * FILE: src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E66 entitlementPickRowProjection TS authority after shim retirement.
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
  const authoritySpecifier =
    '../../features/architect/utils/entitlements/entitlementPickRowProjection.ts';
  const retiredShimPath = path.join(
    srcRoot,
    'utils/entitlements/entitlementPickRowProjection.js'
  );

  it('deletes the entitlementPickRowProjection.js compatibility shim', () => {
    expect(fs.existsSync(retiredShimPath)).toBe(false);
  });

  it('extensionless imports expose the same named API as the TS authority', async () => {
    const extensionlessModule = await import(
      '../../features/architect/utils/entitlements/entitlementPickRowProjection'
    );
    const authorityModule = await import(authoritySpecifier);

    expect(Object.keys(extensionlessModule).sort()).toEqual([
      'getPickRowDisplayLabel',
      'getPickRowSecondaryText',
      'projectEntitlementToPickRow',
    ]);
    expect(Object.keys(authorityModule).sort()).toEqual([
      'getPickRowDisplayLabel',
      'getPickRowSecondaryText',
      'projectEntitlementToPickRow',
    ]);
    expect('default' in extensionlessModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
    expect(extensionlessModule.projectEntitlementToPickRow).toBe(
      projectEntitlementToPickRow
    );
    expect(authorityModule.projectEntitlementToPickRow).toBe(
      projectEntitlementToPickRow
    );
    expect(extensionlessModule.getPickRowDisplayLabel).toBe(
      getPickRowDisplayLabel
    );
    expect(authorityModule.getPickRowDisplayLabel).toBe(getPickRowDisplayLabel);
    expect(extensionlessModule.getPickRowSecondaryText).toBe(
      getPickRowSecondaryText
    );
    expect(authorityModule.getPickRowSecondaryText).toBe(
      getPickRowSecondaryText
    );
  });
});
