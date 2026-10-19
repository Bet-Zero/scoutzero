import { requireRegisteredPublication } from '../../scripts/dev/maintenanceApprovals.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { maintenanceContext } from '../../scripts/dev/maintenanceContext.js';
import { openMaintenanceRun } from '../../scripts/dev/maintenanceRun.js';
import { canonical } from '../../scripts/dev/cloudPipeline.js';
import { digest } from '../../scripts/dev/cloudData.js';
import { publishMaintenance, validatePublication, restoreMaintenanceRehearsal, type Publication, type PublicationApproval, type PublicationStore } from '../../scripts/dev/maintenancePublish.js';
import { parseStats } from '../../player-scrape/stats/scripts/parse_stats.js';
import { buildStatsOutput } from '../../player-scrape/stats/scripts/run_stats.js';
import { firestoreFieldHash } from '../../scripts/dev/firestoreValue.js';
import { buildMaintenanceTeam } from '../../team-scrape/shared/firestore_staging/scripts/stage_team.js';
import { assembleMaintenanceInputs } from '../../scripts/dev/maintenanceInputs.js';
import { planStatistics } from '../../scripts/dev/maintenanceStats.js';

test('season and as-of reject ambiguous and impossible dates across July rollover', () => {
  assert.equal(maintenanceContext('2026-27', '2026-07-01T00:00:00Z').startYear, 2026);
  for (const season of ['', '2026', '2026-26']) assert.throws(() => maintenanceContext(season, '2026-07-01T00:00:00Z'));
  for (const date of ['', '2026-02-30T00:00:00Z', '2026-10-18']) assert.throws(() => maintenanceContext('2026-27', date));
});

test('fresh mode never adopts files and resume verifies exact inventory, dates and output bytes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'maintenance-run-'));
  const request = { operation: 'contracts' as const, season: '2026-27', asOf: '2026-10-18T00:00:00Z', inventory: { player: { teamCode: 'LAL' }, missing: {} } };
  const run = await openMaintenanceRun(dir, request, false);
  assert.equal(run.coverage().complete, false);
  await mkdir(path.join(dir, 'contracts')); await writeFile(path.join(dir, 'contracts/player.json'), '{}');
  await run.record('player', 'processed', ['contracts/player.json']); await run.record('missing', 'missing', []);
  assert.equal(run.coverage().missing, 1); assert.equal(run.coverage().complete, false);
  assert.equal(await (await openMaintenanceRun(dir, request, true)).verified('player'), true);
  await assert.rejects(() => openMaintenanceRun(dir, request, false), /EEXIST/);
  await assert.rejects(() => openMaintenanceRun(dir, { ...request, season: '2027-28' }, true), /generation/);
  await assert.rejects(() => openMaintenanceRun(dir, { ...request, inventory: { player: { teamCode: 'DAL' } } }, true), /generation/);
  await writeFile(path.join(dir, 'contracts/player.json'), '{"changed":true}');
  await assert.rejects(() => run.verified('player'), /generation changed/);
});

function fixture() {
  const plan: Publication = { version: 1, project: 'demo-architect-review', database: '(default)', inputSha256: 'a'.repeat(64), season: '2026-27', asOf: '2026-10-18T00:00:00Z',
    groups: ['one', 'two'].map((id, i) => ({ id, entries: [{ path: `players_v2/player_${i}`, beforeFields: { retained: { booleanValue: true } }, afterFields: { retained: { booleanValue: true }, value: { integerValue: '2' } }, precondition: { updateTime: '2026-10-18T00:00:00Z' } }] })) };
  const planSha256 = digest(canonical(plan));
  const approval: PublicationApproval = { planSha256, project: plan.project, database: plan.database, expiresAt: new Date(Date.now() + 60000).toISOString(),
    qualification: { verdict: 'ACCEPT', reviewer: 'independent fixture', receipt: 'https://linear.app/bzero/fixture', inputSha256: plan.inputSha256 },
    review: { verdict: 'ACCEPT', reviewer: 'independent fixture', receipt: 'https://github.com/Bet-Zero/scoutzero/fixture', planSha256 },
    owner: { decision: 'APPROVE', actor: 'fixture only', receipt: 'https://linear.app/bzero/fixture', planSha256 } };
  const documents = new Map<string, { fields: Record<string, unknown>; updateTime: string }>(plan.groups.map(g => [g.entries[0].path, { fields: g.entries[0].beforeFields!, updateTime: '2026-10-18T00:00:00Z' }]));
  let counter = 0;
  const store: PublicationStore = { project: plan.project, database: plan.database, read: async p => documents.get(p) || null,
    commit: async writes => {
      const at = new Date(Date.parse('2026-10-18T00:01:00Z') + counter++).toISOString();
      for (const w of writes as any[]) {
        const p = (w.update?.name || w.delete).split('/documents/')[1]; const old = documents.get(p);
        assert(w.currentDocument.exists === false ? !old : old?.updateTime === w.currentDocument.updateTime);
      }
      for (const w of writes as any[]) {
        const p = (w.update?.name || w.delete).split('/documents/')[1];
        if (w.delete) documents.delete(p); else documents.set(p, { fields: w.update.fields, updateTime: at });
      }
    } };
  return { plan, approval, store, documents };
}

test('publication resumes after a committed-but-unacknowledged group and verifies every group', async () => {
  const f = fixture(); const commit = f.store.commit; let calls = 0;
  f.store.commit = async writes => { await commit(writes); if (++calls === 1) throw new Error('Lost acknowledgement'); };
  await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store), /acknowledgement/);
  f.store.commit = commit;
  const result = await publishMaintenance(f.plan, f.approval, f.store);
  assert.equal(result.complete, true); assert.equal(result.resumedGroups, 1);
  await restoreMaintenanceRehearsal(f.plan, f.store);
  assert.deepEqual(f.documents.get('players_v2/player_0')?.fields, { retained: { booleanValue: true } });
  await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store), /Conflicting/);
});

