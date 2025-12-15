#!/usr/bin/env tsx
/**
 * RealGM Team ID Discovery Script
 *
 * Tests IDs 1-50 for each NBA team to find their RealGM draft picks page ID.
 * Outputs a map that can be added to realgm_draft_picks.ts
 *
 * NOTE: All team IDs have been discovered and are now stored in realgm_draft_picks.ts
 * in the REALGM_TEAM_URLS constant. This script is kept for reference or future
 * re-discovery if RealGM changes their URL structure.
 *
 * Reference mapping (all IDs discovered):
 * ATL: 1, BOS: 2, BKN: 38, CHA: 3, CHI: 4, CLE: 5, DAL: 6, DEN: 7,
 * DET: 8, GSW: 9, HOU: 10, IND: 11, LAC: 12, LAL: 13, MEM: 14, MIA: 15,
 * MIL: 16, MIN: 17, NOP: 19, NYK: 20, OKC: 33, ORL: 21, PHI: 22, PHX: 23,
 * POR: 24, SAC: 25, SAS: 26, TOR: 28, UTA: 29, WAS: 30
 */

import { chromium } from 'playwright';

const ALL_TEAMS = [
  { code: 'ATL', name: 'Atlanta Hawks', slug: 'Atlanta-Hawks' },
  { code: 'BOS', name: 'Boston Celtics', slug: 'Boston-Celtics' },
  { code: 'BKN', name: 'Brooklyn Nets', slug: 'Brooklyn-Nets' },
  { code: 'CHA', name: 'Charlotte Hornets', slug: 'Charlotte-Hornets' },
  { code: 'CHI', name: 'Chicago Bulls', slug: 'Chicago-Bulls' },
  { code: 'CLE', name: 'Cleveland Cavaliers', slug: 'Cleveland-Cavaliers' },
  { code: 'DAL', name: 'Dallas Mavericks', slug: 'Dallas-Mavericks' },
  { code: 'DEN', name: 'Denver Nuggets', slug: 'Denver-Nuggets' },
  { code: 'DET', name: 'Detroit Pistons', slug: 'Detroit-Pistons' },
  { code: 'GSW', name: 'Golden State Warriors', slug: 'Golden-State-Warriors' },
  { code: 'HOU', name: 'Houston Rockets', slug: 'Houston-Rockets' },
  { code: 'IND', name: 'Indiana Pacers', slug: 'Indiana-Pacers' },
  { code: 'LAC', name: 'LA Clippers', slug: 'LA-Clippers' },
  { code: 'LAL', name: 'Los Angeles Lakers', slug: 'Los-Angeles-Lakers' },
  { code: 'MEM', name: 'Memphis Grizzlies', slug: 'Memphis-Grizzlies' },
  { code: 'MIA', name: 'Miami Heat', slug: 'Miami-Heat' },
  { code: 'MIL', name: 'Milwaukee Bucks', slug: 'Milwaukee-Bucks' },
  {
    code: 'MIN',
    name: 'Minnesota Timberwolves',
    slug: 'Minnesota-Timberwolves',
  },
  { code: 'NOP', name: 'New Orleans Pelicans', slug: 'New-Orleans-Pelicans' },
  { code: 'NYK', name: 'New York Knicks', slug: 'New-York-Knicks' },
  { code: 'OKC', name: 'Oklahoma City Thunder', slug: 'Oklahoma-City-Thunder' },
  { code: 'ORL', name: 'Orlando Magic', slug: 'Orlando-Magic' },
  { code: 'PHI', name: 'Philadelphia 76ers', slug: 'Philadelphia-Sixers' },
  { code: 'PHX', name: 'Phoenix Suns', slug: 'Phoenix-Suns' },
  {
    code: 'POR',
    name: 'Portland Trail Blazers',
    slug: 'Portland-Trail-Blazers',
  },
  { code: 'SAC', name: 'Sacramento Kings', slug: 'Sacramento-Kings' },
  { code: 'SAS', name: 'San Antonio Spurs', slug: 'San-Antonio-Spurs' },
  { code: 'TOR', name: 'Toronto Raptors', slug: 'Toronto-Raptors' },
  { code: 'UTA', name: 'Utah Jazz', slug: 'Utah-Jazz' },
  { code: 'WAS', name: 'Washington Wizards', slug: 'Washington-Wizards' },
];

// Filter to just teams we need immediately
const TEAMS_TO_DISCOVER =
  process.env.TEAMS?.split(',').map((c) => c.trim()) ||
  ALL_TEAMS.map((t) => t.code); // Changed from ['ATL', 'BKN'] to all teams

async function testTeamId(
  team: (typeof ALL_TEAMS)[0],
  id: number
): Promise<boolean> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    });

    const url = `https://basketball.realgm.com/nba/teams/${team.slug}/${id}/draft-picks`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const html = await page.content();
      const isValid = html.includes(`${team.name} Future 1st Round Picks`);
      await page.close();
      return isValid;
    } catch (error) {
      await page.close();
      return false;
    }
  } finally {
    await browser.close();
  }
}

async function discoverTeamId(team: (typeof ALL_TEAMS)[0]): Promise<number | null> {
  console.log(`🔍 Testing ${team.code} (${team.name})...`);

  // Test IDs 1-50
  for (let id = 1; id <= 50; id++) {
    const isValid = await testTeamId(team, id);
    if (isValid) {
      console.log(`   ✅ Found ID: ${id}`);
      return id;
    }
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`   ❌ No valid ID found in range 1-50`);
  return null;
}

async function main() {
  const TEAMS = ALL_TEAMS.filter((t) => TEAMS_TO_DISCOVER.includes(t.code));
  const results: Array<{
    code: string;
    name: string;
    slug: string;
    id: number | null;
  }> = [];

  for (const team of TEAMS) {
    const id = await discoverTeamId(team);
    results.push({ ...team, id });

    // Delay between teams
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n📋 Results:\n');
  console.log(
    'const REALGM_TEAM_URLS: Record<string, { code: string; name: string; url: string }> = {'
  );

  for (const result of results) {
    if (result.id) {
      const url = `https://basketball.realgm.com/nba/teams/${result.slug}/${result.id}/draft-picks`;
      console.log(`  ${result.code}: {`);
      console.log(`    code: '${result.code}',`);
      console.log(`    name: '${result.name}',`);
      console.log(`    url: '${url}',`);
      console.log(`  },`);
    } else {
      console.log(`  // ${result.code}: ${result.name} - ID NOT FOUND`);
    }
  }

  console.log('};');
}

main().catch(console.error);
