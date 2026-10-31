import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { startSeasonProofHarness } from './seasonProofHarness';

const PROOF_SPEC = 'tests/e2e/architect-trade-receipt-proof.spec.ts';
const PROOF_PORTS = [5173, 8082, 9099, 5001, 4001, 4400, 4500, 9150];

export const APRON_MULTISEASON_SCREENSHOTS = [
  'penalty',
  'earliest-release',
  'latest-release',
]
  .flatMap((mode) => [
    ...[2027, 2028, 2029, 2030, 2031].map((year) => `${mode}-season-${year}`),
    `${mode}-trade`,
    `${mode}-2028-cap`,
    `${mode}-2028-fullcap`,
    ...['TOR', 'MIA'].flatMap((team) =>
      ['cap', 'fullcap', 'history', 'compare', 'assets'].map(
        (state) => `${mode}-${team}-${state}`
      )
    ),
  ])
  .map((key) => ({ key, filename: `${key}-1280x720.png` }));

export const APRON_FREEZE_SCREENSHOTS = ['frozen', 'equality']
  .flatMap((mode) => [
    ...[
      'before',
      'frozen',
      'permitted',
      ...(mode === 'frozen' ? ['blocked'] : []),
    ].map((state) => `${mode}-${state}`),
    ...['TOR', 'MIA'].flatMap((team) =>
      ['history', 'compare', 'reload', 'assets'].map(
        (state) => `${mode}-${team}-${state}`
      )
    ),
  ])
  .map((key) => ({ key, filename: `${key}-1280x720.png` }));

export const SWAP_LIFECYCLE_SCREENSHOTS = ['exercise', 'waive']
  .flatMap((choice) => [
    ...['proposal', 'export', 'draft', 'season'].map(
      (state) => `${choice}-${state}`
    ),
    ...['WAS', 'MIA', 'PHX', 'ORL'].flatMap((team) =>
      ['history', 'compare', 'reload', 'assets'].map(
        (state) => `${choice}-${team}-${state}`
      )
    ),
  ])
  .map((key) => ({ key, filename: `${key}-1280x720.png` }));

export const CONDITIONAL_LIFECYCLE_SCREENSHOTS = [
  ...[10, 11].flatMap((position) => [
    `${position}-proposal`,
    `${position}-draft`,
    `${position}-season`,
    ...['TOR', 'MIA'].flatMap((team) =>
      ['history', 'compare', 'reload'].map(
        (state) => `${position}-${team}-${state}`
      )
    ),
  ]),
].map((key) => ({ key, filename: `${key}-1280x720.png` }));

export const RETAINED_SIMULATION_SCREENSHOTS = [
  'permitted-proposal',
  ...['CHI', 'TOR'].flatMap((team) =>
    ['history', 'compare', 'reload'].map((state) => `${team}-${state}`)
  ),
].map((key) => ({ key, filename: `${key}-1280x720.png` }));

export const REAL_DRAFT_SCREENSHOTS = [
  'supported',
  'wrong-holder',
  'alias',
  'apron',
  'future',
  'reload',
  'loading',
  'date-mismatch',
  'unavailable',
].map((key) => ({ key, filename: `${key}-1280x720.png` }));

export const DRAFT_REVIEW_SCREENSHOTS = ['bos', 'mia'].flatMap((team) =>
  ['history', 'compare', 'reload'].map((state) => ({
    key: `${team}-${state}`,
    filename: `${team}-${state}-1280x720.png`,
  }))
);
type ScreenshotDefinition = { key: string; filename: string };