test('changed approvals, target, source, duplicate scope, oversized groups and stale records fail closed', async () => {
  for (const edit of [
    (f: ReturnType<typeof fixture>) => { f.approval.planSha256 = 'b'.repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.approval.expiresAt = '2020-01-01'; },
    (f: ReturnType<typeof fixture>) => { f.approval.qualification.inputSha256 = 'b'.repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.plan.groups[0].entries[0].path = 'architect_worlds/private'; },
    (f: ReturnType<typeof fixture>) => { f.store.project = 'scoutzero-bf1ae'; },
  ]) { const f = fixture(); edit(f); await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store)); }
  const f = fixture(); f.documents.get('players_v2/player_1')!.updateTime = '2026-10-18T00:00:01Z';
  await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store), /precondition/);
  assert(!f.documents.has('maintenance_publications/' + f.approval.planSha256 + '/groups/two'));
  const giant = fixture(); giant.plan.groups[0].entries = Array(451).fill(giant.plan.groups[0].entries[0]);
  giant.approval.planSha256 = digest(canonical(giant.plan)); giant.approval.review.planSha256 = giant.approval.planSha256; giant.approval.owner.planSha256 = giant.approval.planSha256;
  assert.throws(() => validatePublication(giant.plan, giant.approval, giant.store), /bounded/);
});

test('subsequent edits prevent repeated success and automatic rehearsal recovery', async () => {
  const f = fixture(); await publishMaintenance(f.plan, f.approval, f.store);
  f.documents.get('players_v2/player_0')!.updateTime = '2026-10-18T00:02:00Z';
  await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store), /changed/);
  await assert.rejects(() => restoreMaintenanceRehearsal(f.plan, f.store), /Concurrent/);
});

test('777-group bounded retries advance past a large prefix, recover lost ack and verify every result', async () => {
  const f = fixture(); const template = f.plan.groups[0].entries[0];
  f.documents.clear();
  f.plan.groups = Array.from({ length: 777 }, (_, i) => ({ id: `group_${i}`, entries: [{ ...template, path: `players_v2/player_${i}` }] }));
  for (const group of f.plan.groups) f.documents.set(group.entries[0].path, { fields: template.beforeFields!, updateTime: '2026-10-18T00:00:00Z' });
  f.approval.planSha256 = digest(canonical(f.plan)); f.approval.review.planSha256 = f.approval.planSha256; f.approval.owner.planSha256 = f.approval.planSha256;
  let clock = 0; let commits = 0; let lost = false; const commit = f.store.commit;
  const reads: string[][] = [];
  f.store.readMany = async paths => { clock += Math.ceil(paths.length / 100) * 2500; reads.push(paths); return new Map(paths.map(p => [p, f.documents.get(p) || null])); };
  f.store.commit = async writes => { clock += 2500; await commit(writes); commits++; if (commits === 390 && !lost) { lost = true; throw new Error('Lost acknowledgement'); } };
  let previous = 0; let runs = 0; let complete = false;
  while (!complete && runs++ < 40) {
    const start = clock; reads.length = 0;
    try {
      const result = await publishMaintenance(f.plan, f.approval, f.store, { deadline: start + 300000, now: () => clock });
      complete = result.complete;
      assert.equal(result.state, complete ? 'complete' : 'partial');
      assert(result.completedGroups > previous || complete);
      if (!complete) {
        // Only ledger is read from the completed prefix, never all completed player documents.
        assert(!reads.slice(1).some(paths => paths.includes('players_v2/player_0')) || previous === 0);
      } else assert(reads.at(-1)!.includes('players_v2/player_0') && reads.at(-1)!.includes('players_v2/player_776'));
      previous = result.completedGroups;
    } catch (error) { assert.match(String(error), /Lost acknowledgement/); }
    assert(clock - start <= 315000, 'one bounded group/final bulk request may cross the cooperative deadline; transport enforces the hard deadline');
  }
  assert(complete && lost && runs > 1); assert.equal(commits, 777);
  f.documents.get('players_v2/player_0')!.updateTime = '2026-10-18T00:03:00Z';
  await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store), /changed/);
});

test('bounded partial is not completion, and final verification rejects a changed prefix', async () => {
  const f = fixture();
  assert.equal((await publishMaintenance(f.plan, f.approval, f.store, { maxGroups: 1 })).complete, false);
  f.documents.get('players_v2/player_0')!.updateTime = '2026-10-18T00:04:00Z';
  await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store), /changed/);
  const g = fixture(); let commits = 0; g.store.commit = async () => { commits++; };
  const result = await publishMaintenance(g.plan, g.approval, g.store, { deadline: 1, now: () => 1 });
  assert.equal(result.state, 'partial'); assert.equal(commits, 0);
});

test('bounded bulk transport uses fixed get-only endpoints, pins snapshots and rejects incomplete responses', async () => {
  const { maintenanceStore } = await import('../../scripts/dev/maintenanceTransport.js');
  const originalFetch = globalThis.fetch;
  try {
    for (const scenario of ['valid', 'missing-row', 'duplicate', 'wrong-path', 'changed-time']) {
      let calls = 0;
      globalThis.fetch = async (input, init) => {
        assert.equal(String(input), 'http://127.0.0.1:8082/v1/projects/demo-architect-review/databases/(default)/documents:batchGet');
        assert.equal(init?.redirect, 'error'); assert.equal(init?.method, 'POST');
        const body = JSON.parse(String(init?.body)); calls++;
        assert.equal(body.readTime, calls === 1 ? undefined : '2026-10-18T00:00:00Z');
        const rows = body.documents.map((name: string) => ({ missing: name, readTime: scenario === 'changed-time' && calls === 2 ? '2026-10-18T00:01:00Z' : '2026-10-18T00:00:00Z' }));
        if (scenario === 'missing-row') rows.pop();
        if (scenario === 'duplicate') rows.push(rows[0]);
        if (scenario === 'wrong-path') rows[0].missing = 'projects/other/databases/(default)/documents/players_v2/private';
        return new Response(JSON.stringify(rows));
      };
      const store = await maintenanceStore(false);
      const paths = Array.from({ length: 101 }, (_, i) => `players_v2/player_${i}`);
      if (scenario === 'valid') { const result = await store.readMany!(paths); assert.equal(result.size, 101); assert.equal(result.get(paths[0]), null); assert.equal(calls, 2); }
      else await assert.rejects(() => store.readMany!(paths), /snapshot/);
      await assert.rejects(() => store.readMany!(['architect_worlds/private']), /path rejected/);
    }
    const expired = await maintenanceStore(false, undefined, 0);
    await assert.rejects(() => expired.read('players_v2/player'), /budget exhausted/);
    globalThis.fetch = async (_input, init) => {
      await new Promise(resolve => setTimeout(resolve, 40));
      assert.equal(init?.signal?.aborted, true); throw init!.signal!.reason;
    };
    const bounded = await maintenanceStore(false, undefined, Date.now() + 20);
    await assert.rejects(() => bounded.read('players_v2/player'), { name: 'TimeoutError' });
  } finally { globalThis.fetch = originalFetch; }
});

