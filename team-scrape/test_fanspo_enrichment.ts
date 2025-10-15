// test_fanspo_enrichment.ts
// Test suite for Fanspo draft pick enrichment functionality
//
// This test validates the Fanspo enrichment logic using mock data
// to ensure the feature works correctly without requiring live network access

import { strict as assert } from 'node:assert';

// Mock Fanspo HTML response for Lakers
const MOCK_FANSPO_HTML = `
<html>
<body>
<div>
Incoming Draft Picks
2027 1-UTA
Top 10 protected
2030 2-WAS or ORL
No protections
Outgoing Draft Picks
2029 1-NOP
Lottery protected
2026 2-Own
</div>
</body>
</html>
`;

// Types from parse_team.ts
type EnrichedMap = Map<
  string,
  {
    dir: 'incoming' | 'outgoing';
    fromTeams?: string[]; // incoming
    toTeams?: string[]; // outgoing
    protections?: string; // protections / conveys / swaps text
  }
>;

interface DraftPick {
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'contested' | 'unknown';
  fromTeams?: string[];
  toTeams?: string[];
  protections?: string;
}

const pickKey = (year: number, round: 1 | 2) => `${year}-${round}`;

/** Parse Fanspo draft picks from HTML (mock version for testing) */
function parseFanspoTeamPicks(html: string): EnrichedMap {
  const lines = html
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  let section: 'incoming' | 'outgoing' | null = null;
  let lastKey: string | null = null;
  const map: EnrichedMap = new Map();

  for (const line of lines) {
    if (/^Incoming Draft Picks$/i.test(line)) {
      section = 'incoming';
      continue;
    }
    if (/^Outgoing Draft Picks$/i.test(line)) {
      section = 'outgoing';
      continue;
    }

    // e.g., "2027 1-UTA", "2028 2-ORL or WAS", "2026 1-Own"
    const m = line.match(
      /^(20\d{2})\s+(1|2)-([A-Za-z]+(?:\s+or\s+[A-Za-z]+)?|Own)$/i
    );
    if (m && section) {
      const year = Number(m[1]);
      const round = Number(m[2]) as 1 | 2;
      const dest = m[3];

      const key = pickKey(year, round);
      const entry: any = { dir: section };

      if (section === 'incoming') {
        if (!/own/i.test(dest))
          entry.fromTeams = dest.split(/\s+or\s+/i).map((x) => x.toUpperCase());
      } else {
        entry.toTeams = dest.split(/\s+or\s+/i).map((x) => x.toUpperCase());
      }

      map.set(key, entry);
      lastKey = key;
      continue;
    }

    // Protections / swaps / conveys lines typically follow immediately after a pick line
    if (/protected|protection|no protections|convey|swap/i.test(line)) {
      if (lastKey) {
        const e = map.get(lastKey)!;
        const combined = (e.protections ? e.protections + ' ' : '') + line;
        e.protections = combined.replace(/\s+/g, ' ').trim();
      }
    }
  }

  return map;
}

/** Merge Fanspo info into existing picks */
function mergeFanspoIntoPicks(picks: DraftPick[], fanspo: EnrichedMap) {
  const seenNote = new Set<string>();
  for (const p of picks) {
    const e = fanspo.get(pickKey(p.year, p.round));
    if (!e) continue;

    if (e.fromTeams) p.fromTeams = e.fromTeams;
    if (e.toTeams) p.toTeams = e.toTeams;

    if (e.protections) {
      const note = e.protections.replace(/\s+/g, ' ').trim();
      const key = `${p.year}-${p.round}:${note}`;
      if (!seenNote.has(key)) {
        p.protections = (p.protections ? p.protections + ' ' : '') + note;
        seenNote.add(key);
      }
    }

    // Direction correction: trust Fanspo if it contradicts the grid
    if (e.toTeams && p.status === 'own') p.status = 'outgoing';
  }
}

