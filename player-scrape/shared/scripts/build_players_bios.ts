/* eslint-disable no-console */
// =============================================================
// SCSP™ FULL-FILE REPLACEMENT (v7)
// Build players_bios_<season>.json using NBA commonplayerinfo,
// with roster override, HTML fallback, real Playwright UA,
// birthdate normalized to YYYY-MM-DD, resume + checkpoints.
// Input:  player-scrape/shared/outputs/all_player_ids.json (nameKey -> PERSON_ID)
// Output: player-scrape/shared/players_bios_<season>.json (nameKey -> { bio: {...} })
// =============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, APIRequestContext } from 'playwright';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- Types ----------
type IdMap = Record<string, number>;
type BioOut = Record<
  string,
  {
    bio: {
      height?: string;
      weight?: string;
      age?: number;
      experience?: number | null;
      position?: string | null;
      team?: string | null;
      birthdate?: string | null;
    };
  }
>;

type RosterEntry = {
  teamName: string | null;
  teamFull: string | null;
  triCode: string | null;
};

// ---------- Paths ----------
const SHARED_DIR = resolve(__dirname, '..'); // player-scrape/shared
const OUTPUTS_DIR = resolve(SHARED_DIR, 'outputs');
const REPORTS_DIR = resolve(SHARED_DIR, 'reports');

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}
ensureDir(REPORTS_DIR);

// ---------- Args ----------
function arg(flag: string, fallback?: string) {
  const m = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (m) return m.slice(flag.length + 3);
  const i = process.argv.indexOf(`--${flag}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--'))
    return process.argv[i + 1];
  return fallback;
}

const SEASON_LABEL = Number(process.env.SEASON ?? arg('season', '2026')); // ex: 2026 -> "2025-26"
function inferSeasonCode(seasonYear: number): string {
  const start = seasonYear - 1;
  const endShort = String(seasonYear).slice(-2);
  return `${start}-${endShort}`;
}
const SEASON_CODE =
  process.env.SEASON_CODE ??
  arg('season-code') ??
  inferSeasonCode(SEASON_LABEL);

const IDS_PATH = resolve(OUTPUTS_DIR, 'all_player_ids.json');
// Write to outputs directory instead of shared root
const BIOS_OUT_PATH = resolve(OUTPUTS_DIR, `players_bios_${SEASON_LABEL}.json`);
const FAIL_REPORT_PATH = resolve(
  REPORTS_DIR,
  `players_bios_failures_${SEASON_LABEL}.json`
);

// ---------- Networking ----------
const REQUEST_TIMEOUT_MS = Number(
  process.env.BIOS_TIMEOUT_MS ?? arg('timeout', '12000')
);

const NBA_BASE = 'https://stats.nba.com';
const UA =
  process.env.NBA_UA ??
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const NBA_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.nba.com',
  Referer: 'https://www.nba.com/stats/',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  Connection: 'keep-alive',
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache',
  // NOTE: Do NOT put User-Agent here; set it on the Playwright context!
};

let reqCtx: APIRequestContext | null = null;
async function getRequestContext(): Promise<APIRequestContext> {
  if (reqCtx) return reqCtx;
  reqCtx = await request.newContext({
    baseURL: NBA_BASE,
    userAgent: UA, // <-- the actual UA
    extraHTTPHeaders: NBA_HEADERS, // <-- the rest of headers
  });
  return reqCtx;
}

function urlCommonPlayerInfo(personId: number): string {
  return `${NBA_BASE}/stats/commonplayerinfo?LeagueID=00&PlayerID=${encodeURIComponent(
    String(personId)
  )}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(
  url: string,
  retries = 4,
  timeoutMs = REQUEST_TIMEOUT_MS,
  perReqHeaders?: Record<string, string>
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctx = await getRequestContext();
      const res = await ctx.get(url, {
        timeout: timeoutMs,
        headers: perReqHeaders,
      });
      if (!res.ok()) throw new Error(`HTTP ${res.status()} for ${url}`);
      const ct = res.headers()['content-type'] || '';
      if (!/^application\/json/i.test(ct)) {
        const txt = await res.text();
        throw new Error(
          `Non-JSON content-type: ${ct} (len=${txt?.length ?? 0})`
        );
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      const msg = String((e as any)?.message || e);
      const isRate = /HTTP 429|HTTP 403|Non-JSON/.test(msg);
      const base = isRate ? 1500 : 400;
      const jitter = Math.floor(Math.random() * 400);
      await sleep(base * (attempt + 1) + jitter);
    }
  }
  throw lastErr;
}

// ---------- Helpers ----------
function normalizeBirthdate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function simplifyTeamName(fullName: string | null, triCode: string | null) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  if (triCode && triCode.trim()) return triCode.trim();
  return null;
}

