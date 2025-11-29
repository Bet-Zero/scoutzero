// player-scrape/contracts/scripts/run_contracts.ts
//
// One-command batch: fetch → parse → validate → save by team
// - Index: player-scrape/player_index.json (object map keyed by id)
// - Temp files (current player only): player-scrape/contracts/_artifacts/working/page.html, player.json
// - Final file: player-scrape/contracts/_artifacts/output/<TEAM>/<id>.json
// - Mock publish: player-scrape/contracts/output/_publish_preview.jsonl
//
// Examples:
//   npx tsx player-scrape/contracts/scripts/run_contracts.ts
//   npx tsx player-scrape/contracts/scripts/run_contracts.ts --team=LAL --concurrency=6 --resume
//   npx tsx player-scrape/contracts/scripts/run_contracts.ts --player=austin_reaves --push
//   npx tsx player-scrape/contracts/scripts/run_contracts.ts --push --cleanup
//
// Notes:
// - No Firestore writes yet. --push only builds a preview file.
// - Parser is expected to drop temp output at contracts/_artifacts/working/player.json.
//   Runner moves that into _artifacts/output/<TEAM>/<id>.json and validates there.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readFile,
  writeFile,
  mkdir,
  access,
  constants,
  rm,
  cp,
  appendFile,
  mkdtemp,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';

const sh = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** ---------- Paths you care about (fixed) ---------- */
const PLAYER_SCRAPE_ROOT = resolve(__dirname, '..', '..');
const CONTRACTS_DIR = resolve(PLAYER_SCRAPE_ROOT, 'contracts');
const WORKING_DIR = resolve(CONTRACTS_DIR, '_artifacts', 'working');
const SCRIPTS_DIR = resolve(CONTRACTS_DIR, 'scripts');
const OUT_BASE = resolve(CONTRACTS_DIR, '_artifacts', 'output');
const INDEX_PATH = resolve(
  PLAYER_SCRAPE_ROOT,
  'shared',
  'outputs',
  'player_index.json'
);

const FETCH_SCRIPT = resolve(SCRIPTS_DIR, 'fetch_player_page.ts');
const PARSE_SCRIPT = resolve(SCRIPTS_DIR, 'parse_player.ts');
const VALIDATE_SCRIPT = resolve(SCRIPTS_DIR, 'validate_player.ts');

