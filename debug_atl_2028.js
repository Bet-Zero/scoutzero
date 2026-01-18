
import fs from 'fs';
const ledger = JSON.parse(fs.readFileSync('data/pst/pst_pick_ledger_final_2026_2033.json', 'utf8'));
const atl2028 = ledger.picks.filter(p => p.owner === 'ATL' && p.year === 2028 && p.round === 1);
console.log(JSON.stringify(atl2028.map(p => ({
  pickId: p.pickId,
  originalTeam: p.originalTeam,
  owner: p.owner,
  swaps: p.encumbrances.swaps
})), null, 2));
