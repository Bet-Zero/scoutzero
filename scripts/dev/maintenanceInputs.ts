/**
 * FILE: scripts/dev/maintenanceInputs.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
import { maintenanceErrorMessage } from './maintenanceErrors.js';
/** Assemble verified run outputs into the existing private player stager's input contract. */
import { buildProfileUrl } from '../../player-scrape/stats/scripts/fetch_player_stats.js';
import { cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { openMaintenanceRun, bytesHash } from './maintenanceRun.js';
import { privateDirectory, privateJson } from './cloudStorage.js';
import { verifyInputBundle } from './cloudPipeline.js';

export async function assembleMaintenanceInputs(runDirs: string[], destination: string) {
  const files: { path: string; sha256: string; bytes: number }[] = [];
  const index: Record<string, unknown> = {}; const urls = new Set<string>();
  let context: string | undefined;
  const captureTimes: string[] = [];
  const statsStatus: Record<string, string> = {};
  for (const dir of runDirs) {
    const manifest = JSON.parse(await readFile(path.join(dir, 'run.json'), 'utf8'));
    const run = await openMaintenanceRun(dir, manifest.request, true);
    if (!run.coverage().complete) throw new Error('Incomplete required collection run cannot form a complete input bundle');
    if (!run.captureStartedAt) throw new Error('Run lacks a separately recorded capture time; retain it as historical rehearsal evidence');
    captureTimes.push(run.captureStartedAt);
    const nextContext = JSON.stringify([manifest.request.season, manifest.request.asOf]);
    if (context && context !== nextContext) throw new Error('Mixed run season/as-of generations');
    context = nextContext;
    for (const [id, entry] of Object.entries(manifest.request.inventory) as [string, any][]) {
      if (!await run.verified(id)) throw new Error('Run member is unverified');
      if (index[id] && JSON.stringify(index[id]) !== JSON.stringify(entry)) throw new Error('Player inventory changed between collections');
      index[id] = entry;
      if (manifest.request.operation === 'stats') {
        statsStatus[id] = manifest.results[id].status;
        urls.add(buildProfileUrl(String(entry.nbaId ?? entry.nbaStatsId), manifest.request.season));
      } else if (entry.url) urls.add(entry.url);
      for (const file of manifest.results[id].files) {
        if (!/^(contracts|stats|raw)\//.test(file.path)) continue;
        if (files.some(v => v.path === file.path)) throw new Error('Duplicate input artifact');
        await privateDirectory(path.dirname(path.join(destination, file.path)));
        await cp(path.join(dir, file.path), path.join(destination, file.path), { force: false, errorOnExist: true });
        files.push(file);
      }
    }
  }
  if (!context) throw new Error('No verified runs');
  await privateJson(path.join(destination, 'player_index.json'), index);
  const bytes = await readFile(path.join(destination, 'player_index.json'));
  files.push({ path: 'player_index.json', sha256: bytesHash(bytes), bytes: bytes.length });
  const [season, asOf] = JSON.parse(context);
  await privateJson(path.join(destination, 'manifest.json'), { version: 1, kind: 'scrape', acquiredAt: captureTimes.sort()[0], captureTimes,
    season, effectiveAt: asOf, statsStatus, statsInventory: Object.keys(statsStatus).sort(), sourceUrls: [...urls], qualification: 'unreviewed', files });
  await verifyInputBundle(destination);
  return { inputDir: destination, season, asOf, players: Object.keys(index).length, qualified: false };
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  try {
    const option = (key: string) => process.argv.find(v => v.startsWith('--' + key + '='))?.slice(key.length + 3) || '';
    if (!option('runs') || !option('out')) throw new Error('Explicit private runs and output required');
    console.log(JSON.stringify(await assembleMaintenanceInputs(option('runs').split(','), path.resolve(option('out')))));
  } catch (error) { console.error(maintenanceErrorMessage(error)); process.exitCode = 1; }
}
