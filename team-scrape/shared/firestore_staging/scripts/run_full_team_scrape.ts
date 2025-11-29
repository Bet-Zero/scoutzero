import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type TeamPhase = 'fetch' | 'parse' | 'stage';

interface RunConfig {
  teams: string[];
  delayMs: number;
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  season: string;
  batchSize: number;
  statsOnly: boolean;
  validate: boolean;
}

interface PhaseResult {
  team: string;
  phase: TeamPhase;
  success: boolean;
  attempts: number;
  logPath: string;
  error?: string;
}

const TEAM_SLUGS: Record<string, string> = {
  ATL: 'hawks',
  BOS: 'celtics',
  BKN: 'nets',
  CHA: 'hornets',
  CHI: 'bulls',
  CLE: 'cavaliers',
  DAL: 'mavericks',
  DEN: 'nuggets',
  DET: 'pistons',
  GSW: 'warriors',
  HOU: 'rockets',
  IND: 'pacers',
  LAC: 'clippers',
  LAL: 'lakers',
  MEM: 'grizzlies',
  MIA: 'heat',
  MIL: 'bucks',
  MIN: 'timberwolves',
  NOP: 'pelicans',
  NYK: 'knicks',
  OKC: 'thunder',
  ORL: 'magic',
  PHI: 'sixers',
  PHX: 'suns',
  POR: 'blazers',
  SAC: 'kings',
  SAS: 'spurs',
  TOR: 'raptors',
  UTA: 'jazz',
  WAS: 'wizards',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const PLAYER_INDEX_PATH = path.join(
  PROJECT_ROOT,
  'player-scrape',
  'shared',
  '_artifacts', 'outputs',
  'player_index.json'
);
const LOG_ROOT = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'logs'
);

const FETCH_SCRIPT = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'team-data',
  'scripts',
  'fetch_page.ts'
);
const PARSE_SCRIPT = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'team-data',
  'scripts',
  'parse_team.ts'
);
const STAGE_SCRIPT = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  'stage_team.ts'
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
  const raw = parseArg(label);
  if (raw == null) return def;
  const parsed = Number(raw);
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

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function loadTeams(): Promise<string[]> {
  const raw = await readFile(PLAYER_INDEX_PATH, 'utf8');
  const index = JSON.parse(raw) as Record<string, { teamCode?: string }>;
  const teams = new Set<string>();
  for (const entry of Object.values(index)) {
    if (entry.teamCode && TEAM_SLUGS[entry.teamCode]) {
      teams.add(entry.teamCode);
    }
  }
  return Array.from(teams).sort();
}

function getTeamSlug(team: string): string {
  const slug = TEAM_SLUGS[team];
  if (!slug) {
    throw new Error(`Missing SalarySwish slug for team ${team}`);
  }
  return slug;
}

function buildCommand(
  phase: TeamPhase,
  team: string,
  config: RunConfig
): { cmd: string; args: string[]; env: NodeJS.ProcessEnv } {
  const slug = getTeamSlug(team);
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    TEAM_URL: `https://www.salaryswish.com/teams/${slug}`,
    TEAM_CODE: team,
    SEASON: config.season,
  };

  if (phase === 'fetch') {
    return {
      cmd: 'npx',
      args: ['tsx', FETCH_SCRIPT],
      env: baseEnv,
    };
  }
  if (phase === 'parse') {
    return {
      cmd: 'npx',
      args: ['tsx', PARSE_SCRIPT],
      env: baseEnv,
    };
  }
  const args = [
    'tsx',
    STAGE_SCRIPT,
    `--team=${team}`,
    `--season=${config.season}`,
  ];
  if (config.validate) {
    args.push('--validate');
  }
  return {
    cmd: 'npx',
    args,
    env: {
      ...baseEnv,
      USE_LOCAL_HTML: '1',
    },
  };
}

async function runCommandWithLogging(
  phase: TeamPhase,
  team: string,
  config: RunConfig,
  attempt: number,
  logPath: string
): Promise<{ code: number; stderr: string }> {
  await ensureDir(path.dirname(logPath));
  const writer = createWriteStream(logPath, {
    flags: attempt === 1 ? 'w' : 'a',
  });
  const { cmd, args, env } = buildCommand(phase, team, config);
  const label = `[${phase.toUpperCase()}:${team}] `;
  writer.write(
    `${new Date().toISOString()} :: Attempt ${attempt}\nCommand: ${cmd} ${args.join(
      ' '
    )}\n\n`
  );

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`${label}${text}`);
      writer.write(text);
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      process.stderr.write(`${label}${text}`);
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

