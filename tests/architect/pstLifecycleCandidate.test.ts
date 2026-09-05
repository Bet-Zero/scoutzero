import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  requirePrivateOutput,
  verifyPstCandidate,
  writePstCandidate,
} from '../../scripts/source-releases/pst-lifecycle/candidate';

describe('private derived candidate integrity', () => {
  beforeAll(async () => {
    await mkdir(path.resolve('tmp'), { recursive: true });
  });

  it('rejects public, src, data and existing output directories', async () => {
    for (const directory of [
      'public/lifecycle',
      'src/lifecycle',
      'data/lifecycle',
      'tmp',
    ])
      await expect(requirePrivateOutput(directory)).rejects.toThrow();
  });

  it('writes only a new private directory and verifies exact bytes and inventory', async () => {
    const parent = await mkdtemp(
      path.resolve('tmp/bze306-synthetic-integrity-')
    );
    try {
      const directory = path.join(parent, 'candidate');
      const files = new Map([
        ['manifest.json', '{"synthetic":true}\n'],
        ['register.json', '[]\n'],
      ]);
      await writePstCandidate(files, directory);
      await expect(
        verifyPstCandidate(files, directory)
      ).resolves.toBeUndefined();
      await expect(writePstCandidate(files, directory)).rejects.toThrow(
        'existing'
      );
      await writeFile(path.join(directory, 'extra.txt'), 'synthetic');
      await expect(verifyPstCandidate(files, directory)).rejects.toThrow(
        'inventory'
      );
      await rm(path.join(directory, 'extra.txt'));
      await writeFile(
        path.join(directory, 'register.json'),
        '[{"brokenReference":"missing-cell"}]\n'
      );
      await expect(verifyPstCandidate(files, directory)).rejects.toThrow(
        'bytes differ'
      );
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('rejects symlinked candidate files even when their bytes match', async () => {
    const parent = await mkdtemp(path.resolve('tmp/bze306-synthetic-symlink-'));
    try {
      const directory = path.join(parent, 'candidate');
      const files = new Map([['manifest.json', '{}\n']]);
      await writePstCandidate(files, directory);
      await writeFile(path.join(parent, 'target.json'), '{}\n');
      await rm(path.join(directory, 'manifest.json'));
      await symlink(
        path.join(parent, 'target.json'),
        path.join(directory, 'manifest.json')
      );
      await expect(verifyPstCandidate(files, directory)).rejects.toThrow(
        'regular file'
      );
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('contains no runtime or write-capable source dependency', async () => {
    for (const filename of [
      'observe',
      'terms',
      'reconstruct',
      'branch-links',
      'dependency-links',
      'account',
      'reference-gaps',
      'candidate',
      'cli',
    ]) {
      const source = await readFile(
        `scripts/source-releases/pst-lifecycle/${filename}.ts`,
        'utf8'
      );
      expect(source).not.toMatch(
        /from ['"](?:firebase|firebase-admin)|\bfetch\(|setDoc\(|writeBatch\(/
      );
    }
  });
});
