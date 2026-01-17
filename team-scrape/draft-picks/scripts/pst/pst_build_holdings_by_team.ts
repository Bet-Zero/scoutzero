#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { ALL_TEAM_CODES } from './pst_team_slugs';

/**
 * pst_build_holdings_by_team.ts
 *
 * GOAL: Produce a team-centric view of the pick ledger.
 */

const LEDGER_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_ledger_with_display_owner.json'
);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_holdings_by_team.json'
);

type LedgerItem = {
  pickId: string;
  originalTeam: string;
  year: number;
  round: number;
  owner: string;
};

type TeamHoldings = {
  team: string; // Team Code
  picks: string[]; // List of Pick IDs
};

async function main() {
  console.log('Building Team Holdings View...');

  const ledger = JSON.parse(
    await fs.readFile(LEDGER_PATH, 'utf-8')
  ) as LedgerItem[];

  // Initialize map for all teams
  const holdingsMap = new Map<string, LedgerItem[]>();
  for (const team of ALL_TEAM_CODES) {
    holdingsMap.set(team, []);
  }

  // Populate map (add verification of valid owner)
  for (const item of ledger) {
    if (!holdingsMap.has(item.owner)) {
      console.warn(
        `⚠️  Pick ${item.pickId} has unknown owner: ${item.owner}`
      );
      // For now, create entry to avoid crash but this should be caught by validation
      holdingsMap.set(item.owner, []);
    }
    holdingsMap.get(item.owner)!.push(item);
  }

  // Build output list
  const result: TeamHoldings[] = [];

  for (const teamCode of ALL_TEAM_CODES) {
    const items = holdingsMap.get(teamCode) || [];

    // Sort: year asc, round asc, originalTeam asc
    items.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.round !== b.round) return a.round - b.round;
      return a.originalTeam.localeCompare(b.originalTeam);
    });

    result.push({
      team: teamCode,
      picks: items.map((i) => i.pickId),
    });
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`✅ Holdings view written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