test('equivalent Firestore null and empty representations compare without converting stored types', () => {
  assert.equal(firestoreFieldHash({ value: { nullValue: 0 }, map: { mapValue: {} }, array: { arrayValue: {} } }),
    firestoreFieldHash({ value: { nullValue: 'NULL_VALUE' }, map: { mapValue: { fields: {} } }, array: { arrayValue: { values: [] } } }));
  assert.notEqual(firestoreFieldHash({ value: { timestampValue: '2026-01-01T00:00:00Z' } }), firestoreFieldHash({ value: { stringValue: '2026-01-01T00:00:00Z' } }));
});

test('traded-player statistics prefer season aggregate and never turn prior-season fallback into current data', () => {
  const json = { resultSets: [{ name: 'SeasonTotalsRegularSeason', headers: ['SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'PTS'],
    rowSet: [['2025-26', 'DAL', 10, 4], ['2025-26', 'TOT', 60, 15], ['2025-26', 'LAL', 50, 17]] }] };
  const parsed = parseStats(json, {}, { season: 2025, allowFallback: true });
  assert.equal(parsed.team, 'TOT'); assert.equal(parsed.stats.PTS, 15);
  const fallback = parseStats(json, {}, { season: 2026, teamCode: 'LAL', allowFallback: true });
  assert.equal(fallback.seasonId, '2025-26'); assert.equal(fallback._fallbackType, 'most_recent');
  assert.equal(buildStatsOutput(fallback, 'player', 'LAL', null).meta.statsCarryOver, true);
  json.resultSets[0].rowSet.splice(1, 1);
  assert.throws(() => parseStats(json, {}, { season: 2025, allowFallback: true }), /Multiple team stints/);
});

test('ordinary team preparation refuses invented identities and leaves draft adoption separate', () => {
  const raw: any = { teamCode: 'LAL', teamName: 'Lakers', season: '2026-27', roster: [{ displayName: 'Unknown Player' }], totals: {}, source: {} };
  assert.throws(() => buildMaintenanceTeam(raw, {}, '2026-27', '2026-10-18T00:00:00Z'), /Unresolved/);
  const team = buildMaintenanceTeam(raw, { known: { fullName: 'Unknown Player' } } as any, '2026-27', '2026-10-18T00:00:00Z');
  assert.deepEqual(team.roster, ['known']); assert(!('draftPicks' in team));
  const f = fixture(); f.plan.groups[0].entries[0].path = 'architect_baseTeams/LAL';
  f.plan.groups[0].entries[0].beforeFields = { entitlementIds: { arrayValue: { values: [{ stringValue: 'retained' }] } } };
  f.approval.planSha256 = digest(canonical(f.plan)); f.approval.review.planSha256 = f.approval.planSha256; f.approval.owner.planSha256 = f.approval.planSha256;
  assert.throws(() => validatePublication(f.plan, f.approval, f.store), /draft associations/);
  const ancillary = { ...raw, roster: [], capHolds: [{ displayName: 'Retired Player', capHoldAmount: 100, season: '2026-27' }] };
  const retained = buildMaintenanceTeam(ancillary, {}, '2026-27', '2026-10-18T00:00:00Z', { capHolds: [{ playerId: 'retired_player', playerName: 'Retired Player' }] });
  assert.equal(retained.capHolds?.[0].playerId, 'retired_player');
  assert.throws(() => buildMaintenanceTeam(ancillary, {}, '2026-27', '2026-10-18T00:00:00Z'), /Unresolved/);
});

 test('caller-written approval JSON cannot arm a production operation', () => { const f = fixture(); f.plan.project = 'scoutzero-bf1ae'; assert.throws(() => requireRegisteredPublication(digest(canonical(f.plan)), f.plan, f.approval), /not registered/); });

test('direct legacy writer invocations cannot bypass the shared publication gate', () => {
  for (const file of [
    'player-scrape/firestore_staging/scripts/push_staged_players.ts',
    'team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts',
    'team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts',
    'team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts',
    'team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts',
  ]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', file, '--confirmProject=scoutzero-bf1ae'], {
      encoding: 'utf8', env: { PATH: process.env.PATH, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082' }, timeout: 15000,
    });
    assert.equal(result.status, 1, file);
    assert.match(result.stderr, /Legacy bulk publication is retired/);
  }
});

test('mixed contract/statistics inventories retain per-player no-games membership', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'maintenance-scope-'));
  const context = { season: '2026-27', asOf: '2026-10-18T00:00:00Z' };
  const contracts = await openMaintenanceRun(path.join(root, 'contracts'), { ...context, operation: 'contracts', inventory: { with_stats: { teamCode: 'LAL' }, without_stats: { teamCode: 'LAL' } } }, false);
  await contracts.record('with_stats', 'processed', []); await contracts.record('without_stats', 'processed', []);
  const stats = await openMaintenanceRun(path.join(root, 'stats'), { ...context, operation: 'stats', inventory: { with_stats: { teamCode: 'LAL' } } }, false);
  await stats.record('with_stats', 'no-games', []);
  const out = path.join(root, 'inputs');
  await assembleMaintenanceInputs([path.join(root, 'contracts'), path.join(root, 'stats')], out);
  const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(out, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.statsInventory, ['with_stats']);
  assert.equal(manifest.statsStatus.with_stats, 'no-games');
  assert(!manifest.statsInventory.includes('without_stats'));
});