export const GOVERNED_TRADE_RECEIPT_SCREENSHOTS = [
  { key: 'screenshot', filename: 'trade-receipt-1280x720.png' },
  {
    key: 'stepienNeedsInputScreenshot',
    filename: 'stepien-needs-input-1280x720.png',
  },
  {
    key: 'foreignHardCapLedgerFailClosedScreenshot',
    filename: 'foreign-hard-cap-ledger-fail-closed-1280x720.png',
  },
  {
    key: 'tradeBonusNeedsInputScreenshot',
    filename: 'trade-bonus-needs-input-1280x720.png',
  },
  {
    key: 'tradeCashLegalScreenshot',
    filename: 'trade-cash-legal-1280x720.png',
  },
  {
    key: 'fullRosterBooksReloadScreenshot',
    filename: 'full-roster-books-reload-1280x720.png',
  },
  {
    key: 'tradeCashHistoryReloadScreenshot',
    filename: 'trade-cash-history-reload-1280x720.png',
  },
  {
    key: 'tradeCashCompareReloadScreenshot',
    filename: 'trade-cash-compare-reload-1280x720.png',
  },
] as const;

interface ScreenshotReceipt {
  path: string;
  sha256: string;
}

export type GovernedScreenshotArtifacts = Record<
  string,
  ScreenshotReceipt | null
>;

interface GovernedScreenshotVerification {
  valid: boolean;
  errors: string[];
}

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

export function collectGovernedScreenshotArtifacts(
  artifactDir: string,
  repoRoot: string,
  definitions: readonly ScreenshotDefinition[] = GOVERNED_TRADE_RECEIPT_SCREENSHOTS
): GovernedScreenshotArtifacts {
  return Object.fromEntries(
    definitions.map(({ key, filename }) => {
      const filePath = path.join(artifactDir, filename);
      return [
        key,
        fs.existsSync(filePath) && fs.statSync(filePath).isFile()
          ? {
              path: path.relative(repoRoot, filePath),
              sha256: hashFile(filePath),
            }
          : null,
      ];
    })
  ) as GovernedScreenshotArtifacts;
}

