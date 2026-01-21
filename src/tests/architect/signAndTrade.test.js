
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { getTeam, getPlayer } from '@/features/architect/utils/teamLoader';

// Mock dependencies
vi.mock('@/firebaseConfig', () => ({
  db: {},
}));
vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn(),
  })),
  serverTimestamp: vi.fn(() => 'TIMESTAMP'),
  collection: vi.fn(),
  doc: vi.fn(),
}));
vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: vi.fn(), // Mocked per test
  getPlayer: vi.fn(), // Mocked per test
}));
vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(),
}));

// Mock validators to pass always
vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(),
  validateExtension: vi.fn(),
  validateOptionDecision: vi.fn(),
  validateRenounceRights: vi.fn(),
  isOverrideEnabled: vi.fn(() => false),
}));

// Mock trade validator
vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, success: true, legal: true })),
}));

describe('Sign and Trade Mutation', () => {
  const worldId = 'test-world-123';
  const seasonId = '2025-26';
  const userId = 'user-1';
  
  const sourceTeamCode = 'LAL';
  const destTeamCode = 'BOS';
  const playerId = 'player-1';

  const mockSourceTeam = {
    teamCode: sourceTeamCode,
    teamName: 'Lakers',
    roster: [],
    players: [],
    totals: { totalSalary: 0, capHit: 0 },
  };

  const mockDestTeam = {
    teamCode: destTeamCode,
    teamName: 'Celtics',
    roster: [],
    players: [],
    totals: { totalSalary: 0, capHit: 0 },
  };

  const mockPlayer = {
    id: playerId,
    name: 'LeBron Test',
    contract: { contractType: 'Free Agent' },
  };

  const signingContract = {
    years: 1,
    salaries: [1000000],
    base: 1000000,
    signAndTrade: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully execute a sign and trade', async () => {
    // Setup mocks
    getTeam.mockImplementation((wid, code) => {
      if (code === sourceTeamCode) return Promise.resolve(mockSourceTeam);
      if (code === destTeamCode) return Promise.resolve(mockDestTeam);
      return Promise.resolve(null);
    });
    getPlayer.mockResolvedValue(mockPlayer);

    const result = await applyWorldMutation({
      userId,
      worldId,
      seasonId,
      mutationType: 'signAndTrade',
      payload: {
        teamCode: sourceTeamCode,
        destinationTeamCode: destTeamCode,
        playerId,
        contract: signingContract,
        signedUsing: 'Bird Rights',
      },
    });

    if (!result.success) {
      console.log('Test 1 Failed Result:', JSON.stringify(result, null, 2));
    }

    expect(result.success).toBe(true);
    expect(result.changedTeams).toHaveLength(2);
    
    const sourceUpdate = result.changedTeams.find(t => t.teamCode === sourceTeamCode);
    const destUpdate = result.changedTeams.find(t => t.teamCode === destTeamCode);

    // Source team should NOT have the player (signed then traded away)
    // Actually, roster logic:
    // 1. Sign adds to source roster.
    // 2. Trade removes from source, adds to dest.
    // So source roster should effectively be same length (0 -> 1 -> 0)
    expect(sourceUpdate.team.roster).not.toContain(playerId);
    
    // Dest team SHOULD have the player
    expect(destUpdate.team.roster).toContain(playerId);
    
    // Player update should reflect new team
    expect(result.changedPlayers[0].player.teamCode).toBe(destTeamCode);
    expect(result.changedPlayers[0].player.contract.contractType).toBe('Sign & Trade');
  });

  it('should fail if destination team is missing', async () => {
    const result = await applyWorldMutation({
      userId,
      worldId,
      seasonId,
      mutationType: 'signAndTrade',
      payload: {
        teamCode: sourceTeamCode,
        // Missing destinationTeamCode
        playerId,
        contract: signingContract,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('destinationTeamCode');
  });
});
