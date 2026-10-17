/** Verify cached Functions correspond to their actual source and compiled bytes. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertChildExecution(env = process.env) {
  const marker = 'SCOUTZERO_NODE_CHILD_EXECUTED';
  const output = execFileSync(process.execPath, ['--input-type=commonjs', '-e', 'process.stdout.write(' + JSON.stringify(marker) + ')'], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'] });
  if (output !== marker) throw new Error('This shell does not execute Node child programs. Use the supported cloud execution permissions; do not accept file-only test/build receipts.');
}
async function tree(root: string, dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const file of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, file.name);
    if (file.isDirectory()) files.push(...await tree(root, relative));
    else if (file.isFile() && !file.name.endsWith('.test.ts')) files.push(relative);
    else if (!file.isFile()) throw new Error('Function cache inputs cannot be symbolic links');
  }
  return files;
}
async function hashFiles(root: string, files: string[]) {
  const hash = createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    hash.update(file + '\0'); hash.update(await readFile(path.join(root, file))); hash.update('\0');
  }
  return hash.digest('hex');
}
async function fingerprints(root: string) {
  const inputs = JSON.parse(await readFile(path.join(root, 'functions/lib/certifiedSeason.inputs.json'), 'utf8'));
  if (!Array.isArray(inputs) || !inputs.length || inputs.some((p: unknown) => typeof p !== 'string' || !p.startsWith('src/') || p.split('/').some((part: string) => part === '..' || !part))) throw new Error('Missing valid certified server input inventory');
  const sources = ['functions/package.json', 'functions/package-lock.json', 'functions/tsconfig.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'scripts/buildCertifiedSeason.mjs',
    ...await tree(root, 'functions/src'), ...await tree(root, 'public/architect/contract-source-releases'), ...inputs];
  return { sourceHash: await hashFiles(root, sources), compiledHash: await hashFiles(root, await tree(root, 'functions/lib')) };
}
export async function recordFunctionsBuild(root = process.cwd()) {
  const marker = await fingerprints(root);
  const dir = path.join(root, '.scoutzero-dev');
  await mkdir(dir, { recursive: true, mode: 0o700 }); await chmod(dir, 0o700);
  await writeFile(path.join(dir, 'functions-build.json'), JSON.stringify(marker), { mode: 0o600 });
}
export async function functionsBuildCurrent(root = process.cwd()) {
  try {
    const previous = JSON.parse(await readFile(path.join(root, '.scoutzero-dev/functions-build.json'), 'utf8'));
    const current = await fingerprints(root);
    return previous.sourceHash === current.sourceHash && previous.compiledHash === current.compiledHash;
  } catch { return false; }
}
export async function ensureFunctionsBuild(env = process.env) {
  if (await functionsBuildCurrent()) return;
  assertChildExecution(env);
  execFileSync('npm', ['--prefix', 'functions', 'run', 'build'], { stdio: 'inherit', env });
  await recordFunctionsBuild();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'record') await recordFunctionsBuild();
  else if (!await functionsBuildCurrent()) throw new Error('Compiled Functions are missing or stale; run cloud:setup');
}
