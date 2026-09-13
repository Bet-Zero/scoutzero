/** Own the existing world-only review harness; never attach to another server. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export async function startSeasonProofHarness(
  repoRoot: string,
  artifactDir: string
): Promise<() => Promise<void>> {
  const log = fs.openSync(path.join(artifactDir, 'harness.log'), 'w');
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'scripts/emu/runReviewMode.ts'],
    {
      cwd: repoRoot,
      detached: process.platform !== 'win32',
      stdio: ['ignore', log, log],
      env: {
        ...process.env,
        ARCHITECT_REVIEW_WORLD_ONLY: 'true',
        VITE_ARCHITECT_DRAFT_REVIEW: 'true',
        VITE_SHOW_TRADE_RECEIPT: 'true',
      },
    }
  );
  fs.closeSync(log);
  let ended = false;
  let failure: Error | null = null;
  child.once('exit', () => {
    ended = true;
  });
  child.once('error', (error) => {
    failure = error;
    ended = true;
  });
  const stop = async () => {
    if (!ended) child.kill('SIGTERM');
    const deadline = Date.now() + 20000;
    while (!ended && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 200));
    if (!ended) {
      child.kill('SIGKILL');
      throw new Error(
        'Owned season harness did not shut down gracefully; certificate fails.'
      );
    }
  };
  try {
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      if (ended)
        throw (
          failure || new Error('Season proof harness exited during startup.')
        );
      const output = fs.readFileSync(
        path.join(artifactDir, 'harness.log'),
        'utf8'
      );
      if (
        output.includes('All emulators ready!') &&
        (output.includes(
          '[review] Review mode ready at http://127.0.0.1:5173'
        ) ||
          output.includes(
            '[review] Review mode ready (Codespaces — open the forwarded port 5173 in your browser)'
          ))
      )
        return stop;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Season proof harness startup exceeded four minutes.');
  } catch (error) {
    await stop();
    throw error;
  }
}
