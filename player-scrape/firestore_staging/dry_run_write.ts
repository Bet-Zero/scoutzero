import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

interface CliArgs {
  players?: string[];
  stageDir?: string;
}

const SCRIPT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const DEFAULT_OUTPUT_DIR = path.join(SCRIPT_ROOT, 'output');

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const token of process.argv.slice(2)) {
    if (token.startsWith('--players=')) {
      const list = token.split('=')[1];
      args.players = list.split(',').map((p) => p.trim()).filter(Boolean);
    }
    if (token.startsWith('--stageDir=')) {
      args.stageDir = path.resolve(process.cwd(), token.split('=')[1]);
    }
  }
  return args;
}

async function listPlayerIds(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/, ''))
    .sort();
}

async function gatherPlayers(
  targetIds: string[],
  playersV2Dir: string,
  basePlayersDir: string
): Promise<Record<string, Array<{ path: string; data: unknown }>>> {
  const result: Record<string, Array<{ path: string; data: unknown }>> = {};

  for (const playerId of targetIds) {
    const ops: Array<{ path: string; data: unknown }> = [];
    const playersV2Path = path.join(playersV2Dir, `${playerId}.json`);
    const basePlayersPath = path.join(basePlayersDir, `${playerId}.json`);

    const playersV2 = await loadJson<any>(playersV2Path);
    const basePlayers = await loadJson<any>(basePlayersPath);

    ops.push({ path: `players_v2/${playerId}`, data: playersV2.doc });

    if (playersV2.contracts) {
      for (const [contractId, payload] of Object.entries(playersV2.contracts)) {
        ops.push({ path: `players_v2/${playerId}/contracts/${contractId}`, data: payload });
      }
    }

    if (playersV2.seasons) {
      for (const [seasonId, payload] of Object.entries(playersV2.seasons)) {
        ops.push({ path: `players_v2/${playerId}/seasons/${seasonId}`, data: payload });
      }
    }

    if (playersV2.views?.contracts) {
      ops.push({ path: `players_v2/${playerId}/views/contracts`, data: playersV2.views.contracts });
    }

    ops.push({ path: `architect/basePlayers/${playerId}`, data: basePlayers });

    result[playerId] = ops;
  }

  return result;
}

async function main() {
  const args = parseArgs();
  const outputDir = args.stageDir ?? DEFAULT_OUTPUT_DIR;
  const playersV2Dir = path.join(outputDir, 'players_v2');
  const basePlayersDir = path.join(outputDir, 'basePlayers');

  const allPlayers = await listPlayerIds(playersV2Dir);
  const targetPlayers = args.players?.length ? args.players : allPlayers;

  const data = await gatherPlayers(targetPlayers, playersV2Dir, basePlayersDir);

  for (const playerId of targetPlayers) {
    const ops = data[playerId] ?? [];
    console.log(`\n=== ${playerId} ===`);
    for (const op of ops) {
      console.log(`\n→ ${op.path}`);
      console.log(JSON.stringify(op.data, null, 2));
    }
  }
}

main().catch((err) => {
  console.error('Dry-run failed:', err);
  process.exit(1);
});
