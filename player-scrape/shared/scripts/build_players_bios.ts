/* eslint-disable no-console */
// Build players_bios_<season>.json by fetching NBA commonplayerinfo for each PERSON_ID
// Input:  player-scrape/shared/outputs/all_player_ids.json (nameKey -> PERSON_ID)
// Output: player-scrape/shared/players_bios_<season>.json (nameKey -> { bio: {...} })

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, APIRequestContext } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type IdMap = Record<string, number>;

const SHARED_DIR = resolve(__dirname, '..'); // player-scrape/shared
const OUTPUTS_DIR = resolve(SHARED_DIR, 'outputs');
const REPORTS_DIR = resolve(SHARED_DIR, 'reports');

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function arg(flag: string, fallback?: string) {
  const m = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (m) return m.slice(flag.length + 3);
  const i = process.argv.indexOf(`--${flag}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--'))
    return process.argv[i + 1];
  return fallback;
}

const SEASON_LABEL = Number(process.env.SEASON ?? arg('season', '2026')); // e.g., 2026 -> "2025-26"
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
const BIOS_OUT_PATH = resolve(SHARED_DIR, `players_bios_${SEASON_LABEL}.json`);
const FAIL_REPORT_PATH = resolve(
  REPORTS_DIR,
  `players_bios_failures_${SEASON_LABEL}.json`
);

const NBA_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://www.nba.com',
  Referer: 'https://www.nba.com/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  Connection: 'keep-alive',
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache',
};

function urlCommonPlayerInfo(personId: number): string {
  return `https://stats.nba.com/stats/commonplayerinfo?LeagueID=00&PlayerID=${encodeURIComponent(
    String(personId)
  )}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const REQUEST_TIMEOUT_MS = Number(
  process.env.BIOS_TIMEOUT_MS ?? arg('timeout', '12000')
);

let reqCtx: APIRequestContext | null = null;

async function getRequestContext(): Promise<APIRequestContext> {
  if (reqCtx) return reqCtx;
  reqCtx = await request.newContext({
    extraHTTPHeaders: NBA_HEADERS,
  });
  return reqCtx;
}