// ---------- Roster (current-season) map ----------
async function fetchCurrentRosterMap(
  seasonCode: string
): Promise<Map<number, RosterEntry>> {
  const url = `${NBA_BASE}/stats/commonallplayers?LeagueID=00&Season=${encodeURIComponent(
    seasonCode
  )}&IsOnlyCurrentSeason=1`;
  try {
    const json = await fetchJson(url, 2, REQUEST_TIMEOUT_MS);
    const sets = json.resultSets ?? json.ResultSets;
    if (!Array.isArray(sets)) return new Map();
    const rs = sets.find(
      (s: any) => Array.isArray(s.headers) && s.headers.includes('PERSON_ID')
    );
    if (!rs) return new Map();
    const headers: string[] = rs.headers || rs.Headers || [];
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
    const rows: any[] = rs.rowSet || rs.RowSet || [];
    const map = new Map<number, RosterEntry>();
    for (const row of rows) {
      const pidRaw = row?.[idx['PERSON_ID']];
      const personId = Number(pidRaw);
      if (!Number.isFinite(personId)) continue;
      const teamFullRaw = row?.[idx['TEAM_NAME']];
      const triRaw = row?.[idx['TEAM_ABBREVIATION']];
      const teamFull =
        typeof teamFullRaw === 'string' ? teamFullRaw.trim() : null;
      const triCode = typeof triRaw === 'string' ? triRaw.trim() : null;
      const simple = simplifyTeamName(teamFull, triCode);
      map.set(personId, {
        teamName: simple,
        teamFull,
        triCode,
      });
    }
    return map;
  } catch (err) {
    console.warn(
      `⚠️  Failed to fetch current roster info (${(err as Error).message}). Continuing with bios-derived teams.`
    );
    return new Map();
  }
}

// ---------- Extractors ----------
function extractFromCommonPlayerInfo(json: any): {
  teamName: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  yearsPro: number | null;
  birthdate: string | null;
} {
  const sets = json.resultSets ?? json.ResultSets ?? [];
  const rs =
    sets.find((s: any) => s.name === 'CommonPlayerInfo') ??
    sets.find(
      (s: any) => Array.isArray(s.headers) && s.headers.includes('PLAYER_ID')
    );

  const blank = {
    teamName: null,
    position: null,
    height: null,
    weight: null,
    age: null,
    yearsPro: null,
    birthdate: null,
  };
  if (!rs) return blank;

  const idx = Object.fromEntries(
    (rs.headers as string[]).map((h: string, i: number) => [h, i])
  );
  const row = (rs.rowSet as any[])[0];
  if (!row) return blank;

  const teamFull = String(row[idx['TEAM_NAME']] ?? '').trim();
  const teamName = teamFull
    ? teamFull.split(/\s+/).slice(-1)[0] || teamFull
    : null;

  const position = String(row[idx['POSITION']] ?? '').trim() || null;
  const height = String(row[idx['HEIGHT']] ?? '').trim() || null;
  const weight = String(row[idx['WEIGHT']] ?? '').trim() || null;
  const birthDateRaw = String(row[idx['BIRTHDATE']] ?? '').trim() || null;

  let yearsPro: number | null = null;
  const seasonExp = row[idx['SEASON_EXP']];
  if (typeof seasonExp === 'number') yearsPro = seasonExp;
  else if (typeof seasonExp === 'string' && /^\d+$/.test(seasonExp))
    yearsPro = parseInt(seasonExp, 10);

  let age: number | null = null;
  if (birthDateRaw) {
    const d = new Date(birthDateRaw);
    if (!Number.isNaN(d.getTime())) {
      const now = new Date();
      let years = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
      age = Number.isFinite(years) ? years : null;
    }
  }

  return {
    teamName,
    position,
    height,
    weight,
    age,
    yearsPro,
    birthdate: birthDateRaw,
  };
}

