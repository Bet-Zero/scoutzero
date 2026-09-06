import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  PRIVATE_EVIDENCE_ROOT,
  requirePrivateInputs,
} from '../../scripts/source-releases/official-nba-html/private-output';
import { buildOfficialHtmlSupplement } from '../../scripts/source-releases/official-nba-html/cli';
import { verifyRetainedV2 } from '../../scripts/source-releases/official-nba-html/retained';

// Deliberately invalid public bytes: never copy private evidence into tests.
// This tripwire proves rejection precedes *every* readFile, not just parsing.
const reads = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('SYNTHETIC_CONTENT_READ');
  })
);
vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>()),
  readFile: reads,
}));

const cleanup: string[] = [];
afterEach(async () => {
  reads.mockClear();
  vi.restoreAllMocks();
  for (const directory of cleanup.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function fixture() {
  await mkdir(PRIVATE_EVIDENCE_ROOT, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(
    path.join(PRIVATE_EVIDENCE_ROOT, 'synthetic-inputs-')
  );
  cleanup.push(root);
  const inputs = {
    directory: path.join(root, 'v2'),
    archive: path.join(root, 'archive.gz'),
    assessment: path.join(root, 'assessment.json'),
  };
  await mkdir(inputs.directory, { mode: 0o700 });
  await writeFile(
    path.join(inputs.directory, 'synthetic.html'),
    'PUBLIC SYNTHETIC',
    { mode: 0o600 }
  );
  await writeFile(inputs.archive, 'PUBLIC SYNTHETIC ARCHIVE', { mode: 0o600 });
  await writeFile(inputs.assessment, 'PUBLIC SYNTHETIC ASSESSMENT', {
    mode: 0o600,
  });
  return { root, inputs };
}
type Input = 'directory' | 'archive' | 'assessment';
const inputs: Input[] = ['directory', 'archive', 'assessment'];
const hazards = [
  'checkout',
  'type',
  'permissions',
  'symlink',
  'parent-symlink',
  'missing',
  'parent-permissions',
] as const;
type Hazard = (typeof hazards)[number];

async function unsafe(input: Input, hazard: Hazard) {
  const f = await fixture();
  const original = f.inputs[input];
  if (hazard === 'checkout')
    f.inputs[input] =
      input === 'directory'
        ? process.cwd()
        : path.join(process.cwd(), 'package.json');
  if (hazard === 'type')
    f.inputs[input] =
      input === 'directory' ? f.inputs.archive : f.inputs.directory;
  if (hazard === 'permissions')
    await chmod(original, input === 'directory' ? 0o755 : 0o644);
  if (hazard === 'symlink') {
    const alias = path.join(f.root, 'alias');
    await symlink(original, alias);
    f.inputs[input] = alias;
  }
  if (hazard === 'parent-symlink') {
    const alias = path.join(f.root, 'parent-alias');
    await symlink(process.cwd(), alias);
    f.inputs[input] =
      input === 'directory' ? alias : path.join(alias, 'package.json');
  }
  if (hazard === 'missing') f.inputs[input] = path.join(f.root, 'missing');
  if (hazard === 'parent-permissions') await chmod(f.root, 0o755);
  return f;
}

describe('private inputs fail before file contents are read', () => {
  it.each(
    inputs.flatMap((input) => hazards.map((hazard) => ({ input, hazard })))
  )('callable generator: $input / $hazard', async ({ input, hazard }) => {
    const { inputs: f } = await unsafe(input, hazard);
    await expect(
      buildOfficialHtmlSupplement(f.directory, f.archive, f.assessment)
    ).rejects.toThrow(/^Private input boundary:/);
    expect(reads).not.toHaveBeenCalled();
  });
  it.each(
    (['directory', 'archive'] as const).flatMap((input) =>
      hazards.map((hazard) => ({ input, hazard }))
    )
  )(
    'callable retained verifier: $input / $hazard',
    async ({ input, hazard }) => {
      const { inputs: f } = await unsafe(input, hazard);
      await expect(verifyRetainedV2(f.directory, f.archive)).rejects.toThrow(
        /^Private input boundary:/
      );
      expect(reads).not.toHaveBeenCalled();
    }
  );
  it.each(['build', 'verify'] as const)(
    'permitted inputs reach content validation: %s',
    async (entry) => {
      const { inputs: f } = await fixture();
      // Exercise both known OS temporary-path spellings (macOS /var -> /private/var).
      f.directory = await realpath(f.directory);
      const promise =
        entry === 'build'
          ? buildOfficialHtmlSupplement(f.directory, f.archive, f.assessment)
          : verifyRetainedV2(f.directory, f.archive);
      await expect(promise).rejects.toThrow('SYNTHETIC_CONTENT_READ');
      expect(reads).toHaveBeenCalled();
    }
  );
  it.each(['symlink', 'permissions', 'hardlink'] as const)(
    'rejects unsafe nested source members: %s',
    async (hazard) => {
      const { inputs: f } = await fixture();
      const nested = path.join(f.directory, 'nested');
      await mkdir(nested, { mode: 0o700 });
      if (hazard === 'symlink')
        await symlink(f.archive, path.join(nested, 'alias'));
      if (hazard === 'permissions') await chmod(nested, 0o755);
      if (hazard === 'hardlink')
        await link(f.archive, path.join(nested, 'alias'));
      await expect(
        buildOfficialHtmlSupplement(f.directory, f.archive, f.assessment)
      ).rejects.toThrow(/^Private input boundary:/);
      expect(reads).not.toHaveBeenCalled();
    }
  );
  it.each(['archive', 'assessment'] as const)(
    'rejects hard-linked %s before any read',
    async (input) => {
      const { root, inputs: f } = await fixture();
      await link(f[input], path.join(root, 'second-name'));
      await expect(
        buildOfficialHtmlSupplement(f.directory, f.archive, f.assessment)
      ).rejects.toThrow('Private input boundary: hard-linked input');
      expect(reads).not.toHaveBeenCalled();
    }
  );
  it('rejects a source member with public permissions before any read', async () => {
    const { inputs: f } = await fixture();
    await chmod(path.join(f.directory, 'synthetic.html'), 0o644);
    await expect(verifyRetainedV2(f.directory, f.archive)).rejects.toThrow(
      /^Private input boundary:/
    );
    expect(reads).not.toHaveBeenCalled();
  });
  it('rejects a different filesystem owner', async () => {
    const { inputs: f } = await fixture();
    vi.spyOn(process, 'getuid').mockReturnValue(process.getuid!() + 1);
    await expect(requirePrivateInputs(f)).rejects.toThrow('owner-only');
    expect(reads).not.toHaveBeenCalled();
  });
  it.each(inputs)('rejects owner-unreadable %s', async (input) => {
    const { inputs: f } = await fixture();
    await chmod(f[input], input === 'directory' ? 0o300 : 0o200);
    try {
      await expect(requirePrivateInputs(f)).rejects.toThrow(
        'owner read/traverse'
      );
      expect(reads).not.toHaveBeenCalled();
    } finally {
      await chmod(f[input], input === 'directory' ? 0o700 : 0o600);
    }
  });
  it('rejects omitted assessment at the callable generation boundary', async () => {
    const { inputs: f } = await fixture();
    await expect(
      buildOfficialHtmlSupplement(
        f.directory,
        f.archive,
        undefined as unknown as string
      )
    ).rejects.toThrow('Private input boundary: missing input path');
    expect(reads).not.toHaveBeenCalled();
  });
  it('accepts all permitted inputs, including owner-only read-only files', async () => {
    const { inputs: f } = await fixture();
    await chmod(f.archive, 0o400);
    await chmod(f.assessment, 0o400);
    const accepted = await requirePrivateInputs(f);
    expect(accepted).toEqual({
      directory: await realpath(f.directory),
      archive: await realpath(f.archive),
      assessment: await realpath(f.assessment),
    });
    expect(reads).not.toHaveBeenCalled();
  });
});

describe('both CLI commands enforce each private input independently', () => {
  it.each(
    (['build', 'verify'] as const).flatMap((command) =>
      inputs.flatMap((input) =>
        hazards.map((hazard) => ({ command, input, hazard }))
      )
    )
  )('$command: $input / $hazard', async ({ command, input, hazard }) => {
    const { root, inputs: f } = await unsafe(input, hazard);
    // Output remains independently valid even when an input ancestor is unsafe.
    const outputParent = await mkdtemp(
      path.join(PRIVATE_EVIDENCE_ROOT, 'synthetic-output-')
    );
    cleanup.push(outputParent);
    const output = path.join(outputParent, 'candidate');
    if (command === 'verify') await mkdir(output, { mode: 0o700 });
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/source-releases/official-nba-html/cli.ts',
        command,
        '--v2',
        f.directory,
        '--archive',
        f.archive,
        '--assessment',
        f.assessment,
        '--out',
        output,
      ],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 }
    );
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^Private input boundary:/);
    expect(run.stderr).not.toMatch(/Wrong retained|JSON|schema|ENOENT/);
    expect(run.stdout).not.toContain('PASS');
    expect(root).toContain('synthetic-inputs-');
  });
});
