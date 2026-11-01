import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSnapshot, coverage } from '../../scripts/dev/cloudData';
import { seedOverlappingDraftPoolWorld } from './fixtures/overlappingDraftPoolWorld';
import { TeamListFull } from '@/constants/teamList';
import {
  conditionalState,
  conditionalDraft,
  prepareConditionalTrade,
} from './helpers/conditionalDraftJourney';
import {
  readReviewUserId,
  getReviewAdminDb,
  openDashboardTab,
} from './helpers/architectReviewWorld';

test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 15000,
  trace: 'on',
});
test.setTimeout(600000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_OVERLAPPING_POOL,
  'Protected retained catalogue and separate native terms required.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/overlapping-draft-pool';
const teamName = (code: string) =>
  TeamListFull.find((team) => team.code === code)!.teamName;
function receipt(name: string, value: unknown) {
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, `${name}.json`),
    JSON.stringify(value, null, 2)
  );
}
async function capture(page: Page, name: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${name}-1280x720.png`) });
}
async function sourceState() {
  return (
    await getReviewAdminDb().collection('architect_baseEntitlements').get()
  ).docs.map((d) => ({ id: d.id, data: d.data() }));
}
async function room(page: Page) {
  if (new URL(page.url()).searchParams.get('room') !== 'trade')
    await page.getByRole('tab', { name: /^Trade Machine$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByRole('region', { name: 'Swap pool' })).toBeVisible({
    timeout: 30000,
  });
  return dialog;
}
async function start(page: Page, name: string) {
  await page.goto('/gm/BKN?season=2028');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `native_${name}_${Date.now()}`;
  const fixture = await seedOverlappingDraftPoolWorld(uid, worldId);
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2028');
    },
    { uid, worldId }
  );
  await page.reload();
  return {
    ...fixture,
    uid,
    worldId,
    root: getReviewAdminDb().doc(`architect_worlds/${worldId}`),
  };
}
async function digest(page: Page, worldId: string) {
  return page.evaluate(async (worldId) => {
    const loader =
      '/src/features/architect/utils/draftReview/conditionalWorld.ts';
    const digester =
      '/src/features/architect/utils/mutationPipeline.snapshotDigest.ts';
    const { loadConditionalWorld } = await import(loader);
    const { mutationSnapshotDigest } = await import(digester);
    return mutationSnapshotDigest(
      (await loadConditionalWorld(worldId)).snapshots
    );
  }, worldId);
}
test.afterAll(() => {
  const paths = ['protected', 'conveyed', 'exception'].map((m) =>
    path.join(proofDir, `${m}-proof.json`)
  );
  if (paths.every((p) => fs.existsSync(p))) {
    const journeys = paths.map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
    if (
      journeys.every(
        (j) => j.candidate === process.env.SCOUTZERO_PROOF_CANDIDATE
      )
    )
      receipt('proof', {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        scope: 'governed-simulation-only',
        packageSha256: journeys[0].packageSha256,
        nativeTermsSha256: journeys[0].nativeTermsSha256,
        journeys,
      });
  }
});

for (const mode of ['protected', 'conveyed', 'exception'] as const)
  test(`overlapping ${mode}: all teams, selection ownership, History, Compare and reload`, async ({
    page,
  }) => {
    const { program, catalogue, worldId, root } = await start(page, mode);
    const initial = await conditionalState(worldId),
      sourceBefore = await sourceState();
    expect(coverage(await loadSnapshot()).sha256).toBe(
      coverage(
        JSON.parse(
          fs.readFileSync(
            process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE!,
            'utf8'
          )
        )
      ).sha256
    );
    // Explicit source-aggregate examples, independent of the sequential resolver.
    const scenarios = {
      protected: {
        positions: {
          BKN: 20,
          PHX: 3,
          PHI: 8,
          NYK: 6,
          WAS: 25,
          POR: 14,
          MIL: 27,
        },
        holders: {
          BKN: 'WAS',
          PHX: 'BKN',
          PHI: 'PHI',
          NYK: 'NYK',
          WAS: 'PHX',
          POR: 'POR',
          MIL: 'MIL',
        },
      },
      conveyed: {
        positions: {
          BKN: 20,
          PHX: 24,
          PHI: 9,
          NYK: 15,
          WAS: 27,
          POR: 3,
          MIL: 6,
        },
        holders: {
          BKN: 'NYK',
          PHX: 'MIL',
          PHI: 'BKN',
          NYK: 'BKN',
          WAS: 'PHX',
          POR: 'POR',
          MIL: 'WAS',
        },
      },
      exception: {
        positions: {
          BKN: 20,
          PHX: 3,
          PHI: 9,
          NYK: 6,
          WAS: 14,
          POR: 27,
          MIL: 25,
        },
        holders: {
          BKN: 'PHX',
          PHX: 'BKN',
          PHI: 'BKN',
          NYK: 'NYK',
          WAS: 'WAS',
          POR: 'MIL',
          MIL: 'POR',
        },
      },
    };
    const { positions, holders } = scenarios[mode];
    const allocation = Object.fromEntries(
      program.slots.map((s) => [
        s.entitlementId,
        holders[s.originalTeam as keyof typeof holders],
      ])
    );
    const elections = Object.fromEntries(
      program.claims.map((c) => [c.clauseId, true])
    );
    let dialog = await room(page);
    await expect(dialog).toContainText('Governed test world');
    await expect(dialog).toContainText('All five elections are required');
    for (const [team, position] of Object.entries(positions))
      await dialog.getByLabel(`${team} draft position`).fill(String(position));
    for (let i = 1; i <= 5; i++)
      await dialog.getByLabel(`Claim ${i} election`).selectOption('exercise');
    await capture(page, `${mode}-prepared`);
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      dialog.getByRole('button', { name: 'Resolve 2028 draft' }).click(),
    ]);
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(1);
    expect((await root.get()).data()!.draftSwapProgram.result).toEqual({
      positions,
      elections,
      allocation,
    });
    dialog = await room(page);
    await expect(dialog).toContainText('Swap rights resolved');
    for (const s of program.slots)
      await expect(dialog).toContainText(
        `${s.originalTeam} 2028 first: held by ${allocation[s.entitlementId]} at pick ${positions[s.originalTeam]}`
      );
    await capture(page, `${mode}-resolved`);
    const affected = [
      ...new Set([
        ...program.slots.flatMap((s) => [s.originalTeam, s.holderTeam]),
        ...program.claims.flatMap((c) => [c.holderTeam, c.targetTeam]),
      ]),
    ].sort();
    expect(affected).toHaveLength(7);
    for (const [index, team] of affected.entries()) {
      await page.goto(`/gm/${team}?season=2028`);
      await openDashboardTab(page, 'Team History');
      const timeline = page.getByTestId('team-history-section-timeline');
      await expect(timeline).toContainText('Draft Obligation Resolved');
      await timeline
        .getByRole('button')
        .filter({ hasText: '2028 swap pool resolved' })
        .click();
      for (const s of program.slots)
        await expect(
          page.getByTestId('team-history-detail-sections')
        ).toContainText(
          `${teamName(s.originalTeam)} 2028 first: final pick ${positions[s.originalTeam]} · held by ${teamName(allocation[s.entitlementId])}`
        );
      await capture(page, `${mode}-${index}-history`);
      await page.getByTestId('team-history-detail-close').click();
      for (const phase of ['compare', 'reload']) {
        if (phase === 'reload') await page.reload();
        await openDashboardTab(page, 'Compare');
        for (const s of program.slots.filter(
          (s) => s.originalTeam === team || allocation[s.entitlementId] === team
        ))
          await expect(
            page.getByText(
              `${s.originalTeam} 2028 first: final pick ${positions[s.originalTeam]} · held by ${allocation[s.entitlementId]}`,
              { exact: true }
            )
          ).toBeVisible();
        await capture(page, `${mode}-${index}-${phase}`);
      }
      const expand = page.getByRole('button', { name: 'Expand activity rail' });
      if (await expand.isVisible()) await expand.click();
      await page.getByTestId('cockpit-activity-rail-assets-open').click();
      for (const s of program.slots.filter(
        (s) => allocation[s.entitlementId] === team
      ))
        await expect(
          page.getByTestId('cockpit-assets-panel-picks-2028-first')
        ).toContainText(`Final pick ${positions[s.originalTeam]}`);
      if (team === program.claims[4].holderTeam) {
        const rights = page.getByTestId('cockpit-assets-panel-rights-2028');
        await expect(rights).toContainText(
          `${team} residual swap option against ${program.claims[4].targetTeam} — resolved`
        );
        await expect(rights).toContainText(
          'Archival record — not an additional executable right'
        );
      }
      await capture(page, `${mode}-${index}-assets`);
      await page.keyboard.press('Escape');
      const card = (await room(page)).getByTestId(`trade-team-card-${team}`);
      await card
        .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
        .click();
      const inventory = (await root.collection('teams').doc(team).get()).data()!
        .entitlementIds;
      for (const s of program.slots) {
        expect(inventory.includes(s.entitlementId)).toBe(
          allocation[s.entitlementId] === team
        );
        await expect(
          card.locator(`[data-entitlement-id="${s.entitlementId}"]`)
        ).toHaveCount(allocation[s.entitlementId] === team ? 1 : 0);
      }
    }
    const final = await conditionalState(worldId);
    const docs = (state: typeof final) =>
      state.children.find((c) => c.name === 'entitlements')!.docs;
    expect(docs(final)).toHaveLength(278);
    const terms = (state: typeof final) =>
      docs(state).map(({ id, data: { holderTeam, ...rest } }) => ({
        id,
        rest,
      }));
    expect(terms(final)).toEqual(terms(initial));
    for (const id of [
      ...program.claims.flatMap((c) => c.representationIds),
      ...program.unrelatedClaims.map((c) => c.representationId),
    ])
      expect(docs(final).find((d) => d.id === id)).toEqual(
        docs(initial).find((d) => d.id === id)
      );
    expect(final.metadata!.draftSimulationUnresolved).toEqual(
      catalogue.data.unresolved
    );
    expect(catalogue.data.unresolved).toHaveLength(29);
    expect(await sourceState()).toEqual(sourceBefore);
    receipt(`${mode}-proof`, {
      candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
      scope: 'governed-simulation-only',
      packageSha256: createHash('sha256')
        .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
        .digest('hex'),
      nativeTermsSha256: createHash('sha256')
        .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_OVERLAPPING_POOL!))
        .digest('hex'),
      allocation,
      positions,
      catalogue: 278,
      unresolved: 29,
      affected,
      sourceUnchanged: true,
      archivalUnchanged: true,
      history: true,
      compare: true,
      reload: true,
      inventory: true,
      teamPlan: true,
    });
  });

test('overlapping draft fails closed and commits once under stale/concurrent/repeated requests', async ({
  page,
}) => {
  const { program, worldId, root, uid } = await start(page, 'negative');
  await room(page);
  const sourceBefore = await sourceState();
  const positions = Object.fromEntries(
    program.slots.map((s, i) => [s.originalTeam, i + 9])
  );
  const request = {
    operationId: 'native_resolution',
    expectedRevision: 0,
    draftYear: 2028,
    positions,
    elections: Object.fromEntries(
      program.claims.map((c) => [c.clauseId, true])
    ),
    expectedDraftStateDigest: await digest(page, worldId),
  };
  const pristine = await conditionalState(worldId);
  for (const invalid of [
    { ...request, positions: {} },
    {
      ...request,
      positions: Object.fromEntries(
        program.slots.map((s) => [s.originalTeam, 3])
      ),
    },
    { ...request, elections: {} },
    {
      ...request,
      elections: { ...request.elections, [program.claims[0].clauseId]: false },
    },
    { ...request, elections: { ...request.elections, extra: true } },
    { ...request, expectedRevision: 1 },
    { ...request, expectedDraftStateDigest: 'stale' },
  ]) {
    expect((await conditionalDraft(page, worldId, invalid)).success).toBe(
      false
    );
    expect(await conditionalState(worldId)).toEqual(pristine);
  }
  for (const broken of [
    { ...program, conveyance: { ...program.conveyance, protectedThrough: 1 } },
    {
      ...program,
      conveyance: { ...program.conveyance, sourceRefs: ['missing-authority'] },
    },
    {
      ...program,
      claims: program.claims.map((c, i) =>
        i ? c : { ...c, clauseId: 'unsupported-native-clause' }
      ),
    },
    { ...program, claims: program.claims.slice(1) },
    { ...program, unrelatedClaims: [] },
    { ...program, claims: [...program.claims].reverse() },
    {
      ...program,
      conveyance: { ...program.conveyance, priorObligation: 'unknown' },
    },
    {
      ...program,
      claims: program.claims.map((c, i) =>
        i ? c : { ...c, dependencyIds: ['unknown'] }
      ),
    },
  ]) {
    await root.update({ draftSwapProgram: broken });
    const before = await conditionalState(worldId);
    expect((await conditionalDraft(page, worldId, request)).success).toBe(
      false
    );
    expect(await conditionalState(worldId)).toEqual(before);
  }
  await root.update({ draftSwapProgram: program });
  expect(
    (
      await prepareConditionalTrade(
        page,
        uid,
        worldId,
        [program.claims[2].representationIds[1]],
        ['WAS', 'MIL'],
        { seasonId: '2027-28', asOfDate: '2028-06-05', yearKey: 2028 }
      )
    ).status
  ).not.toBe('prepared');
  const participant = root
      .collection('teams')
      .doc(program.slots[0].originalTeam),
    saved = (await participant.get()).data()!;
  await participant.update({ concurrentChange: 'pool-participant' });
  const stale = await conditionalState(worldId);
  expect((await conditionalDraft(page, worldId, request)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(stale);
  await participant.set(saved);
  request.expectedDraftStateDigest = await digest(page, worldId);
  const outcomes = await Promise.all([
    conditionalDraft(page, worldId, request),
    conditionalDraft(page, worldId, { ...request, operationId: 'race' }),
  ]);
  expect(outcomes.filter((o) => o.success)).toHaveLength(1);
  const resolved = await conditionalState(worldId);
  expect((await conditionalDraft(page, worldId, request)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(resolved);
  const event = root.collection('events').doc('swapDraft__2028'),
    eventData = (await event.get()).data()!;
  await event.update({ 'metadata.swapDraftReceipt.date': '2028-06-29' });
  await expect(digest(page, worldId)).rejects.toThrow(
    /matching committed receipt/
  );
  await event.delete();
  await expect(digest(page, worldId)).rejects.toThrow(
    /matching committed receipt/
  );
  await event.set(eventData);
  expect((await root.collection('events').get()).size).toBe(1);
  expect(await sourceState()).toEqual(sourceBefore);
  receipt('negative-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    scope: 'governed-simulation-only',
    missingTermsNoWrite: true,
    archivalNonExecutable: true,
    unsupportedWaiverNoWrite: true,
    tiesNoWrite: true,
    staleParticipantNoWrite: true,
    duplicateNoWrite: true,
    concurrentOnce: true,
    missingReceiptRejected: true,
    sourceUnchanged: true,
  });
});
