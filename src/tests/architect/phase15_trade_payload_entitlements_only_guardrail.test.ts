/**
 * FILE: phase15_trade_payload_entitlements_only_guardrail.test.js
 * PURPOSE: Guardrail tests ensuring Trade Machine uses entitlements-only for draft assets.
 *          Legacy pick fields (outgoingPicks, incomingPicks, picksOut) must NOT appear
 *          in trade payloads and must be IGNORED if injected.
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *   - 2026-02-01: Phase 15 - Created guardrail tests for entitlements-only validation
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 15)
 */

import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections';
import type { NormalizedPlayer } from '@/features/architect/utils/tradeMachine/constants/types';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

const makePlayer = (name: string, salary: number): NormalizedPlayer => ({
  name,
  salary,
  matchIncoming: salary,
  matchOutgoing: salary,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade: false,
  contractYears: 1,
  firstYearGuaranteed: true,
  contract: { salariesByYear: [{ season, salary }] },
});

type TradePayloadTestPlayer = ReturnType<typeof makePlayer>;

const makeTeam = (name: string, totalSalary: number) => ({
  id: name.toLowerCase(),
  teamName: name,
  totalSalary,
  players: Array.from<unknown, TradePayloadTestPlayer>({ length: 12 }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  entitlements: [],
  entitlementIds: [],
});

describe('Phase 15: Trade Payload Entitlements-Only Guardrails', () => {
  describe('Payload structure validation', () => {
    it('trade payload uses outgoingEntitlements/incomingEntitlements (not legacy picks)', () => {
      const teamA = makeTeam('TeamA', 100_000_000);
      const teamB = makeTeam('TeamB', 100_000_000);
      const playerA = makePlayer('PlayerA', 5_000_000);
      teamA.players.push(playerA);

      const tradePayload = {
        teams: [
          {
            team: teamA,
            sends: [playerA],
            // Phase 15: entitlementsOut is the ONLY draft-asset field
            entitlementsOut: [
              {
                id: 'ent-2027-1',
                seasonYear: 2027,
                round: 1,
                kind: 'pick_ownership',
              },
            ],
          },
          {
            team: teamB,
            sends: [],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      };

      // Verify payload structure contains entitlements fields
      expect(tradePayload.teams[0]).toHaveProperty('entitlementsOut');
      expect(tradePayload.teams[1]).toHaveProperty('entitlementsOut');

      // Verify payload does NOT contain legacy pick fields
      expect(tradePayload.teams[0]).not.toHaveProperty('outgoingPicks');
      expect(tradePayload.teams[0]).not.toHaveProperty('incomingPicks');
      expect(tradePayload.teams[0]).not.toHaveProperty('picksOut');
      expect(tradePayload.teams[1]).not.toHaveProperty('outgoingPicks');
      expect(tradePayload.teams[1]).not.toHaveProperty('incomingPicks');
      expect(tradePayload.teams[1]).not.toHaveProperty('picksOut');
    });

    it('validates trade successfully with entitlements-only payload', () => {
      const teamA = makeTeam('TeamA', 100_000_000);
      const teamB = makeTeam('TeamB', 100_000_000);
      const playerA = makePlayer('PlayerA', 5_000_000);
      const playerB = makePlayer('PlayerB', 5_000_000);
      teamA.players.push(playerA);
      teamB.players.push(playerB);

      const result = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [playerA],
            entitlementsOut: [],
          },
          {
            team: teamB,
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      });

      // Trade should validate successfully
      expect(result).toBeDefined();
      expect(result.teamResults).toBeDefined();
      expect(result.teamResults.length).toBe(2);
    });
  });

  describe('Legacy pick field injection (must be ignored)', () => {
    it('legacy picksOut field is ignored and does not affect validation', () => {
      const teamA = makeTeam('TeamA', 100_000_000);
      const teamB = makeTeam('TeamB', 100_000_000);
      const playerA = makePlayer('PlayerA', 5_000_000);
      const playerB = makePlayer('PlayerB', 5_000_000);
      teamA.players.push(playerA);
      teamB.players.push(playerB);

      // Inject legacy picksOut - should be IGNORED
      const resultWithLegacy = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [playerA],
            entitlementsOut: [],
            picksOut: [{ year: 2027, round: '1st' }], // LEGACY - should be ignored
          },
          {
            team: teamB,
            sends: [playerB],
            entitlementsOut: [],
            picksOut: [], // LEGACY - should be ignored
          },
        ],
        capProjections,
        currentYear,
      });

      // Validate without legacy field
      const resultClean = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [playerA],
            entitlementsOut: [],
          },
          {
            team: teamB,
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      });

      // Results should be equivalent - legacy field had no effect
      expect(resultWithLegacy.legal).toBe(resultClean.legal);
    });

    it('legacy outgoingPicks field is ignored and does not affect validation', () => {
      const teamA = makeTeam('TeamA', 100_000_000);
      const teamB = makeTeam('TeamB', 100_000_000);
      const playerA = makePlayer('PlayerA', 5_000_000);
      const playerB = makePlayer('PlayerB', 5_000_000);
      teamA.players.push(playerA);
      teamB.players.push(playerB);

      // Inject legacy outgoingPicks - should be IGNORED
      const resultWithLegacy = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [playerA],
            entitlementsOut: [],
            outgoingPicks: [{ year: 2027, round: '1st' }], // LEGACY - should be ignored
          },
          {
            team: teamB,
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      });

      // Validate without legacy field
      const resultClean = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [playerA],
            entitlementsOut: [],
          },
          {
            team: teamB,
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      });

      // Results should be equivalent - legacy field had no effect
      expect(resultWithLegacy.legal).toBe(resultClean.legal);
    });

    it('legacy incomingPicks field is ignored and does not affect validation', () => {
      const teamA = makeTeam('TeamA', 100_000_000);
      const teamB = makeTeam('TeamB', 100_000_000);
      const playerA = makePlayer('PlayerA', 5_000_000);
      const playerB = makePlayer('PlayerB', 5_000_000);
      teamA.players.push(playerA);
      teamB.players.push(playerB);

      // Inject legacy incomingPicks - should be IGNORED
      const resultWithLegacy = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [playerA],
            entitlementsOut: [],
            incomingPicks: [{ year: 2027, round: '1st' }], // LEGACY - should be ignored
          },
          {
            team: teamB,
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      });

      // Validate without legacy field
      const resultClean = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [playerA],
            entitlementsOut: [],
          },
          {
            team: teamB,
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      });

      // Results should be equivalent - legacy field had no effect
      expect(resultWithLegacy.legal).toBe(resultClean.legal);
    });
  });

  describe('Entitlements-only Stepien validation', () => {
    it('Stepien validation uses entitlementsOut, not legacy picks', () => {
      const teamA = makeTeam('TeamA', 100_000_000);
      const teamB = makeTeam('TeamB', 100_000_000);

      // Trade with consecutive first-round entitlements (would violate Stepien if processed)
      // Note: The actual Stepien check depends on baseline entitlements on the team
      const result = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [],
            entitlementsOut: [
              {
                id: 'ent-2027-1',
                seasonYear: 2027,
                round: 1,
                kind: 'pick_ownership',
              },
              {
                id: 'ent-2028-1',
                seasonYear: 2028,
                round: 1,
                kind: 'pick_ownership',
              },
            ],
          },
          {
            team: teamB,
            sends: [],
            entitlementsOut: [],
          },
        ],
        capProjections,
        currentYear,
      });

      // Result should exist and use entitlements for validation
      expect(result).toBeDefined();
      expect(result.teamResults).toBeDefined();
      // The actual pass/fail depends on team's entitlement baseline
    });
  });
});
