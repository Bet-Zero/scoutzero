// =============================================================
// SCSP™ FULL-FILE REPLACEMENT (v5)
// File: player-scrape/shared/scripts/build_all_player_ids.ts
// Purpose: Build a clean, **sticky** `all_player_ids.json` by unifying:
//   • Current NBA roster (official stats API)
//   • SalarySwish Free Agent pages (from overlays/fa_sources.json OR last 3 seasons)
//   • Manual adds (names you provide)
//   • Manual overrides (name → PERSON_ID when ambiguous)
//   • Whitelist (force-include PERSON_IDs)
//   • Then remove anything on a manual blacklist (final veto)
// Extras:
//   • **Sticky output**: union with previous outputs so no one is dropped unless blacklisted
//   • **Real dupe report**: only names with multiple PERSON_ID candidates, showing which one was picked
// Outputs:
//   • player-scrape/shared/outputs/all_player_ids.json
//   • player-scrape/shared/reports/unresolved_names.json
//   • player-scrape/shared/reports/dupe_name_candidates.json
//   • player-scrape/shared/reports/filtered_out.json
//
// Run (Node ≥18):
//   npx tsx player-scrape/shared/scripts/build_all_player_ids.ts --season=2026 --verify-fa
// Run (Node <18):
//   npx tsx -r undici/register player-scrape/shared/scripts/build_all_player_ids.ts --season=2026 --verify-fa
//
// Optional flags/env:
//   --season=2026               (default 2026 → season code "2025-26")
//   --season-code="2025-26"    (override explicit code)
//   --fa-years=2026,2025,2024   (override which FA pages to use when no fa_sources.json)
//   --verify-fa                  (prints how many names scraped per FA page)
//   --verbose                    (extra logs)
//   OVERLAYS_DIR=player-scrape/shared/overlays  (where manual JSONs live)
//   OUTPUTS_DIR=player-scrape/shared/outputs
//   REPORTS_DIR=player-scrape/shared/reports
//
// Overlay JSONs (all optional; created once and edited by you):
//   overlays/manual_adds.json        → ["Sergio Llull", "Player Name", ...]
//   overlays/manual_overrides.json   → { "Sergio Llull": 201603, "Exact Name": 12345 }
//   overlays/blacklist.json          → [203487, {"id":203487,"name":"Michael Carter-Williams"}] (IDs or {id,name})
//   overlays/whitelist.json          → same format; **force-included** into final set
//   overlays/fa_sources.json         → array of FA page URLs; when present, REPLACES defaults entirely
// =============================================================

/* eslint-disable no-console */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