test('statistics-only planning never creates a player identity or publishes incomplete coverage', async () => {
  assert.throws(() => planStatistics({ documents: [] } as any, 'new_player', null, '2026-27'), /existing player/);
  const f = fixture(); f.plan.coverage = { expected: 3, processed: 2, unchanged: 0, withheld: ['LAL'], failed: 0, missing: 0 };
  f.approval.planSha256 = digest(canonical(f.plan)); f.approval.review.planSha256 = f.approval.planSha256; f.approval.owner.planSha256 = f.approval.planSha256;
  await assert.rejects(() => publishMaintenance(f.plan, f.approval, f.store), /Incomplete required publication coverage/);
});

test('foundation aggregate forwards explicit context, reuses index builder and stops on failure', async () => {
  const { buildFoundation } = await import('../../scripts/dev/maintenanceFoundation.js');
  const { readFile } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundation-flow-'));
  const args = ['--season=2027', '--as-of=2026-10-18T00:00:00Z', '--outputs-dir=' + path.join(root, 'outputs'), '--reports-dir=' + path.join(root, 'reports')];
  const steps: string[] = [];
  await buildFoundation(args, async (script, childArgs, env) => {
    steps.push(path.basename(script));
    assert.deepEqual(childArgs, ['--season=2027']);
    assert.equal(env.SEASON, '2027'); assert.equal(env.SEASON_CODE, '2026-27');
    assert.equal(env.MAINTENANCE_AS_OF, '2026-10-18T00:00:00.000Z');
    if (steps.length === 1) await writeFile(path.join(env.OUTPUTS_DIR!, 'all_player_ids.json'), JSON.stringify({ alpha_example: 1 }));
    else if (steps.length === 2) await writeFile(path.join(env.OUTPUTS_DIR!, 'players_bios_2027.json'), JSON.stringify({ alpha_example: { bio: { team: 'Lakers', position: 'G' } } }));
    else {
      const result = spawnSync(process.execPath, ['--import', 'tsx', script, ...childArgs], { env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
  });
  assert.deepEqual(steps, ['build_all_player_ids.ts', 'build_players_bios.ts', 'build_player_index.ts']);
  const index = JSON.parse(await readFile(path.join(root, 'outputs/player_index.json'), 'utf8'));
  assert.equal(index.alpha_example.nbaId, 1); assert.equal(index.alpha_example.teamCode, 'LAL');
  assert.equal(JSON.parse(await readFile(path.join(root, 'outputs/foundation-run.json'), 'utf8')).complete, true);
  await assert.rejects(() => buildFoundation(args), /EEXIST/);
  let called = 0;
  const failed = args.map(v => v.replace('/outputs', '/failed-output').replace('/reports', '/failed-reports'));
  await assert.rejects(() => buildFoundation(failed, () => { if (++called === 2) throw new Error('fixture failure'); }), /fixture failure/);
  assert.equal(called, 2);
  assert.equal(JSON.parse(await readFile(path.join(root, 'failed-output/foundation-run.json'), 'utf8')).complete, false);
  await assert.rejects(() => buildFoundation(['--season=2026-27'], () => assert.fail('Invalid context must not start source collection')), /END_YEAR/);
});

test('advertised bulk staging CLI needs no hidden date environment and propagates failures', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bulk-stage-'));
  const index = path.join(root, 'index.json');
  await writeFile(index, JSON.stringify({ alpha_example: { fullName: 'Alpha Example', teamCode: null, position: 'G' }, beta_example: { fullName: 'Beta Example', teamCode: null, position: 'F' } }));
  const env = { ...process.env }; delete env.MAINTENANCE_SEASON; delete env.MAINTENANCE_AS_OF;
  const args = ['--import', 'tsx', 'player-scrape/firestore_staging/scripts/stage_all_players.ts', '--season=2026-27', '--as-of=2026-10-18T00:00:00Z', '--index=' + index, '--contracts-dir=' + path.join(root, 'contracts'), '--stats-dir=' + path.join(root, 'stats'), '--outDir=' + path.join(root, 'out'), '--batchSize=1'];
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const { readFile } = await import('node:fs/promises');
  for (const id of ['alpha_example', 'beta_example']) assert(JSON.parse(await readFile(path.join(root, 'out/players_v2', id + '.json'), 'utf8')).doc);
  const missingContext = spawnSync(process.execPath, args.filter(v => !v.startsWith('--as-of=')), { env, encoding: 'utf8' });
  assert.equal(missingContext.status, 1);
  await writeFile(index, JSON.stringify({ missing_contract: { fullName: 'Missing Contract', teamCode: 'LAL' } }));
  assert.equal(spawnSync(process.execPath, args, { env, encoding: 'utf8' }).status, 1);
});

test('executor integrity checks actual files hidden by index flags', async () => {
  const { verifyTrackedExecutor } = await import('../../scripts/dev/maintenanceApprovals.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'executor-integrity-'));
  const git = (...args: string[]) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '--quiet'); await writeFile(path.join(root, 'executor.ts'), 'export const value = 1;\n');
  git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
  await verifyTrackedExecutor(root);
  for (const flag of ['skip-worktree', 'assume-unchanged']) {
    git('update-index', '--' + flag, 'executor.ts');
    await writeFile(path.join(root, 'executor.ts'), 'export const value = 2;\n');
    await assert.rejects(() => verifyTrackedExecutor(root), /tracked bytes differ/);
    await writeFile(path.join(root, 'executor.ts'), 'export const value = 1;\n');
    git('update-index', '--no-' + flag, 'executor.ts');
  }
});

test('maintenance access probe is non-mutating and rejects inadequate or excessive privileges', async () => {
  const { probeMaintenancePermissions, REQUIRED_MAINTENANCE_PERMISSIONS } = await import('../../scripts/dev/maintenanceAccess.js');
  let permissions = [...REQUIRED_MAINTENANCE_PERMISSIONS]; const calls: string[] = [];
  const send = (async (input, init) => {
    const url = String(input); calls.push(url);
    assert.equal(init?.redirect, 'error');
    if (url.endsWith(':testIamPermissions')) {
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({ permissions }));
    }
    if (url.endsWith(':batchGet')) {
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.documents, ['projects/scoutzero-bf1ae/databases/(default)/documents/architect_basePlayers/luka_doncic']);
      return new Response(JSON.stringify([{ found: { name: body.documents[0] }, readTime: '2026-10-18T00:00:00Z' }]));
    }
    assert.equal(init?.method, 'GET');
    assert.equal(url, 'https://firestore.googleapis.com/v1/projects/scoutzero-bf1ae/databases/(default)/documents/architect_basePlayers/luka_doncic');
    return new Response(JSON.stringify({ name: url.slice('https://firestore.googleapis.com/v1/'.length) }));
  }) as typeof fetch;
  assert.equal((await probeMaintenancePermissions('SYNTHETIC', send)).ordinaryReadVerified, true);
  assert.equal(calls.length, 4); assert(!calls.some(v => v.includes(':commit')));
  permissions = ['datastore.entities.get'];
  await assert.rejects(() => probeMaintenancePermissions('SYNTHETIC', send), /lacks required/);
  permissions = [...REQUIRED_MAINTENANCE_PERMISSIONS, 'datastore.entities.delete'];
  await assert.rejects(() => probeMaintenancePermissions('SYNTHETIC', send), /excessive/);
});