const TEAM_CODE_TO_NAME: Record<string, string> = {
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

/** ---------- Flags (kept simple) ---------- */
// Supports:
//   --name=value
//   --name value
//   --flag            (boolean true)
function getArg(name: string, def?: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${name}`) {
      // bare flag → boolean true
      // If the next arg is another flag or absent, treat as true
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      // Otherwise it's a space-separated value
      return next;
    }
    if (arg.startsWith(`--${name}=`)) {
      const [, val] = arg.split('=');
      return val ?? 'true';
    }
  }
  return def;
}

function getNumberArg(name: string, def: number): number {
  const raw = getArg(name, undefined);
  if (raw == null) return def;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const TEAM_FILTER = getArg('team', undefined);
const PLAYER_FILTER = getArg('player', undefined);
const CONCURRENCY = getNumberArg('concurrency', 6);
const RESUME = getArg('resume', 'false') === 'true';
const DO_PUSH_PREVIEW = getArg('push', 'false') === 'true';
const DO_CLEANUP = getArg('cleanup', 'false') === 'true';

/** ---------- Helpers ---------- */
async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
function now() {
  return new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeIdForFile(id) {
  const ascii = id.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_');
}

const SALARY_SWISH_SLUG_OVERRIDES_BY_ID: Record<string, string> = {
  shai_gilgeous_alexander: 'shai-gilgeousalexander',
  // Manual overrides from url_mapping_test_results.json
  marvin_bagley_iii: 'marvin-bagleyiii',
  bogdan_bogdanović: 'bogdan-bogdanovic',
  brandon_boston: 'brandon-boston-jr',
  bruce_brown: 'bruce-brown-jr',
  bub_carrington: 'carlton-carrington',
  wendell_carter_jr: 'wendell-carterjr',
  nic_claxton: 'nicolas-claxton',
  pacôme_dadiet: 'pacome-dadiet',
  moussa_diabaté: 'moussa-diabate',
  luka_dončić: 'luka-doncic',
  danté_exum: 'dante-exum',
  tim_hardaway_jr: 'tim-hardawayjr',
  ronald_holland_ii: 'ron-holland-ii',
  gg_jackson: 'gg-jackson-ii',
  jaren_jackson_jr: 'jaren-jacksonjr',
  nikola_jokić: 'nikola-jokic',
  derrick_jones_jr: 'derrick-jonesjr',
  nikola_jović: 'nikola-jovic',
  vít_krejčí: 'vit-krejci',
  karlo_matković: 'karlo-matkovic',
  vasilije_micić: 'vasilije-micic',
  monté_morris: 'monte-morris',
  larry_nance_jr: 'larry-nancejr',
  jusuf_nurkić: 'jusuf-nurkic',
  kelly_oubre_jr: 'kelly-oubrejr',
  gary_payton_ii: 'gary-paytonii',
  kevin_porter_jr: 'kevin-porterjr',
  michael_porter_jr: 'michael-porterjr',
  kristaps_porziņģis: 'kristaps-porzingis',
  lester_quiñones: 'lester-quinones',
  tidjane_salaün: 'tidjane-salaun',
  dennis_schröder: 'dennis-schroder',
  nikola_topić: 'nikola-topic',
  gary_trent_jr: 'gary-trentjr',
  jonas_valančiūnas: 'jonas-valanciunas',
  nikola_vučević: 'nikola-vucevic',
  lonnie_walker_iv: 'lonnie-walkeriv',
  robert_williams_iii: 'robert-williamsiii',
  vlatko_čančar: 'vlatko-cancar',
  dario_šarić: 'dario-saric',
  egor_dëmin: 'egor-demin',
  hugo_gonzález: 'hugo-gonzalez',
  kasparas_jakučionis: 'kasparas-jakucionis',
  bogoljub_marković: 'bogoljub-markovic',
  augustas_marčiulionis: 'augustas-marciulionis',
  chris_mañon: 'chris-manon',
  // Additional manual fixes from complete_url_mapping_results.json
  nickeil_alexander_walker: 'nickeil-alexanderwalker',
  daron_holmes_ii: 'daron-holmes',
  kj_simpson: 'k-j-simpson',
  tolu_smith: 'tolu-smith-iii',
  xavier_tillman: 'xavier-tillman-sr',
  david_jones_garcia: 'david-jones',
  alex_sarr: 'alexandre-sarr',
  yanic_konan_niederhauser: 'yanic-niederhauser',
  svi_mykhailiuk: 'sviatoslav-mykhailiuk',
  nikola_urisic: 'nikola-durisic',
  // More from complete_url_mapping_results.json
  jimmy_butler_iii: 'jimmy-butler',
  cam_christie: 'cameron-christie',
  jeff_dowtin_jr: 'jeff-dowtin',
  bones_hyland: 'nahshon-bones-hyland',
  trey_jemison_iii: 'trey-jemison',
  kevin_knox_ii: 'kevin-knox',
  kj_martin: 'kenyon-martin-jr',
  shake_milton: 'malik-shake-milton',
  cameron_payne: 'cam-payne',
  jeenathan_williams: 'nate-williams',
  rj_luis_jr: 'rj-luis',
  'igor_miličić,_jr': 'igor-milicic',
  // Additional fixes
  yang_hansen: 'yang-hansen',
};

function normalizeSalarySwishSlug(id: string, rawSlug: unknown): string {
  if (typeof rawSlug !== 'string' || !rawSlug.trim()) {
    return '';
  }

  const override = SALARY_SWISH_SLUG_OVERRIDES_BY_ID[id];
  if (override) return override;

  // Basic cleanup: collapse unicode apostrophes, trim whitespace, single hyphen separation
  return rawSlug
    .replace(/[’']/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

async function loadIndex() {
  const raw = await readFile(INDEX_PATH, 'utf8');
  const obj = JSON.parse(raw);
  let items = Object.entries(obj).map(([id, v]) => ({
    id,
    fileId: normalizeIdForFile(id),
    url: `https://salaryswish.com/players/${normalizeSalarySwishSlug(
      id,
      v['salarySwishSlug']
    )}`,
    team: v['teamCode'] || 'FREE', // Use 'FREE' for free agents (null teamCode)
    teamName:
      (typeof v['teamName'] === 'string' && v['teamName']) ||
      TEAM_CODE_TO_NAME[v['teamCode']] ||
      (v['teamCode'] ? undefined : 'Free Agent'),
  }));
  if (TEAM_FILTER) items = items.filter((p) => p.team === TEAM_FILTER);
  if (PLAYER_FILTER) items = items.filter((p) => p.id === PLAYER_FILTER);
  return items;
}

function finalPath(team, fileId) {
  return resolve(OUT_BASE, team || 'FREE', `${fileId}.json`);
}

function buildCommands(
  p,
  workingDirOverride: string,
  tempHtml: string,
  tempJson: string
) {
  const fetchCmd = [
    `WORKING_DIR_OVERRIDE="${workingDirOverride}"`,
    `PLAYER_URL="${p.url}"`,
    `PLAYER_ID="${p.id}"`,
    `TEMP_FILE="${tempHtml}"`,
    `npx tsx "${FETCH_SCRIPT}"`,
  ].join(' ');
  const envParts = [
    `WORKING_DIR_OVERRIDE="${workingDirOverride}"`,
    `PLAYER_URL="${p.url}"`,
    `PLAYER_ID="${p.id}"`,
    `TEMP_FILE="${tempHtml}"`,
    `TEMP_JSON="${tempJson}"`,
  ];
  if (p.team) envParts.push(`PLAYER_TEAM_CODE="${p.team}"`);
  if (p.teamName)
    envParts.push(`PLAYER_TEAM_NAME="${p.teamName.replace(/"/g, '\\"')}"`);
  const parseCmd = `${envParts.join(' ')} npx tsx "${PARSE_SCRIPT}"`;
  return { fetchCmd, parseCmd };
}

