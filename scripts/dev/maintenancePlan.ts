/** Build reviewable publication groups from already verified player/team runs. No writes. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { planStatistics } from './maintenanceStats.js';
import { buildMaintenanceTeam } from '../../team-scrape/shared/firestore_staging/scripts/stage_team.js';
import { SOURCE_PROJECT, digest, loadSnapshot } from './cloudData.js';
import { mergeTypedFields, canonical, verifyPipelineRun } from './cloudPipeline.js';
import { openMaintenanceRun } from './maintenanceRun.js';
import { maintenanceContext } from './maintenanceContext.js';
import { privateJson } from './cloudStorage.js';
import { firestoreFieldHash } from './firestoreValue.js';
import type { Publication, MaintenanceEntry } from './maintenancePublish.js';

export async function buildMaintenancePlan(options: { playerRuns: string[]; teamRun?: string; statsRun?: string; index?: string; sourceDir: string; season: string; asOf: string }) {
  const context = maintenanceContext(options.season, options.asOf);
  const snapshot = await loadSnapshot(options.sourceDir);
  if (!snapshot.readTime || !Number.isFinite(Date.parse(snapshot.readTime)) || Date.parse(snapshot.readTime) > Date.now() + 60000 || Date.now() - Date.parse(snapshot.readTime) > 86400000 || !['google', 'firebase-anonymous'].includes(snapshot.authentication || '')) throw new Error('Fresh authenticated baseline required');
  const groups: Publication['groups'] = []; const inputs: string[] = [];
  for (const run of options.playerRuns) {
    await verifyPipelineRun(run);
    const plan = JSON.parse(await readFile(path.join(run, 'plan.json'), 'utf8'));
    if (plan.context.season !== context.season || plan.context.asOf !== context.asOf || plan.baselineSha256 !== digest(snapshot)) throw new Error('Player plan generation differs');
    groups.push({ id: 'player-' + groups.length, entries: plan.entries.map((entry: MaintenanceEntry) => ({ path: entry.path, beforeFields: entry.beforeFields, afterFields: entry.afterFields, precondition: entry.precondition })) });
    inputs.push(digest(canonical(plan)));
  }
  if (options.statsRun) {
    const manifest = JSON.parse(await readFile(path.join(options.statsRun, 'run.json'), 'utf8'));
    if (manifest.request.operation !== 'stats' || manifest.request.season !== context.season || new Date(manifest.request.asOf).toISOString() !== context.asOf) throw new Error('Statistics run context differs');
    const run = await openMaintenanceRun(options.statsRun, manifest.request, true);
    if (!run.coverage().complete) throw new Error('Incomplete required statistics coverage');
    inputs.push(digest(manifest));
    for (const [id, inventory] of Object.entries(manifest.request.inventory) as [string, any][]) {
      if (!await run.verified(id)) throw new Error('Statistics integrity failed');
      const result = manifest.results[id];
      const output = result.status === 'no-games' ? null : JSON.parse(await readFile(path.join(options.statsRun, 'stats', inventory.teamCode, id + '.json'), 'utf8'));
      const entries = planStatistics(snapshot, id, output, context.season);
      if (entries.length) groups.push({ id: 'statistics-' + groups.length, entries });
    }
  }
  if (options.teamRun) {
    const manifest = JSON.parse(await readFile(path.join(options.teamRun, 'run.json'), 'utf8'));
    if (manifest.request.operation !== 'teams' || manifest.request.season !== context.season || new Date(manifest.request.asOf).toISOString() !== context.asOf || !options.index) throw new Error('Explicit matching team run and player index required');
    const run = await openMaintenanceRun(options.teamRun, manifest.request, true);
    if (!run.coverage().complete) throw new Error('Incomplete team source coverage');
    const indexBytes = await readFile(options.index, 'utf8'); const index = JSON.parse(indexBytes);
    inputs.push(digest(manifest), digest(indexBytes));
    for (const [id, inventory] of Object.entries(manifest.request.inventory) as [string, any][]) {
      if (!await run.verified(id)) throw new Error('Team artifact verification failed');
      const raw = JSON.parse(await readFile(path.join(options.teamRun, 'teams', inventory.teamCode + '.json'), 'utf8'));
      if (raw.teamCode !== inventory.teamCode || raw.season !== context.season) throw new Error('Team identity/season drift');
      const patch = buildMaintenanceTeam(raw, index, context.season, context.asOf);
      for (const player of patch.roster || []) if (!snapshot.documents.some(d => d.name.endsWith('/architect_basePlayers/' + player))) throw new Error('Roster reference lacks a base player; reconcile evidence before publication');
      const documentPath = 'architect_baseTeams/' + inventory.teamCode;
      const before = snapshot.documents.find(d => d.name.endsWith('/documents/' + documentPath));
      if (!before?.updateTime) throw new Error('Existing versioned team required');
      const afterFields = mergeTypedFields(before.fields || {}, patch);
      if (firestoreFieldHash(before.fields || {}) !== firestoreFieldHash(afterFields)) groups.push({ id: 'team-' + inventory.teamCode,
        entries: [{ path: documentPath, beforeFields: before.fields || {}, afterFields, precondition: { updateTime: before.updateTime } }] });
    }
  }
  return { version: 1, project: SOURCE_PROJECT, database: '(default)', season: context.season, asOf: context.asOf,
    inputSha256: digest(inputs), groups } satisfies Publication;
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  try {
    const option = (key: string) => process.argv.find(v => v.startsWith('--' + key + '='))?.slice(key.length + 3) || '';
    if (!option('out')) throw new Error('Explicit private plan output required');
    const plan = await buildMaintenancePlan({ playerRuns: option('player-runs') ? option('player-runs').split(',') : [], teamRun: option('team-run'), statsRun: option('stats-run'), index: option('index'), sourceDir: option('source-dir') || '.scoutzero-dev/core', season: option('season'), asOf: option('as-of') });
    await privateJson(option('out'), plan);
    console.log(JSON.stringify({ planSha256: digest(canonical(plan)), groups: plan.groups.length, inputSha256: plan.inputSha256, productionWriteAuthorized: false }));
  } catch (error) { console.error(error instanceof Error ? error.message : 'Plan failed'); process.exitCode = 1; }
}