async function fetchJson(
  url: string,
  retries = 3,
  timeoutMs = REQUEST_TIMEOUT_MS,
  headers?: Record<string, string>
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctx = await getRequestContext();
      const res = await ctx.get(url, { timeout: timeoutMs, headers });
      if (!res.ok()) throw new Error(`HTTP ${res.status()} for ${url}`);
      const ct = (await res.headers())['content-type'] || '';
      // Ensure JSON, some bot pages return HTML with 200 OK
      if (!/application\/json/i.test(ct)) {
        const txt = await res.text();
        throw new Error(`Non-JSON content-type: ${ct} len=${txt?.length ?? 0}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      const msg = String((e as any)?.message || e);
      // Heavier backoff on likely rate limit/forbidden
      const base = /HTTP 429|HTTP 403/.test(msg) ? 2000 : 300;
      await sleep(base * (attempt + 1));
    }
  }
  throw lastErr;
}

function extractFromCommonPlayerInfo(json: any): {
  teamName: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  yearsPro: number | null;
  birthdate: string | null;
} {
  // The response has a ResultSets with headers/rowSet; find the set that has PLAYER_ID
  const rs = (json.resultSets ?? json.ResultSets)?.find(
    (s: any) => Array.isArray(s.headers) && s.headers.includes('PLAYER_ID')
  );
  if (!rs)
    return {
      teamName: null,
      position: null,
      height: null,
      weight: null,
      age: null,
      yearsPro: null,
      birthdate: null,
    };

  const idx = Object.fromEntries(
    (rs.headers as string[]).map((h: string, i: number) => [h, i])
  );
  const row = (rs.rowSet as any[])[0];
  if (!row)
    return {
      teamName: null,
      position: null,
      height: null,
      weight: null,
      age: null,
      yearsPro: null,
      birthdate: null,
    };

  const teamFull = String(row[idx['TEAM_NAME']] ?? '').trim();
  const teamName = teamFull ? (teamFull.split(/\s+/).slice(-1)[0] || teamFull) : null;
  const position = String(row[idx['POSITION']] ?? '').trim() || null;
  const height = String(row[idx['HEIGHT']] ?? '').trim() || null; // e.g., 6-8
  const weight = String(row[idx['WEIGHT']] ?? '').trim() || null; // e.g., 243
  const birthDate = String(row[idx['BIRTHDATE']] ?? '').trim() || null;
  let yearsPro: number | null = null;
  const seasonExp = row[idx['SEASON_EXP']];
  if (typeof seasonExp === 'number') yearsPro = seasonExp;
  else if (typeof seasonExp === 'string' && /^\d+$/.test(seasonExp)) yearsPro = parseInt(seasonExp, 10);

  let age: number | null = null;
  if (birthDate) {
    const d = new Date(birthDate);
    if (!Number.isNaN(d.getTime())) {
      const now = new Date();
      let years = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
      age = Number.isFinite(years) ? years : null;
    }
  }

  return { teamName, position, height, weight, age, yearsPro, birthdate: birthDate };
}

function isEmptyInfo(info: {
  teamName: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
}): boolean {
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
    headers: { Referer: 'https://www.nba.com/' },
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
  // Prefer parsing __NEXT_DATA__ blob
  try {
    const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (scriptMatch && scriptMatch[1]) {
      const json = JSON.parse(scriptMatch[1]);

      // Generic deep search helpers since structure changes
      const results: any = { teamName: null, position: null, height: null, weight: null, birthdate: null, yearsPro: null };

      function visit(node: any) {
        if (!node || typeof node !== 'object') return;

        // Normalize keys
        const keys = Object.keys(node);
        const lowerKeys = new Set(keys.map((k) => k.toLowerCase()));

        // team
        if (lowerKeys.has('teamname') && results.teamName == null) {
          const v = (node as any)['teamName'];
          if (typeof v === 'string' && v.trim()) results.teamName = v.trim();
        }
        if (lowerKeys.has('tricode') && results.teamName == null) {
          const v = (node as any)['tricode'];
          if (typeof v === 'string' && v.trim()) results.teamName = v.trim();
        }

        // position
        if (lowerKeys.has('position') && results.position == null) {
          const v = (node as any)['position'];
          if (typeof v === 'string' && v.trim()) results.position = v.trim();
        }

        // height weight
        if (lowerKeys.has('height') && results.height == null) {
          const v = (node as any)['height'];
          // Only accept string format matching "X-Y" pattern (e.g., "6-8" or "7-2")
          // NBA heights are typically 1-2 digits for feet, 1-2 digits for inches
          if (typeof v === 'string' && /^\d{1,2}-\d{1,2}$/.test(v.trim())) {
            results.height = v.trim();
          }
        }
        if (lowerKeys.has('weight') && results.weight == null) {
          const v = (node as any)['weight'];
          // Only accept valid weight strings or numbers
          if (typeof v === 'string' && /\d{2,3}/.test(v)) {
            results.weight = (v.match(/\d{2,3}/) || [''])[0];
          } else if (typeof v === 'number' && v >= 100 && v <= 400) {
            // Reasonable weight range for NBA players
            results.weight = String(v);
          }
        }

        // birthdate
        if ((lowerKeys.has('birthdate') || lowerKeys.has('dateofbirthutc')) && results.birthdate == null) {
          const v = (node as any)['birthdate'] ?? (node as any)['dateOfBirthUTC'];
          if (typeof v === 'string' && v.length >= 8) results.birthdate = v;
        }

        // years pro / seasonExp
        if ((lowerKeys.has('seasonexp') || lowerKeys.has('season_experience') || lowerKeys.has('seasongamesplayed')) && results.yearsPro == null) {
          const v = (node as any)['seasonExp'] ?? (node as any)['season_experience'];
          if (typeof v === 'number') results.yearsPro = v;
          else if (typeof v === 'string' && /^\d+$/.test(v)) results.yearsPro = parseInt(v, 10);
        }

        for (const k of keys) visit((node as any)[k]);
      }

      visit(json);

      // If we got a triCode for team, keep it as teamName and mapping later will handle
      return results;
    }
  } catch {}

  // Fallback: heuristic regexes against embedded JSON/HTML
  const teamMatch = html.match(/"teamName"\s*:\s*"([^"]+)"/);
  const triMatch = html.match(/"tricode"\s*:\s*"([A-Z]{3})"/);
  const posMatch = html.match(/"position"\s*:\s*"([^"]+)"/);
  const heightMatch = html.match(/"height"\s*:\s*"([0-9\-]+)"/);
  const weightMatch = html.match(/"weight"\s*:\s*"?(\d{2,3})"?/);
  const birthMatch = html.match(/"birthdate"\s*:\s*"([^"]+)"|"dateOfBirthUTC"\s*:\s*"([^"]+)"/);
  const teamName = teamMatch ? teamMatch[1] : triMatch ? triMatch[1] : null;
  return {
    teamName,
    position: posMatch ? posMatch[1] : null,
    height: heightMatch ? heightMatch[1] : null,
    weight: weightMatch ? weightMatch[1] : null,
    birthdate: birthMatch ? (birthMatch[1] || birthMatch[2] || null) : null,
    yearsPro: null,
  };
}

async function main() {
  console.log(
    `\n▶ Building players_bios_${SEASON_LABEL}.json from ${IDS_PATH}`
  );
  if (!existsSync(IDS_PATH)) {
    console.error(`Missing IDs file: ${IDS_PATH}`);
    process.exit(1);
  }
  ensureDir(REPORTS_DIR);

  const idMap: IdMap = JSON.parse(readFileSync(IDS_PATH, 'utf8'));
  let entries = Object.entries(idMap).sort((a, b) => a[0].localeCompare(b[0]));

  // Optional filters for quick tests
  const ONLY_PLAYER = arg('player'); // nameKey, e.g., aaron_gordon
  const LIMIT = Number(arg('limit', '0')) || 0;
  if (ONLY_PLAYER) {
    entries = entries.filter(([k]) => k === ONLY_PLAYER);
  }
  if (LIMIT > 0) {
    entries = entries.slice(0, LIMIT);
  }

  // Resume support: preload existing bios file and skip processed
  let output: Record<string, any> = {};
  if (existsSync(BIOS_OUT_PATH)) {
    try {
      output = JSON.parse(readFileSync(BIOS_OUT_PATH, 'utf8'));
      console.log(
        `  ↺ Resuming: found ${Object.keys(output).length} existing bios in ${BIOS_OUT_PATH}`
      );
    } catch {}
  }
  const already = new Set(Object.keys(output));
  const failures: Array<{ key: string; id: number; reason: string }> = [];

  let processed = 0;
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
      const url = urlCommonPlayerInfo(personId);
      // Use a per-player Referer to better mimic browser navigation
      const perReqHeaders = {
        Referer: `https://www.nba.com/player/${personId}`,
      } as Record<string, string>;
      const json = await fetchJson(url, 3, REQUEST_TIMEOUT_MS, perReqHeaders);
      const info = extractFromCommonPlayerInfo(json);
      let finalInfo = info;

      if (isEmptyInfo(info)) {
        // Fallback: parse player profile HTML
        console.log(`    ⚠ API returned empty info, trying HTML fallback...`);
        const html = await fetchPlayerPageHtml(personId, REQUEST_TIMEOUT_MS);
        const h = extractFromPlayerHtml(html);
        finalInfo = {
          teamName: h.teamName,
          position: h.position,
          height: h.height,
          weight: h.weight,
          birthdate: h.birthdate ?? info.birthdate,
          age: (() => {
            // compute from birthdate when present
            const bd = h.birthdate;
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
        if (isEmptyInfo(finalInfo)) {
          throw new Error('Empty info after HTML fallback');
        }
      }

      output[nameKey] = {
        bio: {
          height: finalInfo.height ?? undefined,
          weight: finalInfo.weight ?? undefined,
          age: finalInfo.age ?? undefined,
          experience: finalInfo.yearsPro ?? undefined,
          position: finalInfo.position ?? undefined,
          team: finalInfo.teamName ?? undefined,
          birthdate: finalInfo.birthdate ?? undefined,
        },
      };
      const ms = Date.now() - start;
      console.log(`    ✓ saved — ${ms}ms`);
      // Periodic checkpoint to disk every 10
      if (processed % 10 === 0) {
        writeFileSync(BIOS_OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
        console.log('    ⬇ checkpoint written');
      }
    } catch (e: any) {
      failures.push({
        key: nameKey,
        id: personId,
        reason: String(e?.message || e),
      });
      console.warn(`    ✗ failed — ${String(e?.message || e)}`);
    }
    // Jittered throttle to avoid rate limits
    const jitter = 400 + Math.floor(Math.random() * 400); // 400-800ms
    await sleep(jitter);
    // After each block of 25, add a short rest
    if (processed % 25 === 0) {
      await sleep(2000);
    }
  }

  writeFileSync(BIOS_OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(
    `✅ Wrote ${Object.keys(output).length} players to ${BIOS_OUT_PATH}`
  );

  if (failures.length) {
    writeFileSync(FAIL_REPORT_PATH, JSON.stringify(failures, null, 2), 'utf8');
    console.warn(
      `⚠️  ${failures.length} failures written to ${FAIL_REPORT_PATH}`
    );
  }
  // Cleanup request context
  try {
    if (reqCtx) await reqCtx.dispose();
  } catch {}
}

main();
