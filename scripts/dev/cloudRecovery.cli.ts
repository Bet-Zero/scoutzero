/** Explicit recovery commands; local diagnostics never claim off-workspace durability. */
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { backupPrivateData, restorePrivateData, retainLegacyArtifacts, assertRecoveryRuntimeStopped } from './cloudRecovery.js';
import { googleRecoveryStore, localRecoveryStore } from './cloudRecoveryStore.js';
import { privateJson } from './cloudStorage.js';
import { assertChildExecution } from './cloudFunctions.js';

try {
  assertChildExecution();
  await assertRecoveryRuntimeStopped();
  const option = (name: string) => process.argv.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  const command = process.argv[2];
  if (!['backup', 'restore'].includes(command)) throw new Error('Use backup|restore with --bucket=<private-bucket> or --local-diagnostic=<private-directory>');
  if (option('bucket') && option('local-diagnostic')) throw new Error('Choose one recovery destination');
  const store = option('local-diagnostic') ? await localRecoveryStore(path.resolve(option('local-diagnostic')!)) :
    option('bucket') ? await googleRecoveryStore(option('bucket')!) : null;
  if (!store) throw new Error('An explicitly configured private recovery store is required');
  const root = path.resolve('.scoutzero-dev');
  if (command === 'backup') {
    await retainLegacyArtifacts(process.cwd(), root);
    const result = await backupPrivateData(root, store, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
    await privateJson(path.join(root, 'recovery/receipts', result.manifestSha256 + '.json'), result);
    console.log(JSON.stringify(result));
  } else {
    if (!option('into') || !option('manifest')) throw new Error('Restore requires --into=<absent-private-directory> and --manifest=<pinned-sha256>');
    console.log(JSON.stringify(await restorePrivateData(path.resolve(option('into')!), store, option('manifest')!)));
  }
} catch (error) { console.error(error instanceof SyntaxError ? 'Invalid private recovery JSON; do not publish its contents' : error instanceof Error ? error.message : 'Recovery failed'); process.exitCode = 1; }
