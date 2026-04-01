#!/usr/bin/env node

/**
 * FILE: scripts/run-tests-by-diff.mjs
 *
 * Diff-based test runner - automatically selects the appropriate validation
 * scope based on changed files from git.
 *
 * MAPPING RULES:
 * - Tier 3 (Full): Changes to shared code, schemas, config, build scripts
 * - Tier 2 (Targeted): Inferred related node/ui tests for a narrow slice
 * - Tier 2 (Feature): Feature-specific fallback when inference is weak
 * - Tier 1 (Fast): Default fallback for all other changes
 *
 * USAGE:
 *   npm run test:diff
 *   node scripts/run-tests-by-diff.mjs
 *   node scripts/run-tests-by-diff.mjs --verbose
 *   node scripts/run-tests-by-diff.mjs --dry-run --files src/features/architect/GMDashboard/hooks/useArchitectActions.ts,src/features/architect/GMDashboard/sections/FreeAgencySection.tsx
 */

import { execSync, spawnSync } from 'child_process';
import { globSync } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const rawArgs = process.argv.slice(2);
const VERBOSE = rawArgs.includes('--verbose');
const DRY_RUN = rawArgs.includes('--dry-run');

const explicitChangedFiles = [];
const FORWARDED_ARGS = [];

for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index];

  if (arg === '--verbose' || arg === '--dry-run') {
    continue;
  }

  if (arg === '--files') {
    const value = rawArgs[index + 1] ?? '';
    explicitChangedFiles.push(...splitFileList(value));
    index += 1;
    continue;
  }

  if (arg.startsWith('--files=')) {
    explicitChangedFiles.push(...splitFileList(arg.slice('--files='.length)));
    continue;
  }

  FORWARDED_ARGS.push(arg);
}

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

const DIRECT_TEST_FILE_PATTERN =
  /^(?:tests|src\/tests)\/.*\.test\.(?:js|jsx|ts|tsx)$/;
const EMULATOR_TEST_FILE_PATTERN = /\.emulator\.test\.(?:js|jsx|ts|tsx)$/;

const NON_EXECUTION_SUPPORT_PATTERNS = [
  /\.md$/,
  /^return_packages\/.+/,
];

const TIER_3_TRIGGERS = [
  // Shared/global code
  /^src\/shared\//,
  /^src\/components\/shared\//,
  /^src\/lib\//,
  /^src\/hooks\//,
  /^src\/stores\//,
  /^src\/context\//,
  /^tests\/helpers\//,
  /^tests\/__mocks__\//,
  /^tests\/setup[^/]+\.(?:js|ts)$/,

  // Schemas and types
  /^src\/schemas\//,
  /^src\/types\//,
  /\.d\.ts$/,

  // Config files
  /^vite\.config\./,
  /^vitest(?:\.[^.]+)?\.config\./,
  /^tsconfig\.json$/,
  /^package\.json$/,
  /^package-lock\.json$/,

  // Build and CI
  /^\.github\/workflows\//,
  /^scripts\/.*\.(?:js|ts|mjs|cjs)$/,

  // Root config
  /^tailwind\.config\./,
  /^postcss\.config\./,
  /^jsconfig\.json$/,
];

