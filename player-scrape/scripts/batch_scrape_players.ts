// batch_scrape_players.ts — Batch scrape multiple players from SalarySwish
//
// DESCRIPTION:
//   Scrapes contract data for multiple NBA players from a CSV/JSON input file.
//   Outputs individual JSON files for each player ready for basePlayers collection.
//
// RUN:
//   PLAYERS_FILE="players_list.json" OUTPUT_DIR="output/players" npx tsx player-scrape/scripts/batch_scrape_players.ts
//
// INPUT FORMAT (players_list.json):
//   [
//     { "playerId": "lebron_james", "slug": "lebron-james", "teamCode": "LAL" },
//     { "playerId": "stephen_curry", "slug": "stephen-curry", "teamCode": "GSW" },
//     ...
//   ]
//
// ENVIRONMENT VARIABLES:
//   PLAYERS_FILE - Path to JSON file with player list (default: ../examples/players_list_sample.json)
//   OUTPUT_DIR - Directory for output files (default: ../output/players)
//   RATE_LIMIT_MS - Delay between requests in ms (default: 2000)
//   SKIP_FETCH - Set to "1" to skip fetching (use existing page.html files)

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, Browser, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PlayerInput {
  playerId: string;
  slug: string;
  teamCode: string;
}

interface ScraperConfig {
  playersFile: string;
  outputDir: string;
  rateLimitMs: number;
  skipFetch: boolean;
}

const config: ScraperConfig = {
  playersFile:
    process.env.PLAYERS_FILE ||
    join(__dirname, '../examples/players_list_sample.json'),
  outputDir: process.env.OUTPUT_DIR || join(__dirname, '../output/players'),
  rateLimitMs: parseInt(process.env.RATE_LIMIT_MS || '2000'),
  skipFetch: process.env.SKIP_FETCH === '1',
};

// Import parsing logic from parse_player.ts (we'll need to extract to a module later)
// For now, inline the essential parsing

type Money = number;

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const moneyNum = (s?: string) => {
  if (!s) return undefined;
  const v = Number(s.replace(/[$,]/g, ''));
  return Number.isFinite(v) ? v : undefined;
};

function findHeading(
  $: cheerio.CheerioAPI,
  tag: 'h3' | 'h4' | 'h5',
  includes: string
) {
  const needle = includes.toLowerCase();
  const nodes = $(tag);
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.eq(i);
    if (norm(el.text()).toLowerCase().includes(needle)) return el;
  }
  return null;
}

async function fetchPlayerPage(
  slug: string,
  browser: Browser,
  context: BrowserContext
): Promise<string> {
  const url = `https://salaryswish.com/players/${slug}`;
  console.log(`  🔍 Fetching: ${url}`);

  const page = await context.newPage();

  try {
    // Navigate and wait for network idle
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for salary table to be rendered
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
      console.warn('  ⚠️  No table found for', slug);
    });

    // Extra wait for dynamic content
    await page.waitForTimeout(1000);

    // Get fully rendered HTML
    const html = await page.content();
    return html;
  } finally {
    await page.close();
  }
}

