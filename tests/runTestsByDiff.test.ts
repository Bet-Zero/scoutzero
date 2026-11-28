import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
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
  gitEnvironment,
  presentationOnly,
  readDeclarations,
  selectValidationProfile,
  selectTestPlan,
  executePlan,
  packageScriptsOnly,
  RUNNER_SCRIPTS,
} from '../scripts/run-tests-by-diff.mjs';

const temporary: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of temporary.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'scoutzero-scope-'));
  temporary.push(cwd);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      env: gitEnvironment(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const write = (file: string, content = file) => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), content);
  };
  git('init', '-b', 'main');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Fixture');
  write('README.md', '# Base');
  git('add', '.');
  git('commit', '-m', 'base');
  return { cwd, git, write, base: git('rev-parse', 'HEAD') };
}
const empty = () => ({
  node: [],
  ui: [],
  native: [],
  emulator: [],
  functions: [],
});
const room = 'src/features/architect/cockpit/RoomFrame.tsx';
const before = readFileSync(room, 'utf8').replace(
  /border-b border-[^\s\"]+/,
  'border-b border-red-500'
);
const after = before.replace('border-red-500', 'border-blue-500');
const opts = { contents: { [room]: { before, after } } };
const hook = 'src/features/filters/hooks/useActiveFilterCount.ts';
const regression = 'src/tests/filters/useActiveFilterCount.test.tsx';

describe('actual change rather than feature responsibility', () => {
  it('proves red-to-blue presentation in real Architect code without erasing behavior', async () => {
    expect(presentationOnly(room, before, after)).toBe(true);
    const plan = await selectTestPlan([room], {
      ...opts,
      discover: async () => {
        throw new Error('presentation should not discover financial suites');
      },
    });
    expect(plan.profile).toMatchObject({
      level: 'cosmetic',
      build: true,
      typecheck: false,
    });
    expect(plan.commands.map((c) => c.script).filter(Boolean)).toEqual([
      'build',
    ]);
  });
  it('supports multiple presentation files and harmless docs/test changes across areas', async () => {
    const ranker = 'src/features/ranker/PoolWorkbench.tsx';
    const text = readFileSync(ranker, 'utf8').replace(
      /\bgap-\d+(?:\.\d+)?\b/,
      'gap-2'
    );
    const contents = {
      ...opts.contents,
      [ranker]: {
        before: text,
        after: text.replace(/\bgap-2\b/, 'gap-3'),
      },
    };
    const plan = await selectTestPlan([room, ranker, 'README.md', regression], {
      contents,
      discover: async () => ({ ...empty(), ui: [regression] }),
    });
    expect(plan.profile.level).toBe('cosmetic');
    expect(plan.selected.ui).toEqual([regression]);
    expect(plan.commands.some((c) => c.script === 'test:full')).toBe(false);
  });
  it.each([
    after.replace('hideHeader = false', 'hideHeader = true'),
    after.replace('aria-label={title}', 'aria-label="Other"'),
    after.replace('flex h-full', 'hidden h-full'),
    after + '\nimport "@/firebase/write";',
    after + '\ninvalid {',
  ])(
    'rejects hidden behavior, accessibility, visibility and dependency changes',
    (candidate) => {
      expect(presentationOnly(room, before, candidate)).toBe(false);
    }
  );
  it('does not mask status/error text or shared CSS tokens', () => {
    expect(
      presentationOnly('x.tsx', '<p>Trade blocked</p>', '<p>Trade approved</p>')
    ).toBe(false);
    expect(
      presentationOnly(
        'src/index.css',
        '.danger{color:red}',
        '.danger{color:blue}'
      )
    ).toBe(false);
  });
  it('keeps ordinary behavior with a regression and a second file ordinary', async () => {
    const inputs: string[][] = [];
    const plan = await selectTestPlan(
      [hook, 'src/features/filters/filterTypes.ts', regression],
      {
        discover: async (files) => {
          inputs.push(files);
          return { ...empty(), ui: [regression] };
        },
      }
    );
    expect(plan.profile.level).toBe('ordinary');
    expect(inputs[0]).toEqual([
      hook,
      'src/features/filters/filterTypes.ts',
      regression,
    ]);
    expect(plan.commands.filter((c) => c.script === 'test:ui')).toEqual([
      { script: 'test:ui', fileArgs: [regression] },
    ]);
    expect(plan.commands.some((c) => c.script === 'test:full')).toBe(false);
  });
  it('selects consequences and consumers, not an Architect emulator switch', async () => {
    const plan = await selectTestPlan(
      ['src/features/architect/cockpit/RoomFrame.tsx'],
      {
        discover: async () => ({
          ...empty(),
          ui: ['src/tests/architect/cockpit/CockpitShell.smoke.test.tsx'],
        }),
      }
    );
    expect(plan.profile.level).toBe('ordinary');
    expect(plan.selected.emulator).toEqual([]);
    expect(plan.commands.some((c) => c.args?.includes('emulators:exec'))).toBe(
      false
    );
  });
  it('treats changed utilities as ordinary behavior without a full suite', () => {
    for (const file of [
      hook,
      'src/shared/utils/routing/playerRouteUtils.ts',
      'src/features/architect/utils/seasonFormat.ts',
      'src/features/architect/GMDashboard/hooks/useArchitectModals.ts',
      'src/features/architect/utils/capTotals/computeTeamCapTotals.ts',
      'functions/src/architect/initializeWorld.ts',
      'firestore.rules',
      room,
    ]) {
      expect(selectValidationProfile([file])).toMatchObject({
        level: 'ordinary',
        broadReasons: [],
      });
    }
  });
  it('treats an added import as behavior and an unchanged one as presentation', () => {
    const typeOnly =
      "import type {SalaryProfile} from '@/features/architect/utils/salaryEngine/salaryEngine';\n";
    expect(
      selectValidationProfile([room], {
        contents: { [room]: { before, after: typeOnly + after } },
      })
    ).toMatchObject({ level: 'ordinary' });
    const dependency = "import {db} from '@/firebaseConfig';\n";
    expect(
      selectValidationProfile([room], {
        contents: {
          [room]: { before: dependency + before, after: dependency + after },
        },
      })
    ).toMatchObject({ level: 'cosmetic' });
    const source = readFileSync(hook, 'utf8');
    expect(
      selectValidationProfile([hook], {
        contents: {
          [hook]: {
            before: source,
            after: source.replace('count += value.length', 'count += 1'),
          },
        },
      })
    ).toMatchObject({ level: 'ordinary' });
  });
  it('behavior changes cannot hide behind presentation or an unchecked label', async () => {
    const file =
      'src/features/architect/utils/capTotals/computeTeamCapTotals.ts';
    const plan = await selectTestPlan([room, file], {
      ...opts,
      label: 'cosmetic',
      discover: async (inputs) => {
        expect(inputs).toEqual([file]);
        return { ...empty(), node: ['tests/computeTeamCapTotals.test.ts'] };
      },
    });
    expect(plan.profile.level).toBe('ordinary');
    expect(plan.commands.some((c) => c.script === 'test:full')).toBe(false);
    expect(plan.selected.node).toEqual(['tests/computeTeamCapTotals.test.ts']);
  });
  it('runner and rules changes run the runner tests through the import graph and lint the docs', async () => {
    const plan = await selectTestPlan(
      ['scripts/run-tests-by-diff.mjs', 'AGENTS.md'],
      {
        discover: async () => ({
          ...empty(),
          node: ['tests/runTestsByDiff.test.ts'],
        }),
      }
    );
    expect(plan.selected.node).toEqual(['tests/runTestsByDiff.test.ts']);
    expect(plan.selected.native).toEqual([]);
    expect(plan.commands.some((c) => c.script === 'test:full')).toBe(false);
    expect(
      plan.commands.some((c) =>
        c.args?.some((arg) => arg.endsWith('markdownlint.js'))
      )
    ).toBe(true);
  });
  it('runs tests that read changed files by path', async () => {
    const canon = await selectTestPlan(['docs/reference/cba/README.md'], {
      discover: async () => empty(),
    });
    expect(canon.selected.native).toEqual([
      'tests/tooling/phase3aWorkflow.node-test.ts',
    ]);
    expect(canon.commands.some((c) => c.args?.includes('fetch'))).toBe(true);
    const ci = await selectTestPlan(['.github/workflows/ci.yml'], {
      discover: async () => empty(),
    });
    expect(ci.selected.node).toEqual(['tests/runTestsByDiff.test.ts']);
    const review = await selectTestPlan(
      ['.github/workflows/claude-independent-review.yml'],
      { discover: async () => empty() }
    );
    expect(review.selected.native).toEqual([
      'tests/tooling/claudeIndependentReview.node-test.ts',
    ]);
  });
  it('runs the full suite for dependency or runner-script changes, not helper scripts', async () => {
    const base = JSON.stringify(
      {
        name: 'x',
        scripts: { build: 'vite build', helper: 'a' },
        dependencies: { a: '1' },
      },
      null,
      2
    );
    const helper = base.replace('"helper": "a"', '"helper": "b", "other": "c"');
    const removed = base.replace(',\n    "helper": "a"', '');
    const runner = base.replace('vite build', 'vite build --mode x');
    const dependency = base.replace('"a": "1"', '"a": "2"');
    expect(removed).not.toContain('helper');
    expect(packageScriptsOnly(base, helper)).toBe(true);
    expect(packageScriptsOnly(base, removed)).toBe(true);
    expect(packageScriptsOnly(base, runner)).toBe(false);
    expect(packageScriptsOnly(base, dependency)).toBe(false);
    expect(packageScriptsOnly(base, '{')).toBe(false);
    const plan = (after: string) =>
      selectTestPlan(['package.json'], {
        contents: { 'package.json': { before: base, after } },
        discover: async () => {
          throw new Error('helper scripts are not behavior');
        },
      });
    for (const after of [helper, removed]) {
      const result = await plan(after);
      expect(result.commands.some((c) => c.script === 'test:full')).toBe(false);
      expect(result.profile.level).toBe('cosmetic');
    }
    for (const after of [runner, dependency]) {
      const result = await selectTestPlan(['package.json'], {
        contents: { 'package.json': { before: base, after } },
        discover: async () => empty(),
      });
      expect(result.commands.some((c) => c.script === 'test:full')).toBe(true);
    }
    expect(
      (
        await selectTestPlan(['package.json'], {
          discover: async () => empty(),
        })
      ).commands.some((c) => c.script === 'test:full')
    ).toBe(true);
  });
  it('treats every npm script a workflow runs as a runner script', () => {
    const workflows = readdirSync('.github/workflows').filter((file) =>
      file.endsWith('.yml')
    );
    const invoked = workflows.flatMap((file) =>
      [
        ...readFileSync(path.join('.github/workflows', file), 'utf8').matchAll(
          /npm run ([\w:-]+)/g
        ),
      ].map((match) => match[1])
    );
    expect(invoked.length).toBeGreaterThan(0);
    expect(invoked.filter((script) => !RUNNER_SCRIPTS.has(script))).toEqual([]);
  });
  it('keeps a scoped tooling type configuration out of full application validation', async () => {
    const plan = await selectTestPlan(['tsconfig.cloud.json'], {
      discover: async () => empty(),
    });
    expect(plan.profile).toMatchObject({
      build: false,
      typecheck: false,
      broadReasons: [],
    });
    expect(plan.commands.filter((c) => c.script).map((c) => c.script)).toEqual([
      'cloud:typecheck',
    ]);
  });
  it.each(['server/draftReview.ts', 'api/architect/draft-review.ts'])(
    'uses the existing server/API type contract without an unrelated UI build: %s',
    async (file) => {
      const plan = await selectTestPlan([file], {
        discover: async () => empty(),
      });
      expect(plan.profile.broadReasons).toEqual([]);
      expect(
        plan.commands.filter((c) => c.script).map((c) => c.script)
      ).toEqual(['typecheck']);
    }
  );
  it('builds Functions and runs their discovered tests once, without app suites or emulators', async () => {
    const plan = await selectTestPlan(
      ['functions/src/architect/trustedContractBaseline.ts'],
      {
        discover: async () => ({
          ...empty(),
          functions: [
            'functions/src/architect/trustedContractBaseline.test.ts',
            'functions/src/architect/trustedContractBaseline.test.ts',
          ],
        }),
      }
    );
    expect(plan.profile.broadReasons).toEqual([]);
    expect(plan.commands.filter((c) => c.script)).toEqual([]);
    expect(plan.commands.map((c) => c.args)).toEqual([
      ['diff', '--check'],
      [
        '--prefix',
        'functions',
        'ci',
        '--include=dev',
        '--no-audit',
        '--no-fund',
      ],
      ['--prefix', 'functions', 'run', 'build'],
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--root',
        'functions',
        '--config',
        '../vitest.config.js',
        '--reporter=dot',
        'src/architect/trustedContractBaseline.test.ts',
      ],
    ]);
  });
  it('only starts specialists when their tests are selected', async () => {
    const plan = await selectTestPlan([hook], {
      discover: async () => ({
        ...empty(),
        emulator: ['tests/example.emulator.test.ts'],
        native: ['tests/tooling/hostedDraftReviewBrowser.node-test.ts'],
      }),
    });
    expect(
      plan.commands.filter((c) => c.args?.includes('emulators:exec'))
    ).toHaveLength(1);
    expect(
      plan.commands.filter((c) => c.args?.includes('chromium'))
    ).toHaveLength(1);
  });
  it('reports absent test coverage without inventing a ceremonial test or a pass', async () => {
    const plan = await selectTestPlan([hook], {
      discover: async () => empty(),
    });
    expect(plan.gaps[0]).toContain('not an automated test pass');
    expect(plan.commands.some((c) => c.script === 'test:full')).toBe(false);
    expect(plan.commands.some((c) => c.script === 'build')).toBe(true);
  });
  it('requires complete execution coverage for changed and declared tests', async () => {
    await expect(
      selectTestPlan([regression], { discover: async () => empty() })
    ).rejects.toThrow('not covered');
    const { cwd, write } = fixture();
    write(
      'src/feature.test.ts',
      'throw new Error(\"unconfigured regression\");'
    );
    await expect(
      selectTestPlan(['src/feature.test.ts'], {
        cwd,
        discover: async () => empty(),
      })
    ).rejects.toThrow('not covered');
  });
  it('requires a concrete broad reason; no directory alone requests a full suite', async () => {
    expect(() => readDeclarations('Validation-Full: because')).toThrow(
      'concrete'
    );
    const declarations = readDeclarations(
      'Validation-Full: Vite plugin changes module resolution for every consumer'
    );
    const plan = await selectTestPlan([hook], {
      declarations,
      discover: async () => empty(),
    });
    expect(plan.commands.filter((c) => c.script === 'test:full')).toHaveLength(
      1
    );
  });
  it('additive declarations cannot remove automatic tests', async () => {
    const declarations = readDeclarations(
      `Validation-Tests: ["${regression}"]\nValidation-Level: cosmetic`
    );
    const plan = await selectTestPlan([hook], {
      declarations,
      discover: async (inputs) => {
        expect(inputs).toContain(regression);
        return { ...empty(), ui: [regression] };
      },
    });
    expect(plan.selected.ui).toEqual([regression]);
    expect(() =>
      readDeclarations('Validation-Tests: ["../escape.test.ts"]')
    ).toThrow();
  });
  it('reads NUL-separated commit bodies without requiring a final newline', () => {
    expect(
      readDeclarations(
        `Validation-Tests: ["${regression}"]\0\nValidation-Review: required\0`
      )
    ).toEqual({ tests: [regression], broadReasons: [] });
    // Separators do not relax malformed JSON or repository-path checks.
    expect(() =>
      readDeclarations('Validation-Tests: ["test.ts"]junk\0')
    ).toThrow();
    expect(() =>
      readDeclarations('Validation-Tests: ["../escape.test.ts"]\0')
    ).toThrow();
  });
  it('never turns command failures or missing executables into passes', () => {
    for (const result of [
      { status: 1 },
      { status: null },
      { status: 0, error: new Error('spawn failed') },
    ])
      expect(() =>
        executePlan(
          {
            tier: 'ordinary',
            reason: 'probe',
            commands: [{ script: 'test:ui', fileArgs: [regression] }],
          },
          { spawn: () => result }
        )
      ).toThrow('Selected check failed');
    expect(() =>
      executePlan(
        {
          tier: 'ordinary',
          reason: 'real assertion',
          commands: [
            {
              executable: process.execPath,
              args: ['-e', 'require("node:assert/strict").equal(1,2)'],
            },
          ],
        },
        { spawn: (file, args) => spawnSync(file, args, { stdio: 'pipe' }) }
      )
    ).toThrow('Selected check failed (1)');
  });
});

