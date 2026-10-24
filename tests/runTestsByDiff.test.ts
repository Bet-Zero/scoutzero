import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';

import {
  collectChanges,
  executePlan,
  selectTestPlan,
  selectValidationProfile,
} from '../scripts/run-tests-by-diff.mjs';

const AVAILABLE_TEST_FILES = [
  'src/tests/architect/useArchitectActions.freeAgency.test.tsx',
  'src/tests/architect/freeAgency_closure.gate.test.ts',
  'src/tests/architect/offerSheets_closure.gate.test.ts',
  'src/tests/architect/OfferSheetList.freeAgency.test.jsx',
  'src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx',
  'src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx',
  'src/tests/architect/dashboardWorldBoundary.e109.test.tsx',
  'src/tests/architect/capSheet_closure.gate.test.ts',
  'src/tests/architect/architectHardeningE4.polish.test.ts',
  'src/tests/architect/GMDashboard.smoke.test.tsx',
  'src/tests/smoke/architect.uiSmoke.e1.test.tsx',
];

function getPlan(changedFiles: string[]) {
  return selectTestPlan(changedFiles, {
    availableTestFiles: AVAILABLE_TEST_FILES,
  });
}

describe('run-tests-by-diff', () => {
  it('does not infer safety from Markdown extensions or historical receipt directories', () => {
    const plan = getPlan([
      'docs/_working/architect/free-agency/ARCHITECT_FREE_AGENCY_ACTION_BREAKDOWN.md',
      'return_packages/architect/ARCHITECT_FREE_AGENCY_7A_7B_EXECUTION_RETURN_PACKAGE.md',
    ]);

    expect(plan.tier).toBe('full');
    expect(plan.commands).toEqual([{ script: 'test:full', fileArgs: [] }]);
  });

  it('runs full validation for shared tooling changes', () => {
    const plan = getPlan(['scripts/run-tests-by-diff.mjs']);

    expect(plan.tier).toBe('full');
    expect(plan.commands).toEqual([{ script: 'test:full', fileArgs: [] }]);
  });

  it('does not narrow shared consumers to a named boundary', () => {
    const plan = getPlan([
      'src/shared/components/EditContractModal.tsx',
      'src/tests/architect/capSheet_closure.gate.test.ts',
    ]);
    expect(plan.tier).toBe('full');
  });

  it('infers targeted free-agency tests instead of broad architect fallback', () => {
    const plan = getPlan([
      'src/features/architect/GMDashboard/hooks/useArchitectActions.ts',
      'src/features/architect/GMDashboard/sections/FreeAgencySection.tsx',
      'src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx',
    ]);

    expect(plan.tier).toBe('freeAgencyBoundary');
    expect(plan.commands).toEqual([
      {
        script: 'test:node',
        fileArgs: [
          'src/tests/architect/freeAgency_closure.gate.test.ts',
          'src/tests/architect/offerSheets_closure.gate.test.ts',
        ],
      },
      {
        script: 'test:ui',
        fileArgs: [
          'src/tests/architect/OfferSheetList.freeAgency.test.jsx',
          'src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx',
          'src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx',
          'src/tests/architect/useArchitectActions.freeAgency.test.tsx',
          'src/tests/architect/dashboardWorldBoundary.e109.test.tsx',
        ],
      },
    ]);
  });

  it('uses full coverage when impact is unknown', () => {
    const plan = getPlan([
      'src/features/architect/offseason/DraftPickTracker/UnknownSurface.tsx',
    ]);

    expect(plan.tier).toBe('full');
    expect(plan.commands).toEqual([{ script: 'test:full', fileArgs: [] }]);
  });
});

const rankerUi = 'src/features/ranker/RankingSetup.tsx';
const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
const ciSteps = workflow.jobs['pr-validation'].steps;

