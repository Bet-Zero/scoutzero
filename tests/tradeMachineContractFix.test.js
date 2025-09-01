// tests/tradeMachineContractFix.test.js
import { describe, it, expect } from 'vitest';
import { getSalaryWithFallback } from '../src/utils/architect/contractSalaryUtils.js';

describe('Trade Machine Contract Value Fix Demo', () => {
  it('demonstrates the original issue and how our fix resolves it', () => {
    // Scenario from GitHub issue #235:
    // "tons of players show up with no contract value in the TradeMachine"
    // "they're on the last year of their contract and the trade machine and 
    //  contract data may be using two different years to symbolize this season"

    // Example: A player in the final year of their contract (2024-25 season)
    const playerInFinalYear = {
      name: "John Doe",
      contract_clean: {
        salaries_by_year: {
          // Contract data uses the start year (2024) for the 2024-25 season
          2024: { salary: 25000000 } // $25M final year
          // No 2025 entry because contract expires
        }
      }
    };

    // BEFORE FIX: Trade machine looks for 2025, finds nothing, shows $0
    // AFTER FIX: Trade machine looks for 2025, falls back to 2024, shows $25M

    const salary = getSalaryWithFallback(playerInFinalYear, 2025);
    
    expect(salary).toBe(25000000);
    expect(salary).toBeGreaterThan(0); // Most importantly, NOT zero!
    
    console.log(`✅ Fix confirmed: Player shows $${(salary / 1000000).toFixed(1)}M instead of $0`);
  });

  it('demonstrates how our fix handles different contract data formats', () => {
    const testCases = [
      {
        name: "Player with contract_clean using end year",
        player: {
          contract_clean: {
            salaries_by_year: {
              2025: { salary: 30000000 }
            }
          }
        },
        yearKey: 2025,
        expectedSalary: 30000000,
        description: "Direct match - works perfectly"
      },
      {
        name: "Player with contract_clean using start year", 
        player: {
          contract_clean: {
            salaries_by_year: {
              2024: { salary: 25000000 } // Only has start year
            }
          }
        },
        yearKey: 2025,
        expectedSalary: 25000000,
        description: "Fallback to start year - fixes the main issue"
      },
      {
        name: "Player with legacy contract structure",
        player: {
          contract: {
            annual_salaries: [
              { year: '2025', salary: 20000000 }
            ]
          }
        },
        yearKey: 2025,
        expectedSalary: 20000000,
        description: "Legacy format fallback"
      },
      {
        name: "Player with only basic salary field",
        player: {
          salary: 15000000
        },
        yearKey: 2025,
        expectedSalary: 15000000,
        description: "Final fallback to player.salary"
      }
    ];

    testCases.forEach(({ name, player, yearKey, expectedSalary, description }) => {
      const salary = getSalaryWithFallback(player, yearKey);
      expect(salary).toBe(expectedSalary);
      console.log(`✅ ${name}: $${(salary / 1000000).toFixed(1)}M - ${description}`);
    });
  });

  it('shows how this prevents empty contract values in the Trade Machine UI', () => {
    // Simulate a roster of players that would have shown $0 before the fix
    const problematicRoster = [
      {
        name: "Expiring Contract Player",
        contract_clean: {
          salaries_by_year: {
            2024: { salary: 12000000 } // 2024-25 is final year
          }
        }
      },
      {
        name: "Free Agent to be Signed",
        salary: 8000000 // Just has a salary field
      },
      {
        name: "Legacy Contract Format",
        contract: {
          annual_salaries: [
            { year: '2025', salary: 15000000 }
          ]
        }
      }
    ];

    // Test that all players now show valid contract values
    problematicRoster.forEach(player => {
      const salary = getSalaryWithFallback(player, 2025);
      expect(salary).toBeGreaterThan(0);
      console.log(`✅ ${player.name}: $${(salary / 1000000).toFixed(1)}M (was $0 before fix)`);
    });

    console.log('\n🎉 Contract value display issue is now FIXED!');
    console.log('   Trade Machine will show proper salaries instead of empty values.');
  });
});