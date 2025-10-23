// parse_player.ts — SalarySwish player page → structured player JSON (comprehensive contract & bio data)
// RUN:
//   npm pkg set scripts.parse-player="tsx player-scrape/scripts/parse_player.ts"
//   PLAYER_URL="https://salaryswish.com/players/austin-reaves" PLAYER_ID="austin_reaves" npm run parse-player
//   DEBUG=1 … (optional) to see what sections were matched
//
// INPUT:  ../examples/page.html (from fetch_player_page.ts)
// OUTPUT: ../output/player.json
//
// Requires: cheerio

import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG = process.env.DEBUG === '1';

type Money = number;

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const squeezeSpaces = (s: string) => s.replace(/[ \t]+/g, ' ').trim();
const moneyNum = (s?: string) => {
  if (!s) return undefined;
  const v = Number(s.replace(/[$, ]/g, ''));
  return Number.isFinite(v) ? v : undefined;
};
const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const seasonStartYear = (season?: string) => {
  const m = season?.match(/^(\d{4})\s*-\s*\d{2}$/);
  return m ? parseInt(m[1], 10) : undefined;
};
const cleanLabelVal = (t: string) => norm(t.replace(/\s*[:\-–]\s*/g, ': '));

const teamSlugToCode: Record<string, string> = {
  hawks: 'ATL',
  celtics: 'BOS',
  nets: 'BKN',
  hornets: 'CHA',
  bulls: 'CHI',
  cavaliers: 'CLE',
  mavericks: 'DAL',
  nuggets: 'DEN',
  pistons: 'DET',
  warriors: 'GSW',
  rockets: 'HOU',
  pacers: 'IND',
  clippers: 'LAC',
  lakers: 'LAL',
  grizzlies: 'MEM',
  heat: 'MIA',
  bucks: 'MIL',
  timberwolves: 'MIN',
  pelicans: 'NOP',
  knicks: 'NYK',
  thunder: 'OKC',
  magic: 'ORL',
  sixers: 'PHI',
  suns: 'PHX',
  blazers: 'POR',
  trailblazers: 'POR',
  kings: 'SAC',
  spurs: 'SAS',
  raptors: 'TOR',
  jazz: 'UTA',
  wizards: 'WAS',
};
const teamCodeToName: Record<string, string> = {
  ATL: 'Atlanta Hawks',
  BOS: 'Boston Celtics',
  BKN: 'Brooklyn Nets',
  CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls',
  CLE: 'Cleveland Cavaliers',
  DAL: 'Dallas Mavericks',
  DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons',
  GSW: 'Golden State Warriors',
  HOU: 'Houston Rockets',
  IND: 'Indiana Pacers',
  LAC: 'LA Clippers',
  LAL: 'Los Angeles Lakers',
  MEM: 'Memphis Grizzlies',
  MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks',
  MIN: 'Minnesota Timberwolves',
  NOP: 'New Orleans Pelicans',
  NYK: 'New York Knicks',
  OKC: 'Oklahoma City Thunder',
  ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers',
  PHX: 'Phoenix Suns',
  POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings',
  SAS: 'San Antonio Spurs',
  TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz',
  WAS: 'Washington Wizards',
};

const dbg = (label: string, val: any) => {
  if (DEBUG)
    console.log(
      `🔎 ${label}:`,
      typeof val === 'string'
        ? val.slice(0, 200) + (val.length > 200 ? '…' : '')
        : val
    );
};

/** Find the closest container section whose header text matches `re` */
function sectionAfterHeader($: cheerio.CheerioAPI, re: RegExp) {
  const hdr = $('h1,h2,h3,h4,h5,h6')
    .filter((_, el) => re.test($(el).text()))
    .first();
  if (!hdr.length) return { node: $.root(), text: $.root().text() };
  const container = hdr.closest('section,article,div');
  const node = container.length ? container : hdr.parent();
  return { node, text: node.text() };
}

/** Find a compact “bio” container by locating a label like BORN:/HEIGHT:/WEIGHT: and taking its ancestor block */
function findBioContainer($: cheerio.CheerioAPI) {
  const labelEl = $(
    '*:contains("BORN:") , *:contains("HEIGHT:") , *:contains("WEIGHT:") , *:contains("SHOOTS:")'
  ).first();
  if (labelEl.length) {
    const node = labelEl.closest('section,article,div');
    if (node.length) return node;
    return labelEl.parent();
  }
  // Fallback to the header block (usually near the name)
  const headerBlock = $('h1').first().closest('section,article,div');
  return headerBlock.length ? headerBlock : $.root();
}

/** Safely get the text of a node without script/style/ads noise (strip iframes/scripts) */
function safeText($: cheerio.CheerioAPI, node: cheerio.Cheerio) {
  node.find('script,style,iframe,noscript').remove();
  return squeezeSpaces(node.text());
}