describe('bounded CI validation policy', () => {
  it.each([
    [['docs/INDEX.md'], 'ordinary-docs', false, false, false],
    [
      ['AGENTS.md', 'docs/agent-guides/independent-review-boundary.md'],
      'governing-docs',
      false,
      false,
      true,
    ],
    [
      [rankerUi, 'tests/RankingSetup.test.tsx'],
      'ranker-ui',
      true,
      false,
      false,
    ],
    [['src/schemas/players.ts'], 'conservative', true, true, true],
    [['package-lock.json'], 'conservative', true, true, true],
    [['tsconfig.cloud.json'], 'conservative', true, true, true],
    [
      ['.github/workflows/ci.yml', 'scripts/run-tests-by-diff.mjs'],
      'conservative',
      true,
      true,
      true,
    ],
    [
      [rankerUi, 'src/features/roster/utils/rosterBuilderHelpers.ts'],
      'conservative',
      true,
      true,
      true,
    ],
    [
      ['src/features/ranker/utils/playerImpact.ts'],
      'conservative',
      true,
      true,
      true,
    ],
    [
      ['docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md'],
      'conservative',
      true,
      true,
      true,
    ],
    [['tests/tooling/cloudDev.node-test.ts'], 'conservative', true, true, true],
    [[], 'conservative', true, true, true],
  ])(
    'classifies %j without guessing dependencies',
    (files, name, app, specialists, authority) => {
      expect(selectValidationProfile(files)).toMatchObject({
        name,
        app,
        specialists,
        authority,
      });
    }
  );

  it('uses conservative coverage for missing history and structural changes even on known docs', () => {
    for (const options of [{ uncertain: true }, { structural: true }]) {
      expect(selectValidationProfile(['docs/INDEX.md'], options)).toMatchObject(
        { app: true, specialists: true, authority: true }
      );
      expect(
        selectTestPlan(['docs/INDEX.md'], {
          ...options,
          availableTestFiles: [],
        }).tier
      ).toBe('full');
    }
  });

  it('preserves authority checks when governing docs accompany Ranker UI', () => {
    expect(selectValidationProfile([rankerUi, 'AGENTS.md'])).toMatchObject({
      name: 'ranker-ui',
      app: true,
      authority: true,
    });
  });

  it('runs the complete Ranker family, including persistence and cross-component consumers', () => {
    const plan = selectTestPlan([rankerUi]);
    expect(plan.tier).toBe('ranker-ui');
    const tests = plan.commands.flatMap((command) => command.fileArgs);
    expect(tests).toEqual(
      expect.arrayContaining([
        'tests/RankingSetup.test.tsx',
        'tests/RankingSessionUndo.test.tsx',
        'tests/rankerLocalDraft.test.ts',
        'tests/rankerSessionSerialization.test.ts',
        'src/tests/ranker/useRankerSession.test.tsx',
        'tests/rankerSaveAsList.test.ts',
        'src/tests/ranker/playerImpact.test.ts',
      ])
    );
    expect(tests).not.toContain(
      'src/tests/architect/capSheet_closure.gate.test.ts'
    );
  });

  it('keeps changed tests and native suites executable', () => {
    expect(getPlan(['tests/rankingEngine.test.ts']).commands).toContainEqual({
      script: 'test:node',
      fileArgs: ['tests/rankingEngine.test.ts'],
    });
    const native = selectTestPlan(['tests/tooling/cloudDev.node-test.ts']);
    expect(native.commands[0].script).toBe('test:full');
    expect(native.commands[1].args).toContain(
      'tests/tooling/cloudDev.node-test.ts'
    );
  });

  it('guards the surrounding CI steps, not just the diff runner', () => {
    const conditions = Object.fromEntries(
      ciSteps.map((step) => [step.name, step.if])
    );
    for (const name of [
      'Type check',
      'Run diff-based tests',
      'Validate project schema',
      'Build',
    ]) {
      expect(conditions[name]).toBe("steps.scope.outputs.app == 'true'");
    }
    for (const name of [
      'Architect cast-ledger gate',
      'Draft data architecture boundary',
      'Private source review transport boundary',
      'Install matching browser for the redirect proof',
      'Hosted review browser redirect boundary',
      'Cloud development safety tests',
      'Cloud tooling type check',
      'Governed Offer Sheet creation emulator gate',
    ]) {
      expect(conditions[name]).toBe(
        "steps.scope.outputs.specialists == 'true'"
      );
    }
    for (const name of [
      'Fetch accepted Canon authority ref',
      'Phase 3A workflow tooling',
    ]) {
      expect(conditions[name]).toBe("steps.scope.outputs.authority == 'true'");
    }
    for (const name of [
      'Validate selection policy',
      'Select candidate validation',
      'Documentation and routing checks',
    ]) {
      expect(conditions).toHaveProperty(name);
      expect(conditions[name]).toBeUndefined();
    }
    expect(workflow.jobs['pr-validation'].name).toBe(
      'PR Validation (Diff-based)'
    );
    expect(workflow.on.pull_request.paths).toBeUndefined();
    expect(workflow.jobs['pr-validation'].env.SCOUTZERO_DIFF_HEAD).toBe(
      '${{ github.sha }}'
    );
    expect(
      workflow.jobs['full-validation'].steps.every(
        (step) => step.if === undefined
      )
    ).toBe(true);
    expect(
      workflow.jobs['full-validation'].steps.some(
        (step) => step.run === 'npm run test:full'
      )
    ).toBe(true);
    expect(workflow.on.schedule).toEqual([{ cron: '0 2 * * *' }]);
  });

  it('does not turn an executed failure or missing executable into success', () => {
    const plan = {
      tier: 'test',
      reason: 'controlled assertion failure',
      commands: [{ script: 'test:node', fileArgs: ['tests/example.test.ts'] }],
    };
    for (const result of [
      { status: 23 },
      { status: null, error: new Error('missing executable') },
    ]) {
      expect(() => executePlan(plan, { spawn: () => result })).toThrow(
        'Selected check failed'
      );
    }
    expect(() =>
      executePlan(plan, { spawn: () => ({ status: 0 }) })
    ).not.toThrow();
  });

  it('propagates a real failing assertion from a selected command', () => {
    const plan = {
      tier: 'counterfactual',
      reason: 'synthetic assertion, no product mutation',
      commands: [
        {
          executable: process.execPath,
          args: ['-e', "require('node:assert/strict').equal(1, 2)"],
        },
      ],
    };
    expect(() =>
      executePlan(plan, {
        spawn: (file, args) => spawnSync(file, args, { stdio: 'pipe' }),
      })
    ).toThrow('Selected check failed (1)');
  });

  it('never forwards Vitest flags to native or documentation commands', () => {
    const calls: string[][] = [];
    executePlan(
      {
        tier: 'docs',
        reason: 'controlled invocation',
        commands: [
          { script: 'docs:guardrails', fileArgs: [] },
          { script: 'test:phase3a-workflow', fileArgs: [] },
        ],
      },
      {
        forwarded: ['--reporter=dot'],
        spawn: (_file, args) => {
          calls.push(args);
          return { status: 0 };
        },
      }
    );
    expect(calls).toEqual([
      ['run', 'docs:guardrails'],
      ['run', 'test:phase3a-workflow'],
    ]);
  });
});

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'scoutzero-diff-'));
  temporary.push(cwd);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  git('config', 'user.email', 'selector-test@example.invalid');
  git('config', 'user.name', 'Selector fixture');
  const write = (file: string, content = file) => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), content);
  };
  write('README.md', '# Initial\n');
  write('original file.ts', 'export const original = true;\n');
  git('add', '.');
  git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  git('switch', '-c', 'candidate');
  return { cwd, git, write, base };
}

