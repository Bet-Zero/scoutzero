// parse_player.ts — SalarySwish player page → structured player JSON (comprehensive contract & bio data)
// RUN:
//   npm pkg set scripts.parse-player="tsx player-scrape/contracts/scripts/parse_player.ts"
//   PLAYER_URL="https://salaryswish.com/players/austin-reaves" PLAYER_ID="austin_reaves" npm run parse-player
//   DEBUG=1 … (optional) to see what sections were matched
//
// INPUT:  ../working/page.html (from fetch_player_page.ts)
// OUTPUT: ../../output/player.json
//
// Requires: cheerio
//
// ============================================================================
// CONTRACT NORMALIZATION RULES (LOCKED SPECIFICATION)
// ============================================================================
// These rules apply universally to all players. No player-specific logic.
//
// 1. optionUsed / optionDecisionDate Pairing
//    - Both must be null together, or both must be set together
//    - If optionUsed is true|false, optionDecisionDate MUST be ISO "YYYY-MM-DD"
//    - If optionUsed is null, optionDecisionDate MUST be null
//    - Enforced by: validateOptionFieldPairing()
//
// 2. ISO Date Requirement
//    - All dates (optionDecisionDate, voidedOn, etc.) MUST be ISO "YYYY-MM-DD"
//    - Never emit human formats like "Aug 2, 2025"
//    - Enforced by: toISODate() and parseOptionUsedDate()
//
// 3. yearsRemaining Logic
//    - Count ONLY seasons in salariesByYear that are:
//      a) Still live after today (based on CURRENT_SEASON_START)
//      b) NOT marked voidedByExtension
//    - Enforced by: normalizeContractVoidedOptions() recalculation
//
// 4. Player Option Guarantee Policy
//    - Live PO (optionUsed=null AND NOT voidedByExtension): guaranteed=true, guaranteedAmount=salary
//    - Declined/voided PO (optionUsed=false OR voidedByExtension=true): guaranteed=false, guaranteedAmount=0
//    - Enforced by: applyPlayerOptionPolicy() for live POs; normalizeContractVoidedOptions() for voided POs
//
// 5. Contract Linkage Metadata
//    - Old contract: supersededIn (season), supersededByContractRef (contractType)
//    - New contract: supersedesContractRef (old contractType)
//    - Enforced by: normalizeContractVoidedOptions()
//
// 6. signedByCurrentTeam Semantics
//    - Compares signingTeam to current teamCode at scrape time
//    - Not historical - reflects current team ownership
//
// 7. Money Headlines Preservation
//    - DO NOT change: totalValue, averageAnnualValue (reflect original contract)
//    - DO recompute: guaranteedValue, guaranteedYears (based on active years)
//    - Enforced by: normalizeContractVoidedOptions()
// ============================================================================

import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG = process.env.DEBUG === '1';

type Money = number;

// Constant to indicate that a guarantee amount will be filled in later with the full salary
const GUARANTEE_AMOUNT_TBD = 0;

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const squeezeSpaces = (s: string) => s.replace(/[ \t]+/g, ' ').trim();
const moneyNum = (s?: string) => {
  if (!s) return undefined;

  // Try to extract just the first dollar amount using regex
  // Handles cases like "$88,075 (0—88.1k)" by extracting just "$88,075"
  const match = s.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (match) {
    const v = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(v) ? v : undefined;
  }

  // Fallback to original logic for non-dollar-prefixed numbers
  const v = Number(s.replace(/[$, ]/g, ''));
  return Number.isFinite(v) ? v : undefined;
};
const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const seasonStartYear = (season?: string) => {
  const m = season?.match(/^(\d{4})\s*-\s*\d{2}$/);
  return m ? parseInt(m[1], 10) : undefined;
};
const cleanLabelVal = (t: string) => norm(t.replace(/\s*[:\-–]\s*/g, ' '));
/** Strip contract type tags from season strings (e.g., "2025-26 Max" -> "2025-26") */
const cleanSeason = (s: string) => {
  // Remove common contract tags: Max, PO (Player Option), TO (Team Option), ETO, etc.
  return s
    .replace(
      /\s+(Max|PO|TO|ETO|Player Option|Team Option|Early Termination|Supermax|Designated|Rookie|Veteran|Two-Way|Extension).*$/i,
      ''
    )
    .trim();
};

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

/** Parse "Option Used: No (Aug 2, 2025)" or "Option Used: Yes (Aug 2, 2025)" into ISO date */
function parseOptionUsedDate(text: string): {
  optionUsed: boolean | null;
  optionDecisionDate: string | null;
} {
  // Look for "Option Used: No (Aug 2, 2025)" or "Option Used: Yes (Aug 2, 2025)"
  // OR just "Yes (Aug 2, 2025)" or "No (Aug 2, 2025)" when in the Option Used column
  const match = text.match(/(?:Option\s+Used:\s*)?(Yes|No)\s*\(([^)]+)\)/i);
  if (!match) return { optionUsed: null, optionDecisionDate: null };

  const optionUsed = match[1].toLowerCase() === 'yes';
  const dateStr = match[2].trim();

  // Convert the date to ISO format (YYYY-MM-DD)
  const optionDecisionDate = toISODate(dateStr);

  return { optionUsed, optionDecisionDate };
}

/** Convert human-readable date to ISO format (YYYY-MM-DD) */
function toISODate(dateStr: string): string | null {
  // Parse date like "Aug 2, 2025" to ISO "2025-08-02"
  const dateMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (dateMatch) {
    const monthMap: Record<string, string> = {
      jan: '01',
      january: '01',
      feb: '02',
      february: '02',
      mar: '03',
      march: '03',
      apr: '04',
      april: '04',
      may: '05',
      jun: '06',
      june: '06',
      jul: '07',
      july: '07',
      aug: '08',
      august: '08',
      sep: '09',
      september: '09',
      oct: '10',
      october: '10',
      nov: '11',
      november: '11',
      dec: '12',
      december: '12',
    };

    const month = monthMap[dateMatch[1].toLowerCase()];
    if (!month) return null;

    const day = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3];

    return `${year}-${month}-${day}`;
  }

  // Parse date like "07/06/2023" to ISO "2023-07-06"
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Parse guarantee details from the page for a specific season
 * Returns guarantee schedule with triggers and dates
 */