function isEmptyInfo(info: {
  teamName: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
}) {
  return (
    !info.teamName &&
    !info.position &&
    !info.height &&
    !info.weight &&
    info.age == null
  );
}

async function fetchPlayerPageHtml(
  personId: number,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<string> {
  const ctx = await getRequestContext();
  const url = `https://www.nba.com/player/${personId}`;
  const res = await ctx.get(url, {
    timeout: timeoutMs,
    headers: { Referer: 'https://www.nba.com/stats/' },
  });
  if (!res.ok()) throw new Error(`HTML ${res.status()} for ${url}`);
  return await res.text();
}

function extractFromPlayerHtml(html: string): {
  teamName: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  birthdate?: string | null;
  yearsPro?: number | null;
} {
  // Try __NEXT_DATA__ first (usually more structured)
  try {
    const m = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (m?.[1]) {
      const json = JSON.parse(m[1]);
      const results: any = {
        teamName: null,
        position: null,
        height: null,
        weight: null,
        birthdate: null,
        yearsPro: null,
      };

      function visit(node: any) {
        if (!node || typeof node !== 'object') return;
        const keys = Object.keys(node);
        const lower = new Set(keys.map((k) => k.toLowerCase()));

        if (lower.has('teamname') && results.teamName == null) {
          const v = (node as any).teamName;
          if (typeof v === 'string' && v.trim()) results.teamName = v.trim();
        }
        if (lower.has('tricode') && results.teamName == null) {
          const v = (node as any).tricode;
          if (typeof v === 'string' && v.trim()) results.teamName = v.trim();
        }
        if (lower.has('position') && results.position == null) {
          const v = (node as any).position;
          if (typeof v === 'string' && v.trim()) results.position = v.trim();
        }
        if (lower.has('height') && results.height == null) {
          const v = (node as any).height;
          if (typeof v === 'string' && /^\d{1,2}-\d{1,2}$/.test(v.trim()))
            results.height = v.trim();
        }
        if (lower.has('weight') && results.weight == null) {
          const v = (node as any).weight;
          if (typeof v === 'string' && /\d{2,3}/.test(v))
            results.weight = (v.match(/\d{2,3}/) || [''])[0];
          else if (typeof v === 'number' && v >= 100 && v <= 400)
            results.weight = String(v);
        }
        if (
          (lower.has('birthdate') || lower.has('dateofbirthutc')) &&
          results.birthdate == null
        ) {
          const v = (node as any).birthdate ?? (node as any).dateOfBirthUTC;
          if (typeof v === 'string' && v.length >= 8) results.birthdate = v;
        }
        if (
          (lower.has('seasonexp') || lower.has('season_experience')) &&
          results.yearsPro == null
        ) {
          const v = (node as any).seasonExp ?? (node as any).season_experience;
          if (typeof v === 'number') results.yearsPro = v;
          else if (typeof v === 'string' && /^\d+$/.test(v))
            results.yearsPro = parseInt(v, 10);
        }

        for (const k of keys) visit((node as any)[k]);
      }
      visit(json);
      return results;
    }
  } catch {}

  // Fallback: cheerio text heuristics (your version kept)
  const $ = cheerio.load(html);
  const root = $.root().clone();
  root.find('script,style,iframe,noscript').remove();
  let text = root
    .text()
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/：/g, ':');
  text = text.replace(
    /(HEIGHT|WEIGHT|AGE|BORN|BIRTHDATE|Years Pro|SEASON_EXP|Position)\s*:/gi,
    ' $1: '
  );

  const results: any = {
    teamName: null,
    position: null,
    height: null,
    weight: null,
    birthdate: null,
    yearsPro: null,
  };

  const mHeightQuote = text.match(
    /\bHEIGHT:\s*([0-9])\s*['\u2019]\s*([0-9]{1,2})(?:\s|$|[^0-9])/i
  );
  if (mHeightQuote) results.height = `${mHeightQuote[1]}-${mHeightQuote[2]}`;
  else {
    const mHeightDash = text.match(/\bHEIGHT:\s*([0-9])\s*-\s*([0-9]{1,2})/i);
    if (mHeightDash) results.height = `${mHeightDash[1]}-${mHeightDash[2]}`;
    else {
      const mHeightFtIn = text.match(
        /\bHEIGHT:\s*([0-9])\s*ft\s*([0-9]{1,2})\s*in\b/i
      );
      if (mHeightFtIn) results.height = `${mHeightFtIn[1]}-${mHeightFtIn[2]}`;
    }
  }

  const mWeightLbs =
    text.match(/\bWEIGHT:\s*([0-9]{2,3})\s*lbs?\b/i) ||
    text.match(/\bWEIGHT:\s*([0-9]{2,3})(?=\s*lbs?\b|$)/i);
  if (mWeightLbs) results.weight = mWeightLbs[1];
  else {
    const mWeightKg = text.match(/\bWEIGHT:\s*([0-9]{2,3})\s*kg\b/i);
    if (mWeightKg) {
      const kg = parseInt(mWeightKg[1], 10);
      if (Number.isFinite(kg))
        results.weight = String(Math.round(kg * 2.20462));
    }
  }

  const mBorn = text.match(/\bBORN:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\b/i);
  if (mBorn) results.birthdate = mBorn[1];
  else {
    const mBirthdate = text.match(/\bBIRTHDATE:\s*(\d{4}-\d{2}-\d{2})/i);
    if (mBirthdate) results.birthdate = mBirthdate[1];
  }

  const mYearsPro = text.match(/\b(Years Pro|SEASON_EXP):\s*(\d{1,2})\b/i);
  if (mYearsPro) {
    const yp = parseInt(mYearsPro[2], 10);
    if (Number.isFinite(yp) && yp >= 0) results.yearsPro = yp;
  }

  const teamMatch = text.match(
    /\b(ATL|BOS|BKN|CHA|CHI|CLE|DAL|DEN|DET|GSW|HOU|IND|LAC|LAL|MEM|MIA|MIL|MIN|NOP|NYK|OKC|ORL|PHI|PHX|POR|SAC|SAS|TOR|UTA|WAS)\b/
  );
  if (teamMatch) results.teamName = teamMatch[1];

  return results;
}

// ---------- Main ----------
let output: BioOut = {};
const failures: Array<{ key: string; id: number; reason: string }> = [];
let processed = 0;
let total = 0;

function writeCheckpoint() {
  try {
    writeFileSync(BIOS_OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    if (failures.length) {
      writeFileSync(
        FAIL_REPORT_PATH,
        JSON.stringify(failures, null, 2),
        'utf8'
      );
    }
    console.log('    ⬇ checkpoint written');
  } catch (e) {
    console.warn(
      '    ⚠ checkpoint write failed:',
      String((e as any)?.message || e)
    );
  }
}

async function main() {
  console.log(
    `\n▶ Building players_bios_${SEASON_LABEL}.json from ${IDS_PATH}`
  );
  if (!existsSync(IDS_PATH)) {
    console.error(`Missing IDs file: ${IDS_PATH}`);
    process.exit(1);
  }

  const rosterMap = await fetchCurrentRosterMap(SEASON_CODE);

  // Load IDs
  const idMap: IdMap = JSON.parse(readFileSync(IDS_PATH, 'utf8'));
  let entries = Object.entries(idMap).sort((a, b) => a[0].localeCompare(b[0]));

  // Filters
  const ONLY_PLAYER = arg('player'); // nameKey
  const LIMIT = Number(arg('limit', '0')) || 0;
  if (ONLY_PLAYER) entries = entries.filter(([k]) => k === ONLY_PLAYER);
  if (LIMIT > 0) entries = entries.slice(0, LIMIT);

  total = entries.length;

  // Resume
  if (existsSync(BIOS_OUT_PATH)) {
    try {
      output = JSON.parse(readFileSync(BIOS_OUT_PATH, 'utf8'));
      console.log(
        `  ↺ Resuming: found ${Object.keys(output).length} existing bios in ${BIOS_OUT_PATH}`
      );
    } catch {}
  }
  const already = new Set(Object.keys(output));

  for (const [nameKey, personId] of entries) {
    processed++;
    const start = Date.now();

    if (already.has(nameKey)) {
      console.log(
        `  [${processed}/${entries.length}] ${nameKey} (${personId}) — skip (exists)`
      );
      continue;
    }

    console.log(
      `  [${processed}/${entries.length}] ${nameKey} (${personId}) — fetching`
    );

    try {
      const perReqHeaders = {
        Referer: `https://www.nba.com/player/${personId}`,
      };
      const json = await fetchJson(
        urlCommonPlayerInfo(personId),
        4,
        REQUEST_TIMEOUT_MS,
        perReqHeaders
      );
      const info = extractFromCommonPlayerInfo(json);

      let finalInfo = info;

      if (isEmptyInfo(info)) {
        console.log(`    ⚠ API returned empty info, trying HTML fallback...`);
        const html = await fetchPlayerPageHtml(personId, REQUEST_TIMEOUT_MS);
        const h = extractFromPlayerHtml(html);
        finalInfo = {
          teamName: h.teamName ?? null,
          position: h.position ?? null,
          height: h.height ?? null,
          weight: h.weight ?? null,
          birthdate: h.birthdate ?? info.birthdate ?? null,
          age: (() => {
            const bd = h.birthdate ?? info.birthdate;
            if (!bd) return info.age;
            try {
              const d = new Date(bd);
              if (!Number.isNaN(d.getTime())) {
                const now = new Date();
                let years = now.getFullYear() - d.getFullYear();
                const m = now.getMonth() - d.getMonth();
                if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
                return Number.isFinite(years) ? years : info.age;
              }
            } catch {}
            return info.age;
          })(),
          yearsPro: h.yearsPro ?? info.yearsPro ?? null,
        };
        if (isEmptyInfo(finalInfo))
          throw new Error('Empty info after HTML fallback');
      }

      // Roster override / Free Agent tag
      const rosterEntry = rosterMap.get(personId);
      if (rosterEntry && rosterEntry.teamName) {
        finalInfo.teamName = rosterEntry.teamName;
      } else if (!rosterEntry) {
        finalInfo.teamName = 'Free Agent';
      }

      // Normalize birthdate for output
      const normalizedBirthdate = normalizeBirthdate(finalInfo.birthdate);

      // ✅ Output schema restored
      output[nameKey] = {
        bio: {
          height: finalInfo.height ?? undefined,
          weight: finalInfo.weight ?? undefined,
          age: finalInfo.age ?? undefined,
          experience: finalInfo.yearsPro ?? undefined,
          position: finalInfo.position ?? undefined,
          team: finalInfo.teamName ?? undefined,
          birthdate: normalizedBirthdate ?? undefined,
        },
      };

      const ms = Date.now() - start;
      console.log(`    ✓ saved — ${ms}ms`);

      if (processed % 10 === 0) writeCheckpoint();
    } catch (e: any) {
      failures.push({
        key: nameKey,
        id: personId,
        reason: String(e?.message || e),
      });
      console.warn(`    ✗ failed — ${String(e?.message || e)}`);
    }

    const jitter = 400 + Math.floor(Math.random() * 400); // 400–800ms
    await sleep(jitter);
    if (processed % 25 === 0) await sleep(2000);
  }

  writeCheckpoint();
  console.log(
    `✅ Wrote ${Object.keys(output).length} players to ${BIOS_OUT_PATH}`
  );

  if (failures.length) {
    console.warn(
      `⚠️  ${failures.length} failures written to ${FAIL_REPORT_PATH}`
    );
  }

  try {
    if (reqCtx) await reqCtx.dispose();
  } catch {}
}

main().catch((e) => {
  console.error('Fatal error:', e);
  try {
    writeCheckpoint();
  } catch {}
  process.exit(1);
});
