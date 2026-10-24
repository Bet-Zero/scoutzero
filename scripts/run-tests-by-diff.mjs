#!/usr/bin/env node

// One bounded policy for local test selection and the existing PR validation job.
// Unknown impact is conservative; filenames are not a dependency inference engine.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

// Inspected prose/status surfaces, not a blanket Markdown exemption. Generated
// schema, Canon/source evidence and unlisted documents remain conservative.
const ORDINARY_DOCS = new Set([
  'README.md',
  'docs/INDEX.md',
  'docs/guides/DEVELOPER_GUIDE.md',
  'work/architect-completion/GAP_LEDGER.md',
  'work/architect-completion/ACCEPTANCE_BATTERY.md',
  'work/architect-completion/PHASE3A_CLOSURE_EVIDENCE.md',
  'work/architect-completion/DRAFT_PICK_EXECUTION.md',
]);
const GOVERNING_DOCS = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  '.github/pull_request_template.md',
  'docs/agent-guides/phase3a-execution.md',
  'docs/agent-guides/independent-review-boundary.md',
  'docs/agent-guides/architect-boundary.md',
  'docs/agent-guides/architect-v1-completion-contract.md',
  'docs/standards/DOCUMENTATION_UPDATE_RULES.md',
  'docs/standards/CREATING_PERMANENT_DOCS.md',
  'docs/standards/DOCUMENTATION_STRUCTURE_STANDARD.md',
  'docs/standards/WORKSPACE_GUARDRAILS.md',
]);
// Only these UI entry surfaces have the inspected, closed Ranker consumer set.
// Ranker helpers (notably playerImpact, also consumed by cloud tooling), schema,
// Firebase, configuration and all other source changes stay conservative.
const RANKER_UI = new Set([
  'src/features/ranker/RankingSetup.tsx',
  'src/features/ranker/RankingSession.tsx',
  'src/features/ranker/RankingResults.tsx',
]);
const RANKER_ROOT_TESTS = new Set([
  'tests/RankingSessionUndo.test.tsx',
  'tests/RankingSetup.test.tsx',
  'tests/AnchorComparison.test.tsx',
  'tests/FilterPoolPanel.test.tsx',
  'tests/useSeasonViews.ui.test.tsx',
  'tests/rankingEngine.test.ts',
  'tests/rankerEngineSimulation.test.ts',
  'tests/rankerSessionSerialization.test.ts',
  'tests/rankerSaveAsList.test.ts',
  'tests/rankerLocalDraft.test.ts',
  'tests/topNSelection.test.ts',
  'tests/buildAnchorComparisons.test.ts',
]);
const isKnownDoc = (file) =>
  ORDINARY_DOCS.has(file) || GOVERNING_DOCS.has(file);
const isTestFile = (file) =>
  /^(?:tests|src\/tests)\/.*\.test\.(?:js|jsx|ts|tsx)$/.test(file) &&
  !/\.emulator\.test\./.test(file) &&
  file !== 'src/tests/security/firestoreRules.integration.test.ts';
const isRankerTest = (file) =>
  RANKER_ROOT_TESTS.has(file) ||
  (file.startsWith('src/tests/ranker/') && isTestFile(file));
const isNativeTest = (file) =>
  /^(?:tests|src\/tests)\/.*\.node-test\.(?:js|ts)$/.test(file);
const isUiTestFile = (file) =>
  /\.(?:jsx|tsx)$/.test(file) ||
  UI_TS_TEST_PATTERNS.some((pattern) => pattern.test(file));
const isShared = (file) =>
  /^(?:src\/(?:shared|components\/shared|lib|hooks|stores|context|schemas|types)\/|tests\/(?:helpers|__mocks__)\/|tests\/setup|scripts\/|\.github\/workflows\/)/.test(
    file
  ) || /\.d\.ts$/.test(file);

