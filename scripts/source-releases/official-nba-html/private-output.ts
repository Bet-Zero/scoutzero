/** Vite can serve ignored checkout files; new evidence belongs outside the checkout. */
import { lstat, mkdir, readdir, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKOUT = fileURLToPath(new URL('../../../', import.meta.url));
export const PRIVATE_EVIDENCE_ROOT = path.join(
  os.tmpdir(),
  'scoutzero-official-nba-html'
);

const below = (root: string, candidate: string) =>
  candidate.startsWith(`${root}${path.sep}`);

/** Metadata only: validate every supplied input before callers read any bytes. */
export async function requirePrivateInputs<
  T extends {
    directory: string;
    archive: string;
    assessment?: string;
  },
>(inputs: T): Promise<T> {
  const fail = (reason: string): never => {
    throw new Error(`Private input boundary: ${reason}`);
  };
  const uid = process.getuid?.();
  if (uid === undefined) fail('owner permissions are unavailable');
  async function metadata(location: string, expected: 'directory' | 'file') {
    const stat = await lstat(location).catch(() =>
      fail('missing or inaccessible input')
    );
    if (
      stat.isSymbolicLink() ||
      (expected === 'directory' ? !stat.isDirectory() : !stat.isFile())
    )
      fail(`expected a regular ${expected}, without symlinks`);
    if (stat.uid !== uid || (stat.mode & 0o077) !== 0)
      fail('inputs and their private ancestors must be owner-only');
    const needed = expected === 'directory' ? 0o500 : 0o400;
    if ((stat.mode & needed) !== needed)
      fail('input lacks owner read/traverse permission');
    if (expected === 'file' && stat.nlink !== 1) fail('hard-linked input');
  }
  const lexicalRoot = path.resolve(PRIVATE_EVIDENCE_ROOT);
  await metadata(lexicalRoot, 'directory');
  const root = await realpath(lexicalRoot);
  const checkout = await realpath(CHECKOUT);
  if (root === checkout || below(checkout, root))
    fail('private root is inside the checkout');

  async function check(location: string, expected: 'directory' | 'file') {
    if (typeof location !== 'string' || location.length === 0)
      fail('missing input path');
    const absolute = path.resolve(location);
    // Only the configured OS alias (e.g. /var -> /private/var) is allowed.
    const anchor = below(lexicalRoot, absolute) ? lexicalRoot : root;
    if (!below(anchor, absolute))
      fail('input must be below the external private evidence root');
    const parts = path.relative(anchor, absolute).split(path.sep);
    let resolved = root;
    for (const [index, part] of parts.entries()) {
      resolved = path.join(resolved, part);
      await metadata(
        resolved,
        index === parts.length - 1 ? expected : 'directory'
      );
    }
    if ((await realpath(resolved)) !== resolved) fail('resolved input alias');
    return resolved;
  }
  async function tree(directory: string): Promise<void> {
    for (const member of await readdir(directory)) {
      const location = path.join(directory, member);
      const stat = await lstat(location);
      await metadata(location, stat.isDirectory() ? 'directory' : 'file');
      if (stat.isDirectory()) await tree(location);
    }
  }
  const directory = await check(inputs.directory, 'directory');
  const archive = await check(inputs.archive, 'file');
  const assessment =
    'assessment' in inputs
      ? await check(inputs.assessment!, 'file')
      : undefined;
  await tree(directory);
  return {
    ...inputs,
    directory,
    archive,
    ...(assessment === undefined ? {} : { assessment }),
  };
}

export async function requirePrivateOutput(
  outputDirectory: string,
  mode: 'new' | 'existing' = 'new'
): Promise<string> {
  await mkdir(PRIVATE_EVIDENCE_ROOT, { recursive: true, mode: 0o700 });
  const stat = await lstat(PRIVATE_EVIDENCE_ROOT);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0)
    throw new Error('Private evidence root must be an owner-only directory');
  const root = await realpath(PRIVATE_EVIDENCE_ROOT);
  const checkout = await realpath(CHECKOUT);
  if (root === checkout || root.startsWith(`${checkout}${path.sep}`))
    throw new Error('Private evidence root must be outside the checkout');
  const output = path.resolve(outputDirectory);
  const parent = await realpath(path.dirname(output));
  if (parent !== root && !parent.startsWith(`${root}${path.sep}`))
    throw new Error('Output must be below the external private evidence root');
  const resolved = path.join(parent, path.basename(output));
  if (
    resolved === root ||
    resolved === checkout ||
    resolved.startsWith(`${checkout}${path.sep}`)
  )
    throw new Error(
      'Output may not be the private root or inside the checkout'
    );
  try {
    const candidate = await lstat(resolved);
    if (mode === 'new')
      throw new Error('Refusing to replace an existing candidate directory');
    if (!candidate.isDirectory())
      throw new Error('Private candidate must be a regular directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (mode === 'existing')
      throw new Error('Missing private candidate directory');
  }
  return resolved;
}
