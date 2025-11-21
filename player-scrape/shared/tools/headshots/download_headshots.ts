/**
 * FILE: player-scrape/shared/tools/headshots/download_headshots.ts
 * PURPOSE: Download NBA player headshots from CDN and save to public/assets/headshots
 * OWNERSHIP: Tool: player-scrape/headshots (Headshot sync utility)
 *
 * HISTORY:
 *  - 2025-01-12: Created by plan `plans/headshot-sync/plan.md`, chunk_01
 *
 * LINKS:
 *  - Plan: plans/headshot-sync/plan.md
 *  - Latest Chunk: plans/headshot-sync/chunks/chunk_01.md
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Paths ----
// __dirname = player-scrape/shared/tools/headshots
const SHARED_DIR = path.resolve(__dirname, '../..'); // player-scrape/shared
const PROJECT_ROOT = path.resolve(SHARED_DIR, '../..'); // project root
const PLAYER_INDEX_PATH = path.resolve(SHARED_DIR, '_artifacts/outputs/player_index.json');
const HEADSHOTS_DIR = path.resolve(PROJECT_ROOT, 'public/assets/headshots');

// ---- Types ----
type PlayerIndexEntry = {
  fullName: string;
  nbaId: number;
  salarySwishSlug: string;
  teamCode: string | null;
};

type PlayerIndex = Record<string, PlayerIndexEntry>;

type DownloadResult = {
  playerId: string;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
};

// ---- CLI Args ----
function getArg(flag: string, fallback?: string): string | undefined {
  const m = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (m) return m.slice(flag.length + 3);
  const i = process.argv.indexOf(`--${flag}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--'))
    return process.argv[i + 1];
  return fallback;
}

function getNumberArg(flag: string, def: number): number {
  const raw = getArg(flag);
  if (!raw) return def;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function getBoolArg(flag: string, def: boolean): boolean {
  const raw = getArg(flag);
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.argv.includes(`--${flag}`) ? true : def;
}

const ALL_FLAG = getBoolArg('all', false);
const FILTER_RAW = getArg('filter', undefined);
const OVERWRITE = getBoolArg('overwrite', ALL_FLAG); // Default true when --all, false otherwise
const DRY_RUN = getBoolArg('dry-run', false);
const CONCURRENCY = getNumberArg('concurrency', 10);

// Parse filter: comma-separated player IDs
const FILTER_SET = FILTER_RAW
  ? new Set(FILTER_RAW.split(',').map((s) => s.trim()).filter(Boolean))
  : null;

// ---- Helpers ----
async function loadPlayerIndex(): Promise<PlayerIndex> {
  const content = await fs.readFile(PLAYER_INDEX_PATH, 'utf8');
  return JSON.parse(content) as PlayerIndex;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getHeadshotUrl(nbaId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`;
}

async function downloadHeadshot(
  playerId: string,
  nbaId: number,
  outputPath: string
): Promise<{ ok: boolean; error?: string }> {
  const url = getHeadshotUrl(nbaId);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ScoutZero/1.0)',
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
      };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      return {
        ok: false,
        error: 'Empty response',
      };
    }

    if (!DRY_RUN) {
      await fs.writeFile(outputPath, Buffer.from(buffer));
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function processPlayer(
  playerId: string,
  entry: PlayerIndexEntry
): Promise<DownloadResult> {
  if (!entry.nbaId) {
    return {
      playerId,
      status: 'error',
      error: 'No nbaId',
    };
  }

  const outputPath = path.join(HEADSHOTS_DIR, `${playerId}.png`);

  // Check if file exists
  const exists = await fileExists(outputPath);
  if (exists && !OVERWRITE) {
    return {
      playerId,
      status: 'skipped',
      error: 'File exists (use --overwrite to replace)',
    };
  }

  const result = await downloadHeadshot(playerId, entry.nbaId, outputPath);

  if (result.ok) {
    return {
      playerId,
      status: 'ok',
    };
  }

  return {
    playerId,
    status: 'error',
    error: result.error,
  };
}

// ---- Main ----
async function main() {
  console.log('\n📥 Loading player index...');
  const index = await loadPlayerIndex();

  // Filter players
  const players: Array<{ id: string; entry: PlayerIndexEntry }> = [];
  for (const [playerId, entry] of Object.entries(index)) {
    if (FILTER_SET && !FILTER_SET.has(playerId)) continue;
    players.push({ id: playerId, entry });
  }

  if (players.length === 0) {
    console.log('❌ No players matched filters.');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!DRY_RUN) {
    await ensureDir(HEADSHOTS_DIR);
  }

  console.log(
    `\n⚙️  Headshot Downloader\n` +
      `   Players: ${players.length}\n` +
      `   Mode: ${ALL_FLAG || FILTER_SET ? (ALL_FLAG ? '--all' : '--filter') : 'default (all)'}\n` +
      `   Overwrite: ${OVERWRITE}\n` +
      `   Dry run: ${DRY_RUN}\n` +
      `   Concurrency: ${CONCURRENCY}\n` +
      `   Output: ${HEADSHOTS_DIR}\n`
  );

  let inFlight = 0,
    idx = 0;
  let ok = 0,
    skipped = 0,
    failed = 0;
  const errors: Array<{ player: string; error: string }> = [];

  await new Promise<void>((resolveDone) => {
    const next = () => {
      if (idx >= players.length && inFlight === 0) {
        console.log(
          `\n📊 Summary → ok: ${ok}, skipped: ${skipped}, failed: ${failed}`
        );
        if (errors.length > 0) {
          console.log('\n❌ Errors:');
          errors.forEach((e) => console.log(`   ${e.player}: ${e.error}`));
        }
        return resolveDone();
      }
      while (inFlight < CONCURRENCY && idx < players.length) {
        const { id: playerId, entry } = players[idx++];
        inFlight++;
        processPlayer(playerId, entry)
          .then((res) => {
            if (res.status === 'ok') {
              ok++;
              console.log(`✅ ${playerId}${DRY_RUN ? ' (dry-run)' : ''}`);
            } else if (res.status === 'skipped') {
              skipped++;
              console.log(`⏭️  ${playerId}: ${res.error}`);
            } else {
              failed++;
              errors.push({
                player: playerId,
                error: res.error || 'Unknown',
              });
              console.log(`❌ ${playerId}: ${res.error}`);
            }
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

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