// ------------------------------
// CLI helpers
// ------------------------------
function arg(flag: string, fallback?: string) {
  const m = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (m) return m.slice(flag.length + 3);
  const i = process.argv.indexOf(`--${flag}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--'))
    return process.argv[i + 1];
  return fallback;
}
function argBool(flag: string, fallback: boolean) {
  const v = arg(flag);
  if (v === undefined) return fallback;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

// ------------------------------
// Config
// ------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SEASON_LABEL = Number(process.env.SEASON ?? arg('season', '2026')); // 2026 → "2025-26"
const SEASON_CODE =
  process.env.SEASON_CODE ??
  arg('season-code') ??
  inferSeasonCode(SEASON_LABEL);
const OVERLAYS_DIR = resolve(
  process.env.OVERLAYS_DIR ??
    arg('overlays-dir', 'player-scrape/shared/overlays')
);
const OUTPUTS_DIR = resolve(
  process.env.OUTPUTS_DIR ?? arg('outputs-dir', 'player-scrape/shared/outputs')
);
const REPORTS_DIR = resolve(
  process.env.REPORTS_DIR ?? arg('reports-dir', 'player-scrape/shared/reports')
);
const VERIFY_FA = argBool('verify-fa', false);
const VERBOSE = argBool('verbose', false);

const DEFAULT_FA_YEARS = [SEASON_LABEL, SEASON_LABEL - 1, SEASON_LABEL - 2];
const FA_YEARS =
  arg('fa-years')
    ?.split(',')
    .map((s) => Number(s.trim()))
    .filter(Boolean) ?? DEFAULT_FA_YEARS;

// ------------------------------
// Utilities
// ------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function inferSeasonCode(seasonYear: number): string {
  const start = seasonYear - 1;
  const endShort = String(seasonYear).slice(-2);
  return `${start}-${endShort}`;
}

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^A-Za-z0-9\s\-\.']/g, ' ') // keep letters, numbers, space, simple punct
    .replace(/\s+/g, ' ')
    .trim();
}

function nameKey(fullName: string): string {
  const n = normalizeText(fullName)
    .toLowerCase()
    .replace(/[\.'’]/g, '')
    .replace(/\s*-/g, ' ')
    .replace(/\s+/g, '_');
  return n;
}

// ------------------------------
// NBA Stats helpers
// ------------------------------
const NBA_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://www.nba.com',
  Referer: 'https://www.nba.com/',
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
};
async function fetchJson(url: string, retries = 3): Promise<any> {
  let lastErr: any;
  for (let a = 0; a <= retries; a++) {
    try {
      const res = await fetch(url, { headers: NBA_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(400 * (a + 1));
    }
  }
  throw lastErr;
}
function urlCommonAllPlayers(seasonCode: string, currentOnly: boolean): string {
  const isOnly = currentOnly ? '1' : '0';
  return `https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=${encodeURIComponent(seasonCode)}&IsOnlyCurrentSeason=${isOnly}`;
}

interface PlayerRow {
  PERSON_ID: number;
  DISPLAY_FIRST_LAST: string;
  FROM_YEAR: string;
  TO_YEAR: string;
  ROSTERSTATUS?: string;
}
function extractPlayers(json: any): PlayerRow[] {
  const rs = (json.resultSets ?? json.ResultSets)?.find(
    (s: any) => Array.isArray(s.headers) && s.headers.includes('PERSON_ID')
  );
  if (!rs) return [];
  const idx = Object.fromEntries(
    rs.headers.map((h: string, i: number) => [h, i])
  );
  return (rs.rowSet as any[]).map((row: any[]) => ({
    PERSON_ID: Number(row[idx['PERSON_ID']]),
    DISPLAY_FIRST_LAST: String(row[idx['DISPLAY_FIRST_LAST']]),
    FROM_YEAR: String(row[idx['FROM_YEAR']]),
    TO_YEAR: String(row[idx['TO_YEAR']]),
    ROSTERSTATUS: String(row[idx['ROSTERSTATUS']] ?? ''),
  }));
}

async function getCurrentRoster(seasonCode: string): Promise<PlayerRow[]> {
  const json = await fetchJson(urlCommonAllPlayers(seasonCode, true));
  return extractPlayers(json);
}
async function getHistoricalIndex(seasonCode: string): Promise<PlayerRow[]> {
  const json = await fetchJson(urlCommonAllPlayers(seasonCode, false));
  return extractPlayers(json);
}

// ------------------------------
// SalarySwish FA scraper
// ------------------------------
function defaultFaUrls(years: number[]): string[] {
  // Past FA groups (filtered by year)
  const past = years.map(
    (y) =>
      `https://www.salaryswish.com/browse/free-agents/${y}/age/all/all/all/asc?signing-method=null`
  );
  return past;
}

async function fetchFaNames(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FA page HTTP ${res.status}: ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const names = new Set<string>();
  $('a[href*="/players/"]').each((_, a) => {
    const txt = $(a).text().trim();
    if (txt && /[A-Za-z]/.test(txt) && txt.length < 60) names.add(txt);
  });
  $('[data-name],[aria-label]').each((_, el) => {
    const t = (
      $(el).attr('data-name') ||
      $(el).attr('aria-label') ||
      ''
    ).trim();
    if (t && /[A-Za-z]/.test(t) && t.length < 60) names.add(t);
  });
  return Array.from(names);
}

// ------------------------------
// Overlays
// ------------------------------
function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}
function overlayPath(name: string) {
  return resolve(OVERLAYS_DIR, name);
}

