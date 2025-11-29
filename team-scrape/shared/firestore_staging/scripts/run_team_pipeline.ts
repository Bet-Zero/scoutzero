#!/usr/bin/env tsx
/**
 * Combined team pipeline: RealGM draft picks → SalarySwish fetch/parse/stage.
 * Pass teams/season once and it will run both sequentially.
 *
 * Examples:
 *   npm run team:full
 *   npm run team:full -- --teams=LAL,OKC --season=2025-26 --pretty
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PipelineConfig = {
  teams?: string;
  season?: string;
  realgmOutDir: string;
  pretty: boolean;
  delayMs?: number;
  batchSize?: number;
  maxRetries?: number;
  backoffMs?: number;
  backoffMultiplier?: number;
  statsOnly?: boolean;
  validate: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

const REALGM_SCRIPT = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  'scripts',
  'realgm_draft_picks.ts'
);
const TEAM_PIPELINE_SCRIPT = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  'scripts',
  'run_full_team_scrape.ts'
);
const DEFAULT_REALGM_OUT = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  '_artifacts',
  'output'
);

function parseArg(label: string, def?: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${label}`) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(`--${label}=`)) {
      const [, val] = arg.split('=');
      return val ?? 'true';
    }
  }
  return def;
}

function parseTeams(): string | undefined {
  const raw = parseArg('teams');
  if (!raw) return undefined;
  const cleaned = raw
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  return cleaned.length ? cleaned.join(',') : undefined;
}

function parseNumberArg(label: string): number | undefined {
  const raw = parseArg(label);
  if (raw == null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolArg(label: string): boolean | undefined {
  const raw = parseArg(label);
  if (raw == null) return undefined;
  if (raw === 'true' || raw === '1' || raw === '') return true;
  if (raw === 'false' || raw === '0') return false;
  return undefined;
}

async function runStep({
  label,
  cmd,
  args,
  env,
}: {
  label: string;
  cmd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}) {
  console.log(`\n=== ${label} ===`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
  });
}

function buildRealgmArgs(config: PipelineConfig): string[] {
  const args = ['tsx', REALGM_SCRIPT, `--outDir=${config.realgmOutDir}`];
  if (config.teams) {
    args.push(`--teams=${config.teams}`);
  }
  if (config.pretty) {
    args.push('--pretty');
  }
  return args;
}

function buildTeamArgs(config: PipelineConfig): string[] {
  const args = ['tsx', TEAM_PIPELINE_SCRIPT];
  if (config.teams) {
    args.push(`--teams=${config.teams}`);
  }
  if (config.season) {
    args.push(`--season=${config.season}`);
  }
  if (config.delayMs !== undefined) {
    args.push(`--delayMs=${config.delayMs}`);
  }
  if (config.batchSize !== undefined) {
    args.push(`--batchSize=${config.batchSize}`);
  }
  if (config.maxRetries !== undefined) {
    args.push(`--maxRetries=${config.maxRetries}`);
  }
  if (config.backoffMs !== undefined) {
    args.push(`--backoffMs=${config.backoffMs}`);
  }
  if (config.backoffMultiplier !== undefined) {
    args.push(`--backoffMultiplier=${config.backoffMultiplier}`);
  }
  if (config.statsOnly) {
    args.push('--statsOnly');
  }
  if (config.validate) {
    args.push('--validate');
  } else {
    args.push('--validate=false');
  }
  return args;
}

async function main() {
  const config: PipelineConfig = {
    teams: parseTeams(),
    season: parseArg('season'),
    realgmOutDir: parseArg('outDir', DEFAULT_REALGM_OUT)!,
    pretty: parseBoolArg('pretty') === true,
    delayMs: parseNumberArg('delayMs'),
    batchSize: parseNumberArg('batchSize'),
    maxRetries: parseNumberArg('maxRetries'),
    backoffMs: parseNumberArg('backoffMs'),
    backoffMultiplier: parseNumberArg('backoffMultiplier'),
    statsOnly: parseBoolArg('statsOnly') === true,
    validate: parseBoolArg('validate') ?? true,
  };

  console.log(
    `Combined team pipeline\n` +
      `  Teams: ${config.teams ?? 'all'}\n` +
      `  Season: ${config.season ?? 'auto (run_full default)'}\n` +
      `  RealGM outDir: ${config.realgmOutDir}\n` +
      `  Pretty RealGM output: ${config.pretty ? 'yes' : 'no'}\n` +
      `  DelayMs: ${config.delayMs ?? 'default'} | BatchSize: ${config.batchSize ?? 'default'}\n` +
      `  Retries: ${config.maxRetries ?? 'default'} | BackoffMs: ${config.backoffMs ?? 'default'} | x${config.backoffMultiplier ?? 'default'}\n` +
      `  Stats-only: ${config.statsOnly ? 'yes' : 'no'}\n` +
      `  Validate staged payloads: ${config.validate ? 'yes' : 'no'}`
  );

  await runStep({
    label: 'Step 1/2: RealGM draft picks',
    cmd: 'npx',
    args: buildRealgmArgs(config),
    env: {
      OUT_DIR: config.realgmOutDir,
    },
  });

  await runStep({
    label: 'Step 2/2: SalarySwish fetch/parse/stage',
    cmd: 'npx',
    args: buildTeamArgs(config),
  });

  console.log('\n✅ Combined team pipeline finished.');
}

main().catch((err) => {
  console.error('❌ Pipeline failed:', err?.message || err);
  process.exit(1);
});
