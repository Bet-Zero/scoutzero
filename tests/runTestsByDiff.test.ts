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
  gitEnvironment,
  presentationOnly,
  readDeclarations,
  selectValidationProfile,
  selectTestPlan,
  executePlan,
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
const empty = () => ({ node: [], ui: [], native: [], emulator: [] });
const room = 'src/features/architect/cockpit/RoomFrame.tsx';
const before = readFileSync(room, 'utf8').replace(
  'border-b border-cockpit-edge',
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
      review: 'agent-decides',
      build: true,
      typecheck: false,
    });
    expect(plan.commands.map((c) => c.script).filter(Boolean)).toEqual([
      'build',
    ]);
  });
  it('supports multiple presentation files and harmless docs/test changes across areas', async () => {
    const ranker = 'src/features/ranker/PoolWorkbench.tsx';
    const text = readFileSync(ranker, 'utf8');
    const contents = {
      ...opts.contents,
      [ranker]: {
        before: text,
        after: text.replace('gap-2 px-4 py-3', 'gap-3 px-4 py-3'),
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
  it('does not make ordinary behavior plus a regression and second file consequential', async () => {
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
    expect(plan.profile).toMatchObject({
      level: 'ordinary',
      review: 'agent-decides',
    });
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
  it.each([
    'src/features/architect/utils/capTotals/computeTeamCapTotals.ts',
    'src/features/architect/utils/salaryEngine/salaryEngine.ts',
    'src/features/architect/utils/capLegalityValidation.ts',
    'src/features/architect/utils/capLegality/postStateCapValidator.ts',
    'src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts',
    'src/features/architect/utils/tradeMachine/utils/salaryMargin.ts',
    'src/features/architect/utils/capUtils.ts',
    'src/features/architect/utils/hardCapUtils.ts',
    'src/features/architect/utils/contractSalaryUtils.ts',
    'src/features/architect/utils/playerRulesProfile/extensionRules.eligibility.ts',
    'src/shared/utils/contracts/contractUtils.ts',
    'src/features/architect/utils/mutationPipeline.ts',
    'src/firebase/firebaseHelpers.ts',
    'firestore.rules',
  ])('requires review for executable sensitive work: %s', (file) => {
    const profile = selectValidationProfile([file]);
    expect(profile).toMatchObject({
      level: 'consequential',
      review: 'required',
    });
    expect(profile.broadReasons).toEqual([]);
  });
  it('keeps non-financial utilities and the independent ordinary holdout ordinary', () => {
    for (const file of [
      hook,
      'src/shared/utils/routing/playerRouteUtils.ts',
      'src/features/architect/utils/seasonFormat.ts',
    ]) {
      expect(selectValidationProfile([file])).toMatchObject({
        level: 'ordinary',
        review: 'agent-decides',
        broadReasons: [],
      });
    }
  });
  it('mixed financial work cannot hide behind presentation or an unchecked label', async () => {
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
    expect(plan.profile).toMatchObject({
      level: 'consequential',
      review: 'required',
    });
    expect(plan.commands.some((c) => c.script === 'test:full')).toBe(false);
    expect(plan.selected.node).toEqual(['tests/computeTeamCapTotals.test.ts']);
  });
  it('policy changes select their safeguards exactly once without the application suite', async () => {
    const plan = await selectTestPlan(
      ['scripts/run-tests-by-diff.mjs', 'AGENTS.md'],
      {
        discover: async () => ({
          ...empty(),
          node: ['tests/runTestsByDiff.test.ts'],
          native: ['tests/tooling/phase3aWorkflow.node-test.ts'],
        }),
      }
    );
    expect(plan.profile.review).toBe('required');
    expect(plan.selected.node).toEqual(['tests/runTestsByDiff.test.ts']);
    expect(plan.selected.native).toEqual([
      'tests/tooling/phase3aWorkflow.node-test.ts',
    ]);
    expect(plan.commands.some((c) => c.script === 'test:full')).toBe(false);
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
  it('additive declarations cannot remove automatic tests or downgrade required review', async () => {
    const declarations = readDeclarations(
      `Validation-Tests: ["${regression}"]\nValidation-Review: required\nValidation-Level: cosmetic`
    );
    const plan = await selectTestPlan([hook], {
      declarations,
      discover: async (inputs) => {
        expect(inputs).toContain(regression);
        return { ...empty(), ui: [regression] };
      },
    });
    expect(plan.profile.review).toBe('required');
    expect(() =>
      readDeclarations('Validation-Tests: ["../escape.test.ts"]')
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
    git('commit', '-m', `second\n\nValidation-Review: required`);
    renameSync(path.join(cwd, 'other.ts'), path.join(cwd, 'renamed.ts'));
    git('add', '.');
    write('README.md', '# Changed');
    write('untracked\nfile.ts', 'x');
    const changes = collectChanges({ cwd, base });
    expect(changes).toMatchObject({ uncertain: false, structural: true });
    expect(changes.files).toEqual(
      ['README.md', 'other.ts', 'renamed.ts', hook, 'untracked\nfile.ts'].sort()
    );
    expect(changes.declarations.review).toBe(true);
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
      "github.event_name == 'schedule'"
    );
    expect(
      workflow.jobs['full-validation'].steps.some(
        (step) => step.run === 'npm run test:full'
      )
    ).toBe(true);
    expect(workflow.on.pull_request.paths).toBeUndefined();
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });
});
