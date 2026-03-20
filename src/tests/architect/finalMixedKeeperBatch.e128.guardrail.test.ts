/**
 * FILE: src/tests/architect/finalMixedKeeperBatch.e128.guardrail.test.ts
 * PURPOSE: Prove the final Phase 7C outcome: retired same-path shims are absent and the
 *          legacy tradeContext namespace remains intentionally preserved.
 * OWNERSHIP: Feature: architect/trade-machine
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import capSettingsProviderDefault, * as capSettingsProviderModule from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import * as tradeContextTypesModule from '@/features/architect/utils/tradeContext/types';

describe('Final mixed keeper batch E128 guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const capSettingsProviderAuthoritySpecifier =
    '../../features/architect/utils/tradeMachine/utils/capSettingsProvider.ts';
  const tradeContextTypesAuthoritySpecifier =
    '../../features/architect/utils/tradeContext/types.ts';
  const legacyShimPath = path.join(srcRoot, 'utils/tradeContext/legacy/index.js');

  it('deletes the retired capSettingsProvider.js and tradeContext/types.js shims', () => {
    expect(
      fs.existsSync(
        path.join(srcRoot, 'utils/tradeMachine/utils/capSettingsProvider.js')
      )
    ).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, 'utils/tradeContext/types.js'))).toBe(
      false
    );
  });

  it('preserves capSettingsProvider export parity across extensionless and authority imports', async () => {
    const authorityModule = await import(capSettingsProviderAuthoritySpecifier);
    const expectedKeys = [
      'CAP_SETTINGS_SOURCE_KEYS',
      'CAP_SETTINGS_VERSION',
      'default',
      'getCapSettings',
      'getCapSettingsForReceipt',
      'getCapSettingsForYear',
      'validateCapSettings',
      'yearToSeasonKey',
    ];

    expect(Object.keys(capSettingsProviderModule).sort()).toEqual(expectedKeys);
    expect(Object.keys(authorityModule).sort()).toEqual(expectedKeys);
    expect(capSettingsProviderModule.default).toBe(capSettingsProviderDefault);
    expect(authorityModule.default).toBe(capSettingsProviderDefault);

    for (const exportName of expectedKeys.filter((key) => key !== 'default')) {
      const extensionlessRecord = capSettingsProviderModule as Record<
        string,
        unknown
      >;
      const authorityRecord = authorityModule as Record<string, unknown>;
      expect(extensionlessRecord[exportName]).toBe(authorityRecord[exportName]);
    }
  });

  it('preserves tradeContext/types as an empty runtime module across extensionless and authority imports', async () => {
    const authorityModule = await import(tradeContextTypesAuthoritySpecifier);

    expect(Object.keys(tradeContextTypesModule)).toEqual([]);
    expect(Object.keys(authorityModule)).toEqual([]);
  });

  it('keeps tradeContext/legacy/index.js as the intentional shim-only legacy contract', () => {
    const legacyShimSource = fs.readFileSync(legacyShimPath, 'utf-8').trim();

    expect(legacyShimSource).toContain('compatibility shim');
    expect(legacyShimSource).toContain("from './index.ts'");
    expect(legacyShimSource).not.toContain('Date.now()');
    expect(legacyShimSource).not.toContain('buildPostTradeTeamsSnapshot({');
    expect(legacyShimSource).not.toContain(
      'validatePostTradeSnapshotForContext({ snapshot, payload, seasonId })'
    );
  });
});
