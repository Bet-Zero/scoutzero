import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'draft-private-output-'));
  directories.push(root);
  return root;
}
function invoke(output: string) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'scripts/architect/prepareJune5DraftState.ts',
      'nonexistent-assessment',
      'nonexistent-recovery',
      'nonexistent-catalogue',
      output,
    ],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      timeout: 10000,
    }
  );
}

describe('private compiler output boundary before evidence access', () => {
  it('rejects public directories hidden behind an otherwise private path alias', () => {
    const root = setup();
    const target = join(root, 'public');
    mkdirSync(target);
    const alias = join(root, 'private-alias');
    symlinkSync(target, alias, 'dir');
    const result = invoke(join(alias, 'candidate'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Private output must be outside repository/public directories'
    );
    expect(result.stderr).not.toContain('nonexistent-assessment');
    expect(existsSync(join(target, 'candidate'))).toBe(false);
  });

  it('rejects both a public destination name and aliases into the repository', () => {
    const root = setup();
    const alias = join(root, 'repo-alias');
    symlinkSync(resolve('.'), alias, 'dir');
    for (const output of [
      join(root, 'public'),
      join(alias, 'private-candidate'),
    ]) {
      const result = invoke(output);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Private output must be outside repository/public directories'
      );
      expect(existsSync(output)).toBe(false);
    }
  });
});
