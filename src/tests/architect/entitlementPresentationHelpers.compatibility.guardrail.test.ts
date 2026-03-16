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
  const formatDeletedPath = path.join(
    srcRoot,
    'utils/entitlements/formatEntitlement.js'
  );
  const formatAuthorityPath = path.join(
    srcRoot,
    'utils/entitlements/formatEntitlement.ts'
  );
  const warningsDeletedPath = path.join(
    srcRoot,
    'tradeMachine/utils/entitlementWarnings.js'
  );
  const warningsAuthorityPath = path.join(
    srcRoot,
    'tradeMachine/utils/entitlementWarnings.ts'
  );

  it('deleted entitlement helper shims are absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(formatDeletedPath)).toBe(false);
    expect(fs.existsSync(warningsDeletedPath)).toBe(false);
  });

  it('formatEntitlement authority still exposes the expected named API', () => {
    const source = fs.readFileSync(formatAuthorityPath, 'utf-8');
    const extensionlessApi = {
      formatEntitlementLabel,
      getEntitlementKindTag,
      getKindSortPriority,
    };

    expect(Object.keys(extensionlessApi).sort()).toEqual([
      'formatEntitlementLabel',
      'getEntitlementKindTag',
      'getKindSortPriority',
    ]);
    expect(source).toContain('export const formatEntitlementLabel');
    expect(source).toContain('export const getEntitlementKindTag');
    expect(source).toContain('export const getKindSortPriority');
  });

  it('entitlementWarnings authority still exposes the expected named API', () => {
    const source = fs.readFileSync(warningsAuthorityPath, 'utf-8');
    const extensionlessApi = {
      computeEntitlementWarnings,
      getEntitlementKindBadge,
    };

    expect(Object.keys(extensionlessApi).sort()).toEqual([
      'computeEntitlementWarnings',
      'getEntitlementKindBadge',
    ]);
    expect(source).toContain('export function computeEntitlementWarnings');
    expect(source).toContain('export function getEntitlementKindBadge');
  });
});