function loadManualAdds(): string[] {
  const p = overlayPath('manual_adds.json');
  const arr = readJson<any[]>(p, []);
  return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
}
function loadManualOverrides(): Record<string, number> {
  const p = overlayPath('manual_overrides.json');
  const obj = readJson<Record<string, number>>(p, {});
  return obj || {};
}
function loadIdOverlay(name: string): Set<number> {
  const p = overlayPath(name);
  const raw = readJson<any>(p, []);
  const out = new Set<number>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (Number.isFinite(item)) out.add(Number(item));
      else if (
        item &&
        typeof item === 'object' &&
        Number.isFinite((item as any).id)
      )
        out.add(Number((item as any).id));
    }
  }
  return out;
}

// ------------------------------
// Resolution: build BOTH best-index and dupes map
// ------------------------------
function buildNameIndexes(players: PlayerRow[]) {
  const best = new Map<string, PlayerRow>(); // nameKey → most recent TO_YEAR
  const all = new Map<string, PlayerRow[]>(); // nameKey → all candidates
  for (const p of players) {
    const key = nameKey(p.DISPLAY_FIRST_LAST);
    const arr = all.get(key) ?? [];
    arr.push(p);
    all.set(key, arr);

    const prev = best.get(key);
    if (!prev) best.set(key, p);
    else {
      const prevTo = Number(prev.TO_YEAR) || 0;
      const currTo = Number(p.TO_YEAR) || 0;
      if (currTo >= prevTo) best.set(key, p);
    }
  }
  return { best, all } as const;
}

function resolveNameToId(
  name: string,
  bestIndex: Map<string, PlayerRow>,
  allIndex: Map<string, PlayerRow[]>,
  overrides: Record<string, number>
) {
  if (overrides[name] && Number.isFinite(overrides[name]))
    return {
      id: overrides[name],
      reason: 'manual_override',
      mult: false,
      candidates: [] as PlayerRow[],
    };
  const key = nameKey(name);
  const hit = bestIndex.get(key);
  const all = allIndex.get(key) ?? [];
  if (hit)
    return {
      id: hit.PERSON_ID,
      reason: undefined,
      mult: all.length > 1,
      candidates: all,
    };
  return {
    id: undefined,
    reason: 'not_found',
    mult: false,
    candidates: [] as PlayerRow[],
  };
}

// ------------------------------
// Output helpers
// ------------------------------
function writePretty(path: string, obj: any) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(obj, null, 2));
}

