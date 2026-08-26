import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROOF_SPEC = 'tests/e2e/architect-trade-receipt-proof.spec.ts';
const PROOF_PORTS = [5173, 8082, 9099, 5001, 4001, 4400, 4500, 9150];

interface ProofIdentity {
  repoRoot: string;
  candidate: string;
  upstream: string;
  originMain: string;
  mergeBase: string;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function resolveProofIdentity(cwd = process.cwd()): ProofIdentity {
  const repoRoot = git(cwd, ['rev-parse', '--show-toplevel']);
  const status = git(repoRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  if (status) {
    throw new Error(
      'Trade Receipt proof requires a clean frozen candidate; commit or remove all source-worktree changes first'
    );
  }

  const candidate = git(repoRoot, ['rev-parse', 'HEAD']);
  let upstream: string;
  let pushedCandidate: string;
  try {
    upstream = git(repoRoot, [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{upstream}',
    ]);
    pushedCandidate = git(repoRoot, ['rev-parse', '--verify', '@{upstream}']);
  } catch {
    throw new Error(
      'Trade Receipt proof requires a pushed exact candidate with a configured upstream branch'
    );
  }
  if (pushedCandidate !== candidate) {
    throw new Error(
      `Trade Receipt proof requires HEAD ${candidate} to equal pushed upstream ${upstream} at ${pushedCandidate}`
    );
  }

  let originMain: string;
  let mergeBase: string;
  try {
    originMain = git(repoRoot, ['rev-parse', '--verify', 'origin/main']);
    mergeBase = git(repoRoot, ['merge-base', candidate, originMain]);
  } catch {
    throw new Error(
      'Trade Receipt proof requires a resolvable origin/main and shared merge base; run git fetch origin main first'
    );
  }
  return { repoRoot, candidate, upstream, originMain, mergeBase };
}

function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findFiles(root: string, name: string): string[] {
  if (!fs.existsSync(root)) return [];
  const matches: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) matches.push(...findFiles(entryPath, name));
    else if (entry.name === name) matches.push(entryPath);
  }
  return matches;
}

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(400);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitForCleanTeardown(): Promise<number[]> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const states = await Promise.all(PROOF_PORTS.map(portIsOpen));
    const open = PROOF_PORTS.filter((_, index) => states[index]);
    if (open.length === 0) return [];
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  const states = await Promise.all(PROOF_PORTS.map(portIsOpen));
  return PROOF_PORTS.filter((_, index) => states[index]);
}

async function openProofPorts(): Promise<number[]> {
  const states = await Promise.all(PROOF_PORTS.map(portIsOpen));
  return PROOF_PORTS.filter((_, index) => states[index]);
}

export async function runTradeReceiptProof(): Promise<number> {
  const identity = resolveProofIdentity();
  const artifactDir = path.join(
    identity.repoRoot,
    'tmp',
    'browser-proofs',
    'trade-receipt',
    `${identity.candidate}-${timestampSlug()}`
  );
  const testResultsDir = path.join(artifactDir, 'test-results');
  const reportDir = path.join(artifactDir, 'html-report');

  const playwrightBinary = path.join(
    identity.repoRoot,
    'node_modules',
    '.bin',
    'playwright'
  );
  if (!fs.existsSync(playwrightBinary)) {
    throw new Error('Playwright is unavailable; run npm install first');
  }

  const baselinePorts = await openProofPorts();
  if (baselinePorts.length > 0) {
    throw new Error(
      `Trade Receipt proof requires its local harness ports to be free before startup; close listeners on: ${baselinePorts.join(', ')}`
    );
  }
  fs.mkdirSync(artifactDir, { recursive: true });

  const commandArgs = [
    'test',
    PROOF_SPEC,
    '--workers=1',
    '--project=chromium',
    '--reporter=line,html',
    `--output=${testResultsDir}`,
  ];
  const startedAt = new Date().toISOString();
  process.stdout.write(`Exact candidate: ${identity.candidate}\n`);
  process.stdout.write(`Artifact directory: ${artifactDir}\n`);

  const result = spawnSync(playwrightBinary, commandArgs, {
    cwd: identity.repoRoot,
    env: {
      ...process.env,
      PLAYWRIGHT_ARCHITECT_REVIEW_MODE: 'true',
      PLAYWRIGHT_HTML_OUTPUT_DIR: reportDir,
      PLAYWRIGHT_HTML_OPEN: 'never',
      VITE_SHOW_TRADE_RECEIPT: 'true',
      SCOUTZERO_PROOF_CANDIDATE: identity.candidate,
      SCOUTZERO_BROWSER_PROOF_DIR: artifactDir,
    },
    stdio: 'inherit',
  });

  const openPorts = await waitForCleanTeardown();
  const screenshotPath = path.join(artifactDir, 'trade-receipt-1280x720.png');
  const proofPath = path.join(artifactDir, 'proof.json');
  const tracePaths = findFiles(testResultsDir, 'trace.zip');
  const reportPath = path.join(reportDir, 'index.html');
  const passed =
    result.status === 0 &&
    fs.existsSync(screenshotPath) &&
    fs.existsSync(proofPath) &&
    tracePaths.length > 0 &&
    fs.existsSync(reportPath) &&
    openPorts.length === 0;

  const manifest = {
    schemaVersion: 1,
    proof: 'Architect Trade Machine / Trade Receipt',
    base: identity.originMain,
    candidate: identity.candidate,
    upstream: identity.upstream,
    mergeBase: identity.mergeBase,
    viewport: { width: 1280, height: 720 },
    command: `npm run architect:proof:trade-receipt`,
    playwright: commandArgs,
    startedAt,
    completedAt: new Date().toISOString(),
    result: passed ? 'PASS' : 'FAIL',
    processStatus: result.status,
    processSignal: result.signal,
    teardown: {
      checkedPorts: PROOF_PORTS,
      baselinePorts,
      openPorts,
      clean: openPorts.length === 0,
    },
    artifacts: {
      screenshot: fs.existsSync(screenshotPath)
        ? {
            path: path.relative(identity.repoRoot, screenshotPath),
            sha256: hashFile(screenshotPath),
          }
        : null,
      trace: tracePaths.map((tracePath) => ({
        path: path.relative(identity.repoRoot, tracePath),
        sha256: hashFile(tracePath),
      })),
      report: fs.existsSync(reportPath)
        ? path.relative(identity.repoRoot, reportPath)
        : null,
      proof: fs.existsSync(proofPath)
        ? {
            path: path.relative(identity.repoRoot, proofPath),
            sha256: hashFile(proofPath),
          }
        : null,
    },
    retention:
      'Local ignored artifact retained at this exact path; no hosted artifact retention is claimed.',
  };
  fs.writeFileSync(
    path.join(artifactDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(
    `Manifest: ${path.join(artifactDir, 'manifest.json')}\n`
  );
  if (!passed) {
    if (openPorts.length > 0) {
      process.stderr.write(
        `Proof teardown left listeners on ports: ${openPorts.join(', ')}\n`
      );
    }
    return result.status || 1;
  }
  return 0;
}

function isMainModule(): boolean {
  return (
    Boolean(process.argv[1]) &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  runTradeReceiptProof()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    });
}
