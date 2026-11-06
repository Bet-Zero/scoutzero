import { expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { getReviewAdminDb, readReviewUserId } from './architectReviewWorld';
import { CONDITIONAL_COLLECTIONS } from '../fixtures/mixedConditionalWorld';

export async function completeConditionalState(worldId: string) {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const children = await Promise.all(
    [
      'teams',
      'entitlements',
      'events',
      'seasonHistory',
      'seasonTransitions',
      'draftSeasonInputs',
      'contractBaselines',
    ].map(async (name) => ({
      name,
      docs: (await root.collection(name).get()).docs.map((d) => ({
        id: d.id,
        data: d.data(),
      })),
    }))
  );
  const players = await Promise.all(
    children
      .find((c) => c.name === 'teams')!
      .docs.map(async (t) => ({
        team: t.id,
        docs: (
          await root.collection('teams').doc(t.id).collection('players').get()
        ).docs.map((d) => ({ id: d.id, data: d.data() })),
      }))
  );
  return { metadata: (await root.get()).data()!, children, players };
}
export async function conditionalStateDigest(worldId: string) {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, entry]) => [key, canonical(entry)])
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(canonical(await completeConditionalState(worldId))))
    .digest('hex');
}
export async function conditionalLogin(page: Page) {
  await page.goto('/gm/CHI?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  return readReviewUserId(page);
}
export async function openConditionalTrade(page: Page) {
  if (new URL(page.url()).searchParams.get('room') !== 'trade')
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(
    dialog.getByRole('region', { name: 'Conditional draft obligations' })
  ).toBeVisible({ timeout: 30000 });
  return dialog;
}
export async function selectMixedConditionalTrade(
  page: Page,
  worldId: string,
  pickId: string,
  validate = true
) {
  const dialog = await openConditionalTrade(page);
  // The shell/obligation panel can precede the asynchronously loaded slots.
  // Selecting an empty slot before Chicago arrives can replace slot zero.
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 30000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if (!(await picker.count()))
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('hornets');
  await expect(dialog.getByTestId('trade-team-card-CHA')).toBeVisible({
    timeout: 30000,
  });
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const routing = (await root.get()).data()!.draftSimulationTeams.length === 3;
  if (routing) {
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await picker.last().selectOption('raptors');
    await expect(dialog.getByTestId('trade-team-card-TOR')).toBeVisible({
      timeout: 30000,
    });
  }
  for (const [i, team] of (['CHI', 'CHA'] as const).entries()) {
    const card = dialog.getByTestId(`trade-team-card-${team}`);
    await expect(card).toBeVisible({ timeout: 30000 });
    await card
      .getByRole('button', { name: /^(Players|Plyr) \(\d+\)$/i })
      .click();
    for (const p of CONDITIONAL_COLLECTIONS[team]) {
      const row = card
        .getByText(new RegExp(`^${p.name}$`, 'i'))
        .first()
        .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]');
      await expect(row).toBeVisible({ timeout: 30000 });
      await row.getByRole('button', { name: '•••' }).click();
      await page
        .getByRole('button', {
          name: new RegExp(
            `^Trade to ${i ? 'Chicago Bulls' : 'Charlotte Hornets'}$`,
            'i'
          ),
        })
        .click();
    }
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption('AGGREGATED_STANDARD_TPE');
    const total = (
      await getReviewAdminDb()
        .doc(`architect_worlds/${worldId}/teams/${team}`)
        .get()
    ).data()!.totals.apronTeamSalary;
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(
        String(
          total +
            CONDITIONAL_COLLECTIONS[i ? 'CHI' : 'CHA'].reduce(
              (n, p) => n + p.salary,
              0
            ) -
            CONDITIONAL_COLLECTIONS[team].reduce((n, p) => n + p.salary, 0)
        )
      );
    for (const p of CONDITIONAL_COLLECTIONS[team])
      await card
        .getByLabel(new RegExp(`^${p.name} exact pre-trade Salary$`, 'i'))
        .fill(String(p.matching));
  }
  const card = dialog.getByTestId('trade-team-card-CHI');
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  await card
    .locator(`[data-entitlement-id="${pickId}"]`)
    .getByRole('button', { name: '•••' })
    .click();
  await page
    .getByRole('button', { name: /^Trade to Charlotte Hornets$/i })
    .click();
  if (routing) {
    const all = (await root.collection('entitlements').get()).docs;
    for (const [key, from, destination] of [
      ['CHI_2029_1st', 'CHI', 'Toronto Raptors'],
      ['TOR_2028_1st', 'TOR', 'Chicago Bulls'],
    ]) {
      const id = all.find(
        (d) =>
          d.data().underlyingPickId === key &&
          d.data().kind === 'pick_ownership'
      )!.id;
      const card = dialog.getByTestId(`trade-team-card-${from}`);
      await card
        .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
        .click();
      await card
        .locator(`[data-entitlement-id="${id}"]`)
        .getByRole('button', { name: '•••' })
        .click();
      await page
        .getByRole('button', { name: `Trade to ${destination}`, exact: true })
        .click();
    }
    const card = dialog.getByTestId('trade-team-card-TOR');
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption('STANDARD_TPE');
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill('30000000');
  }
  for (const p of Object.values(CONDITIONAL_COLLECTIONS).flat())
    await dialog
      .getByLabel(new RegExp(`^${p.name} absorption mode$`, 'i'))
      .selectOption('MATCH');
  if (validate) {
    await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeEnabled({ timeout: 120000 });
  }
  return dialog;
}

