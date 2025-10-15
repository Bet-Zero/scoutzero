// parse_team.ts — SalarySwish team page → team-only JSON (+ optional Fanspo enrich)
//
// DESCRIPTION:
//   Parses NBA team salary cap data from SalarySwish team pages into a structured JSON format.
//   Extracts roster, cap holds, exceptions, draft picks, and comprehensive salary cap totals.
//
// RUN:
//   npm pkg set scripts.parse="tsx parse_team.ts"
//   TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" SEASON="2025-26" npm run parse
//
// Optional: enrich draft picks with data from SalarySwish pick detail pages
//   ENRICH_DRAFT=1 TEAM_URL=... TEAM_CODE=... SEASON=... npm run parse
//
// Optional: enrich draft picks from Fanspo (one request)
//   FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 npm run parse
//
// FEATURES:
//   - Parses active roster (14-15 players) with player names and URLs
//   - Extracts cap holds (RFAs, UFAs, FA cap holds, draft picks)
//   - Parses signing exceptions (MLE, BAE, Room) and trade exceptions (TPE)
//   - Extracts draft picks with status (own/outgoing/contested), protections, and trade dates
//   - Captures comprehensive totals: salary, cap space, tax, aprons, roster counts
//   - Optional enrichment from SalarySwish detail pages and Fanspo
//
// OUTPUT:
//   ./team.json - Structured JSON matching team_scrape_schema.ts
//
// Requires: cheerio, got


import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import got from 'got';
import { chromium } from 'playwright';

type Money = number;

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const moneyNum = (s?: string) => {
  if (!s) return undefined;
  const v = Number(s.replace(/[$,]/g, ''));
  return Number.isFinite(v) ? v : undefined;
};
const absoluteUrl = (
  href: string | undefined,
  base = 'https://www.salaryswish.com'
) => (href ? new URL(href, base).toString() : undefined);

