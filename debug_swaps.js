
import fs from 'fs';
const ledger = JSON.parse(fs.readFileSync('data/pst/pst_pick_ledger_final_2026_2033.json', 'utf8'));

// Minimal implementation of the logic I SEE in the file
function getOriginTag(pick) {
  if (pick.originalTeam === pick.owner) {
    return 'own';
  }
  return `via ${pick.originalTeam}`;
}

const bugs = ledger.picks.filter(p => {
  const tag = getOriginTag(p);
  // We want to find cases where code SAYS "via" but it SHOULD be "own"
  // But strictly based on the User's Rule (A), "own" happens IF original == owner.
  // So if original == owner, we get 'own'.
  
  // So I am checking if there is any divergence for some reason?
  // No, logic is simple.
  return false;
});

// Let's look for: Pick where owner has "swap controller" matching originalTeam?
// Example: BOS holds SAS pick. Swap controller = SAS.
// Is this the case user mentions?
const swapCases = ledger.picks.filter(p => {
    // Only picks where owner != originalTeam
    if (p.originalTeam === p.owner) return false;
    
    // Check if swaps contains originalTeam as controller
    const hasSwapWithOriginal = p.encumbrances.swaps.some(s => s.controller === p.originalTeam);
    return hasSwapWithOriginal;
});

console.log(`Found ${swapCases.length} swap-held picks.`);
// Dump the first few
console.log(JSON.stringify(swapCases.slice(0, 3).map(p => ({
    id: p.pickId,
    owner: p.owner,
    original: p.originalTeam,
    swaps: p.encumbrances.swaps.map(s => s.controller)
})), null, 2));