describe('complete-candidate detection', () => {
  it('unions every commit, staged, unstaged and untracked changes locally', () => {
    const { cwd, git, write, base } = fixture();
    write('docs/INDEX.md');
    git('add', '.');
    git('commit', '-m', 'first');
    write('package.json');
    git('add', '.');
    git('commit', '-m', 'second');
    write('AGENTS.md');
    git('add', '.');
    write('README.md', '# Modified\n');
    write('untracked\nfile.ts');
    expect(collectChanges({ cwd, base })).toMatchObject({
      uncertain: false,
      files: [
        'AGENTS.md',
        'README.md',
        'docs/INDEX.md',
        'package.json',
        'untracked\nfile.ts',
      ],
    });
    const candidate = collectChanges({
      cwd,
      base,
      head: git('rev-parse', 'HEAD'),
      ci: true,
    });
    expect(candidate.files).toEqual(['docs/INDEX.md', 'package.json']);
    expect(selectValidationProfile(candidate.files, candidate).name).toBe(
      'conservative'
    );
  });

  it('retains both rename paths and deleted files instead of hiding their previous impact', () => {
    const { cwd, git, write, base } = fixture();
    renameSync(
      path.join(cwd, 'original file.ts'),
      path.join(cwd, 'renamed file.ts')
    );
    rmSync(path.join(cwd, 'README.md'));
    write('docs/INDEX.md');
    git('add', '.');
    git('commit', '-m', 'rename and delete');
    const changes = collectChanges({
      cwd,
      base,
      head: git('rev-parse', 'HEAD'),
      ci: true,
    });
    expect(changes).toMatchObject({
      structural: true,
      uncertain: false,
      files: [
        'README.md',
        'docs/INDEX.md',
        'original file.ts',
        'renamed file.ts',
      ],
    });
    expect(selectValidationProfile(changes.files, changes).name).toBe(
      'conservative'
    );
  });

  it('fails conservatively on absent history, empty ranges and an incorrect checked-out head', () => {
    const { cwd, git, write, base } = fixture();
    expect(collectChanges({ cwd, base: 'missing-ref' }).uncertain).toBe(true);
    expect(collectChanges({ cwd, base: undefined, ci: true }).uncertain).toBe(
      true
    );
    const empty = collectChanges({ cwd, base, head: base, ci: true });
    expect(selectValidationProfile(empty.files, empty).name).toBe(
      'conservative'
    );
    write('docs/INDEX.md');
    git('add', '.');
    git('commit', '-m', 'advance');
    expect(collectChanges({ cwd, base, head: base, ci: true }).uncertain).toBe(
      true
    );
  });

  it('publishes truthful CI selection and forbids an explicit partial file list in CI', () => {
    const { cwd, git, write, base } = fixture();
    write('docs/INDEX.md');
    git('add', '.');
    git('commit', '-m', 'docs');
    const output = path.join(cwd, 'outputs');
    const summary = path.join(cwd, 'summary');
    const script = path.resolve('scripts/run-tests-by-diff.mjs');
    const env = {
      ...process.env,
      GITHUB_ACTIONS: 'true',
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      SCOUTZERO_DIFF_BASE: base,
      SCOUTZERO_DIFF_HEAD: git('rev-parse', 'HEAD'),
    };
    const selected = spawnSync(process.execPath, [script, '--ci-plan'], {
      cwd,
      env,
      encoding: 'utf8',
    });
    expect(selected.status).toBe(0);
    expect(readFileSync(output, 'utf8')).toContain(
      'app=false\nspecialists=false\nauthority=false'
    );
    expect(readFileSync(summary, 'utf8')).toContain(
      'Unselected steps are not executed passes'
    );
    const partial = spawnSync(
      process.execPath,
      [script, '--ci-plan', '--files', 'README.md'],
      { cwd, env, encoding: 'utf8' }
    );
    expect(partial.status).toBe(1);
    expect(readFileSync(output, 'utf8').split('app=').length).toBe(2);
    const missingHistory = spawnSync(process.execPath, [script, '--ci-plan'], {
      cwd,
      env: { ...env, SCOUTZERO_DIFF_BASE: '0'.repeat(40) },
      encoding: 'utf8',
    });
    expect(missingHistory.status).toBe(1);
    expect(readFileSync(output, 'utf8').split('app=').length).toBe(2);
  });
});