// ---------- salary table detection & parsing ----------
function findFirstSalaryTable($: cheerio.CheerioAPI) {
  const tables = $('table');
  for (let i = 0; i < tables.length; i++) {
    const t = tables.eq(i);
    const headers = t
      .find('thead th')
      .map((_, th) => norm($(th).text()))
      .get();
    const H = headers.join('|').toLowerCase();
    const looksSalary =
      /season/.test(H) &&
      /(salary|cap hit|guaranteed)/.test(H) &&
      !/(pts|ast|reb|fg%|min|playoffs|regular)/.test(H);
    if (looksSalary) return { table: t, headers };
  }
  return null;
}

/** Find ALL salary tables on the page (for detecting extensions/future contracts) */
function findAllSalaryTables($: cheerio.CheerioAPI) {
  const tables = $('table');
  const salaryTables: Array<{ table: cheerio.Cheerio; headers: string[]; heading: string }> = [];
  
  for (let i = 0; i < tables.length; i++) {
    const t = tables.eq(i);
    const headers = t
      .find('thead th')
      .map((_, th) => norm($(th).text()))
      .get();
    const H = headers.join('|').toLowerCase();
    const looksSalary =
      /season/.test(H) &&
      /(salary|cap hit|guaranteed)/.test(H) &&
      !/(pts|ast|reb|fg%|min|playoffs|regular)/.test(H);
    
    if (looksSalary) {
      // Try to find the heading/title above this table
      const container = t.closest('section,article,div');
      const heading = container.find('h6.sw_playerContract__title, h4, h5, h6')
        .filter((_, el) => {
          const text = $(el).text();
          return /contract|extension|rookie|veteran|two-way/i.test(text);
        })
        .first()
        .text();
      
      salaryTables.push({ table: t, headers, heading: norm(heading || '') });
    }
  }
  
  return salaryTables;
}
const headerIndex = (headers: string[], ...cands: RegExp[]) => {
  const L = headers.map((h) => h.toLowerCase());
  for (const re of cands) {
    const idx = L.findIndex((h) => re.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
};
function extractOptionFromCell($: cheerio.CheerioAPI, cell: cheerio.Cheerio) {
  const txt = norm(cell.text()).toLowerCase();
  if (/player option|\bpo\b/.test(txt)) return 'PO';
  if (/team option|\bto\b/.test(txt)) return 'TO';
  if (/early termination|eto/.test(txt)) return 'ETO';
  const tag = cell.find('.contract_tag.contract_option').text().toLowerCase();
  if (tag.includes('player')) return 'PO';
  if (tag.includes('team')) return 'TO';
  if (tag.includes('eto')) return 'ETO';
  return null;
}
function parseSalaryTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio,
  headers: string[]
) {
  const idxSeason = headerIndex(headers, /season/i);
  const idxCapHit = headerIndex(headers, /cap\s*hit/i, /\bcap\b/i);
  const idxSalary = headerIndex(headers, /base\s*salary/i, /\bsalary\b/i);
  const idxGuaranteed = headerIndex(headers, /guaranteed/i);
  const idxOption = headerIndex(headers, /option/i);
  const idxLikely = headerIndex(headers, /likely/i);
  const idxUnlikely = headerIndex(headers, /unlikely/i);

  const rows: any[] = [];
  table.find('tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (!cells.length || idxSeason < 0) return;

    const season = norm(cells.eq(idxSeason).text());
    if (!season) return;

    const capHit =
      idxCapHit >= 0 ? moneyNum(cells.eq(idxCapHit).text()) : undefined;
    const basePay =
      idxSalary >= 0 ? moneyNum(cells.eq(idxSalary).text()) : undefined;
    const guarantee =
      idxGuaranteed >= 0 ? moneyNum(cells.eq(idxGuaranteed).text()) : undefined;

    let option: 'PO' | 'TO' | 'ETO' | null = null;
    if (idxOption >= 0)
      option = extractOptionFromCell($, cells.eq(idxOption)) as any;
    if (!option)
      cells.each((__, c) => {
        if (!option) option = extractOptionFromCell($, $(c)) as any;
      });

    const likely =
      idxLikely >= 0 ? (moneyNum(cells.eq(idxLikely).text()) ?? 0) : 0;
    const unlikely =
      idxUnlikely >= 0 ? (moneyNum(cells.eq(idxUnlikely).text()) ?? 0) : 0;

    const salary = basePay ?? capHit ?? 0;
    const resolvedCap = capHit ?? basePay ?? salary;

    let guaranteed = false;
    if (typeof guarantee === 'number') {
      guaranteed = guarantee >= salary && salary > 0;
    } else {
      const rowTxt = $(tr).text().toLowerCase();
      guaranteed = !/non-?guaranteed|\bng\b/.test(rowTxt);
    }

    const rec: any = {
      season,
      year: parseInt(season.split('-')[0]), // Add year field for players_v2 compatibility
      salary,
      capHit: resolvedCap,
      guaranteed,
      guaranteedAmount: guaranteed ? salary : 0,
      option: option ?? null,
      tradeBonus: null,
      incentives: { likely, unlikely },
    };

    const kicker = $(tr)
      .text()
      .match(/(\d{1,2})%\s+(?:trade\s+)?(?:kicker|bonus)/i);
    if (kicker) rec.tradeBonus = parseInt(kicker[1], 10);

    rows.push(rec);
  });
  return rows;
}