test('staging rejects misspelled flags and missing operands rather than choosing old inputs', async () => {
  const { parseArgs } = await import('../../player-scrape/firestore_staging/scripts/stage_player.js');
  const args = ['--player=fixture', '--season=2026-27', '--as-of=2026-10-18T00:00:00Z'];
  for (const invalid of [['--contracts_dir=/private'], ['--index', '--contracts-dir=/private'], ['--season'], ['--index='], ['--index=-bad'], ['--batchSize=1']]) {
    assert.throws(() => parseArgs([...args, ...invalid]));
  }
  assert.equal(parseArgs(args).season, '2026-27');
  assert.equal(parseArgs(args.slice(1).concat('--batchSize', '2'), true).batchSize, 2);
});

test('ordinary worker requires separate protected main and an exact reviewed registry', async () => {
  const { verifyMaintenanceProtection, maintenanceRegistry, runMaintenanceWorker } = await import('../../scripts/dev/maintenanceWorker.js');
  const environment = { name: 'nba-maintenance-publication', can_admins_bypass: false,
    protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 205859440 } }] }],
    deployment_branch_policy: { custom_branch_policies: true, protected_branches: false } };
  const branches = { branch_policies: [{ name: 'main', type: 'branch' }] };
  verifyMaintenanceProtection(environment, branches);
  for (const bad of [{ ...environment, can_admins_bypass: true }, { ...environment, protection_rules: [] }, { ...environment, name: 'draft-review-publication' }]) {
    assert.throws(() => verifyMaintenanceProtection(bad, branches), /Dedicated environment/);
  }
  assert.throws(() => verifyMaintenanceProtection(environment, { branch_policies: [{ name: '*', type: 'branch' }] }));
  assert.throws(() => verifyMaintenanceProtection({ ...environment, protection_rules: [{ type: 'required_reviewers', reviewers: [...environment.protection_rules[0].reviewers, { type: 'User', reviewer: { id: 1 } }] }] }, branches));
  assert.deepEqual(maintenanceRegistry({ version: 1, publications: {} }), {});
  assert.throws(() => maintenanceRegistry({ version: 1, publications: { arbitrary: {} } }));
  assert.throws(() => maintenanceRegistry({ version: 1, publications: { ['a'.repeat(64)]: { ciphertextSha256: 'b'.repeat(64), inputSha256: 'c'.repeat(64), qualificationReceipt: 'https://linear.app/fixture', reviewReceipt: 'https://github.com/fixture', ownerReceipt: 'https://linear.app/fixture', expiresAt: '2020-01-01T00:00:00Z' } } }), /expired/);
  await assert.rejects(() => runMaintenanceWorker('execute'), /Protected main workflow context/);
  const { maintenanceStore } = await import('../../scripts/dev/maintenanceTransport.js');
  await assert.rejects(() => maintenanceStore(true), /protected keyless GitHub worker/);
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/dev/maintenancePublish.cli.ts', '--production'], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /no local ADC or key is accepted/);
});

test('separate encrypted maintenance package round-trips using real GPG without retaining plaintext', async () => {
  const { decryptMaintenancePackage } = await import('../../scripts/dev/maintenanceWorker.js');
  const { readFile, rm } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(os.tmpdir(), 'maintenance-crypto-'));
  try {
    const passphrase = 'ab'.repeat(48); // Deliberately public fixture; never used for an actual package.
    const f = fixture(); const value = { plan: f.plan, approval: f.approval };
    const plain = path.join(root, 'source.json'); const encrypted = path.join(root, 'package.gpg');
    await writeFile(plain, JSON.stringify(value), { mode: 0o600 });
    const result = spawnSync('gpg', ['--no-options', '--homedir', root, '--batch', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256', '--output', encrypted, plain], {
      input: passphrase + '\n', env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.status, 0, 'GPG encryption must succeed');
    await rm(plain);
    const bytes = await readFile(encrypted);
    assert.deepEqual(decryptMaintenancePackage(bytes, passphrase, encrypted, root), value);
    assert.throws(() => decryptMaintenancePackage(bytes, 'cd'.repeat(48), encrypted, root), /decryption failed/);
    assert.throws(() => decryptMaintenancePackage(bytes, '', encrypted, root), /secret missing/);
  } finally {
    spawnSync('gpgconf', ['--homedir', root, '--kill', 'gpg-agent'], { stdio: 'ignore', timeout: 5000 });
    await rm(root, { recursive: true, force: true });
  }
});

