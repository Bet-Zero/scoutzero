
import { describe, it, expect } from 'vitest';
import { validateDeadCap } from '@/features/architect/utils/capLegalityValidation';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';

type ComputeWorldMutationResult = ReturnType<typeof computeWorldMutation>;

const requireValue = <T,>(value: T | null | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

const getUpdatedTeam = (result: ComputeWorldMutationResult) =>
  requireValue(result.teamUpdates?.[0]?.team, 'result.teamUpdates[0].team');

/**
 * Phase 24: Manual Dead Money Management Tests
 * 
 * Verifies:
 * 1. Schema validation rules (array, seasonKey, amount > 0, boolean flags).
 * 2. Mutation pipeline support for 'setDeadCap'.
 * 3. Persistence of changes to team state.
 */
describe('Dead Money Management (setDeadCap)', () => {

  describe('Validation (validateDeadCap)', () => {
    it('should validate a correct dead cap entry', () => {
      const validEntry = [
        {
          playerId: 'p1',
          playerName: 'Waived Player',
          amountByYear: {
            '2025-26': { amount: 1000000 }
          },
          stretched: false,
          reason: 'Waived'
        }
      ];
      
      const { violations } = validateDeadCap(validEntry);
      expect(violations).toHaveLength(0);
    });

    it('should fail if input is not an array', () => {
      const { violations } = validateDeadCap({ not: 'an array' });
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('dead_cap_schema_invalid');
    });

    it('should fail if amountByYear is missing or invalid', () => {
       const invalid = [
         {
           playerName: 'Bad Entry',
           // Missing amountByYear
         }
       ];
       const { violations } = validateDeadCap(invalid);
       expect(violations).toHaveLength(1);
       expect(violations[0].message).toContain('Missing or invalid amountByYear');
    });

    it('should fail if amount is negative or zero', () => {
      const invalid = [
        {
          playerName: 'Negative Entry',
          amountByYear: {
            '2025-26': { amount: -500 }
          }
        }
      ];
      const { violations } = validateDeadCap(invalid);
      expect(violations).toHaveLength(1);
       expect(violations[0].message).toContain('Amount must be positive');
    });

    it('should fail if stretched is not boolean', () => {
      const invalid = [
        {
          playerName: 'String Stretched',
          amountByYear: { '2025-26': { amount: 1000 }},
          stretched: 'yes'
        }
      ];
      const { violations } = validateDeadCap(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('stretched must be boolean');
    });
  });
  
  describe('Pipeline (computeSetDeadCapResult)', () => {
      it('should replace the deadCap array on the team', () => {
          const currentState = {
              team: {
                  teamCode: 'LAL',
                  deadCap: [
                      { reason: 'Old Entry' }
                  ]
              }
          };
          
          const newDeadCap = [
              { reason: 'New Entry', amountByYear: { '2025-26': { amount: 500 } } }
          ];
          
          const result = computeWorldMutation({
              mutationType: 'setDeadCap',
              payload: {
                  teamCode: 'LAL',
                  deadCap: newDeadCap
              },
              currentState,
              seasonId: '2025-26',
              timestamp: Date.now()
          } as unknown as Parameters<typeof computeWorldMutation>[0]);
          const updatedTeam = getUpdatedTeam(result);
          
          expect(result.success).toBe(true);
          expect(result.teamUpdates).toHaveLength(1);
          expect(updatedTeam.deadCap).toEqual(newDeadCap);
          // Ensure it fully replaced, not appended
          expect(updatedTeam.deadCap).toHaveLength(1);
          expect(
            (
              updatedTeam.deadCap as Array<{
                reason?: string;
              }>
            )[0].reason
          ).toBe('New Entry');
      });
      
      it('should fail if deadCap payload is missing', () => {
           const result = computeWorldMutation({
              mutationType: 'setDeadCap',
              payload: {
                  teamCode: 'LAL'
                  // missing deadCap
              },
              currentState: { team: { teamCode: 'LAL' } },
              seasonId: '2025-26',
              timestamp: Date.now()
           } as unknown as Parameters<typeof computeWorldMutation>[0]);
           
           expect(result.success).toBe(false);
           expect(result.error).toContain('Invalid deadCap payload');
      });

      it('recomputes canonical totals after dead cap changes', () => {
          const result = computeWorldMutation({
              mutationType: 'setDeadCap',
              payload: {
                  teamCode: 'LAL',
                  deadCap: [
                      {
                          reason: 'Stretch Waive',
                          amountByYear: [{ season: '2025-26', amount: 3_000_000 }]
                      }
                  ]
              },
              currentState: {
                  team: {
                      teamCode: 'LAL',
                      players: [],
                      roster: [],
                      capHolds: [],
                      deadCap: [],
                      exceptions: { tpe: [] },
                      totals: { capHit: 123 }
                  }
              },
              seasonId: '2025-26',
              timestamp: Date.now()
          } as unknown as Parameters<typeof computeWorldMutation>[0]);
            const updatedTeam = getUpdatedTeam(result);

          expect(result.success).toBe(true);
            expect(updatedTeam.totals?.yearKey).toBe(2026);
            expect(typeof updatedTeam.totals?.totalCapAllocations).toBe('number');
            expect(updatedTeam.totals?.teamSalary).toBeNull();
            expect(updatedTeam.totals?.apronTeamSalary).toBeNull();
            expect(updatedTeam.totals?.taxSalary).toBeNull();
            expect(updatedTeam.totals?.capHit).toBeNull();
            expect(updatedTeam.totals?.totalSalary).toBeNull();
      });
  });

});
