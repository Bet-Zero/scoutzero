// tradeValidator.debug.js - Complete File Replacement
import { validateTrade } from './tradeValidator.js';
import tradeDebug from './tradeDebug.js';

const debug = tradeDebug;
debug.logs = [];

// Helper function for cleaner salary formatting
const formatSalary = (amount) => `$${(amount || 0).toLocaleString()}`;

// Helper to convert old contract_clean format to new contract.salariesByYear format
const makeContract = (year, salary) => ({
  contract: {
    salariesByYear: [
      {
        season: `${year}-${String((year + 1) % 100).padStart(2, '0')}`,
        salary,
        capHit: salary,
        guaranteed: true,
      },
    ],
  },
});

// ===== TEST CASE 1: 2-for-1 with higher incoming salary (Should Fail) =====
const warriorsTrade = {
  description: 'Warriors 2-for-1 with higher incoming salary (Should: Fail)',
  tradeData: {
    teams: [
      {
        team: {
          id: 'GSW',
          teamName: 'Golden State Warriors',
          totalSalary: 185000000,
          players: [],
        },
        sends: [
          {
            name: 'Chris Paul',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 30000000, capHit: 30000000, guaranteed: true },
              ],
            },
          },
          {
            name: 'Andrew Wiggins',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 24000000, capHit: 24000000, guaranteed: true },
              ],
            },
          },
        ],
        incomingPlayers: [
          {
            name: 'Pascal Siakam',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 37000000, capHit: 37000000, guaranteed: true },
              ],
            },
          },
        ],
      },
      {
        team: {
          id: 'TOR',
          teamName: 'Toronto Raptors',
          totalSalary: 120000000,
          players: [],
        },
        sends: [
          {
            name: 'Pascal Siakam',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 37000000, capHit: 37000000, guaranteed: true },
              ],
            },
          },
        ],
        incomingPlayers: [{ name: 'Chris Paul' }, { name: 'Andrew Wiggins' }],
      },
    ],
    capProjections: { '2024-25': { secondApron: 179500000 } },
    currentYear: 2024,
  },
  expected: {
    legal: false,
    violation:
      'Cannot aggregate salaries to acquire Pascal Siakam making $37,000,000 (max allowed: $30,000,000)',
  },
};

// ===== TEST CASE 2: 3-for-2 with valid salaries (Should Pass) =====
const lakersTrade = {
  description: 'Lakers 3-for-2 with valid salaries (Should: Pass)',
  tradeData: {
    teams: [
      {
        team: {
          id: 'LAL',
          teamName: 'Los Angeles Lakers',
          totalSalary: 182000000,
          players: [],
        },
        sends: [
          { name: "D'Angelo Russell", ...makeContract(2024, 17000000) },
          { name: 'Rui Hachimura', ...makeContract(2024, 15000000) },
          { name: 'Jalen Hood-Schifino', ...makeContract(2024, 3000000) },
        ],
        incomingPlayers: [
          { name: 'Alex Caruso', ...makeContract(2024, 16000000) },
          { name: 'Andre Drummond', ...makeContract(2024, 12000000) },
        ],
      },
      {
        team: {
          id: 'CHI',
          teamName: 'Chicago Bulls',
          totalSalary: 130000000,
          players: [],
        },
        sends: [
          { name: 'Alex Caruso', ...makeContract(2024, 16000000) },
          { name: 'Andre Drummond', ...makeContract(2024, 12000000) },
        ],
        incomingPlayers: [
          { name: "D'Angelo Russell" },
          { name: 'Rui Hachimura' },
          { name: 'Jalen Hood-Schifino' },
        ],
      },
    ],
    capProjections: { '2024-25': { secondApron: 179500000 } },
    currentYear: 2024,
  },
  expected: {
    legal: true,
    violation: null,
  },
};

// ===== TEST CASE 3: 1-for-2 with lower salaries (Should Pass) =====
const bucksTrade = {
  description: 'Bucks 1-for-2 with lower salaries (Should: Pass)',
  tradeData: {
    teams: [
      {
        team: {
          id: 'MIL',
          teamName: 'Milwaukee Bucks',
          totalSalary: 183000000,
          players: [],
        },
        sends: [{ name: 'Khris Middleton', ...makeContract(2024, 29000000) }],
        incomingPlayers: [
          { name: 'Bogdan Bogdanovic', ...makeContract(2024, 18000000) },
          { name: 'Onyeka Okongwu', ...makeContract(2024, 8000000) },
        ],
      },
      {
        team: {
          id: 'ATL',
          teamName: 'Atlanta Hawks',
          totalSalary: 140000000,
          players: [],
        },
        sends: [
          { name: 'Bogdan Bogdanovic', ...makeContract(2024, 18000000) },
          { name: 'Onyeka Okongwu', ...makeContract(2024, 8000000) },
        ],
        incomingPlayers: [{ name: 'Khris Middleton' }],
      },
    ],
    capProjections: { '2024-25': { secondApron: 179500000 } },
    currentYear: 2024,
  },
  expected: {
    legal: true,
    violation: null,
  },
};