function findHeading(
  $: cheerio.CheerioAPI,
  tag: 'h3' | 'h5',
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
function forwardUntilNextH3($: cheerio.CheerioAPI, start: cheerio.Cheerio) {
  const out: cheerio.Element[] = [];
  let cur = start.next();
  while (cur.length) {
    const tag = (cur.get(0) as any)?.name?.toLowerCase?.();
    if (tag === 'h3') break;
    out.push(cur.get(0));
    cur = cur.next();
  }
  return $(out);
}

/** optional enrichment of draft pick from its SalarySwish detail page */
async function enrichDraftPickFromDetail(url: string) {
  const html = await got(url, { timeout: { request: 15000 } }).text();
  const $d = cheerio.load(html);
  const text = norm($d('body').text());

  const currentOwner = text.match(/Current Owner:\s*([A-Z]{2,3})/i)?.[1];
  const originalTeam = text.match(/Original Team:\s*([A-Z]{2,3})/i)?.[1];
  const via = text.match(/\bvia\s+([A-Z]{2,3})\b/i)?.[1];

  const protections =
    text
      .match(
        /(top-\d+\s*protected|lottery protected|unprotected|swap rights)/gi
      )
      ?.join(', ') || undefined;
  const conveysIf = text.match(/conveys if[^.]*\./i)?.[0];

  return { currentOwner, originalTeam, via, protections, conveysIf };
}

/* ----------------------- Fanspo enrichment helpers ----------------------- */

type EnrichedMap = Map<
  string,
  {
    dir: 'incoming' | 'outgoing';
    fromTeams?: string[]; // incoming
    toTeams?: string[]; // outgoing
    protections?: string; // protections / conveys / swaps text
  }
>;

const pickKey = (year: number, round: 1 | 2) => `${year}-${round}`;

/** Fetch and parse Fanspo “Future Draft Picks” page for a team */
async function fetchFanspoTeamPicks(
  teamSlug: string,
  teamId: number
): Promise<EnrichedMap> {
  const url = `https://fanspo.com/nba/teams/${teamSlug}/${teamId}/draft-picks`;
  
  console.log(`  🌐 Fetching Fanspo page with Playwright: ${url}`);
  
  let browser;
  let html;
  
  try {
    // Launch headless browser to execute JavaScript
    // NOTE: Fanspo is a React application that loads data dynamically via JavaScript.
    // Using a simple HTTP client like `got` will only fetch the initial HTML shell
    // without the actual draft pick data. Playwright is required to execute JavaScript
    // and wait for the dynamic content to load.
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to Fanspo draft picks page with increased timeout and wait for load
    // Using 'load' instead of 'networkidle' as it's more reliable for React apps
    await page.goto(url, { 
      waitUntil: 'load',
      timeout: 60000 
    });
    
    // Wait for the draft picks content to be visible with increased timeout
    // Look for either "Incoming Draft Picks" or "Outgoing Draft Picks" text
    try {
      await page.waitForSelector('text=/Incoming Draft Picks|Outgoing Draft Picks/i', {
        timeout: 30000
      });
      console.log(`  ✅ Draft picks content loaded`);
    } catch (e) {
      console.warn(`  ⚠️  Draft picks sections not found, trying alternative wait strategy...`);
      // Wait a bit more for React to render
      await page.waitForTimeout(5000);
    }
    
    // Get the fully rendered HTML
    html = await page.content();
    
  } catch (error) {
    throw new Error(`Failed to fetch Fanspo page: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // Parse the HTML with Cheerio
  const $ = cheerio.load(html);

  const lines = $('body')
    .text()
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

  console.log(`  📊 Parsed ${map.size} draft picks from Fanspo`);
  return map;
}

/** Merge Fanspo info into existing picks */
function mergeFanspoIntoPicks(picks: Array<any>, fanspo: EnrichedMap) {
  const seenNote = new Set<string>();
  for (const p of picks) {
    const e = fanspo.get(pickKey(p.year, p.round));
    if (!e) continue;

    if (e.fromTeams) (p as any).fromTeams = e.fromTeams;
    if (e.toTeams) (p as any).toTeams = e.toTeams;

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

/** Convert Fanspo enrichment map to standalone draft picks array */
function convertFanspoPicks(fanspo: EnrichedMap): Array<any> {
  const picks: Array<any> = [];
  
  for (const [key, data] of fanspo.entries()) {
    const [yearStr, roundStr] = key.split('-');
    const year = Number(yearStr);
    const round = Number(roundStr) as 1 | 2;
    
    const pick: any = {
      year,
      round,
      status: data.dir === 'incoming' ? 'own' : 'outgoing'
    };
    
    if (data.fromTeams) pick.fromTeams = data.fromTeams;
    if (data.toTeams) pick.toTeams = data.toTeams;
    if (data.protections) pick.protections = data.protections;
    
    picks.push(pick);
  }
  
  // Sort by year, then round
  picks.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });
  
  return picks;
}

/* ------------------------------------------------------------------------ */

async function main() {
  const TEAM_URL =
    process.env.TEAM_URL || 'https://www.salaryswish.com/teams/lakers';
  const TEAM_CODE = process.env.TEAM_CODE || 'LAL';
  const SEASON = process.env.SEASON || '2025-26';
  const ENRICH_DRAFT = process.env.ENRICH_DRAFT === '1';
  const FANSPO_ENRICH = process.env.FANSPO_ENRICH === '1';
  const TEAM_SLUG = process.env.TEAM_SLUG || 'Lakers'; // Fanspo
  const TEAM_ID = Number(process.env.TEAM_ID || 14); // Fanspo

  const html = await fs.readFile('./page.html', 'utf8');
  const $ = cheerio.load(html);

  // --- Team identity ---
  const teamName = $('h1').first().text().trim();
  const teamCode = TEAM_CODE;
  const season = SEASON;

  // --- Totals (from <h5> headings) ---
  const totalsBox: any = {};
  $('h5').each((_, el) => {
    const raw = norm($(el).text());
    const t = raw.toUpperCase();

    const valAfterColon = (text: string) => {
      const idx = text.indexOf(':');
      return idx >= 0 ? moneyNum(text.slice(idx + 1)) : undefined;
    };

    if (t.includes('TEAM SALARY ROOM'))
      totalsBox.teamSalaryRoom = valAfterColon(raw);
    else if (t.includes('TEAM SALARY'))
      totalsBox.totalSalary = valAfterColon(raw);
    else if (t.includes('CAP HIT')) totalsBox.capHit = valAfterColon(raw);
    else if (t.includes('CAP ROOM')) totalsBox.capSpace = valAfterColon(raw);
    else if (t.includes('LUXURY TAX ROOM'))
      totalsBox.luxuryTaxRoom = valAfterColon(raw);
    else if (t.includes('1ST APRON ROOM'))
      totalsBox.firstApronRoom = valAfterColon(raw);
    else if (t.includes('2ND APRON ROOM'))
      totalsBox.secondApronRoom = valAfterColon(raw);
    else if (t.includes('HARD CAPPED')) {
      const txt = raw.split(':').slice(1).join(':').trim().toLowerCase();
      totalsBox.hardCappedAt = txt.startsWith('1st')
        ? 'firstApron'
        : txt.startsWith('2nd')
          ? 'secondApron'
          : 'none';
    }
  });

  // Also capture additional totals from stats table if present
  const statsTable = $('.sw_teamProfileStats__table');
  if (statsTable.length) {
    statsTable.find('tbody tr').each((_, tr) => {
      const rowTitle = norm($(tr).find('.sw_teamProfileStats__table_rowTitle').text()).toUpperCase();
      const cells = $(tr).find('td');
      const firstDataCell = cells.eq(6); // Cell 6 is the first season data (cell 5 is the row title)
      const value = norm(firstDataCell.text());
      
      if (rowTitle.includes('ROSTER SIZE') && !rowTitle.includes('&')) {
        const match = value.match(/^\d+/);
        totalsBox.rosterCount = match ? Number(match[0]) : undefined;
      } else if (rowTitle.includes('TWO-WAY CONTRACTS')) {
        const match = value.match(/^\d+/);
        totalsBox.twoWayCount = match ? Number(match[0]) : undefined;
      } else if (rowTitle.includes('ROSTER CAP HIT') && !rowTitle.includes('DEAD')) {
        totalsBox.activeSalary = moneyNum(value);
      } else if (rowTitle.includes('DEAD CAP HIT')) {
        totalsBox.deadCapTotal = moneyNum(value);
      } else if (rowTitle === 'HOLDS') {
        totalsBox.capHoldsTotal = moneyNum(value);
      } else if (rowTitle.includes('INCOMPLETE ROSTER CHARGE')) {
        totalsBox.incompleteRosterCharges = moneyNum(value);
      } else if (rowTitle === 'GUARANTEED') {
        totalsBox.guaranteedSalary = moneyNum(value);
      } else if (rowTitle.includes('LIKELY INCENTIVE')) {
        totalsBox.likelyIncentives = moneyNum(value);
      } else if (rowTitle.includes('UNLIKELY INCENTIVE')) {
        totalsBox.unlikelyIncentives = moneyNum(value);
      }
    });
  }

  // Capture cap/tax/apron lines from detailed stats
  $('.sw_teamProfileStats__table').find('tbody tr').each((_, tr) => {
    const rowTitle = norm($(tr).find('.sw_teamProfileStats__table_rowTitle').text()).toUpperCase();
    const cells = $(tr).find('td');
    const firstDataCell = cells.eq(6); // Cell 6 is first season data
    const value = norm(firstDataCell.text());
    
    if (rowTitle === 'CAP') {
      totalsBox.salaryCap = moneyNum(value);
    } else if (rowTitle === 'CAP ROOM') {
      // Cap room from stats table (alternative to h5)
      const capRoom = moneyNum(value);
      if (capRoom !== undefined && totalsBox.capSpace === undefined) {
        totalsBox.capSpace = capRoom;
      }
    } else if (rowTitle === 'LUXURY TAX') {
      totalsBox.luxuryTaxLine = moneyNum(value);
    } else if (rowTitle === 'LUXURY TAX ROOM') {
      const taxRoom = moneyNum(value);
      if (taxRoom !== undefined) {
        totalsBox.luxuryTaxRoom = taxRoom;
      }
    } else if (rowTitle === 'APRON') {
      totalsBox.firstApronLine = moneyNum(value);
    } else if (rowTitle === '2ND APRON') {
      totalsBox.secondApronLine = moneyNum(value);
    } else if (rowTitle === 'APRON ROOM') {
      const apronRoom = moneyNum(value);
      if (apronRoom !== undefined && totalsBox.firstApronRoom === undefined) {
        totalsBox.firstApronRoom = apronRoom;
      }
    } else if (rowTitle === '2ND APRON ROOM') {
      const apronRoom2 = moneyNum(value);
      if (apronRoom2 !== undefined && totalsBox.secondApronRoom === undefined) {
        totalsBox.secondApronRoom = apronRoom2;
      }
    }
  });

  // --- Signing Exceptions (h3 SIGNING EXCEPTIONS → UL) ---
  let mle: any = null,
    bae: any = null,
    room: any = null;
  {
    const h3 = findHeading($, 'h3', 'SIGNING EXCEPTIONS');
    if (h3) {
      const lis = h3.nextAll('ul').first().find('li');
      lis.each((_, li) => {
        const text = norm($(li).text());
        const m = text.match(
          /^(Bi-Annual|Mid-Level|Room):\s*\$?([\d,]+)\s*of\s*\$?([\d,]+)/i
        );
        if (!m) return;
        const kind = m[1].toLowerCase();
        const remaining = moneyNum(m[2]);
        const total = moneyNum(m[3]);
        const used =
          total != null && remaining != null ? total - remaining : undefined;
        const base = {
          totalAmount: total,
          usedAmount: used,
          remainingAmount: remaining,
          available: (remaining || 0) > 0,
        };
        if (kind.startsWith('bi-')) bae = base;
        else if (kind.startsWith('mid-')) mle = { type: 'Non-Taxpayer' as const, ...base }; // Default to Non-Taxpayer
        else if (kind.startsWith('room')) room = base;
      });
    }
  }

  // --- Trade Exceptions (wrapper under h3 TRADE EXCEPTIONS) ---
  const tpe: Array<{
    id: string;
    totalAmount?: Money;
    usedAmount?: Money;
    remainingAmount?: Money;
    createdFrom?: string;
    expiresOn?: string;
  }> = [];
  {
    const h3 = findHeading($, 'h3', 'TRADE EXCEPTIONS');
    if (h3) {
      const sib = forwardUntilNextH3($, h3);
      const wrapper = sib
        .filter((_, el) => $(el).is('div.sw_table__tradeExptn_wrapper'))
        .first();
      if (wrapper.length) {
        const seen = new Set<any>();
        wrapper.find('a[href^="/players/"]').each((i, a) => {
          const row = $(a).closest('div, tr, li');
          const key = row.get(0);
          if (!key || seen.has(key)) return;
          seen.add(key);

          const player = norm($(a).text());
          const text = norm(row.text());
          const monies = text.match(/\$[\d,]+/g) || []; // [$exception, $used, $remaining]
          const dates = text.match(/[A-Z][a-z]+ \d{1,2}, \d{4}/g) || []; // [start, end]
          const exception = monies[0]
            ? Number(monies[0].replace(/[$,]/g, ''))
            : undefined;
          const used = monies[1]
            ? Number(monies[1].replace(/[$,]/g, ''))
            : undefined;
          const remaining = monies[2]
            ? Number(monies[2].replace(/[$,]/g, ''))
            : undefined;
          const end = dates[1];

          if (exception != null || remaining != null) {
            tpe.push({
              id: `TPE-${teamCode}-${end || 'NA'}-${tpe.length + 1}`,
              totalAmount: exception,
              usedAmount: used,
              remainingAmount: remaining,
              createdFrom: player || undefined,
              expiresOn: end,
            });
          }
        });
      }
    }
  }

  // --- Cap Holds (multiple tables under h3 HOLDS) ---
  const capHolds: Array<{
    displayName: string;
    capHoldAmount: number;
    type?: 'UFA' | 'RFA' | 'Two-way' | 'Draft Pick' | 'FA Cap Hold' | 'Other';
    rights?: 'Bird' | 'Early Bird' | 'Non-Bird';
    notes?: string;
    playerId?: string;
    sourceUrl?: string;
  }> = [];
  {
    const h3 = findHeading($, 'h3', 'HOLDS');
    if (h3) {
      const block = forwardUntilNextH3($, h3);
      const tables = block.find('table'); // Tables are inside divs, use find() not filter()
      
      // Process each table separately
      tables.each((_, table) => {
        const tbl = $(table);
        const thead = norm(tbl.find('thead').text());
        
        // Determine table type from header
        let tableType: 'RFA' | 'UFA' | 'Draft Pick' | 'FA Cap Hold' | 'Other' = 'Other';
        if (/RFAs/i.test(thead)) tableType = 'RFA';
        else if (/UFAs/i.test(thead)) tableType = 'UFA';
        else if (/2nd Rd Picks/i.test(thead)) tableType = 'Draft Pick';
        else if (/FA Cap Hold/i.test(thead)) tableType = 'FA Cap Hold';
        
        tbl.find('tbody tr').each((_, tr) => {
          const tds = $(tr).find('td');
          if (!tds.length) return;
          
          // Extract player name and link
          const anchor = $(tr).find('a[href^="/players/"]').first();
          const name = anchor.length ? norm(anchor.text()) : norm(tds.eq(0).text());
          const href = anchor.length ? (anchor.attr('href') || '').trim() : '';
          
          // Find cap hit amount - usually in column 6 (2025-26 season)
          const capHitCol = $(tr).find('.cap_hit.team_salary_data').first();
          const amount = moneyNum(norm(capHitCol.text()));
          
          const meta = norm($(tr).text()).toLowerCase();
          
          if (name && amount != null && amount > 0) {
            capHolds.push({
              playerId: undefined,
              displayName: name,
              sourceUrl: href ? absoluteUrl(href) : undefined,
              capHoldAmount: amount,
              type: tableType,
              rights: /early bird/i.test(meta)
                ? 'Early Bird'
                : /non-?bird/i.test(meta)
                  ? 'Non-Bird'
                  : /bird/i.test(meta)
                    ? 'Bird'
                    : undefined,
              notes: undefined, // Keep notes minimal to reduce clutter
            });
          }
        });
      });
    }
  }

  // --- Draft Picks (from #sw_teamProfile__draftTable) ---
  let draftPicks: Array<{
    year: number;
    round: 1 | 2;
    status: 'own' | 'outgoing' | 'contested' | 'unknown';
    pickNumber?: number;
    detailUrl?: string;
    title?: string;
    contendingTeams?: string[];
    tradedOn?: string;
    // Enrichment fields:
    currentOwner?: string;
    originalTeam?: string;
    via?: string;
    protections?: string;
    conveysIf?: string;
    fromTeams?: string[];
    toTeams?: string[];
  }> = [];
  {
    const tbl = $('#sw_teamProfile__draftTable');
    if (tbl.length) {
      const years = tbl
        .find('thead th')
        .map((i, th) => (i ? Number($(th).text().trim()) : NaN))
        .get()
        .slice(1)
        .filter((n: any) => Number.isFinite(n));

      tbl.find('tbody tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 2) return;

        const round: 1 | 2 = /2/.test($(tds[0]).text()) ? 2 : 1;

        for (let j = 1; j < tds.length; j++) {
          const year = years[j - 1];
          if (!year) continue;
          const td = $(tds[j]);

          const q = td.find('.q').first();
          const title = (q.attr('title') || '').trim();
          const detailUrl = absoluteUrl(td.find('a').first().attr('href'));

          const isTraded =
            td.find('.d_pick_traded').length > 0 || /traded/i.test(title);
          const isContested =
            td.find('.sw_teamProfile__draftPick_inContention').length > 0 ||
            /in contention/i.test(title);
          const hasPickUI = td.find('.d_pick, img, a').length > 0;

          const status: 'own' | 'outgoing' | 'contested' | 'unknown' = isTraded
            ? 'outgoing'
            : isContested
              ? 'contested'
              : hasPickUI
                ? 'own'
                : 'unknown';

          const mPick = (detailUrl || '').match(/[?&]pick=(\d+)/);
          const pickNumber = mPick ? Number(mPick[1]) : undefined;

          let contendingTeams: string[] | undefined;
          const mTeams = title.match(/Contending teams:\s*([A-Z, ]+)/i);
          if (mTeams)
            contendingTeams = mTeams[1]
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

          const tradedOn = title.match(
            /traded away on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
          )?.[1];

          draftPicks.push({
            year,
            round,
            status,
            pickNumber,
            detailUrl,
            title: title || undefined,
            contendingTeams,
            tradedOn,
          });
        }
      });
    }
  }

  // --- Optional: enrich draft picks by visiting SalarySwish detail pages ---
  if (ENRICH_DRAFT) {
    const picksWithUrl = draftPicks.filter((p) => p.detailUrl);
    const work = [...picksWithUrl];
    const workers = 3; // small parallelism
    const runner = async () => {
      while (work.length) {
        const p = work.shift()!;
        try {
          const extra = await enrichDraftPickFromDetail(p.detailUrl!);
          Object.assign(p, extra);
        } catch {
          // ignore per-pick failure
        }
      }
    };
    await Promise.all(new Array(workers).fill(0).map(runner));
  }

  // --- Optional: single-shot Fanspo enrichment (owners/protections/swap) ---
  if (FANSPO_ENRICH) {
    try {
      console.log(`\n🔍 Fetching draft picks from Fanspo...`);
      const fanspo = await fetchFanspoTeamPicks(TEAM_SLUG, TEAM_ID);
      
      if (fanspo.size === 0) {
        console.warn('⚠️  Fanspo returned 0 picks');
        console.warn('   This could mean:');
        console.warn('   - The team has no traded picks on Fanspo');
        console.warn('   - The page structure has changed');
        console.warn('   - JavaScript failed to load the content');
        console.warn('   Falling back to SalarySwish draft picks...');
      } else {
        // Replace draft picks entirely with Fanspo data instead of merging
        console.log(`📝 Replacing SalarySwish draft picks with Fanspo data...`);
        draftPicks = convertFanspoPicks(fanspo);
        console.log(`✅ Using ${draftPicks.length} draft picks from Fanspo`);
      }
    } catch (err) {
      console.error('❌ Fanspo fetch failed:', (err as Error).message);
      console.warn('   Fanspo is a React app that requires JavaScript to load draft pick data.');
      console.warn('   Make sure Playwright is installed: npm install playwright');
      console.warn('   If the issue persists, the Fanspo page structure may have changed.');
      console.warn('   Falling back to SalarySwish draft picks...');
    }
  }

  // --- Roster (Active only) — under h5 "Season Display" ---
  const roster: Array<{
    playerId?: string;
    displayName?: string;
    sourceUrl?: string;
  }> = [];
  {
    const h5 = findHeading($, 'h5', 'Season Display');
    if (h5) {
      const block = (() => {
        const out: cheerio.Element[] = [];
        let cur = h5.next();
        while (cur.length) {
          const tag = (cur.get(0) as any)?.name?.toLowerCase?.();
          if (tag === 'h3') break;
          out.push(cur.get(0));
          cur = cur.next();
        }
        return $(out);
      })();

      const teamC = block.filter((_, el) => $(el).is('div.team_c')).first();
      const activeMatch = teamC.length
        ? norm(teamC.text()).match(/Active\s*\((\d+)\b/i)
        : null;
      const activeCount = activeMatch ? Number(activeMatch[1]) : undefined;

      const seen = new Set<string>();
      block.find('a[href^="/players/"]').each((_, a) => {
        const href = ($(a).attr('href') || '').trim();
        if (!href || seen.has(href)) return;
        seen.add(href);
        roster.push({
          playerId: undefined,
          displayName: norm($(a).text()),
          sourceUrl: absoluteUrl(href),
        });
      });

      if (activeCount && roster.length > activeCount)
        roster.length = activeCount;
    }
  }

  // --- Final Team JSON (team-only) ---
  const teamDoc = {
    teamCode,
    teamName,
    season,

    roster, // player refs; IDs resolved later by your mapper
    deadCap: [], // not on this page (would need waiver/transaction data)
    capHolds, // parsed above (may be [])
    exceptions: {
      mle: mle || undefined,
      taxpayerMle: undefined, // can't disambiguate from text alone
      room: room || undefined,
      bae: bae || undefined,
      dpe: undefined,
      tpe,
    },
    draftPicks, // populated from draft table (+ optional enrich)

    totals: {
      // Core salary totals
      totalSalary: totalsBox.totalSalary,
      activeSalary: totalsBox.activeSalary,
      deadCapTotal: totalsBox.deadCapTotal || 0,
      capHoldsTotal: totalsBox.capHoldsTotal,
      guaranteedSalary: totalsBox.guaranteedSalary,
      
      // Roster counts
      rosterCount: totalsBox.rosterCount,
      twoWayCount: totalsBox.twoWayCount,
      
      // Cap space calculations
      salaryCap: totalsBox.salaryCap,
      capSpace: totalsBox.capSpace,
      
      // Luxury tax
      luxuryTaxLine: totalsBox.luxuryTaxLine,
      taxSpace: totalsBox.luxuryTaxRoom,
      
      // Aprons
      firstApronLine: totalsBox.firstApronLine,
      firstApronRoom: totalsBox.firstApronRoom,
      firstApronTriggered: totalsBox.firstApronRoom != null && totalsBox.firstApronRoom < 0,
      
      secondApronLine: totalsBox.secondApronLine,
      secondApronRoom: totalsBox.secondApronRoom,
      secondApronTriggered: totalsBox.secondApronRoom != null && totalsBox.secondApronRoom < 0,
      
      // Hard cap
      hardCappedAt: totalsBox.hardCappedAt || 'none',
      
      // Additional details
      incompleteRosterCharges: totalsBox.incompleteRosterCharges,
      likelyIncentives: totalsBox.likelyIncentives,
      unlikelyIncentives: totalsBox.unlikelyIncentives,
    },

    source: {
      provider: 'SalarySwish',
      teamPageUrl: TEAM_URL,
      scrapedAt: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
    version: '1.0',
  };

  await fs.writeFile('./team.json', JSON.stringify(teamDoc, null, 2), 'utf8');
  console.log('✅ Wrote ./team.json');
  console.log(
    `  roster=${roster.length}  tpe=${tpe.length}  holds=${capHolds.length}  picks=${draftPicks.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
