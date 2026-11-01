import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  getContractYearSlice,
  isTwoWayContract,
} from '@/features/architect/utils/contractUtils';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  seedMixedDraftTradeWorld,
  MIXED_PLAYERS,
} from './fixtures/mixedDraftTradeWorld';
import {
  readReviewUserId,
  getReviewAdminDb,
  getWorldTeamDocument,
  getWorldEventDocuments,
  openDashboardTab,
} from './helpers/architectReviewWorld';

test.use({
  actionTimeout: 15000,
  viewport: { width: 1280, height: 720 },
  trace: 'on',
});
test.setTimeout(220000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE ||
    !process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE,
  'Requires the opted-in protected simulation, private catalogue and source baseline.'
);
const chi = 'ent:CHI:2028:1:own:2afbfb42';
const tor = '';
const proofDir = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/mixed-trades';
async function state(id: string) {
  const ref = getReviewAdminDb().doc(`architect_worlds/${id}`);
  return {
    metadata: (await ref.get()).data(),
    playerDocuments: await Promise.all(
      ['CHI', 'ORL'].map(async (team) => ({
        team,
        docs: (
          await ref.collection('teams').doc(team).collection('players').get()
        ).docs.map((d) => ({ id: d.id, data: d.data() })),
      }))
    ),
    children: await Promise.all(
      ['teams', 'entitlements', 'events'].map(async (name) => ({
        name,
        docs: (await ref.collection(name).get()).docs.map((d) => ({
          id: d.id,
          data: d.data(),
        })),
      }))
    ),
  };
}
async function baselineDigest(id: string) {
  const docs = (
    await getReviewAdminDb()
      .collection(`architect_worlds/${id}/contractBaselines`)
      .get()
  ).docs.map((d) => ({ id: d.id, data: d.data() }));
  return createHash('sha256').update(JSON.stringify(docs)).digest('hex');
}
async function login(page: Page) {
  await page.goto('/gm/CHI?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  return readReviewUserId(page);
}
async function pick(
  page: Page,
  card: Locator,
  year: number,
  destination: string
) {
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  const row = card
    .getByText(`${year} - Round 1`, { exact: true })
    .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]');
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', { name: new RegExp(`^Trade to ${destination}$`, 'i') })
    .click();
}
async function capture(page: Page, name: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${name}-1280x720.png`) });
}
async function prepare(
  page: Page,
  uid: string,
  worldId: string,
  ids = [chi, tor],
  options: { mixed?: boolean; mode?: string } = {}
) {
  const stepien = (
    await getReviewAdminDb()
      .collection(`architect_worlds/${worldId}/entitlements`)
      .where('holderTeam', '==', 'CHI')
      .get()
  ).docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .find((d: any) => d.underlyingPickId === 'CHI_2027_1st');
  const playerDocs = await Promise.all(
    ['CHI', 'ORL'].map(
      async (team) =>
        (await getWorldTeamDocument(worldId, team))?.players as Record<
          string,
          any
        >[]
    )
  );
  const totals = await Promise.all(
    ['CHI', 'ORL'].map(
      async (team) =>
        (await getWorldTeamDocument(worldId, team))?.totals?.apronTeamSalary
    )
  );
  const players = playerDocs.map((ps, i) =>
    ps.find((p) => p.playerId === (i ? MIXED_PLAYERS.ORL : MIXED_PLAYERS.CHI))
  );
  const docs = await Promise.all(
    ids.map(async (id) =>
      id
        ? (
            await getReviewAdminDb()
              .doc(`architect_worlds/${worldId}/entitlements/${id}`)
              .get()
          ).data()
        : null
    )
  );
  return page.evaluate(
    async ({ uid, worldId, ids, docs, players, totals, options, stepien }) => {
      const path =
        '/src/features/architect/utils/draftReview/simulationPreview.ts';
      const { previewRetainedDraftSimulation } = await import(path);
      const termsPath =
        '/src/features/architect/utils/entitlements/entitlementTerms.ts';
      const { decorateEntitlementForTrade } = await import(termsPath);
      const teams = await Promise.all(
        ['CHI', 'ORL'].map(async (teamCode, i) => {
          const outgoing = ids[i]
            ? [
                {
                  ...decorateEntitlementForTrade(docs[i]),
                  entitlementId: ids[i],
                  id: ids[i],
                  toTeamId: i ? 'CHI' : 'ORL',
                },
              ]
            : [];
          return {
            teamCode,
            sends:
              options.mixed === false
                ? []
                : [
                    {
                      playerId: players[i].playerId,
                      id: players[i].playerId,
                      tradeTo: i ? 'CHI' : 'ORL',
                      receivingTeamId: i ? 'CHI' : 'ORL',
                    },
                  ],
            picksOut: [],
            outgoingEntitlements: outgoing,
            entitlementsOut: outgoing,
            salaryMatchingElection:
              options.mixed === false
                ? null
                : {
                    version: 1,
                    path: 'STANDARD_TPE',
                    postAssignmentApronTeamSalary:
                      totals[i] + (i ? 29720 : -29720),
                    tradedPlayerPreTradeSalaries: {
                      [players[i].playerId]: i ? 7970280 : 8000000,
                    },
                  },
            cashSent: 0,
            cashToTeamId: null,
          };
        })
      );
      const args = {
        userId: uid,
        worldId,
        mutationType: 'executeTrade',
        seasonId: '2025-26',
        operationId: `simulation_${crypto.randomUUID()}`,
        payload: {
          teams,
          asOfDate: '2026-06-05',
          tradeCtx: {
            source: 'tradeMachine',
            worldId,
            yearKey: 2026,
            asOfDate: '2026-06-05',
          },
        },
      };
      const mode = options.mode;
      if (mode === 'incomplete')
        args.payload.teams[0].salaryMatchingElection = null;
      if (mode === 'inflated')
        args.payload.teams[0].salaryMatchingElection.tradedPlayerPreTradeSalaries.tre_jones = 100000000;
      if (mode === 'cash') args.payload.teams[0].cashSent = 1;
      if (mode === 'override')
        args.payload.capProjections = { '2025-26': { salaryCap: 999999999 } };
      if (mode === 'incoming')
        args.payload.teams[1].receives = [{ id: 'ghost', contract: {} }];
      if (mode === 'stepien') {
        const additional = {
          ...decorateEntitlementForTrade(stepien),
          id: stepien.id,
          entitlementId: stepien.id,
          toTeamId: 'ORL',
        };
        args.payload.teams[0].entitlementsOut.push(additional);
      }
      if (mode === 'salary') {
        args.payload.teams[0].sends = [
          {
            playerId: 'josh_giddey',
            id: 'josh_giddey',
            tradeTo: 'ORL',
            receivingTeamId: 'ORL',
          },
        ];
        args.payload.teams[0].salaryMatchingElection.tradedPlayerPreTradeSalaries =
          { josh_giddey: 25000000 };
        args.payload.teams[0].salaryMatchingElection.postAssignmentApronTeamSalary =
          totals[0] - 17029720;
        args.payload.teams[1].salaryMatchingElection.postAssignmentApronTeamSalary =
          totals[1] + 17029720;
      }
      let result;
      try {
        result = await previewRetainedDraftSimulation(args);
      } catch (error) {
        result = {
          status: 'error',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      Reflect.set(window, '__retainedSimulation', { args, result });
      return result.status === 'prepared'
        ? {
            status: result.status,
            legal: result.preview.legal,
            reason: result.preview.reason,
            details: result.details,
          }
        : result;
    },
    { uid, worldId, ids, docs, players, totals, options, stepien }
  );
}
async function apply(
  page: Page,
  mode: 'valid' | 'forged' | 'changed' = 'valid'
) {
  return page.evaluate(async (mode) => {
    const path = '/src/features/architect/utils/mutationPipeline.ts';
    const { applyWorldMutation } = await import(path);
    const { args, result } = Reflect.get(window, '__retainedSimulation');
    return applyWorldMutation({
      ...args,
      ...(mode === 'changed'
        ? { payload: { ...args.payload, asOfDate: '2026-06-06' } }
        : {}),
      draftReviewAuthority:
        mode === 'forged' ? { ...result.authority } : result.authority,
    });
  }, mode);
}

test('mixed ordinary players and originals use actual Trade Machine', async ({
  page,
}) => {
  const uid = await login(page);
  const worldId = `world_mixed_${uid}_${Date.now()}`;
  const catalogue = await seedMixedDraftTradeWorld(uid, worldId);
  const before = await state(worldId);
  const baselineBefore = await baselineDigest(worldId);
  const sourceBefore = (
    await getReviewAdminDb().collection('architect_baseEntitlements').get()
  ).docs.map((d) => ({ id: d.id, data: d.data() }));
  const preview = await prepare(page, uid, worldId);
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, 'diagnostic-preview.json'),
    JSON.stringify(preview, null, 2)
  );
  expect(preview).toMatchObject({ status: 'prepared', legal: true });
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2026');
    },
    { uid, worldId }
  );
  await page.reload();
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 30000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('magic');
  for (const [code, name, destination] of [
    ['CHI', 'Tre Jones', 'Orlando Magic'],
    ['ORL', 'Anthony Black', 'Chicago Bulls'],
  ]) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    const row = card
      .getByAltText(new RegExp(`^${name}$`, 'i'))
      .or(card.getByText(name, { exact: true }))
      .first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]');
    if (!(await row.getByRole('button', { name: '•••' }).isVisible()))
      await card
        .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
        .click();
    await row.getByRole('button', { name: '•••' }).click();
    await page
      .getByRole('button', {
        name: new RegExp(`^Trade to ${destination}$`, 'i'),
      })
      .click();
  }
  await pick(
    page,
    dialog.getByTestId('trade-team-card-CHI'),
    2028,
    'Orlando Magic'
  );
  for (const [i, code] of ['CHI', 'ORL'].entries()) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption('STANDARD_TPE');
    const total = (await getWorldTeamDocument(worldId, code))!.totals as any;
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(total.apronTeamSalary + (i ? 29720 : -29720)));
    await card
      .getByLabel(
        new RegExp(
          `^${i ? 'Anthony Black' : 'Tre Jones'} exact pre-trade Salary$`,
          'i'
        )
      )
      .fill(String(i ? 7970280 : 8000000));
  }
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 30000 });
  await capture(page, 'permitted-proposal');
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 30000,
    })
    .toBe(1);
  const after = await state(worldId);
  const events = await getWorldEventDocuments(worldId);
  const eventText = JSON.stringify(events[0]);
  for (const identity of [
    'tre_jones',
    'anthony_black',
    chi,
    'STANDARD_TPE',
    'governed-simulation-only',
  ])
    expect(eventText).toContain(identity);
  const initialTeams = before.children.find((c) => c.name === 'teams')!.docs;
  const teams = after.children.find((c) => c.name === 'teams')!.docs;
  for (const [i, team] of ['CHI', 'ORL'].entries()) {
    const old = initialTeams.find((t) => t.id === team)!.data;
    const saved = teams.find((t) => t.id === team)!.data;
    const incoming = i ? MIXED_PLAYERS.CHI : MIXED_PLAYERS.ORL;
    const outgoing = i ? MIXED_PLAYERS.ORL : MIXED_PLAYERS.CHI;
    expect([...saved.roster].sort()).toEqual(
      old.roster
        .filter((id: string) => id !== outgoing)
        .concat(incoming)
        .sort()
    );
    expect(saved.players.map((p: any) => p.playerId)).toContain(incoming);
    expect(saved.players.map((p: any) => p.playerId)).not.toContain(outgoing);
    expect(saved.totals.teamSalary).toBe(
      old.totals.teamSalary + (i ? 29720 : -29720)
    );
    expect(saved.totals.apronTeamSalary).toBe(
      old.totals.apronTeamSalary + (i ? 29720 : -29720)
    );
    expect(saved.totals.taxSalary).toBe(old.totals.taxSalary); // Separate dated Tax Salary determination.
    expect(saved.hardCapped).toBe(true);
    const overrides = after.playerDocuments.find((p) => p.team === team)!.docs;
    expect(overrides.map((p) => p.id)).toContain(incoming);
    expect(overrides.map((p) => p.id)).not.toContain(outgoing);
    const moved = overrides.find((p) => p.id === incoming)!.data;
    expect(moved.teamCode).toBe(team);
    expect(
      moved.contract.salariesByYear.find((r: any) => r.season === '2025-26')
        .salary
    ).toBe(i ? 8000000 : 7970280);
  }
  const entitlements = after.children.find(
    (c) => c.name === 'entitlements'
  )!.docs;
  expect(entitlements).toHaveLength(278);
  expect(entitlements.map((e) => e.id)).toEqual(
    before.children
      .find((c) => c.name === 'entitlements')!
      .docs.map((e) => e.id)
  );
  expect(entitlements.find((e) => e.id === chi)!.data.holderTeam).toBe('ORL');
  expect(after.metadata!.draftSimulationUnresolved).toEqual(
    catalogue.data.unresolved
  );
  expect(catalogue.data.unresolved).toHaveLength(29);
  expect(await baselineDigest(worldId)).toBe(baselineBefore);
  for (const [i, team] of ['CHI', 'ORL'].entries()) {
    await page.goto(`/gm/${team}?season=2026`);
    await page.reload();
    const name = i ? 'Tre Jones' : 'Anthony Black';
    await openDashboardTab(page, 'Roster');
    const rosterPlayer = page
      .getByAltText(new RegExp(`^${name}$`, 'i'))
      .first();
    await expect(rosterPlayer).toBeVisible();
    await rosterPlayer.scrollIntoViewIfNeeded();
    await capture(page, `${team}-roster`);
    await openDashboardTab(page, 'Full Cap Table');
    const saved = teams.find((t) => t.id === team)!.data;
    for (const [attr, key] of [
      ['data-team-salary', 'teamSalary'],
      ['data-apron-team-salary', 'apronTeamSalary'],
      ['data-tax-salary', 'taxSalary'],
    ]) {
      await expect
        .poll(() =>
          page
            .locator(`[${attr}]`)
            .evaluateAll(
              (els, attr) => els.map((el) => Number(el.getAttribute(attr))),
              attr
            )
        )
        .toContain(saved.totals[key]);
    }
    await expect(
      page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first()
    ).toBeVisible();
    const totalCell = page.locator(
      '[data-testid="cap-sheet-full-total-cell"][data-salary-cap-year="2026"]'
    );
    expect(Number((await totalCell.innerText()).replace(/[^0-9.-]/g, ''))).toBe(
      saved.totals.teamSalary
    );
    await capture(page, `${team}-cap`);
    await openDashboardTab(page, 'Team History');
    await page
      .getByTestId('team-history-section-timeline')
      .getByRole('button', { name: /Trade Executed:/ })
      .click();
    const detail = page.getByTestId('team-history-detail-modal');
    await expect(detail).toContainText(/Tre Jones/i);
    await expect(detail).toContainText(/Anthony Black/i);
    await expect(detail).toContainText('2028 first-round pick');
    await capture(page, `${team}-history`);
    await detail.getByRole('button', { name: /close/i }).click();
    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /1\s+saved move/i
    );
    await expect(
      page.getByText('CHI 2028 first-round pick', { exact: true })
    ).toBeVisible();
    await expect(page.getByTestId('comparison-changed-players')).toContainText(
      /2\s+players? changed/i
    );
    await expect(page.getByTestId('comparison-roster-additions')).toContainText(
      new RegExp(name, 'i')
    );
    await expect(page.getByTestId('comparison-roster-removals')).toContainText(
      new RegExp(i ? 'Anthony Black' : 'Tre Jones', 'i')
    );
    await capture(page, `${team}-compare`);
    const expand = page.getByRole('button', { name: 'Expand activity rail' });
    if (await expand.isVisible()) await expand.click();
    await expect(page.getByTestId('cockpit-activity-rail')).toContainText(
      'Team Plan'
    );
    await expect(
      page.getByTestId('cockpit-activity-rail-identity')
    ).toContainText('Players and Original Firsts');
    await expect(
      page.getByTestId('cockpit-activity-rail-save-indicator')
    ).toHaveAttribute('data-save-status', 'saved');
    const seasonPlayers = saved.players.filter((p: any) =>
      getContractYearSlice(p, 2026)
    );
    const twoWays = seasonPlayers.filter((p: any) =>
      isTwoWayContract(p)
    ).length;
    await expect(
      page.getByTestId('cockpit-activity-rail-strip-roster')
    ).toContainText(`${seasonPlayers.length - twoWays} / 15`);
    await expect(
      page.getByTestId('cockpit-activity-rail-strip-two-way')
    ).toContainText(`${twoWays} / 3`);
    const firstCount = entitlements.filter(
      (e) =>
        e.data.holderTeam === team &&
        e.data.kind === 'pick_ownership' &&
        catalogue.data.records.find((r) => r.entitlementId === e.id)
          ?.originalPick
    ).length;
    await expect(
      page.getByTestId('cockpit-activity-rail-strip-picks')
    ).toContainText(`${firstCount} · 0`);
    await capture(page, `${team}-plan`);
    await page.getByTestId('cockpit-activity-rail-assets-open').click();
    const firsts = page.getByTestId('cockpit-assets-panel-picks-2028-first');
    if (i) await expect(firsts).toContainText('via CHI');
    else await expect(firsts).toHaveCount(0);
    await capture(page, `${team}-assets`);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
    const card = page
      .getByRole('dialog', { name: /Trade Machine/i })
      .getByTestId(`trade-team-card-${team}`);
    await card
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await expect(card.locator(`[data-entitlement-id="${chi}"]`)).toHaveCount(
      i ? 1 : 0
    );
  }
  expect(await state(worldId)).toEqual(after);
  expect(
    (
      await getReviewAdminDb().collection('architect_baseEntitlements').get()
    ).docs.map((d) => ({ id: d.id, data: d.data() }))
  ).toEqual(sourceBefore);
  fs.writeFileSync(
    path.join(proofDir, 'diagnostic-state.json'),
    JSON.stringify(after, null, 2)
  );
  // The next transaction consumes the new pick holder, with the moved players retained.
  const returnPreview = await prepare(
    page,
    uid,
    worldId,
    ['ent:CHI:2030:1:own:382a238d', chi],
    { mixed: false }
  );
  expect(returnPreview).toMatchObject({ status: 'prepared', legal: true });
  expect(await apply(page)).toMatchObject({ success: true });
  const repeated = await state(worldId);
  expect(await getWorldEventDocuments(worldId)).toHaveLength(2);
  expect(
    repeated.children
      .find((c) => c.name === 'entitlements')!
      .docs.find((e) => e.id === chi)!.data.holderTeam
  ).toBe('CHI');
  expect(repeated.playerDocuments).toEqual(after.playerDocuments);
  for (const code of ['CHI', 'ORL']) {
    const saved = repeated.children
      .find((c) => c.name === 'teams')!
      .docs.find((t) => t.id === code)!.data;
    const previous = teams.find((t) => t.id === code)!.data;
    expect(saved.roster).toEqual(previous.roster);
    expect(saved.totals).toEqual(previous.totals);
  }
  expect((await apply(page)).success).toBe(false);
  expect(await state(worldId)).toEqual(repeated);
  for (const [i, code] of ['CHI', 'ORL'].entries()) {
    await page.goto(`/gm/${code}?season=2026`);
    await page.reload();
    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /2\s+saved moves/i
    );
    if (!i) await capture(page, 'repeat-trade');
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
    const card = page
      .getByRole('dialog', { name: /Trade Machine/i })
      .getByTestId(`trade-team-card-${code}`);
    await card
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await expect(card.locator(`[data-entitlement-id="${chi}"]`)).toHaveCount(
      i ? 0 : 1
    );
    await expect(
      card.locator('[data-entitlement-id="ent:CHI:2030:1:own:382a238d"]')
    ).toHaveCount(i ? 1 : 0);
  }
  fs.writeFileSync(
    path.join(proofDir, 'proof.json'),
    JSON.stringify(
      {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        scope: 'governed-simulation-only',
        packageSha256: createHash('sha256')
          .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
          .digest('hex'),
        catalogue: 278,
        unresolved: 29,
        bothTeams: true,
        reload: true,
        events: await getWorldEventDocuments(worldId),
      },
      null,
      2
    )
  );
});

test('mixed trade illegal, incomplete, stale, forged and duplicate operations write nothing', async ({
  page,
}) => {
  const uid = await login(page);
  const worldId = `world_mixed_negative_${uid}_${Date.now()}`;
  await seedMixedDraftTradeWorld(uid, worldId);
  const before = await state(worldId);
  const baselineBefore = await baselineDigest(worldId);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const results: Record<string, unknown> = {};
  for (const mode of [
    'incomplete',
    'inflated',
    'cash',
    'override',
    'incoming',
    'salary',
    'stepien',
  ]) {
    const preview = await prepare(page, uid, worldId, undefined, { mode });
    expect(
      preview.status === 'error' ||
        preview.status === 'blocked' ||
        preview.legal === false
    ).toBe(true);
    if (mode === 'salary')
      expect(preview.details.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'salaryMatching' }),
        ])
      );
    if (mode === 'stepien')
      expect(JSON.stringify(preview)).toMatch(/stepien|consecutive/i);
    const result = await apply(page);
    expect(result.success).toBe(false);
    expect(await state(worldId)).toEqual(before);
    results[mode] = { preview, result };
  }
  // Capability and payload cannot be forged after a legal validation.
  expect(await prepare(page, uid, worldId)).toMatchObject({ legal: true });
  for (const mode of ['forged', 'changed'] as const) {
    expect((await apply(page, mode)).success).toBe(false);
    expect(await state(worldId)).toEqual(before);
  }
  // Stale source and absent destination paths are both fenced at commit.
  for (const path of ['teams/CHI', 'teams/ORL/players/tre_jones']) {
    expect(await prepare(page, uid, worldId)).toMatchObject({ legal: true });
    const target = getReviewAdminDb().doc(
      `architect_worlds/${worldId}/${path}`
    );
    const original = await target.get();
    await target.set({
      ...(original.data() ?? {}),
      mixedTradeRace: 'changed-after-validation',
    });
    const changed = await state(worldId);
    expect((await apply(page)).success).toBe(false);
    expect(await state(worldId)).toEqual(changed);
    if (original.exists) await target.set(original.data()!);
    else await target.delete();
    results[path] = 'stale-no-write';
  }
  // Governed financial absence and apron overflow keep the complete atomic trade closed.
  for (const mode of ['missing-finance', 'hard-cap', 'roster']) {
    const ref = root.collection('teams').doc('ORL');
    const original = (await ref.get()).data()!;
    const changed = structuredClone(original);
    if (mode === 'missing-finance') delete changed.salaryBookInputs;
    else if (mode === 'hard-cap')
      changed.salaryBookInputs.apronAdjustments.lineItems[0].amount += 50_000_000;
    else {
      // Deliberately corrupt only this negative world to exceed the enforced two-way limit.
      const twoWay = changed.players.find(
        (p: any) =>
          p.contract?.isTwoWay ||
          /two.?way/i.test(p.contract?.contractType ?? '')
      );
      expect(twoWay).toBeDefined();
      for (let n = 0; n < 4; n++) {
        const id = `negative_two_way_${n}`;
        changed.players.push({ ...twoWay, id, playerId: id, player_id: id });
        changed.roster.push(id);
      }
    }
    if (mode !== 'missing-finance')
      changed.totals = createCanonicalTeamTotalsSnapshot(changed, 2026, {
        asOfDate: '2026-06-05',
      });
    await ref.set(changed);
    const noWriteBaseline = await state(worldId);
    const preview = await prepare(page, uid, worldId);
    expect(preview.status === 'error' || preview.legal === false).toBe(true);
    expect(JSON.stringify(preview)).toMatch(
      mode === 'hard-cap'
        ? /hard cap violation/i
        : mode === 'roster'
          ? /two-way.*exceeded|two-way.*cannot exceed/i
          : /needs governed input/i
    );
    expect((await apply(page)).success).toBe(false);
    expect(await state(worldId)).toEqual(noWriteBaseline);
    await ref.set(original);
    results[mode] = preview;
  }
  fs.mkdirSync(proofDir, { recursive: true });
  expect(await baselineDigest(worldId)).toBe(baselineBefore);
  fs.writeFileSync(
    path.join(proofDir, 'negative-proof.json'),
    JSON.stringify(
      {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        results,
        noWrites: true,
      },
      null,
      2
    )
  );
});
