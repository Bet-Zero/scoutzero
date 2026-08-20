import { describe, expect, it } from 'vitest';

import { validateExtension } from '@/features/architect/utils/capLegalityValidation/extension';
import { validateConsent } from '@/features/architect/utils/tradeMachine/rules/validateConsent';
import { validateSignAndTrade } from '@/features/architect/utils/tradeMachine/rules/validateSignAndTrade';

const restriction = {
  restrictionVersion: 1 as const,
  lifecycleId: 'offer-sheet-ledger:world_test:os-1',
  eventId: 'offer-sheet-ledger:world_test:os-1:matched:v2',
  matchedAt: '2025-07-09T17:00:00-04:00',
  restrictedUntil: '2026-07-09T17:00:00-04:00',
  offeringTeamId: 'LAL',
  playerTradeConsentRequired: true as const,
  offeringTeamTradeBarred: true as const,
  signAndTradeBarred: true as const,
};

function restrictedPlayer(consent = false) {
  return {
    id: 'player123',
    player_id: 'player123',
    name: 'Restricted RFA',
    consent,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        { season: '2025-26', salary: 15_000_000, capHit: 15_000_000 },
      ],
      offerSheetMatchRestriction: restriction,
    },
  };
}

function consentResult(
  destination: string,
  consent = false,
  tradeDate = '2025-12-01'
) {
  return validateConsent(
    {
      teamId: 'BOS',
      teamName: 'Boston',
      sends: [restrictedPlayer(consent)],
    },
    {
      tradeDate,
      teams: [
        { teamId: 'BOS', teamName: 'Boston' },
        { teamId: destination, teamName: destination },
      ],
    }
  );
}

describe('BZE-283 matched Offer Sheet restrictions', () => {
  it('bars a trade back to the offering Team even with player consent', () => {
    const result = consentResult('LAL', true);

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CONSENT__OFFER_SHEET_OFFERING_TEAM_BARRED',
        }),
      ])
    );
  });

  it('requires player consent for another destination during the first year', () => {
    const blocked = consentResult('NYK');
    const allowed = consentResult('NYK', true);

    expect(blocked.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CONSENT__OFFER_SHEET_PLAYER_CONSENT_REQUIRED',
        }),
      ])
    );
    expect(allowed.passed).toBe(true);
  });

  it('releases the trade restrictions at the exact one-year instant', () => {
    const result = consentResult('LAL', false, '2026-07-09T17:00:00-04:00');

    expect(result.passed).toBe(true);
  });

  it('bars sign-and-trade use while the matched restriction is active', () => {
    const player = { ...restrictedPlayer(), signAndTrade: true };
    const result = validateSignAndTrade(
      {
        teamId: 'BOS',
        teamCode: 'BOS',
        teamName: 'Boston',
        sends: [player],
      },
      {
        currentYear: 2026,
        yearKey: 2026,
        tradeDate: '2025-12-01',
        offseason: true,
      }
    );

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SIGN_AND_TRADE__OFFER_SHEET_MATCH_RESTRICTED',
        }),
      ])
    );
  });

  it('bars a contract extension while the matched restriction is active', () => {
    const result = validateExtension({
      team: {
        teamCode: 'BOS',
        teamName: 'Boston',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      },
      player: restrictedPlayer(),
      extension: {
        salariesByYear: [{ season: '2026-27', salary: 16_000_000 }],
      },
      year: 2026,
      asOfDate: '2025-12-01',
    });

    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'offer_sheet_match_amendment_restricted',
        }),
      ])
    );
  });
});