async function collectAndPlace(p, tempJsonPath?: string) {
  const dest = finalPath(p.team, p.fileId);
  await mkdir(resolve(OUT_BASE, p.team), { recursive: true });
  const perPlayer = tempJsonPath
    ? resolve(tempJsonPath)
    : resolve(WORKING_DIR, `${p.fileId}.json`);
  const canonical = resolve(WORKING_DIR, 'player.json');
  const candidateLegacy = resolve(CONTRACTS_DIR, 'player.json');
  const candidateFinal = resolve(OUT_BASE, p.team, `${p.fileId}.json`);
  const candidateFlat = resolve(OUT_BASE, `${p.fileId}.json`);
  if (await exists(perPlayer)) {
    await cp(perPlayer, dest, { force: true });
    console.log(`📥 Placed from per-player temp: ${perPlayer} → ${dest}`);
    return dest;
  }
  if (await exists(canonical)) {
    await cp(canonical, dest, { force: true });
    console.log(`📥 Placed from canonical temp: ${canonical} → ${dest}`);
    return dest;
  }
  if (await exists(candidateLegacy)) {
    await cp(candidateLegacy, dest, { force: true });
    return dest;
  }
  if (await exists(candidateFinal)) {
    return candidateFinal;
  }
  if (await exists(candidateFlat)) {
    await cp(candidateFlat, dest, { force: true });
    return dest;
  }
  throw new Error(
    `Parsed temp not found for ${p.id}. Looked for:\n` +
      `  - ${perPlayer}\n` +
      `  - ${canonical}\n` +
      `  - ${candidateLegacy}\n` +
      `  - ${candidateFinal}\n` +
      `  - ${candidateFlat}\n`
  );
}

async function runValidate(p, _finalPathStr) {
  const relName = `${p.fileId}.json`;
  const cmd = `TEAM_CODE="${p.team}" PLAYER_FILE="${relName}" npx tsx "${VALIDATE_SCRIPT}"`;
  await sh(cmd, { cwd: CONTRACTS_DIR, maxBuffer: 1024 * 1024 * 20 });
  console.log(`[${now()}] ✅ VALIDATED ${p.team}/${p.id}`);
}

const PREVIEW_PATH = resolve(OUT_BASE, '_publish_preview.jsonl');
async function appendPreview(id, data) {
  const line = JSON.stringify({
    id,
    targets: [
      'TODO:/players_v2/<id>/contracts/current',
      'TODO:/architect/basePlayers/<id>/contracts/current',
    ],
    data,
  });
  await appendFile(PREVIEW_PATH, line + '\n', { encoding: 'utf8' });
}

