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
    assert.equal(init?.method, 'GET');
    assert.equal(url, 'https://firestore.googleapis.com/v1/projects/scoutzero-bf1ae/databases/(default)/documents/architect_basePlayers/luka_doncic');
    return new Response(JSON.stringify({ name: url.slice('https://firestore.googleapis.com/v1/'.length) }));
  }) as typeof fetch;
  assert.equal((await probeMaintenancePermissions('SYNTHETIC', send)).ordinaryReadVerified, true);
  assert.equal(calls.length, 2); assert(!calls.some(v => v.includes(':commit')));
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
    await assert.rejects(() => collectMaintenance(path.join(root, 'run'), {
      operation: 'contracts', season: '2026-27', asOf: '2026-10-18T00:00:00Z',
      inventory: { first: { teamCode: 'LAL', url: 'https://www.salaryswish.com/players/first' },
        next: { teamCode: 'BOS', url: 'https://www.salaryswish.com/players/next' } },
    }), /rate limit reached/);
    assert.equal(calls, 1, 'A source-wide throttle must not become a request for every remaining player');
    const coverage = JSON.parse(await readFile(path.join(root, 'run/coverage.json'), 'utf8'));
    assert.equal(coverage.failed, 1); assert.equal(coverage.missing, 1); assert.equal(coverage.complete, false);
  } finally { globalThis.fetch = originalFetch; await rm(root, { recursive: true, force: true }); }
});

test('foundation source receipts retain original UTF-8 bytes and independent capture identities', async () => {
  const { retainFoundationSource } = await import('../../scripts/dev/foundationSource.js');
  const { readFile, readdir, rm, stat } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const root = await mkdtemp(path.join(os.tmpdir(), 'nba-foundation-source-'));
  try {
    const body = '{"name":"Dončić","number":1.00}\n';
    const url = 'https://stats.nba.com/stats/commonplayerinfo?PlayerID=1629029';
    const before = Date.now();
    retainFoundationSource(root, url, body); retainFoundationSource(root, url, body);
    const receipts = (await readdir(path.join(root, 'raw'))).filter(f => f.endsWith('.json'));
    assert.equal(receipts.length, 2);
    for (const file of receipts) {
      const receipt = JSON.parse(await readFile(path.join(root, 'raw', file), 'utf8'));
      const bytes = await readFile(path.join(root, 'raw', receipt.file));
      assert.equal(bytes.toString('utf8'), body); assert.equal(receipt.url, url);
      assert.equal(receipt.sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.equal(receipt.bytes, Buffer.byteLength(body));
      assert(Date.parse(receipt.capturedAt) >= before && Date.parse(receipt.capturedAt) <= Date.now());
      assert.equal((await stat(path.join(root, 'raw', receipt.file))).mode & 0o777, 0o600);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
