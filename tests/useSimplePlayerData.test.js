import { describe, it, expect } from 'vitest';

// Test the data normalization logic
describe('Player Data Normalization for players_v2', () => {
  
  it('should normalize player data from subcollections correctly', () => {
    // Simulating the normalization logic from useSimplePlayerData.js
    const normalizePlayerV2Data = (mainDoc, subcollections) => {
      const { contract = {}, season = {}, evaluation = {} } = subcollections;

      const normalized = {
        id: mainDoc.id,
        player_id: mainDoc.id,
        
        // Preserve any additional fields from main document first
        ...mainDoc,
        
        // Bio data (from main document) - override with enhanced version
        bio: {
          ...mainDoc.bio,
          display_name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || '',
        },
        display_name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || '',
        name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || mainDoc.bio?.name || '',
        
        contract: contract?.id ? {
          total_value: contract.contractValue || contract.total_value || 0,
          annual_salaries: contract.annual_salaries || [],
          bird_rights: contract.bird_rights || null,
          averageAnnualValue: contract.averageAnnualValue || 0
        } : {
          total_value: 0,
          annual_salaries: [],
          bird_rights: null,
          averageAnnualValue: 0
        },
        
        system: {
          stats: season?.stats || {},
          team: season?.team || null
        },
        
        traits: evaluation?.traits || {},
        roles: evaluation?.roles || {},
        shootingProfile: evaluation?.shootingProfile || '—',
        subRoles: evaluation?.subRoles || { offense: [], defense: [] },
        badges: evaluation?.badges || [],
        overallGrade: evaluation?.overallGrade || null,
      };

      return normalized;
    };

    // Mock data from players_v2
    const mainDoc = {
      id: 'jamesle01',
      bio: {
        displayName: 'LeBron James',
        age: 40,
        position: 'SF',
        HT: '6-9',
        WT: 250,
        AGE: 40,
        Position: 'SF'
      }
    };

    const subcollections = {
      contract: {
        id: 'std_202425',
        contractValue: 50000000,
        averageAnnualValue: 25000000,
        annual_salaries: [
          { year: '2024-25', salary: 48728845 }
        ],
        bird_rights: 'Early Bird'
      },
      season: {
        id: '2025-26',
        stats: {
          PTS: 25.7,
          AST: 7.3,
          TRB: 7.3
        },
        team: 'LAL'
      },
      evaluation: {
        id: 'current',
        traits: {
          Shooting: 85,
          Defense: 75
        },
        overallGrade: 90,
        roles: {
          offense1: 'Primary Ball Handler',
          defense1: 'Point-of-Attack'
        },
        shootingProfile: 'Elite',
        subRoles: {
          offense: ['Primary Ball Handler'],
          defense: ['Point-of-Attack']
        },
        badges: []
      }
    };

    const result = normalizePlayerV2Data(mainDoc, subcollections);

    // Verify all expected fields are present
    expect(result.id).toBe('jamesle01');
    expect(result.player_id).toBe('jamesle01');
    expect(result.display_name).toBe('LeBron James');
    expect(result.name).toBe('LeBron James');
    expect(result.bio.display_name).toBe('LeBron James');
    expect(result.bio.displayName).toBe('LeBron James');
    
    // Verify contract data
    expect(result.contract.total_value).toBe(50000000);
    expect(result.contract.annual_salaries).toHaveLength(1);
    expect(result.contract.bird_rights).toBe('Early Bird');
    
    // Verify stats data
    expect(result.system.stats.PTS).toBe(25.7);
    expect(result.system.stats.AST).toBe(7.3);
    expect(result.system.team).toBe('LAL');
    
    // Verify evaluation data
    expect(result.traits.Shooting).toBe(85);
    expect(result.traits.Defense).toBe(75);
    expect(result.roles.offense1).toBe('Primary Ball Handler');
    expect(result.shootingProfile).toBe('Elite');
    expect(result.overallGrade).toBe(90);
  });

  it('should handle missing subcollections gracefully', () => {
    const normalizePlayerV2Data = (mainDoc, subcollections) => {
      const { contract = {}, season = {}, evaluation = {} } = subcollections;

      return {
        id: mainDoc.id,
        player_id: mainDoc.id,
        
        // Preserve any additional fields from main document first
        ...mainDoc,
        
        bio: {
          ...mainDoc.bio,
          display_name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || '',
        },
        display_name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || '',
        name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || mainDoc.bio?.name || '',
        
        contract: contract?.id ? {
          total_value: contract.contractValue || contract.total_value || 0,
          annual_salaries: contract.annual_salaries || [],
          bird_rights: contract.bird_rights || null,
          averageAnnualValue: contract.averageAnnualValue || 0
        } : {
          total_value: 0,
          annual_salaries: [],
          bird_rights: null,
          averageAnnualValue: 0
        },
        
        system: {
          stats: season?.stats || {},
          team: season?.team || null
        },
        
        traits: evaluation?.traits || {},
        roles: evaluation?.roles || {},
        shootingProfile: evaluation?.shootingProfile || '—',
        subRoles: evaluation?.subRoles || { offense: [], defense: [] },
        badges: evaluation?.badges || [],
        overallGrade: evaluation?.overallGrade || null,
      };
    };

    const mainDoc = {
      id: 'testplayer01',
      bio: {
        displayName: 'Test Player'
      }
    };

    const subcollections = {}; // No subcollections

    const result = normalizePlayerV2Data(mainDoc, subcollections);

    // Verify defaults are applied
    expect(result.id).toBe('testplayer01');
    expect(result.display_name).toBe('Test Player');
    expect(result.contract.total_value).toBe(0);
    expect(result.contract.annual_salaries).toEqual([]);
    expect(result.system.stats).toEqual({});
    expect(result.traits).toEqual({});
    expect(result.shootingProfile).toBe('—');
    expect(result.subRoles).toEqual({ offense: [], defense: [] });
  });
});