function parseGuaranteeDetails(
  $: cheerio.CheerioAPI,
  season: string
): {
  guaranteedAmount: number;
  guaranteeSchedule: Array<{
    effectiveDate: string;
    guaranteedAmount: number;
    status: string;
    note: string;
  }> | null;
} {
  // Look for "Guaranteed Details" section - it's a div, not a header
  // Pattern: <div class="">GUARANTEED DETAILS</div> followed by guarantee detail divs
  const guaranteeDetailsDivs = $('div').filter((_, el) => {
    const text = $(el).text().trim();
    return /^GUARANTEED\s+DETAILS$/i.test(text);
  });

  if (guaranteeDetailsDivs.length === 0) {
    if (DEBUG)
      dbg(
        `No GUARANTEED DETAILS section found for ${season}`,
        'No guarantee details div found'
      );
    return { guaranteedAmount: 0, guaranteeSchedule: null };
  }

  // Find the parent container and get all sibling divs that contain guarantee info for this season
  const guaranteeContainer = guaranteeDetailsDivs.first().parent();
  const seasonLines: string[] = [];

  // Look for divs that start with the season pattern (e.g., "2025-26:")
  guaranteeContainer.find('div').each((_, el) => {
    const text = $(el).text().trim();
    if (text.startsWith(`${season}:`)) {
      seasonLines.push(text);
    }
  });

  if (seasonLines.length === 0) {
    if (DEBUG)
      dbg(
        `No guarantee lines found for ${season}`,
        'No divs starting with season found'
      );
    return { guaranteedAmount: 0, guaranteeSchedule: null };
  }

  const seasonContent = seasonLines.join(' ');

  if (DEBUG) {
    dbg(`Guarantee lines for ${season}`, seasonLines);
    dbg(`Combined guarantee text for ${season}`, seasonContent.slice(0, 500));
  }

  const schedule: Array<{
    effectiveDate: string;
    guaranteedAmount: number;
    status: string;
    note: string;
  }> = [];

  // Extract baseline guaranteed amount from initial "[Requirements Met]" portion
  // Pattern: "$88,075 Team Option [Requirements Met]"
  let baselineAmount = 0;
  const baselineMatch = seasonContent.match(
    /\$\s*([\d,]+)\s+(?:Team\s+Option\s+)?\[Requirements\s+Met\]/i
  );
  if (baselineMatch) {
    baselineAmount = moneyNum(baselineMatch[1]) || 0;
    if (DEBUG) dbg(`Found baseline amount for ${season}`, baselineAmount);
  }

  // Parse guarantee increase triggers
  // Pattern 1: "Increase from $X to $Y (+$Z) if the player is not waived prior to the first regular season game [Decision Pending]"
  const gameIncreasePattern =
    /Increase\s+from\s+\$\s*[\d,]+\s+to\s+\$\s*([\d,]+)\s+\([^)]+\)\s+if\s+(?:the\s+)?player\s+is\s+not\s+waived\s+(?:prior\s+to\s+)?(?:the\s+)?(first\s+regular\s+season\s+game)[^[]*\[([^\]]+)\]/gi;
  let match;
  while ((match = gameIncreasePattern.exec(seasonContent)) !== null) {
    const amount = moneyNum(match[1]) || 0;
    const event = match[2].trim();
    const status = match[3].trim();
    // Normalize effectiveDate: append season to "first regular season game"
    const normalizedDate = `${event} ${season}`;
    schedule.push({
      effectiveDate: normalizedDate,
      guaranteedAmount: amount,
      status: status,
      note: `Increases to $${amount.toLocaleString()} if not waived before ${event}`,
    });
    if (DEBUG)
      dbg(`Found game trigger for ${season}`, { amount, event, status });
  }

  // Pattern 2: "Increase from $X to $Y (+$Z) if player is not waived before [DATE] [Decision Pending]"
  const dateIncreasePattern =
    /Increase\s+from\s+\$\s*[\d,]+\s+to\s+\$\s*([\d,]+)\s+\([^)]+\)\s+if\s+(?:the\s+)?player\s+is\s+not\s+waived\s+before\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})[^[]*\[([^\]]+)\]/gi;
  while ((match = dateIncreasePattern.exec(seasonContent)) !== null) {
    const amount = moneyNum(match[1]) || 0;
    const dateStr = match[2].trim();
    const status = match[3].trim();
    // Normalize effectiveDate: convert to ISO format (YYYY-MM-DD)
    const normalizedDate = toISODate(dateStr) || dateStr;
    schedule.push({
      effectiveDate: normalizedDate,
      guaranteedAmount: amount,
      status: status,
      note: `Increases to $${amount.toLocaleString()} if not waived before ${dateStr}`,
    });
    if (DEBUG)
      dbg(`Found date trigger for ${season}`, { amount, dateStr, status });
  }

  // Pattern 3: Generic "if not waived before [DATE], becomes fully guaranteed" (fallback)
  // For cases where the text format might vary
  if (schedule.length === 0) {
    const fallbackPattern =
      /(?:I|i)f\s+(?:player\s+is\s+)?not\s+waived\s+before\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})[^$]*becomes\s+fully\s+guaranteed/gi;
    while ((match = fallbackPattern.exec(seasonContent)) !== null) {
      const dateStr = match[1].trim();
      // Normalize effectiveDate: convert to ISO format (YYYY-MM-DD)
      const normalizedDate = toISODate(dateStr) || dateStr;
      schedule.push({
        effectiveDate: normalizedDate,
        guaranteedAmount: GUARANTEE_AMOUNT_TBD, // Will be filled in with salary amount later
        status: 'Decision Pending',
        note: `Becomes fully guaranteed if not waived before ${dateStr}`,
      });
      if (DEBUG) dbg(`Found fallback trigger for ${season}`, { dateStr });
    }
  }

  if (DEBUG) {
    dbg(`Final guarantee schedule for ${season}`, {
      baselineAmount,
      scheduleLength: schedule.length,
    });
  }

  return {
    guaranteedAmount: baselineAmount,
    guaranteeSchedule: schedule.length > 0 ? schedule : null,
  };
}

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
  const salaryTables: Array<{
    table: cheerio.Cheerio;
    headers: string[];
    heading: string;
  }> = [];

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
      // Look for h6.sw_playerContract__title that comes before this table
      let heading = '';

      // Strategy 1: Look in parent sw_playerContract for h6.sw_playerContract__title
      const contractWrapper = t.closest('.sw_playerContract');
      if (contractWrapper.length) {
        const h6 = contractWrapper.find('h6.sw_playerContract__title').first();
        if (h6.length) {
          heading = norm(h6.text());
        }
      }

      // Strategy 2: Find preceding h6.sw_playerContract__title
      if (!heading) {
        const prevH6 = t.prevAll('h6.sw_playerContract__title').first();
        if (prevH6.length) {
          heading = norm(prevH6.text());
        }
      }

      // Strategy 3: Look in parent container for h6.sw_playerContract__title
      if (!heading) {
        const container = t.closest('section,article,div');
        const h6 = container.find('h6.sw_playerContract__title').first();
        if (h6.length) {
          heading = norm(h6.text());
        }
      }

      // Strategy 4: Look for any h4, h5, h6 with contract keywords before this table
      if (!heading) {
        const prevHeading = t
          .prevAll('h4, h5, h6')
          .filter((_, el) => {
            const text = $(el).text();
            return /contract|extension|rookie|veteran|two-way|supermax|designated/i.test(
              text
            );
          })
          .first();
        if (prevHeading.length) {
          heading = norm(prevHeading.text());
        }
      }

      salaryTables.push({ table: t, headers, heading: norm(heading || '') });

      if (DEBUG) {
        dbg(`Salary table ${i + 1} heading`, heading || '(none found)');
      }
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
  // Look for contract_tag with contract_option or contract_option_green/red classes
  const tag = cell
    .find('.contract_tag[class*="contract_option"]')
    .text()
    .toLowerCase();
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
  const idxOption = headerIndex(headers, /^option$/i); // Match "Option" column only, not "Option Used"
  const idxOptionUsed = headerIndex(headers, /option\s*used/i); // Match "Option Used" column
  const idxLikely = headerIndex(headers, /likely/i);
  const idxUnlikely = headerIndex(headers, /unlikely/i);

  const rows: any[] = [];
  const allRows = table.find('tbody tr').toArray();

  for (let i = 0; i < allRows.length; i++) {
    const tr = allRows[i];
    const cells = $(tr).find('td');
    if (!cells.length || idxSeason < 0) continue;

    const rawSeason = norm(cells.eq(idxSeason).text());
    if (!rawSeason) continue;

    // Skip rows that only contain "Option Used" info (colspan rows)
    if (/^Option\s+Used:/i.test(rawSeason)) continue;

    const season = cleanSeason(rawSeason);

    const capHit =
      idxCapHit >= 0 ? moneyNum(cells.eq(idxCapHit).text()) : undefined;
    const basePay =
      idxSalary >= 0 ? moneyNum(cells.eq(idxSalary).text()) : undefined;

    // Fix guaranteed amount parsing to handle nested div tooltips
    let guarantee: number | undefined = undefined;
    if (idxGuaranteed >= 0) {
      const guaranteedCell = cells.eq(idxGuaranteed);
      // First try to get only the direct text content (excluding nested divs)
      const cellClone = guaranteedCell.clone();
      cellClone.find('div').remove(); // Remove tooltip divs
      const cleanText = cellClone.text().trim();

      if (cleanText) {
        guarantee = moneyNum(cleanText);
      } else {
        // Fallback: extract the first money amount from the full text
        const fullText = guaranteedCell.text();
        const moneyMatch = fullText.match(/\$\s*([\d,]+)/);
        if (moneyMatch) {
          guarantee = moneyNum(moneyMatch[1]);
        }
      }
    }

    let option: 'PO' | 'TO' | 'ETO' | null = null;
    let optionUsed: boolean | null = null;
    let optionDecisionDate: string | null = null;

    if (idxOption >= 0) {
      option = extractOptionFromCell($, cells.eq(idxOption)) as any;
    }

    // Check the "Option Used" column if it exists
    if (idxOptionUsed >= 0) {
      const optionUsedCellText = cells.eq(idxOptionUsed).text();
      const optionInfo = parseOptionUsedDate(optionUsedCellText);
      optionUsed = optionInfo.optionUsed;
      optionDecisionDate = optionInfo.optionDecisionDate;
    }

    // Fallback: Check for "Option Used: Yes/No (date)" in the option cell (old format)
    if (optionUsed === null && idxOption >= 0) {
      const optionCellText = cells.eq(idxOption).text();
      const optionInfo = parseOptionUsedDate(optionCellText);
      optionUsed = optionInfo.optionUsed;
      optionDecisionDate = optionInfo.optionDecisionDate;
    }

    // Check the next row for optionUsed info (sometimes it's in a colspan row with "Option Used:" label)
    if (optionUsed === null && i + 1 < allRows.length) {
      const nextTr = allRows[i + 1];
      const nextRowText = $(nextTr).text();
      // Only check next row if it contains "Option Used:" label (indicating a colspan row)
      if (/Option\s+Used:/i.test(nextRowText)) {
        const nextOptionInfo = parseOptionUsedDate(nextRowText);
        optionUsed = nextOptionInfo.optionUsed;
        optionDecisionDate = nextOptionInfo.optionDecisionDate;
      }
    }

    // Also check season cell for option tags (e.g., "2025-26 PO")
    if (!option && /\b(PO|Player Option)\b/i.test(rawSeason)) {
      option = 'PO';
    }
    if (!option && /\b(TO|Team Option)\b/i.test(rawSeason)) {
      option = 'TO';
    }
    if (!option && /\b(ETO|Early Termination)\b/i.test(rawSeason)) {
      option = 'ETO';
    }
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

    // Determine guaranteed status
    let guaranteed = false;
    let guaranteedAmount = 0;

    if (typeof guarantee === 'number') {
      guaranteedAmount = guarantee;
      guaranteed = guarantee >= salary && salary > 0;
    } else {
      // When guaranteed column is not a number, be conservative
      // and default to not guaranteed. The enrichGuaranteeSchedules
      // function will update this based on GUARANTEED DETAILS section.
      // Only assume fully guaranteed if explicitly marked as such.
      const rowTxt = $(tr).text().toLowerCase();
      const hasFullyGuaranteedText = /fully\s+guaranteed|100%/.test(rowTxt);
      const hasPartialText = /non-?guaranteed|partial/.test(rowTxt);
      const isExplicitlyGuaranteed = hasFullyGuaranteedText && !hasPartialText;

      guaranteed = isExplicitlyGuaranteed;
      guaranteedAmount = guaranteed ? salary : 0;
    }

    const rec: any = {
      season,
      salary,
      capHit: resolvedCap,
      guaranteed,
      guaranteedAmount,
      option: option ?? null,
      optionUsed: optionUsed,
      optionDecisionDate: optionDecisionDate,
      tradeBonus: null,
      incentives: { likely, unlikely },
    };

    const kicker = $(tr)
      .text()
      .match(/(\d{1,2})%\s+(?:trade\s+)?(?:kicker|bonus)/i);
    if (kicker) rec.tradeBonus = parseInt(kicker[1], 10);

    rows.push(rec);
  }
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
  // Made more flexible to handle various formatting issues
  let h: string | undefined;

  // Try quote format first: "6' 5", "6'5", "6' 05" etc.
  const mHeightQuote = text.match(
    /\bHEIGHT:\s*([0-9])\s*['\u2019]\s*([0-9]{1,2})(?:\s|$|[^0-9])/i
  );
  if (mHeightQuote) {
    h = `${mHeightQuote[1]}-${mHeightQuote[2]}`;
  } else {
    // Try dash format: "6-5", "6 - 5" etc.
    const mHeightDash = text.match(
      /\bHEIGHT:\s*([0-9])\s*-\s*([0-9]{1,2})(?:\s|$|[^0-9])/i
    );
    if (mHeightDash) {
      h = `${mHeightDash[1]}-${mHeightDash[2]}`;
    } else {
      // Try ft/in format: "6 ft 5 in", "6ft 5in" etc.
      const mHeightFtIn = text.match(
        /\bHEIGHT:\s*([0-9])\s*ft\s*([0-9]{1,2})\s*in\b/i
      );
      if (mHeightFtIn) {
        h = `${mHeightFtIn[1]}-${mHeightFtIn[2]}`;
      } else {
        // Last resort: look for any two numbers after HEIGHT
        const mHeightGeneric = text.match(
          /\bHEIGHT:\s*([0-9])[^0-9]*([0-9]{1,2})/i
        );
        if (mHeightGeneric) {
          h = `${mHeightGeneric[1]}-${mHeightGeneric[2]}`;
        }
      }
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
      bio.draftedBy = null; // Explicitly set to null for undrafted players
    } else {
      // Try to extract year (4 digits) - get the FIRST occurrence at the start
      // Since draft text might have other years (like "2025-26" season text), we want the first one
      const yearMatch = draftText.match(/^(\d{4})/);
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
        // Also look for "overall" patterns like "15th overall"
        const pickMatch =
          draftText.match(/\bPick\s+(\d+)\b/i) ||
          draftText.match(/\b#(\d+)\s+(?:pick|overall)\b/i) ||
          draftText.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:pick|overall)\b/i) ||
          draftText.match(/\bPick:\s*(\d+)/i) ||
          draftText.match(/\b(\d+)(?:st|nd|rd|th)\s+in\s+the\b/i) ||
          draftText.match(/\b#(\d+)\b/);
        if (pickMatch) {
          // Find first number in the match groups
          const pickNum = pickMatch[1] || pickMatch[2];
          if (pickNum) bio.draftPick = parseInt(pickNum, 10);
        }

        // Look for team that drafted them - but avoid "the" artifacts
        const teamMatch = draftText.match(
          /\bby\s+(?:the\s+)?([A-Za-z][a-zA-Z\s]+?)(?:\s+AGENT|\s+in\s+|\s+$|$)/i
        );
        if (teamMatch && teamMatch[1] && teamMatch[1].toLowerCase() !== 'the') {
          const teamName = teamMatch[1].trim();
          // Convert team name to code if possible
          const teamWords = teamName.toLowerCase().split(/\s+/);
          let teamCode = null;
          for (const [slug, code] of Object.entries(teamSlugToCode)) {
            if (
              teamWords.some(
                (word) => slug.includes(word) || word.includes(slug)
              )
            ) {
              teamCode = code;
              break;
            }
          }
          bio.draftedBy = teamCode || teamName;
        } else {
          // Try to find team code (2-3 uppercase letters) but avoid "the"
          const teamCodeMatch = draftText.match(/\b([A-Z]{2,3})\s+\d{4}\b/);
          if (teamCodeMatch && teamCodeMatch[1] !== 'THE') {
            bio.draftedBy = teamCodeMatch[1];
          }
        }
      }
    }
  }

  // Look for separate DRAFTED BY field (often separate from DRAFT YEAR)
  const mDraftedBy = text.match(/DRAFTED\s+BY:\s*([A-Z]{2,3})/i);
  if (mDraftedBy && mDraftedBy[1] !== 'THE') {
    bio.draftedBy = mDraftedBy[1];
  }

  if (process.env.DEBUG === '1') {
    console.log('🔎 bio-extract:', bio);
  }
  return bio;
}

