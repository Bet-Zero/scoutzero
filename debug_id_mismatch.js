
import fs from 'fs';
const ledger = JSON.parse(fs.readFileSync('data/pst/pst_pick_ledger_final_2026_2033.json', 'utf8'));
const mismatches = ledger.picks.filter(p => {
  const metaParts = p.pickId.split('_');
  const impliedOriginal = metaParts[0];
  return impliedOriginal !== p.originalTeam;
});
console.log(JSON.stringify(mismatches.map(p => ({
  pickId: p.pickId,
  originalTeam: p.originalTeam,
  owner: p.owner
})), null, 2));