test('publication packaging creates a separate private key file, verifies recovery and refuses overwrite', async () => {
  const { packageMaintenance } = await import('../../scripts/dev/maintenancePackage.js');
  const { readFile, rm, stat } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(os.tmpdir(), 'nba-package-proof-'));
  try {
    const f = fixture(); f.plan.project = 'scoutzero-bf1ae'; f.approval.project = f.plan.project;
    const sha = digest(canonical(f.plan)); f.approval.planSha256 = sha; f.approval.owner.planSha256 = sha; f.approval.review.planSha256 = sha;
    const out = path.join(root, 'payload.gpg'); const key = path.join(root, 'private-passphrase');
    const receipt = await packageMaintenance(f.plan, f.approval, out, key);
    assert.equal(receipt.privateReadbackVerified, true); assert.equal(receipt.productionWriteAuthorized, false);
    assert.equal(receipt.planSha256, sha); assert.equal(receipt.ciphertextSha256, digest(await readFile(out)));
    assert.match(await readFile(key, 'utf8'), /^[a-f0-9]{96}\n$/);
    assert.equal((await stat(key)).mode & 0o777, 0o600);
    await assert.rejects(() => packageMaintenance(f.plan, f.approval, out, key), /EEXIST/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a real source throttle stops the batch and retains failed/missing accounting for resume', async () => {
  const { collectMaintenance } = await import('../../scripts/dev/maintenanceCollect.js');
  const { readFile, rm } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(os.tmpdir(), 'nba-throttle-'));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 429 }); };
  try {
    const request = {
      operation: 'contracts' as const, season: '2026-27', asOf: '2026-10-18T00:00:00Z',
      inventory: { retained: { teamCode: 'LAL', url: 'https://www.salaryswish.com/players/retained' },
        first: { teamCode: 'LAL', url: 'https://www.salaryswish.com/players/first' },
        next: { teamCode: 'BOS', url: 'https://www.salaryswish.com/players/next' } },
    };
    const prior = await openMaintenanceRun(path.join(root, 'run'), request, false);
    await writeFile(path.join(root, 'run/retained.html'), 'retained exact source input');
    await prior.record('retained', 'processed', ['retained.html']);
    await assert.rejects(() => collectMaintenance(path.join(root, 'run'), request, true), /rate limit reached/);
    assert.equal(calls, 1, 'A source-wide throttle must not become a request for every remaining player');
    const coverage = JSON.parse(await readFile(path.join(root, 'run/coverage.json'), 'utf8'));
    assert.equal(coverage.failed, 1); assert.equal(coverage.missing, 1); assert.equal(coverage.complete, false); assert.equal(coverage.unchanged, 1);
  } finally { globalThis.fetch = originalFetch; await rm(root, { recursive: true, force: true }); }
});

