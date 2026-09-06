/** Vite can serve ignored checkout files; new evidence belongs outside the checkout. */
import { lstat, mkdir, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKOUT = fileURLToPath(new URL('../../../', import.meta.url));
export const PRIVATE_EVIDENCE_ROOT = path.join(
  os.tmpdir(),
  'scoutzero-official-nba-html'
);

export async function requirePrivateOutput(
  outputDirectory: string
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
    await lstat(resolved);
    throw new Error('Refusing to replace an existing candidate directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return resolved;
}
