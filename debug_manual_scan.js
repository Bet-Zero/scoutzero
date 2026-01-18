
import fs from 'fs';
const file = fs.readFileSync('data/pst/manual_check_views.txt', 'utf8');
const lines = file.split('\n');
let currentTeam = '';
for (const line of lines) {
  if (line.startsWith('# ')) {
     currentTeam = line.split(' ')[1];
  }
  if (line.includes('| via ')) {
     // line: 2028 | 1 | via SAS | ...
     // If via SAS, and currentTeam is SAS -> ERROR.
     const parts = line.split('|').map(s => s.trim());
     const viaPart = parts[2]; // "via SAS"
     const viaTeam = viaPart.replace('via ', '');
     if (viaTeam === currentTeam) {
        console.log(`FOUND ERROR: ${line} (Team: ${currentTeam})`);
     }
  }
}
console.log('Scan complete.');
