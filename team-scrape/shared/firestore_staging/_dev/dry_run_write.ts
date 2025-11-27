#!/usr/bin/env tsx
/**
 * dry_run_write.ts
 *
 * Prints the staged `/architect/baseTeams/{teamCode}` payloads so we can review
 * what would be written to Firestore without performing any writes.
 *
 * Mirrors the player-facing dry-run helper in
 * `player-scrape/firestore_staging/dry_run_write.ts`.
 */

import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

type CliArgs = {
  teams?: string[];
  stageDir?: string;
};

const SCRIPT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const DEFAULT_OUTPUT_DIR = path.join(SCRIPT_ROOT, '_artifacts', 'output');

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (const token of process.argv.slice(2)) {
    if (token.startsWith('--teams=')) {
      const list = token.split('=')[1];
      args.teams = list
        .split(',')
        .map((team) => team.trim().toUpperCase())
        .filter(Boolean);
    }

    if (token.startsWith('--stageDir=')) {
      args.stageDir = path.resolve(process.cwd(), token.split('=')[1] ?? '');
    }
  }

  return args;
}

async function listTeamCodes(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/i, '').toUpperCase())
    .sort();
}

async function gatherTeams(
  targetTeams: string[],
  baseTeamsDir: string
): Promise<Record<string, Array<{ path: string; data: unknown }>>> {
  const result: Record<string, Array<{ path: string; data: unknown }>> = {};

  for (const teamCode of targetTeams) {
    const filePath = path.join(baseTeamsDir, `${teamCode}.json`);
    const doc = await loadJson<unknown>(filePath);

    result[teamCode] = [
      {
        path: `architect/baseTeams/${teamCode}`,
        data: doc,
      },
    ];
  }

  return result;
}

async function main() {
  const args = parseArgs();
  const outputDir = args.stageDir ?? DEFAULT_OUTPUT_DIR;
  const baseTeamsDir = path.join(outputDir, 'baseTeams');

  const allTeams = await listTeamCodes(baseTeamsDir);
  const targetTeams = args.teams?.length ? args.teams : allTeams;

  if (!targetTeams.length) {
    console.error(
      'No staged teams found. Run the staging script first (npm run stage:team).'
    );
    process.exit(1);
  }

  const data = await gatherTeams(targetTeams, baseTeamsDir);

  for (const teamCode of targetTeams) {
    const ops = data[teamCode] ?? [];
    console.log(`\n=== ${teamCode} ===`);
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

