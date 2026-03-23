/**
 * FILE: src/tests/architect/architectBlockerFilesTypeImplementation.test.ts
 * PURPOSE: Small node-oriented proof for the Architect blocker-files type implementation pass.
 * OWNERSHIP: Feature: architect/type-implementation
 */

import { describe, expect, it } from 'vitest';
import { ensureContractStructure } from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import { mergeWorldPlayerOverride } from '@/features/architect/GMDashboard/hooks/useArchitectState';
import { normalizeContractActionResult } from '@/shared/components/EditContractModal';

describe('Architect blocker-files type implementation proof', () => {
  it('canonicalizes a legacy action contract payload into salariesByYear rows', () => {
    const contract = ensureContractStructure({
      salaries: [12_000_000, '13500000'],
      years: 2,
      startYear: 2026,
      contractType: 'Standard',
      signedUsing: 'Room MLE',
    });

    expect(contract).toMatchObject({
      contractType: 'Standard',
      signedUsing: 'Room MLE',
      salariesByYear: [
        {
          season: '2025-26',
          salary: 12_000_000,
          capHit: 12_000_000,
          guaranteed: true,
          option: null,
        },
        {
          season: '2026-27',
          salary: 13_500_000,
          capHit: 13_500_000,
          guaranteed: true,
          option: null,
        },
      ],
    });
  });

  it('merges world player overrides without dropping base contract or bio fields', () => {
    const merged = mergeWorldPlayerOverride(
      {
        id: 'player_1',
        teamCode: 'LAL',
        contract: {
          contractType: 'Standard',
          signingTeam: 'LAL',
          salariesByYear: [
            {
              season: '2025-26',
              salary: 8_000_000,
              capHit: 8_000_000,
              guaranteed: true,
            },
          ],
        },
        bio: {
          displayName: 'Base Name',
          playerId: 'player_1',
        },
      },
      {
        id: 'player_1',
        contract: {
          signedUsing: 'Room MLE',
        },
        bio: {
          displayName: 'Override Name',
        },
      }
    );

    expect(merged.contract).toMatchObject({
      contractType: 'Standard',
      signingTeam: 'LAL',
      signedUsing: 'Room MLE',
    });
    expect(merged.bio).toMatchObject({
      displayName: 'Override Name',
      playerId: 'player_1',
    });
    expect(merged.teamCode).toBe('LAL');
  });

  it('keeps persisted-write gating when normalizing contract action results', () => {
    expect(
      normalizeContractActionResult({
        success: true,
        appliedToLocalState: true,
        persistedToWorld: true,
        writesSummary: {
          eventsWritten: 1,
          worldMetadataPatched: 1,
          teamsPatched: 1,
        },
      })
    ).toEqual({
      success: true,
      message: '',
    });

    expect(
      normalizeContractActionResult({
        success: true,
        appliedToLocalState: true,
        persistedToWorld: true,
        writesSummary: {
          eventsWritten: 1,
          worldMetadataPatched: 1,
          teamsPatched: 0,
        },
      })
    ).toEqual({
      success: false,
      message: 'Action did not complete required save writes.',
    });
  });
});