function detectContractType($: cheerio.CheerioAPI, signedUsing?: string) {
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
  const hasRookieInTitle = /ROOKIE/.test(T);
  const hasScaleInTitle = /SCALE/.test(T);
  const isDesignated = /DESIGNATED/.test(T);
  const isTwoWay = /TWO-WAY|2-WAY/.test(T);

  // Check signing method to determine if truly rookie-scale (1st round pick) vs other rookie deals
  const isActualRookieScale =
    (hasRookieInTitle || hasScaleInTitle) &&
    !/second\s+round|mle|mid-?level|bi-?annual|bae|minimum/i.test(
      signedUsing || ''
    );

  let contractType = 'VETERAN CONTRACT';
  if (isTwoWay) contractType = 'TWO-WAY';
  else if (isDesignated && hasScaleInTitle)
    contractType = 'DESIGNATED ROOKIE SCALE EXTENSION';
  else if (isExtension && hasScaleInTitle)
    contractType = 'ROOKIE SCALE EXTENSION';
  else if (hasScaleInTitle && isActualRookieScale)
    contractType = 'ROOKIE SCALE CONTRACT';
  else if (hasRookieInTitle) contractType = 'ROOKIE CONTRACT';
  else if (isExtension) contractType = 'VETERAN EXTENSION';

  return { contractType, isExtension, isRookieScale: isActualRookieScale };
}

