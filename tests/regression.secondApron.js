// regression.secondApron.test.js
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';

describe('Second-apron regression: cannot take back more than send out', () => {
  it('Suns (>$2nd apron) 1-for-1: 15.6M out vs 29.5M in -> ILLEGAL', () => {
    const currentYear = 2024; // we are testing 2024-25 season data
    const seasonKey = '2024-25';

    // Use real-ish apron values for 2024-25 (adjust if your project has different numbers)
    const capProjections = {
      [seasonKey]: {
        firstApron: 172_346_000,
        secondApron: 182_794_000,
      },
    };

    // Suns are $20M OVER the second apron pre-trade because of dead money + roster
    const suns = {
      teamName: 'Suns',
      players: [
        // (you can omit players if you prefer; deadCap alone is enough to exceed the apron)
      ],
      deadCap: [
        { salaries_by_year: { [currentYear]: { salary: 202_794_000 } } }, // >= 2nd apron + $20M
      ],
    };

    const pelicans = { teamName: 'Pelicans', players: [], deadCap: [] };

    const graysonAllen = {
      name: 'Grayson Allen',
      contract: {
        salariesByYear: [
          {
            season: seasonKey,
            salary: 15_600_000,
            capHit: 15_600_000,
            guaranteed: true,
          },
        ],
      },
    };

    const dejounteMurray = {
      name: 'Dejounte Murray',
      contract: {
        salariesByYear: [
          {
            season: seasonKey,
            salary: 29_500_000,
            capHit: 29_500_000,
            guaranteed: true,
          },
        ],
      },
    };

    const result = validateTrade({
      teams: [
        { team: suns, sends: [graysonAllen], picksOut: [] },
        { team: pelicans, sends: [dejounteMurray], picksOut: [] },
      ],
      capProjections,
      currentYear, // number is fine; validator must normalize to "2024-25"
    });

    // This must be illegal: second-apron team cannot take back more than it sends (100% band).
    expect(result.legal).toBe(false);
  });
});