async function runOne(
  p,
  attempt = 1,
  maxAttempts = 3,
  progressInfo?: { current: number; total: number }
) {
  const dest = finalPath(p.team, p.fileId);
  if (RESUME && (await exists(dest))) {
    const progress = progressInfo
      ? `[${progressInfo.current}/${progressInfo.total}]`
      : '';
    console.log(`[${now()}] ${progress} ▶︎ SKIP (exists)  ${p.team}/${p.id}`);
    if (DO_PUSH_PREVIEW) {
      const payload = JSON.parse(await readFile(dest, 'utf8'));
      await appendPreview(p.id, payload);
      if (DO_CLEANUP) await rm(dest, { force: true });
    }
    return { id: p.id, status: 'skipped' };
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'player-scrape-'));
  const tempHtmlName = `${p.fileId}.html`;
  const tempJsonName = `${p.fileId}.json`;
  const { fetchCmd, parseCmd } = buildCommands(
    p,
    tempDir,
    tempHtmlName,
    tempJsonName
  );
  const progress = progressInfo
    ? `[${progressInfo.current}/${progressInfo.total}]`
    : '';
  console.log(
    `[${now()}] ${progress} ▶︎ START (${attempt}/${maxAttempts}) ${p.team}/${p.id}`
  );
  try {
    await sh(fetchCmd, { cwd: CONTRACTS_DIR, maxBuffer: 1024 * 1024 * 20 });
    await sh(parseCmd, { cwd: CONTRACTS_DIR, maxBuffer: 1024 * 1024 * 20 });
    const tempJsonPath = join(tempDir, tempJsonName);
    const placedPath = await collectAndPlace(p, tempJsonPath);
    await runValidate(p, placedPath);
    if (DO_PUSH_PREVIEW) {
      const payload = JSON.parse(await readFile(placedPath, 'utf8'));
      await appendPreview(p.id, payload);
      if (DO_CLEANUP) await rm(placedPath, { force: true });
    }
    // Clean up temp files from working directory after successful processing
    const tempHtmlPath = join(tempDir, tempHtmlName);
    await rm(tempHtmlPath, { force: true }).catch(() => {});
    await rm(tempJsonPath, { force: true }).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    const progress = progressInfo
      ? `[${progressInfo.current}/${progressInfo.total}]`
      : '';
    console.log(`[${now()}] ${progress} ✅ DONE  ${p.team}/${p.id}`);
    return { id: p.id, status: 'ok' };
  } catch (err) {
    const progress = progressInfo
      ? `[${progressInfo.current}/${progressInfo.total}]`
      : '';
    console.error(
      `[${now()}] ${progress} ❌ FAIL (${attempt}/${maxAttempts}) ${p.team}/${p.id}`
    );
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    if (attempt < maxAttempts) {
      await sleep(500 + attempt * 1000);
      return runOne(p, attempt + 1, maxAttempts, progressInfo);
    }
    console.error(err?.stdout || '');
    console.error(err?.stderr || '');
    console.error(err?.message || err);
    return { id: p.id, status: 'error' };
  }
}

async function runAll() {
  const players = await loadIndex();
  if (!players.length) {
    console.log(
      `No players matched filters. (team=${TEAM_FILTER ?? '-'} player=${PLAYER_FILTER ?? '-'})`
    );
    return;
  }
  await mkdir(OUT_BASE, { recursive: true });
  await mkdir(WORKING_DIR, { recursive: true });
  if (DO_PUSH_PREVIEW) {
    await writeFile(PREVIEW_PATH, '', { encoding: 'utf8' });
  }
  console.log(
    `\n⚙️  Contracts pipeline\n` +
      `   Players: ${players.length}\n` +
      `   Concurrency: ${CONCURRENCY}\n` +
      `   Filters → team: ${TEAM_FILTER ?? '-'}, player: ${PLAYER_FILTER ?? '-'}\n` +
      `   Output base: ${OUT_BASE}\n` +
      `   Working dir: ${WORKING_DIR}\n` +
      `   Push (mock): ${DO_PUSH_PREVIEW ? 'ON' : 'off'}  Cleanup: ${DO_CLEANUP ? 'ON' : 'off'}\n`
  );
  let inFlight = 0,
    idx = 0;
  let ok = 0,
    skipped = 0,
    failed = 0;
  await new Promise((resolveDone) => {
    const next = () => {
      if (idx >= players.length && inFlight === 0) {
        console.log(
          `\n📊 Summary → ok: ${ok}, skipped: ${skipped}, failed: ${failed}`
        );
        if (DO_PUSH_PREVIEW) {
          console.log(`📝 Publish preview: ${PREVIEW_PATH}`);
          console.log(`(No Firestore writes were performed.)`);
        }
        return resolveDone(undefined);
      }
      while (inFlight < CONCURRENCY && idx < players.length) {
        const p = players[idx];
        const currentIdx = idx++;
        inFlight++;
        runOne(p, 1, 3, { current: currentIdx + 1, total: players.length })
          .then((res) => {
            if (res.status === 'ok') ok++;
            else if (res.status === 'skipped') skipped++;
            else failed++;
          })
          .finally(() => {
            inFlight--;
            next();
          });
      }
    };
    next();
  });
}

runAll().catch((err) => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
