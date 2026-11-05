import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  seedMixedConditionalWorld,
  CONDITIONAL_PLAYERS,
  CONDITIONAL_COLLECTIONS,
} from './fixtures/mixedConditionalWorld';
import { conditionalDraft } from './helpers/conditionalDraftJourney';
import { combineMixedConditionalReceipts } from './helpers/mixedConditionalReceipt';
import {
  completeConditionalState,
  conditionalStateDigest,
  conditionalLogin,
  openConditionalTrade,
  selectMixedConditionalTrade,
  prepareMixedConditional,
  applyMixedConditional,
} from './helpers/mixedConditionalJourney';
import {
  getReviewAdminDb,
  openDashboardTab,
} from './helpers/architectReviewWorld';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';

test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 15000,
  trace: 'on',
});
test.setTimeout(600000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE ||
    !process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE,
  'Protected retained-catalogue and full-baseline proof only.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/mixed-conditional';
function receipt(name: string, value: unknown) {
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, `${name}.json`),
    JSON.stringify(value, null, 2)
  );
}
async function capture(page: Page, key: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${key}-1280x720.png`) });
}
async function sources() {
  return createHash('sha256')
    .update(
      JSON.stringify(
        (
          await getReviewAdminDb()
            .collection('architect_baseEntitlements')
            .get()
        ).docs.map((d) => ({ id: d.id, data: d.data() }))
      )
    )
    .digest('hex');
}
test.afterAll(() => {
  const files = [10, 11].map((p) => path.join(proofDir, `proof-${p}.json`));
  if (files.every((f) => fs.existsSync(f)))
    receipt(
      'proof',
      combineMixedConditionalReceipts(
        process.env.SCOUTZERO_PROOF_CANDIDATE,
        files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
      )
    );
});

for (const position of [10, 11])
  test(`mixed conditional first at position ${position}: commit, resolution, season and reload`, async ({
    page,
  }) => {
    const uid = await conditionalLogin(page);
    const worldId = `mixed_conditional_${position}_${Date.now()}`;
    const { catalogue, program } = await seedMixedConditionalWorld(
      uid,
      worldId
    );
    const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
    const before = await completeConditionalState(worldId);
    const sourceBefore = await sources();
    const teamBefore = before.children.find((c) => c.name === 'teams')!.docs;
    const playerBefore = (team: string) =>
      teamBefore
        .find((t) => t.id === team)!
        .data.players.find(
          (p: any) =>
            p.playerId === CONDITIONAL_PLAYERS[team as 'CHI' | 'CHA'].id
        );
    const contracts = {
      CHI: playerBefore('CHA').contract,
      CHA: playerBefore('CHI').contract,
    };
    const preview = await prepareMixedConditional(page, uid, worldId, [
      program.stages[0].entitlementId,
    ]);
    receipt(`preview-${position}`, preview);
    expect(preview).toMatchObject({ status: 'prepared', legal: true });
    expect(await completeConditionalState(worldId)).toEqual(before);
    await page.evaluate(
      ({ uid, worldId }) => {
        localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
        localStorage.setItem('hz.currentSeasonEndYear', '2026');
      },
      { uid, worldId }
    );
    await page.reload();
    const dialog = await selectMixedConditionalTrade(
      page,
      worldId,
      program.stages[0].entitlementId
    );
    await capture(page, `${position}-proposal`);
    await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 60000,
      })
      .toBe(1);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await expect(page).not.toHaveURL(/[?&]room=trade(?:&|$)/);
    const initialEvent = (await root.collection('events').get()).docs[0].data();
    for (const id of [
      'tre_jones',
      'tre_mann',
      program.stages[0].entitlementId,
      ...Object.values(CONDITIONAL_COLLECTIONS)
        .flat()
        .map((p) => p.id),
      'AGGREGATED_STANDARD_TPE',
      'governed-simulation-only',
    ])
      expect(JSON.stringify(initialEvent)).toContain(id);

    expect([...initialEvent.playerIds].sort()).toEqual(
      Object.values(CONDITIONAL_COLLECTIONS)
        .flat()
        .map((p) => p.id)
        .sort()
    );

    const committedContracts: Record<string, any> = {};
    async function verifyViews(
      stage: 'committed' | 'resolved' | 'season' | 'fallback',
      year: number,
      eventCount: number
    ) {
      const saved = await completeConditionalState(worldId);
      const teams = saved.children.find((c) => c.name === 'teams')!.docs;
      const entitlements = saved.children.find(
        (c) => c.name === 'entitlements'
      )!.docs;
      expect(entitlements.map((e) => e.id)).toEqual(
        before.children
          .find((c) => c.name === 'entitlements')!
          .docs.map((e) => e.id)
      );
      expect(entitlements).toHaveLength(278);
      expect(saved.metadata.draftSimulationUnresolved).toEqual(
        catalogue.data.unresolved
      );
      expect(catalogue.data.unresolved).toHaveLength(29);
      expect(
        saved.children.find((c) => c.name === 'contractBaselines')
      ).toEqual(before.children.find((c) => c.name === 'contractBaselines'));
      const deferred = position === 10 && stage !== 'committed';
      expect(
        entitlements.find((e) => e.id === program.stages[0].entitlementId)!.data
          .holderTeam
      ).toBe(deferred ? 'CHI' : 'CHA');
      expect(
        entitlements.find((e) => e.id === program.stages[1].entitlementId)!.data
          .holderTeam
      ).toBe(deferred ? 'CHA' : 'CHI');
      for (const [i, team] of (['CHI', 'CHA'] as const).entries()) {
        const incoming = CONDITIONAL_PLAYERS[i ? 'CHI' : 'CHA'];
        const outgoing = CONDITIONAL_PLAYERS[team];
        const allIncoming = CONDITIONAL_COLLECTIONS[i ? 'CHI' : 'CHA'];
        const allOutgoing = CONDITIONAL_COLLECTIONS[team];
        const current = teams.find((t) => t.id === team)!.data;
        const prior = teamBefore.find((t) => t.id === team)!.data;
        expect([...current.roster].sort()).toEqual(
          prior.roster
            .filter((id: string) => !allOutgoing.some((p) => p.id === id))
            .concat(allIncoming.map((p) => p.id))
            .sort()
        );
        const player = current.players.find(
          (p: any) => p.playerId === incoming.id
        );
        expect(player.contract.contractId).toBe(contracts[team].contractId);
        if (stage === 'committed')
          committedContracts[team] = structuredClone(player.contract);
        const continuingRows = contracts[team].salariesByYear.filter(
          (row: any) => Number(row.season.slice(0, 4)) + 1 >= year
        );
        expect(player.contract.salariesByYear).toHaveLength(
          continuingRows.length
        );
        for (const row of continuingRows)
          expect(player.contract.salariesByYear).toEqual(
            expect.arrayContaining([expect.objectContaining(row)])
          );
        if (year === 2027) {
          const archive = saved.children
            .find((c) => c.name === 'seasonHistory')!
            .docs.find((d) => d.data.teamCode === team)!.data;
          expect(archive).toMatchObject({
            fromSeason: '2025-26',
            toSeason: '2026-27',
          });
          const priorPlayer = archive.preAdvanceState.players.find(
            (p: any) => p.playerId === incoming.id
          );
          // Canonical history omits legacy display flags. Contract identity,
          // duration and every salary/guarantee/option/bonus row remain exact.
          expect(priorPlayer.contract).toMatchObject({
            contractId: committedContracts[team].contractId,
            yearsRemaining: committedContracts[team].yearsRemaining,
            salariesByYear: committedContracts[team].salariesByYear,
          });
        }
        // Independent arithmetic: twelve governed depth Contracts plus every unchanged retained incoming Contract.
        const money =
          132000000 +
          allIncoming.reduce(
            (n, p) => n + (year === 2026 ? p.salary : p.nextSalary),
            0
          );
        expect(current.totals.teamSalary).toBe(money);
        expect(current.totals.apronTeamSalary).toBe(money);
        expect(current.totals.taxSalary).toBe(
          year === 2026
            ? 132000000 + allOutgoing.reduce((n, p) => n + p.salary, 0)
            : money
        );
        expect(current.hardCapped).toBe(year === 2026);
        if (year === 2026) {
          expect(current.hardCapLevel).toBe('firstApron');
          const aggregation = current.hardCapLedger.find(
            (entry: any) => entry.restrictionRow === 'H'
          );
          expect(aggregation).toMatchObject({
            salaryMatchingPath: 'AGGREGATED_STANDARD_TPE',
            apronLevel: 'SECOND_APRON',
            salaryCapYear: 2026,
          });
          expect(
            aggregation.triggers
              .flatMap((trigger: any) =>
                trigger.incomingPlayers.map((p: any) => p.playerId)
              )
              .sort()
          ).toEqual(allIncoming.map((p) => p.id).sort());
        }

        const overrides = saved.players.find((p) => p.team === team)!.docs;
        expect(
          overrides.find((p) => p.id === incoming.id)!.data.contract
        ).toEqual(player.contract);
        expect(overrides.some((p) => p.id === outgoing.id)).toBe(false);
        for (const p of allIncoming) {
          const source = teamBefore
            .find((t) => t.id === (i ? 'CHI' : 'CHA'))!
            .data.players.find((q: any) => q.playerId === p.id);
          const savedPlayer = current.players.find(
            (q: any) => q.playerId === p.id
          );
          expect(savedPlayer.contract.contractId).toBe(
            source.contract.contractId
          );
          expect(savedPlayer.contract.salariesByYear).toEqual(
            expect.arrayContaining(
              source.contract.salariesByYear
                .filter((r: any) => Number(r.season.slice(0, 4)) + 1 >= year)
                .map((r: any) => expect.objectContaining(r))
            )
          );
          expect(overrides.find((q) => q.id === p.id)!.data.contract).toEqual(
            savedPlayer.contract
          );
          if (year === 2027) {
            const archive = saved.children
              .find((c) => c.name === 'seasonHistory')!
              .docs.find((d) => d.data.teamCode === team)!.data;
            expect(
              archive.preAdvanceState.players.find(
                (q: any) => q.playerId === p.id
              ).contract.contractId
            ).toBe(source.contract.contractId);
          }
        }
        for (const p of allOutgoing)
          expect(overrides.some((q) => q.id === p.id)).toBe(false);
        expect([...current.entitlementIds].sort()).toEqual(
          entitlements
            .filter((e) => e.data.holderTeam === team)
            .map((e) => e.id)
            .sort()
        );

        await page.goto(`/gm/${team}?season=${year}`);
        await page.reload();
        await openDashboardTab(page, 'Roster');
        for (const p of allIncoming)
          await expect(
            page.getByAltText(new RegExp(`^${p.name}$`, 'i')).first()
          ).toBeVisible();
        for (const p of allOutgoing)
          await expect(
            page.getByAltText(new RegExp(`^${p.name}$`, 'i'))
          ).toHaveCount(0);
        await expect(
          page.getByAltText(new RegExp(`^${incoming.name}$`, 'i')).first()
        ).toBeVisible();
        await expect(
          page.getByAltText(new RegExp(`^${outgoing.name}$`, 'i'))
        ).toHaveCount(0);
        await openDashboardTab(page, 'Full Cap Table');
        await expect(
          page
            .getByRole('button', {
              name: new RegExp(`^${incoming.name}$`, 'i'),
            })
            .first()
        ).toBeVisible();
        for (const [attr, key] of [
          ['data-team-salary', 'teamSalary'],
          ['data-apron-team-salary', 'apronTeamSalary'],
          ['data-tax-salary', 'taxSalary'],
        ])
          await expect
            .poll(() =>
              page
                .locator(`[${attr}]`)
                .evaluateAll(
                  (els, attr) => els.map((e) => Number(e.getAttribute(attr))),
                  attr
                )
            )
            .toContain(current.totals[key]);
        expect(
          Number(
            (
              await page
                .locator(
                  `[data-testid="cap-sheet-full-total-cell"][data-salary-cap-year="${year}"]`
                )
                .innerText()
            ).replace(/[^0-9.-]/g, '')
          )
        ).toBe(money);
        await capture(page, `${position}-${stage}-${team}-cap`);
        await openDashboardTab(page, 'Team History');
        await page
          .getByTestId('team-history-section-timeline')
          .getByRole('button', { name: /Trade Executed:/ })
          .click();
        const detail = page.getByTestId('team-history-detail-modal');
        await expect(detail).toContainText(/Tre Jones/i);
        await expect(detail).toContainText(/Tre Mann/i);
        for (const p of Object.values(CONDITIONAL_COLLECTIONS).flat())
          await expect(detail).toContainText(new RegExp(p.name, 'i'));
        await expect(detail).toContainText('2026 first-round pick');
        await expect(detail).toContainText(
          'conditional right (top 10 protected; 2027 unprotected fallback)'
        );
        await detail.getByRole('button', { name: /close/i }).click();
        if (stage !== 'committed') {
          const outcome = position === 10 ? 'deferred' : 'conveyed';
          await page
            .getByTestId('team-history-section-timeline')
            .getByRole('button')
            .filter({ hasText: `2026 first-round pick ${outcome}` })
            .click();
          await expect(
            page.getByTestId('team-history-detail-sections')
          ).toContainText(
            `2026 first-round pick ${outcome} at pick ${position}`
          );
          if (position === 10)
            await expect(
              page.getByTestId('team-history-detail-sections')
            ).toContainText('2027 first owed to Charlotte Hornets');
          await page.getByTestId('team-history-detail-close').click();
        }
        if (stage === 'fallback') {
          await page
            .getByTestId('team-history-section-timeline')
            .getByRole('button')
            .filter({ hasText: '2027 first-round pick conveyed' })
            .click();
          await expect(
            page.getByTestId('team-history-detail-sections')
          ).toContainText('2027 first-round pick conveyed at pick 1');
          await page.getByTestId('team-history-detail-close').click();
        }
        await openDashboardTab(page, 'Compare');
        await expect(page.getByTestId('comparison-event-count')).toContainText(
          new RegExp(`${eventCount}\\s+saved move`)
        );
        await expect(
          page.getByTestId('comparison-roster-additions')
        ).toContainText(new RegExp(incoming.name, 'i'));
        await expect(
          page.getByTestId('comparison-roster-removals')
        ).toContainText(new RegExp(outgoing.name, 'i'));
        for (const p of allIncoming)
          await expect(
            page.getByTestId('comparison-roster-additions')
          ).toContainText(new RegExp(p.name, 'i'));
        for (const p of allOutgoing)
          await expect(
            page.getByTestId('comparison-roster-removals')
          ).toContainText(new RegExp(p.name, 'i'));
        await expect(
          page.getByText(
            `CHI ${deferred ? 2027 : 2026} first-round pick${stage === 'committed' ? ' — conditional right (top 10 protected; 2027 unprotected fallback)' : deferred && stage !== 'fallback' ? ' — conditional right (unprotected)' : ''}`,
            {
              exact: true,
            }
          )
        ).toBeVisible();
        const expand = page.getByRole('button', {
          name: 'Expand activity rail',
        });
        if (await expand.isVisible()) await expand.click();
        await expect(
          page.getByTestId('cockpit-activity-rail-identity')
        ).toContainText('Players and Protected First');
        await expect(
          page.getByTestId('cockpit-activity-rail-save-indicator')
        ).toHaveAttribute('data-save-status', 'saved');
        await expect(
          page.getByTestId('cockpit-activity-rail-strip-roster')
        ).toContainText('15 / 15');
        await expect(
          page.getByTestId('cockpit-activity-rail-strip-two-way')
        ).toContainText('3 / 3');
        await page.getByTestId('cockpit-activity-rail-assets-open').click();
        const assets = page.getByTestId('cockpit-assets-panel');
        if (stage === 'committed')
          await expect(assets).toContainText(
            i
              ? 'CHI 2026 conditional first — picks 11–30; otherwise 2027 unprotected first'
              : 'Top 10 retained; otherwise to CHA'
          );
        else if (position === 10 && stage !== 'fallback' && i)
          await expect(assets).toContainText(
            'CHI 2027 conditional first — unprotected'
          );
        else if (stage === 'fallback' && i)
          await expect(assets).toContainText('Final pick 1 · conveyed');
        else if (position === 11 && year === 2026 && i)
          await expect(assets).toContainText('Final pick 11 · conveyed');
        if (stage === 'committed' && !i)
          await expect(assets).toContainText(
            'Reserved fallback — owed to CHA if 2026 is protected'
          );
        await capture(page, `${position}-${stage}-${team}-assets`);
        await page.keyboard.press('Escape');
        const room = await openConditionalTrade(page);
        const card = room.getByTestId(`trade-team-card-${team}`);
        await card
          .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
          .click();
        const id = program.stages[deferred ? 1 : 0].entitlementId;
        if (Number(deferred ? 2027 : 2026) >= year)
          await expect(
            card.locator(`[data-entitlement-id="${id}"]`)
          ).toHaveCount(i ? 1 : 0);
      }
      expect(await completeConditionalState(worldId)).toEqual(saved);
      receipt(`${position}-${stage}`, {
        metadata: saved.metadata,
        teams: teams.filter((t) => ['CHI', 'CHA'].includes(t.id)),
        events: saved.children.find((c) => c.name === 'events'),
        bothTeamsReloaded: true,
      });
    }
    await verifyViews('committed', 2026, 1);
    let room = await openConditionalTrade(page);
    await room.getByLabel('CHI draft position').fill(String(position));
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      room.getByRole('button', { name: 'Resolve 2026 draft' }).click(),
    ]);
    expect(
      (await root.get()).data()!.draftConditionalPrograms[0].results
    ).toEqual([
      {
        year: 2026,
        position,
        outcome: position === 10 ? 'deferred' : 'conveyed',
      },
    ]);
    await verifyViews('resolved', 2026, 2);
    const playerRef = root
      .collection('teams')
      .doc('CHA')
      .collection('players')
      .doc('noa_essengue');
    const savedPlayer = (await playerRef.get()).data()!;
    await playerRef.set({
      ...savedPlayer,
      contract: { ...savedPlayer.contract, yearsRemaining: 999 },
    });
    const conflictingContract = await conditionalStateDigest(worldId);
    const refusedSeason = await page.evaluate(async (worldId) => {
      const p = '/src/features/architect/utils/seasonManager.ts';
      return (await import(p)).advanceSeasonInWorld(worldId, {
        fromSeason: '2025-26',
      });
    }, worldId);
    expect(refusedSeason.success).toBe(false);
    expect(refusedSeason.error).toMatch(/Contract.*conflicts/);
    expect(await conditionalStateDigest(worldId)).toBe(conflictingContract);
    await playerRef.set(savedPlayer);
    room = await openConditionalTrade(page);
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      room.getByRole('button', { name: 'Advance to 2026–27' }).click(),
    ]);
    expect((await root.collection('seasonHistory').get()).size).toBe(30);
    await verifyViews('season', 2027, 3);
    const beforeSeasonRetry = await conditionalStateDigest(worldId);
    const seasonRetry = await page.evaluate(async (worldId) => {
      const p = '/src/features/architect/utils/seasonManager.ts';
      return (await import(p)).advanceSeasonInWorld(worldId, {
        fromSeason: '2025-26',
      });
    }, worldId);
    expect(seasonRetry.success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(beforeSeasonRetry);
    if (position === 10) {
      room = await openConditionalTrade(page);
      await room.getByLabel('CHI draft position').fill('1');
      await Promise.all([
        page.waitForEvent('load', { timeout: 120000 }),
        room.getByRole('button', { name: 'Resolve 2027 draft' }).click(),
      ]);
      await verifyViews('fallback', 2027, 4);
    }
    const final = await completeConditionalState(worldId);
    const noWrite = await conditionalStateDigest(worldId);
    expect(
      (
        await conditionalDraft(page, worldId, {
          operationId: 'duplicate_resolve',
          expectedRevision: final.metadata.draftInventoryRevision,
          draftYear: position === 10 ? 2027 : 2026,
          positions: { CHI: position === 10 ? 1 : 11 },
        })
      ).success
    ).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(noWrite);
    expect(await sources()).toBe(sourceBefore);
    receipt(`proof-${position}`, {
      candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
      scope: 'governed-simulation-only',
      packageSha256: createHash('sha256')
        .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
        .digest('hex'),
      position,
      playerIds: Object.values(CONDITIONAL_COLLECTIONS)
        .flat()
        .map((p) => p.id),
      matching: 'AGGREGATED_STANDARD_TPE',
      catalogue: 278,
      unresolved: 29,
      bothTeamsReloadedAtEveryStage: true,
      contractsAndBooks: true,
      sourceUnchanged: true,
      metadata: final.metadata,
    });
  });

test('mixed conditional operations fail closed with complete world no-write checks', async ({
  page,
}) => {
  // Each case re-reads the retained baseline and the entire saved world.
  test.setTimeout(900000);
  const uid = await conditionalLogin(page);
  const worldId = `mixed_conditional_negative_${Date.now()}`;
  const { program, catalogue } = await seedMixedConditionalWorld(uid, worldId);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const original = await completeConditionalState(worldId);
  const sourceBefore = await sources();
  const pristine = await conditionalStateDigest(worldId);
  const ids = [program.stages[0].entitlementId];
  const rejected: Record<string, unknown> = {};
  for (const mode of [
    'incomplete',
    'cash',
    'forged-terms',
    'forged-contract',
    'incoming',
  ]) {
    const preview = await prepareMixedConditional(
      page,
      uid,
      worldId,
      ids,
      mode
    );
    expect(
      preview.status === 'error' ||
        preview.status === 'blocked' ||
        preview.legal === false
    ).toBe(true);
    expect((await applyMixedConditional(page)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(pristine);
    rejected[mode] = preview;
  }
  const adverse = catalogue.data.records.find(
    (r) => r.originalPick?.id === 'CHI_2028_1st'
  )!.entitlementId;
  const branchFailure = await prepareMixedConditional(page, uid, worldId, [
    ...ids,
    adverse,
  ]);
  expect(branchFailure.status).toBe('blocked');
  expect(JSON.stringify(branchFailure)).toMatch(
    /stepien|consecutive|future first/i
  );
  expect((await applyMixedConditional(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(pristine);
  rejected.adverseFallbackBranch = branchFailure;
  expect(
    (
      await prepareMixedConditional(page, uid, worldId, [
        program.stages[1].entitlementId,
      ])
    ).status
  ).toBe('error');
  expect((await applyMixedConditional(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(pristine);
  for (const changedProgram of [
    [{ ...program, stages: [program.stages[0]] }],
    [program, { ...program, id: 'conflict' }],
    [
      {
        ...program,
        results: [{ year: 2026, position: 10, outcome: 'conveyed' }],
      },
    ],
  ]) {
    await root.update({ draftConditionalPrograms: changedProgram });
    const snapshot = await conditionalStateDigest(worldId);
    expect(
      (await prepareMixedConditional(page, uid, worldId, ids)).status
    ).toBe('error');
    expect((await applyMixedConditional(page)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(snapshot);
    await root.update({ draftConditionalPrograms: [program] });
  }
  expect(await completeConditionalState(worldId)).toEqual(original);
  expect(await prepareMixedConditional(page, uid, worldId, ids)).toMatchObject({
    legal: true,
  });
  for (const mode of ['forged', 'changed']) {
    expect((await applyMixedConditional(page, mode)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(pristine);
  }
  for (const targetPath of [
    'teams/CHI',
    'teams/CHA/players/tre_jones',
    `entitlements/${ids[0]}`,
  ]) {
    expect(
      await prepareMixedConditional(page, uid, worldId, ids)
    ).toMatchObject({ legal: true });
    const ref = root
      .collection(targetPath.split('/')[0])
      .doc(targetPath.split('/').slice(1).join('/'));
    const prior = await ref.get();
    await ref.set({ ...(prior.data() ?? {}), changedAfterValidation: true });
    const changed = await conditionalStateDigest(worldId);
    expect((await applyMixedConditional(page)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(changed);
    if (prior.exists) await ref.set(prior.data()!);
    else await ref.delete();
  }
  for (const mode of ['missing-finance', 'hard-cap', 'roster']) {
    const ref = root.collection('teams').doc('CHI');
    const prior = (await ref.get()).data()!;
    const changed = structuredClone(prior);
    if (mode === 'missing-finance') delete changed.salaryBookInputs;
    if (mode === 'hard-cap')
      changed.salaryBookInputs.apronAdjustments.lineItems[0].amount += 50000000;
    if (mode === 'roster') {
      const twoWay = changed.players.find((p: any) => p.isTwoWay);
      changed.players.push({
        ...twoWay,
        id: 'extra-two-way',
        playerId: 'extra-two-way',
        player_id: 'extra-two-way',
      });
      changed.roster.push('extra-two-way');
    }
    if (mode !== 'missing-finance')
      changed.totals = createCanonicalTeamTotalsSnapshot(changed, 2026, {
        asOfDate: '2026-06-05',
      });
    await ref.set(changed);
    const snapshot = await conditionalStateDigest(worldId);
    const preview = await prepareMixedConditional(page, uid, worldId, ids);
    expect(preview.status === 'error' || preview.legal === false).toBe(true);
    expect(JSON.stringify(preview)).toMatch(
      mode === 'hard-cap'
        ? /hard cap violation/i
        : mode === 'roster'
          ? /two-way.*exceeded|two-way.*cannot exceed/i
          : /needs governed input/i
    );
    expect((await applyMixedConditional(page)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(snapshot);
    await ref.set(prior);
    rejected[mode] = preview;
  }
  expect(await prepareMixedConditional(page, uid, worldId, ids)).toMatchObject({
    legal: true,
  });
  expect((await applyMixedConditional(page)).success).toBe(true);
  const committed = await conditionalStateDigest(worldId);
  expect((await applyMixedConditional(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(committed);
  const revision = (await root.get()).data()!.draftInventoryRevision;
  const request = {
    operationId: 'mixed_draft',
    expectedRevision: revision,
    draftYear: 2026,
    positions: { CHI: 10 },
  };
  for (const invalid of [
    { ...request, positions: {} },
    { ...request, positions: { CHI: 31 } },
    { ...request, draftYear: 2027 },
    { ...request, expectedRevision: revision - 1 },
    { ...request, expectedDraftStateDigest: 'forged' },
    { ...request, expectedDraftStateDigest: undefined },
    { ...request, elections: { CHI: true } },
  ]) {
    expect((await conditionalDraft(page, worldId, invalid)).success).toBe(
      false
    );
    expect(await conditionalStateDigest(worldId)).toBe(committed);
  }
  const reviewed = await page.evaluate(async (worldId) => {
    const p = '/src/features/architect/utils/draftReview/conditionalWorld.ts';
    const d =
      '/src/features/architect/utils/mutationPipeline.snapshotDigest.ts';
    return (await import(d)).mutationSnapshotDigest(
      (await (await import(p)).loadConditionalWorld(worldId)).snapshots
    );
  }, worldId);
  await root.update({
    draftSimulationCalendar: [
      { year: 2026, date: '2026-06-29' },
      { year: 2027, date: '2027-06-30' },
    ],
  });
  const stale = await conditionalStateDigest(worldId);
  expect(
    (
      await conditionalDraft(page, worldId, {
        ...request,
        expectedDraftStateDigest: reviewed,
      })
    ).success
  ).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(stale);
  await root.update({
    draftSimulationCalendar: original.metadata.draftSimulationCalendar,
  });
  const outcomes = await Promise.all([
    conditionalDraft(page, worldId, request),
    conditionalDraft(page, worldId, { ...request, operationId: 'race' }),
  ]);
  expect(outcomes.filter((r) => r.success)).toHaveLength(1);
  const resolved = await conditionalStateDigest(worldId);
  expect((await conditionalDraft(page, worldId, request)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(resolved);
  const advanceSeason = () =>
    page.evaluate(async (worldId) => {
      const p = '/src/features/architect/utils/seasonManager.ts';
      return (await import(p)).advanceSeasonInWorld(worldId, {
        fromSeason: '2025-26',
      });
    }, worldId);
  const eventRef = root.collection('events').doc('conditionalDraft__2026');
  const committedReceipt = (await eventRef.get()).data()!;
  await eventRef.delete();
  const missingReceipt = await conditionalStateDigest(worldId);
  expect((await advanceSeason()).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(missingReceipt);
  await eventRef.set(committedReceipt);
  const resolvedPrograms = (await root.get()).data()!.draftConditionalPrograms;
  const forgedPrograms = structuredClone(resolvedPrograms);
  forgedPrograms[0].results[0].position = 9;
  await root.update({ draftConditionalPrograms: forgedPrograms });
  const forgedOutcome = await conditionalStateDigest(worldId);
  expect((await advanceSeason()).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(forgedOutcome);
  await root.update({ draftConditionalPrograms: resolvedPrograms });
  // Full-world season checks include metadata, all 30 teams/player overrides,
  // entitlement identities, baseline Contracts, events, history and manifests.
  await root.update({ draftSimulationSeasonBooks: {} });
  const missingSeason = await conditionalStateDigest(worldId);
  const advance = await advanceSeason();
  expect(advance.success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(missingSeason);
  expect(await sources()).toBe(sourceBefore);
  receipt('negative-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    rejected,
    completeWorldNoWrites: true,
    draftInputsDigestRequired: true,
    concurrentDraftOnce: true,
    sourceUnchanged: true,
  });
});