export function selectValidationProfile(
  files,
  { uncertain = false, structural = false } = {}
) {
  const docs = files.some((file) => file.endsWith('.md'));
  const conservative = (reason) => ({
    name: 'conservative',
    app: true,
    specialists: true,
    authority: true,
    docs,
    reason,
  });
  if (uncertain || structural || files.length === 0) {
    return conservative(
      'Missing comparison, empty diff, or deleted/renamed/type-changed paths'
    );
  }
  if (files.every(isKnownDoc)) {
    const authority = files.some((file) => GOVERNING_DOCS.has(file));
    return {
      name: authority ? 'governing-docs' : 'ordinary-docs',
      app: false,
      specialists: false,
      authority,
      docs: true,
      reason:
        'Only inspected documentation surfaces; governing changes retain authority/workflow checks',
    };
  }
  const executable = files.filter((file) => !isKnownDoc(file));
  if (executable.every((file) => RANKER_UI.has(file) || isRankerTest(file))) {
    return {
      name: 'ranker-ui',
      app: true,
      specialists: false,
      authority: files.some((file) => GOVERNING_DOCS.has(file)),
      docs,
      reason:
        'Isolated Ranker UI/behavior tests; validate the complete declared Ranker family',
    };
  }
  return conservative(
    'Shared, tooling, dependency, configuration, mixed or unclassified impact'
  );
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// --no-renames intentionally retains both the deleted and added path. NUL
// parsing preserves spaces/newlines; the whole merge-base range covers all commits.
export function collectChanges({
  cwd = process.cwd(),
  base,
  head = 'HEAD',
  ci = false,
} = {}) {
  const entries = new Map();
  const addDiff = (args) => {
    const parts = git(cwd, [
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      ...args,
      '--',
    ]).split('\0');
    for (let index = 0; index + 1 < parts.length; index += 2) {
      const status = parts[index];
      const file = parts[index + 1];
      if (!status || !file || !/^[AMDTUXB]$/.test(status))
        throw new Error('Unrecognized git diff status');
      // Keep any deletion/type change even when another local layer modifies it.
      entries.set(
        file,
        entries.get(file) === 'D' || entries.get(file) === 'T'
          ? entries.get(file)
          : status
      );
    }
  };
  try {
    if (
      ci &&
      (!/^[a-f0-9]{40}$/.test(base ?? '') || !/^[a-f0-9]{40}$/.test(head))
    ) {
      throw new Error(
        'CI requires explicit base and checked-out candidate SHAs'
      );
    }
    if (!base) {
      base = ['origin/main', 'main'].find((ref) => {
        try {
          git(cwd, ['rev-parse', '--verify', ref]);
          return true;
        } catch {
          return false;
        }
      });
      if (!base) throw new Error('No comparison history');
    }
    const mergeBase = git(cwd, ['merge-base', base, head]).trim();
    addDiff([mergeBase, head]);
    if (!ci) {
      addDiff(['--cached']);
      addDiff([]);
      for (const file of git(cwd, [
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
      ])
        .split('\0')
        .filter(Boolean)) {
        entries.set(file, 'A');
      }
    } else if (git(cwd, ['rev-parse', 'HEAD']).trim() !== head) {
      throw new Error('Checked-out candidate differs from declared CI head');
    }
    return {
      files: [...entries.keys()].sort(),
      structural: [...entries.values()].some(
        (status) => !['A', 'M'].includes(status)
      ),
      uncertain: false,
      base: mergeBase,
      head,
    };
  } catch (error) {
    return {
      files: [...entries.keys()].sort(),
      uncertain: true,
      structural: true,
      reason: error.message,
      base,
      head,
    };
  }
}

function getAllTestFiles() {
  return globSync(
    ['tests/**/*.test.{js,jsx,ts,tsx}', 'src/tests/**/*.test.{js,jsx,ts,tsx}'],
    { nodir: true }
  )
    .filter(isTestFile)
    .sort();
}

const EXPLICIT_TARGETS = [
  {
    key: 'freeAgencyBoundary',
    reason:
      'Free Agency world/vacuum action-publication and gating slice modified',
    matchPatterns: [
      /^src\/features\/architect\/GMDashboard\/hooks\/useArchitectActions\.ts$/,
      /^src\/features\/architect\/GMDashboard\/sections\/FreeAgencySection\.tsx$/,
      /^src\/features\/architect\/freeAgency\/FreeAgentPool\/FreeAgentPool\.tsx$/,
      /^src\/tests\/architect\/useArchitectActions\.freeAgency\.test\.tsx$/,
      /^src\/tests\/architect\/freeAgentPool\.surface\.e86\.behavior\.test\.tsx$/,
      /^src\/tests\/architect\/freeAgentPool\.offerSheetInitiation\.behavior\.test\.jsx$/,
      /^src\/tests\/architect\/OfferSheetList\.freeAgency\.test\.jsx$/,
      /^src\/tests\/architect\/freeAgency_closure\.gate\.test\.ts$/,
      /^src\/tests\/architect\/offerSheets_closure\.gate\.test\.ts$/,
      /^src\/tests\/architect\/dashboardWorldBoundary\.e109\.test\.tsx$/,
    ],
    anchorPatterns: [
      /^src\/features\/architect\/GMDashboard\/sections\/FreeAgencySection\.tsx$/,
      /^src\/features\/architect\/freeAgency\/FreeAgentPool\/FreeAgentPool\.tsx$/,
      /^src\/tests\/architect\/OfferSheetList\.freeAgency\.test\.jsx$/,
      /^src\/tests\/architect\/freeAgency_closure\.gate\.test\.ts$/,
    ],
    nodeTests: [
      'src/tests/architect/freeAgency_closure.gate.test.ts',
      'src/tests/architect/offerSheets_closure.gate.test.ts',
    ],
    uiTests: [
      'src/tests/architect/OfferSheetList.freeAgency.test.jsx',
      'src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx',
      'src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx',
      'src/tests/architect/useArchitectActions.freeAgency.test.tsx',
      'src/tests/architect/dashboardWorldBoundary.e109.test.tsx',
    ],
  },
  {
    key: 'capSheetBoundary',
    reason: 'Cap Sheet mutation-boundary/dashboard action slice modified',
    matchPatterns: [
      /^src\/features\/architect\/GMDashboard\/hooks\/useArchitectActions\.ts$/,
      /^src\/features\/architect\/GMDashboard\/GMDashboard\.tsx$/,
      /^src\/shared\/components\/EditContractModal\.tsx$/,
      /^src\/tests\/architect\/capSheet_closure\.gate\.test\.ts$/,
      /^src\/tests\/architect\/architectHardeningE4\.polish\.test\.ts$/,
      /^src\/tests\/architect\/GMDashboard\.smoke\.test\.tsx$/,
      /^src\/tests\/architect\/dashboardWorldBoundary\.e109\.test\.tsx$/,
      /^src\/tests\/smoke\/architect\.uiSmoke\.e1\.test\.tsx$/,
    ],
    anchorPatterns: [
      /^src\/shared\/components\/EditContractModal\.tsx$/,
      /^src\/tests\/architect\/capSheet_closure\.gate\.test\.ts$/,
      /^src\/tests\/architect\/architectHardeningE4\.polish\.test\.ts$/,
    ],
    nodeTests: [
      'src/tests/architect/capSheet_closure.gate.test.ts',
      'src/tests/architect/architectHardeningE4.polish.test.ts',
    ],
    uiTests: [
      'src/tests/architect/GMDashboard.smoke.test.tsx',
      'src/tests/architect/dashboardWorldBoundary.e109.test.tsx',
      'src/tests/smoke/architect.uiSmoke.e1.test.tsx',
    ],
  },
];

const UI_TS_TEST_PATTERNS = [
  /^src\/tests\/architect\/wizardTranslation\.test\.ts$/,
  /^src\/tests\/architect\/pickRightWizardDraft\.test\.ts$/,
  /^src\/tests\/architect\/utils\/freeAgencyFilterPersistence\.test\.ts$/,
  /^src\/tests\/entitlements\/vacuumEntitlementOverlayStore\.test\.ts$/,
  /^src\/tests\/entitlements\/entitlementResolver\.vacuumOverlay\.test\.ts$/,
  /^tests\/entitlements\/vacuumTradeTransfer\.test\.ts$/,
];

function buildTargetedPlan({
  tier = 'targeted',
  reason,
  files,
  nodeTests = [],
  uiTests = [],
}) {
  const commands = [];

  if (nodeTests.length > 0) {
    commands.push({ script: 'test:node', fileArgs: nodeTests });
  }

  if (uiTests.length > 0) {
    commands.push({ script: 'test:ui', fileArgs: uiTests });
  }

  return {
    tier,
    reason,
    files,
    commands,
  };
}

function selectExplicitTarget(executableFiles) {
  for (const target of EXPLICIT_TARGETS) {
    const matchesOnlyTarget =
      executableFiles.length > 0 &&
      executableFiles.every((file) =>
        target.matchPatterns.some((pattern) => pattern.test(file))
      );

    if (!matchesOnlyTarget) {
      continue;
    }

    const hasAnchor =
      target.anchorPatterns.length === 0 ||
      executableFiles.some((file) =>
        target.anchorPatterns.some((pattern) => pattern.test(file))
      );

    if (!hasAnchor) {
      continue;
    }

    return buildTargetedPlan({
      tier: target.key,
      reason: target.reason,
      files: executableFiles,
      nodeTests: target.nodeTests,
      uiTests: target.uiTests,
    });
  }

  return null;
}

function documentationCommands(files) {
  const markdown = files.filter(
    (file) => file.endsWith('.md') && existsSync(file)
  );
  return [
    ...(markdown.length
      ? [
          {
            executable: process.execPath,
            args: [
              'node_modules/markdownlint-cli/markdownlint.js',
              ...markdown,
            ],
          },
        ]
      : []),
    { script: 'docs:guardrails', fileArgs: [] },
  ];
}

export function selectTestPlan(changedFiles, options = {}) {
  const files = [...new Set(changedFiles)];
  const profile = selectValidationProfile(files, options);
  const available = options.availableTestFiles ?? getAllTestFiles();
  let plan;
  if (!profile.app) {
    plan = {
      tier: profile.name,
      reason: profile.reason,
      files,
      commands: documentationCommands(files),
    };
    if (profile.authority)
      plan.commands.push({ script: 'test:phase3a-workflow', fileArgs: [] });
    return plan;
  }
  const executable = files.filter((file) => !isKnownDoc(file));
  if (
    !options.uncertain &&
    !options.structural &&
    executable.length &&
    !executable.some(isShared)
  ) {
    if (profile.name === 'ranker-ui') {
      const tests = [
        ...new Set([
          ...available.filter(isRankerTest),
          ...executable.filter(isTestFile),
        ]),
      ].sort();
      plan = buildTargetedPlan({
        tier: 'ranker-ui',
        reason: profile.reason,
        files,
        nodeTests: tests.filter((file) => !isUiTestFile(file)),
        uiTests: tests.filter(isUiTestFile),
      });
    } else {
      plan = selectExplicitTarget(executable);
      if (!plan && executable.every(isTestFile)) {
        plan = buildTargetedPlan({
          reason: 'Changed tests only',
          files,
          nodeTests: executable.filter((file) => !isUiTestFile(file)),
          uiTests: executable.filter(isUiTestFile),
        });
      }
    }
  }
  if (!plan || plan.commands.length === 0) {
    plan = {
      tier: 'full',
      reason: profile.reason,
      files,
      commands: [{ script: 'test:full', fileArgs: [] }],
    };
  }
  // Native tests are not included by Vitest's .test.ts globs. Never silently
  // omit a changed helper test, including a newly introduced native suite.
  const nativeTests = files.filter(
    (file) => isNativeTest(file) && existsSync(file)
  );
  if (nativeTests.length)
    plan.commands.push({
      executable: process.execPath,
      args: [
        '--import',
        'tsx',
        '--test',
        '--test-reporter=dot',
        ...nativeTests,
      ],
    });
  return plan;
}

export function executePlan(
  plan,
  { spawn = spawnSync, forwarded = [], dryRun = false } = {}
) {
  console.log(`Selected scope: ${plan.tier}\nReason: ${plan.reason}`);
  for (const command of plan.commands) {
    // Vitest flags do not belong on Node test runners or documentation commands.
    const extra = ['test:node', 'test:ui', 'test:full'].includes(command.script)
      ? forwarded
      : [];
    const args = command.executable
      ? command.args
      : [
          'run',
          command.script,
          ...(extra.length || command.fileArgs?.length
            ? ['--', ...extra, ...(command.fileArgs ?? [])]
            : []),
        ];
    const executable = command.executable ?? 'npm';
    console.log(
      `${dryRun ? 'Would run' : 'Running'}: ${executable} ${args.join(' ')}`
    );
    if (!dryRun) {
      const result = spawn(executable, args, { stdio: 'inherit' });
      if (result.status !== 0)
        throw new Error(
          `Selected check failed (${result.status ?? result.error?.message ?? 'signal'}): ${executable} ${args.join(' ')}`
        );
    }
  }
  console.log(
    dryRun
      ? 'Selection only; no checks executed.'
      : 'Selected checks passed; unselected checks were not executed.'
  );
}

function main() {
  const args = process.argv.slice(2);
  const ci = process.env.GITHUB_ACTIONS === 'true';
  const filesIndex = args.findIndex(
    (arg) => arg === '--files' || arg.startsWith('--files=')
  );
  if (ci && filesIndex >= 0)
    throw new Error('--files cannot replace complete-candidate CI detection');
  const explicit =
    filesIndex >= 0
      ? args[filesIndex].includes('=')
        ? args[filesIndex].slice(8)
        : (args[filesIndex + 1] ?? '')
      : null;
  const changes =
    explicit !== null
      ? {
          files: explicit
            .split(',')
            .map((file) => file.trim())
            .filter(Boolean),
        }
      : collectChanges({
          base: process.env.SCOUTZERO_DIFF_BASE,
          head: process.env.SCOUTZERO_DIFF_HEAD ?? 'HEAD',
          ci,
        });
  const profile = selectValidationProfile(changes.files, changes);
  if (changes.uncertain && (ci || args.includes('--docs')))
    throw new Error(
      `Cannot establish complete changed-file coverage: ${changes.reason}`
    );
  if (changes.uncertain)
    console.warn(`Conservative comparison fallback: ${changes.reason}`);
  if (args.includes('--verbose'))
    console.log(JSON.stringify({ ...changes, profile }, null, 2));
  if (args.includes('--ci-plan')) {
    if (!ci || !process.env.GITHUB_OUTPUT)
      throw new Error('--ci-plan requires GitHub Actions outputs');
    for (const key of ['app', 'specialists', 'authority', 'docs'])
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${profile[key]}\n`);
    const summary = `Validation profile: ${profile.name}\n${profile.reason}\nBase: ${changes.base}; candidate: ${changes.head}\nChanged paths: ${changes.files.length}. Unselected steps are not executed passes.\n`;
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    return;
  }
  const forwarded = args.filter(
    (arg, index) =>
      !['--verbose', '--dry-run', '--docs'].includes(arg) &&
      index !== filesIndex &&
      !(
        filesIndex >= 0 &&
        args[filesIndex] === '--files' &&
        index === filesIndex + 1
      )
  );
  const plan = args.includes('--docs')
    ? {
        tier: 'documentation',
        reason: 'Changed Markdown plus repository routing guardrails',
        commands: documentationCommands(changes.files),
      }
    : selectTestPlan(changes.files, changes);
  executePlan(plan, { forwarded, dryRun: args.includes('--dry-run') });
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
