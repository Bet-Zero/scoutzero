import fs from 'fs';
const ledgerRaw = fs.readFileSync('data/pst/pst_pick_ledger_final_2026_2033.json', 'utf8');
const ledger = JSON.parse(ledgerRaw);
const pick = ledger.picks.find(p => p.pickId === 'SAS_2028_1st');
console.log(JSON.stringify(pick, null, 2));
