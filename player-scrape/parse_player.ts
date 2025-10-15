// parse_player.ts — SalarySwish player page → basePlayers JSON
//
// DESCRIPTION:
//   Parses NBA player contract data from SalarySwish player pages into structured JSON.
//   Extracts contract details, Bird rights, trade eligibility, and free agency info.
//
// RUN:
//   npm pkg set scripts.parse-player="tsx player-scrape/parse_player.ts"
//   PLAYER_URL="https://salaryswish.com/players/austin-reaves" PLAYER_ID="austin_reaves" npm run parse-player
//
// ENVIRONMENT VARIABLES:
//   PLAYER_URL - Player page URL (default: from page.html if previously fetched)
//   PLAYER_ID - Player ID for output (default: extracted from URL)
//   TEAM_CODE - Team code (optional, extracted from page if not provided)
//
// OUTPUT:
//   ./player-scrape/player.json - Structured JSON matching player_scrape_schema.ts
//
// Requires: cheerio, got

import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

type Money = number;

// Utility functions
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

function extractTextBetweenHeadings(
  $: cheerio.CheerioAPI,
  start: cheerio.Cheerio,
  stopTag: string = 'h3'
) {
  const text: string[] = [];
  let cur = start.next();
  while (cur.length) {
    const tag = (cur.get(0) as any)?.name?.toLowerCase?.();
    if (tag === stopTag) break;
    text.push(norm(cur.text()));
    cur = cur.next();
  }
  return text.join(' ');
}

// Parse contract type and determine if it's an extension or rookie scale
function parseContractType($: cheerio.CheerioAPI): {
  type: string;
  isExtension: boolean;
  isRookieScale: boolean;
} {
  // Try to find any H3 that might be a contract type
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
      return false; // break
    }
  });

  let text = '';
  if (contractTypeHeading) {
    text = norm(contractTypeHeading.text()).toUpperCase();
  } else {
    // If no H3 found, check body text for contract type keywords
    text = $('body').text().toUpperCase();
  }

  const isExtension = text.includes('EXTENSION');
  const isRookieScale = text.includes('ROOKIE') || text.includes('SCALE');
  const isDesignated = text.includes('DESIGNATED');
  const isTwoWay = text.includes('TWO-WAY') || text.includes('2-WAY');

  if (isTwoWay) return { type: 'TWO-WAY', isExtension, isRookieScale: false };
  if (isDesignated && isRookieScale)
    return {
      type: 'DESIGNATED ROOKIE EXTENSION',
      isExtension: true,
      isRookieScale: true,
    };
  if (isRookieScale)
    return { type: 'ROOKIE SCALE', isExtension, isRookieScale: true };
  if (isExtension)
    return {
      type: 'VETERAN EXTENSION',
      isExtension: true,
      isRookieScale: false,
    };

  return { type: 'VETERAN CONTRACT', isExtension, isRookieScale };
}