test('foundation source receipts retain original UTF-8 bytes and independent capture identities', async () => {
  const { retainFoundationSource } = await import('../../scripts/dev/foundationSource.js');
  const { readFile, readdir, rm, stat } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const root = await mkdtemp(path.join(os.tmpdir(), 'nba-foundation-source-'));
  try {
    const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"name":"Dončić","number":1.00}\n'), Buffer.from([0xff, 0xfe])]);
    const url = 'https://stats.nba.com/stats/commonplayerinfo?PlayerID=1629029';
    const before = Date.now();
    retainFoundationSource(root, url, body); retainFoundationSource(root, url, body);
    const receipts = (await readdir(path.join(root, 'raw'))).filter(f => f.endsWith('.json'));
    assert.equal(receipts.length, 2);
    for (const file of receipts) {
      const receipt = JSON.parse(await readFile(path.join(root, 'raw', file), 'utf8'));
      const bytes = await readFile(path.join(root, 'raw', receipt.file));
      assert.deepEqual(bytes, body); assert.equal(receipt.url, url);
      assert.equal(receipt.sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.equal(receipt.bytes, Buffer.byteLength(body));
      assert(Date.parse(receipt.capturedAt) >= before && Date.parse(receipt.capturedAt) <= Date.now());
      assert.equal((await stat(path.join(root, 'raw', receipt.file))).mode & 0o777, 0o600);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('team collection retains disabled and training-camp players without adopting holds or dead money', async () => {
  const { parseTeamHtml } = await import('../../team-scrape/team-data/scripts/parse_team.js');
  const table = (group: string, player: string) => `<table class="sw_teamProfileRosterSection__table"><thead><tr><th>${group}</th></tr></thead><tbody><tr><td><a href="/players/${player}">${player}</a></td></tr></tbody></table>`;
  const html = '<h1>Example team</h1>' + [
    table('Active (15)', 'active'), table('Two-way contracts (3)', 'two-way'),
    table('Disabled List (1)', 'disabled'), table('Training Camp and Exhibit 10 (2)', 'camp'),
    table('HOLDS', 'hold'), table('UFAs', 'ufa'), table('DEAD MONEY', 'dead'),
  ].join('');
  const result = await parseTeamHtml(html, { url: 'https://www.salaryswish.com/teams/example', team: 'LAL', season: '2026-27', asOf: '2026-10-18T00:00:00Z' });
  assert.deepEqual(result.roster.map(p => p.displayName), ['active', 'two-way', 'disabled', 'camp']);
});

test('contract biography preserves both digits of inches beside metric text', async () => {
  const { parsePlayer } = await import('../../player-scrape/contracts/scripts/parse_player.js');
  for (const [height, expected] of [["6'11<span>211cm</span>", '6-11'], ["6'5<span>196cm</span>", '6-5'], ["6'11211cm", '6-11']] as const) {
    const value = await parsePlayer(`<h1>Example Player</h1><div>HEIGHT: ${height}</div>`, {
      playerId: 'example_player', teamCode: 'LAC', sourceUrl: 'https://www.salaryswish.com/players/example-player', asOf: new Date('2026-10-18T00:00:00Z'),
    });
    assert.equal(value.bio.height, expected);
  }
});

test('stale legacy aliases cannot replace a verified current canonical roster ID', () => {
  const raw: any = { teamCode: 'CHA', teamName: 'Example', season: '2026-27', roster: [
    { displayName: 'Simpson, K. J.', sourceUrl: 'https://www.salaryswish.com/players/kj-simpson' },
    { displayName: "O'Neale, Royce", sourceUrl: 'https://www.salaryswish.com/players/royce-oneale' },
    { displayName: 'Williams III, Robert', sourceUrl: 'https://www.salaryswish.com/players/robert-williams-iii' },
  ], totals: {}, source: {} };
  const index: any = {
    k_j_simpson: { fullName: 'KJ Simpson', salarySwishSlug: 'kj-simpson' },
    royce_oneale: { fullName: "Royce O'Neale", salarySwishSlug: 'royce-oneale' },
    robert_williams_iii: { fullName: 'Robert Williams III', salarySwishSlug: 'robert-williams-iii' },
  };
  const result = buildMaintenanceTeam(raw, index, '2026-27', '2026-10-18T00:00:00Z');
  assert.deepEqual(result.roster, ['k_j_simpson', 'royce_oneale', 'robert_williams_iii']);
});

test('offline parsing retains source acquisition separately from the evaluation date', async () => {
  const { parsePlayer } = await import('../../player-scrape/contracts/scripts/parse_player.js');
  const { parseTeamHtml } = await import('../../team-scrape/team-data/scripts/parse_team.js');
  const asOf = '2026-10-18T00:00:00.000Z'; const capturedAt = '2026-10-19T01:23:45.000Z';
  const value = await parsePlayer('<h1>Example Player</h1>', { playerId: 'example_player', sourceUrl: 'https://www.salaryswish.com/players/example-player', asOf: new Date(asOf), capturedAt: new Date(capturedAt) });
  assert.equal(value.source.scrapedAt, capturedAt); assert.equal(value.lastUpdated, asOf);
  const team = await parseTeamHtml('<h1>Example</h1>', { team: 'LAL', url: 'https://www.salaryswish.com/teams/example', season: '2026-27', asOf, capturedAt });
  assert.equal(team.source.scrapedAt, capturedAt); assert.equal(team.lastUpdated, asOf);
});

test('protected private factual review confines data recovery and has no publishing identity', async () => {
  const { createRequire } = await import('node:module');
  const { readFile, rm } = await import('node:fs/promises');
  const workflow = createRequire(import.meta.url)('yaml').parse(await readFile('.github/workflows/nba-maintenance-source-review.yml', 'utf8'));
  const job = workflow.jobs.qualification;
  assert.equal(job.environment, 'nba-maintenance-publication'); assert.equal(job['timeout-minutes'], 20);
  assert.deepEqual(job.permissions, { contents: 'read', 'pull-requests': 'read', issues: 'read', actions: 'read' });
  const action = job.steps.find((s: any) => s.id === 'claude');
  assert.equal(action.uses, 'anthropics/claude-code-action@cab360f6565aa35a51d6ce9e43f1f4287c0a32ea');
  assert.equal(action.with.show_full_output, 'false'); assert.equal(action.with.display_report, 'false');
  assert.match(action.with.claude_args, /--allowedTools "Read,Glob,Grep"/);
  const script = job.steps.find((s: any) => s.name?.startsWith('Recover exact private')).run.split("python3 - <<'PY'\n")[1].split('\nPY')[0];
  const root = await mkdtemp(path.join(os.tmpdir(), 'nba-private-review-'));
  const harness = `
import io,json,os,tarfile,hashlib,urllib.request,pathlib
scenario=os.environ['SCENARIO']
content=b'private fixture marker - must never enter public output'
name='review/CLAIMS.md'
if scenario=='traversal': name='review/../../escape.md'
if scenario=='unexpected-root': name='AGENTS.md'
plan={'version':1,'project':'scoutzero-bf1ae','database':'(default)','inputSha256':'b'*64,'groups':[{'id':'fixture','entries':[]}]}
if scenario=='wrong-target': plan['project']='demo-architect-review'
plan_bytes=json.dumps(plan,sort_keys=True,separators=(',',':')).encode()
plan_sha=hashlib.sha256(plan_bytes).hexdigest() if scenario!='wrong-plan' else 'd'*64
manifest={'format':'nba-maintenance-private-review-v1','planSha256':plan_sha,'inputSha256':'b'*64,'files':[{'path':name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()},{'path':'plans/publication-plan.json','bytes':len(plan_bytes),'sha256':hashlib.sha256(plan_bytes).hexdigest()}]}
packed=io.BytesIO()
with tarfile.open(fileobj=packed,mode='w:xz' if scenario=='valid-xz' else 'w:bz2' if scenario=='unsupported-compression' else 'w:gz') as archive:
 for filename,data in [(name,content),('plans/publication-plan.json',plan_bytes),('MANIFEST.json',json.dumps(manifest).encode())]:
  item=tarfile.TarInfo(filename);item.size=len(data)
  if scenario=='symlink' and filename==name: item.type=tarfile.SYMTYPE;item.linkname='/tmp/escape';item.size=0
  archive.addfile(item,io.BytesIO(data) if item.isfile() else None)
  if scenario=='duplicate' and filename==name: archive.addfile(item,io.BytesIO(data))
value=packed.getvalue()
connection={'format':'nba-maintenance-private-review-connection-v1','archiveSha256':hashlib.sha256(value).hexdigest(),'planSha256':plan_sha,'inputSha256':'b'*64,'url':'https://uploads.linear.app/fixture?signature=private-marker','archiveBytes':len(value),'recipientPem':'-----BEGIN CERTIFICATE-----\\nfixture'}
if scenario=='wrong-host': connection['url']='https://example.invalid/fixture'
if scenario=='wrong-digest': connection['archiveSha256']='c'*64
os.environ['CONNECTION']=json.dumps(connection)
os.environ['ARCHIVE_SHA256']=connection['archiveSha256'];os.environ['PLAN_SHA256']=plan_sha;os.environ['INPUT_SHA256']='b'*64
class Response:
 status=200
 def __enter__(self): return self
 def __exit__(self,*args): pass
 def read(self,n): return value[:n]
class Opener:
 def open(self,*args,**kwargs): return Response()
urllib.request.build_opener=lambda *args: Opener()
exec(compile(${JSON.stringify(script)},'<trusted-workflow>','exec'))
`;
  try {
    for (const scenario of ['valid', 'valid-xz', 'unsupported-compression', 'traversal', 'unexpected-root', 'symlink', 'duplicate', 'wrong-host', 'wrong-digest', 'wrong-plan', 'wrong-target']) {
      const dir = path.join(root, scenario); await mkdir(dir);
      const result = spawnSync('python3', ['-c', harness], { env: { ...process.env, RUNNER_TEMP: dir, SCENARIO: scenario }, encoding: 'utf8', timeout: 10000 });
      const valid = scenario === 'valid' || scenario === 'valid-xz';
      assert.equal(result.status, valid ? 0 : 1, result.stderr);
      assert(!result.stdout.includes('private-marker')); assert(!result.stdout.includes('private fixture marker'));
      if (valid) assert.equal(await readFile(path.join(dir, 'nba-source-private-review/review/CLAIMS.md'), 'utf8'), 'private fixture marker - must never enter public output');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private factual receipt retains original but rejects denied tools and failed execution', async () => {
  const { createRequire } = await import('node:module');
  const { readFile, rm } = await import('node:fs/promises');
  const workflow = createRequire(import.meta.url)('yaml').parse(await readFile('.github/workflows/nba-maintenance-source-review.yml', 'utf8'));
  const script = workflow.jobs.qualification.steps.find((s: any) => s.name?.startsWith('Encrypt complete result')).run.split("python3 - <<'PY'\n")[1].split('\nPY')[0];
  const root = await mkdtemp(path.join(os.tmpdir(), 'nba-review-result-'));
  const harness = `
import json,os,pathlib,subprocess
fixture_root=pathlib.Path(os.environ['RUNNER_TEMP']); private=fixture_root/'nba-source-private-review'; private.mkdir()
(private/'recipient.pem').write_text('fixture public certificate')
scenario=os.environ['SCENARIO']
report={'verdict':'REVISE' if scenario=='revise' else 'ACCEPT','review_report':'fixture judgment','findings':[],'validation':['Read fixture'],'scope_limits':[]}
result={'type':'result','subtype':'success','is_error':False,'structured_output':report,'permission_denials':[{'tool_name':'Bash','tool_input':{'command':'private denied marker'}}] if scenario=='denied' else []}
(fixture_root/'claude-execution-output.json').write_text(json.dumps([result]))
os.environ.update(OUTCOME='failure' if scenario=='failed' else 'success',PR='1',CANDIDATE='a'*40,GITHUB_SHA='b'*40,GITHUB_RUN_ID='123',ARCHIVE_SHA256='c'*64,PLAN_SHA256='d'*64,INPUT_SHA256='e'*64)
def check_output(args,**kwargs):
 return json.dumps({'merged':True,'head':{'sha':'a'*40},'merge_commit_sha':'b'*40} if '/pulls/' in args[-1] else {'object':{'sha':'b'*40}}).encode()
def encrypt(args,**kwargs):
 (fixture_root/'nba-private-review.cms').write_bytes(b'fixture encryption transport')
subprocess.check_output=check_output; subprocess.run=encrypt
exec(compile(${JSON.stringify(script)},'<trusted-receipt>','exec'))
`;
  try {
    for (const scenario of ['success', 'denied', 'failed', 'revise']) {
      const dir = path.join(root, scenario); await mkdir(dir);
      const result = spawnSync('python3', ['-c', harness], { env: { ...process.env, RUNNER_TEMP: dir, SCENARIO: scenario }, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr);
      assert.equal(result.stdout.includes('NBA_PRIVATE_SOURCE_REVIEW_ACCEPT'), scenario === 'success');
      assert(!result.stdout.includes('private denied marker'));
      const receipt = JSON.parse(await readFile(path.join(dir, 'nba-source-private-review/report.json'), 'utf8'));
      assert.equal(receipt.executionOutcome, scenario === 'failed' ? 'failure' : 'success');
      assert.equal(receipt.originalResult.permission_denials.length, scenario === 'denied' ? 1 : 0);
      assert.equal((await readFile(path.join(dir, 'nba-private-review.cms'))).length > 0, true);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('actual Vite server blocks private maintenance files across source URL forms', async () => {
  const { createServer } = await import('vite');
  const { randomUUID } = await import('node:crypto');
  const { rm } = await import('node:fs/promises');
  const relative = '.scoutzero-dev/privacy-proof-' + randomUUID();
  const dir = path.resolve(relative); await mkdir(dir, { recursive: true, mode: 0o700 });
  const marker = 'private-maintenance-fixture-' + randomUUID();
  await writeFile(path.join(dir, 'source.json'), JSON.stringify({ marker }), { mode: 0o600 });
  const server = await createServer({ configFile: path.resolve('vite.config.js'), logLevel: 'silent', optimizeDeps: { disabled: true }, server: { host: '127.0.0.1', port: 0, strictPort: false } });
  try {
    await server.listen(); const address = server.httpServer!.address();
    assert(address && typeof address === 'object'); const origin = 'http://127.0.0.1:' + address.port;
    const url = '/' + relative + '/source.json';
    for (const variant of [url, url + '?raw', '/@fs' + path.join(dir, 'source.json'), url.replace('/.scoutzero', '/%2escoutzero')]) {
      const response = await fetch(origin + variant);
      assert.equal(response.status, 403); assert(!(await response.text()).includes(marker));
    }
    assert.equal((await fetch(origin + '/players')).status, 200);
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});

test('current team salary uses reported totals and never sums future-year holds into this season', async () => {
  const { parseTeamHtml } = await import('../../team-scrape/team-data/scripts/parse_team.js');
  const row = (name: string, amount: string) => `<tr>${'<td></td>'.repeat(5)}<td class="sw_teamProfileStats__table_rowTitle">${name}</td><td>${amount}</td></tr>`;
  const html = '<h1>Example</h1><table class="sw_teamProfileStats__table"><tbody>' + row('ROSTER CAP HIT', '$10') + row('TEAM SALARY', '$10') + row('HOLDS', '-') + '</tbody></table>' +
    '<h3>HOLDS</h3><div><table><thead><tr><th>RFAs</th><th>2026-27</th><th>2027-28</th></tr></thead><tbody><tr><td><a href="/players/example">Example</a></td><td>-</td><td><span class="cap_hit team_salary_data">$100</span></td></tr></tbody></table></div>';
  const result = await parseTeamHtml(html, { team: 'LAL', url: 'https://www.salaryswish.com/teams/example', season: '2026-27', asOf: '2026-10-18T00:00:00Z' });
  assert.equal(result.totals.activeSalary, 10); assert.equal(result.totals.totalSalary, 10);
  assert.equal(result.totals.capHoldsTotal, 0); assert.equal(result.capHolds[0].season, '2027-28');
  assert.equal(result.capHolds[0].capHoldAmount, 100);
});