// ------------------------------
// MAIN
// ------------------------------
(async () => {
  console.log(
    `\n▶ Building all_player_ids.json (sticky) for season ${SEASON_CODE}`
  );
  ensureDir(OVERLAYS_DIR);
  ensureDir(OUTPUTS_DIR);
  ensureDir(REPORTS_DIR);

  // 1) Load overlays
  const manualAdds = loadManualAdds();
  const manualOverrides = loadManualOverrides();
  const blacklist = loadIdOverlay('blacklist.json');
  const whitelist = loadIdOverlay('whitelist.json'); // now enforced

  if (VERBOSE) {
    console.log('overlays:', {
      manualAdds: manualAdds.length,
      overrides: Object.keys(manualOverrides).length,
      blacklist: blacklist.size,
      whitelist: whitelist.size,
    });
  }

  // 2) Current roster + historical index
  const [current, historical] = await Promise.all([
    getCurrentRoster(SEASON_CODE),
    getHistoricalIndex(SEASON_CODE),
  ]);
  const currentIds = new Set(current.map((p) => p.PERSON_ID));
  const { best: nameIndexBest, all: nameIndexAll } =
    buildNameIndexes(historical);

  // 3) SalarySwish FA pages (from overlays or defaults)
  let faUrls = readJson<string[]>(overlayPath('fa_sources.json'), []);
  if (!faUrls.length) faUrls = defaultFaUrls(FA_YEARS);
  const faNames: string[] = [];
  for (const u of faUrls) {
    try {
      const names = await fetchFaNames(u);
      if (VERIFY_FA) console.log(`  • ${u} → ${names.length} names`);
      faNames.push(...names);
      await sleep(150);
    } catch (e) {
      console.warn(`⚠️  Failed FA page: ${u} — ${(e as Error).message}`);
    }
  }

  // 4) Build the candidate name list
  const candidateNames = new Set<string>();
  current.forEach((p) => candidateNames.add(p.DISPLAY_FIRST_LAST));
  faNames.forEach((n) => candidateNames.add(n));
  manualAdds.forEach((n) => candidateNames.add(n));

  // 5) Resolve → IDs (collect REAL dupes only)
  const unresolved: { name: string; reason: string }[] = [];
  const dupes: {
    name: string;
    nameKey: string;
    candidates: { id: number; fullName: string; toYear: string }[];
    pickedId: number;
  }[] = [];
  const idSet = new Set<number>([...currentIds]);

  for (const name of candidateNames) {
    const r = resolveNameToId(
      name,
      nameIndexBest,
      nameIndexAll,
      manualOverrides
    );
    if (!r.id) {
      unresolved.push({ name, reason: r.reason || 'not_found' });
      continue;
    }
    idSet.add(r.id);
    if (r.mult) {
      const key = nameKey(name);
      const cands = (r.candidates || []).map((c) => ({
        id: c.PERSON_ID,
        fullName: c.DISPLAY_FIRST_LAST,
        toYear: c.TO_YEAR,
      }));
      dupes.push({ name, nameKey: key, candidates: cands, pickedId: r.id });
    }
  }

  // 6) STICKY: union with previous outputs/all_player_ids.json
  const OUT_IDS = resolve(OUTPUTS_DIR, 'all_player_ids.json');
  let prevMap: Record<string, number> = {};
  if (existsSync(OUT_IDS)) {
    try {
      prevMap = JSON.parse(readFileSync(OUT_IDS, 'utf8'));
    } catch {}
    for (const id of Object.values(prevMap)) idSet.add(id);
  }
  const prevIdToKey = new Map<number, string>();
  for (const [k, v] of Object.entries(prevMap)) prevIdToKey.set(v, k);

  // 7) Apply WHITELIST (force-include), then BLACKLIST (final veto)
  for (const wid of whitelist) idSet.add(wid);
  const beforeBlacklist = new Set(idSet);
  for (const bid of blacklist) idSet.delete(bid);
  const filteredOut = [...beforeBlacklist]
    .filter((id) => !idSet.has(id))
    .map((id) => ({ id, reason: 'manual_blacklist' }));

  // 8) Compose output mapping { name_key: id } with stable keys (preserve previous keys when possible)
  const idToName = new Map<number, string>();
  for (const p of historical) idToName.set(p.PERSON_ID, p.DISPLAY_FIRST_LAST);
  for (const p of current) idToName.set(p.PERSON_ID, p.DISPLAY_FIRST_LAST);

  const output: Record<string, number> = {};
  for (const id of idSet) {
    const stableKey = prevIdToKey.get(id);
    if (stableKey) {
      output[stableKey] = id;
      continue;
    }
    const fullName = idToName.get(id) || `id_${id}`;
    output[nameKey(fullName)] = id;
  }

  // 9) Write files
  const OUT_UNRES = resolve(REPORTS_DIR, 'unresolved_names.json');
  const OUT_DUPE = resolve(REPORTS_DIR, 'dupe_name_candidates.json');
  const OUT_FILT = resolve(REPORTS_DIR, 'filtered_out.json');

  writePretty(OUT_IDS, output);
  writePretty(OUT_UNRES, unresolved);
  writePretty(OUT_DUPE, dupes);
  writePretty(OUT_FILT, filteredOut);

  // 10) Summary
  console.log('✔ IDs written:', OUT_IDS);
  console.log(
    '   counts → current:',
    currentIds.size,
    '| FA pages (names, raw sum):',
    faNames.length,
    '| manual adds:',
    manualAdds.length,
    '| whitelist IDs:',
    whitelist.size
  );
  console.log('   totals → unique IDs after sticky+blacklist:', idSet.size);
  console.log('   reports →', OUT_UNRES, OUT_DUPE, OUT_FILT);
})();
