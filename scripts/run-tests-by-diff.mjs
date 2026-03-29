#!/usr/bin/env node

/**
 * FILE: scripts/run-tests-by-diff.mjs
 *
 * Diff-based test runner - automatically selects the appropriate test tier
 * based on changed files from git.
 *
 * MAPPING RULES:
 * - Tier 3 (Full): Changes to shared code, schemas, config, build scripts
 * - Tier 2 (Feature): Changes to feature-specific code (architect, trade, etc.)
 * - Tier 1 (Fast): Default fallback for all other changes
 *
 * USAGE:
 *   npm run test:diff
 *   node scripts/run-tests-by-diff.mjs
 *   node scripts/run-tests-by-diff.mjs --verbose
 */

import { execSync, spawnSync } from 'child_process';

const VERBOSE = process.argv.includes('--verbose');
const FORWARDED_ARGS = process.argv
  .slice(2)
  .filter((arg) => arg !== '--verbose');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function logVerbose(msg) {
  if (VERBOSE) {
    console.log(`  ${colors.blue}[DEBUG]${colors.reset} ${msg}`);
  }
}

/**
 * Get changed files from git
 * Tries multiple strategies to find changes
 */
function getChangedFiles() {
  const strategies = [
    // Strategy 1: Compare with origin/main
    () => {
      logVerbose('Trying: git diff --name-only origin/main...HEAD');
      return execSync('git diff --name-only origin/main...HEAD', {
        encoding: 'utf8',
      });
    },
    // Strategy 2: Compare with main branch
    () => {
      logVerbose('Trying: git diff --name-only main...HEAD');
      return execSync('git diff --name-only main...HEAD', { encoding: 'utf8' });
    },
    // Strategy 3: Staged changes
    () => {
      logVerbose('Trying: git diff --name-only --cached');
      return execSync('git diff --name-only --cached', { encoding: 'utf8' });
    },
    // Strategy 4: Unstaged changes
    () => {
      logVerbose('Trying: git diff --name-only');
      return execSync('git diff --name-only', { encoding: 'utf8' });
    },
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result.trim()) {
        return result.trim().split('\n').filter(Boolean);
      }
    } catch (err) {
      logVerbose(`Strategy failed: ${err.message}`);
    }
  }

  log('⚠️  No changed files detected', colors.yellow);
  log('   Running fast tests as fallback', colors.yellow);
  return [];
}

/**
 * Tier 3 triggers - patterns that require full test suite
 */