const FEATURE_PATTERNS = {
  architect: [
    /^src\/features\/architect\//,
    /^src\/tests\/architect\//,
    /^tests\/architect\//,
    /^src\/tests\/tradeMachine\//,
  ],
  trade: [/^src\/features\/trade\//, /^src\/tests\/trade\//, /^tests\/trade\//],
  roster: [/^src\/features\/roster\//, /^src\/tests\/roster\//, /^tests\/roster\//],
  scouting: [
    /^src\/features\/scouting\//,
    /^src\/tests\/scouting\//,
    /^tests\/scouting\//,
  ],
};

const EXPLICIT_TARGETS = [
  {
    key: 'freeAgencyBoundary',
    reason: 'Free Agency world/vacuum action-publication and gating slice modified',
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

const STOP_WORDS = new Set([
  'src',
  'tests',
  'test',
  'features',
  'feature',
  'shared',
  'components',
  'component',
  'hooks',
  'hook',
  'utils',
  'util',
  'pages',
  'page',
  'sections',
  'section',
  'modals',
  'modal',
  'constants',
  'constant',
  'types',
  'type',
  'data',
  'index',
  'architect',
  'trade',
  'roster',
  'scouting',
  'behavior',
  'guardrail',
  'closure',
  'surface',
  'smoke',
  'integration',
  'contract',
  'contracts',
  'rules',
  'rule',
]);

const TARGETED_MATCH_THRESHOLD = 18;
const MAX_TARGETED_TESTS = 12;
const MAX_MATCHES_PER_FILE = 4;

function splitFileList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logVerbose(message) {
  if (VERBOSE) {
    console.log(`  ${colors.blue}[DEBUG]${colors.reset} ${message}`);
  }
}

function normalizePath(file) {
  return file.split(path.sep).join('/');
}

function normalizeToken(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitWords(segment) {
  return segment
    .replace(/\.[^.]+$/u, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/u)
    .map((word) => word.toLowerCase())
    .filter(Boolean);
}

function countSetOverlap(left, right) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}

function isExecutionSupportFile(file) {
  return NON_EXECUTION_SUPPORT_PATTERNS.some((pattern) => pattern.test(file));
}

function isTestFile(file) {
  return (
    DIRECT_TEST_FILE_PATTERN.test(file) && !EMULATOR_TEST_FILE_PATTERN.test(file)
  );
}

function isUiTestFile(file) {
  return (
    /\.(?:jsx|tsx)$/u.test(file) ||
    UI_TS_TEST_PATTERNS.some((pattern) => pattern.test(file))
  );
}

function detectFeature(file) {
  for (const [feature, patterns] of Object.entries(FEATURE_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(file))) {
      return feature;
    }
  }
  return null;
}

function buildPathInfo(file) {
  const normalizedFile = normalizePath(file);
  const segments = normalizedFile.split('/').filter(Boolean);
  const basename = path.posix.basename(
    normalizedFile,
    path.posix.extname(normalizedFile)
  );

  const compoundTokens = new Set();
  const wordTokens = new Set();

  for (const segment of segments) {
    const withoutExtension = segment.replace(/\.[^.]+$/u, '');
    const compound = normalizeToken(withoutExtension);
    if (compound.length >= 3 && !STOP_WORDS.has(compound)) {
      compoundTokens.add(compound);
    }

    for (const word of splitWords(segment)) {
      if (word.length >= 2 && !STOP_WORDS.has(word)) {
        wordTokens.add(word);
      }
    }
  }

  return {
    file: normalizedFile,
    feature: detectFeature(normalizedFile),
    basenameNormalized: normalizeToken(basename),
    pathNormalized: normalizeToken(normalizedFile),
    compoundTokens,
    wordTokens,
  };
}

function getAllTestFiles() {
  return globSync(['tests/**/*.test.{js,jsx,ts,tsx}', 'src/tests/**/*.test.{js,jsx,ts,tsx}'], {
    ignore: ['**/*.emulator.test.{js,jsx,ts,tsx}'],
    nodir: true,
  })
    .map(normalizePath)
    .sort();
}

function scoreTestMatch(changedInfo, testInfo) {
  let score = 0;

  if (changedInfo.feature && changedInfo.feature === testInfo.feature) {
    score += 10;
  }

  if (
    changedInfo.basenameNormalized &&
    changedInfo.basenameNormalized === testInfo.basenameNormalized
  ) {
    score += 30;
  } else if (
    changedInfo.basenameNormalized &&
    testInfo.pathNormalized.includes(changedInfo.basenameNormalized)
  ) {
    score += 22;
  }

  const compoundOverlap = countSetOverlap(
    changedInfo.compoundTokens,
    testInfo.compoundTokens
  );
  const wordOverlap = countSetOverlap(changedInfo.wordTokens, testInfo.wordTokens);

  score += compoundOverlap * 8;
  score += wordOverlap * 4;

  if (wordOverlap >= 2) {
    score += 6;
  }

  if (testInfo.file.includes('/smoke/')) {
    score -= 2;
  }

  return score;
}

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

function inferTargetedPlan(executableFiles, availableTestFiles) {
  const directTestFiles = executableFiles.filter(isTestFile);
  const sourceFiles = executableFiles.filter((file) => !isTestFile(file));

  if (sourceFiles.length === 0) {
    const nodeTests = directTestFiles.filter((file) => !isUiTestFile(file));
    const uiTests = directTestFiles.filter(isUiTestFile);

    if (nodeTests.length === 0 && uiTests.length === 0) {
      return null;
    }

    return buildTargetedPlan({
      reason: 'Changed tests only',
      files: executableFiles,
      nodeTests,
      uiTests,
    });
  }

  const knownFeatures = new Set(
    sourceFiles.map(detectFeature).filter(Boolean)
  );
  if (knownFeatures.size > 1) {
    return null;
  }

  const testInfos = availableTestFiles.map((file) => buildPathInfo(file));
  const matchedTestFiles = new Set(directTestFiles);

  for (const sourceFile of sourceFiles) {
    const sourceInfo = buildPathInfo(sourceFile);
    const scoredCandidates = testInfos
      .map((testInfo) => ({
        file: testInfo.file,
        score: scoreTestMatch(sourceInfo, testInfo),
      }))
      .filter((candidate) => candidate.score >= TARGETED_MATCH_THRESHOLD)
      .sort((left, right) => right.score - left.score);

    if (scoredCandidates.length === 0) {
      logVerbose(`No strong inferred tests for ${sourceFile}`);
      return null;
    }

    const selectedCandidates = scoredCandidates.slice(0, MAX_MATCHES_PER_FILE);

    for (const candidate of selectedCandidates) {
      matchedTestFiles.add(candidate.file);
    }
  }

  if (matchedTestFiles.size === 0 || matchedTestFiles.size > MAX_TARGETED_TESTS) {
    return null;
  }

  const nodeTests = Array.from(matchedTestFiles)
    .filter((file) => !isUiTestFile(file))
    .sort();
  const uiTests = Array.from(matchedTestFiles)
    .filter(isUiTestFile)
    .sort();

  if (nodeTests.length === 0 && uiTests.length === 0) {
    return null;
  }

  return buildTargetedPlan({
    reason: `Inferred ${matchedTestFiles.size} related test file${matchedTestFiles.size === 1 ? '' : 's'}`,
    files: executableFiles,
    nodeTests,
    uiTests,
  });
}

/**
 * Get changed files from git
 * Tries multiple strategies to find changes.
 */
function getChangedFiles() {
  if (explicitChangedFiles.length > 0) {
    logVerbose('Using explicit changed-file list from --files');
    return explicitChangedFiles.map(normalizePath);
  }

  const strategies = [
    () => {
      logVerbose('Trying: git diff --name-only origin/main...HEAD');
      return execSync('git diff --name-only origin/main...HEAD', {
        encoding: 'utf8',
      });
    },
    () => {
      logVerbose('Trying: git diff --name-only main...HEAD');
      return execSync('git diff --name-only main...HEAD', { encoding: 'utf8' });
    },
    () => {
      logVerbose('Trying: git diff --name-only --cached');
      return execSync('git diff --name-only --cached', { encoding: 'utf8' });
    },
    () => {
      logVerbose('Trying: git diff --name-only');
      return execSync('git diff --name-only', { encoding: 'utf8' });
    },
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result.trim()) {
        return result
          .trim()
          .split('\n')
          .map(normalizePath)
          .filter(Boolean);
      }
    } catch (error) {
      logVerbose(`Strategy failed: ${error.message}`);
    }
  }

  log('⚠️  No changed files detected', colors.yellow);
  log('   Running fast tests as fallback', colors.yellow);
  return [];
}

export function selectTestPlan(
  changedFiles,
  { availableTestFiles = getAllTestFiles() } = {}
) {
  const normalizedFiles = changedFiles.map(normalizePath).filter(Boolean);

  if (normalizedFiles.length === 0) {
    return {
      tier: 'fast',
      reason: 'No changes detected',
      files: normalizedFiles,
      commands: [{ script: 'test:fast', fileArgs: [] }],
    };
  }

  const executableFiles = normalizedFiles.filter(
    (file) => !isExecutionSupportFile(file)
  );

  if (executableFiles.length === 0) {
    return {
      tier: 'fast',
      reason: 'Support-file changes only',
      files: normalizedFiles,
      commands: [{ script: 'test:fast', fileArgs: [] }],
    };
  }

  logVerbose(`Analyzing ${normalizedFiles.length} changed files...`);

  const explicitTarget = selectExplicitTarget(executableFiles);
  if (explicitTarget) {
    return explicitTarget;
  }

  for (const file of executableFiles) {
    for (const pattern of TIER_3_TRIGGERS) {
      if (pattern.test(file)) {
        logVerbose(`Tier 3 trigger: ${file} matches ${pattern}`);
        return {
          tier: 'full',
          reason: `Shared/config change detected: ${file}`,
          files: normalizedFiles,
          commands: [{ script: 'test:full', fileArgs: [] }],
        };
      }
    }
  }

  const inferredTarget = inferTargetedPlan(executableFiles, availableTestFiles);
  if (inferredTarget) {
    return inferredTarget;
  }

  const matchedFeatures = new Set();
  for (const file of executableFiles) {
    const feature = detectFeature(file);
    if (feature) {
      matchedFeatures.add(feature);
      logVerbose(`Feature match: ${file} -> ${feature}`);
    }
  }

  if (matchedFeatures.size > 2) {
    return {
      tier: 'full',
      reason: `Multiple features modified: ${Array.from(matchedFeatures).join(', ')}`,
      files: normalizedFiles,
      commands: [{ script: 'test:full', fileArgs: [] }],
    };
  }

  if (matchedFeatures.size === 1) {
    const feature = Array.from(matchedFeatures)[0];
    return {
      tier: feature,
      reason: `${feature} feature modified`,
      files: normalizedFiles,
      commands: [{ script: `test:${feature}`, fileArgs: [] }],
    };
  }

  if (matchedFeatures.size === 2 && matchedFeatures.has('architect')) {
    return {
      tier: 'architect',
      reason: `Mixed features including architect: ${Array.from(matchedFeatures).join(', ')}`,
      files: normalizedFiles,
      commands: [{ script: 'test:architect', fileArgs: [] }],
    };
  }

  return {
    tier: 'fast',
    reason: 'No specific triggers matched',
    files: normalizedFiles,
    commands: [{ script: 'test:fast', fileArgs: [] }],
  };
}

function formatDisplayCommand(command) {
  const forwarded = FORWARDED_ARGS.length > 0 ? [...FORWARDED_ARGS] : [];
  const fileArgs = command.fileArgs ?? [];
  const trailingArgs = [...forwarded, ...fileArgs];
  return `npm run ${command.script}${
    trailingArgs.length > 0 ? ` -- ${trailingArgs.join(' ')}` : ''
  }`;
}

function runTests(plan) {
  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.bright);
  log('  Diff-Based Test Runner', colors.bright);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.bright);
  log('');
  log(`Selected Tier: ${colors.bright}${plan.tier.toUpperCase()}${colors.reset}`);
  log(`Reason: ${plan.reason}`);

  if (VERBOSE && plan.files.length > 0) {
    log('');
    log('Changed files:');
    plan.files.forEach((file) => log(`  - ${file}`, colors.blue));
  }

  if (DRY_RUN) {
    log('');
    log('Dry run:', colors.yellow);
    plan.commands.forEach((command) => {
      log(`  ${formatDisplayCommand(command)}`, colors.green);
    });
    return;
  }

  for (const command of plan.commands) {
    const displayCommand = formatDisplayCommand(command);

    log('');
    log(`Running: ${colors.green}${displayCommand}${colors.reset}`);
    log('');

    const npmArgs = [
      'run',
      command.script,
      ...((FORWARDED_ARGS.length > 0 || (command.fileArgs ?? []).length > 0)
        ? ['--', ...FORWARDED_ARGS, ...(command.fileArgs ?? [])]
        : []),
    ];

    const result = spawnSync('npm', npmArgs, {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      log('');
      log('❌ Tests failed', colors.red);
      process.exit(result.status ?? 1);
    }
  }

  log('');
  log('✅ Tests passed', colors.green);
}

function main() {
  try {
    if (explicitChangedFiles.length === 0) {
      try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      } catch (error) {
        log('❌ Not a git repository', colors.red);
        log('   Falling back to fast tests');
        runTests({
          tier: 'fast',
          reason: 'Not in git repo',
          files: [],
          commands: [{ script: 'test:fast', fileArgs: [] }],
        });
        return;
      }
    }

    const changedFiles = getChangedFiles();
    const plan = selectTestPlan(changedFiles);
    runTests(plan);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
    if (VERBOSE && error.stack) {
      log(error.stack, colors.red);
    }
    process.exit(1);
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  main();
}
