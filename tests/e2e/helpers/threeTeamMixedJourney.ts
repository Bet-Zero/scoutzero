import { expect, type Page } from '@playwright/test';
import { getReviewAdminDb, readReviewUserId } from './architectReviewWorld';
import {
  seedThreeTeamMixedWorld,
  THREE_TEAM_PLAYERS,
  NATIVE_MIXED_DATE,
} from '../fixtures/threeTeamMixedWorld';

export async function threeTeamMixedRoom(page: Page) {
  if (new URL(page.url()).searchParams.get('room') !== 'trade')
    await page.getByRole('tab', { name: /^Trade Machine$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByRole('region', { name: 'Swap pool' })).toBeVisible({
    timeout: 30000,
  });
  return dialog;
}
export async function startThreeTeamMixed(
  page: Page,
  name: string,
  resolve = true,
  completeStepien = true
) {
  await page.goto('/gm/PHI?season=2028');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `three_team_mixed_${name}_${Date.now()}`;
  const seeded = await seedThreeTeamMixedWorld(uid, worldId);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  if (!completeStepien)
    await root.update({ 'draftNativeLifecycle.softwareRetainedFirsts': [] });
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2028');
    },
    { uid, worldId }
  );
  await page.reload();
  const ids = Object.fromEntries(
    seeded.program.slots.map((s) => [s.originalTeam, s.entitlementId])
  );
  if (resolve) {
    const dialog = await threeTeamMixedRoom(page);
    for (const [team, position] of Object.entries({
      BKN: 20,
      PHX: 3,
      PHI: 5,
      NYK: 6,
      WAS: 14,
      POR: 27,
      MIL: 25,
    }))
      await dialog.getByLabel(`${team} draft position`).fill(String(position));
    for (let i = 1; i <= 5; i++)
      await dialog.getByLabel(`Claim ${i} election`).selectOption('exercise');
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      dialog.getByRole('button', { name: 'Resolve 2028 draft' }).click(),
    ]);
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(1);
  }
  return { ...seeded, root, ids, uid, worldId };
}

export async function selectThreeTeamMixed(
  page: Page,
  worldId: string,
  pickIds: string[],
  returned = false
) {
  await page.goto('/gm/PHI?season=2028');
  const dialog = await threeTeamMixedRoom(page);
  await expect(dialog.getByTestId('trade-team-card-PHI')).toBeVisible();
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if (!(await picker.count()))
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('nets');
  await expect(dialog.getByTestId('trade-team-card-BKN')).toBeVisible();
  if (!returned) {
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await picker.first().selectOption('spurs');
    await expect(dialog.getByTestId('trade-team-card-SAS')).toBeVisible();
    for (const p of THREE_TEAM_PLAYERS) {
      const card = dialog.getByTestId(`trade-team-card-${p.from}`);
      const row = card
        .getByAltText(new RegExp(`^${p.name}$`, 'i'))
        .first()
        .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]');
      await row.getByRole('button', { name: '•••' }).click();
      await page
        .getByRole('button', {
          name: `Trade to ${p.to === 'SAS' ? 'San Antonio Spurs' : 'Brooklyn Nets'}`,
          exact: true,
        })
        .click();
    }
    for (const team of ['PHI', 'BKN', 'SAS']) {
      const card = dialog.getByTestId(`trade-team-card-${team}`);
      await card
        .getByLabel('Elected path', { exact: true })
        .selectOption('ROOM');
      const prior = (
        await getReviewAdminDb()
          .doc(`architect_worlds/${worldId}/teams/${team}`)
          .get()
      ).data()!;
      // Apron books retain Vassell's $2,008,697 unlikely incentives.
      const apronDelta = THREE_TEAM_PLAYERS.reduce(
        (sum, p) =>
          sum +
          (p.to === team ? 1 : p.from === team ? -1 : 0) *
            (p.salary + (p.id === 'devin_vassell' ? 2008697 : 0)),
        0
      );
      await card
        .getByLabel('Post-assignment Apron Team Salary', { exact: true })
        .fill(String(prior.totals.apronTeamSalary + apronDelta));
      for (const p of THREE_TEAM_PLAYERS.filter((p) => p.from === team))
        await card
          .getByLabel(new RegExp(`^${p.name} exact pre-trade Salary$`, 'i'))
          .fill(String(p.salary));
    }
  }
  for (const [i, pickId] of pickIds.entries()) {
    const team = (i === 0) !== returned ? 'PHI' : 'BKN';
    const card = dialog.getByTestId(`trade-team-card-${team}`);
    await card
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await card
      .locator(`[data-entitlement-id="${pickId}"]`)
      .getByRole('button', { name: '•••' })
      .click();
    await page
      .getByRole('button', {
        name:
          team === 'PHI'
            ? 'Trade to Brooklyn Nets'
            : 'Trade to Philadelphia 76ers',
        exact: true,
      })
      .click();
  }
  return dialog;
}

