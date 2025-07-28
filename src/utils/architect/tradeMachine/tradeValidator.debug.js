// tradeValidator.debug.js - Complete File Replacement
import { validateTrade, tradeDebug } from './tradeValidator';

const debug = tradeDebug;
debug.logs = [];

// Helper function for cleaner salary formatting
const formatSalary = (amount) => `$${(amount || 0).toLocaleString()}`;

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
            contract_clean: {
              salaries_by_year: { 2024: { salary: 30000000 } },
            },
          },
          {
            name: 'Andrew Wiggins',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 24000000 } },
            },
          },
        ],
        incomingPlayers: [
          {
            name: 'Pascal Siakam',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 37000000 } },
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
            contract_clean: {
              salaries_by_year: { 2024: { salary: 37000000 } },
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
          {
            name: "D'Angelo Russell",
            contract_clean: {
              salaries_by_year: { 2024: { salary: 17000000 } },
            },
          },
          {
            name: 'Rui Hachimura',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 15000000 } },
            },
          },
          {
            name: 'Jalen Hood-Schifino',
            contract_clean: { salaries_by_year: { 2024: { salary: 3000000 } } },
          },
        ],
        incomingPlayers: [
          {
            name: 'Alex Caruso',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 16000000 } },
            },
          },
          {
            name: 'Andre Drummond',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 12000000 } },
            },
          },
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
          {
            name: 'Alex Caruso',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 16000000 } },
            },
          },
          {
            name: 'Andre Drummond',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 12000000 } },
            },
          },
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
        sends: [
          {
            name: 'Khris Middleton',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 29000000 } },
            },
          },
        ],
        incomingPlayers: [
          {
            name: 'Bogdan Bogdanovic',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 18000000 } },
            },
          },
          {
            name: 'Onyeka Okongwu',
            contract_clean: { salaries_by_year: { 2024: { salary: 8000000 } } },
          },
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
          {
            name: 'Bogdan Bogdanovic',
            contract_clean: {
              salaries_by_year: { 2024: { salary: 18000000 } },
            },
          },
          {
            name: 'Onyeka Okongwu',
            contract_clean: { salaries_by_year: { 2024: { salary: 8000000 } } },
          },
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
          sends: [
            {
              name: 'Malcolm Brogdon',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 22500000 } },
              },
            },
          ],
          incomingPlayers: [
            {
              name: 'Kelly Olynyk',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 12000000 } },
              },
            },
            {
              name: 'Delon Wright',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 8000000 } },
              },
            },
            {
              name: 'Jevon Carter',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 2000000 } },
              },
            },
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
            {
              name: 'Kelly Olynyk',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 12000000 } },
              },
            },
            {
              name: 'Delon Wright',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 8000000 } },
              },
            },
            {
              name: 'Jevon Carter',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 2000000 } },
              },
            },
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
          sends: [
            {
              name: 'Michael Porter Jr.',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 33000000 } },
              },
            },
          ],
          incomingPlayers: [
            {
              name: 'Luguentz Dort',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 15000000 } },
              },
            },
            {
              name: 'Davis Bertans',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 17000000 } },
              },
            },
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
            {
              name: 'Luguentz Dort',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 15000000 } },
              },
            },
            {
              name: 'Davis Bertans',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 17000000 } },
              },
            },
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
            {
              name: 'Kyle Lowry',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 28000000 } },
              },
            },
            {
              name: 'Duncan Robinson',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 18000000 } },
              },
            },
          ],
          incomingPlayers: [
            {
              name: 'Terry Rozier',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 23000000 } },
              },
            },
            {
              name: 'P.J. Washington',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 16000000 } },
              },
            },
            {
              name: 'Nick Richards',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 5000000 } },
              },
            },
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
            {
              name: 'Terry Rozier',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 23000000 } },
              },
            },
            {
              name: 'P.J. Washington',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 16000000 } },
              },
            },
            {
              name: 'Nick Richards',
              contract_clean: {
                salaries_by_year: { 2024: { salary: 5000000 } },
              },
            },
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
debug.flush();
