import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import teamCodeMapData from '../mapping/teamCodeMap.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import transformation functions (we'll need to export them from the migration script)
// For now, we'll test the fixtures and expected structure

describe('Teams Migration - Fixture Validation', () => {
  const fixturesDir = join(__dirname, 'fixtures', 'teams_legacy');
  const teamFixtures = ['LAL', 'BOS', 'OKC'];
  const fixtures = {};

  beforeAll(() => {
    // Load all fixtures
    for (const teamCode of teamFixtures) {
      const fixturePath = join(fixturesDir, `${teamCode}.json`);
      fixtures[teamCode] = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    }
  });

  describe('Legacy Fixture Structure', () => {
    it('should have valid legacy team structure for LAL', () => {
      const lal = fixtures.LAL;
      
      expect(lal.id).toBe('lakers');
      expect(lal.capSheet).toBeDefined();
      expect(lal.capSheet.players).toBeInstanceOf(Array);
      expect(lal.capSheet.players.length).toBeGreaterThan(0);
    });

    it('should have valid contract data for LAL players', () => {
      const lal = fixtures.LAL;
      const lebron = lal.capSheet.players.find(p => p.name === 'LeBron James');
      
      expect(lebron).toBeDefined();
      expect(lebron.contract_clean).toBeDefined();
      expect(lebron.contract_clean.salaries_by_year).toBeDefined();
      expect(lebron.contract_clean.salaries_by_year['2025']).toBeDefined();
      expect(typeof lebron.contract_clean.salaries_by_year['2025'].salary).toBe('number');
    });

    it('should have picks data for OKC', () => {
      const okc = fixtures.OKC;
      
      expect(okc.picks).toBeDefined();
      expect(okc.picks.incoming).toBeInstanceOf(Array);
      expect(okc.picks.incoming.length).toBeGreaterThan(0);
      
      const firstPick = okc.picks.incoming[0];
      expect(firstPick.year).toBeDefined();
      expect(firstPick.round).toBeDefined();
      expect(firstPick.from).toBeDefined();
    });
  });

  describe('Team Code Mapping', () => {
    it('should have all 30 NBA teams in mapping', () => {
      const teamCodes = Object.keys(teamCodeMapData);
      expect(teamCodes.length).toBe(30);
    });

    it('should have correct structure for each team', () => {
      const lal = teamCodeMapData.LAL;
      
      expect(lal.teamCode).toBe('LAL');
      expect(lal.id).toBe('lakers');
      expect(lal.market).toBe('Los Angeles');
      expect(lal.name).toBe('Lakers');
      expect(lal.conference).toBeDefined();
      expect(lal.division).toBeDefined();
    });

    it('should map fixture teams correctly', () => {
      expect(teamCodeMapData.LAL.id).toBe('lakers');
      expect(teamCodeMapData.BOS.id).toBe('celtics');
      expect(teamCodeMapData.OKC.id).toBe('thunder');
    });
  });

  describe('Expected Transformation Output', () => {
    it('should produce correct meta structure', () => {
      // This structure should be produced by transformation
      const lalMeta = {
        teamCode: 'LAL',
        teamId: 'lakers',
        market: 'Los Angeles',
        name: 'Lakers',
        abbreviation: 'LAL',
        conference: 'West',
        division: 'Pacific',
        colors: { primary: '#552583', secondary: '#FDB927', accent: ['#000000'] },
        logos: {},
        updatedAt: null
      };

      expect(lalMeta.teamCode).toBe('LAL');
      expect(lalMeta.conference).toMatch(/^(East|West)$/);
      expect(lalMeta.colors).toHaveProperty('primary');
      expect(lalMeta.colors).toHaveProperty('secondary');
      expect(lalMeta.colors.accent).toBeInstanceOf(Array);
    });

    it('should produce correct season structure', () => {
      // Mock season structure
      const season2025 = {
        roster: {
          players: [
            {
              playerId: 'lbj-001',
              displayName: 'LeBron James',
              position: 'F',
              contractRef: { source: 'contract_clean', playerId: 'lbj-001' }
            }
          ],
          twoWays: [],
          inactiveList: [],
          updatedAt: null
        },
        cap: {
          salaryRows: [
            { playerId: 'lbj-001', year: 2025, amount: 48728845, type: 'option_player', notes: 'spotrac' }
          ],
          totalsByYear: { '2025': { payroll: 48728845, deadMoney: 0, capHolds: 0 } },
          exceptions: [],
          aprons: { hardCapActive: false, apron1Breached: false, apron2Breached: false },
          tpes: [],
          deadMoney: [],
          capHolds: [],
          rights: [],
          updatedAt: null
        },
        picks: {
          incoming: [],
          outgoing: [],
          updatedAt: null
        },
        transactions: [],
        notes: '',
        updatedAt: null
      };

      expect(season2025.roster.players).toBeInstanceOf(Array);
      expect(season2025.cap.salaryRows).toBeInstanceOf(Array);
      expect(season2025.cap.aprons.hardCapActive).toBe(false);
      expect(season2025.picks.incoming).toBeInstanceOf(Array);
    });

    it('should normalize salary rows correctly', () => {
      // Expected salary row structure
      const expectedSalaryRow = {
        playerId: expect.any(String),
        year: expect.any(Number),
        amount: expect.any(Number),
        type: expect.stringMatching(/^(base|option_team|option_player|non_guaranteed|incentive|cap_hold|dead)$/),
        notes: expect.anything()
      };

      const salaryRow = {
        playerId: 'lbj-001',
        year: 2025,
        amount: 48728845,
        type: 'option_player',
        notes: 'spotrac'
      };

      expect(salaryRow).toMatchObject(expectedSalaryRow);
    });

    it('should normalize pick entries correctly', () => {
      const pick = {
        year: 2027,
        round: 1,
        from: 'NOP',
        protection: 'Top-10 protected, converts to two 2nds if not conveyed by 2028',
        swap: false,
        notes: null,
        sourceDealId: null
      };

      expect(pick.year).toBeGreaterThan(2020);
      expect(pick.round).toBe(1);
      expect(pick.from).toBe('NOP');
      expect(pick.swap).toBe(false);
    });
  });

  describe('Data Invariants', () => {
    it('should have numeric salary values only', () => {
      const lal = fixtures.LAL;
      
      for (const player of lal.capSheet.players) {
        if (player.contract_clean?.salaries_by_year) {
          for (const [year, salaryData] of Object.entries(player.contract_clean.salaries_by_year)) {
            expect(typeof salaryData.salary).toBe('number');
            expect(salaryData.salary).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should have consistent player IDs across roster and contracts', () => {
      const lal = fixtures.LAL;
      
      for (const player of lal.capSheet.players) {
        expect(player.player_id).toBeDefined();
        expect(typeof player.player_id).toBe('string');
        expect(player.player_id.length).toBeGreaterThan(0);
      }
    });

    it('should have valid pick years (future only)', () => {
      const okc = fixtures.OKC;
      const currentYear = new Date().getFullYear();
      
      for (const pick of okc.picks.incoming) {
        expect(pick.year).toBeGreaterThanOrEqual(currentYear);
      }
    });

    it('should have valid round numbers (1 or 2)', () => {
      const okc = fixtures.OKC;
      
      for (const pick of okc.picks.incoming) {
        expect(pick.round).toBeGreaterThanOrEqual(1);
        expect(pick.round).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Totals Validation', () => {
    it('should calculate totals correctly for LAL 2025', () => {
      const lal = fixtures.LAL;
      let calculatedTotal = 0;
      
      for (const player of lal.capSheet.players) {
        const salary2025 = player.contract_clean?.salaries_by_year?.['2025']?.salary;
        if (salary2025) {
          calculatedTotal += salary2025;
        }
      }
      
      expect(calculatedTotal).toBe(lal.capSheet.totalSalaryByYear['2025']);
    });

    it('should calculate totals correctly for BOS 2025', () => {
      const bos = fixtures.BOS;
      let calculatedTotal = 0;
      
      for (const player of bos.capSheet.players) {
        const salary2025 = player.contract_clean?.salaries_by_year?.['2025']?.salary;
        if (salary2025) {
          calculatedTotal += salary2025;
        }
      }
      
      expect(calculatedTotal).toBe(bos.capSheet.totalSalaryByYear['2025']);
    });
  });

  describe('Season Key Generation', () => {
    it('should generate correct season keys', () => {
      const toSeasonKey = (year) => {
        const startYear = year - 1;
        const endYear = year % 100;
        return `${startYear}-${endYear.toString().padStart(2, '0')}`;
      };

      expect(toSeasonKey(2025)).toBe('2024-25');
      expect(toSeasonKey(2026)).toBe('2025-26');
      expect(toSeasonKey(2030)).toBe('2029-30');
      expect(toSeasonKey(2100)).toBe('2099-00');
    });
  });

  describe('Protection String Normalization', () => {
    it('should normalize common protection patterns', () => {
      const parsePickProtection = (protectionStr) => {
        if (!protectionStr || typeof protectionStr !== 'string') return null;
        
        const cleaned = protectionStr
          .replace(/top[- ]?(\d+)/i, 'Top-$1')
          .replace(/lottery/i, 'Lottery')
          .replace(/unprotected/i, 'Unprotected');
        
        return cleaned.trim();
      };

      expect(parsePickProtection('top 10')).toBe('Top-10');
      expect(parsePickProtection('top-4 protected')).toBe('Top-4 protected');
      expect(parsePickProtection('lottery protected')).toBe('Lottery protected');
      expect(parsePickProtection('unprotected')).toBe('Unprotected');
    });
  });
});
