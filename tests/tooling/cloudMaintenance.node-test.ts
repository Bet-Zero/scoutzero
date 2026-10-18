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
