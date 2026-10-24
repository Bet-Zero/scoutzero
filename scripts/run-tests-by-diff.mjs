#!/usr/bin/env node

// One bounded policy for local test selection and the existing PR validation job.
// Unknown impact is conservative; filenames are not a dependency inference engine.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import ts from 'typescript';

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
  '.cursor/rules/graphify.mdc',
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
  'tests/PoolWorkbench.test.tsx',
  'tests/PoolPanel.test.tsx',
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

// Prove a deliberately small subset of cosmetic edits from source, not a label.
// Only static spacing on a local non-interactive DOM wrapper is automated.
// Color/contrast, responsive/conditional classes, shared tokens and text meaning
// need agent inspection and the ordinary/consequential path when not proven here.
export function isolatedSpacing(file, before, after) {
  if (!/^src\/features\/.*\.tsx$/.test(file) || before === after) return false;
  const mask = (text) => {
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    if (source.parseDiagnostics.length) return null;
    const slots = [];
    const visit = (node) => {
      if (
        ts.isJsxAttribute(node) &&
        node.name.text === 'className' &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        const tag = node.parent.parent.tagName?.getText(source);
        if (
          ['div', 'span', 'section'].includes(tag) &&
          !node.parent.properties.some(
            (attribute) =>
              ts.isJsxSpreadAttribute(attribute) ||
              /^(?:on[A-Z]|role$|tabIndex$|aria-)/.test(
                attribute.name?.getText(source) ?? ''
              )
          )
        ) {
          const value = node.initializer.text;
          const spacing =
            /^(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4)$/;
          if (
            /\b(?:overflow-|fixed|absolute|sticky|h-|max-h-|min-h-)/.test(value)
          )
            return;
          const tokens = value.split(/\s+/);
          slots.push({
            start: node.initializer.getStart(source),
            end: node.initializer.end,
            value,
            masked: tokens
              .map((t) =>
                spacing.test(t) ? t.replace(/-[^-]+$/, '-SPACING') : t
              )
              .join(' '),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    let masked = text;
    for (const slot of [...slots].reverse())
      masked =
        masked.slice(0, slot.start) +
        JSON.stringify(slot.masked) +
        masked.slice(slot.end);
    return { masked, slots };
  };
  const left = mask(before),
    right = mask(after);
  return (
    !!left &&
    !!right &&
    left.masked === right.masked &&
    left.slots.length === right.slots.length &&
    left.slots.filter((slot, i) => slot.value !== right.slots[i].value)
      .length === 1
  );
}

// Closed, inspected view family: SearchBar has only React/lucide imports and
// receives value/onChange; its parent and table/filter consumers are covered.
const TABLE_VIEW =
  'src/features/table/PlayerTable/PlayerTableHeader/SearchBar.tsx';
const TABLE_TESTS = [
  'src/tests/table/tableFiltersUi.smoke.test.tsx',
  'src/tests/table/useFilteredPlayers.test.tsx',
];
const POLICY_FILES =
  /^(?:scripts\/run-tests-by-diff\.mjs|tests\/runTestsByDiff\.test\.ts|tests\/tooling\/phase3aWorkflow\.node-test\.ts|\.github\/workflows\/ci\.yml|\.husky\/(?:pre-commit|pre-push))$/;
const protectedContent =
  /firebase|firestore|localStorage|sessionStorage|indexedDB|globalThis|navigator|XMLHttpRequest|WebSocket|fetch\s*\(|authorization|permission|persist|salary|tradeLegal|sourceQualif|onSave|onDelete|onSubmit|onCommit/i;

function isPresentationLeaf(file, text) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let indirectDependency = false;
  const inspect = (node) => {
    if (
      (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          ['require', 'eval', 'Function'].includes(
            node.expression.getText(source)
          ))) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier)
    )
      indirectDependency = true;
    ts.forEachChild(node, inspect);
  };
  inspect(source);
  return (
    !source.parseDiagnostics.length &&
    !indirectDependency &&
    !protectedContent.test(text) &&
    !/\b(?:window|document|Function)\b/.test(text) &&
    source.statements.every(
      (node) =>
        !ts.isImportDeclaration(node) ||
        [
          'react',
          'lucide-react',
          '@heroicons/react/24/outline',
          '@heroicons/react/24/solid',
        ].includes(node.moduleSpecifier.text)
    )
  );
}

export function selectValidationProfile(files, options = {}) {
  const { uncertain = false, structural = false, contents = {} } = options;
  const docs = files.some((file) => file.endsWith('.md'));
  const profile = (name, level, app, flags, reason) => ({
    name,
    level,
    review:
      level === 'consequential'
        ? 'required'
        : level === 'cosmetic'
          ? 'not-required'
          : 'agent-decides',
    app,
    specialists: false,
    authority: false,
    architect: false,
    draft: false,
    transport: false,
    browser: false,
    cloud: false,
    emulator: false,
    policy: false,
    docs,
    ...flags,
    reason,
  });
  const conservative = (reason) =>
    profile(
      'conservative',
      'consequential',
      true,
      {
        specialists: true,
        authority: true,
        architect: true,
        draft: true,
        transport: true,
        browser: true,
        cloud: true,
        emulator: true,
        policy: true,
      },
      reason
    );
  if (uncertain || structural || !files.length)
    return conservative(
      'Missing comparison, empty diff, or deleted/renamed/type-changed paths'
    );
  if (files.every(isKnownDoc)) {
    const authority = files.some((file) => GOVERNING_DOCS.has(file));
    return profile(
      authority ? 'governing-docs' : 'ordinary-docs',
      authority ? 'consequential' : 'cosmetic',
      false,
      { authority, policy: authority },
      'Inspected documentation surfaces; governing changes retain workflow checks'
    );
  }
  if (
    files.length === 1 &&
    options.localConsumers === true &&
    contents[files[0]] &&
    isolatedSpacing(
      files[0],
      contents[files[0]].before,
      contents[files[0]].after
    )
  )
    return profile(
      'isolated-spacing',
      'cosmetic',
      false,
      {},
      'One static local wrapper spacing value; all other source bytes unchanged. Agent must inspect layout isolation.'
    );
  const executable = files.filter((file) => !isKnownDoc(file));
  const governing = files.some((file) => GOVERNING_DOCS.has(file));
  if (
    executable.some((file) => POLICY_FILES.test(file)) &&
    executable.every((file) => POLICY_FILES.test(file) || isTestFile(file))
  )
    return profile(
      'validation-policy',
      'consequential',
      false,
      { policy: true, authority: true },
      'Selection/workflow policy: adversarial selection and workflow tests, independent review; no product code changed'
    );
  if (executable.every((file) => RANKER_UI.has(file) || isRankerTest(file)))
    return profile(
      'ranker-ui',
      'consequential',
      true,
      { authority: governing, policy: governing },
      'Complete Ranker family includes saved state; independent review remains required for behavior changes'
    );
  if (
    executable.every(
      (file) => file === TABLE_VIEW || TABLE_TESTS.includes(file)
    ) &&
    executable.includes(TABLE_VIEW) &&
    contents[TABLE_VIEW] &&
    [contents[TABLE_VIEW].before, contents[TABLE_VIEW].after].every((text) =>
      isPresentationLeaf(TABLE_VIEW, text)
    )
  )
    return profile(
      'table-view',
      governing ? 'consequential' : 'ordinary',
      true,
      { authority: governing, policy: governing },
      'Local search behavior and complete inspected table/filter consumer tests'
    );
  const localSources = executable.filter((file) => !isTestFile(file));
  // Other isolated presentation leaves use Vitest's existing import graph,
  // not a second dependency engine or a new per-file allowlist. New dependencies,
  // shared consumers, imperative globals and sensitive callbacks stay conservative.
  if (
    localSources.length === 1 &&
    options.localConsumers === true &&
    contents[localSources[0]] &&
    !/\/(?:architect|ranker)\//.test(localSources[0]) &&
    [contents[localSources[0]].before, contents[localSources[0]].after].every(
      (text) => isPresentationLeaf(localSources[0], text)
    )
  )
    return profile(
      'local-ui',
      governing ? 'consequential' : 'ordinary',
      true,
      { authority: governing, policy: governing },
      'Isolated presentation leaf with inspected imports; Vitest selects actual UI test consumers. Agent judges copy/accessibility and review need.'
    );
  // Known application domains retain strong relevant tests, without unrelated
  // source transport/browser/cloud gates. Unknown code/config still fails broad.
  if (executable.every((file) => /^(?:src\/|tests\/.*\.test\.)/.test(file))) {
    const architect = executable.some((file) =>
      /architect|trade|shared|schemas|firebase|stores|context|src\/data\//.test(
        file
      )
    );
    return profile(
      'application',
      'consequential',
      true,
      {
        architect,
        draft: architect,
        emulator: architect,
        authority: governing,
        policy: governing,
        cloud: executable.some((file) =>
          /shared|schemas|ranker\/utils\/playerImpact/.test(file)
        ),
      },
      'Application change: affected application suites and consumers; sensitive/uncertain impact requires independent review'
    );
  }
  return conservative(
    'Unclassified tooling/configuration/source impact requires conservative checks'
  );
}

// A cwd-specific comparison must not follow repository redirects inherited from
// a hook or another checkout. Keep all unrelated environment/credential settings.
export function gitEnvironment(environment = process.env) {
  const redirects = new Set([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_NAMESPACE',
  ]);
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !redirects.has(key))
  );
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    env: gitEnvironment(),
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
    // Bounded isolation check for one leaf, not a dependency graph. A reused
    // component, barrel, ambiguous index name, or cross-feature reference cannot
    // use the cosmetic shortcut. Search both snapshots, including consumers that
    // did not change. False positives deliberately keep the stronger path.
    let localConsumers = false;
    const sourceEntries = [...entries.keys()].filter(
      (file) => !isTestFile(file) && !isKnownDoc(file)
    );
    if (sourceEntries.length === 1) {
      const file = sourceEntries[0];
      const stem = path.basename(file, path.extname(file));
      const family = file.match(/^(src\/features\/[^/]+\/)/)?.[1];
      if (
        family &&
        stem !== 'index' &&
        /^[A-Za-z][A-Za-z0-9]*$/.test(stem) &&
        /\.tsx$/.test(file)
      ) {
        localConsumers = [mergeBase, ci ? head : null].every((ref) => {
          let matches;
          try {
            matches = git(cwd, [
              'grep',
              '-l',
              '-z',
              '-F',
              '-e',
              stem,
              ...(ref ? [ref] : []),
              '--',
              'src',
            ])
              .split('\0')
              .filter(Boolean);
          } catch (error) {
            if (error.status === 1) return true; // unused leaf
            throw error;
          }
          const consumers = matches
            .map((name) => (ref ? name.slice(ref.length + 1) : name))
            .filter((name) => name !== file && !name.startsWith('src/tests/'));
          return (
            consumers.length <= 1 &&
            consumers.every((name) => {
              if (!name.startsWith(family)) return false;
              const text = ref
                ? git(cwd, ['show', `${ref}:${name}`])
                : readFileSync(path.join(cwd, name), 'utf8');
              return !new RegExp(
                `export[\\s\\S]*?from\\s*['"][^'"]*${stem}['"]`
              ).test(text);
            })
          );
        });
      }
    }
    return {
      localConsumers,
      contents: Object.fromEntries(
        [...entries.keys()]
          .filter((file) => /\.tsx$/.test(file) && entries.get(file) === 'M')
          .map((file) => {
            const before = git(cwd, ['show', `${mergeBase}:${file}`]);
            const after = ci
              ? git(cwd, ['show', `${head}:${file}`])
              : readFileSync(path.join(cwd, file), 'utf8');
            return [file, { before, after }];
          })
      ),
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

// Match the existing lint:md scope/exclusions; do not impose new rules on
// historical receipts or hidden instruction files as part of selection.
export function documentationCommands(files) {
  const markdown = files.filter(
    (file) =>
      file.endsWith('.md') &&
      existsSync(file) &&
      (file.startsWith('docs/') || !file.includes('/')) &&
      !file.startsWith('docs/return-packages/') &&
      path.basename(file) !== 'copilot-instructions.md'
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
  if (profile.name === 'isolated-spacing')
    return {
      tier: profile.name,
      reason: profile.reason,
      files,
      commands: [
        {
          executable: 'git',
          args: ['diff', '--check', ...(options.base ? [options.base] : [])],
        },
      ],
    };
  if (profile.name === 'local-ui')
    return {
      tier: profile.name,
      reason: profile.reason,
      files,
      commands: [
        {
          executable: process.execPath,
          args: [
            'node_modules/vitest/vitest.mjs',
            'related',
            ...files.filter((file) => !isTestFile(file) && !isKnownDoc(file)),
            '--run',
            '--config',
            'vitest.ui.config.js',
            '--reporter=dot',
          ],
        },
        ...buildTargetedPlan({
          files,
          nodeTests: files.filter(
            (file) => isTestFile(file) && !isUiTestFile(file)
          ),
          uiTests: files.filter(
            (file) => isTestFile(file) && isUiTestFile(file)
          ),
        }).commands,
      ],
    };
  if (profile.name === 'table-view')
    return buildTargetedPlan({
      tier: profile.name,
      reason: profile.reason,
      files,
      uiTests: TABLE_TESTS,
    });
  if (!profile.app) {
    plan = {
      tier: profile.name,
      reason: profile.reason,
      files,
      commands: documentationCommands(files),
    };
    if (profile.policy)
      plan.commands.push({
        script: 'test:node',
        fileArgs: ['tests/runTestsByDiff.test.ts'],
      });
    const changedTests = files.filter(
      (file) => isTestFile(file) && file !== 'tests/runTestsByDiff.test.ts'
    );
    if (profile.policy && changedTests.length)
      plan.commands.push(
        ...buildTargetedPlan({
          files,
          nodeTests: changedTests.filter((file) => !isUiTestFile(file)),
          uiTests: changedTests.filter(isUiTestFile),
        }).commands
      );
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
    console.log(
      JSON.stringify({ ...changes, contents: undefined, profile }, null, 2)
    );
  if (args.includes('--ci-plan')) {
    if (!ci || !process.env.GITHUB_OUTPUT)
      throw new Error('--ci-plan requires GitHub Actions outputs');
    for (const key of [
      'app',
      'specialists',
      'authority',
      'docs',
      'architect',
      'draft',
      'transport',
      'browser',
      'cloud',
      'emulator',
      'policy',
      'level',
      'review',
    ])
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${profile[key]}\n`);
    const summary = `Validation profile: ${profile.name}; level: ${profile.level}; independent review: ${profile.review}\n${profile.reason}\nBase: ${changes.base}; candidate: ${changes.head}\nChanged paths: ${changes.files.length}. Unselected steps are not executed passes.\n`;
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