describe('complete comparison and delivery path', () => {
  it('preserves every commit, staged, unstaged, untracked and both rename paths', () => {
    const { cwd, git, write, base } = fixture();
    write(hook, 'export const count=0;');
    git('add', '.');
    git('commit', '-m', 'first');
    write('other.ts', 'export const other=1;');
    git('add', '.');
    git(
      'commit',
      '-m',
      `second\n\nValidation-Full: Vite plugin changes module resolution everywhere`
    );
    renameSync(path.join(cwd, 'other.ts'), path.join(cwd, 'renamed.ts'));
    git('add', '.');
    write('README.md', '# Changed');
    write('untracked\nfile.ts', 'x');
    const changes = collectChanges({ cwd, base });
    expect(changes).toMatchObject({ uncertain: false, structural: true });
    expect(changes.files).toEqual(
      ['README.md', 'other.ts', 'renamed.ts', hook, 'untracked\nfile.ts'].sort()
    );
    expect(changes.declarations.broadReasons).toHaveLength(1);
  });
  it('does not follow inherited git repository redirects', () => {
    const intended = fixture(),
      other = fixture();
    intended.write(hook, 'export const x=1;');
    vi.stubEnv('GIT_DIR', path.join(other.cwd, '.git'));
    vi.stubEnv('GIT_WORK_TREE', other.cwd);
    vi.stubEnv('GIT_INDEX_FILE', path.join(other.cwd, '.git/index'));
    expect(
      collectChanges({ cwd: intended.cwd, base: intended.base }).files
    ).toEqual([hook]);
  });
  it('fails closed on absent history, empty CI comparisons and wrong checked-out identity', () => {
    const { cwd, git, write, base } = fixture();
    expect(collectChanges({ cwd, base: 'missing' }).uncertain).toBe(true);
    expect(collectChanges({ cwd, ci: true }).uncertain).toBe(true);
    expect(() => selectValidationProfile([], {})).toThrow(
      'complete change coverage'
    );
    write('other.ts', 'x');
    git('add', '.');
    git('commit', '-m', 'advance');
    expect(collectChanges({ cwd, base, head: base, ci: true }).uncertain).toBe(
      true
    );
  });
  it('uses identical source proof locally, on a PR candidate and after merge', async () => {
    const { cwd, git, write } = fixture();
    write(room, before);
    git('add', '.');
    git('commit', '-m', 'red decorative baseline');
    const base = git('rev-parse', 'HEAD');
    write(room, after);
    write('README.md', '# Harmless accompanying explanation');
    const local = collectChanges({ cwd, base });
    const localProfile = selectValidationProfile(local.files, local);
    git('add', '.');
    git('commit', '-m', 'red to blue');
    const head = git('rev-parse', 'HEAD');
    for (const event of ['pull_request', 'push']) {
      const changes = collectChanges({ cwd, base, head, ci: true });
      expect(selectValidationProfile(changes.files, changes), event).toEqual(
        localProfile
      );
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
            GITHUB_STEP_SUMMARY: path.join(cwd, 'summary'),
          },
        }
      );
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout, JSON.stringify(result)).toContain('cosmetic');
      expect(result.stdout).not.toContain('test:full');
    }
  });
  it('forbids partial file declarations in CI', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/run-tests-by-diff.mjs', '--files', 'README.md'],
      { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true' } }
    );
    expect(result.status).toBe(1);
    expect(result.stderr, JSON.stringify(result)).toContain(
      'complete-candidate'
    );
  });
  it('runs one shared command in PR and push and retains nightly health and publication boundaries', () => {
    const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    const job = workflow.jobs['pr-validation'];
    expect(job.if).toBe(
      "github.event_name == 'pull_request' || github.event_name == 'push'"
    );
    expect(job.env.SCOUTZERO_DIFF_BASE).toBe(
      '${{ github.event.pull_request.base.sha || github.event.before }}'
    );
    expect(job.env.SCOUTZERO_DIFF_HEAD).toBe('${{ github.sha }}');
    expect(
      job.steps.filter((step) => step.run?.includes('test:diff'))
    ).toHaveLength(1);
    expect(job.steps.some((step) => step.run?.includes('test:full'))).toBe(
      false
    );
    expect(workflow.jobs['full-validation'].if).toBe(
      "github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'"
    );
    expect(workflow.jobs['full-validation']['runs-on']).toBe('ubuntu-24.04');
    expect(workflow.on).toHaveProperty('workflow_dispatch');
    expect(workflow.on.schedule).toEqual([{ cron: '0 2 * * *' }]);
    expect(
      workflow.jobs['full-validation'].steps.some(
        (step) =>
          step.run ===
          'npx --no-install playwright install --with-deps chromium'
      )
    ).toBe(true);
    expect(
      workflow.jobs['full-validation'].steps.some(
        (step) => step.run === 'npm run test:full'
      )
    ).toBe(true);
    expect(workflow.on.pull_request.paths).toBeUndefined();
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });
});
