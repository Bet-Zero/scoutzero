import { expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { seedMixedDraftTradeWorld } from '../fixtures/mixedDraftTradeWorld';
import {
  getReviewAdminDb,
  getWorldTeamDocument,
  getWorldEventDocuments,
  readReviewUserId,
  openDashboardTab,
} from './architectReviewWorld';
import { isTwoWayTradePlayer } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

const pickId = 'ent:CHI:2028:1:own:2afbfb42';
const twoWayId = 'alex_morales';
const codes = ['CHI', 'ORL'];
async function snapshot(worldId: string) {
  const world = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const children = await Promise.all(
    ['teams', 'entitlements', 'events', 'contractBaselines'].map(
      async (name) => ({
        name,
        docs: (await world.collection(name).get()).docs.map((d) => ({
          id: d.id,
          data: d.data(),
        })),
      })
    )
  );
  const players = await Promise.all(
    codes.map(async (team) => ({
      team,
      docs: (
        await world.collection('teams').doc(team).collection('players').get()
      ).docs.map((d) => ({ id: d.id, data: d.data() })),
    }))
  );
  return { metadata: (await world.get()).data(), children, players };
}

async function prepare(
  page: Page,
  uid: string,
  worldId: string,
  mode = 'mixed'
) {
  const teams = await Promise.all(
    codes.map((code) => getWorldTeamDocument(worldId, code))
  );
  const entitlement = (
    await getReviewAdminDb()
      .doc(`architect_worlds/${worldId}/entitlements/${pickId}`)
      .get()
  ).data();
  return page.evaluate(
    async ({
      uid,
      worldId,
      mode,
      teams,
      entitlement,
      pickId,
      twoWayId,
      codes,
    }) => {
      const { previewRetainedDraftSimulation } = await import(
        '/src/features/architect/utils/draftReview/simulationPreview.ts'
      );
      const { decorateEntitlementForTrade } = await import(
        '/src/features/architect/utils/entitlements/entitlementTerms.ts'
      );
      const onlyTwoWay = mode === 'return';
      const slots = codes.map((teamCode, i) => {
        const outgoing = (onlyTwoWay ? i === 1 : i === 0)
          ? [
              {
                ...decorateEntitlementForTrade(entitlement),
                id: pickId,
                entitlementId: pickId,
                toTeamId: i ? 'CHI' : 'ORL',
              },
            ]
          : [];
        const ids = onlyTwoWay
          ? i
            ? []
            : [twoWayId]
          : i
            ? mode === 'standard-only'
              ? ['anthony_black']
              : [
                  'anthony_black',
                  mode === 'expired' ? 'colin_castleton' : twoWayId,
                ]
            : ['tre_jones'];
        return {
          teamCode,
          picksOut: [],
          entitlementsOut: outgoing,
          outgoingEntitlements: outgoing,
          sends: ids.map((id) => ({
            playerId: id,
            id,
            tradeTo: i ? 'CHI' : 'ORL',
            receivingTeamId: i ? 'CHI' : 'ORL',
            ...(mode === 'forged-type' && id === 'tre_jones'
              ? { isTwoWay: true }
              : {}),
            ...(mode === 'tpe' && id === twoWayId
              ? { absorptionMode: 'TPE', tpeId: 'fake-exception' }
              : {}),
          })),
          salaryMatchingElection: onlyTwoWay
            ? null
            : {
                version: 1,
                path: 'STANDARD_TPE',
                postAssignmentApronTeamSalary:
                  teams[i].totals.apronTeamSalary + (i ? 29720 : -29720),
                tradedPlayerPreTradeSalaries: i
                  ? { anthony_black: 7970280 }
                  : { tre_jones: 8000000 },
              },
          cashSent: 0,
          cashToTeamId: null,
        };
      });
      const args = {
        userId: uid,
        worldId,
        mutationType: 'executeTrade',
        seasonId: '2025-26',
        operationId: `two_way_${crypto.randomUUID()}`,
        payload: {
          teams: slots,
          asOfDate: '2026-06-05',
          tradeCtx: {
            source: 'tradeMachine',
            worldId,
            yearKey: 2026,
            asOfDate: '2026-06-05',
          },
        },
      };
      const result = await previewRetainedDraftSimulation(args).catch(
        (error) => ({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      );
      Reflect.set(window, '__twoWayMixed', { args, result });
      return result.status === 'prepared'
        ? {
            status: result.status,
            legal: result.preview.legal,
            details: result.details,
          }
        : result;
    },
    { uid, worldId, mode, teams, entitlement, pickId, twoWayId, codes }
  );
}
async function apply(page: Page) {
  return page.evaluate(async () => {
    const { applyWorldMutation } = await import(
      '/src/features/architect/utils/mutationPipeline.ts'
    );
    const { args, result } = Reflect.get(window, '__twoWayMixed');
    return applyWorldMutation({
      ...args,
      draftReviewAuthority: result.authority,
    });
  });
}

export async function twoWayMixedJourney(page: Page, proofDir: string) {
  fs.mkdirSync(proofDir, { recursive: true, mode: 0o700 });
  const capture = (name: string) =>
    page.screenshot({
      path: path.join(proofDir, `two-way-${name}-1280x720.png`),
    });
  await page.goto('/gm/CHI?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  const worldId = `world_two_way_${Date.now()}`;
  const catalogue = await seedMixedDraftTradeWorld(uid, worldId);
  // Explicit software premise, not a factual claim about either player's career.
  const world = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const history = {
    version: 1,
    scope: 'governed-simulation-only',
    worldId,
    salaryCapYear: 2026,
    coverage: 'complete-before-current-salary-cap-year',
    records: codes.map((teamId) => ({
      playerId: twoWayId,
      teamId,
      priorSalaryCapYears: [2025],
    })),
  };
  await world.update({ draftSimulationTwoWayHistory: history });
  const sourceBefore = (
    await getReviewAdminDb().collection('architect_baseEntitlements').get()
  ).docs.map((d) => ({ id: d.id, data: d.data() }));
  const full = (await getWorldTeamDocument(worldId, 'CHI'))!;
  const outgoingTwoWays = full.players.filter(isTwoWayTradePlayer);
  expect(outgoingTwoWays).toHaveLength(3);
  // Explicit software roster premise: one vacant slot. Retained Contracts are unchanged.
  const omitted = outgoingTwoWays.at(-1).playerId;
  const vacant = {
    ...full,
    players: full.players.filter(
      (p: { playerId?: string }) => p.playerId !== omitted
    ),
    roster: full.roster.filter((id: string) => id !== omitted),
  };
  vacant.totals = createCanonicalTeamTotalsSnapshot(vacant, 2026, {
    asOfDate: '2026-06-05',
  });
  const chiRef = getReviewAdminDb().doc(
    `architect_worlds/${worldId}/teams/CHI`
  );
  const failures: Record<string, unknown> = {};
  // List room must exist at the trade itself; a planned later waiver is no cure.
  for (const mode of [
    'full-roster',
    'expired',
    'forged-type',
    'tpe',
    'missing-history',
    'fourth-year',
  ]) {
    await chiRef.set(mode === 'full-roster' ? full : vacant);
    const changedHistory = structuredClone(history);
    if (mode === 'fourth-year')
      changedHistory.records[0].priorSalaryCapYears = [2024, 2025];
    await world.update({
      draftSimulationTwoWayHistory:
        mode === 'missing-history' ? null : changedHistory,
    });
    const before = await snapshot(worldId);
    const result = await prepare(page, uid, worldId, mode);
    failures[mode] = result;
    expect(result.status !== 'prepared' || !result.legal).toBe(true);
    expect(JSON.stringify(result)).toMatch(
      mode === 'full-roster'
        ? /two-way.*exceeded/i
        : mode === 'expired'
          ? /expiring.*cannot be assigned/i
          : mode === 'tpe'
            ? /cannot use a trade exception/i
            : mode === 'missing-history' || mode === 'fourth-year'
              ? /CBA2-C20.16/
              : /unchanged governed Contracts/i
    );
    expect((await apply(page)).success).toBe(false);
    expect(await snapshot(worldId)).toEqual(before);
  }
  console.info(
    'Two-Way proof: roster, expiry, forged type and TPE rejections preserve all saved state.'
  );
  await chiRef.set(vacant);
  await world.update({ draftSimulationTwoWayHistory: history });
  const before = await snapshot(worldId);
  const initialOrl = (await getWorldTeamDocument(worldId, 'ORL'))!;
  const originalContract = initialOrl.players.find(
    (p: { playerId?: string }) => p.playerId === twoWayId
  ).contract;
  const ordinaryCounterfactual = await prepare(
    page,
    uid,
    worldId,
    'standard-only'
  );
  expect(ordinaryCounterfactual).toMatchObject({
    status: 'prepared',
    legal: true,
  });
  expect(await prepare(page, uid, worldId)).toMatchObject({
    status: 'prepared',
    legal: true,
  });
  // Stale authority must not apply even when the proposed salaries remain zero for the Two-Way.
  const racedHistory = structuredClone(history);
  racedHistory.records[0].priorSalaryCapYears = [2024, 2025];
  await world.update({ draftSimulationTwoWayHistory: racedHistory });
  const stale = await snapshot(worldId);
  failures.stale = await apply(page);
  expect(failures.stale).toMatchObject({
    success: false,
    error: expect.stringMatching(/changed before commit/i),
  });
  expect(await snapshot(worldId)).toEqual(stale);
  await world.update({ draftSimulationTwoWayHistory: history });

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
  if (!(await picker.count()))
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('magic');
  for (const [code, name, destination] of [
    ['CHI', 'Tre Jones', 'Orlando Magic'],
    ['ORL', 'Anthony Black', 'Chicago Bulls'],
    ['ORL', 'Alex Morales', 'Chicago Bulls'],
  ]) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card
      .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
      .click();
    const row = card
      .getByAltText(new RegExp(`^${name}$`, 'i'))
      .or(card.getByText(name, { exact: true }))
      .first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]');
    await row.getByRole('button', { name: '•••' }).click();
    await page
      .getByRole('button', {
        name: new RegExp(`^Trade to ${destination}$`, 'i'),
      })
      .click();
  }
  const chiCard = dialog.getByTestId('trade-team-card-CHI');
  await chiCard
    .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
    .click();
  await chiCard
    .locator(`[data-entitlement-id="${pickId}"]`)
    .getByRole('button', { name: '•••' })
    .click();
  await page.getByRole('button', { name: /^Trade to Orlando Magic$/i }).click();
  for (const [i, code] of codes.entries()) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption('STANDARD_TPE');
    const team = i ? initialOrl : vacant;
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(team.totals.apronTeamSalary + (i ? 29720 : -29720)));
    await card
      .getByLabel(`${i ? 'Anthony Black' : 'Tre Jones'} exact pre-trade Salary`)
      .fill(i ? '7970280' : '8000000');
  }
  await expect(
    dialog.getByText(/Alex Morales · Two-Way: excluded from salary matching/i)
  ).toBeVisible();
  await expect(
    dialog.getByLabel('Alex Morales exact pre-trade Salary')
  ).toHaveCount(0);
  // Closing preserves all three players, the pick and the ordinary salary elections.
  await dialog.getByRole('button', { name: /^Close Trade Machine$/i }).click();
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  await expect(
    dialog.getByText(/Alex Morales · Two-Way: excluded/i)
  ).toBeVisible();
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 60000 });
  await capture('permitted');
  await dialog
    .getByText(/Alex Morales · Two-Way: excluded from salary matching/i)
    .evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await capture('salary-exclusion');
  await dialog.getByTestId('trade-summary-button').click();
  await expect(
    page.getByTestId('trade-export-simulation-notice').last()
  ).toContainText('not verified NBA');
  await expect(page.getByText(/^Alex Morales$/i).last()).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download', exact: true }).click(),
  ]);
  const exported = path.join(proofDir, 'two-way-export.png');
  await download.saveAs(exported);
  expect(fs.readFileSync(exported).subarray(1, 4).toString()).toBe('PNG');
  await page.getByTitle('Close', { exact: true }).click();
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(1);
  await expect(dialog).toBeHidden({ timeout: 30000 });
  console.info('Two-Way proof: mixed trade committed from the GM interface.');
  const after = await snapshot(worldId);
  const savedTeams = await Promise.all(
    codes.map((code) => getWorldTeamDocument(worldId, code))
  );
  for (const [i, team] of savedTeams.entries()) {
    const code = codes[i];
    const original = i ? initialOrl : vacant;
    const expectedTwoWays =
      original.players.filter(isTwoWayTradePlayer).length + (i ? -1 : 1);
    expect(team!.players.filter(isTwoWayTradePlayer)).toHaveLength(
      expectedTwoWays
    );
    expect(team).not.toHaveProperty('twoWayPlayers');
    expect(team!.roster.includes(twoWayId)).toBe(!i);
    expect(team!.totals.teamSalary).toBe(
      original.totals.teamSalary + (i ? 29720 : -29720)
    );
    expect(team!.totals.apronTeamSalary).toBe(
      original.totals.apronTeamSalary + (i ? 29720 : -29720)
    );
    const ordinaryTpe =
      ordinaryCounterfactual.details.teamResults[i].createdTPE;
    expect(ordinaryTpe).toBeTruthy();
    const tpes = team!.exceptions?.tpe ?? [];
    expect(tpes).toHaveLength((original.exceptions?.tpe ?? []).length + 1);
    expect(tpes.at(-1)).toMatchObject({
      totalAmount: ordinaryTpe.totalAmount,
      remainingAmount: ordinaryTpe.remainingAmount,
      usedAmount: ordinaryTpe.usedAmount,
      salaryMatchingPath: ordinaryTpe.salaryMatchingPath,
    });
    await page.goto(`/gm/${code}?season=2026`);
    await openDashboardTab(page, 'Cap Sheet');
    if (!i)
      await expect(page.getByText(/^Alex Morales$/i).first()).toBeVisible();
    await capture(`${code}-roster`);
    await openDashboardTab(page, 'Full Cap Table');
    if (!i)
      await expect(
        page.getByRole('button', { name: /^Alex Morales$/i }).first()
      ).toBeVisible();
    await capture(`${code}-cap`);
    await openDashboardTab(page, 'Team History');
    const history = page
      .getByTestId('team-history-section-timeline')
      .getByRole('button', { name: /Trade Executed:/ });
    await expect(history).toHaveCount(1, { timeout: 30000 });
    await history.click();
    const detail = page.getByTestId('team-history-detail-modal');
    await expect(detail).toContainText(/Alex Morales/i);
    await capture(`${code}-history`);
    await detail.getByRole('button', { name: /close/i }).click();
    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-changed-players')).toContainText(
      /3\s+players? changed/i
    );
    await capture(`${code}-compare`);
    const expand = page.getByRole('button', { name: 'Expand activity rail' });
    if (await expand.isVisible()) await expand.click();
    await expect(
      page.getByTestId('cockpit-activity-rail-strip-two-way')
    ).toContainText(`${expectedTwoWays} / 3`);
    await capture(`${code}-plan`);
  }
  const moved = savedTeams[0]!.players.find(
    (p: { playerId?: string }) => p.playerId === twoWayId
  );
  const normalizedContracts = await page.evaluate(
    async ({ moved, original }) => {
      const { normalizeCurrentStatePlayerContract } = await import(
        '/src/features/architect/utils/mutationPipeline.helpers.playerNorm.contract.ts'
      );
      return {
        moved: normalizeCurrentStatePlayerContract(moved),
        original: normalizeCurrentStatePlayerContract(original),
      };
    },
    { moved: moved.contract, original: originalContract }
  );
  expect(normalizedContracts.moved).toEqual(
    expect.objectContaining(normalizedContracts.original)
  );
  expect(
    moved.contract.salariesByYear.find(
      (r: { season?: string }) => r.season === '2026-27'
    ).salary
  ).toBe(680985);
  const events = await getWorldEventDocuments(worldId);
  expect(JSON.stringify(events)).toContain(twoWayId);
  expect(JSON.stringify(events[0].metadata.salaryMatchingPaths)).not.toContain(
    twoWayId
  );
  expect(JSON.stringify(events)).toContain(
    'complete-before-current-salary-cap-year'
  );
  // Zero matching salary does not bypass financial completeness or a standing hard cap.
  for (const mode of ['missing-finance', 'hard-cap']) {
    const original = savedTeams[0]!;
    const changed = structuredClone(original);
    if (mode === 'missing-finance') delete changed.salaryBookInputs;
    else
      changed.salaryBookInputs.apronAdjustments.lineItems[0].amount += 50_000_000;
    await chiRef.set(changed);
    const blockedState = await snapshot(worldId);
    const result = await prepare(page, uid, worldId, 'return');
    failures[`two-way-only-${mode}`] = result;
    expect(result.status !== 'prepared' || !result.legal).toBe(true);
    expect(JSON.stringify(result)).toMatch(
      mode === 'missing-finance'
        ? /needs governed input/i
        : /hard cap violation/i
    );
    expect((await apply(page)).success).toBe(false);
    expect(await snapshot(worldId)).toEqual(blockedState);
    await chiRef.set(original);
  }
  // A saved Two-Way can move again without an election, matching credit or a new TPE.
  expect(await prepare(page, uid, worldId, 'return')).toMatchObject({
    status: 'prepared',
    legal: true,
  });
  const laterTransfer = await apply(page);
  expect(laterTransfer.success, laterTransfer.error).toBe(true);
  console.info(
    'Two-Way proof: reload and later transfer passed without matching salary or TPE credit.'
  );
  const returned = await snapshot(worldId);
  expect((await getWorldTeamDocument(worldId, 'ORL'))!.roster).toContain(
    twoWayId
  );
  for (const [i, code] of codes.entries()) {
    const team = (await getWorldTeamDocument(worldId, code))!;
    expect(team.totals.teamSalary).toBe(savedTeams[i]!.totals.teamSalary);
    expect(team.totals.apronTeamSalary).toBe(
      savedTeams[i]!.totals.apronTeamSalary
    );
    expect(team.exceptions?.tpe ?? []).toEqual(
      savedTeams[i]!.exceptions?.tpe ?? []
    );
  }
  expect((await apply(page)).success).toBe(false);
  expect(await snapshot(worldId)).toEqual(returned);
  await page.goto('/gm/ORL?season=2026');
  await openDashboardTab(page, 'Cap Sheet');
  await expect(page.getByText(/^Alex Morales$/i).first()).toBeVisible();
  await capture('return');
  expect(after.children.find((c) => c.name === 'contractBaselines')).toEqual(
    before.children.find((c) => c.name === 'contractBaselines')
  );
  const identities = (s: Awaited<ReturnType<typeof snapshot>>) =>
    s.children.find((c) => c.name === 'entitlements')!.docs.map((d) => d.id);
  expect(identities(returned)).toEqual(identities(before));
  expect(identities(returned)).toHaveLength(278);
  expect(returned.metadata!.draftSimulationUnresolved).toEqual(
    catalogue.data.unresolved
  );
  expect(catalogue.data.unresolved).toHaveLength(29);
  expect(
    (
      await getReviewAdminDb().collection('architect_baseEntitlements').get()
    ).docs.map((d) => ({ id: d.id, data: d.data() }))
  ).toEqual(sourceBefore);
  fs.writeFileSync(
    path.join(proofDir, 'two-way-proof.json'),
    JSON.stringify(
      {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE ?? null,
        scope: 'governed-simulation-only',
        worldId,
        ordinaryCounterfactual,
        failures,
        before,
        after,
        returned,
        exportedSha256: createHash('sha256')
          .update(fs.readFileSync(exported))
          .digest('hex'),
        preservation: {
          identities: identities(returned),
          unresolved: catalogue.data.unresolved,
          sourceUnchanged: true,
        },
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
}
