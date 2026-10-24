import { afterEach, describe, expect, it, vi } from 'vitest';
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
  isolatedSpacing,
  documentationCommands,
  gitEnvironment,
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

  it('tests validation policy without unrelated application suites', () => {
    const plan = getPlan(['scripts/run-tests-by-diff.mjs']);

    expect(plan.tier).toBe('validation-policy');
    expect(plan.commands).toContainEqual({
      script: 'test:node',
      fileArgs: ['tests/runTestsByDiff.test.ts'],
    });
    expect(plan.commands).toContainEqual({
      script: 'test:phase3a-workflow',
      fileArgs: [],
    });
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
    [['src/schemas/players.ts'], 'application', true, false, false],
    [['package-lock.json'], 'conservative', true, true, true],
    [['tsconfig.cloud.json'], 'conservative', true, true, true],
    [
      ['.github/workflows/ci.yml', 'scripts/run-tests-by-diff.mjs'],
      'validation-policy',
      false,
      false,
      true,
    ],
    [
      [rankerUi, 'src/features/roster/utils/rosterBuilderHelpers.ts'],
      'application',
      true,
      false,
      false,
    ],
    [
      ['src/features/ranker/utils/playerImpact.ts'],
      'application',
      true,
      false,
      false,
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
    const gates = {
      'Architect cast-ledger gate': 'architect',
      'Draft data architecture boundary': 'draft',
      'Private source review transport boundary': 'transport',
      'Install matching browser for the redirect proof': 'browser',
      'Hosted review browser redirect boundary': 'browser',
      'Cloud development safety tests': 'cloud',
      'Cloud tooling type check': 'cloud',
      'Governed Offer Sheet creation emulator gate': 'emulator',
    };
    for (const [name, flag] of Object.entries(gates))
      expect(conditions[name]).toBe(`steps.scope.outputs.${flag} == 'true'`);
    for (const name of ['Fetch accepted Canon authority ref']) {
      expect(conditions[name]).toBe("steps.scope.outputs.authority == 'true'");
    }
    for (const name of [
      'Validate selection policy',
      'Select candidate validation',
    ]) {
      expect(conditions).toHaveProperty(name);
      expect(conditions[name]).toBeUndefined();
    }
    expect(conditions['Phase 3A workflow tooling']).toBe(
      "steps.scope.outputs.authority == 'true' && steps.scope.outputs.app == 'true'"
    );
    expect(
      ciSteps.findIndex(
        (step) => step.name === 'Fetch accepted Canon authority ref'
      )
    ).toBeLessThan(
      ciSteps.findIndex((step) => step.name === 'Policy implementation checks')
    );
    expect(conditions['Documentation and routing checks']).toBe(
      "steps.scope.outputs.docs == 'true'"
    );
    expect(workflow.jobs['pr-validation'].if).toContain(
      "github.event_name == 'push'"
    );
    expect(workflow.jobs['full-validation'].if).toBe(
      "github.event_name == 'schedule'"
    );
    expect(workflow.jobs['pr-validation'].env.SCOUTZERO_DIFF_BASE).toBe(
      '${{ github.event.pull_request.base.sha || github.event.before }}'
    );
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

  it('keeps changed Markdown within the existing lint scope and exclusions', () => {
    const commands = documentationCommands([
      'README.md',
      'AGENTS.md',
      'docs/INDEX.md',
      '.github/pull_request_template.md',
      '.github/copilot-instructions.md',
      'work/architect-completion/GAP_LEDGER.md',
    ]);
    expect(commands[0].args.slice(1)).toEqual([
      'README.md',
      'AGENTS.md',
      'docs/INDEX.md',
    ]);
    expect(commands[1].script).toBe('docs:guardrails');
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
  vi.unstubAllEnvs();
  for (const dir of temporary.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'scoutzero-diff-'));
  temporary.push(cwd);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      env: gitEnvironment(),
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

  it('does not let inherited Git repository variables redirect candidate detection', () => {
    const intended = fixture();
    const unrelated = fixture();
    intended.write('package.json');
    intended.git('add', '.');
    intended.git('commit', '-m', 'candidate configuration');
    vi.stubEnv('GIT_DIR', path.join(unrelated.cwd, '.git'));
    vi.stubEnv('GIT_WORK_TREE', unrelated.cwd);
    vi.stubEnv('GIT_INDEX_FILE', path.join(unrelated.cwd, '.git/index'));
    const changes = collectChanges({ cwd: intended.cwd, base: intended.base });
    expect(changes.uncertain).toBe(false);
    expect(changes.files).toEqual(['package.json']);
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

// Controlled candidates use temporary git repositories, never product writes or
// dummy PRs. Exercise the actual CLI outputs consumed by both PR and push CI.
describe('proportionate end-to-end selection', () => {
  const local =
    'src/features/table/PlayerTable/PlayerTableHeader/DensityToggle.tsx';
  const search =
    'src/features/table/PlayerTable/PlayerTableHeader/SearchBar.tsx';
  const shared = 'src/shared/utils/contracts/calculateSalary.ts';
  const spacingBefore = readFileSync(local, 'utf8');
  const spacingAfter = spacingBefore.replace('gap-1.5', 'gap-2');
  const searchAfter = readFileSync(search, 'utf8');
  const searchBefore = searchAfter.replace(
    'onChange={onChange}',
    'onChange={() => {}}'
  );

  it.each([
    [
      'isolated visual outside Ranker',
      [[local, spacingBefore, spacingAfter]],
      'cosmetic',
      'not-required',
      false,
    ],
    [
      'localized search behavior',
      [[search, searchBefore, searchAfter]],
      'ordinary',
      'agent-decides',
      true,
    ],
    [
      'shared financial logic',
      [[shared, 'export const salary = 1;', 'export const salary = 2;']],
      'consequential',
      'required',
      true,
    ],
    [
      'cosmetic label hiding financial change',
      [
        [local, spacingBefore, spacingAfter],
        [shared, 'export const salary = 1;', 'export const salary = 2;'],
      ],
      'consequential',
      'required',
      true,
    ],
  ])(
    '%s selects the same obligations locally, in PR and after merge',
    (_name, edits, level, review, app) => {
      const { cwd, git, write } = fixture();
      for (const [file, before] of edits) write(file, before);
      git('add', '.');
      git('commit', '-m', 'controlled baseline');
      const base = git('rev-parse', 'HEAD');
      for (const [file, , after] of edits) write(file, after);
      const localChanges = collectChanges({ cwd, base });
      const localProfile = selectValidationProfile(
        localChanges.files,
        localChanges
      );
      expect(localProfile).toMatchObject({ level, review, app });
      git('add', '.');
      git('commit', '-m', 'cosmetic'); // title is deliberately untrusted
      const head = git('rev-parse', 'HEAD');
      for (const event of ['pull_request', 'push']) {
        const output = path.join(cwd, `output-${event}`);
        const result = spawnSync(
          process.execPath,
          [path.resolve('scripts/run-tests-by-diff.mjs'), '--ci-plan'],
          {
            cwd,
            encoding: 'utf8',
            env: {
              ...process.env,
              GITHUB_ACTIONS: 'true',
              GITHUB_EVENT_NAME: event,
              SCOUTZERO_DIFF_BASE: base,
              SCOUTZERO_DIFF_HEAD: head,
              GITHUB_OUTPUT: output,
            },
          }
        );
        expect(result.status, result.stderr).toBe(0);
        const flags = Object.fromEntries(
          readFileSync(output, 'utf8')
            .trim()
            .split('\n')
            .map((line) => line.split('='))
        );
        expect(flags).toMatchObject({
          level,
          review,
          app: String(app),
          browser: 'false',
          transport: 'false',
        });
        const selected = ciSteps
          .filter(
            (step) =>
              !step.if ||
              step.if
                .replace(/steps.scope.outputs.(\w+)/g, (_, key) =>
                  JSON.stringify(flags[key])
                )
                .split(' && ')
                .every((expr) => {
                  const match = expr.match(/^"([^"\n]*)" (==|!=) '([^']*)'$/);
                  if (!match)
                    throw new Error(`Unexpected CI condition: ${expr}`);
                  return match[2] === '=='
                    ? match[1] === match[3]
                    : match[1] !== match[3];
                })
          )
          .map((step) => step.name);
        expect(selected).not.toContain(
          'Install matching browser for the redirect proof'
        );
        expect(selected.includes('Type check')).toBe(app);
        expect(
          selected.includes('Governed Offer Sheet creation emulator gate')
        ).toBe(level === 'consequential');
        const changes = collectChanges({ cwd, base, head, ci: true });
        expect(selectValidationProfile(changes.files, changes)).toEqual(
          localProfile
        );
        const plan = selectTestPlan(changes.files, changes);
        if (level === 'cosmetic')
          expect(plan.commands.map((command) => command.executable)).toEqual([
            'git',
          ]);
        if (level === 'ordinary') {
          expect(plan.commands).toHaveLength(1);
          expect(plan.commands[0].script).toBe('test:ui');
          expect(plan.commands[0].fileArgs).toContain(
            'src/tests/table/tableFiltersUi.smoke.test.tsx'
          );
        }
        if (level === 'consequential')
          expect(plan.commands[0].script).toBe('test:full');
      }
    }
  );

  it('does not mask behavior, accessible names, color, shared tokens, or conditional classes', () => {
    for (const after of [
      spacingAfter.replace(
        'setMode(DENSITY_MODES.COMPACT)',
        'setMode(DENSITY_MODES.COMFORTABLE)'
      ),
      spacingBefore.replace(
        'aria-label="Compact density"',
        'aria-label="Other"'
      ),
      spacingBefore.replace('text-neutral-500', 'text-neutral-400'),
      spacingBefore.replace('gap-1.5', 'gap-1.5 hidden'),
    ])
      expect(isolatedSpacing(local, spacingBefore, after)).toBe(false);
    expect(
      isolatedSpacing('src/shared/Token.tsx', spacingBefore, spacingAfter)
    ).toBe(false);
    expect(
      isolatedSpacing(local, spacingBefore, spacingAfter + '\ninvalid {')
    ).toBe(false);
    expect(selectValidationProfile([local], { contents: {} }).level).toBe(
      'consequential'
    );
  });

  it.each([
    'src/features/table/OtherConsumer.tsx',
    'src/features/roster/OtherConsumer.tsx',
  ])('rejects reused or cross-feature cosmetic consumers: %s', (consumer) => {
    const { cwd, git, write } = fixture();
    write(local, spacingBefore);
    write(
      'src/features/table/Parent.tsx',
      "import { DensityToggle } from './PlayerTable/PlayerTableHeader/DensityToggle';"
    );
    write(
      consumer,
      "import { DensityToggle } from '@/features/table/PlayerTable/PlayerTableHeader/DensityToggle';"
    );
    git('add', '.');
    git('commit', '-m', 'consumers');
    const base = git('rev-parse', 'HEAD');
    write(local, spacingAfter);
    const changes = collectChanges({ cwd, base });
    expect(changes.localConsumers).toBe(false);
    expect(selectValidationProfile(changes.files, changes).level).toBe(
      'consequential'
    );
  });

  it('keeps review/validation edits consequential even when paired with cosmetics', () => {
    const files = [local, 'AGENTS.md'];
    expect(
      selectValidationProfile(files, {
        contents: { [local]: { before: spacingBefore, after: spacingAfter } },
      })
    ).toMatchObject({
      level: 'consequential',
      review: 'required',
      authority: true,
    });
  });
});