export async function verifyGovernedScreenshotArtifacts(
  artifactDir: string,
  repoRoot: string,
  artifacts: GovernedScreenshotArtifacts,
  definitions: readonly ScreenshotDefinition[] = GOVERNED_TRADE_RECEIPT_SCREENSHOTS
): Promise<GovernedScreenshotVerification> {
  const errors: string[] = [];
  const expectedKeys = definitions.map(({ key }) => key);
  const actualKeys = Object.keys(artifacts);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    errors.push(
      `governed screenshot manifest keys must be exactly: ${expectedKeys.join(', ')}`
    );
  }

  const recordedPaths = new Set<string>();
  for (const { key, filename } of definitions) {
    const receipt = artifacts[key];
    if (!receipt) {
      errors.push(`${filename} is missing`);
      continue;
    }

    const filePath = path.join(artifactDir, filename);
    const expectedPath = path.relative(repoRoot, filePath);
    if (receipt.path !== expectedPath) {
      errors.push(`${filename} has an unexpected manifest path`);
    }
    if (recordedPaths.has(receipt.path)) {
      errors.push(`${filename} duplicates another screenshot manifest path`);
    }
    recordedPaths.add(receipt.path);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      errors.push(`${filename} is unavailable during verification`);
      continue;
    }
    if (hashFile(filePath) !== receipt.sha256) {
      errors.push(`${filename} bytes do not match its manifest SHA-256`);
    }

    try {
      const metadata = await sharp(filePath).metadata();
      if (
        metadata.format !== 'png' ||
        metadata.width !== 1280 ||
        metadata.height !== 720
      ) {
        errors.push(`${filename} must be a 1280x720 PNG`);
      }
      await sharp(filePath).raw().toBuffer();
    } catch {
      errors.push(`${filename} is not a decodable PNG`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function findFiles(root: string, name: string): string[] {
  if (!fs.existsSync(root)) return [];
  const matches: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) matches.push(...findFiles(entryPath, name));
    else if (!name || entry.name === name) matches.push(entryPath);
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

export async function waitForCleanTeardown(
  readOpenPorts: () => Promise<number[]> = openProofPorts,
  pause: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<number[]> {
  // Cloud shutdown can finish its isolated emulator export after Playwright exits.
  // Bound the grace period while still rejecting every listener left open.
  for (let attempt = 0; attempt < 75; attempt += 1) {
    const open = await readOpenPorts();
    if (open.length === 0) return [];
    await pause(400);
  }
  return readOpenPorts();
}

async function openProofPorts(): Promise<number[]> {
  const states = await Promise.all(PROOF_PORTS.map(portIsOpen));
  return PROOF_PORTS.filter((_, index) => states[index]);
}

export async function runTradeReceiptProof(
  draftReview = false,
  draftSeason = false,
  realDraft = false,
  retainedSimulation = false,
  conditionalLifecycle = false,
  swapLifecycle = false,
  apronFreeze = false,
  apronMultiseason = false
): Promise<number> {
  if (
    [swapLifecycle, conditionalLifecycle, apronFreeze, apronMultiseason].filter(
      Boolean
    ).length > 1
  )
    throw new Error('Select one lifecycle proof.');
  retainedSimulation =
    retainedSimulation ||
    conditionalLifecycle ||
    swapLifecycle ||
    apronFreeze ||
    apronMultiseason;
  if (retainedSimulation && (realDraft || draftReview || draftSeason))
    throw new Error('Governed retained simulation is a separate proof scope.');
  if (
    retainedSimulation &&
    (!process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE ||
      !process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE)
  )
    throw new Error(
      'Retained simulation requires the private catalogue and actual cloud baseline paths.'
    );
  const simulationInputHashes = retainedSimulation
    ? {
        release: hashFile(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!),
        baseline: hashFile(process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE!),
      }
    : null;
  if (realDraft && (draftReview || draftSeason))
    throw new Error(
      'Real retained review cannot use a synthetic mutation proof mode.'
    );
  if (
    realDraft &&
    (!process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE ||
      !process.env.SCOUTZERO_DRAFT_REVIEW_CASES)
  )
    throw new Error(
      'Real retained proof requires private release and scenario paths.'
    );
  draftReview = draftReview || draftSeason;
  const privateInputHashes = realDraft
    ? {
        release: hashFile(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!),
        scenarios: hashFile(process.env.SCOUTZERO_DRAFT_REVIEW_CASES!),
      }
    : null;
  const identity = resolveProofIdentity();
  const definitions = apronMultiseason
    ? APRON_MULTISEASON_SCREENSHOTS
    : apronFreeze
      ? APRON_FREEZE_SCREENSHOTS
      : swapLifecycle
        ? SWAP_LIFECYCLE_SCREENSHOTS
        : conditionalLifecycle
          ? CONDITIONAL_LIFECYCLE_SCREENSHOTS
          : retainedSimulation
            ? RETAINED_SIMULATION_SCREENSHOTS
            : realDraft
              ? REAL_DRAFT_SCREENSHOTS
              : draftReview
                ? DRAFT_REVIEW_SCREENSHOTS
                : GOVERNED_TRADE_RECEIPT_SCREENSHOTS;
  const artifactDir = path.join(
    identity.repoRoot,
    'tmp',
    'browser-proofs',
    apronMultiseason
      ? 'apron-multiseason'
      : apronFreeze
        ? 'apron-freeze'
        : swapLifecycle
          ? 'swap-draft-lifecycle'
          : conditionalLifecycle
            ? 'conditional-draft-lifecycle'
            : retainedSimulation
              ? 'retained-draft-simulation'
              : realDraft
                ? 'real-draft-review'
                : draftSeason
                  ? 'draft-season'
                  : draftReview
                    ? 'draft-review'
                    : 'trade-receipt',
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

  // Functions run compiled output, not Vite source. Always rebuild from the
  // exact candidate; a clean git tree alone cannot detect stale functions/lib.
  let functionsBuild: {
    candidate: string;
    command: string;
    log: string;
    artifacts: { builtPath: string; path: string; sha256: string }[];
  } | null = null;
  if (draftReview) {
    const logPath = path.join(artifactDir, 'functions-build.log');
    const log = fs.openSync(logPath, 'w');
    let result;
    try {
      result = spawnSync('npm', ['--prefix', 'functions', 'run', 'build'], {
        cwd: identity.repoRoot,
        stdio: ['ignore', log, log],
        timeout: 60000,
        env: process.env,
      });
    } finally {
      fs.closeSync(log);
    }
    if (result.status !== 0)
      throw new Error(`Exact-head functions build failed; see ${logPath}`);
    const builtRoot = path.join(identity.repoRoot, 'functions/lib');
    const retainedRoot = path.join(artifactDir, 'functions-build');
    fs.cpSync(builtRoot, retainedRoot, { recursive: true });
    functionsBuild = {
      candidate: identity.candidate,
      command: 'npm --prefix functions run build',
      log: path.relative(identity.repoRoot, logPath),
      artifacts: findFiles(builtRoot, '')
        .sort()
        .map((builtPath) => ({
          builtPath: path.relative(identity.repoRoot, builtPath),
          path: path.relative(
            identity.repoRoot,
            path.join(retainedRoot, path.relative(builtRoot, builtPath))
          ),
          sha256: hashFile(builtPath),
        })),
    };
  }

  const commandArgs = [
    'test',
    apronMultiseason
      ? 'tests/e2e/architect-apron-multiseason.spec.ts'
      : apronFreeze
        ? 'tests/e2e/architect-apron-freeze.spec.ts'
        : swapLifecycle
          ? 'tests/e2e/architect-swap-draft.spec.ts'
          : conditionalLifecycle
            ? 'tests/e2e/architect-conditional-draft.spec.ts'
            : retainedSimulation
              ? 'tests/e2e/architect-retained-draft-simulation.spec.ts'
              : realDraft
                ? 'tests/e2e/architect-real-draft-review-proof.spec.ts'
                : draftSeason
                  ? 'tests/e2e/architect-draft-season-proof.spec.ts'
                  : draftReview
                    ? 'tests/e2e/architect-draft-review-proof.spec.ts'
                    : PROOF_SPEC,
    '--workers=1',
    '--project=chromium',
    '--reporter=line,html',
    `--output=${testResultsDir}`,
    ...(draftSeason
      ? ['--config=scripts/review/draftSeasonProof.config.ts']
      : []),
  ];
  const startedAt = new Date().toISOString();
  process.stdout.write(`Exact candidate: ${identity.candidate}\n`);
  process.stdout.write(`Artifact directory: ${artifactDir}\n`);

  // Each focused phase has its own four-minute budget. The season continuation
  // consumes the preceding real writes in the same owned emulator, with exact
  // checkpoint/state comparison; it never reseeds an advanced world.
  const groups = draftSeason
    ? [
        'season record persists',
        'season continuation trades',
        'season review rejects',
        'season publication rejects',
        'season history trust boundary',
      ]
    : draftReview
      ? [
          'consumes components',
          'required component failures',
          'denied final metadata',
          'inventory membership',
        ]
      : [''];
  const runs: {
    command: string[];
    status: number | null;
    signal: string | null;
    clean: boolean | null;
    openPorts: number[] | null;
  }[] = [];
  const stopHarness = draftSeason
    ? await startSeasonProofHarness(identity.repoRoot, artifactDir)
    : null;
  try {
    for (const [index, group] of groups.entries()) {
      const scopedArgs = draftReview
        ? [
            ...commandArgs.filter((a) => !a.startsWith('--output=')),
            '--grep',
            group,
            `--output=${path.join(testResultsDir, String(index))}`,
          ]
        : commandArgs;
      const result = spawnSync(playwrightBinary, scopedArgs, {
        cwd: identity.repoRoot,
        env: {
          ...process.env,
          PLAYWRIGHT_ARCHITECT_REVIEW_MODE: 'true',
          ...(retainedSimulation
            ? { PLAYWRIGHT_DRAFT_SIMULATION: 'true' }
            : {}),
          PLAYWRIGHT_HTML_OUTPUT_DIR: draftReview
            ? path.join(reportDir, String(index))
            : reportDir,
          PLAYWRIGHT_HTML_OPEN: 'never',
          VITE_SHOW_TRADE_RECEIPT: 'true',
          ...(realDraft ? { ARCHITECT_REVIEW_WORLD_ONLY: 'true' } : {}),
          ...(draftReview
            ? {
                ARCHITECT_REVIEW_WORLD_ONLY: 'true',
                VITE_ARCHITECT_DRAFT_REVIEW: 'true',
              }
            : {}),
          ...(draftSeason
            ? {
                SCOUTZERO_SHARED_SEASON_PROOF: 'true',
                SCOUTZERO_SEASON_CONTINUATION: index === 1 ? 'true' : 'false',
              }
            : {}),
          SCOUTZERO_PROOF_CANDIDATE: identity.candidate,
          SCOUTZERO_BROWSER_PROOF_DIR: artifactDir,
        },
        stdio: 'inherit',
        ...(draftReview || retainedSimulation
          ? {
              timeout: apronMultiseason
                ? 3600000
                : conditionalLifecycle || swapLifecycle || apronFreeze
                  ? 1200000
                  : 240000,
            }
          : {}),
      });
      const remainingPorts = draftSeason ? [] : await waitForCleanTeardown();
      runs.push({
        command: scopedArgs,
        status: result.status,
        signal: result.signal,
        clean: draftSeason ? null : remainingPorts.length === 0,
        openPorts: draftSeason ? null : remainingPorts,
      });
      if (remainingPorts.length > 0)
        process.stderr.write(
          `Proof run teardown left listeners on ports: ${remainingPorts.join(', ')}\n`
        );
      if (result.status !== 0 || remainingPorts.length > 0) break;
    }
  } finally {
    if (stopHarness) await stopHarness();
  }

  const openPorts = await waitForCleanTeardown();
  const screenshotArtifacts = collectGovernedScreenshotArtifacts(
    artifactDir,
    identity.repoRoot,
    definitions
  );
  const screenshotVerification = await verifyGovernedScreenshotArtifacts(
    artifactDir,
    identity.repoRoot,
    screenshotArtifacts,
    definitions
  );
  const proofPath = path.join(artifactDir, 'proof.json');
  const tracePaths = findFiles(testResultsDir, 'trace.zip');
  const reportPaths = draftReview
    ? groups.map((_, index) =>
        path.join(reportDir, String(index), 'index.html')
      )
    : [path.join(reportDir, 'index.html')];
  const additionalProofPaths = retainedSimulation
    ? [path.join(artifactDir, 'negative-proof.json')]
    : draftReview
      ? [
          ...(draftSeason
            ? [
                'season-proof.json',
                'history-trust-counterexample.json',
                'certified-lineage-proof.json',
              ]
            : [
                'membership-unfenced-proof.json',
                'membership-changes-proof.json',
                'membership-commit-race-proof.json',
                'membership-competing-proof.json',
                'membership-admin-purge-proof.json',
              ]),
          'negative-proof.json',
          'atomic-proof.json',
        ].map((name) => path.join(artifactDir, name))
      : [];
  const passed =
    runs.length === groups.length &&
    runs.every(
      (run) =>
        run.status === 0 && (draftSeason ? run.clean === null : run.clean)
    ) &&
    screenshotVerification.valid &&
    fs.existsSync(proofPath) &&
    additionalProofPaths.every((proof) => fs.existsSync(proof)) &&
    tracePaths.length > 0 &&
    reportPaths.every((report) => fs.existsSync(report)) &&
    openPorts.length === 0 &&
    resolveProofIdentity(identity.repoRoot).candidate === identity.candidate &&
    (!privateInputHashes ||
      (privateInputHashes.release ===
        hashFile(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!) &&
        privateInputHashes.scenarios ===
          hashFile(process.env.SCOUTZERO_DRAFT_REVIEW_CASES!) &&
        JSON.parse(fs.readFileSync(proofPath, 'utf8')).packageSha256 ===
          privateInputHashes.release)) &&
    (!simulationInputHashes ||
      (simulationInputHashes.release ===
        hashFile(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!) &&
        simulationInputHashes.baseline ===
          hashFile(process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE!) &&
        JSON.parse(fs.readFileSync(proofPath, 'utf8')).packageSha256 ===
          simulationInputHashes.release &&
        JSON.parse(fs.readFileSync(proofPath, 'utf8')).candidate ===
          identity.candidate &&
        JSON.parse(fs.readFileSync(proofPath, 'utf8')).scope ===
          'governed-simulation-only' &&
        JSON.parse(
          fs.readFileSync(path.join(artifactDir, 'negative-proof.json'), 'utf8')
        ).candidate === identity.candidate)) &&
    (!functionsBuild ||
      functionsBuild.artifacts.every(
        (file) =>
          hashFile(path.join(identity.repoRoot, file.builtPath)) ===
            file.sha256 &&
          hashFile(path.join(identity.repoRoot, file.path)) === file.sha256
      ));

  const manifest = {
    schemaVersion: 1,
    proof: apronMultiseason
      ? 'governed-apron-multiseason'
      : apronFreeze
        ? 'governed-apron-freeze'
        : swapLifecycle
          ? 'Ordered swap-right trade and saved-world allocation (governed test assumptions; production disabled)'
          : conditionalLifecycle
            ? 'Conditional first-round trade and saved-world lifecycle (governed test assumptions; production disabled)'
            : retainedSimulation
              ? 'Retained pick identities with governed test assumptions (not verified NBA legality; production disabled)'
              : realDraft
                ? 'Real retained first-round evidence in Trade Machine (read-only; production Apply disabled)'
                : draftSeason
                  ? 'Synthetic freeze season record and subsequent first-round trade (production disabled)'
                  : draftReview
                    ? 'Synthetic first-round review mutation (production disabled)'
                    : 'Architect Trade Machine / Trade Receipt',
    base: identity.originMain,
    candidate: identity.candidate,
    upstream: identity.upstream,
    mergeBase: identity.mergeBase,
    viewport: { width: 1280, height: 720 },
    command: `npm run architect:proof:trade-receipt${apronMultiseason ? ' -- --apron-multiseason' : apronFreeze ? ' -- --apron-freeze' : swapLifecycle ? ' -- --swap-lifecycle' : conditionalLifecycle ? ' -- --conditional-lifecycle' : retainedSimulation ? ' -- --retained-simulation' : realDraft ? ' -- --real-draft' : draftSeason ? ' -- --draft-season' : draftReview ? ' -- --draft-review' : ''}`,
    privateInputHashes,
    simulationInputHashes,
    playwright: commandArgs,
    startedAt,
    completedAt: new Date().toISOString(),
    result: passed ? 'PASS' : 'FAIL',
    processStatus: runs.at(-1)?.status ?? null,
    processSignal: runs.at(-1)?.signal ?? null,
    runs,
    sharedOwnedSeasonHarness: draftSeason,
    functionsBuild,
    teardown: {
      checkedPorts: PROOF_PORTS,
      baselinePorts,
      openPorts,
      clean: openPorts.length === 0,
    },
    artifacts: {
      ...screenshotArtifacts,
      additionalProofs: additionalProofPaths.map((proof) =>
        fs.existsSync(proof)
          ? {
              path: path.relative(identity.repoRoot, proof),
              sha256: hashFile(proof),
            }
          : null
      ),
      trace: tracePaths.map((tracePath) => ({
        path: path.relative(identity.repoRoot, tracePath),
        sha256: hashFile(tracePath),
      })),
      report: draftReview
        ? reportPaths
            .filter((report) => fs.existsSync(report))
            .map((report) => path.relative(identity.repoRoot, report))
        : fs.existsSync(reportPaths[0])
          ? path.relative(identity.repoRoot, reportPaths[0])
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
    for (const error of screenshotVerification.errors) {
      process.stderr.write(`Screenshot evidence error: ${error}\n`);
    }
    if (openPorts.length > 0) {
      process.stderr.write(
        `Proof teardown left listeners on ports: ${openPorts.join(', ')}\n`
      );
    }
    return runs.find((run) => run.status !== 0)?.status || 1;
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
  runTradeReceiptProof(
    process.argv.includes('--draft-review'),
    process.argv.includes('--draft-season'),
    process.argv.includes('--real-draft'),
    process.argv.includes('--retained-simulation'),
    process.argv.includes('--conditional-lifecycle'),
    process.argv.includes('--swap-lifecycle'),
    process.argv.includes('--apron-freeze'),
    process.argv.includes('--apron-multiseason')
  )
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
