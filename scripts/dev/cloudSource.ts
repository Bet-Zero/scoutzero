/** Fresh source collection through the existing contract parser; no fixture fallback or publisher. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { getPlayerHtml } from '../../player-scrape/contracts/scripts/fetch_player_page.js';
import { parsePlayer } from '../../player-scrape/contracts/scripts/parse_player.js';
import { basePlayerSchema } from '../../player-scrape/shared/schema/player_scrape_schema.js';
import { DATA_DIR } from './cloudData.js';
import { privateDirectory, privateJson } from './cloudStorage.js';
import { verifyInputBundle } from './cloudPipeline.js';

const option = (key: string) => process.argv.find((arg) => arg.startsWith('--' + key + '='))?.slice(key.length + 3) || '';
const runDir = path.resolve(DATA_DIR, 'pipeline', 'source-attempts', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
await privateDirectory(runDir);
try {
  const playerId = option('player');
  const teamCode = option('team');
  const url = new URL(option('url'));
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]{0,100}$/u.test(playerId) || !/^[A-Z]{3}$/.test(teamCode) ||
      url.protocol !== 'https:' || !['salaryswish.com', 'www.salaryswish.com'].includes(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash || !/^\/players\/[a-z0-9-]+$/.test(url.pathname)) throw new Error('A real player ID, team and exact SalarySwish player URL are required');
  const capturedAt = new Date().toISOString();
  const html = await getPlayerHtml(playerId, url.href, { fresh: true });
  await privateDirectory(path.join(runDir, 'raw'));
  await writeFile(path.join(runDir, 'raw/first.html'), html, { mode: 0o600 });
  const second = await getPlayerHtml(playerId, url.href, { fresh: true });
  await writeFile(path.join(runDir, 'raw/second.html'), second, { mode: 0o600 });
  const parsed = basePlayerSchema.parse(await parsePlayer(html, { playerId, sourceUrl: url.href, teamCode, teamName: option('team-name') || undefined, asOf: new Date(capturedAt) }));
  if (!parsed.contract.salariesByYear.length) throw new Error('A fresh page must supply actual contract salary rows');
  const contractPath = `contracts/${teamCode}/${playerId}.json`;
  await privateJson(path.join(runDir, contractPath), parsed);
  await privateJson(path.join(runDir, 'player_index.json'), { [playerId]: { fullName: parsed.displayName, displayName: parsed.displayName, teamCode } });
  const files = [];
  for (const file of [contractPath, 'player_index.json', 'raw/first.html', 'raw/second.html']) {
    const bytes = await readFile(path.join(runDir, file));
    files.push({ path: file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  }
  await privateJson(path.join(runDir, 'manifest.json'), { version: 1, kind: 'scrape', acquiredAt: capturedAt,
    sourceUrls: [url.href], qualification: 'unreviewed', files, byteIdenticalRetrievals: html === second,
    limitation: 'Successful capture/parsing is not independent source qualification. Unequal originals remain unequal; both are retained.' });
  await verifyInputBundle(runDir);
  console.log(JSON.stringify({ captured: true, parsedAndValidated: true, inputDir: runDir, byteIdenticalRetrievals: html === second, qualified: false }));
} catch {
  await privateJson(path.join(runDir, 'failure.json'), { failedAt: new Date().toISOString(),
    reason: 'Fresh source fetch, parsing or validation failed; no fixture was substituted and no publication occurred.' });
  console.error('Fresh source acquisition failed; see private source-attempts evidence. No fresh input or production update is claimed.');
  process.exitCode = 1;
}
