/**
 * FILE: src/tests/architect/entitlementPresentationHelpers.compatibility.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E67 entitlement presentation helper TS authorities and JS shims.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-12: E67 - Added compatibility checks for formatEntitlement.ts and entitlementWarnings.ts.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  formatEntitlementLabel,
  getEntitlementKindTag,
  getKindSortPriority,
} from '@/features/architect/utils/entitlements/formatEntitlement';
import {
  computeEntitlementWarnings,
  getEntitlementKindBadge,
} from '@/features/architect/tradeMachine/utils/entitlementWarnings';

describe('E67 entitlement presentation helper compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const formatShimPath = path.join(
    srcRoot,
    'utils/entitlements/formatEntitlement.js'
  );
  const warningsShimPath = path.join(
    srcRoot,
    'tradeMachine/utils/entitlementWarnings.js'
  );

  it('formatEntitlement.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(formatShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './formatEntitlement.ts';");
  });

  it('entitlementWarnings.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(warningsShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './entitlementWarnings.ts';");
  });

  it('formatEntitlement explicit .js import matches extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/entitlements/formatEntitlement.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'formatEntitlementLabel',
      'getEntitlementKindTag',
      'getKindSortPriority',
    ]);
    expect('default' in explicitJsModule).toBe(false);
    expect(explicitJsModule.formatEntitlementLabel).toBe(formatEntitlementLabel);
    expect(explicitJsModule.getEntitlementKindTag).toBe(getEntitlementKindTag);
    expect(explicitJsModule.getKindSortPriority).toBe(getKindSortPriority);
  });

  it('entitlementWarnings explicit .js import matches extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/tradeMachine/utils/entitlementWarnings.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'computeEntitlementWarnings',
      'getEntitlementKindBadge',
    ]);
    expect('default' in explicitJsModule).toBe(false);
    expect(explicitJsModule.computeEntitlementWarnings).toBe(
      computeEntitlementWarnings
    );
    expect(explicitJsModule.getEntitlementKindBadge).toBe(
      getEntitlementKindBadge
    );
  });
});
