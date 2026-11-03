import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  startMixedNative,
  selectMixedNative,
  prepareMixedNative,
  applyMixedNative,
} from './helpers/mixedNativeJourney';
import {
  completeConditionalState,
  conditionalStateDigest,
} from './helpers/mixedConditionalJourney';
import {
  getReviewAdminDb,
  openDashboardTab,
} from './helpers/architectReviewWorld';
import { NATIVE_MIXED_PLAYER } from './fixtures/mixedNativeWorld';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';

test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 15000,
  trace: 'on',
});

test('mixed native rejected operations leave the complete saved world unchanged', async ({
  page,
}) => {
  // Each rejection re-authenticates the retained world before checking no writes.
  test.setTimeout(900000);
  const { uid, worldId, root, ids } = await startMixedNative(page, 'negative');
  const prepare = (mode = '') =>
    prepareMixedNative(page, uid, worldId, [ids.PHI, ids.PHX], mode);
  const rejected: Record<string, unknown> = {};
  const sourceBefore = await sources();
  async function reject(name: string, pattern?: RegExp, mode = '') {
    const before = await conditionalStateDigest(worldId);
    const preview = await prepare(mode);
    expect(preview).not.toMatchObject({ status: 'prepared', legal: true });
    if (pattern) expect(JSON.stringify(preview)).toMatch(pattern);
    const applied = await applyMixedNative(page);
    expect(applied.success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(before);
    rejected[name] = { preview, applied, unchanged: true };
  }
  for (const mode of [
    'incomplete',
    'cash',
    'contract',
    'incoming',
    'missing-return',
  ])
    await reject(mode, undefined, mode);
  const metadata = (await root.get()).data()!;
  for (const asOfDate of ['2028-06-19', '2028-06-30']) {
    await root.update({ asOfDate });
    await reject(asOfDate, /date|timing|before|after|window|canonical/i);
    await root.set(metadata);
  }
  for (const patch of [
    { draftNativeLifecycle: null },
    { draftSwapProgram: { ...metadata.draftSwapProgram, sources: [] } },
    { contractSourceRelease: null },
  ]) {
    await root.update(patch);
    await reject(Object.keys(patch)[0]);
    await root.set(metadata);
  }
  await page.route('**/api/architect/draft-review', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' })
  );
  await reject('unavailable catalogue');
  await page.unroute('**/api/architect/draft-review');
  for (const mode of ['missing-finance', 'hard-cap', 'room', 'roster']) {
    const ref = root.collection('teams').doc(mode === 'room' ? 'BKN' : 'PHI'),
      prior = (await ref.get()).data()!;
    const changed = structuredClone(prior);
    if (mode === 'missing-finance') delete changed.salaryBookInputs;
    if (mode === 'hard-cap')
      changed.salaryBookInputs.apronAdjustments.lineItems[0].amount += 150000000;
    if (mode === 'room') {
      const row = changed.players[0].contract.salariesByYear.find(
        (s: any) => s.season === '2027-28'
      );
      row.salary += 30000000;
      row.capHit += 30000000;
    }
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
      changed.totals = createCanonicalTeamTotalsSnapshot(changed, 2028, {
        asOfDate: '2028-06-20',
      });
    await ref.set(changed);
    await reject(
      mode,
      mode === 'hard-cap'
        ? /hard cap violation/i
        : mode === 'room'
          ? /room.*exceeds|room.*below/i
          : mode === 'roster'
            ? /two-way.*exceeded|two-way.*cannot exceed/i
            : /needs governed input|2028 is not a supported season/i
    );
    await ref.set(prior);
  }
  for (const target of [
    `entitlements/${ids.PHI}`,
    'teams/PHI',
    'teams/BKN/players/tyrese_maxey',
  ]) {
    expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
    const ref = root.firestore.doc(`${root.path}/${target}`),
      prior = await ref.get();
    await ref.set({
      ...(prior.data() ?? {}),
      ...(target.startsWith('entitlements')
        ? { holderTeam: 'BKN' }
        : { changedAfterValidation: true }),
    });
    const changed = await conditionalStateDigest(worldId);
    const applied = await applyMixedNative(page);
    expect(applied.success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(changed);
    rejected[target] = { applied, unchanged: true };
    if (prior.exists) await ref.set(prior.data()!);
    else await ref.delete();
  }
  expect(await prepare()).toMatchObject({ legal: true });
  const pristine = await conditionalStateDigest(worldId);
  expect((await applyMixedNative(page, 'forged')).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(pristine);
  expect(await prepare()).toMatchObject({ legal: true });
  const applied = await applyMixedNative(page);
  expect(applied, applied.error).toMatchObject({ success: true });
  const committed = await conditionalStateDigest(worldId);
  expect((await applyMixedNative(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(committed);
  rejected.duplicateApply = { unchanged: true };
  const after = (await root.get()).data()!,
    transfer = after.draftNativeTransfers[0];
  const eventRef = root
      .collection('events')
      .doc(`draft_review_${transfer.operationId}`),
    event = (await eventRef.get()).data()!;
  await eventRef.delete();
  await reject('missing committed receipt');
  await eventRef.set(event);
  await root.update({
    draftNativeTransfers: [
      {
        ...transfer,
        playerMovements: transfer.playerMovements.map((p: any) => ({
          ...p,
          contractId: 'forged',
        })),
      },
    ],
  });
  await reject('conflicting committed consideration');
  await root.set(after);
  expect(await prepare('selections-only')).toMatchObject({ legal: true });
  expect(await sources()).toEqual(sourceBefore);
  receipt('negative-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    worldId,
    rejected,
  });
});

test('mixed native Stepien and unresolved claims reject without writes', async ({
  page,
}) => {
  const unready = await startMixedNative(page, 'unresolved', false);
  const unreadyBefore = await conditionalStateDigest(unready.worldId);
  const premature = await prepareMixedNative(
    page,
    unready.uid,
    unready.worldId,
    [unready.ids.PHI, unready.ids.PHX]
  );
  expect(premature).not.toMatchObject({ status: 'prepared', legal: true });
  expect((await applyMixedNative(page)).success).toBe(false);
  expect(await conditionalStateDigest(unready.worldId)).toBe(unreadyBefore);
  const { uid, worldId, ids } = await startMixedNative(
    page,
    'stepien',
    true,
    false
  );
  const before = await conditionalStateDigest(worldId);
  const verdict = await prepareMixedNative(page, uid, worldId, [
    ids.PHI,
    ids.PHX,
  ]);
  expect(verdict).not.toMatchObject({ status: 'prepared', legal: true });
  expect(JSON.stringify(verdict)).toMatch(/Stepien|consecutive|future first/i);
  expect((await applyMixedNative(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(before);
  receipt('stepien-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    worldId,
    verdict,
    premature,
    unchanged: true,
  });
});
test.setTimeout(600000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_OVERLAPPING_POOL,
  'Protected retained catalogue and admitted 2028 terms required.'
);
const proofDir = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/mixed-native';
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
  return (
    await getReviewAdminDb().collection('architect_baseEntitlements').get()
  ).docs.map((d) => ({ id: d.id, data: d.data() }));
}

test('mixed resolved 2028 selection and Contracts: ready, apply, reload and legal selection retrade', async ({
  page,
}) => {
  const { uid, worldId, root, ids, catalogue } = await startMixedNative(
    page,
    'positive'
  );
  const before = await completeConditionalState(worldId),
    sourceBefore = await sources();
  const teamBefore = before.children.find((c) => c.name === 'teams')!.docs;
  const oldEnts = before.children.find((c) => c.name === 'entitlements')!.docs;
  const resolution = (
    await root.collection('events').doc('swapDraft__2028').get()
  ).data();
  expect(oldEnts.find((e) => e.id === ids.PHI)!.data.holderTeam).toBe('PHI');
  const sourceContract = teamBefore
    .find((t) => t.id === 'PHI')!
    .data.players.find(
      (p: any) => p.playerId === NATIVE_MIXED_PLAYER.id
    ).contract;
  // Accepted world Contract normalization omits these legacy display flags.
  // Every other retained field, including identity and all salary, guarantee
  // and option rows, must survive. The source baseline remains exact.
  const contract = Object.fromEntries(
    Object.entries(sourceContract).filter(
      ([key]) =>
        ![
          'estimatedCapPercentage',
          'isMaxContract',
          'maxType',
          'signedByCurrentTeam',
        ].includes(key)
    )
  );
  await capture(page, 'resolved');
  const preview = await prepareMixedNative(page, uid, worldId, [
    ids.PHI,
    ids.PHX,
  ]);
  receipt('initial-preview', preview);
  expect(preview).toMatchObject({ status: 'prepared', legal: true });
  expect(await completeConditionalState(worldId)).toEqual(before);
  for (const stage of ['first', 'return'] as const) {
    const returned = stage === 'return',
      count = returned ? 3 : 2;
    const prior = await conditionalStateDigest(worldId);
    const dialog = await selectMixedNative(
      page,
      worldId,
      [ids.PHI, ids.PHX],
      returned
    );
    if (!returned) {
      const salary = dialog
        .getByTestId('trade-team-card-PHI')
        .getByLabel(/^Tyrese Maxey exact pre-trade Salary$/i);
      await salary.press('ControlOrMeta+A');
      await salary.press('Backspace');
      await salary.fill(String(NATIVE_MIXED_PLAYER.salary + 1));
      await salary.press('Tab');
      await expect(salary).toHaveValue('$43,582,281');
      await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
      await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
        'Trade blocked',
        { timeout: 120000 }
      );
      await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
        /exact governed outgoing Salary/i
      );
      await expect(
        dialog.getByRole('button', { name: /^Apply Trade$/ })
      ).toBeDisabled();
      await capture(page, 'invalid-proposal');
      expect(await conditionalStateDigest(worldId)).toBe(prior);
      await salary.press('ControlOrMeta+A');
      await salary.press('Backspace');
      await salary.fill(String(NATIVE_MIXED_PLAYER.salary));
      await salary.press('Tab');
      await expect(salary).toHaveValue('$43,582,280');
    }
    await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/ })
    ).toBeEnabled({ timeout: 120000 });
    await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
      /Ready with warnings/i
    );
    await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
      /below minimum team salary floor/i
    );
    await capture(page, `${stage}-proposal`);
    expect(await conditionalStateDigest(worldId)).toBe(prior);
    await dialog.getByRole('button', { name: /^Apply Trade$/ }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(count);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    const saved = await completeConditionalState(worldId);
    const teams = saved.children.find((c) => c.name === 'teams')!.docs;
    const ents = saved.children.find((c) => c.name === 'entitlements')!.docs;
    expect(ents.map((e) => e.id)).toEqual(oldEnts.map((e) => e.id));
    expect(ents).toHaveLength(278);
    expect(saved.metadata.draftSimulationUnresolved).toEqual(
      catalogue.data.unresolved
    );
    expect(catalogue.data.unresolved).toHaveLength(29);
    expect(saved.metadata.draftSwapProgram).toEqual(
      before.metadata.draftSwapProgram
    );
    expect(saved.children.find((c) => c.name === 'contractBaselines')).toEqual(
      before.children.find((c) => c.name === 'contractBaselines')
    );
    expect(
      (await root.collection('events').doc('swapDraft__2028').get()).data()
    ).toEqual(resolution);
    for (const row of ents) {
      const old = oldEnts.find((e) => e.id === row.id)!;
      expect({ ...row.data, holderTeam: old.data.holderTeam }).toEqual(
        old.data
      );
      expect(row.data.holderTeam).toBe(
        row.id === ids.PHI
          ? returned
            ? 'PHI'
            : 'BKN'
          : row.id === ids.PHX
            ? returned
              ? 'BKN'
              : 'PHI'
            : old.data.holderTeam
      );
      expect(
        teams
          .filter((t) => t.data.entitlementIds.includes(row.id))
          .map((t) => t.id)
      ).toEqual([row.data.holderTeam]);
    }
    for (const team of teams.filter((t) => !['PHI', 'BKN'].includes(t.id)))
      expect(team).toEqual(teamBefore.find((t) => t.id === team.id));
    const transfer = saved.metadata.draftNativeTransfers.at(-1);
    if (returned) expect(transfer.playerMovements).toBeUndefined();
    else expect(transfer.playerMovements).toHaveLength(1);
    expect(transfer.movements).toHaveLength(2);
    for (const [original, initial] of [
      ['PHI', 'PHI'],
      ['PHX', 'BKN'],
    ])
      expect(transfer.movements).toContainEqual(
        expect.objectContaining({
          entitlementId: ids[original],
          originalTeam: original,
          year: 2028,
          fromTeam: returned ? (initial === 'PHI' ? 'BKN' : 'PHI') : initial,
          toTeam: returned ? initial : initial === 'PHI' ? 'BKN' : 'PHI',
        })
      );
    const event = saved.children
      .find((c) => c.name === 'events')!
      .docs.find((e) => e.id === `draft_review_${transfer.operationId}`)!.data;
    expect(event.valid).toBe(true);
    expect(event.playerIds).toEqual(returned ? [] : [NATIVE_MIXED_PLAYER.id]);
    expect(event.metadata.draftReviewReceipt.playerMovements).toEqual(
      transfer.playerMovements
    );
    expect(event.metadata.draftReviewReceipt.movements).toEqual(
      transfer.movements
    );
    if (!returned) expect(JSON.stringify(event)).toContain('ROOM');
    for (const team of ['PHI', 'BKN'] as const) {
      const p = NATIVE_MIXED_PLAYER,
        ownsPlayer = team === 'BKN';
      const current = teams.find((t) => t.id === team)!.data,
        original = teamBefore.find((t) => t.id === team)!.data;
      const expectedRoster = original.roster
        .filter((id: string) => id !== p.id)
        .concat(ownsPlayer ? [p.id] : []);
      expect([...current.roster].sort()).toEqual([...expectedRoster].sort());
      const player = current.players.find((v: any) => v.playerId === p.id);
      if (ownsPlayer) expect(player.contract).toMatchObject(contract);
      else expect(player).toBeUndefined();
      const money = 112000000 + (ownsPlayer ? p.salary : 0);
      expect(current.totals.teamSalary).toBe(money);
      expect(current.totals.apronTeamSalary).toBe(money);
      expect(current.totals.taxSalary).toBe(original.totals.taxSalary);
      const overrides = saved.players.find((v) => v.team === team)!.docs;
      if (ownsPlayer)
        expect(overrides.find((v) => v.id === p.id)!.data.contract).toEqual(
          player.contract
        );
      else expect(overrides.some((v) => v.id === p.id)).toBe(false);
      await page.goto(`/gm/${team}?season=2028`);
      await page.reload();
      await openDashboardTab(page, 'Roster');
      const visiblePlayer = page.getByAltText(new RegExp(`^${p.name}$`, 'i'));
      if (ownsPlayer) await expect(visiblePlayer.first()).toBeVisible();
      else await expect(visiblePlayer).toHaveCount(0);
      await capture(page, `${stage}-${team}-roster`);
      await openDashboardTab(page, 'Full Cap Table');
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
      const capPlayer = page.getByRole('button', {
        name: new RegExp(`^${p.name}$`, 'i'),
      });
      if (ownsPlayer) await expect(capPlayer.first()).toBeVisible();
      else await expect(capPlayer).toHaveCount(0);
      expect(
        Number(
          (
            await page
              .locator(
                '[data-testid="cap-sheet-full-total-cell"][data-salary-cap-year="2028"]'
              )
              .innerText()
          ).replace(/[^0-9.-]/g, '')
        )
      ).toBe(current.totals.teamSalary);
      await capture(page, `${stage}-${team}-cap`);
      await openDashboardTab(page, 'Team History');
      const timeline = page.getByTestId('team-history-section-timeline');
      await expect(
        timeline.getByRole('button', { name: /^Trade Executed:/ })
      ).toHaveCount(count - 1);
      await timeline
        .getByRole('button', { name: /^Trade Executed:/ })
        .last()
        .click();
      const detail = page.getByTestId('team-history-detail-modal');
      await expect(detail).toContainText(/Tyrese Maxey/i);
      await expect(detail).toContainText('2028 first-round pick');
      await expect(detail).toContainText('Trade Receipt');
      await capture(page, `${stage}-${team}-history`);
      await detail.getByRole('button', { name: /close/i }).click();
      await openDashboardTab(page, 'Compare');
      await expect(page.getByTestId('comparison-event-count')).toContainText(
        new RegExp(`${count}\\s+saved move`)
      );
      const comparisonBooks = page.getByTestId('comparison-cap-delta');
      for (const label of ['Team Salary', 'Apron Team Salary'])
        await expect(
          comparisonBooks
            .locator('dt', { hasText: new RegExp(`^${label}$`) })
            .locator('xpath=following-sibling::dd[1]')
        ).toHaveText(team === 'PHI' ? '−$43.6M' : '+$43.6M');
      await expect(
        comparisonBooks
          .locator('dt', { hasText: /^Tax Salary$/ })
          .locator('xpath=following-sibling::dd[1]')
      ).toHaveText('+$0.0M');
      await expect(
        page.getByTestId(
          ownsPlayer
            ? 'comparison-roster-additions'
            : 'comparison-roster-removals'
        )
      ).toContainText(new RegExp(p.name, 'i'));
      if (!returned || team === 'PHI')
        await expect(
          page.getByText(
            `PHI 2028 first: final pick 5 · held by ${returned ? 'PHI' : 'BKN'}`,
            { exact: true }
          )
        ).toBeVisible();
      await capture(page, `${stage}-${team}-compare`);
      const expand = page.getByRole('button', { name: 'Expand activity rail' });
      if (await expand.isVisible()) await expand.click();
      await expect(
        page.getByTestId('cockpit-activity-rail-identity')
      ).toContainText('Players and Resolved 2028 Selection');
      await expect(
        page.getByTestId('cockpit-activity-rail-save-indicator')
      ).toHaveAttribute('data-save-status', 'saved');
      await expect(
        page.getByTestId('cockpit-activity-rail-strip-roster')
      ).toContainText(`${ownsPlayer ? 15 : 14} / 15`);
      await expect(
        page.getByTestId('cockpit-activity-rail-strip-two-way')
      ).toContainText('3 / 3');
      await capture(page, `${stage}-${team}-plan`);
      await page.getByTestId('cockpit-activity-rail-assets-open').click();
      if ((returned && team === 'PHI') || (!returned && team === 'BKN'))
        await expect(
          page.getByTestId('cockpit-assets-panel-picks-2028-first')
        ).toContainText('Final pick 5');
      else
        await expect(
          page.getByTestId('cockpit-assets-panel-picks-2028-first')
        ).not.toContainText('Final pick 5');
      await capture(page, `${stage}-${team}-assets`);
      await page.keyboard.press('Escape');
    }
    expect(await completeConditionalState(worldId)).toEqual(saved);
    receipt(`${stage}-saved`, saved);
  }
  expect(await sources()).toEqual(sourceBefore);
  receipt('proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    scope: 'governed-simulation-only',
    packageSha256: createHash('sha256')
      .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
      .digest('hex'),
    nativeTermsSha256: createHash('sha256')
      .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_OVERLAPPING_POOL!))
      .digest('hex'),
    worldId,
    trades: 2,
    teams: ['PHI', 'BKN'],
    views: 24,
    preservedIdentities: 278,
    unresolved: 29,
  });
});