// ---------- targeted scrapes ----------
function parseName($: cheerio.CheerioAPI, fallbackId: string) {
  const raw =
    $('h1.c[style*="text-transform:none"]').first().text() ||
    $('h1').first().text();
  const cleaned = norm(raw).replace(/\s+#\d+\b/, '');
  return cleaned
    ? titleCase(cleaned)
    : titleCase(fallbackId.replace(/_/g, ' '));
}

function parseTeam($: cheerio.CheerioAPI, teamCodeEnv?: string) {
  // Prefer the contract area for team link; fallback to header; fallback to first /teams/ link.
  const found = findFirstSalaryTable($);
  let ctx = $('h1').first().closest('section,article,div');
  if (found) {
    const tctx = found.table.closest('section,article,div');
    if (tctx.length) ctx = tctx;
  }
  let teamLink = ctx.find('a[href^="/teams/"]').first();
  if (!teamLink.length) teamLink = $('a[href^="/teams/"]').first();

  const slug =
    (teamLink.attr('href') || '')
      .split('/')
      .filter(Boolean)
      .pop()
      ?.toLowerCase() || '';
  const teamCode = teamCodeEnv || (teamSlugToCode[slug] ?? 'UNK');
  const teamName = norm(teamLink.text()) || teamCodeToName[teamCode] || '';
  return { teamName, teamCode };
}

function parseBio($: cheerio.CheerioAPI) {
  // 1) Get full-page text, minus obvious noise
  const root = $.root().clone();
  root.find('script,style,iframe,noscript').remove();

  // 2) Normalize weird punctuation + whitespace
  let text = root
    .text()
    .replace(/\u00a0/g, ' ') // nbsp -> space
    .replace(/[ \t]+/g, ' ') // collapse spaces
    .replace(/\s*\n+\s*/g, ' ') // collapse newlines
    .replace(/：/g, ':') // fullwidth colon -> :
    .replace(/[\u2018\u2019']/g, "'"); // curly/smart apostrophes -> straight apostrophe

  // 3) Ensure labels are anchorable even if jammed together, and add space after colon if missing
  text = text.replace(
    /(BORN|BIRTHPLACE|NATIONALITY|HEIGHT|WEIGHT|AGE|SHOOTS|DRAFT YEAR|Years of Service)\s*:/gi,
    ' $1: '
  );

  // 4) Fix run-on units (e.g. "6' 5195cm" -> "6' 5 195 cm", "197lbs89kg" -> "197 lbs 89 kg")
  // First, handle height special case where inches digit is jammed with cm number: "5195" -> "5 195"
  text = text.replace(/(\d)\s*(['\u2019])\s*(\d)(\d{2,3})\s*/gi, '$1$2 $3 $4 ');
  // Then normal unit separations
  text = text
    .replace(/(\d)(cm)\b/gi, '$1 $2')
    .replace(/(\d)(lbs)(\d)/gi, '$1 $2 $3') // "197lbs89" -> "197 lbs 89"
    .replace(/(\d)(lbs)\b/gi, '$1 $2')
    .replace(/(\d)(kg)\b/gi, '$1 $2');

  const bio: any = {};

  // ---- Position ----
  // Extract from "Shooting Guard", "Point Guard", etc. or look for single letter codes
  const mPositionLong = text.match(
    /\b(Shooting Guard|Point Guard|Small Forward|Power Forward|Center)\b/i
  );
  if (mPositionLong) {
    const pos = mPositionLong[1].toLowerCase();
    if (pos.includes('guard')) bio.position = 'G';
    else if (pos.includes('forward')) bio.position = 'F';
    else if (pos.includes('center')) bio.position = 'C';
  }

  // ---- Birthdate ----
  const mBorn = text.match(/\bBORN:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\b/i);
  if (mBorn) bio.birthdate = mBorn[1];

  // ---- Height (prefer dash/quote; fallback ft-in) ----
  // Look for patterns like "HEIGHT: 6' 5" or "HEIGHT: 6-5"
  // Must stop before any following digits (cm values)
  let h: string | undefined;
  const mHeightQuote = text.match(
    /\bHEIGHT:\s*([0-9])\s*['\u2019]\s*([0-9]{1,2})\s+/i
  );
  if (mHeightQuote) {
    h = `${mHeightQuote[1]}-${mHeightQuote[2]}`;
  } else {
    const mHeightDash = text.match(
      /\bHEIGHT:\s*([0-9])\s*-\s*([0-9]{1,2})\s+/i
    );
    if (mHeightDash) {
      h = `${mHeightDash[1]}-${mHeightDash[2]}`;
    } else {
      const mHeightFtIn = text.match(
        /\bHEIGHT:\s*([0-9])\s*ft\s*([0-9]{1,2})\s*in\b/i
      );
      if (mHeightFtIn) h = `${mHeightFtIn[1]}-${mHeightFtIn[2]}`;
    }
  }
  if (h) bio.height = h;

  // ---- Weight (prefer lbs; fallback kg→lbs) ----
  let w: string | undefined;
  const mWeightLbs =
    text.match(/\bWEIGHT:\s*([0-9]{2,3})\s*lbs?\b/i) ||
    text.match(/\bWEIGHT:\s*([0-9]{2,3})(?=\s*lbs?\b)/i);
  if (mWeightLbs) {
    w = mWeightLbs[1];
  } else {
    const mWeightKg =
      text.match(/\bWEIGHT:\s*([0-9]{2,3})\s*kg\b/i) ||
      text.match(/\bWEIGHT:\s*([0-9]{2,3})(?=\s*kg\b)/i);
    if (mWeightKg) {
      const kg = parseInt(mWeightKg[1], 10);
      if (Number.isFinite(kg)) w = String(Math.round(kg * 2.20462));
    }
  }
  if (w) bio.weight = w;

  // ---- Age ----
  const mAge = text.match(/\bAGE:\s*(\d{1,2})\b/i);
  if (mAge) {
    const age = parseInt(mAge[1], 10);
    if (Number.isFinite(age) && age > 0 && age < 100) bio.age = age;
  }

  // ---- Shoots ----
  const mShoots = text.match(/\bSHOOTS:\s*([A-Za-z]+)/i);
  if (mShoots)
    bio.shoots =
      mShoots[1][0].toUpperCase() + mShoots[1].slice(1).toLowerCase();

  // ---- Years of Service (experience) ----
  // Match 1-2 digits, but if we see a 4-digit year right after, just take 1 digit
  const mYears = text.match(/\bYears?\s+of\s+Service\s*:\s*(\d{1,2})/i);
  if (mYears) {
    let nStr = mYears[1];
    // If we matched 2 digits but the second digit is part of a year (next chars are digits), take only first digit
    const afterMatch = text.substring(mYears.index! + mYears[0].length);
    if (nStr.length === 2 && /^\d{2,}/.test(afterMatch)) {
      nStr = nStr[0];
    }
    const n = parseInt(nStr, 10);
    if (Number.isFinite(n) && n > 0 && n <= 50) bio.experience = n;
  }

  // ---- Draft Information ----
  const mDraftYear = text.match(/\bDRAFT\s+YEAR:\s*([^\n]+)/i);
  if (mDraftYear) {
    const draftText = mDraftYear[1].trim();
    if (/undrafted/i.test(draftText)) {
      bio.draftYear = 'Undrafted';
    } else {
      // Try to extract year (4 digits)
      const yearMatch = draftText.match(/\b(\d{4})\b/);
      if (yearMatch) {
        bio.draftYear = yearMatch[1];

        // Look for round and pick in the draft text
        // Round: "Round 1", "1st Round", "Round: 1", etc.
        const roundMatch =
          draftText.match(/\bRound\s+(\d+)\b/i) ||
          draftText.match(/\b(\d+)(?:st|nd|rd|th)\s+Round\b/i) ||
          draftText.match(/\bRound:\s*(\d+)/i);
        if (roundMatch) bio.draftRound = parseInt(roundMatch[1], 10);

        // Pick: "Pick 15", "#15", "15th pick", "Pick: 15" etc.
        const pickMatch =
          draftText.match(/\bPick\s+(\d+)\b/i) ||
          draftText.match(/\b#(\d+)\s+pick\b/i) ||
          draftText.match(/\b(\d+)(?:st|nd|rd|th)\s+pick\b/i) ||
          draftText.match(/\bPick:\s*(\d+)/i) ||
          draftText.match(/\b#(\d+)\b/);
        if (pickMatch) bio.draftPick = parseInt(pickMatch[1], 10);

        // Drafting team: look for team name after "by"
        const teamMatch = draftText.match(
          /\bby\s+(?:the\s+)?([A-Za-z][a-zA-Z\s]+?)(?:\s+AGENT|\s+$|$)/i
        );
        if (teamMatch) {
          bio.draftedBy = teamMatch[1].trim();
        } else {
          // Try to find team code (2-3 uppercase letters before year)
          const teamCodeMatch = draftText.match(/\b([A-Z]{2,3})\s+\d{4}\b/);
          if (teamCodeMatch) bio.draftedBy = teamCodeMatch[1];
        }
      }
    }
  }

  if (process.env.DEBUG === '1') {
    console.log('🔎 bio-extract:', bio);
  }
  return bio;
}

function detectContractType($: cheerio.CheerioAPI) {
  let text = '';
  const h = $('h6.sw_playerContract__title').first();
  if (h.length) text = norm(h.text());
  else {
    const H = $('h3,h4,h5,h6')
      .filter((_, el) =>
        /contract|extension|rookie|designated|two-way|max/i.test($(el).text())
      )
      .first();
    if (H.length) text = norm(H.text());
  }
  const T = text.toUpperCase();
  const isExtension = /EXTENSION/.test(T);
  const isRookieScale = /ROOKIE|SCALE/.test(T);
  const isDesignated = /DESIGNATED/.test(T);
  const isTwoWay = /TWO-WAY|2-WAY/.test(T);
  let contractType = 'VETERAN CONTRACT';
  if (isTwoWay) contractType = 'TWO-WAY';
  else if (isDesignated && isRookieScale)
    contractType = 'DESIGNATED ROOKIE EXTENSION';
  else if (isExtension && isRookieScale) contractType = 'ROOKIE EXTENSION';
  else if (isRookieScale) contractType = 'ROOKIE SCALE';
  else if (isExtension) contractType = 'VETERAN EXTENSION';
  return { contractType, isExtension, isRookieScale };
}

/** Detect contract type from heading text (for multiple contracts) */
function detectContractTypeFromHeading(headingText: string) {
  const T = headingText.toUpperCase();
  const isExtension = /EXTENSION/.test(T);
  const isRookieScale = /ROOKIE|SCALE/.test(T);
  const isDesignated = /DESIGNATED/.test(T);
  const isSupermax = /SUPERMAX/.test(T);
  const isTwoWay = /TWO-WAY|2-WAY/.test(T);
  
  let contractType = 'VETERAN CONTRACT';
  if (isTwoWay) contractType = 'TWO-WAY';
  else if (isSupermax && isExtension) contractType = 'DESIGNATED SUPERMAX EXTENSION';
  else if (isDesignated && isRookieScale && isExtension)
    contractType = 'DESIGNATED ROOKIE EXTENSION';
  else if (isExtension && isRookieScale) contractType = 'ROOKIE EXTENSION';
  else if (isRookieScale) contractType = 'ROOKIE SCALE';
  else if (isDesignated && isExtension) contractType = 'DESIGNATED EXTENSION';
  else if (isExtension) contractType = 'VETERAN EXTENSION';
  
  return { contractType, isExtension, isRookieScale };
}

/** Current Contract section: Signing Team / Method / Date / Cap Hold / Trade Kicker */
function parseCurrentContractMeta($: cheerio.CheerioAPI) {
  // Prefer “CURRENT CONTRACT”; else use the first salary table container
  let scope = sectionAfterHeader($, /current\s*contract/i).node;
  if (!scope.length) {
    const found = findFirstSalaryTable($);
    if (found) scope = found.table.closest('section,article,div');
  }
  const text = safeText($, scope);

  // Signing Team
  const signingTeam = text.match(/Signing\s*Team:\s*([A-Z]{2,3})/i)?.[1];

  // Signing Method / Using  — stop at the next label so we don't swallow the rest of the paragraph
  const methodMatch = text.match(
    /Signing\s*(?:Method|Using)\s*:\s*([A-Za-z ':-]+?)(?=\s*(Signing\s*Date|Signing\s*Team|Source|Expiry|Length|Value|Cap\s*Hold|TRADE\s*KICKER|$))/i
  );
  let signedUsing = methodMatch?.[1]
    ?.replace(/[:\-]+/g, ' ')
    ?.replace(/\s+/g, ' ')
    ?.trim();
  if (signedUsing)
    signedUsing = signedUsing
      .split(' ')
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');

  // Signing Date (supports "July 6, 2023" and "07/06/2023")
  const signingDate =
    text.match(/Signing\s*Date:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})/i)?.[1] ||
    text.match(/Signing\s*Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];

  // Cap Hold — “Cap Hold 2027-28: $28,307,693”
  const capHold = moneyNum(text.match(/Cap\s*Hold[^$]*\$\s*([\d,]+)/i)?.[1]);

  // Trade Kicker — “TRADE KICKER: 15% …” or “… 15% trade kicker …”
  const tk =
    text.match(/TRADE\s*KICKER\s*:\s*(\d{1,2})%/i) ||
    text.match(/(\d{1,2})%\s+(?:trade\s+)?(?:kicker|bonus)/i) ||
    text.match(/(?:kicker|bonus)\s+of\s+(\d{1,2})%/i);
  const tradeKicker = tk ? parseInt(tk[1], 10) : null;

  return {
    signingTeam: signingTeam || undefined,
    signedUsing,
    signingDate,
    capHold,
    tradeKicker,
  };
}

function parseFreeAgency(
  $: cheerio.CheerioAPI,
  endSeason?: string | null,
  capHoldOverride?: number
) {
  // Use a Free Agency block if present; otherwise rely on current contract meta for cap hold.
  const faScope = sectionAfterHeader(
    $,
    /free\s*agency|fa status|cap\s*hold|qualifying/i
  ).node;
  const text = safeText($, faScope);
  const all = $.root().text();

  const fa = (text || all).match(/\b(RFA|UFA)\b(?:[:\s]+(\d{4}))?/i);
  const type = fa ? fa[1].toUpperCase() : null;
  const year =
    fa && fa[2]
      ? parseInt(fa[2], 10)
      : endSeason
        ? (seasonStartYear(endSeason) ?? 0) + 1
        : undefined;

  const capHold =
    typeof capHoldOverride === 'number'
      ? capHoldOverride
      : moneyNum((text || all).match(/Cap\s*Hold[^$]*\$\s*([\d,]+)/i)?.[1]);

  let qualifyingOffer: number | null = null;
  if (type === 'RFA') {
    qualifyingOffer =
      moneyNum(
        (text || all).match(/Qualifying\s*Offer[^$]*\$\s*([\d,]+)/i)?.[1]
      ) ?? null;
  }

  return { type, year, capHold, qualifyingOffer, earlyTerminationOption: null };
}

function parseBirdRights($: cheerio.CheerioAPI) {
  const scope = sectionAfterHeader($, /bird\s*rights|rights/i).node;
  const text = safeText($, scope) || $.root().text();
  // Prefer a short label value
  let status =
    text.match(/Bird\s*Rights\s*:\s*([A-Za-z \-]+)/i)?.[1] ||
    text.match(/\b(Bird|Early Bird|Non-Bird)\b/i)?.[1] ||
    'None';
  status = titleCase(
    norm(status)
      .replace(/\s+QVFA.*$/i, '')
      .trim()
  );
  const eligibleFor: string[] = [];
  if (/Early Bird/i.test(status)) eligibleFor.push('Early Bird Exception');
  if (/Bird/i.test(status)) eligibleFor.push('Bird Exception');
  return { status, eligibleFor: eligibleFor.length ? eligibleFor : undefined };
}

function parseTradeEligibility($: cheerio.CheerioAPI, isRookieScale: boolean) {
  const body = $.root().text().toLowerCase();
  const m = body.match(
    /cannot be traded until[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  const restrictedUntil = m ? m[1] : null;
  let reason: string | null = null;
  if (restrictedUntil) {
    if (body.includes('recently signed')) reason = 'Recent signing';
    else if (body.includes('recently traded')) reason = 'Recent trade';
    else if (body.includes('extension')) reason = 'Recent extension';
  }
  const baseYearCompensation = /base year compensation|\bbyc\b/.test(body);
  const poisonPill = isRookieScale && /poison pill/.test(body);
  const aggregation = !/cannot be aggregated/.test(body);
  return {
    canBeTradedNow: !restrictedUntil,
    restrictedUntil,
    reason,
    rules: { baseYearCompensation, poisonPill, aggregation },
  };
}

/** AGENT DETAILS block: "Agency: AMR Agency  Primary Agent: Aaron Reilly" */
function parseAgentInfo($: cheerio.CheerioAPI) {
  const scope = sectionAfterHeader(
    $,
    /agent details|agent|agency|representation/i
  ).node;
  const text = safeText($, scope) || $.root().text();

  // Agency: stop before "Primary Agent" or "Agent"
  const agency = text
    .match(
      /\bAgency\s*:\s*([A-Za-z0-9 .,&'-]+?)(?=\s*(Primary\s*Agent|Agent\b|$))/i
    )?.[1]
    ?.trim();

  // Agent: prefer "Primary Agent", fall back to "Agent:"
  const agent =
    text.match(/\bPrimary\s*Agent\s*:\s*([A-Za-z .,'-]+)\b/)?.[1]?.trim() ||
    text.match(/\bAgent\s*:\s*([A-Za-z .,'-]+)\b/)?.[1]?.trim();

  return { agent: agent || undefined, agency: agency || undefined };
}

/** Extract option summary from salary years */
function extractOptionSummary(salariesByYear: any[]) {
  // Find years with options
  const yearsWithOptions = salariesByYear.filter((y) => y.option);

  if (yearsWithOptions.length === 0) {
    return {
      hasOption: false,
      optionYear: null,
      optionType: null,
    };
  }

  // Take the first option found (usually the most relevant)
  const firstOption = yearsWithOptions[0];

  return {
    hasOption: true,
    optionYear: firstOption.season,
    optionType: firstOption.option,
  };
}

// ---------- main ----------
async function main() {
  const playerUrlEnv = (process.env.PLAYER_URL || '').replace('://www.', '://');
  let playerId =
    process.env.PLAYER_ID ||
    (playerUrlEnv ? playerUrlEnv.split('/').pop()!.replace(/-/g, '_') : '') ||
    'unknown';

  const htmlPath = join(__dirname, '../examples/page.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  const $ = cheerio.load(html);

  console.log(`📄 Parsing player page (${(html.length / 1024).toFixed(2)} KB)`);

  const displayName = parseName($, playerId);
  if (playerId === 'unknown' && displayName) {
    playerId = displayName
      .toLowerCase()
      .replace(/[^a-z]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  const { teamName, teamCode } = parseTeam($, process.env.TEAM_CODE);
  const bio = parseBio($);

  // Find all salary tables to detect extensions/future contracts
  const allSalaryTables = findAllSalaryTables($);
  dbg('Found salary tables', allSalaryTables.length);
  
  // Parse first table as current contract (fallback to old method if no tables found)
  const found = allSalaryTables.length > 0 
    ? allSalaryTables[0]
    : findFirstSalaryTable($);
    
  const salariesByYear = found
    ? parseSalaryTable($, found.table, found.headers)
    : [];

  const { contractType, isExtension, isRookieScale } = detectContractType($);

  const meta = parseCurrentContractMeta($); // signedUsing, signingTeam, signingDate, capHold, tradeKicker

  const startSeason = salariesByYear[0]?.season || null;
  const endSeason =
    salariesByYear[salariesByYear.length - 1]?.season || startSeason;

  const contractLength = salariesByYear.length;
  const totalValue = salariesByYear.reduce((s, y) => s + (y.salary || 0), 0);
  const averageAnnualValue = contractLength ? totalValue / contractLength : 0;
  const guaranteedValue = salariesByYear.reduce(
    (s, y) => s + (y.guaranteedAmount || 0),
    0
  );
  const guaranteedYears = salariesByYear.filter((y) => y.guaranteed).length;

  const CURRENT_SEASON_START = 2025;
  const endYearNum = endSeason
    ? (seasonStartYear(endSeason!) ?? CURRENT_SEASON_START - 1)
    : CURRENT_SEASON_START - 1;
  const yearsRemaining = Math.max(0, endYearNum - CURRENT_SEASON_START + 1);

  const birdRights = parseBirdRights($);
  const freeAgency = parseFreeAgency($, endSeason, meta.capHold);
  if (freeAgency.type !== 'RFA') freeAgency.qualifyingOffer = null;

  // Add option summary to free agency
  const optionSummary = extractOptionSummary(salariesByYear);
  Object.assign(freeAgency, optionSummary);

  const tradeEligibility = parseTradeEligibility($, isRookieScale);

  const hasNTC = /\bno-?trade clause\b|\bntc\b/i.test($.root().text());

  const { agent, agency } = parseAgentInfo($);

  // Check for future contract (extension that hasn't started yet)
  let futureContract: any = undefined;
  
  if (allSalaryTables.length > 1) {
    dbg('Multiple salary tables found - checking for future contract', '');
    
    // Parse second table
    const futureTable = allSalaryTables[1];
    const futureSalariesByYear = parseSalaryTable($, futureTable.table, futureTable.headers);
    
    if (futureSalariesByYear.length > 0) {
      const futureStartSeason = futureSalariesByYear[0]?.season;
      const futureEndSeason = futureSalariesByYear[futureSalariesByYear.length - 1]?.season;
      const futureStartYear = seasonStartYear(futureStartSeason);
      const currentEndYear = seasonStartYear(endSeason!);
      
      // Verify this is actually a future contract (starts after current ends or in the future)
      if (futureStartYear && currentEndYear && futureStartYear >= currentEndYear) {
        dbg('Future contract detected', `${futureStartSeason} - ${futureEndSeason}`);
        
        const futureContractTypeInfo = detectContractTypeFromHeading(futureTable.heading);
        const futureContractLength = futureSalariesByYear.length;
        const futureTotalValue = futureSalariesByYear.reduce((s, y) => s + (y.salary || 0), 0);
        const futureAverageAnnualValue = futureContractLength ? futureTotalValue / futureContractLength : 0;
        const futureGuaranteedValue = futureSalariesByYear.reduce(
          (s, y) => s + (y.guaranteedAmount || 0),
          0
        );
        const futureGuaranteedYears = futureSalariesByYear.filter((y) => y.guaranteed).length;
        const futureYearsRemaining = Math.max(0, (seasonStartYear(futureEndSeason) ?? 0) - CURRENT_SEASON_START + 1);
        
        // For future contracts, parse their metadata from the contract section
        // (they may have different signing details than current contract)
        const futureOptionSummary = extractOptionSummary(futureSalariesByYear);
        
        futureContract = {
          contractType: futureContractTypeInfo.contractType,
          isExtension: futureContractTypeInfo.isExtension,
          isRookieScale: futureContractTypeInfo.isRookieScale,
          signedUsing: meta.signedUsing, // Usually same as current
          signingTeam: meta.signingTeam || teamCode,
          signingDate: meta.signingDate,
          signedByCurrentTeam: (meta.signingTeam || teamCode) === teamCode,
          startSeason: futureStartSeason,
          endSeason: futureEndSeason,
          contractLength: futureContractLength,
          yearsRemaining: futureYearsRemaining,
          totalValue: futureTotalValue,
          averageAnnualValue: futureAverageAnnualValue,
          guaranteedValue: futureGuaranteedValue,
          guaranteedYears: futureGuaranteedYears,
          salariesByYear: futureSalariesByYear,
          noTradeClause: !!hasNTC,
          tradeKicker: meta.tradeKicker,
          tradeRestrictions: [],
          birdRights,
          freeAgency: {
            ...freeAgency,
            ...futureOptionSummary,
            year: futureStartYear ? futureStartYear + futureContractLength : undefined,
          },
          tradeEligibility,
        };
      }
    }
  }

  const output: any = {
    _note:
      '⚠️ PLACEHOLDER TEST DATA - Parsed from a local HTML snapshot. For production, always fetch fresh SalarySwish HTML first.',
    playerId,
    displayName,
    teamCode,
    teamName,
    bio,
    contract: {
      contractType,
      isExtension,
      isRookieScale,
      signedUsing: meta.signedUsing,
      signingTeam: meta.signingTeam || teamCode,
      signingDate: meta.signingDate,
      signedByCurrentTeam: (meta.signingTeam || teamCode) === teamCode,
      startSeason,
      endSeason,
      contractLength,
      yearsRemaining,
      totalValue,
      averageAnnualValue,
      guaranteedValue,
      guaranteedYears,
      salariesByYear,
      noTradeClause: !!hasNTC,
      tradeKicker: meta.tradeKicker,
      tradeRestrictions: [],
      birdRights,
      freeAgency,
      tradeEligibility,
    },
    ...(futureContract ? { futureContract } : {}),
    representation: {
      agent: agent ?? null,
      agency: agency ?? null,
    },
    source: {
      provider: 'SalarySwish',
      playerPageUrl: playerUrlEnv || 'snapshot',
      scrapedAt: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
    version: '1.0',
  };

  const outDir = join(__dirname, '../output');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'player.json');
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ Parsed player data for: ${displayName}`);
  console.log(`   Team: ${output.teamName} (${output.teamCode})`);
  console.log(`   Contract: ${contractType}`);
  console.log(
    `   Years: ${contractLength} (${startSeason ?? '-'} - ${endSeason ?? '-'})`
  );
  console.log(`   Total Value: $${(totalValue / 1_000_000).toFixed(1)}M`);
  
  if (futureContract) {
    console.log(`   📋 Found future contract: ${futureContract.contractType} (${futureContract.startSeason} - ${futureContract.endSeason})`);
    console.log(`   Future Extension: ${futureContract.contractType}`);
    console.log(`   Future Value: $${(futureContract.totalValue / 1_000_000).toFixed(1)}M`);
  }
  
  console.log(`   Bird Rights: ${birdRights.status}`);
  console.log(`   Cap Hold: ${freeAgency.capHold ?? '—'}`);
  console.log(`   Trade Kicker: ${meta.tradeKicker ?? '—'}%`);
  console.log(`   Signed Using: ${meta.signedUsing ?? '—'}`);
  console.log(`   Signed Date: ${meta.signingDate ?? '—'}`);
  console.log(`   Agent/Agency: ${agent ?? '—'} / ${agency ?? '—'}`);
  console.log(`📁 Output saved to: ${outPath}`);
}

main().catch((err) => {
  console.error('❌ Error parsing player:', err);
  process.exit(1);
});