export async function prepareThreeTeamMixed(
  page: Page,
  uid: string,
  worldId: string,
  ids: string[],
  mode = ''
) {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const metadata = (await root.get()).data()!;
  const teams = await Promise.all(
    (mode === 'selections-only' ? ['PHI', 'BKN'] : ['PHI', 'BKN', 'SAS']).map(
      async (t) => (await root.collection('teams').doc(t).get()).data()!
    )
  );
  const picks = await Promise.all(
    ids.map(async (id) => ({
      id,
      ...(await root.collection('entitlements').doc(id).get()).data(),
    }))
  );
  return page.evaluate(
    async ({ uid, worldId, teams, picks, mode, ordinary, date }) => {
      const previewPath =
        '/src/features/architect/utils/draftReview/simulationPreview.ts';
      const termsPath =
        '/src/features/architect/utils/entitlements/entitlementTerms.ts';
      const { previewRetainedDraftSimulation } = await import(previewPath);
      const { decorateEntitlementForTrade } = await import(termsPath);
      const selected = teams.map((t) =>
        mode === 'selections-only'
          ? undefined
          : ordinary.find(
              (p) => p.from === t.teamCode && t.roster.includes(p.id)
            )
      );
      const args: any = {
        userId: uid,
        worldId,
        mutationType: 'executeTrade',
        seasonId: date.seasonId,
        operationId: `three_team_mixed_${crypto.randomUUID()}`,
        payload: {
          asOfDate: date.asOfDate,
          tradeCtx: {
            source: 'tradeMachine',
            worldId,
            yearKey: date.yearKey,
            asOfDate: date.asOfDate,
          },
          teams: (mode === 'selections-only'
            ? ['PHI', 'BKN']
            : ['PHI', 'BKN', 'SAS']
          ).map((teamCode, i) => {
            const p = selected[i],
              target = teamCode === 'PHI' ? 'BKN' : 'PHI';
            const outgoing = picks
              .filter((p: any) => p.holderTeam === teamCode)
              .map((p) => ({
                ...decorateEntitlementForTrade(p),
                id: p.id,
                entitlementId: p.id,
                toTeamId: target,
              }));
            return {
              teamCode,
              sends: p ? [{ id: p.id, playerId: p.id, tradeTo: p.to }] : [],
              picksOut: [],
              outgoingEntitlements: outgoing,
              entitlementsOut: outgoing,
              cashSent: 0,
              cashToTeamId: null,
              salaryMatchingElection: selected.some(Boolean)
                ? {
                    version: 1,
                    path: 'ROOM',
                    postAssignmentApronTeamSalary:
                      teams[i].totals.apronTeamSalary +
                      ordinary.reduce(
                        (sum, q) =>
                          sum +
                          (q.to === teamCode
                            ? 1
                            : q.from === teamCode
                              ? -1
                              : 0) *
                            (q.salary +
                              (q.id === 'devin_vassell' ? 2008697 : 0)),
                        0
                      ),
                    tradedPlayerPreTradeSalaries: p ? { [p.id]: p.salary } : {},
                  }
                : null,
            };
          }),
        },
      };
      if (mode === 'incomplete')
        args.payload.teams[0].salaryMatchingElection = null;
      if (mode === 'cash') args.payload.teams[0].cashSent = 1;
      if (mode === 'contract')
        args.payload.teams[0].sends[0].contract = { salariesByYear: [] };
      if (mode === 'incoming')
        args.payload.teams[1].receives = [{ id: 'unlisted' }];
      if (mode === 'missing-return') {
        for (const t of args.payload.teams) {
          t.sends = [];
          t.salaryMatchingElection = null;
        }
        args.payload.teams[1].outgoingEntitlements = [];
        args.payload.teams[1].entitlementsOut = [];
      }
      if (mode === 'third-salary')
        args.payload.teams[2].salaryMatchingElection
          .tradedPlayerPreTradeSalaries.devin_vassell++;
      if (mode === 'no-destination')
        delete args.payload.teams[2].sends[0].tradeTo;
      if (mode === 'self-route') args.payload.teams[2].sends[0].tradeTo = 'SAS';
      if (mode === 'outside-route')
        args.payload.teams[2].sends[0].tradeTo = 'LAL';
      if (mode === 'idle-third') {
        args.payload.teams[2].sends = [];
        args.payload.teams[2].salaryMatchingElection.tradedPlayerPreTradeSalaries =
          {};
        args.payload.teams[0].sends[0].tradeTo = 'BKN';
      }
      if (mode === 'duplicate-team') args.payload.teams[2].teamCode = 'PHI';
      if (mode === 'duplicate-player')
        args.payload.teams[2].sends = [{ ...args.payload.teams[0].sends[0] }];
      if (mode === 'duplicate-selection')
        args.payload.teams[0].entitlementsOut.push({
          ...args.payload.teams[0].entitlementsOut[0],
        });
      let result;
      try {
        result = await previewRetainedDraftSimulation(args);
      } catch (e) {
        result = {
          status: 'error',
          reason: e instanceof Error ? e.message : String(e),
        };
      }
      Reflect.set(window, '__threeTeamMixed', { args, result });
      return result.status === 'prepared'
        ? {
            status: result.status,
            legal: result.preview.legal,
            reason: result.preview.reason,
            details: result.details,
          }
        : result;
    },
    {
      uid,
      worldId,
      teams,
      picks,
      mode,
      ordinary: THREE_TEAM_PLAYERS,
      date: { ...NATIVE_MIXED_DATE, asOfDate: metadata.asOfDate },
    }
  );
}
export async function applyThreeTeamMixed(page: Page, mode = '') {
  return page.evaluate(async (mode) => {
    const p = '/src/features/architect/utils/mutationPipeline.ts';
    const { applyWorldMutation } = await import(p);
    const { args, result } = Reflect.get(window, '__threeTeamMixed');
    return applyWorldMutation({
      ...args,
      draftReviewAuthority:
        mode === 'forged' ? { ...result.authority } : result.authority,
    });
  }, mode);
}
