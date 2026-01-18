
import fs from 'fs';
const ledger = JSON.parse(fs.readFileSync('data/pst/pst_pick_ledger_final_2026_2033.json', 'utf8'));
const bos2028 = ledger.picks.filter(p => p.owner === 'BOS' && p.year === 2028 && p.round === 1);
console.log(JSON.stringify(bos2028.map(p => ({
  pickId: p.pickId,
  originalTeam: p.originalTeam,
  ownershipSource: p.ownershipSource,
  owner: p.owner
})), null, 2));