// ===== TEST RUNNER =====
function runTradeTest(testCase) {
  const result = validateTrade(testCase.tradeData);
  const teamResult = result.teamResults[0]; // First team only

  console.log(`\n=== ${testCase.description} ===`);
  console.log(`Legal? ${result.overallLegal ? 'PASS' : 'FAIL'}`);
  if (teamResult.violations.length) {
    console.log(`Violation: ${teamResult.violations.join('; ')}`);
  }
}

// ===== ADDITIONAL TEST CASES =====
const testCases = [
  warriorsTrade,
  lakersTrade,
  bucksTrade,

  // NEW TEST CASE 4: 1-for-3 with valid salaries (Should Pass)
  {
    description: 'Celtics 1-for-3 with valid salaries (Should: Pass)',
    tradeData: {
      teams: [
        {
          team: {
            id: 'BOS',
            teamName: 'Boston Celtics',
            totalSalary: 182000000,
            players: [],
          },
          sends: [{ name: 'Malcolm Brogdon', ...makeContract(2024, 22500000) }],
          incomingPlayers: [
            { name: 'Kelly Olynyk', ...makeContract(2024, 12000000) },
            { name: 'Delon Wright', ...makeContract(2024, 8000000) },
            { name: 'Jevon Carter', ...makeContract(2024, 2000000) },
          ],
        },
        {
          team: {
            id: 'UTA',
            teamName: 'Utah Jazz',
            totalSalary: 135000000,
            players: [],
          },
          sends: [
            { name: 'Kelly Olynyk', ...makeContract(2024, 12000000) },
            { name: 'Delon Wright', ...makeContract(2024, 8000000) },
            { name: 'Jevon Carter', ...makeContract(2024, 2000000) },
          ],
          incomingPlayers: [{ name: 'Malcolm Brogdon' }],
        },
      ],
      capProjections: { '2024-25': { secondApron: 179500000 } },
      currentYear: 2024,
    },
    expected: {
      legal: true,
      violation: null,
    },
  },

  // NEW TEST CASE 5: 1-for-2 with one invalid salary (Should Fail)
  {
    description: 'Nuggets 1-for-2 with one invalid salary (Should: Fail)',
    tradeData: {
      teams: [
        {
          team: {
            id: 'DEN',
            teamName: 'Denver Nuggets',
            totalSalary: 184000000,
            players: [],
          },
          sends: [{ name: 'Michael Porter Jr.', ...makeContract(2024, 33000000) }],
          incomingPlayers: [
            { name: 'Luguentz Dort', ...makeContract(2024, 15000000) },
            { name: 'Davis Bertans', ...makeContract(2024, 17000000) },
          ],
        },
        {
          team: {
            id: 'OKC',
            teamName: 'Oklahoma City Thunder',
            totalSalary: 125000000,
            players: [],
          },
          sends: [
            { name: 'Luguentz Dort', ...makeContract(2024, 15000000) },
            { name: 'Davis Bertans', ...makeContract(2024, 17000000) },
          ],
          incomingPlayers: [{ name: 'Michael Porter Jr.' }],
        },
      ],
      capProjections: { '2024-25': { secondApron: 179500000 } },
      currentYear: 2024,
    },
    expected: {
      legal: false,
      violation:
        '1-to-Many Violation: Davis Bertans $17,000,000 > outgoing $16,500,000',
    },
  },

  // NEW TEST CASE 6: 2-for-3 with salary drop (Should Pass)
  {
    description: 'Heat 2-for-3 with salary drop (Should: Pass)',
    tradeData: {
      teams: [
        {
          team: {
            id: 'MIA',
            teamName: 'Miami Heat',
            totalSalary: 181000000,
            players: [],
          },
          sends: [
            { name: 'Kyle Lowry', ...makeContract(2024, 28000000) },
            { name: 'Duncan Robinson', ...makeContract(2024, 18000000) },
          ],
          incomingPlayers: [
            { name: 'Terry Rozier', ...makeContract(2024, 23000000) },
            { name: 'P.J. Washington', ...makeContract(2024, 16000000) },
            { name: 'Nick Richards', ...makeContract(2024, 5000000) },
          ],
        },
        {
          team: {
            id: 'CHA',
            teamName: 'Charlotte Hornets',
            totalSalary: 123000000,
            players: [],
          },
          sends: [
            { name: 'Terry Rozier', ...makeContract(2024, 23000000) },
            { name: 'P.J. Washington', ...makeContract(2024, 16000000) },
            { name: 'Nick Richards', ...makeContract(2024, 5000000) },
          ],
          incomingPlayers: [
            { name: 'Kyle Lowry' },
            { name: 'Duncan Robinson' },
          ],
        },
      ],
      capProjections: { '2024-25': { secondApron: 179500000 } },
      currentYear: 2024,
    },
    expected: {
      legal: true,
      violation: null,
    },
  },
];

// ===== EXECUTE ALL TESTS =====
console.log('=== NBA 2nd APRON TRADE VALIDATOR TESTS ===');
testCases.forEach(runTradeTest);
debug.flush('trade-debug.txt');