async function runPhaseWithRetries(
  phase: TeamPhase,
  team: string,
  config: RunConfig,
  baseLogDir: string,
  attempt = 1
): Promise<PhaseResult> {
  const logPath = path.join(baseLogDir, phase, `${team}.log`);
  const { code, stderr } = await runCommandWithLogging(
    phase,
    team,
    config,
    attempt,
    logPath
  );

  if (code === 0) {
    return {
      team,
      phase,
      success: true,
      attempts: attempt,
      logPath,
    };
  }

  if (attempt >= config.maxRetries) {
    return {
      team,
      phase,
      success: false,
      attempts: attempt,
      logPath,
      error: stderr.trim() || `Command exited with code ${code}`,
    };
  }

  const delay =
    config.backoffMs * Math.pow(config.backoffMultiplier, attempt - 1);
  console.warn(
    `[${phase.toUpperCase()}:${team}] Attempt ${attempt} failed. Retrying in ${delay}ms`
  );
  await sleep(delay);
  return runPhaseWithRetries(
    phase,
    team,
    config,
    baseLogDir,
    attempt + 1
  );
}

async function runPipelineForTeam(
  team: string,
  config: RunConfig,
  baseLogDir: string
): Promise<PhaseResult[]> {
  const phases: TeamPhase[] = ['fetch', 'parse', 'stage'];
  const results: PhaseResult[] = [];

  for (const phase of phases) {
    const result = await runPhaseWithRetries(phase, team, config, baseLogDir);
    results.push(result);
    if (!result.success) {
      return results;
    }
    if (config.delayMs > 0 && phase !== 'stage') {
      await sleep(config.delayMs);
    }
  }

  return results;
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
  dir: string,
  label: string,
  results: PhaseResult[]
) {
  const summaryPath = path.join(dir, `${label}.summary.json`);
  await writeFile(
    summaryPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        results,
      },
      null,
      2
    )
  );
}

async function main() {
  const teams = await loadTeams();
  const filter = parseTeamFilter();
  const selected = filter
    ? teams.filter((team) => filter.includes(team))
    : teams;

  if (!selected.length) {
    console.log('No teams matched filters. Exiting.');
    return;
  }

  const now = new Date();
  const runDir = path.join(
    LOG_ROOT,
    now.toISOString().replace(/[:.]/g, '-')
  );
  await ensureDir(path.join(runDir, 'fetch'));
  await ensureDir(path.join(runDir, 'parse'));
  await ensureDir(path.join(runDir, 'stage'));

  const config: RunConfig = {
    teams: selected,
    delayMs: parseNumberArg('delayMs', 1500),
    maxRetries: parseNumberArg('maxRetries', 3),
    backoffMs: parseNumberArg('backoffMs', 2000),
    backoffMultiplier: parseNumberArg('backoffMultiplier', 2),
    season: parseArg('season', `${now.getFullYear()}-${(now.getFullYear() + 1)
      .toString()
      .slice(-2)}`) as string,
    batchSize: parseNumberArg('batchSize', 3),
    statsOnly: parseBoolArg('statsOnly', false),
    validate: parseBoolArg('validate', true),
  };

  console.log(
    `\n=== Team SalarySwish Scrape ===\n` +
      `Teams: ${config.teams.length}\n` +
      `Season: ${config.season}\n` +
      `Batch size: ${config.batchSize}\n` +
      `Delay between phases: ${config.delayMs}ms\n` +
      `Max retries: ${config.maxRetries}\n` +
      `Backoff: ${config.backoffMs}ms x${config.backoffMultiplier}\n` +
      `Validate staged payloads: ${config.validate ? 'yes' : 'no'}\n` +
      `Log dir: ${runDir}\n`
  );

  const batches = chunk(config.teams, config.batchSize);
  const allResults: PhaseResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n--- Team batch ${i + 1}/${batches.length} ---`);
    for (const team of batch) {
      console.log(`\n▶︎ Processing ${team}`);
      const results = await runPipelineForTeam(team, config, runDir);
      allResults.push(...results);
      const failed = results.find((r) => !r.success);
      if (failed) {
        console.warn(
          `⚠️  Halting ${team} pipeline due to ${failed.phase} failure. See ${failed.logPath}`
        );
      } else {
        console.log(`✅ Completed ${team}`);
      }
      if (config.delayMs > 0) {
        await sleep(config.delayMs);
      }
    }
    await writeSummary(runDir, `batch-${i + 1}`, allResults);
  }

  await writeSummary(runDir, 'run', allResults);

  const failures = allResults.filter((r) => !r.success);
  if (failures.length) {
    console.log('\n❌ Failures encountered:');
    for (const failure of failures) {
      console.log(
        ` - ${failure.team} (${failure.phase}) attempts=${failure.attempts}\n   ↳ ${failure.error ?? 'Unknown error'}\n   ↳ log: ${failure.logPath}`
      );
    }
    process.exitCode = 1;
  } else {
    console.log('\n✅ Team scrape completed successfully.');
  }
}

main().catch((err) => {
  console.error('Fatal error during team scrape:', err);
  process.exit(1);
});
