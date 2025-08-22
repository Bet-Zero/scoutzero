import { validateTrade } from './src/utils/architect/tradeMachine/index.js';
import capProjections from './src/utils/architect/capProjections.js';

const currentYear = 2025;

const makePlayer = (name, salary, signAndTrade = false, contractYears = 4) => ({
  name,
  signAndTrade,
  contractYears,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
});

const makeTeam = (name, totalSalary, rosterSize = 14, picks = []) => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks,
});

console.log('=== Debug Test: Second Apron Restrictions ===');

const teamA = makeTeam('A', 190_000_000); // Above 2nd apron
const teamB = makeTeam('B', 100_000_000);
const aPlayer1 = makePlayer('A1', 10_000_000);
const aPlayer2 = makePlayer('A2', 5_000_000);
const bPlayer = makePlayer('B1', 15_000_000);
teamA.players.push(aPlayer1, aPlayer2);
teamB.players.push(bPlayer);

const result = validateTrade({
  teams: [
    { team: teamA, sends: [aPlayer1, aPlayer2], picksOut: [] },
    { team: teamB, sends: [bPlayer], picksOut: [] },
  ],
  capProjections,
  currentYear,
});

console.log('Team A total salary:', teamA.totalSalary);
console.log('Cap projections:', capProjections);
console.log('Result legal:', result.legal);
console.log('Result reason:', result.reason);
console.log('Team A result:', result.teamResults[0]);
console.log('Team A aggregation:', result.teamResults[0]?.rules?.aggregation);

console.log('\n=== Debug Test: Cash Considerations ===');

const teamA2 = makeTeam('A', 190_000_000);
const teamB2 = makeTeam('B', 100_000_000);
const aPlayer3 = makePlayer('A1', 1_000_000);
const bPlayer2 = makePlayer('B1', 1_000_000);
teamA2.players.push(aPlayer3);
teamB2.players.push(bPlayer2);

const result2 = validateTrade({
  teams: [
    { team: teamA2, sends: [aPlayer3], picksOut: [], cashSent: 1_000_000 },
    { team: teamB2, sends: [bPlayer2], picksOut: [] },
  ],
  capProjections,
  currentYear,
});

console.log('Cash test result legal:', result2.legal);
console.log('Cash test reason:', result2.reason);
console.log('Team A2 cash result:', result2.teamResults[0]?.rules?.cash);