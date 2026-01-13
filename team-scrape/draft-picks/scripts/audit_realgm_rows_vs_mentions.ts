#!/usr/bin/env -S node --experimental-strip-types
/* eslint-disable */
/**
 * Audit: RealGM Rows vs Mentions + Ledger Invariants + Hygiene
 * Normalized Browser Usage for Speed
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';

// ---------- CONFIG ----------
const BASE_DIR = path.resolve('.');
const OBS_MENTIONS_DIR = path.join(BASE_DIR, 'team-scrape/draft-picks/_artifacts/output/mentions');
const OBS_LEDGER_DIR = path.join(BASE_DIR, 'team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team');

// Common RealGM URLs & Maps
const INTERNAL_TEAM_CODE_MAP: Record<string, string> = {
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN', 'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE', 'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET', 'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL', 'Philadelphia Sixers': 'PHI', 'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
};

const REALGM_TEAM_URLS: Record<string, { code: string; name: string; url: string }> = {
  ATL: { code: 'ATL', name: 'Atlanta Hawks', url: 'https://basketball.realgm.com/nba/teams/Atlanta-Hawks/1/draft-picks' },
  BOS: { code: 'BOS', name: 'Boston Celtics', url: 'https://basketball.realgm.com/nba/teams/Boston-Celtics/2/draft-picks' },
  BKN: { code: 'BKN', name: 'Brooklyn Nets', url: 'https://basketball.realgm.com/nba/teams/Brooklyn-Nets/38/draft-picks' },
  CHA: { code: 'CHA', name: 'Charlotte Hornets', url: 'https://basketball.realgm.com/nba/teams/Charlotte-Hornets/3/draft-picks' },
  CHI: { code: 'CHI', name: 'Chicago Bulls', url: 'https://basketball.realgm.com/nba/teams/Chicago-Bulls/4/draft-picks' },
  CLE: { code: 'CLE', name: 'Cleveland Cavaliers', url: 'https://basketball.realgm.com/nba/teams/Cleveland-Cavaliers/5/draft-picks' },
  DAL: { code: 'DAL', name: 'Dallas Mavericks', url: 'https://basketball.realgm.com/nba/teams/Dallas-Mavericks/6/draft-picks' },
  DEN: { code: 'DEN', name: 'Denver Nuggets', url: 'https://basketball.realgm.com/nba/teams/Denver-Nuggets/7/draft-picks' },
  DET: { code: 'DET', name: 'Detroit Pistons', url: 'https://basketball.realgm.com/nba/teams/Detroit-Pistons/8/draft-picks' },
  GSW: { code: 'GSW', name: 'Golden State Warriors', url: 'https://basketball.realgm.com/nba/teams/Golden-State-Warriors/9/draft-picks' },
  HOU: { code: 'HOU', name: 'Houston Rockets', url: 'https://basketball.realgm.com/nba/teams/Houston-Rockets/10/draft-picks' },
  IND: { code: 'IND', name: 'Indiana Pacers', url: 'https://basketball.realgm.com/nba/teams/Indiana-Pacers/11/draft-picks' },
  LAC: { code: 'LAC', name: 'LA Clippers', url: 'https://basketball.realgm.com/nba/teams/LA-Clippers/12/draft-picks' },
  LAL: { code: 'LAL', name: 'Los Angeles Lakers', url: 'https://basketball.realgm.com/nba/teams/Los-Angeles-Lakers/13/draft-picks' },
  MEM: { code: 'MEM', name: 'Memphis Grizzlies', url: 'https://basketball.realgm.com/nba/teams/Memphis-Grizzlies/14/draft-picks' },
  MIA: { code: 'MIA', name: 'Miami Heat', url: 'https://basketball.realgm.com/nba/teams/Miami-Heat/15/draft-picks' },
  MIL: { code: 'MIL', name: 'Milwaukee Bucks', url: 'https://basketball.realgm.com/nba/teams/Milwaukee-Bucks/16/draft-picks' },
  MIN: { code: 'MIN', name: 'Minnesota Timberwolves', url: 'https://basketball.realgm.com/nba/teams/Minnesota-Timberwolves/17/draft-picks' },
  NOP: { code: 'NOP', name: 'New Orleans Pelicans', url: 'https://basketball.realgm.com/nba/teams/New-Orleans-Pelicans/19/draft-picks' },
  NYK: { code: 'NYK', name: 'New York Knicks', url: 'https://basketball.realgm.com/nba/teams/New-York-Knicks/20/draft-picks' },
  OKC: { code: 'OKC', name: 'Oklahoma City Thunder', url: 'https://basketball.realgm.com/nba/teams/Oklahoma-City-Thunder/33/draft-picks' },
  ORL: { code: 'ORL', name: 'Orlando Magic', url: 'https://basketball.realgm.com/nba/teams/Orlando-Magic/21/draft-picks' },
  PHI: { code: 'PHI', name: 'Philadelphia 76ers', url: 'https://basketball.realgm.com/nba/teams/Philadelphia-Sixers/22/draft-picks' },
  PHX: { code: 'PHX', name: 'Phoenix Suns', url: 'https://basketball.realgm.com/nba/teams/Phoenix-Suns/23/draft-picks' },
  POR: { code: 'POR', name: 'Portland Trail Blazers', url: 'https://basketball.realgm.com/nba/teams/Portland-Trail-Blazers/24/draft-picks' },
  SAC: { code: 'SAC', name: 'Sacramento Kings', url: 'https://basketball.realgm.com/nba/teams/Sacramento-Kings/25/draft-picks' },
  SAS: { code: 'SAS', name: 'San Antonio Spurs', url: 'https://basketball.realgm.com/nba/teams/San-Antonio-Spurs/26/draft-picks' },
  TOR: { code: 'TOR', name: 'Toronto Raptors', url: 'https://basketball.realgm.com/nba/teams/Toronto-Raptors/28/draft-picks' },
  UTA: { code: 'UTA', name: 'Utah Jazz', url: 'https://basketball.realgm.com/nba/teams/Utah-Jazz/29/draft-picks' },
  WAS: { code: 'WAS', name: 'Washington Wizards', url: 'https://basketball.realgm.com/nba/teams/Washington-Wizards/30/draft-picks' },
};

const VALID_CODES = new Set(Object.values(INTERNAL_TEAM_CODE_MAP));


// ---------- UTILS ----------
const norm = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = (s: string) => s.replace(/<br\s*\/?>/gi, ' | ').replace(/<[^>]*>/g, '');
const cleanCell = (cell: string) => {
  let s = cell;
  s = s.replace(/([A-Za-z)])\d\b/g, '$1'); 
  s = s.replace(/\b(\)|[A-Za-z])\s*0\b/g, '$1'); 
  s = s.replace(/\((?:\d+)\)\s*$/g, ''); 
  return norm(s);
};

// --- Normalization & Similarity ---
function normalizeTeamCode(code: string): string {
  const c = code.toUpperCase().trim().replace(/['"]/g, '');
  if (c === 'BRK') return 'BKN';
  if (c === 'PHO') return 'PHX';
  if (c === 'UTH') return 'UTA';
  if (c === 'CHO') return 'CHA'; 
  return c;
}

function tokenize(text: string): string[] {
    const raw = text.toUpperCase();
    // Replace known full team names or codes if needed, but for now simple tokenization
    // We want to handle "Brooklyn" -> "BKN" if possible, but let's stick to simple tokens first
    // and rely on overlap. 
    
    // Remove punctuation
    const clean = raw.replace(/[.,;()]/g, ' ').replace(/\s+/g, ' ');
    const parts = clean.split(' ').filter(Boolean);
    
    // Normalize codes in tokens?
    return parts.map(p => normalizeTeamCode(p));
}

function calculateSimilarity(rowText: string, mentionText: string): number {
    const tA = tokenize(rowText);
    const tB = tokenize(mentionText);
    if (!tA.length || !tB.length) return 0;
    
    const intersection = tA.filter(t => tB.includes(t));
    // Jaccard-ish but focused on coverage of the shorter string (usually match intent)
    // or just distinct overlap. 
    // Let's use simple overlap ratio of the union to be safe, or just intersection / max length
    
    const uniqueA = new Set(tA);
    const uniqueB = new Set(tB);
    const intersectSize = [...uniqueA].filter(x => uniqueB.has(x)).length;
    const unionSize = new Set([...uniqueA, ...uniqueB]).size;
    
    return intersectSize / unionSize;
}

// ---------- SCRAPING ----------
async function fetchTeamHtml(url: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    }
    await page.waitForTimeout(1000); 
    return await page.content();
  } finally {
    await browser.close();
  }
}

function parseTableRows($: cheerio.CheerioAPI, table: any) {
  const rows: Array<{ year: number; text: string }> = [];
  if (table.length === 0) return rows;
  let tableRows = table.find('tbody tr');
  if (tableRows.length === 0) tableRows = table.find('tr');
  tableRows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    if (cells.length >= 2) {
      const yearText = cells.eq(0).text().trim();
      const pickHtml = cells.eq(1).html() || '';
      const pickText = stripTags(pickHtml).replace(/\s+/g, ' ').trim();
      const year = parseInt(yearText, 10);
      if (Number.isFinite(year) && pickText) {
        rows.push({ year, text: cleanCell(pickText) });
      }
    }
  });
  return rows;
}

function parseCompressedPickData(compressedText: string): Array<{ year: number; text: string }> {
  const rows: Array<{ year: number; text: string }> = [];
  let text = compressedText.replace(/Year(First|Second)\s*Round\s*Picks/gi, '').replace(/Loading,\s*please\s*wait/gi, '');
  text = norm(text);
  const yearPattern = /(20\d{2})([^2]*?)(?=20\d{2}|$)/g;
  let match;
  while ((match = yearPattern.exec(text)) !== null) {
    const [, yearStr, pickData] = match;
    const year = parseInt(yearStr, 10);
    if (Number.isFinite(year) && year >= 2024 && year <= 2035) {
      let cleanPickData = norm(pickData).replace(/\s*1\s*$/, '').replace(/\s*0\s*$/, '');
      if (cleanPickData) rows.push({ year, text: cleanPickData });
    }
  }
  if (rows.length === 0) {
      const lakersPatterns = [
        { year: 2026, pattern: /2026.*?Own/i },
        { year: 2027, pattern: /2027.*?(?:1-4\s*Own.*?5-30\s*to\s*UTH|Own.*?to.*?UTH)/i },
        { year: 2028, pattern: /2028.*?Own/i },
        { year: 2029, pattern: /2029.*?(?:To\s*DAL|to\s*DAL)/i },
        { year: 2030, pattern: /2030.*?Own/i },
        { year: 2031, pattern: /2031.*?Own/i },
        { year: 2032, pattern: /2032.*?Own/i },
      ];
      for (const { year, pattern } of lakersPatterns) {
        const match = text.match(pattern);
        if (match) {
          let pickText = match[0].replace(/^\d{4}/, '').trim();
          rows.push({ year, text: pickText });
        }
      }
  }
  return rows;
}

async function getTeamRawRows(teamCode: string) {
  const entry = REALGM_TEAM_URLS[teamCode];
  if (!entry) throw new Error(`Unknown team ${teamCode}`);
  const html = await fetchTeamHtml(entry.url);
  const $ = cheerio.load(html);
  
  const h2s = $('h2, h3').toArray();
  const firstHeader = h2s.find((el) => /Future\s+1st\s+Round\s+Picks/i.test($(el).text()));
  const secondHeader = h2s.find((el) => /Future\s+2nd\s+Round\s+Picks/i.test($(el).text()));

  let rows: Array<{ year: number; text: string }> = [];

  // 1st Round
  if (firstHeader) {
     const t = $(firstHeader).next('table');
     if (t.length > 0) {
       rows.push(...parseTableRows($, t));
     } else {
       const $siblings = $(firstHeader).nextUntil('h2, h3');
       $siblings.each((_, el) => {
         const txt = $(el).text().trim();
         if (txt.includes('YearFirst Round Picks') || (txt.includes('Year') && txt.includes('Own'))) {
           rows.push(...parseCompressedPickData(txt));
         }
       });
     }
  }

  // 2nd Round
  if (secondHeader) {
    const t = $(secondHeader).next('table');
    if (t.length > 0) {
      rows.push(...parseTableRows($, t));
    } else {
       const $siblings = $(secondHeader).nextUntil('h2, h3');
       $siblings.each((_, el) => {
         const txt = $(el).text().trim();
         if (txt.includes('YearSecond Round Picks') || (txt.includes('Year') && txt.includes('To'))) {
           rows.push(...parseCompressedPickData(txt));
         }
       });
    }
  }
  // Split checks on | for multi-rows in one cell
  const splitRows = [];
  for (const r of rows) {
      const parts = r.text.split('|').map(s => cleanCell(s)).filter(Boolean);
      if (parts.length > 0) {
          parts.forEach(p => splitRows.push({ year: r.year, text: p }));
      } else {
          splitRows.push({ year: r.year, text: cleanCell(r.text) });
      }
  }
  return splitRows;
}

// ---------- AUDIT LOGIC ----------
async function auditTeam(teamCode: string) {
  // 1. Fetch
  const realRows = await getTeamRawRows(teamCode);
  
  // 2. Load Mentions
  const mentionsPath = path.join(OBS_MENTIONS_DIR, `draft_picks_mentions_${teamCode}.json`);
  let mentions: any[] = [];
  try {
    const content = await fs.readFile(mentionsPath, 'utf8');
    mentions = JSON.parse(content);
  } catch (e) {
    return { status: 'FAIL', realRowsCount: realRows.length, mentionsCount: 0, 
             categoryA: [], categoryB: [], categoryC: realRows.map(r => ({ ...r, reason: 'No mentions file' })),
             ledgerIssues: [], hygieneIssues: [] };
  }

  // 3. Match
  const categoryA: any[] = []; // Metadata Mismatch
  const categoryB: any[] = []; // Extraction Gap
  const categoryC: any[] = []; // Likely Missing

  // 0.6 = Strong, 0.35 = Partial
  const STRONG_MATCH = 0.60;
  const PARTIAL_MATCH = 0.35;

  for (const row of realRows) {
      const rowTokens = tokenize(row.text);
      
      // Filter mentions by bucket if possible is strict, but scraper might have slightly diff years if weird logic.
      // Let's just fuzzy match against ALL first to find best, then use buckets for diagnostics.
      
      let bestMatch = null;
      let bestScore = -1;
      
      for (const m of mentions) {
          const mText = m.metadata?.realgmRawText || '';
          if (!mText) continue;
          const score = calculateSimilarity(row.text, mText);
          if (score > bestScore) {
              bestScore = score;
              bestMatch = m;
          }
      }
      
      if (bestScore >= STRONG_MATCH) {
          // Matched!
          continue;
      }
      
      // If not strong match, classify
      
      // Check bucket info
      const bucketMentions = mentions.filter(m => m.year === row.year); // rough check
      const bucketHasAnyRaw = bucketMentions.some(m => m.metadata?.realgmRawText);

      const info = {
          year: row.year,
          text: row.text,
          bestCandidate: bestMatch?.metadata?.realgmRawText || '(none)',
          bestScore: bestScore.toFixed(2),
          bucketCount: bucketMentions.length
      };

      if (bestScore >= PARTIAL_MATCH) {
          categoryA.push(info);
      } else if (bucketMentions.length > 0) {
          // Mentions exist for this year, but text didn't match well.
          categoryB.push(info);
      } else {
          // No mentions for this year, and no text match.
          categoryC.push(info);
      }
  }

  // 4. Ledger Invariants (with Normalization)
  const ledgerPath = path.join(OBS_LEDGER_DIR, `${teamCode}.json`);
  let ledgerIssues: string[] = [];
  try {
    const lContent = await fs.readFile(ledgerPath, 'utf8');
    const ledger = JSON.parse(lContent);
    const { inventory, obligations, contested } = ledger;
    
    // Check dupes
    const checkDupes = (arr: any[], name: string) => {
      const ids = arr.map((x: any) => x.id);
      const output = new Set<string>();
      const dupes = ids.filter((id: string) => output.has(id) ? true : (output.add(id), false));
      if (dupes.length) ledgerIssues.push(`${name} has duplicates: ${dupes.join(', ')}`);
    };
    checkDupes(inventory || [], 'inventory');
    checkDupes(obligations || [], 'obligations');
    checkDupes(contested || [], 'contested');

    // Check inventory invariants
    (inventory || []).forEach((p: any) => {
      if (p.status === 'contested') ledgerIssues.push(`Inventory includes contested pick: ${p.id}`);
      if (p.tradeable === false) ledgerIssues.push(`Inventory includes tradeable=false pick: ${p.id}`);
    });

    // Check team codes
    const allPicks = [...(inventory || []), ...(obligations || []), ...(contested || [])];
    allPicks.forEach((p: any) => {
      const normOrig = normalizeTeamCode(p.originalTeam);
      const normOwn = normalizeTeamCode(p.owner);
      
      if (!VALID_CODES.has(normOrig)) ledgerIssues.push(`Invalid originalTeam ${p.originalTeam} (norm: ${normOrig}) in ${p.id}`);
      if (!VALID_CODES.has(normOwn)) ledgerIssues.push(`Invalid owner ${p.owner} (norm: ${normOwn}) in ${p.id}`);
    });

  } catch (e) {
    ledgerIssues.push(`Could not read/parse ledger for ${teamCode}`);
  }

  // 5. Hygiene
  const hygieneIssues: string[] = [];
  const recursiveScan = (obj: any, path: string) => {
      if (!obj) return;
      if (typeof obj === 'string') {
          if (obj === 'PHO' || obj === 'PHU') hygieneIssues.push(`Found banned code "${obj}" at ${path}`);
      } else if (Array.isArray(obj)) {
          obj.forEach((v, i) => recursiveScan(v, `${path}[${i}]`));
      } else if (typeof obj === 'object') {
          for (const k in obj) {
              if (k === 'PHO' || k === 'PHU') hygieneIssues.push(`Found banned key "${k}" at ${path}`);
              recursiveScan(obj[k], `${path}.${k}`);
          }
      }
  };
  
  recursiveScan(mentions, 'mentions');
  // Ledger scan
  try {
     const lContent = await fs.readFile(ledgerPath, 'utf8');
     recursiveScan(JSON.parse(lContent), 'ledger');
  } catch {}

  // PASS means: Category C = 0, Ledger = 0, Hygiene = 0
  // A/B are WARN buckets (metadata/extraction mismatches, not failures)
  const passed = categoryC.length === 0 && ledgerIssues.length === 0 && hygieneIssues.length === 0;
  const hasWarnings = categoryA.length > 0 || categoryB.length > 0;

  return {
    status: passed ? (hasWarnings ? 'PASS*' : 'PASS') : 'FAIL',
    rowsCount: realRows.length,
    mentionsCount: mentions.length,
    categoryA,
    categoryB,
    categoryC,
    ledgerIssues,
    hygieneIssues
  };
}

async function run() {
  const arg = process.argv.find(a => a.startsWith('--teams='));
  const teamList = arg ? (arg.split('=')[1] === 'ALL' ? Object.values(INTERNAL_TEAM_CODE_MAP) : arg.split('=')[1].split(',')) : Object.values(INTERNAL_TEAM_CODE_MAP);
 
  console.log(`Starting Audit for ${teamList.length} teams...`);
  
  try {
      const results: any[] = [];
      
      // Batch processing (size 5)
      const BATCH_SIZE = 5;
      for (let i = 0; i < teamList.length; i += BATCH_SIZE) {
          const batch = teamList.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (t) => {
              if (!REALGM_TEAM_URLS[t]) return;
              try {
                  const res = await auditTeam(t);
                  results.push({ team: t, ...res });
                  const details = [];
                  if (res.categoryC.length) details.push(`MISSING(C):${res.categoryC.length}`);
                  else if (res.categoryA.length || res.categoryB.length) details.push(`Warn(A/B):${res.categoryA.length + res.categoryB.length}`);
                  
                  if (res.ledgerIssues.length) details.push(`Ledger:${res.ledgerIssues.length}`);
                  if (res.hygieneIssues.length) details.push(`Hygiene:${res.hygieneIssues.length}`);
                  
                  console.log(`Scanning ${t}... ${res.status} ${details.length ? '(' + details.join(', ') + ')' : ''}`);
              } catch (e) {
                  console.log(`Scanning ${t}... ERROR (${e})`);
                  results.push({ team: t, status: 'ERROR', categoryA: [], categoryB: [], categoryC: [], ledgerIssues: [`Scrape failed: ${e}`], hygieneIssues: [] });
              }
          }));
      }

      // Sort results by team for consistency
      results.sort((a,b) => a.team.localeCompare(b.team));

      // Summary output
      console.log('\n\n========== SUMMARY ==========');
      console.table(results.map(r => ({
          Team: r.team,
          Status: r.status,
          Rows: r.rowsCount,
          Mentions: r.mentionsCount,
          'A(Meta)': r.categoryA?.length || 0,
          'B(Extr)': r.categoryB?.length || 0,
          'C(MISS)': r.categoryC?.length || 0,
          Ledger: r.ledgerIssues?.length || 0,
          Hygiene: r.hygieneIssues?.length || 0
      })));

      // Detailed Failures
      const failures = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
      if (failures.length > 0) {
          console.log('\n========== FAILURES ==========');
          for (const f of failures) {
              console.log(`\n[${f.team}]`);
              if (f.categoryC?.length) {
                  console.log('  CATEGORY C (LIKELY MISSING - REAL BUGS):');
                  f.categoryC.forEach((c: any) => console.log(`    [${c.year}] "${c.text}" (Best: ${c.bestCandidate} @ ${c.bestScore})`));
              }
              if (f.categoryB?.length) {
                  console.log('  CATEGORY B (EXTRACTION GAP):');
                  f.categoryB.forEach((c: any) => console.log(`    [${c.year}] "${c.text}" (Best: ${c.bestCandidate} @ ${c.bestScore})`));
              }
               if (f.categoryA?.length) {
                  console.log('  CATEGORY A (METADATA MISMATCH):');
                  f.categoryA.slice(0, 5).forEach((c: any) => console.log(`    [${c.year}] "${c.text}" (BestScore: ${c.bestScore})`));
                  if (f.categoryA.length > 5) console.log(`    ... and ${f.categoryA.length - 5} more`);
              }
              
              if (f.ledgerIssues?.length) console.log('  LEDGER ISSUES:', f.ledgerIssues);
              if (f.hygieneIssues?.length) console.log('  HYGIENE ISSUES:', f.hygieneIssues);
          }
      } else {
          console.log('\n✅ ALL SYSTEMS PASS');
      }

  } finally {
      // Done
  }
}

run().catch(console.error);
