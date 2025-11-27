import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
  appendFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type CliFlag = string | number | boolean | undefined;

type Phase = 'contracts' | 'stats';

type TeamJobSummary = {
  team: string;
  phase: Phase;
  attempts: number;
  success: boolean;
  logPath: string;
  error?: string;
};

interface RunConfig {
  teams: string[];
  batchSize: number;
  concurrency: number;
  resume: boolean;
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  contractsOnly: boolean;
  statsOnly: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PLAYER_SCRAPE_ROOT = path.join(PROJECT_ROOT, 'player-scrape');
const INDEX_PATH = path.join(
  PLAYER_SCRAPE_ROOT,
  'shared',
  '_artifacts', 'outputs',
  'player_index.json'
);
const LOG_ROOT = path.join(PLAYER_SCRAPE_ROOT, 'logs');
const CONTRACT_SCRIPT = path.join(
  PLAYER_SCRAPE_ROOT,
  'contracts',
  'scripts',
  'run_contracts.ts'
);
const STATS_SCRIPT = path.join(
  PLAYER_SCRAPE_ROOT,
  'stats',
  'scripts',
  'run_stats_batch.ts'
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

function parseNumberArg(label: string, def: number): number {
  const val = parseArg(label);
  if (val == null) return def;
  const parsed = Number(val);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : def;
}

function parseBoolArg(label: string, def = false): boolean {
  const raw = parseArg(label);
  if (raw == null) return def;
  if (raw === 'true' || raw === '1' || raw === '') return true;
  if (raw === 'false' || raw === '0') return false;
  return def;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const batches: T[][] = [];
  let idx = 0;
  while (idx < items.length) {
    batches.push(items.slice(idx, idx + size));
    idx += size;
  }
  return batches;
}

async function loadTeams(): Promise<string[]> {
  const raw = await readFile(INDEX_PATH, 'utf8');
  const index = JSON.parse(raw) as Record<string, { teamCode?: string }>;
  const teams = new Set<string>();
  for (const entry of Object.values(index)) {
    if (entry.teamCode) teams.add(entry.teamCode);
  }
  return Array.from(teams).sort();
}

function buildCommandArgs(
  phase: Phase,
  team: string,
  config: RunConfig
): string[] {
  const args: string[] = ['tsx'];
  if (phase === 'contracts') {
    args.push(CONTRACT_SCRIPT, `--team=${team}`, `--concurrency=${config.concurrency}`);
    if (config.resume) args.push('--resume');
  } else {
    args.push(STATS_SCRIPT, `--team=${team}`, `--concurrency=${config.concurrency}`);
  }
  return args;
}

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

function formatPhaseLabel(phase: Phase) {
  return phase === 'contracts' ? 'Contracts' : 'Stats';
}

async function runCommandWithLogging(
  phase: Phase,
  team: string,
  args: string[],
  logPath: string,
  attempt: number
): Promise<{ code: number; stderr: string }> {
  await ensureDir(path.dirname(logPath));
  const writer = createWriteStream(logPath, {
    flags: attempt === 1 ? 'w' : 'a',
  });
  const prefix = `[${formatPhaseLabel(phase)}:${team}] `;
  writer.write(
    `${new Date().toISOString()} :: Attempt ${attempt}\nCommand: npx ${args.join(
      ' '
    )}\n\n`
  );

  return new Promise((resolve) => {
    const child = spawn('npx', args, {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`${prefix}${text}`);
      writer.write(text);
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      process.stderr.write(`${prefix}${text}`);
      writer.write(text);
      stderr += text;
    });

    child.on('close', (code) => {
      writer.write(`\n${new Date().toISOString()} :: Exit code ${code ?? -1}\n`);
      writer.end();
      resolve({ code: code ?? -1, stderr });
    });
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhaseForTeam(
  phase: Phase,
  team: string,
  config: RunConfig,
  attempt = 1,
  logDir: string
): Promise<TeamJobSummary> {
  const args = buildCommandArgs(phase, team, config);
  const logPath = path.join(
    logDir,
    phase,
    `${team}.log`
  );
  const result = await runCommandWithLogging(phase, team, args, logPath, attempt);
  const success = result.code === 0;
  if (success) {
    return { team, phase, attempts: attempt, success: true, logPath };
  }

  if (attempt >= config.maxRetries) {
    return {
      team,
      phase,
      attempts: attempt,
      success: false,
      logPath,
      error: result.stderr.trim() || `Command exited with code ${result.code}`,
    };
  }

  const delay =
    config.backoffMs * Math.pow(config.backoffMultiplier, attempt - 1);
  console.warn(
    `[${formatPhaseLabel(phase)}:${team}] Retry ${attempt}/${config.maxRetries} failed. Waiting ${delay}ms`
  );
  await appendFile(
    logPath,
    `\n${new Date().toISOString()} :: Failed attempt ${attempt}. Sleeping ${delay}ms before retry.\n`
  );
  await sleep(delay);
  return runPhaseForTeam(phase, team, config, attempt + 1, logDir);
}

async function runBatch(
  phase: Phase,
  teams: string[],
  config: RunConfig,
  logDir: string
): Promise<TeamJobSummary[]> {
  const summaries: TeamJobSummary[] = [];
  for (const team of teams) {
    const summary = await runPhaseForTeam(phase, team, config, 1, logDir);
    summaries.push(summary);
  }
  return summaries;
}

function parseTeamFilter(): string[] | undefined {
  const raw = parseArg('teams');
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

async function writeSummary(
  logDir: string,
  summaries: TeamJobSummary[],
  label: string
) {
  const summaryPath = path.join(logDir, `${label}.summary.json`);
  await writeFile(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), summaries }, null, 2));
}

async function main() {
  const availableTeams = await loadTeams();
  const teamFilter = parseTeamFilter();
  const selectedTeams = teamFilter
    ? availableTeams.filter((team) => teamFilter.includes(team))
    : availableTeams;

  if (!selectedTeams.length) {
    console.log('No teams matched filters. Exiting.');
    return;
  }

  const config: RunConfig = {
    teams: selectedTeams,
    batchSize: parseNumberArg('batchSize', 4),
    concurrency: parseNumberArg('concurrency', 6),
    resume: parseBoolArg('resume', true),
    maxRetries: parseNumberArg('maxRetries', 4),
    backoffMs: parseNumberArg('backoffMs', 2000),
    backoffMultiplier: parseNumberArg('backoffMultiplier', 2),
    contractsOnly: parseBoolArg('contractsOnly', false),
    statsOnly: parseBoolArg('statsOnly', false),
  };

  await ensureDir(LOG_ROOT);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runLogDir = path.join(LOG_ROOT, timestamp);
  await ensureDir(path.join(runLogDir, 'contracts'));
  await ensureDir(path.join(runLogDir, 'stats'));

  console.log(
    `\n=== Player Full-League Scrape ===\n` +
      `Teams: ${config.teams.length}\n` +
      `Batch size: ${config.batchSize}\n` +
      `Concurrency: ${config.concurrency}\n` +
      `Resume enabled: ${config.resume}\n` +
      `Max retries: ${config.maxRetries}\n` +
      `Backoff: ${config.backoffMs}ms x${config.backoffMultiplier}\n` +
      `Contracts only: ${config.contractsOnly}\n` +
      `Stats only: ${config.statsOnly}\n` +
      `Log dir: ${runLogDir}\n`
  );

  const batches = chunk(config.teams, config.batchSize);
  const allSummaries: TeamJobSummary[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batchTeams = batches[i];
    console.log(
      `\n--- Batch ${i + 1}/${batches.length} (${batchTeams.join(', ')}) ---`
    );

    if (!config.statsOnly) {
      const contractSummaries = await runBatch(
        'contracts',
        batchTeams,
        config,
        runLogDir
      );
      allSummaries.push(...contractSummaries);
      await writeSummary(runLogDir, contractSummaries, `batch-${i + 1}-contracts`);
    }

    if (!config.contractsOnly) {
      const statsSummaries = await runBatch(
        'stats',
        batchTeams,
        config,
        runLogDir
      );
      allSummaries.push(...statsSummaries);
      await writeSummary(runLogDir, statsSummaries, `batch-${i + 1}-stats`);
    }
  }

  await writeSummary(runLogDir, allSummaries, 'run');

  const failed = allSummaries.filter((summary) => !summary.success);
  if (failed.length) {
    console.log('\n❌ Failures encountered:');
    for (const failure of failed) {
      console.log(
        ` - ${failure.phase.toUpperCase()} ${failure.team} (attempts: ${
          failure.attempts
        })\n   ↳ ${failure.error ?? 'Unknown error'}\n   ↳ log: ${
          failure.logPath
        }`
      );
    }
    process.exitCode = 1;
  } else {
    console.log('\n✅ All teams processed successfully.');
  }
}

main().catch((err) => {
  console.error('Fatal error running full scrape:', err);
  process.exit(1);
});

