/**
 * Phase 4: Cap Settings Provider Tests
 * Tests the centralized cap settings resolution and trade receipt integration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCapSettings,
  getCapSettingsForYear,
  getCapSettingsForReceipt,
  validateCapSettings,
  yearToSeasonKey,
  CAP_SETTINGS_SOURCE_KEYS,
} from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import capProjections from '@/features/architect/utils/capProjections';
import { validateTrade } from '@/features/architect/utils/tradeMachine';

describe('Phase 4: Cap Settings Provider', () => {
  describe('getCapSettings', () => {
    it('resolves cap settings from capProjections for 2024-25', () => {
      const result = getCapSettings({ year: 2025, capProjections });

      expect(result.resolved).toBe(true);
      expect(result.settings.salaryCap).toBe(141000000);
      expect(result.settings.firstApron).toBe(179000000);
      expect(result.settings.secondApron).toBe(190000000);
      expect(result.source).toContain('capProjections');
      expect(result.seasonKey).toBe('2024-25');
    });

    it('resolves cap settings for 2025-26', () => {
      const result = getCapSettings({ year: 2026, capProjections });

      expect(result.resolved).toBe(true);
      expect(result.settings.salaryCap).toBe(154647000);
      expect(result.settings.firstApron).toBe(195945000);
      expect(result.settings.secondApron).toBe(207824000);
      expect(result.seasonKey).toBe('2025-26');
    });

    it('accepts season string format ("2024-25")', () => {
      const result = getCapSettings({ year: '2024-25', capProjections });

      expect(result.resolved).toBe(true);
      expect(result.seasonKey).toBe('2024-25');
      expect(result.settings.salaryCap).toBe(141000000);
    });

    it('uses provided capSettings when available', () => {
      const customSettings = {
        salaryCap: 150_000_000,
        firstApron: 185_000_000,
        secondApron: 200_000_000,
      };

      const result = getCapSettings({
        year: 2025,
        providedCapSettings: customSettings,
      });

      expect(result.resolved).toBe(true);
      expect(result.settings.salaryCap).toBe(150_000_000);
      expect(result.source).toBe(CAP_SETTINGS_SOURCE_KEYS.PROVIDED);
    });

    it('warns when cap values are projected (not confirmed)', () => {
      // 2026-27 has confirmed: false in capProjections
      const result = getCapSettings({ year: 2027, capProjections });

      expect(result.resolved).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('projected');
    });

    it('warns when using fallback for missing year', () => {
      // Use a far future year that doesn't exist
      const result = getCapSettings({ year: 2050, capProjections });

      expect(result.resolved).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('throws in strict mode when cap settings cannot be resolved', () => {
      expect(() => {
        getCapSettings({
          year: 2050,
          capProjections: {}, // Empty projections
          strict: true,
        });
      }).toThrow(/FATAL/);
    });
  });

  describe('getCapSettingsForYear (convenience wrapper)', () => {
    it('returns settings with _meta property', () => {
      const settings = getCapSettingsForYear(2025, capProjections);

      expect(settings.salaryCap).toBe(141000000);
      expect(settings.firstApron).toBe(179000000);
      expect(settings._meta).toBeDefined();
      expect(settings._meta.source).toContain('capProjections');
      expect(settings._meta.seasonKey).toBe('2024-25');
    });
  });

  describe('getCapSettingsForReceipt', () => {
    it('returns formatted cap settings for trade receipt', () => {
      const result = getCapSettingsForReceipt({
        yearKey: 2025,
        capProjections,
      });

      expect(result.capSettingsUsed).toEqual({
        salaryCap: 141000000,
        firstApron: 179000000,
        secondApron: 190000000,
        luxuryTax: 171000000,
      });
      expect(result.capSettingsSource).toContain('capProjections');
      expect(result.seasonKey).toBe('2024-25');
    });
  });

  describe('validateCapSettings', () => {
    it('passes for valid cap settings', () => {
      const result = validateCapSettings({
        salaryCap: 141_000_000,
        firstApron: 179_000_000,
        secondApron: 190_000_000,
      });

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when cap settings are null', () => {
      const result = validateCapSettings(null);

      expect(result.passed).toBe(false);
      expect(result.errors).toContain('Cap settings are null or undefined');
    });

    it('fails when salaryCap is missing', () => {
      const result = validateCapSettings({
        firstApron: 179_000_000,
        secondApron: 190_000_000,
      });

      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('salaryCap'))).toBe(true);
    });

    it('warns when values are outside typical range', () => {
      const result = validateCapSettings({
        salaryCap: 50_000_000, // Too low
        firstApron: 179_000_000,
        secondApron: 190_000_000,
      });

      expect(result.passed).toBe(true); // Still valid, just warns
      expect(result.warnings.some(w => w.includes('outside typical range'))).toBe(true);
    });

    it('warns when apron order is incorrect', () => {
      const result = validateCapSettings({
        salaryCap: 141_000_000,
        firstApron: 200_000_000, // Higher than secondApron
        secondApron: 190_000_000,
      });

      expect(result.passed).toBe(true); // Still valid, just warns
      expect(result.warnings.some(w => w.includes('secondApron'))).toBe(true);
    });
  });
});

describe('Phase 4: Trade Receipt Integration', () => {
  const currentYear = 2025;
  // Use the exported yearToSeasonKey helper for consistency
  const season = yearToSeasonKey(currentYear);

  const makePlayer = (name, salary) => ({
    name,
    contract: { salariesByYear: [{ season, salary }] },
  });

  const makeTeam = (name, totalSalary) => ({
    teamName: name,
    totalSalary,
    players: Array.from({ length: 14 }, (_, i) =>
      makePlayer(`${name}${i}`, 1_000_000)
    ),
    picks: [],
  });

  it('includes cap settings in trade receipt', () => {
    const teamA = makeTeam('A', 160_000_000);
    const teamB = makeTeam('B', 160_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 10_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Trade receipt should include cap settings
    expect(result.tradeReceipt).toBeDefined();
    expect(result.tradeReceipt.capSettingsUsed).toBeDefined();
    expect(result.tradeReceipt.capSettingsUsed.salaryCap).toBe(141000000);
    expect(result.tradeReceipt.capSettingsUsed.firstApron).toBe(179000000);
    expect(result.tradeReceipt.capSettingsUsed.secondApron).toBe(190000000);
    expect(result.tradeReceipt.capSettingsSource).toContain('capProjections');
    expect(result.tradeReceipt.seasonKey).toBe('2024-25');
  });

  it('shows cap settings warnings in trade receipt when using fallback', () => {
    const teamA = makeTeam('A', 160_000_000);
    const teamB = makeTeam('B', 160_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 10_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    // Use a future year that requires fallback
    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear: 2050, // Far future - will need fallback
    });

    // Should have warnings about fallback
    expect(result.tradeReceipt).toBeDefined();
    expect(result.tradeReceipt.capSettingsWarnings).toBeDefined();
    expect(result.tradeReceipt.capSettingsWarnings.length).toBeGreaterThan(0);
  });

  it('includes cap settings version in trade receipt', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 10_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.tradeReceipt.capSettingsVersion).toBeDefined();
    expect(result.tradeReceipt.validatorVersion).toBeDefined();
  });
});