export async function prepareMixedConditional(
  page: Page,
  uid: string,
  worldId: string,
  ids: string[],
  mode = ''
) {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const teamCodes: string[] = (await root.get()).data()!.draftSimulationTeams;
  const teams = await Promise.all(
    teamCodes.map(
      async (t) => (await root.collection('teams').doc(t).get()).data()!
    )
  );
  if (teamCodes.length === 3) {
    const all = (await root.collection('entitlements').get()).docs;
    ids = [
      ...new Set([
        ...ids,
        ...['CHI_2029_1st', 'TOR_2028_1st'].map(
          (key) =>
            all.find(
              (d) =>
                d.data().underlyingPickId === key &&
                d.data().kind === 'pick_ownership'
            )!.id
        ),
      ]),
    ];
  }
  const picks = await Promise.all(
    ids.map(async (id) => ({
      id,
      ...(await root.collection('entitlements').doc(id).get()).data(),
    }))
  );
  return page.evaluate(
    async ({ uid, worldId, picks, teams, teamCodes, mode, ordinary }) => {
      const termsPath =
        '/src/features/architect/utils/entitlements/entitlementTerms.ts';
      const previewPath =
        '/src/features/architect/utils/draftReview/simulationPreview.ts';
      const { decorateEntitlementForTrade } = await import(termsPath);
      const { previewRetainedDraftSimulation } = await import(previewPath);
      const args: any = {
        userId: uid,
        worldId,
        mutationType: 'executeTrade',
        seasonId: '2025-26',
        operationId: `mixed_conditional_${crypto.randomUUID()}`,
        payload: {
          asOfDate: '2026-06-05',
          tradeCtx: {
            source: 'tradeMachine',
            worldId,
            yearKey: 2026,
            asOfDate: '2026-06-05',
          },
          teams: teamCodes.map((teamCode, i) => {
            const p = ordinary[i] ?? [];
            const outgoing = picks
              .filter((p: any) => p.holderTeam === teamCode)
              .map((p) => ({
                ...decorateEntitlementForTrade(p),
                id: p.id,
                entitlementId: p.id,
                toTeamId:
                  teamCodes.length === 3 &&
                  p.underlyingPickId === 'CHI_2029_1st'
                    ? 'TOR'
                    : i
                      ? 'CHI'
                      : 'CHA',
              }));
            return {
              teamCode,
              sends: p.map((q) => ({
                id: q.id,
                playerId: q.id,
                tradeTo: i ? 'CHI' : 'CHA',
              })),
              picksOut: [],
              outgoingEntitlements: outgoing,
              entitlementsOut: outgoing,
              cashSent: 0,
              cashToTeamId: null,
              salaryMatchingElection: {
                version: 1,
                path: i === 2 ? 'STANDARD_TPE' : 'AGGREGATED_STANDARD_TPE',
                postAssignmentApronTeamSalary:
                  teams[i].totals.apronTeamSalary +
                  (ordinary[1 - i] ?? []).reduce((n, p) => n + p.salary, 0) -
                  (ordinary[i] ?? []).reduce((n, p) => n + p.salary, 0),
                tradedPlayerPreTradeSalaries: Object.fromEntries(
                  p.map((q) => [q.id, q.matching])
                ),
              },
            };
          }),
        },
      };
      if (mode === 'incomplete')
        args.payload.teams[0].salaryMatchingElection = null;
      if (mode === 'cash') args.payload.teams[0].cashSent = 1;
      if (mode === 'forged-terms')
        args.payload.teams[0].entitlementsOut[0].protectionLadder = [];
      if (mode === 'forged-contract')
        args.payload.teams[0].sends.at(-1).contract = { salariesByYear: [] };
      if (mode === 'incoming')
        args.payload.teams[1].receives = [{ id: 'unlisted' }];
      if (mode === 'adverse-fallback') {
        // Keep TOR's genuine return, but do not supply the 2028 witness that
        // would legitimately cure CHI's 2027/2028 protection branch.
        for (const p of args.payload.teams[2].entitlementsOut)
          p.toTeamId = 'CHA';
      }
      let result;
      try {
        result = await previewRetainedDraftSimulation(args);
      } catch (e) {
        result = {
          status: 'error',
          reason: e instanceof Error ? e.message : String(e),
        };
      }
      Reflect.set(window, '__mixedConditional', { args, result });
      return result.status === 'prepared'
        ? {
            status: result.status,
            legal: result.preview.legal,
            details: result.details,
            reason: result.preview.reason,
          }
        : result;
    },
    {
      uid,
      worldId,
      picks,
      teams,
      teamCodes,
      mode,
      ordinary: Object.values(CONDITIONAL_COLLECTIONS),
    }
  );
}
export async function applyMixedConditional(page: Page, mode = '') {
  return page.evaluate(async (mode) => {
    const modulePath = '/src/features/architect/utils/mutationPipeline.ts';
    const { applyWorldMutation } = await import(modulePath);
    const { args, result } = Reflect.get(window, '__mixedConditional');
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