// Extract signing details
function parseSigningDetails($: cheerio.CheerioAPI, currentTeam: string) {
  const text = $('body').text();

  // Find "Signed Using" text
  const signedUsingMatch = text.match(/Signed Using[:\s]+([^\n]+)/i);
  const signedUsing = signedUsingMatch ? norm(signedUsingMatch[1]) : undefined;

  // Find signing date
  const dateMatch = text.match(/Signed[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const signingDate = dateMatch ? dateMatch[1] : undefined;

  // Find signing team
  const teamMatch = text.match(/Signing Team[:\s]+([A-Z]{2,3})/i);
  const signingTeam = teamMatch ? teamMatch[1] : currentTeam;

  const signedByCurrentTeam = signingTeam === currentTeam;

  return { signedUsing, signingTeam, signingDate, signedByCurrentTeam };
}

// Parse Bird rights information
function parseBirdRights($: cheerio.CheerioAPI) {
  const text = $('body').text();

  // Look for Bird rights status - try multiple patterns
  let status = 'None';

  // Pattern 1: "Bird Rights: <status>" where status is on same line
  const birdMatch1 = text.match(
    /Bird\s+Rights[:\s]+((?:Early\s+)?Bird|Non-Bird|None)(?:\s|$)/i
  );
  if (birdMatch1) {
    status = norm(birdMatch1[1]);
  } else {
    // Pattern 2: Look for variations
    const birdMatch2 = text.match(
      /Bird\s+Rights[:\s]+([A-Za-z\s]+?)(?:\n|\r|Free Agency|Cap Hold|Trade|$)/i
    );
    if (birdMatch2) {
      const extracted = norm(birdMatch2[1]).trim();
      // Clean up common suffixes
      status = extracted
        .replace(/\s*(and|Free Agency|Cap Hold).*$/i, '')
        .trim();

      // Default to "Bird" if we found something that looks like bird rights
      if (!status || status.length > 50) status = 'None';
      if (status.toLowerCase().includes('full')) status = 'Bird';
    }
  }

  // Extract years of service (if available)
  const yearsMatch = text.match(/(\d+)\s+years?\s+with\s+team/i);
  const yearsWithTeam = yearsMatch ? parseInt(yearsMatch[1]) : undefined;

  const eligibleFor: string[] = [];
  if (status === 'Bird' || status === 'Full Bird') {
    eligibleFor.push('Bird Exception');
  }
  if (status === 'Bird' || status === 'Early Bird') {
    eligibleFor.push('Early Bird Exception');
  }

  return {
    status,
    yearsOfService: yearsWithTeam,
    yearsWithTeam,
    eligibleFor: eligibleFor.length > 0 ? eligibleFor : undefined,
  };
}

// Parse free agency information
function parseFreeAgency($: cheerio.CheerioAPI, endSeason: string) {
  const text = $('body').text();

  // Look for FA type
  const faMatch = text.match(/(RFA|UFA)[\s:]+(\d{4})/i);
  const type = faMatch ? faMatch[1].toUpperCase() : null;
  const year = faMatch ? parseInt(faMatch[2]) : undefined;

  // Look for cap hold
  const capHoldMatch = text.match(/Cap Hold[:\s]+\$?([\d,]+)/i);
  const capHold = capHoldMatch ? moneyNum(capHoldMatch[1]) : undefined;

  // Look for qualifying offer (for RFAs)
  const qoMatch = text.match(/Qualifying Offer[:\s]+\$?([\d,]+)/i);
  const qualifyingOffer = qoMatch ? moneyNum(qoMatch[1]) : null;

  return { type, year, capHold, qualifyingOffer, earlyTerminationOption: null };
}

// Parse trade eligibility
function parseTradeEligibility(
  $: cheerio.CheerioAPI,
  signingDate: string | undefined,
  isRookieScale: boolean
) {
  const text = $('body').text();

  // Check for trade restrictions
  const restrictedMatch = text.match(
    /Cannot be traded until[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  const restrictedUntil = restrictedMatch ? restrictedMatch[1] : null;

  let reason = null;
  if (restrictedUntil) {
    if (text.includes('recently signed')) reason = 'Recent signing';
    else if (text.includes('recently traded')) reason = 'Recent trade';
    else if (text.includes('extension')) reason = 'Recent extension';
  }

  const canBeTradedNow = !restrictedUntil;

  // Determine trade rules
  const baseYearCompensation =
    text.toLowerCase().includes('base year compensation') ||
    text.toLowerCase().includes('byc');
  const poisonPill =
    isRookieScale && text.toLowerCase().includes('poison pill');
  const aggregation = !text.toLowerCase().includes('cannot be aggregated');

  return {
    canBeTradedNow,
    restrictedUntil,
    reason,
    rules: {
      baseYearCompensation,
      poisonPill,
      aggregation,
    },
  };
}

// Parse salary table
function parseSalaryTable($: cheerio.CheerioAPI, table: cheerio.Cheerio) {
  const salariesByYear: any[] = [];

  // Parse table rows
  table.find('tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;

    const season = norm(cells.eq(0).text());
    const salaryText = cells.eq(1).text();
    const salary = moneyNum(salaryText);

    if (!season || !salary) return;

    // Determine if guaranteed
    const rowText = $(row).text().toLowerCase();
    const guaranteed =
      !rowText.includes('non-guaranteed') && !rowText.includes('ng');

    // Check for options
    let option = null;
    if (rowText.includes('player option') || rowText.includes('po'))
      option = 'PO';
    else if (rowText.includes('team option') || rowText.includes('to'))
      option = 'TO';
    else if (rowText.includes('eto')) option = 'ETO';

    // Check for trade bonus/kicker
    const tradeBonusMatch = rowText.match(/(\d+)%\s+trade\s+kicker/i);
    const tradeBonus = tradeBonusMatch ? parseInt(tradeBonusMatch[1]) : null;

    // Incentives (if specified)
    const likelyMatch = rowText.match(/\$?([\d,]+)\s+likely/i);
    const unlikelyMatch = rowText.match(/\$?([\d,]+)\s+unlikely/i);

    salariesByYear.push({
      season,
      salary,
      capHit: salary, // Default to salary, can be different if incentives
      guaranteed,
      guaranteedAmount: guaranteed ? salary : 0,
      option,
      tradeBonus,
      incentives: {
        likely: likelyMatch ? moneyNum(likelyMatch[1]) || 0 : 0,
        unlikely: unlikelyMatch ? moneyNum(unlikelyMatch[1]) || 0 : 0,
      },
    });
  });

  return salariesByYear;
}

// Detect if a contract is an extension based on heading/context
function detectExtension(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio | null
): boolean {
  if (!heading) return false;

  const headingText = norm(heading.text()).toLowerCase();
  const extensionKeywords = ['extension', 'extend', 'extended', 'supermax'];

  return extensionKeywords.some((keyword) => headingText.includes(keyword));
}

// Find all salary tables and their associated headings
function findSalaryTables($: cheerio.CheerioAPI) {
  const tables: Array<{
    table: cheerio.Cheerio;
    heading: cheerio.Cheerio | null;
    isExtension: boolean;
  }> = [];

  $('table').each((i, el) => {
    const table = $(el);
    const text = table.text();

    // Check if this is a salary table
    if (text.includes('Season') && text.includes('Salary')) {
      // Find the heading (h3, h4, h5) before this table
      let heading: cheerio.Cheerio | null = null;
      let current = table.prev();

      while (current.length) {
        const tag = (current.get(0) as any)?.name?.toLowerCase?.();
        if (tag === 'h3' || tag === 'h4' || tag === 'h5') {
          heading = current;
          break;
        }
        current = current.prev();
      }

      const isExtension = detectExtension($, heading);
      tables.push({ table, heading, isExtension });
    }
  });

  return tables;
}

// Main parsing function
async function parsePlayerPage() {
  const playerUrl = process.env.PLAYER_URL || '';
  const playerId =
    process.env.PLAYER_ID ||
    playerUrl.split('/').pop()?.replace(/-/g, '_') ||
    'unknown';
  const teamCodeEnv = process.env.TEAM_CODE;

  // Read HTML from file
  const htmlPath = join(__dirname, 'page.html');
  const html = await fs.readFile(htmlPath, 'utf-8');

  console.log(`📄 Parsing player page (${(html.length / 1024).toFixed(2)} KB)`);

  const $ = cheerio.load(html);

  // Extract player name
  const playerNameEl = $('h1').first();
  const displayName = norm(playerNameEl.text()) || playerId.replace(/_/g, ' ');

  // Extract team info
  const teamText = $('body').text();
  const teamMatch = teamText.match(/Team[:\s]+([A-Z]{2,3})/i);
  const teamCode = teamCodeEnv || (teamMatch ? teamMatch[1] : 'UNK');

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

  // Parse contract details
  const {
    type: contractType,
    isExtension,
    isRookieScale,
  } = parseContractType($);
  const signingDetails = parseSigningDetails($, teamCode);
  const birdRights = parseBirdRights($);

  // Find all salary tables (could be current contract + future extension)
  const salaryTables = findSalaryTables($);

  if (salaryTables.length === 0) {
    console.warn('⚠️  No salary table found');
  }

  // Parse the first table as the primary contract
  const salariesByYear =
    salaryTables.length > 0 ? parseSalaryTable($, salaryTables[0].table) : [];

  // Calculate contract summary for primary contract
  const startSeason = salariesByYear[0]?.season || '2025-26';
  const endSeason =
    salariesByYear[salariesByYear.length - 1]?.season || startSeason;
  const contractLength = salariesByYear.length;
  const totalValue = salariesByYear.reduce((sum, y) => sum + y.salary, 0);
  const averageAnnualValue =
    contractLength > 0 ? totalValue / contractLength : 0;
  const guaranteedValue = salariesByYear.reduce(
    (sum, y) => sum + y.guaranteedAmount,
    0
  );
  const guaranteedYears = salariesByYear.filter((y) => y.guaranteed).length;

  // Calculate years remaining (from current season 2025-26)
  const currentSeasonYear = 2025;
  const endSeasonYear = parseInt((endSeason || '2025-26').split('-')[0]);
  const yearsRemaining = Math.max(0, endSeasonYear - currentSeasonYear + 1);

  const freeAgency = parseFreeAgency($, endSeason);
  const tradeEligibility = parseTradeEligibility(
    $,
    signingDetails.signingDate,
    isRookieScale
  );

  // Check for no-trade clause
  const hasNTC =
    teamText.toLowerCase().includes('no-trade clause') ||
    teamText.toLowerCase().includes('ntc');

  // Check for trade kicker
  const kickerMatch = teamText.match(/(\d+)%\s+trade\s+kicker/i);
  const tradeKicker = kickerMatch ? parseInt(kickerMatch[1]) : null;

  // Parse future contract if multiple tables exist
  let futureContract = undefined;

  if (salaryTables.length > 1) {
    // Determine which is current vs future based on seasons
    const firstTableSeasons = salariesByYear.map((s) => s.season);
    const secondTableSalaries = parseSalaryTable($, salaryTables[1].table);
    const secondTableSeasons = secondTableSalaries.map((s) => s.season);

    // Safety check: only proceed if both tables have data
    if (firstTableSeasons.length > 0 && secondTableSeasons.length > 0) {
      // If second table starts after first table ends, it's a future contract
      const firstEndYear = parseInt(
        firstTableSeasons[firstTableSeasons.length - 1].split('-')[0]
      );
      const secondStartYear = parseInt(secondTableSeasons[0].split('-')[0]);

      if (secondStartYear >= firstEndYear) {
        // Second table is future extension
        const futureStartSeason = secondTableSeasons[0];
        const futureEndSeason =
          secondTableSeasons[secondTableSeasons.length - 1];
        const futureContractLength = secondTableSalaries.length;
        const futureTotalValue = secondTableSalaries.reduce(
          (sum, y) => sum + y.salary,
          0
        );
        const futureAverageAnnualValue =
          futureContractLength > 0
            ? futureTotalValue / futureContractLength
            : 0;
        const futureGuaranteedValue = secondTableSalaries.reduce(
          (sum, y) => sum + y.guaranteedAmount,
          0
        );
        const futureGuaranteedYears = secondTableSalaries.filter(
          (y) => y.guaranteed
        ).length;

        const futureEndSeasonYear = parseInt(futureEndSeason.split('-')[0]);
        const futureYearsRemaining = Math.max(
          0,
          futureEndSeasonYear - currentSeasonYear + 1
        );

        // Determine future contract type (likely an extension)
        let futureContractType = 'EXTENSION';
        if (salaryTables[1].isExtension || salaryTables[1].heading) {
          const headingText = salaryTables[1].heading
            ? norm(salaryTables[1].heading.text()).toUpperCase()
            : '';
          if (headingText.includes('DESIGNATED'))
            futureContractType = 'DESIGNATED EXTENSION';
          else if (headingText.includes('SUPERMAX'))
            futureContractType = 'SUPERMAX EXTENSION';
          else if (headingText.includes('ROOKIE'))
            futureContractType = 'ROOKIE EXTENSION';
          else if (headingText.includes('MAX'))
            futureContractType = 'MAX EXTENSION';
          else if (headingText.includes('VETERAN'))
            futureContractType = 'VETERAN EXTENSION';
          else if (headingText) futureContractType = headingText;
        }

        futureContract = {
          contractType: futureContractType,
          isExtension: true,
          isRookieScale: futureContractType.includes('ROOKIE'),
          signedUsing: undefined,
          signingTeam: teamCode,
          signingDate: undefined,
          signedByCurrentTeam: true,
          startSeason: futureStartSeason,
          endSeason: futureEndSeason,
          contractLength: futureContractLength,
          yearsRemaining: futureYearsRemaining,
          totalValue: futureTotalValue,
          averageAnnualValue: futureAverageAnnualValue,
          guaranteedValue: futureGuaranteedValue,
          guaranteedYears: futureGuaranteedYears,
          salariesByYear: secondTableSalaries,
          noTradeClause: hasNTC,
          tradeKicker,
          tradeRestrictions: [],
          birdRights,
          freeAgency: parseFreeAgency($, futureEndSeason),
          tradeEligibility: parseTradeEligibility(
            $,
            undefined,
            futureContractType.includes('ROOKIE')
          ),
        };

        console.log(
          `  📋 Found future contract: ${futureContractType} (${futureStartSeason} - ${futureEndSeason})`
        );
      }
    }
  }

  // Build output
  const output: any = {
    playerId,
    displayName,
    teamCode,
    teamName,
    bio,
    contract: {
      contractType,
      isExtension,
      isRookieScale,
      ...signingDetails,
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
      playerPageUrl: playerUrl || 'Unknown',
      scrapedAt: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
    version: '1.0',
  };

  // Add future contract if exists
  if (futureContract) {
    output.futureContract = futureContract;
  }

  // Write output
  const outputPath = join(__dirname, 'player.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`✅ Parsed player data for: ${displayName}`);
  console.log(`   Team: ${teamName} (${teamCode})`);
  console.log(`   Contract: ${contractType}`);
  console.log(
    `   Years: ${salariesByYear.length} (${startSeason} - ${endSeason})`
  );
  console.log(`   Total Value: $${(totalValue / 1000000).toFixed(1)}M`);
  console.log(`   Bird Rights: ${birdRights.status}`);
  console.log(
    `   Can Trade Now: ${tradeEligibility.canBeTradedNow ? 'Yes' : 'No'}`
  );
  if (futureContract) {
    console.log(
      `   Future Extension: ${futureContract.contractType} (${futureContract.startSeason} - ${futureContract.endSeason})`
    );
    console.log(
      `   Future Value: $${(futureContract.totalValue / 1000000).toFixed(1)}M`
    );
  }
  console.log(`\n📁 Output saved to: ${outputPath}`);

  return output;
}

// Run
parsePlayerPage().catch((err) => {
  console.error('❌ Error parsing player:', err);
  process.exit(1);
});
