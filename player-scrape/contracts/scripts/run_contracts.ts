// player-scrape/contracts/scripts/run_contracts.ts
//
// One-command batch: fetch → parse → validate → save by team
// - Index: player-scrape/player_index.json (object map keyed by id)
// - Temp files (current player only): player-scrape/contracts/working/page.html, player.json
// - Final file: player-scrape/contracts/output/<TEAM>/<id>.json
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
// - Parser is expected to drop temp output at contracts/working/player.json.
//   Runner moves that into output/<TEAM>/<id>.json and validates there.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
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
} from 'node:fs/promises';

const sh = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** ---------- Paths you care about (fixed) ---------- */
const PLAYER_SCRAPE_ROOT = resolve(__dirname, '..', '..');
const CONTRACTS_DIR = resolve(PLAYER_SCRAPE_ROOT, 'contracts');
const WORKING_DIR = resolve(CONTRACTS_DIR, 'working');
const SCRIPTS_DIR = resolve(CONTRACTS_DIR, 'scripts');
const OUT_BASE = resolve(CONTRACTS_DIR, 'output');
const INDEX_PATH = resolve(PLAYER_SCRAPE_ROOT, 'shared', 'player_index.json');

const FETCH_SCRIPT = resolve(SCRIPTS_DIR, 'fetch_player_page.ts');
const PARSE_SCRIPT = resolve(SCRIPTS_DIR, 'parse_player.ts');
const VALIDATE_SCRIPT = resolve(SCRIPTS_DIR, 'validate_player.ts');

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

async function loadIndex() {
  const raw = await readFile(INDEX_PATH, 'utf8');
  const obj = JSON.parse(raw);
  let items = Object.entries(obj).map(([id, v]) => ({
    id,
    fileId: normalizeIdForFile(id),
    url: `https://salaryswish.com/players/${v['salarySwishSlug']}`,
    team: v['teamCode'],
  }));
  if (TEAM_FILTER) items = items.filter((p) => p.team === TEAM_FILTER);
  if (PLAYER_FILTER) items = items.filter((p) => p.id === PLAYER_FILTER);
  return items;
}

function finalPath(team, fileId) {
  return resolve(OUT_BASE, team, `${fileId}.json`);
}

function buildCommands(p) {
  const tempHtml = `${p.fileId}.html`;
  const tempJson = `${p.fileId}.json`;
  const fetchCmd = `PLAYER_URL="${p.url}" PLAYER_ID="${p.id}" TEMP_FILE="${tempHtml}" npx tsx "${FETCH_SCRIPT}"`;
  const parseCmd = `PLAYER_URL="${p.url}" PLAYER_ID="${p.id}" TEMP_FILE="${tempHtml}" TEMP_JSON="${tempJson}" npx tsx "${PARSE_SCRIPT}"`;
  return { fetchCmd, parseCmd };
}

async function collectAndPlace(p) {
  const dest = finalPath(p.team, p.fileId);
  await mkdir(resolve(OUT_BASE, p.team), { recursive: true });
  const perPlayer = resolve(WORKING_DIR, `${p.fileId}.json`);
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

async function runOne(p, attempt = 1, maxAttempts = 3) {
  const dest = finalPath(p.team, p.fileId);
  if (RESUME && (await exists(dest))) {
    console.log(`[${now()}] ▶︎ SKIP (exists)  ${p.team}/${p.id}`);
    if (DO_PUSH_PREVIEW) {
      const payload = JSON.parse(await readFile(dest, 'utf8'));
      await appendPreview(p.id, payload);
      if (DO_CLEANUP) await rm(dest, { force: true });
    }
    return { id: p.id, status: 'skipped' };
  }
  const { fetchCmd, parseCmd } = buildCommands(p);
  console.log(
    `[${now()}] ▶︎ START (${attempt}/${maxAttempts}) ${p.team}/${p.id}`
  );
  try {
    await sh(fetchCmd, { cwd: CONTRACTS_DIR, maxBuffer: 1024 * 1024 * 20 });
    await sh(parseCmd, { cwd: CONTRACTS_DIR, maxBuffer: 1024 * 1024 * 20 });
    const placedPath = await collectAndPlace(p);
    await runValidate(p, placedPath);
    if (DO_PUSH_PREVIEW) {
      const payload = JSON.parse(await readFile(placedPath, 'utf8'));
      await appendPreview(p.id, payload);
      if (DO_CLEANUP) await rm(placedPath, { force: true });
    }
    console.log(`[${now()}] ✅ DONE  ${p.team}/${p.id}`);
    return { id: p.id, status: 'ok' };
  } catch (err) {
    console.error(
      `[${now()}] ❌ FAIL (${attempt}/${maxAttempts}) ${p.team}/${p.id}`
    );
    if (attempt < maxAttempts) {
      await sleep(500 + attempt * 1000);
      return runOne(p, attempt + 1, maxAttempts);
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
        const p = players[idx++];
        inFlight++;
        runOne(p)
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