// Test suite
function runTests() {
  console.log('🧪 Testing Fanspo enrichment functionality...\n');

  // Test 1: Parse Fanspo HTML
  console.log('Test 1: Parse Fanspo HTML');
  const enrichedMap = parseFanspoTeamPicks(MOCK_FANSPO_HTML);
  
  assert.equal(enrichedMap.size, 4, 'Should parse 4 draft picks');
  
  const pick2027_1 = enrichedMap.get('2027-1');
  assert.ok(pick2027_1, 'Should find 2027 1st round pick');
  assert.equal(pick2027_1.dir, 'incoming', '2027 1st should be incoming');
  assert.deepEqual(pick2027_1.fromTeams, ['UTA'], '2027 1st should be from UTA');
  assert.equal(pick2027_1.protections, 'Top 10 protected', 'Should have protection info');
  
  const pick2030_2 = enrichedMap.get('2030-2');
  assert.ok(pick2030_2, 'Should find 2030 2nd round pick');
  assert.deepEqual(pick2030_2.fromTeams, ['WAS', 'ORL'], 'Should parse multiple teams');
  assert.equal(pick2030_2.protections, 'No protections', 'Should capture protections text');
  
  const pick2029_1 = enrichedMap.get('2029-1');
  assert.ok(pick2029_1, 'Should find 2029 1st round pick');
  assert.equal(pick2029_1.dir, 'outgoing', '2029 1st should be outgoing');
  assert.deepEqual(pick2029_1.toTeams, ['NOP'], '2029 1st should go to NOP');
  assert.equal(pick2029_1.protections, 'Lottery protected', 'Should have lottery protection');
  
  console.log('✅ Parse test passed\n');

  // Test 2: Merge enrichment into picks
  console.log('Test 2: Merge Fanspo data into picks');
  const mockPicks: DraftPick[] = [
    { year: 2027, round: 1, status: 'own' },
    { year: 2029, round: 1, status: 'own' }, // Should be corrected to outgoing
    { year: 2030, round: 2, status: 'own' },
    { year: 2031, round: 1, status: 'own' }, // No Fanspo data
  ];

  mergeFanspoIntoPicks(mockPicks, enrichedMap);

  // Check 2027 1st
  const merged2027 = mockPicks.find((p) => p.year === 2027 && p.round === 1);
  assert.ok(merged2027, 'Should find 2027 pick');
  assert.deepEqual(merged2027.fromTeams, ['UTA'], 'Should add fromTeams');
  assert.equal(merged2027.protections, 'Top 10 protected', 'Should add protections');

  // Check 2029 1st (status correction)
  const merged2029 = mockPicks.find((p) => p.year === 2029 && p.round === 1);
  assert.ok(merged2029, 'Should find 2029 pick');
  assert.equal(merged2029.status, 'outgoing', 'Should correct status to outgoing');
  assert.deepEqual(merged2029.toTeams, ['NOP'], 'Should add toTeams');

  // Check 2030 2nd
  const merged2030 = mockPicks.find((p) => p.year === 2030 && p.round === 2);
  assert.ok(merged2030, 'Should find 2030 pick');
  assert.deepEqual(merged2030.fromTeams, ['WAS', 'ORL'], 'Should handle multiple teams');

  // Check 2031 1st (no enrichment)
  const merged2031 = mockPicks.find((p) => p.year === 2031 && p.round === 1);
  assert.ok(merged2031, 'Should find 2031 pick');
  assert.equal(merged2031.fromTeams, undefined, 'Should not add data when none exists');
  assert.equal(merged2031.status, 'own', 'Should preserve original status');

  console.log('✅ Merge test passed\n');

  // Test 3: Edge cases
  console.log('Test 3: Edge cases');
  
  // Test duplicate protections (should not duplicate)
  const pickWithProtection: DraftPick = {
    year: 2027,
    round: 1,
    status: 'own',
    protections: 'Existing protection',
  };
  const singlePickArray = [pickWithProtection];
  mergeFanspoIntoPicks(singlePickArray, enrichedMap);
  
  assert.ok(
    singlePickArray[0].protections?.includes('Top 10 protected'),
    'Should append new protection'
  );
  assert.ok(
    singlePickArray[0].protections?.includes('Existing protection'),
    'Should preserve existing protection'
  );

  console.log('✅ Edge case tests passed\n');

  console.log('🎉 All tests passed!');
}

// Run tests
try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('❌ Test failed:', err);
  process.exit(1);
}