async function parsePlayerData(
  html: string,
  playerId: string,
  teamCode: string,
  playerUrl: string
) {
  const $ = cheerio.load(html);

  // Extract player name
  const displayName =
    norm($('h1').first().text()) || playerId.replace(/_/g, ' ');

  // Extract team name
  const teamText = $('body').text();
  const teamNameMatch = teamText.match(/Team[:\s]+[A-Z]{2,3}\s+-\s+([^\n]+)/i);
  const teamName = teamNameMatch ? norm(teamNameMatch[1]) : '';

  // Extract bio
  const posMatch = teamText.match(/Position[:\s]+([A-Z]+)/i);
  const heightMatch = teamText.match(/Height[:\s]+([\d-]+)/i);
  const weightMatch = teamText.match(/Weight[:\s]+(\d+)/i);
  const ageMatch = teamText.match(/Age[:\s]+(\d+)/i);
  const birthdateMatch = teamText.match(/Born[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const expMatch = teamText.match(/Experience[:\s]+(\d+)/i);

  const bio = {
    position: posMatch ? posMatch[1] : undefined,
    height: heightMatch ? heightMatch[1] : undefined,
    weight: weightMatch ? weightMatch[1] : undefined,
    age: ageMatch ? parseInt(ageMatch[1]) : undefined,
    birthdate: birthdateMatch ? birthdateMatch[1] : undefined,
    experience: expMatch ? parseInt(expMatch[1]) : undefined,
  };

  // Parse contract type
  let contractTypeHeading: cheerio.Cheerio | null = null;
  $('h3').each((i, el) => {
    const text = norm($(el).text()).toUpperCase();
    if (
      text.includes('CONTRACT') ||
      text.includes('EXTENSION') ||
      text.includes('ROOKIE') ||
      text.includes('DESIGNATED') ||
      text.includes('TWO-WAY')
    ) {
      contractTypeHeading = $(el);
      return false;
    }
  });

  let contractTypeText = '';
  if (contractTypeHeading) {
    contractTypeText = norm(contractTypeHeading.text()).toUpperCase();
  } else {
    contractTypeText = teamText.toUpperCase();
  }

  const isExtension = contractTypeText.includes('EXTENSION');
  const isRookieScale =
    contractTypeText.includes('ROOKIE') || contractTypeText.includes('SCALE');
  const isDesignated = contractTypeText.includes('DESIGNATED');
  const isTwoWay =
    contractTypeText.includes('TWO-WAY') || contractTypeText.includes('2-WAY');

  let contractType = 'VETERAN CONTRACT';
  if (isTwoWay) contractType = 'TWO-WAY';
  else if (isDesignated && isRookieScale)
    contractType = 'DESIGNATED ROOKIE EXTENSION';
  else if (isRookieScale) contractType = 'ROOKIE SCALE';
  else if (isExtension) contractType = 'VETERAN EXTENSION';

  // Parse salary table
  const salariesByYear: any[] = [];
  const table = $('table').filter((i, el) => {
    const text = $(el).text();
    return text.includes('Season') && text.includes('Salary');
  });

  if (table.length) {
    table.find('tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;

      const season = norm(cells.eq(0).text());
      const salary = moneyNum(cells.eq(1).text());

      if (!season || !salary) return;

      const rowText = $(row).text().toLowerCase();
      const guaranteed =
        !rowText.includes('non-guaranteed') && !rowText.includes('ng');

      let option = null;
      if (rowText.includes('player option') || rowText.includes('po'))
        option = 'PO';
      else if (rowText.includes('team option') || rowText.includes('to'))
        option = 'TO';
      else if (rowText.includes('eto')) option = 'ETO';

      const tradeBonusMatch = rowText.match(/(\d+)%\s+trade\s+kicker/i);
      const tradeBonus = tradeBonusMatch ? parseInt(tradeBonusMatch[1]) : null;

      salariesByYear.push({
        season,
        salary,
        capHit: salary,
        guaranteed,
        guaranteedAmount: guaranteed ? salary : 0,
        option,
        tradeBonus,
        incentives: { likely: 0, unlikely: 0 },
      });
    });
  }

  // Calculate contract summary
  const startSeason = salariesByYear[0]?.season || '2025-26';
  const endSeason =
    salariesByYear[salariesByYear.length - 1]?.season || startSeason;
  const contractLength = salariesByYear.length;
  const totalValue = salariesByYear.reduce((sum, y) => sum + y.salary, 0);
  const averageAnnualValue = totalValue / contractLength;
  const guaranteedValue = salariesByYear.reduce(
    (sum, y) => sum + y.guaranteedAmount,
    0
  );
  const guaranteedYears = salariesByYear.filter((y) => y.guaranteed).length;

  const currentSeasonYear = 2025;
  const endSeasonYear = parseInt(endSeason.split('-')[0]);
  const yearsRemaining = Math.max(0, endSeasonYear - currentSeasonYear + 1);

  // Parse signing details
  const signedUsingMatch = teamText.match(/Signed Using[:\s]+([^\n]+)/i);
  const signedUsing = signedUsingMatch ? norm(signedUsingMatch[1]) : undefined;

  const dateMatch = teamText.match(/Signed[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const signingDate = dateMatch ? dateMatch[1] : undefined;

  const teamMatch = teamText.match(/Signing Team[:\s]+([A-Z]{2,3})/i);
  const signingTeam = teamMatch ? teamMatch[1] : teamCode;
  const signedByCurrentTeam = signingTeam === teamCode;

  // Parse signing executive — "SIGNED BY: <name>" (appears in contract header, often in a link)
  // Match pattern: "SIGNED BY: <a href="/staff/name">Executive Name</a>" or "SIGNED BY: Executive Name"
  const signingExecutive = teamText.match(/SIGNED\s*BY:\s*(?:<[^>]+>)?([A-Za-z][A-Za-z\s.'-]+?)(?:<[^>]*>)?(?=\s*(?:AGENT|PRIMARY\s*AGENT|BIRD\s*RIGHTS|$))/i)?.[1]?.trim();

  // Parse Bird rights
  const birdMatch1 = teamText.match(
    /Bird\s+Rights[:\s]+((?:Early\s+)?Bird|Non-Bird|None)(?:\s|$)/i
  );
  let birdStatus = 'None';

  if (birdMatch1) {
    birdStatus = norm(birdMatch1[1]);
  } else {
    const birdMatch2 = teamText.match(
      /Bird\s+Rights[:\s]+([A-Za-z\s]+?)(?:\n|\r|Free Agency|Cap Hold|Trade|$)/i
    );
    if (birdMatch2) {
      const extracted = norm(birdMatch2[1]).trim();
      birdStatus = extracted
        .replace(/\s*(and|Free Agency|Cap Hold).*$/i, '')
        .trim();

      if (!birdStatus || birdStatus.length > 50) birdStatus = 'None';
      if (birdStatus.toLowerCase().includes('full')) birdStatus = 'Bird';
    }
  }

  const eligibleFor: string[] = [];
  if (birdStatus === 'Bird' || birdStatus === 'Full Bird') {
    eligibleFor.push('Bird Exception');
  }
  if (birdStatus === 'Bird' || birdStatus === 'Early Bird') {
    eligibleFor.push('Early Bird Exception');
  }

  const birdRights = {
    status: birdStatus,
    eligibleFor: eligibleFor.length > 0 ? eligibleFor : undefined,
  };

  // Parse free agency
  const faMatch = teamText.match(/(RFA|UFA)[\s:]+(\d{4})/i);
  const faType = faMatch ? faMatch[1].toUpperCase() : null;
  const faYear = faMatch ? parseInt(faMatch[2]) : undefined;

  const capHoldMatch = teamText.match(/Cap Hold[:\s]+\$?([\d,]+)/i);
  const capHold = capHoldMatch ? moneyNum(capHoldMatch[1]) : undefined;

  const freeAgency = {
    type: faType,
    year: faYear,
    capHold,
    qualifyingOffer: null,
    earlyTerminationOption: null,
  };

  // Parse trade eligibility
  const restrictedMatch = teamText.match(
    /Cannot be traded until[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  const restrictedUntil = restrictedMatch ? restrictedMatch[1] : null;

  let reason = null;
  if (restrictedUntil) {
    if (teamText.includes('recently signed')) reason = 'Recent signing';
    else if (teamText.includes('recently traded')) reason = 'Recent trade';
    else if (teamText.includes('extension')) reason = 'Recent extension';
  }

  const canBeTradedNow = !restrictedUntil;

  const baseYearCompensation =
    teamText.toLowerCase().includes('base year compensation') ||
    teamText.toLowerCase().includes('byc');
  const poisonPill =
    isRookieScale && teamText.toLowerCase().includes('poison pill');
  const aggregation = !teamText.toLowerCase().includes('cannot be aggregated');

  const tradeEligibility = {
    canBeTradedNow,
    restrictedUntil,
    reason,
    rules: {
      baseYearCompensation,
      poisonPill,
      aggregation,
    },
  };

  const hasNTC =
    teamText.toLowerCase().includes('no-trade clause') ||
    teamText.toLowerCase().includes('ntc');
  const kickerMatch = teamText.match(/(\d+)%\s+trade\s+kicker/i);
  const tradeKicker = kickerMatch ? parseInt(kickerMatch[1]) : null;

  // Build output
  return {
    playerId,
    displayName,
    teamCode,
    teamName,
    bio,
    contract: {
      contractType,
      isExtension,
      isRookieScale,
      signedUsing,
      signingTeam,
      signingDate,
      signingExecutive,
      signedByCurrentTeam,
      startSeason,
      endSeason,
      contractLength,
      yearsRemaining,
      totalValue,
      averageAnnualValue,
      guaranteedValue,
      guaranteedYears,
      salariesByYear,
      noTradeClause: hasNTC,
      tradeKicker,
      tradeRestrictions: [],
      birdRights,
      freeAgency,
      tradeEligibility,
    },
    source: {
      provider: 'SalarySwish',
      playerPageUrl: playerUrl,
      scrapedAt: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
    version: '1.0',
  };
}

async function batchScrape() {
  console.log('🏀 Batch Player Scraper for basePlayers');
  console.log('=====================================\n');

  // Load players list
  if (!existsSync(config.playersFile)) {
    console.error(`❌ Players file not found: ${config.playersFile}`);
    console.error(
      'Create a JSON file with format: [{ "playerId": "...", "slug": "...", "teamCode": "..." }]'
    );
    process.exit(1);
  }

  const playersList: PlayerInput[] = JSON.parse(
    await fs.readFile(config.playersFile, 'utf-8')
  );
  console.log(
    `📋 Loaded ${playersList.length} players from ${config.playersFile}`
  );

  // Create output directory
  await fs.mkdir(config.outputDir, { recursive: true });
  console.log(`📁 Output directory: ${config.outputDir}\n`);

  // Initialize browser if not skipping fetch
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  if (!config.skipFetch) {
    console.log('🌐 Launching browser...\n');
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
  }

  let successCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < playersList.length; i++) {
      const player = playersList[i];
      console.log(
        `[${i + 1}/${playersList.length}] Processing ${player.playerId}...`
      );

      try {
        let html: string;

        if (config.skipFetch) {
          // Load from existing file
          const htmlPath = join(__dirname, 'page.html');
          html = await fs.readFile(htmlPath, 'utf-8');
        } else {
          // Fetch from SalarySwish with browser
          html = await fetchPlayerPage(player.slug, browser!, context!);
        }

        // Parse player data
        const playerUrl = `https://salaryswish.com/players/${player.slug}`;
        const playerData = await parsePlayerData(
          html,
          player.playerId,
          player.teamCode,
          playerUrl
        );

        // Save to output file
        const outputPath = join(config.outputDir, `${player.playerId}.json`);
        await fs.writeFile(
          outputPath,
          JSON.stringify(playerData, null, 2),
          'utf-8'
        );

        console.log(
          `  ✅ Success: ${playerData.displayName} (${playerData.contract.contractType})`
        );
        console.log(
          `     Years: ${playerData.contract.contractLength}, Value: $${(playerData.contract.totalValue / 1000000).toFixed(1)}M\n`
        );

        successCount++;

        // Rate limiting
        if (!config.skipFetch && i < playersList.length - 1) {
          console.log(`  ⏳ Rate limiting (${config.rateLimitMs}ms)...\n`);
          await new Promise((resolve) =>
            setTimeout(resolve, config.rateLimitMs)
          );
        }
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}\n`);
        failCount++;
      }
    }
  } finally {
    // Clean up browser
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }

  console.log('\n=====================================');
  console.log('📊 Batch Scrape Complete');
  console.log(`✅ Success: ${successCount}/${playersList.length}`);
  console.log(`❌ Failed: ${failCount}/${playersList.length}`);
  console.log(`📁 Output: ${config.outputDir}`);
}

batchScrape().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