/** Detect contract type from heading text (for multiple contracts) */
function detectContractTypeFromHeading(
  headingText: string,
  signedUsing?: string
) {
  const T = headingText.toUpperCase();
  const isExtension = /EXTENSION/.test(T);
  const hasRookieInTitle = /ROOKIE/.test(T);
  const hasScaleInTitle = /SCALE/.test(T);
  const isDesignated = /DESIGNATED/.test(T);
  const isSupermax = /SUPERMAX/.test(T);
  const isTwoWay = /TWO-WAY|2-WAY/.test(T);

  // Check signing method to determine if truly rookie-scale
  const isActualRookieScale =
    (hasRookieInTitle || hasScaleInTitle) &&
    !/second\s+round|mle|mid-?level|bi-?annual|bae|minimum/i.test(
      signedUsing || ''
    );

  let contractType = 'VETERAN CONTRACT';
  if (isTwoWay) contractType = 'TWO-WAY';
  else if (isSupermax && isExtension)
    contractType = 'DESIGNATED SUPERMAX EXTENSION';
  else if (isDesignated && hasScaleInTitle && isExtension)
    contractType = 'DESIGNATED ROOKIE SCALE EXTENSION';
  else if (isExtension && hasScaleInTitle)
    contractType = 'ROOKIE SCALE EXTENSION';
  else if (hasScaleInTitle && isActualRookieScale)
    contractType = 'ROOKIE SCALE CONTRACT';
  else if (hasRookieInTitle) contractType = 'ROOKIE CONTRACT';
  else if (isDesignated && isExtension) contractType = 'DESIGNATED EXTENSION';
  else if (isExtension) contractType = 'VETERAN EXTENSION';

  return { contractType, isExtension, isRookieScale: isActualRookieScale };
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
  if (signedUsing) {
    signedUsing = signedUsing
      .split(' ')
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');

    // Restore proper hyphenation for specific terms
    signedUsing = signedUsing
      .replace(/\bEarly Bird\b/gi, 'Early-Bird')
      .replace(/\bNon Bird\b/gi, 'Non-Bird')
      .replace(/\bMid Level\b/gi, 'Mid-Level')
      .replace(/\bBi Annual\b/gi, 'Bi-Annual');
  }

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

  // Signing Executive — "SIGNED BY: <name>" (appears in contract header, often in a link)
  // Match pattern: "SIGNED BY: <a href="/staff/name">Executive Name</a>" or "SIGNED BY: Executive Name"
  let signingExecutive = text
    .match(
      /SIGNED\s*BY:\s*(?:<[^>]+>)?([A-Za-z][A-Za-z\s.'-]+?)(?:<[^>]*>)?(?=\s*(?:AGENT|PRIMARY\s*AGENT|BIRD\s*RIGHTS|$))/i
    )?.[1]
    ?.trim();

  return {
    signingTeam: signingTeam || undefined,
    signedUsing,
    signingDate,
    signingExecutive,
    capHold,
    tradeKicker,
  };
}

/** Parse contract metadata from a specific table's surrounding section */
function parseContractMetaFromTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio
) {
  // Strategy: Get text from elements between this table and the previous h4/h5/h6 heading
  // or previous table (whichever comes first), PLUS elements after the table

  // Find all preceding siblings until we hit a heading or another table
  const relevantElements: cheerio.Cheerio[] = [];
  let current = table.prev();

  while (current.length > 0) {
    const tagName = current.prop('tagName')?.toLowerCase();

    // Stop if we hit a heading (h1-6) or another table
    if (tagName && /^h[1-6]$/.test(tagName)) {
      break;
    }
    if (tagName === 'table') {
      break;
    }

    relevantElements.unshift(current);
    current = current.prev();
  }

  // For elements after the table, we need to navigate to the contract container
  // and find financial details divs (which contain cap hold)
  const contractContainer = table.closest('.sw_playerContract');
  let afterText = '';
  if (contractContainer.length) {
    // Find all financial details divs in this contract
    const financialDetails = contractContainer.find(
      '.sw_playerContract__financialDetails'
    );
    financialDetails.each((_, el) => {
      afterText += ' ' + safeText($, $(el));
    });

    // Also look for signing executive in contract header/title area
    const contractHeader = contractContainer
      .find('.sw_playerContract__title')
      .parent();
    if (contractHeader.length) {
      afterText += ' ' + safeText($, contractHeader);
    }
  }

  // Collect text from elements before table
  let text = '';
  for (const el of relevantElements) {
    text += ' ' + safeText($, el);
  }
  text = text.trim();
  afterText = afterText.trim();

  // Combine for searching
  let combinedText = text + ' ' + afterText;

  // If no text found, fall back to the closest container (old behavior)
  if (!combinedText.trim()) {
    const scope = table.closest('section,article,div');
    text = safeText($, scope);
    combinedText = (text + ' ' + afterText).trim();
  }

  // Also search the entire page for signing executive if not found in local context
  let pageText = '';
  if (!combinedText.match(/SIGNED\s*BY:/i)) {
    pageText = $.root().text();
  }

  const searchText = combinedText + ' ' + pageText;

  // Signing Team
  const signingTeam = searchText.match(/Signing\s*Team:\s*([A-Z]{2,3})/i)?.[1];

  // Signing Method / Using  — stop at the next label so we don't swallow the rest of the paragraph
  const methodMatch = searchText.match(
    /Signing\s*(?:Method|Using)\s*:\s*([A-Za-z ':-]+?)(?=\s*(Signing\s*Date|Signing\s*Team|Source|Expiry|Length|Value|Cap\s*Hold|TRADE\s*KICKER|$))/i
  );
  let signedUsing = methodMatch?.[1]
    ?.replace(/[:\-]+/g, ' ')
    ?.replace(/\s+/g, ' ')
    ?.trim();
  if (signedUsing) {
    signedUsing = signedUsing
      .split(' ')
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');

    // Restore proper hyphenation for specific terms
    signedUsing = signedUsing
      .replace(/\bEarly Bird\b/gi, 'Early-Bird')
      .replace(/\bNon Bird\b/gi, 'Non-Bird')
      .replace(/\bMid Level\b/gi, 'Mid-Level')
      .replace(/\bBi Annual\b/gi, 'Bi-Annual');
  }

  // Signing Date (supports "July 6, 2023" and "07/06/2023")
  const signingDate =
    searchText.match(
      /Signing\s*Date:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})/i
    )?.[1] ||
    searchText.match(/Signing\s*Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];

  // Cap Hold — "Cap Hold 2027-28: $28,307,693"
  // Prefer afterText (more likely to have cap hold for extensions)
  const capHoldPattern = /Cap\s*Hold[^$]*\$\s*([\d,]+)/i;
  const capHold =
    moneyNum(afterText.match(capHoldPattern)?.[1]) ||
    moneyNum(text.match(capHoldPattern)?.[1]);

  // Trade Kicker — "TRADE KICKER: 15% …" or "… 15% trade kicker …"
  const tk =
    searchText.match(/TRADE\s*KICKER\s*:\s*(\d{1,2})%/i) ||
    searchText.match(/(\d{1,2})%\s+(?:trade\s+)?(?:kicker|bonus)/i) ||
    searchText.match(/(?:kicker|bonus)\s+of\s+(\d{1,2})%/i);
  const tradeKicker = tk ? parseInt(tk[1], 10) : null;

  // Signing Executive — "SIGNED BY: <name>" (appears in contract header, often in a link)
  // Match pattern: "SIGNED BY: <a href="/staff/name">Executive Name</a>" or "SIGNED BY: Executive Name"
  let signingExecutive = searchText
    .match(
      /SIGNED\s*BY:\s*(?:<[^>]+>)?([A-Za-z][A-Za-z\s.'-]+?)(?:<[^>]*>)?(?=\s*(?:AGENT|PRIMARY\s*AGENT|BIRD\s*RIGHTS|$))/i
    )?.[1]
    ?.trim();

  return {
    signingTeam: signingTeam || undefined,
    signedUsing,
    signingDate,
    signingExecutive,
    capHold,
    tradeKicker,
  };
}

/** Parse free agency details */
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
    // Look for "Qualifying Offer:" (with colon) to avoid matching "Qualifying Offer Calculator"
    // The actual QO appears as "Qualifying Offer: <a...>$10,389,992</a>"
    const qoMatch = (text || all).match(
      /Qualifying\s*Offer\s*:[^$]*\$\s*([\d,]+)/i
    );
    qualifyingOffer = moneyNum(qoMatch?.[1]) ?? null;
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
  if (/Early Bird/i.test(status)) eligibleFor.push('Early-Bird Exception');
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
    canBeTradedNow: null,
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

  // Agent: prefer "Primary Agent", fall back to "Agent:", stop before "Secondary"
  const agent =
    text
      .match(
        /\bPrimary\s*Agent\s*:\s*([A-Za-z .,'-]+?)(?=\s*(Secondary|$))/i
      )?.[1]
      ?.trim() ||
    text
      .match(/\bAgent\s*:\s*([A-Za-z .,'-]+?)(?=\s*(Secondary|$))/i)?.[1]
      ?.trim();

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

/** Detect if a contract is a max contract and calculate cap percentage estimates */
function detectMaxContractInfo(
  $: cheerio.CheerioAPI,
  salariesByYear: any[],
  contractType: string,
  table?: cheerio.Cheerio
) {
  if (!salariesByYear.length) {
    return {
      isMaxContract: false,
      maxType: null,
      estimatedCapPercentage: null,
    };
  }

  const isMax = /max|supermax|designated/i.test(contractType);
  const isSupermax = /supermax|designated.*extension/i.test(contractType);
  const isRookieMax = /designated.*rookie/i.test(contractType);

  // NBA salary cap is roughly $140M for 2024-25 (adjust as needed)
  const ESTIMATED_CAP = 140_000_000;
  const firstYearSalary = salariesByYear[0]?.salary || 0;

  let maxType: string | null = null;
  let estimatedCapPercentage: number | null = null;

  // Try to extract cap% from the page (e.g., "Cap %: 30.00")
  let pageCapPercentage: number | null = null;
  if (table) {
    const tableContainer = table.closest(
      '.sw_playerContract, section, article, div'
    );
    const containerText = tableContainer.text();
    const capMatch = containerText.match(/Cap\s*%\s*:\s*(\d+(?:\.\d+)?)/i);
    if (capMatch) {
      pageCapPercentage = parseFloat(capMatch[1]);
    }
  }
  // Fallback to searching entire page
  if (pageCapPercentage === null) {
    const pageText = $.root().text();
    const capMatch = pageText.match(/Cap\s*%\s*:\s*(\d+(?:\.\d+)?)/i);
    if (capMatch) {
      pageCapPercentage = parseFloat(capMatch[1]);
    }
  }

  // Use page cap% if found, otherwise estimate from salary
  estimatedCapPercentage =
    pageCapPercentage ?? Math.round((firstYearSalary / ESTIMATED_CAP) * 100);

  if (isMax) {
    // Determine maxType based on cap percentage
    // Always prefer page cap% if available, regardless of "Supermax" label
    if (pageCapPercentage !== null) {
      if (pageCapPercentage >= 32.5) {
        maxType = 'Max-35';
        estimatedCapPercentage = 35; // Normalize to standard value
      } else if (pageCapPercentage >= 27.5) {
        maxType = 'Max-30';
        estimatedCapPercentage = 30;
      } else if (pageCapPercentage >= 22.5) {
        maxType = 'Max-25';
        estimatedCapPercentage = 25;
      } else {
        // Unknown max type, use generic
        maxType = 'Max';
      }
    } else {
      // Fallback to old logic based on contract type
      if (isSupermax) {
        maxType = 'Max-35'; // Supermax is typically 35%
        estimatedCapPercentage = 35;
      } else if (isRookieMax) {
        maxType = 'Max-30'; // Rookie max is typically 30%
        estimatedCapPercentage = 30;
      } else {
        maxType = 'Max-30'; // Default veteran max
        estimatedCapPercentage = 30;
      }
    }
  } else {
    // Check if salary amounts suggest max contract even if not explicitly labeled
    // Rough thresholds: $45M+ likely max
    if (firstYearSalary > 45_000_000) {
      if (estimatedCapPercentage >= 32.5) {
        maxType = 'Max-35';
        estimatedCapPercentage = 35;
      } else if (estimatedCapPercentage >= 27.5) {
        maxType = 'Max-30';
        estimatedCapPercentage = 30;
      } else {
        maxType = 'Max-25';
        estimatedCapPercentage = 25;
      }
    }
  }

  return {
    isMaxContract: !!maxType,
    maxType,
    estimatedCapPercentage,
  };
}

/**
 * Post-parse enrichment: Add guarantee schedules to partially guaranteed years
 * This looks for guarantee details in the page and attaches them to relevant salary years
 */
function enrichGuaranteeSchedules(
  $: cheerio.CheerioAPI,
  salariesByYear: any[]
): void {
  // For each year, try to find guarantee schedule from GUARANTEED DETAILS section
  // This handles:
  // - Partially guaranteed years (guaranteedAmount > 0 but < salary)
  // - Fully non-guaranteed years (guaranteedAmount === 0)
  // - Years where the initial parse couldn't determine guarantee status
  for (const yearRow of salariesByYear) {
    // Skip years that are already confirmed as fully guaranteed with a valid guaranteedAmount
    // Only skip if both guaranteed===true AND guaranteedAmount equals the salary
    if (yearRow.guaranteed && yearRow.guaranteedAmount === yearRow.salary) {
      continue;
    }

    // Try to parse guarantee details for this season
    const guaranteeInfo = parseGuaranteeDetails($, yearRow.season);

    if (
      guaranteeInfo.guaranteeSchedule &&
      guaranteeInfo.guaranteeSchedule.length > 0
    ) {
      // Fill in amounts for "becomes fully guaranteed" entries (where amount is GUARANTEE_AMOUNT_TBD)
      const schedule = guaranteeInfo.guaranteeSchedule.map((entry) => {
        if (entry.guaranteedAmount === GUARANTEE_AMOUNT_TBD) {
          // This is a "becomes fully guaranteed" trigger - use the full salary
          return {
            ...entry,
            guaranteedAmount: yearRow.salary,
          };
        }
        return entry;
      });

      yearRow.guaranteeSchedule = schedule;

      // Update guaranteedAmount to the baseline value from guarantee details
      if (guaranteeInfo.guaranteedAmount > 0) {
        yearRow.guaranteedAmount = guaranteeInfo.guaranteedAmount;
        // Recompute guaranteed boolean
        yearRow.guaranteed = yearRow.guaranteedAmount === yearRow.salary;
      }
    }
  }
}

/**
 * Apply house rule: Treat live player options as guaranteed
 * This sets PO years to guaranteed ONLY if optionUsed is null (pending decision)
 * Does NOT apply to voided options (voidedByExtension=true)
 */
function applyPlayerOptionPolicy(salariesByYear: any[]): void {
  for (const yearRow of salariesByYear) {
    // Only apply to live POs (optionUsed=null) that are not voided by extension
    if (
      yearRow.option === 'PO' &&
      yearRow.optionUsed === null &&
      !yearRow.voidedByExtension
    ) {
      // Live player option - treat as guaranteed
      yearRow.guaranteed = true;
      yearRow.guaranteedAmount = yearRow.salary;
    }
  }
}

/**
 * Validate option field pairing: optionUsed and optionDecisionDate must both be null or both be set
 * This prevents invalid states like optionUsed=null with a date, or vice versa
 * 
 * Requirements (per contract normalization spec):
 * - If optionUsed is null, then optionDecisionDate MUST be null (pending option)
 * - If optionUsed is true/false, then optionDecisionDate MUST be set to ISO 8601 date (YYYY-MM-DD format)
 * - Never have one field set without the other
 * 
 * Examples:
 * - Valid: optionUsed=null, optionDecisionDate=null (live PO, decision pending)
 * - Valid: optionUsed=true, optionDecisionDate="2025-06-28" (exercised TO)
 * - Valid: optionUsed=false, optionDecisionDate="2025-08-02" (declined/voided PO)
 * - Invalid: optionUsed=null, optionDecisionDate="2025-06-28" (inconsistent)
 * - Invalid: optionUsed=true, optionDecisionDate=null (inconsistent)
 */
function validateOptionFieldPairing(salariesByYear: any[]): void {
  for (const yearRow of salariesByYear) {
    const hasOptionUsed = yearRow.optionUsed !== null && yearRow.optionUsed !== undefined;
    const hasOptionDate = yearRow.optionDecisionDate !== null && yearRow.optionDecisionDate !== undefined;
    
    if (hasOptionUsed !== hasOptionDate) {
      throw new Error(
        `Invalid option field pairing in ${yearRow.season}: ` +
        `optionUsed=${yearRow.optionUsed}, optionDecisionDate=${yearRow.optionDecisionDate}. ` +
        `Both must be null or both must be set.`
      );
    }
  }
}

/**
 * Post-parse normalizer: Detect when a future extension voids a PO in the current contract
 *
 * If a player has:
 * - Current contract with PO in season S (e.g., 2026-27)
 * - Future extension starting in season S
 * Then: Mark the PO as voided by extension
 */
function normalizeContractVoidedOptions(
  currentContract: any,
  futureContract: any | undefined,
  pageText: string
): void {
  if (!futureContract || !currentContract.salariesByYear) return;

  const futureStartSeason = futureContract.startSeason;
  if (!futureStartSeason) return;

  // Find PO year in current contract that matches future extension start
  const poYear = currentContract.salariesByYear.find(
    (y: any) => y.season === futureStartSeason && y.option === 'PO'
  );

  if (!poYear) return;

  dbg(
    'Detected PO voided by extension',
    `${poYear.season} PO voided by extension starting ${futureStartSeason}`
  );

  // Parse option used date from page text to get both optionUsed and optionDecisionDate
  const optionInfo = parseOptionUsedDate(pageText);

  // For voidedOn: use the decision date from optionInfo
  let voidedDate: string;

  if (optionInfo.optionDecisionDate) {
    // Use the ISO date directly
    voidedDate = optionInfo.optionDecisionDate;
  } else if (futureContract.signingDate) {
    // Convert signingDate to ISO format if it's not already
    const converted = toISODate(futureContract.signingDate);
    voidedDate = converted || futureContract.signingDate;
  } else {
    voidedDate = new Date().toISOString().split('T')[0];
  }

  // Mark the PO year as voided
  poYear.option = 'PO';
  poYear.optionUsed = false; // Player option was declined
  poYear.optionDecisionDate = voidedDate;
  poYear.guaranteed = false;
  poYear.guaranteedAmount = 0;
  poYear.voidedByExtension = true;
  poYear.voidedOn = voidedDate;

  // Update current contract metadata
  currentContract.supersededIn = futureStartSeason;
  currentContract.supersededByContractRef =
    futureContract.contractType || 'extension';

  // Filter out voided years for rollups
  const activeYears = currentContract.salariesByYear.filter(
    (y: any) => !y.voidedByExtension
  );

  // DO NOT change totalValue or averageAnnualValue - preserve headline numbers
  // These reflect the original signed deal value

  // Recompute guaranteedValue (exclude voided PO)
  currentContract.guaranteedValue = activeYears.reduce(
    (sum: number, y: any) => sum + (y.guaranteedAmount || 0),
    0
  );

  // Recompute guaranteedYears (exclude voided PO)
  currentContract.guaranteedYears = activeYears.filter(
    (y: any) => (y.guaranteedAmount || 0) > 0
  ).length;

  // Recompute yearsRemaining (exclude voided season)
  const CURRENT_SEASON_START = 2025;
  const endSeason = activeYears.slice(-1)[0]?.season;

  if (endSeason) {
    const endYearNum = seasonStartYear(endSeason) ?? CURRENT_SEASON_START - 1;
    currentContract.yearsRemaining = Math.max(
      0,
      endYearNum - CURRENT_SEASON_START + 1
    );
  }

  dbg('Contract after PO voiding', {
    guaranteedValue: currentContract.guaranteedValue,
    guaranteedYears: currentContract.guaranteedYears,
    yearsRemaining: currentContract.yearsRemaining,
    supersededIn: currentContract.supersededIn,
  });
}

// ---------- main ----------
/**
 * parsePlayer - Parse player HTML to normalized JSON
 * @param html - HTML content to parse
 * @param options - Player ID and source URL
 * @returns Normalized player data
 */
export async function parsePlayer(
  html: string,
  options: { playerId: string; sourceUrl: string }
): Promise<any> {
  const playerUrlEnv = options.sourceUrl;
  let playerId = options.playerId;

  const $ = cheerio.load(html);

  const displayName = parseName($, playerId);
  if (playerId === 'unknown' && displayName) {
    playerId = displayName
      .toLowerCase()
      .replace(/[^a-z]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  const { teamName, teamCode } = parseTeam($, undefined);
  const bio = parseBio($);

  // Find all salary tables to detect extensions/future contracts
  const allSalaryTables = findAllSalaryTables($);
  dbg('Found salary tables', allSalaryTables.length);

  // Parse first table as current contract (fallback to old method if no tables found)
  const found =
    allSalaryTables.length > 0 ? allSalaryTables[0] : findFirstSalaryTable($);

  const salariesByYear = found
    ? parseSalaryTable($, found.table, found.headers)
    : [];

  const meta = parseCurrentContractMeta($); // signedUsing, signingTeam, signingDate, capHold, tradeKicker

  const { contractType, isExtension, isRookieScale } = detectContractType(
    $,
    meta.signedUsing
  );

  // Enrich guarantee schedules for partially guaranteed years
  enrichGuaranteeSchedules($, salariesByYear);

  // Apply player option policy (treat live PO years as guaranteed)
  applyPlayerOptionPolicy(salariesByYear);

  // Validate option field pairing
  validateOptionFieldPairing(salariesByYear);

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
  const guaranteedYears = salariesByYear.filter(
    (y) => (y.guaranteedAmount || 0) > 0
  ).length;

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
    const futureSalariesByYear = parseSalaryTable(
      $,
      futureTable.table,
      futureTable.headers
    );

    if (futureSalariesByYear.length > 0) {
      const futureStartSeason = futureSalariesByYear[0]?.season;
      const futureEndSeason =
        futureSalariesByYear[futureSalariesByYear.length - 1]?.season;
      const futureStartYear = seasonStartYear(futureStartSeason);
      const currentEndYear = seasonStartYear(endSeason!);

      // Verify this is actually a future contract (starts after current ends or in the future)
      if (
        futureStartYear &&
        currentEndYear &&
        futureStartYear >= currentEndYear
      ) {
        dbg(
          'Future contract detected',
          `${futureStartSeason} - ${futureEndSeason}`
        );

        // Parse metadata from the future contract section (not from current contract)
        const futureMeta = parseContractMetaFromTable($, futureTable.table);

        const futureContractTypeInfo = detectContractTypeFromHeading(
          futureTable.heading,
          futureMeta.signedUsing
        );

        // Enrich guarantee schedules for future contract years
        enrichGuaranteeSchedules($, futureSalariesByYear);

        // Apply player option policy to future contract
        applyPlayerOptionPolicy(futureSalariesByYear);

        // Validate option field pairing for future contract
        validateOptionFieldPairing(futureSalariesByYear);

        const futureContractLength = futureSalariesByYear.length;
        const futureTotalValue = futureSalariesByYear.reduce(
          (s, y) => s + (y.salary || 0),
          0
        );
        const futureAverageAnnualValue = futureContractLength
          ? futureTotalValue / futureContractLength
          : 0;
        const futureGuaranteedValue = futureSalariesByYear.reduce(
          (s, y) => s + (y.guaranteedAmount || 0),
          0
        );
        const futureGuaranteedYears = futureSalariesByYear.filter(
          (y) => (y.guaranteedAmount || 0) > 0
        ).length;
        // For future contracts (extensions), yearsRemaining should only count the extension years
        // not the current contract years before the extension kicks in
        const futureYearsRemaining = Math.max(
          0,
          (seasonStartYear(futureEndSeason) ?? 0) -
            (futureStartYear ?? CURRENT_SEASON_START) +
            1
        );

        // For future contracts, parse their metadata from the contract section
        // (they may have different signing details than current contract)
        const futureOptionSummary = extractOptionSummary(futureSalariesByYear);

        // Determine free agency type for future contract
        // Extensions make players UFAs when they expire, not RFAs
        const futureFAType = futureContractTypeInfo.isExtension
          ? 'UFA'
          : freeAgency.type || null;
        const futureFAYear = futureStartYear
          ? futureStartYear + futureContractLength
          : undefined;

        // Parse the cap hold from the future contract's cap hold value
        // The extension cap hold appears in the HTML as "Cap Hold YYYY-YY: $XX,XXX,XXX" after the future contract table
        const futureCapHold = futureMeta.capHold ?? null;

        // Detect max contract info for future contract
        const futureMaxContractInfo = detectMaxContractInfo(
          $,
          futureSalariesByYear,
          futureContractTypeInfo.contractType,
          futureTable.table
        );

        futureContract = {
          contractType: futureContractTypeInfo.contractType,
          isExtension: futureContractTypeInfo.isExtension,
          isRookieScale: futureContractTypeInfo.isRookieScale,
          signedUsing: futureMeta.signedUsing,
          signingTeam: futureMeta.signingTeam ?? teamCode,
          signingDate: futureMeta.signingDate,
          signingExecutive: futureMeta.signingExecutive,
          signedByCurrentTeam:
            (futureMeta.signingTeam ?? teamCode) === teamCode,
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
          tradeKicker: futureMeta.tradeKicker,
          tradeRestrictions: [],
          birdRights,
          freeAgency: {
            type: futureFAType,
            year: futureFAYear,
            capHold: futureCapHold,
            qualifyingOffer: null,
            earlyTerminationOption: null,
            ...futureOptionSummary,
          },
          tradeEligibility,
          supersedesContractRef: contractType,
          ...futureMaxContractInfo,
        };
      }
    }
  }

  const maxContractInfo = detectMaxContractInfo(
    $,
    salariesByYear,
    contractType,
    found?.table
  );

  // Build contract object
  const contract: any = {
    contractType,
    isExtension,
    isRookieScale,
    signedUsing: meta.signedUsing,
    signingTeam: meta.signingTeam || teamCode,
    signingDate: meta.signingDate,
    signingExecutive: meta.signingExecutive,
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
    ...maxContractInfo,
  };

  // Apply post-parse normalizer to detect voided POs
  normalizeContractVoidedOptions(contract, futureContract, $.root().text());

  // Final validation of option field pairing after all transformations
  validateOptionFieldPairing(contract.salariesByYear);
  if (futureContract) {
    validateOptionFieldPairing(futureContract.salariesByYear);
  }

  const output: any = {
    playerId,
    displayName,
    teamCode,
    teamName,
    bio,
    contract,
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

  return output;
}

// CLI entrypoint (kept for backward compatibility)
async function main() {
  const playerUrlEnv = (process.env.PLAYER_URL || '').replace('://www.', '://');
  let playerId =
    process.env.PLAYER_ID ||
    (playerUrlEnv ? playerUrlEnv.split('/').pop()!.replace(/-/g, '_') : '') ||
    'unknown';

  const htmlPath = process.env.TEMP_FILE
    ? join(__dirname, '../working', process.env.TEMP_FILE)
    : join(__dirname, '../working/page.html');
  const html = await fs.readFile(htmlPath, 'utf8');

  const output = await parsePlayer(html, { playerId, sourceUrl: playerUrlEnv });

  // Create team-specific output directory
  const baseOutDir = join(__dirname, '../output');
  const teamOutDir = join(baseOutDir, output.teamCode);
  await fs.mkdir(teamOutDir, { recursive: true });

  // Save to team-organized individual player file
  const outPath = join(teamOutDir, `${playerId}.json`);
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ Parsed player data for: ${output.displayName}`);
  console.log(`   Team: ${output.teamName} (${output.teamCode})`);
  console.log(`   Contract: ${output.contract.contractType}`);
  console.log(
    `   Years: ${output.contract.contractLength} (${output.contract.startSeason ?? '-'} - ${output.contract.endSeason ?? '-'})`
  );
  console.log(
    `   Total Value: $${(output.contract.totalValue / 1_000_000).toFixed(1)}M`
  );

  if (output.futureContract) {
    console.log(
      `   📋 Found future contract: ${output.futureContract.contractType} (${output.futureContract.startSeason} - ${output.futureContract.endSeason})`
    );
    console.log(`   Future Extension: ${output.futureContract.contractType}`);
    console.log(
      `   Future Value: $${(output.futureContract.totalValue / 1_000_000).toFixed(1)}M`
    );
  }

  console.log(`   Bird Rights: ${output.contract.birdRights.status}`);
  console.log(`   Cap Hold: ${output.contract.freeAgency.capHold ?? '—'}`);
  console.log(`   Trade Kicker: ${output.contract.tradeKicker ?? '—'}%`);
  console.log(`   Signed Using: ${output.contract.signedUsing ?? '—'}`);
  console.log(`   Signed Date: ${output.contract.signingDate ?? '—'}`);
  console.log(`   Signed By: ${output.contract.signingExecutive ?? '—'}`);
  console.log(`   Agent/Agency: ${output.representation.agent ?? '—'} / ${output.representation.agency ?? '—'}`);
  console.log(`📁 Output saved to: ${outPath}`);
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Error parsing player:', err);
    process.exit(1);
  });
}