const TIER_3_TRIGGERS = [
  // Shared/global code
  /^src\/components\/shared\//,
  /^src\/lib\//,
  /^src\/hooks\//,
  /^src\/stores\//,
  /^src\/context\//,

  // Schemas and types
  /^src\/schemas\//,
  /^src\/types\//,
  /\.d\.ts$/,

  // Config files
  /^vite\.config\./,
  /^vitest\.config\./,
  /^vitest\.emulator\.config\./,
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

/**
 * Cap Sheet mutation-boundary slice.
 * Keep this narrow so we only bypass the broader architect tier when every
 * executable change is inside the audited dashboard/action-boundary surface.
 */
const CAP_SHEET_BOUNDARY_PATTERNS = [
  /^src\/features\/architect\/GMDashboard\/hooks\/useArchitectActions\.ts$/,
  /^src\/features\/architect\/GMDashboard\/GMDashboard\.tsx$/,
  /^src\/shared\/components\/EditContractModal\.tsx$/,
  /^src\/tests\/architect\/capSheet_closure\.gate\.test\.ts$/,
  /^src\/tests\/architect\/architectHardeningE4\.polish\.test\.ts$/,
  /^src\/tests\/architect\/GMDashboard\.smoke\.test\.tsx$/,
  /^src\/tests\/architect\/dashboardWorldBoundary\.e109\.test\.tsx$/,
  /^src\/tests\/smoke\/architect\.uiSmoke\.e1\.test\.tsx$/,
];

const NON_EXECUTION_SUPPORT_PATTERNS = [
  /^docs\/architect\/.*\.md$/,
  /^return_packages\/architect\/.*\.md$/,
];

/**
 * Feature-specific patterns
 */
const FEATURE_PATTERNS = {
  architect: [
    /^src\/features\/architect\//,
    /^src\/tests\/architect\//,
    /^tests\/architect\//,
    /^src\/tests\/tradeMachine\//,
  ],
  trade: [/^src\/features\/trade\//, /^src\/tests\/trade\//, /^tests\/trade\//],
  roster: [/^src\/features\/roster\//, /^src\/tests\/roster\//],
  scouting: [/^src\/features\/scouting\//, /^src\/tests\/scouting\//],
};

function isCapSheetBoundaryChange(changedFiles) {
  const executableFiles = changedFiles.filter(
    (file) =>
      !NON_EXECUTION_SUPPORT_PATTERNS.some((pattern) => pattern.test(file))
  );

  return (
    executableFiles.length > 0 &&
    executableFiles.every((file) =>
      CAP_SHEET_BOUNDARY_PATTERNS.some((pattern) => pattern.test(file))
    )
  );
}

/**
 * Determine which tier to run based on changed files
 */
function selectTestTier(changedFiles) {
  if (changedFiles.length === 0) {
    return { tier: 'fast', reason: 'No changes detected' };
  }

  logVerbose(`Analyzing ${changedFiles.length} changed files...`);

  // Check for Tier 3 triggers
  for (const file of changedFiles) {
    for (const pattern of TIER_3_TRIGGERS) {
      if (pattern.test(file)) {
        logVerbose(`Tier 3 trigger: ${file} matches ${pattern}`);
        return {
          tier: 'full',
          reason: `Shared/config change detected: ${file}`,
          files: changedFiles,
        };
      }
    }
  }

  if (isCapSheetBoundaryChange(changedFiles)) {
    return {
      tier: 'capSheetBoundary',
      reason:
        'Cap Sheet mutation-boundary/dashboard action slice modified',
      files: changedFiles,
    };
  }

  // Check for feature-specific patterns
  const matchedFeatures = new Set();
  for (const file of changedFiles) {
    for (const [feature, patterns] of Object.entries(FEATURE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(file)) {
          matchedFeatures.add(feature);
          logVerbose(`Feature match: ${file} -> ${feature}`);
        }
      }
    }
  }

  // If multiple features matched, run full suite
  if (matchedFeatures.size > 2) {
    return {
      tier: 'full',
      reason: `Multiple features modified: ${Array.from(matchedFeatures).join(', ')}`,
      files: changedFiles,
    };
  }

  // Single feature - run that feature's tests
  if (matchedFeatures.size === 1) {
    const feature = Array.from(matchedFeatures)[0];
    return {
      tier: feature,
      reason: `${feature} feature modified`,
      files: changedFiles,
    };
  }

  // Mixed features - run architect (most comprehensive) if architect is one of them
  if (matchedFeatures.size === 2 && matchedFeatures.has('architect')) {
    return {
      tier: 'architect',
      reason: `Mixed features including architect: ${Array.from(matchedFeatures).join(', ')}`,
      files: changedFiles,
    };
  }

  // Default to fast tests
  return {
    tier: 'fast',
    reason: 'No specific triggers matched',
    files: changedFiles,
  };
}

/**
 * Run the selected test tier
 */
function runTests(selection) {
  const { tier, reason, files } = selection;

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.bright);
  log('  Diff-Based Test Runner', colors.bright);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.bright);
  log('');
  log(`Selected Tier: ${colors.bright}${tier.toUpperCase()}${colors.reset}`);
  log(`Reason: ${reason}`);

  if (VERBOSE && files && files.length > 0) {
    log('');
    log('Changed files:');
    files.forEach((f) => log(`  - ${f}`, colors.blue));
  }

  log('');

  const commands = {
    fast: 'test:fast',
    full: 'test:full',
    architect: 'test:architect',
    capSheetBoundary: 'test:cap-sheet-boundary',
    trade: 'test:trade',
    roster: 'test:roster',
    scouting: 'test:scouting',
  };

  const script = commands[tier];
  if (!script) {
    log(`❌ Unknown tier: ${tier}`, colors.red);
    process.exit(1);
  }

  const displayCommand = `npm run ${script}${
    FORWARDED_ARGS.length > 0 ? ` -- ${FORWARDED_ARGS.join(' ')}` : ''
  }`;

  log(`Running: ${colors.green}${displayCommand}${colors.reset}`);
  log('');

  const result = spawnSync(
    'npm',
    [
      'run',
      script,
      ...(FORWARDED_ARGS.length > 0 ? ['--', ...FORWARDED_ARGS] : []),
    ],
    {
      stdio: 'inherit',
    }
  );

  if (result.status === 0) {
    log('');
    log('✅ Tests passed', colors.green);
  } else {
    log('');
    log('❌ Tests failed', colors.red);
    process.exit(result.status ?? 1);
  }
}

/**
 * Main execution
 */
function main() {
  try {
    // Check if we're in a git repo
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    } catch (err) {
      log('❌ Not a git repository', colors.red);
      log('   Falling back to fast tests');
      runTests({ tier: 'fast', reason: 'Not in git repo' });
      return;
    }

    const changedFiles = getChangedFiles();
    const selection = selectTestTier(changedFiles);
    runTests(selection);
  } catch (err) {
    log(`❌ Error: ${err.message}`, colors.red);
    if (VERBOSE && err.stack) {
      log(err.stack, colors.red);
    }
    process.exit(1);
  }
}

main();
