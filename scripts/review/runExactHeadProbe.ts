import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface ProbeArguments {
  candidate: string;
  fixture: string;
  fixtureArgs: string[];
}

const EXACT_SHA = /^[0-9a-f]{40}$/;

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function parseProbeArguments(argv: string[]): ProbeArguments {
  const separator = argv.indexOf('--');
  const helperArgs = separator === -1 ? argv : argv.slice(0, separator);
  const fixtureArgs = separator === -1 ? [] : argv.slice(separator + 1);
  let candidate = '';
  let fixture = '';

  for (let index = 0; index < helperArgs.length; index += 1) {
    const arg = helperArgs[index];
    if (arg === '--candidate') candidate = helperArgs[++index] ?? '';
    else if (arg === '--fixture') fixture = helperArgs[++index] ?? '';
    else throw new Error(`Unknown probe argument: ${arg}`);
  }

  if (!EXACT_SHA.test(candidate)) {
    throw new Error(
      '--candidate must be one exact 40-character lowercase commit SHA'
    );
  }
  if (!fixture) throw new Error('--fixture is required');
  return { candidate, fixture, fixtureArgs };
}

function safeProbeEnvironment(
  candidate: string,
  probeRoot: string
): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(GOOGLE_APPLICATION_CREDENTIALS|FIREBASE_CONFIG)$/i.test(key) ||
      /^VITE_FIREBASE_/i.test(key) ||
      /^(GOOGLE|GCP|GCLOUD|FIREBASE).*?(CREDENTIAL|TOKEN|KEY|SECRET|ACCOUNT)/i.test(
        key
      )
    ) {
      delete env[key];
    }
  }

  return {
    ...env,
    NODE_ENV: 'test',
    VITE_ARCHITECT_REVIEW_MODE: 'true',
    VITE_USE_FIREBASE_EMULATORS: 'true',
    VITE_FIREBASE_PROJECT_ID: 'demo-architect-review',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    GCLOUD_PROJECT: 'demo-architect-review',
    FIREBASE_PROJECT_ID: 'demo-architect-review',
    SCOUTZERO_REVIEW_CANDIDATE: candidate,
    SCOUTZERO_REVIEW_PROBE_ROOT: probeRoot,
    SCOUTZERO_REVIEW_PROBE_NO_DURABLE_WRITES: 'true',
  };
}

export function runExactHeadProbe(args: ProbeArguments): number {
  const repoRoot = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  const resolvedCandidate = git(repoRoot, [
    'rev-parse',
    '--verify',
    `${args.candidate}^{commit}`,
  ]);
  if (resolvedCandidate !== args.candidate) {
    throw new Error(
      `Candidate mismatch: requested ${args.candidate}, resolved ${resolvedCandidate}`
    );
  }

  const fixtureSource = path.resolve(args.fixture);
  if (!fs.statSync(fixtureSource, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Probe fixture does not exist: ${fixtureSource}`);
  }

  const sourceStatus = git(repoRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'scoutzero-review-probe-')
  );
  const snapshotRoot = path.join(tempRoot, 'candidate');
  const archivePath = path.join(tempRoot, 'candidate.tar');
  fs.mkdirSync(snapshotRoot);

  process.stdout.write(`Exact candidate: ${resolvedCandidate}\n`);
  process.stdout.write(`Temporary probe root: ${snapshotRoot}\n`);

  let probeStatus: number | undefined;
  let primaryError: unknown;
  let cleanupError: unknown;
  try {
    execFileSync(
      'git',
      ['archive', '--format=tar', `--output=${archivePath}`, resolvedCandidate],
      {
        cwd: repoRoot,
        stdio: ['ignore', 'ignore', 'pipe'],
      }
    );
    execFileSync('tar', ['-xf', archivePath, '-C', snapshotRoot], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const nodeModules = path.join(repoRoot, 'node_modules');
    if (!fs.statSync(nodeModules, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(
        'node_modules is required; run npm install before reviewer probes'
      );
    }
    const candidateLock = git(repoRoot, [
      'rev-parse',
      `${resolvedCandidate}:package-lock.json`,
    ]);
    const checkedOutLock = execFileSync(
      'git',
      ['hash-object', 'package-lock.json'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    ).trim();
    if (candidateLock !== checkedOutLock) {
      throw new Error(
        'Candidate package-lock.json differs from the checked-out lockfile; checkout the candidate and run npm ci before this exact-source probe'
      );
    }
    fs.symlinkSync(nodeModules, path.join(snapshotRoot, 'node_modules'), 'dir');

    const fixtureDir = path.join(snapshotRoot, '.review-probe');
    fs.mkdirSync(fixtureDir);
    const extension = path.extname(fixtureSource) || '.ts';
    const fixtureTarget = path.join(fixtureDir, `probe${extension}`);
    fs.copyFileSync(fixtureSource, fixtureTarget);
    fs.writeFileSync(
      path.join(fixtureDir, 'candidate.json'),
      `${JSON.stringify({ candidate: resolvedCandidate }, null, 2)}\n`,
      'utf8'
    );

    const tsxBinary = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
    const result = spawnSync(tsxBinary, [fixtureTarget, ...args.fixtureArgs], {
      cwd: snapshotRoot,
      env: safeProbeEnvironment(resolvedCandidate, snapshotRoot),
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    probeStatus = result.status ?? 1;
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch (error) {
      cleanupError = error;
    }
  }

  let worktreeError: unknown;
  try {
    const finalStatus = git(repoRoot, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ]);
    if (finalStatus !== sourceStatus) {
      throw new Error(
        'Reviewer probe changed the source worktree; cleanup or concurrent-write investigation is required'
      );
    }
  } catch (error) {
    worktreeError = error;
  }

  const failures = [primaryError, cleanupError, worktreeError].filter(
    (error): error is NonNullable<typeof error> => error != null
  );
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      'Reviewer probe failed with multiple execution or cleanup errors'
    );
  }

  process.stdout.write(
    'Cleaned temporary probe workspace; source worktree unchanged.\n'
  );
  return probeStatus ?? 1;
}

function isMainModule(): boolean {
  return (
    Boolean(process.argv[1]) &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  try {
    const code = runExactHeadProbe(parseProbeArguments(process.argv.slice(2)));
    process.exitCode = code;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
