import {
  test,
  expect as baseExpect,
  type Page,
  type Locator,
} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { loadSnapshot, coverage } from '../../scripts/dev/cloudData';
import {
  seedMixedSwapWorld,
  SWAP_PLAYERS,
  SWAP_COLLECTIONS,
  mixedSwapRoutes,
} from './fixtures/mixedSwapWorld';
import {
  completeConditionalState,
  conditionalStateDigest,
} from './helpers/mixedConditionalJourney';
import { prepareMixedSwap, applyMixedSwap } from './helpers/mixedSwapJourney';
import { conditionalDraft } from './helpers/conditionalDraftJourney';
import {
  readReviewUserId,
  getReviewAdminDb,
  openDashboardTab,
} from './helpers/architectReviewWorld';

// Reloaded protected inventory and History verify the complete catalogue asynchronously.
const expect = baseExpect.configure({ timeout: 60000 });

test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 60000,
  trace: 'on',
});
test.setTimeout(1200000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE,
  'Protected emulators and retained catalogue required.'
);
const proofDir = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/mixed-swap';
const affected = ['WAS', 'MIA', 'PHX', 'ORL'];
const threeTeam = process.env.PLAYWRIGHT_THREE_TEAM_SWAP === 'true';
const routes = mixedSwapRoutes(threeTeam);
const participant = (team: string) => routes.find((r) => r.from === team);
const incomingFrom = (team: string) => routes.find((r) => r.to === team)!.from;
const incomingPlayer = (team: string) => SWAP_PLAYERS[incomingFrom(team)];
const teamNames = {
  WAS: 'Washington Wizards',
  MIA: 'Miami Heat',
  PHX: 'Phoenix Suns',
};
async function capture(page: Page, key: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${key}-1280x720.png`) });
}
function receipt(name: string, value: unknown) {
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, `${name}.json`),
    JSON.stringify(value, null, 2)
  );
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
async function select(page: Page, card: Locator, id: string, to: string) {
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  await card
    .locator(`[data-entitlement-id="${id}"]`)
    .getByRole('button', { name: '•••' })
    .click();
  await page
    .getByRole('button', { name: `Trade to ${to}`, exact: true })
    .click();
}
test.afterAll(() => {
  const files = ['exercise', 'waive'].map((k) =>
    path.join(proofDir, `proof-${k}.json`)
  );
  if (files.every((f) => fs.existsSync(f))) {
    const journeys = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    if (
      journeys.every(
        (j) => j.candidate === process.env.SCOUTZERO_PROOF_CANDIDATE
      )
    )
      receipt('proof', {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        scope: 'governed-simulation-only',
        packageSha256: journeys[0].packageSha256,
        journeys,
      });
  }
});

for (const choice of ['exercise', 'waive'] as const)
  test(`mixed unresolved swap ${choice}: trade, all participants, season and reload`, async ({
    page,
  }) => {
    await page.goto('/gm/WAS?season=2026');
    await expect
      .poll(() => readReviewUserId(page), { timeout: 30000 })
      .not.toBe('');
    const uid = await readReviewUserId(page),
      worldId = `mixed_swap_${choice}_${Date.now()}`;
    const { program, catalogue, considerationId, rightId, laterId, original } =
      await seedMixedSwapWorld(uid, worldId, threeTeam);
    const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
    const initial = await completeConditionalState(worldId);
    const sourceBefore = await sourceState();
    if (process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE)
      expect(coverage(await loadSnapshot()).sha256).toBe(
        coverage(
          JSON.parse(
            fs.readFileSync(
              process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE,
              'utf8'
            )
          )
        ).sha256
      );
    const initialTeams = initial.children.find((c) => c.name === 'teams')!.docs;
    const committedContracts: Record<string, any> = {};
    async function verifyFinancialViews(
      stage: string,
      year: number,
      eventCount: number
    ) {
      const saved = await completeConditionalState(worldId);
      expect(
        saved.children.find((c) => c.name === 'events')!.docs
      ).toHaveLength(eventCount);
      expect(
        saved.children.find((c) => c.name === 'contractBaselines')
      ).toEqual(initial.children.find((c) => c.name === 'contractBaselines'));
      const entitlements = saved.children.find(
        (c) => c.name === 'entitlements'
      )!.docs;
      const trade = saved.children
        .find((c) => c.name === 'events')!
        .docs.find((e) => e.data.mutationType === 'executeTrade')!.data;
      expect(trade.metadata.draftReviewReceipt.playerMovements).toEqual(
        routes.flatMap(({ from, to }) =>
          SWAP_COLLECTIONS[from].map((p) =>
            expect.objectContaining({
              playerId: p.id,
              fromTeam: from,
              toTeam: to,
            })
          )
        )
      );
      expect([...trade.playerIds].sort()).toEqual(
        routes.flatMap((r) => SWAP_COLLECTIONS[r.from].map((p) => p.id)).sort()
      );
      expect(trade.metadata.draftReviewReceipt.movements).toHaveLength(1);
      expect(trade.metadata.draftReviewReceipt.movements[0]).toMatchObject({
        entitlementId: rightId,
        assetKind: 'swap_right',
        fromTeam: 'WAS',
        toTeam: 'MIA',
      });
      for (const team of affected) {
        const current = saved.children
          .find((c) => c.name === 'teams')!
          .docs.find((t) => t.id === team)!.data;
        const prior = initialTeams.find((t) => t.id === team)!.data;
        expect([...current.entitlementIds].sort()).toEqual(
          entitlements
            .filter((e) => e.data.holderTeam === team)
            .map((e) => e.id)
            .sort()
        );
        let money = 30000000;
        if (participant(team)) {
          const allIncoming = SWAP_COLLECTIONS[incomingFrom(team)];
          const allOutgoing = SWAP_COLLECTIONS[participant(team)!.from];
          const outgoing = SWAP_PLAYERS[participant(team)!.from],
            incoming = incomingPlayer(team);
          const original = initialTeams
            .find((t) => t.id === incomingFrom(team))!
            .data.players.find((p: any) => p.playerId === incoming.id);
          const player = current.players.find(
            (p: any) => p.playerId === incoming.id
          );
          expect([...current.roster].sort()).toEqual(
            prior.roster
              .filter((id: string) => !allOutgoing.some((p) => p.id === id))
              .concat(allIncoming.map((p) => p.id))
              .sort()
          );
          expect(player.contract.contractId).toBe(original.contract.contractId);
          // A trade preserves historical Contract rows too; only Season
          // Advance trims expired rows from the current-state Contract.
          const rows = original.contract.salariesByYear.filter(
            (r: any) =>
              year === 2026 || Number(r.season.slice(0, 4)) + 1 >= year
          );
          expect(player.contract.salariesByYear).toHaveLength(rows.length);
          for (const row of rows)
            expect(player.contract.salariesByYear).toEqual(
              expect.arrayContaining([expect.objectContaining(row)])
            );
          if (stage === 'committed')
            committedContracts[team] = structuredClone(player.contract);
          if (year === 2027) {
            const archive = saved.children
              .find((c) => c.name === 'seasonHistory')!
              .docs.find((d) => d.data.teamCode === team)!.data;
            expect(
              archive.preAdvanceState.players.find(
                (p: any) => p.playerId === incoming.id
              ).contract
            ).toMatchObject({
              contractId: committedContracts[team].contractId,
              salariesByYear: committedContracts[team].salariesByYear,
            });
          }
          const overrides = saved.players.find((p) => p.team === team)!.docs;
          expect(
            overrides.find((p) => p.id === incoming.id)!.data.contract
          ).toEqual(player.contract);
          expect(overrides.some((p) => p.id === outgoing.id)).toBe(false);
          for (const p of allIncoming) {
            const source = initialTeams
              .find((t) => t.id === incomingFrom(team))!
              .data.players.find((q: any) => q.playerId === p.id);
            const actual = current.players.find(
              (q: any) => q.playerId === p.id
            );
            expect(actual.contract.contractId).toBe(source.contract.contractId);
            const retainedRows = source.contract.salariesByYear.filter(
              (r: any) =>
                year === 2026 || Number(r.season.slice(0, 4)) + 1 >= year
            );
            expect(actual.contract.salariesByYear).toEqual(
              expect.arrayContaining(
                retainedRows.map((r: any) => expect.objectContaining(r))
              )
            );
            expect(overrides.find((q) => q.id === p.id)!.data.contract).toEqual(
              actual.contract
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
          money =
            104000000 +
            allIncoming.reduce(
              (n, p) => n + (year === 2026 ? p.salary : p.nextSalary),
              0
            );
          expect(current.totals.taxSalary).toBe(
            year === 2026
              ? 104000000 + allOutgoing.reduce((n, p) => n + p.salary, 0)
              : money
          );
          expect(current.hardCapped).toBe(year === 2026);
        } else {
          expect(current.roster).toEqual(prior.roster);
          expect(current.totals.taxSalary).toBe(money);
        }
        expect(current.totals.teamSalary).toBe(money);
        expect(current.totals.apronTeamSalary).toBe(money);
        await page.goto(`/gm/${team}?season=${year}`);
        await page.reload();
        await openDashboardTab(page, 'Roster');
        if (participant(team)) {
          const allIncoming = SWAP_COLLECTIONS[incomingFrom(team)];
          const allOutgoing = SWAP_COLLECTIONS[participant(team)!.from];
          const outgoing = SWAP_PLAYERS[participant(team)!.from],
            incoming = incomingPlayer(team);
          await expect(
            page.getByAltText(new RegExp(`^${incoming.name}$`, 'i')).first()
          ).toBeVisible();
          await expect(
            page.getByAltText(new RegExp(`^${outgoing.name}$`, 'i'))
          ).toHaveCount(0);
        }
        if (participant(team)) {
          for (const p of SWAP_COLLECTIONS[incomingFrom(team)])
            await expect(
              page.getByAltText(new RegExp(`^${p.name}$`, 'i')).first()
            ).toBeVisible();
          for (const p of SWAP_COLLECTIONS[participant(team)!.from])
            await expect(
              page.getByAltText(new RegExp(`^${p.name}$`, 'i'))
            ).toHaveCount(0);
        }
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
        await capture(page, `${choice}-${stage}-${team}-books`);
        const expand = page.getByRole('button', {
          name: 'Expand activity rail',
        });
        if (await expand.isVisible()) await expand.click();
        await expect(
          page.getByTestId('cockpit-activity-rail-identity')
        ).toContainText('Players and Unresolved Swap Right');
        await expect(
          page.getByTestId('cockpit-activity-rail-save-indicator')
        ).toHaveAttribute('data-save-status', 'saved');
        await expect(
          page.getByTestId('cockpit-activity-rail-strip-roster')
        ).toContainText('15 / 15');
        await expect(
          page.getByTestId('cockpit-activity-rail-strip-two-way')
        ).toContainText('3 / 3');
        if (participant(team)) {
          await openDashboardTab(page, 'Team History');
          await page
            .getByTestId('team-history-section-timeline')
            .getByRole('button', { name: /Trade Executed:/ })
            .click();
          const detail = page.getByTestId('team-history-detail-modal');
          for (const text of [
            ...routes.flatMap((r) =>
              SWAP_COLLECTIONS[r.from].map((p) => p.name)
            ),
            'unresolved swap right',
            'Underlying pool selections remain',
          ])
            await expect(detail).toContainText(new RegExp(text, 'i'));
          await detail.getByRole('button', { name: /close/i }).click();
          await openDashboardTab(page, 'Compare');
          await expect(
            page.getByTestId('comparison-roster-additions')
          ).toContainText(new RegExp(incomingPlayer(team).name, 'i'));
          await expect(
            page.getByTestId('comparison-roster-removals')
          ).toContainText(
            new RegExp(SWAP_PLAYERS[participant(team)!.from].name, 'i')
          );
          for (const p of SWAP_COLLECTIONS[incomingFrom(team)])
            await expect(
              page.getByTestId('comparison-roster-additions')
            ).toContainText(new RegExp(p.name, 'i'));
          for (const p of SWAP_COLLECTIONS[participant(team)!.from])
            await expect(
              page.getByTestId('comparison-roster-removals')
            ).toContainText(new RegExp(p.name, 'i'));
          if (team === 'WAS' || team === 'MIA')
            await expect(
              page.getByText('WAS 2026 first-round swap right', { exact: true })
            ).toBeVisible();
        }
      }
      receipt(`${choice}-${stage}-state`, saved);
    }
    await page.evaluate(
      ({ uid, worldId }) => {
        localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
        localStorage.setItem('hz.currentSeasonEndYear', '2026');
      },
      { uid, worldId }
    );
    await page.reload();
    let dialog = await room(page);
    await expect(dialog.getByTestId('trade-team-card-WAS')).toContainText(
      'Washington Wizards',
      { timeout: 30000 }
    );
    const picker = dialog
      .locator('label', { hasText: /^Select Team$/ })
      .locator('xpath=following-sibling::select[1]');
    if (!(await picker.count()))
      await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await picker.first().selectOption('heat');
    await expect(dialog.getByTestId('trade-team-card-MIA')).toContainText(
      'Miami Heat'
    );
    if (threeTeam) {
      await dialog.getByRole('button', { name: /^Add Team$/ }).click();
      await picker.first().selectOption('suns');
      await expect(dialog.getByTestId('trade-team-card-PHX')).toContainText(
        'Phoenix Suns'
      );
    }
    await select(
      page,
      dialog.getByTestId('trade-team-card-WAS'),
      rightId,
      'Miami Heat'
    );
    for (const { from: team, to } of routes) {
      const destination = teamNames[to];
      const card = dialog.getByTestId(`trade-team-card-${team}`),
        p = SWAP_PLAYERS[participant(team)!.from];
      await card
        .getByRole('button', { name: /^(Players|Plyr)( \(\d+\))?$/i })
        .click();
      for (const p of SWAP_COLLECTIONS[team]) {
        const row = card
          .getByText(new RegExp(`^${p.name}$`, 'i'))
          .first()
          .locator(
            'xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'
          );
        await row.getByRole('button', { name: '•••' }).click();
        await page
          .getByRole('button', { name: `Trade to ${destination}`, exact: true })
          .click();
      }
      await card
        .getByLabel('Elected path', { exact: true })
        .selectOption('AGGREGATED_STANDARD_TPE');
      const incoming = incomingPlayer(team);
      await card
        .getByLabel('Post-assignment Apron Team Salary', { exact: true })
        .fill(
          String(
            104000000 +
              SWAP_COLLECTIONS[incomingFrom(team)].reduce(
                (n, p) => n + p.salary,
                0
              )
          )
        );
      for (const p of SWAP_COLLECTIONS[team])
        await card
          .getByLabel(new RegExp(`^${p.name} exact pre-trade Salary$`, 'i'))
          .fill(String(p.matching));
    }
    for (const { from } of routes)
      for (const p of SWAP_COLLECTIONS[from])
        await dialog
          .getByLabel(new RegExp(`^${p.name} absorption mode$`, 'i'))
          .selectOption('MATCH');
    if (threeTeam && choice === 'exercise') {
      await dialog
        .getByRole('button', { name: 'Close Trade Machine', exact: true })
        .click();
      dialog = await room(page);
      for (const { from: team } of routes) {
        const p = SWAP_PLAYERS[team];
        await expect
          .poll(async () =>
            Number(
              (
                await dialog
                  .getByTestId(`trade-team-card-${team}`)
                  .getByLabel(
                    new RegExp(`^${p.name} exact pre-trade Salary$`, 'i')
                  )
                  .inputValue()
              ).replace(/[^0-9.-]/g, '')
            )
          )
          .toBe(p.matching);
      }
    }
    if (choice === 'exercise') {
      const beforeRejected = await conditionalStateDigest(worldId);
      await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
      await expect(dialog).toContainText(
        'Standard and Aggregated Standard TPE paths are unavailable below the Salary Cap',
        { timeout: 120000 }
      );
      await expect(
        dialog.getByRole('button', { name: /^Apply Trade$/ })
      ).toBeDisabled();
      expect(await conditionalStateDigest(worldId)).toBe(beforeRejected);
      await capture(page, 'invalid-proposal');
    }
    for (const { from: team } of routes) {
      const card = dialog.getByTestId(`trade-team-card-${team}`),
        p = SWAP_PLAYERS[participant(team)!.from],
        incoming = incomingPlayer(team);
      await card
        .getByLabel('Elected path', { exact: true })
        .selectOption('ROOM');
      await card
        .getByLabel('Post-assignment Apron Team Salary', { exact: true })
        .fill(
          String(
            104000000 +
              SWAP_COLLECTIONS[incomingFrom(team)].reduce(
                (n, p) => n + p.salary,
                0
              )
          )
        );
      for (const p of SWAP_COLLECTIONS[team])
        await card
          .getByLabel(new RegExp(`^${p.name} exact pre-trade Salary$`, 'i'))
          .fill(String(p.matching));
    }
    await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/ })
    ).toBeEnabled({ timeout: 120000 });
    await capture(page, `${choice}-proposal`);
    await dialog.getByTestId('trade-summary-button').click();
    await expect(
      page.getByTestId('trade-export-simulation-notice').last()
    ).toContainText('not verified NBA trade legality');
    // The unresolved option is displayed separately from its player consideration.
    await expect(
      page.getByText('Swap Option', { exact: true }).last()
    ).toBeVisible();
    await expect(
      page.getByTestId('trade-export-swap-terms').last()
    ).toContainText(
      '2. ORL slot: more favorable of ORL / PHX slots after prior claims'
    );
    await capture(page, `${choice}-export`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download', exact: true }).click(),
    ]);
    await download.saveAs(path.join(proofDir, `${choice}-trade-export.png`));
    await page.getByTitle('Close', { exact: true }).click();
    await dialog.getByRole('button', { name: /^Apply Trade$/ }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(1);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await expect(page).not.toHaveURL(/[?&]room=trade(?:&|$)/);
    expect(
      (await root.collection('entitlements').doc(rightId).get()).data()!
        .holderTeam
    ).toBe('MIA');
    // Trading the option with Contracts must leave every underlying pool pick untouched.
    for (const slot of program.slots)
      expect(
        (
          await root.collection('entitlements').doc(slot.entitlementId).get()
        ).data()!.holderTeam
      ).toBe(slot.holderTeam);
    await verifyFinancialViews('committed', 2026, 1);
    dialog = await room(page);
    await expect(
      dialog.getByRole('region', { name: 'Swap pool' })
    ).toContainText('1. MIA:');
    for (const [team, position] of Object.entries({ WAS: 20, PHX: 5, ORL: 25 }))
      await dialog.getByLabel(`${team} draft position`).fill(String(position));
    await dialog.getByLabel('MIA WAS swap choice').selectOption(choice);
    await dialog.getByLabel('ORL ORL swap choice').selectOption('exercise');
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      dialog.getByRole('button', { name: 'Resolve 2026 draft' }).click(),
    ]);
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(2);
    // Independently derived from the stated order: WAS first chooses PHX #5 or
    // waives. ORL then exchanges #25 for the selection left in PHX's slot.
    const allocation = {
      [original('WAS')]: choice === 'exercise' ? 'ORL' : 'MIA',
      [original('PHX')]: choice === 'exercise' ? 'MIA' : 'ORL',
      [original('ORL')]: 'PHX',
    };
    expect((await root.get()).data()!.draftSwapProgram.result).toEqual({
      positions: { WAS: 20, PHX: 5, ORL: 25 },
      elections: { [rightId]: choice === 'exercise', [laterId]: true },
      allocation,
    });
    dialog = await room(page);
    await capture(page, `${choice}-draft`);
    const expectedDelta: Record<string, string[]> = {
      WAS: ['WAS 2026 first-round swap right'],
      MIA: [
        'WAS 2026 first-round swap right',
        ...(choice === 'exercise'
          ? ['WAS 2026 first-round pick', 'PHX 2026 first-round pick']
          : []),
      ],
      PHX: ['PHX 2026 first-round pick', 'ORL 2026 first-round pick'],
      ORL: [
        'ORL 2026 first-round pick',
        `${choice === 'exercise' ? 'WAS' : 'PHX'} 2026 first-round pick`,
      ],
    };
    for (const team of affected) {
      await page.goto(`/gm/${team}?season=2026`);
      await openDashboardTab(page, 'Team History');
      const timeline = page.getByTestId('team-history-section-timeline');
      await expect(timeline).toContainText('Draft Obligation Resolved');
      await timeline
        .getByRole('button')
        .filter({ hasText: '2026 swap pool resolved' })
        .click();
      await expect(
        page.getByTestId('team-history-detail-sections')
      ).toContainText('at pick 25');
      await capture(page, `${choice}-${team}-history`);
      await page.getByTestId('team-history-detail-close').click();
      await openDashboardTab(page, 'Compare');
      for (const text of expectedDelta[team])
        await expect(page.getByText(text, { exact: true })).toBeVisible();
      await capture(page, `${choice}-${team}-compare`);
      await page.reload();
      await openDashboardTab(page, 'Compare');
      for (const text of expectedDelta[team])
        await expect(page.getByText(text, { exact: true })).toBeVisible();
      await capture(page, `${choice}-${team}-reload`);
      const expand = page.getByRole('button', { name: 'Expand activity rail' });
      if (await expand.isVisible()) await expand.click();
      await page.getByTestId('cockpit-activity-rail-assets-open').click();
      const picks = program.slots.filter(
        (s) => allocation[s.entitlementId] === team
      );
      for (const slot of picks)
        await expect(
          page.getByTestId('cockpit-assets-panel-picks-2026-first')
        ).toContainText(
          slot.originalTeam === team ? 'Own' : `via ${slot.originalTeam}`,
          { timeout: 60000 }
        );
      if (team === 'MIA')
        await expect(
          page.getByTestId('cockpit-assets-panel-rights-2026')
        ).toContainText('WAS swap right — resolved');
      await capture(page, `${choice}-${team}-assets`);
      await page.keyboard.press('Escape');
      const inventoryRoom = await room(page),
        card = inventoryRoom.getByTestId(`trade-team-card-${team}`);
      await card
        .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
        .click();
      const inventory = (await root.collection('teams').doc(team).get()).data()!
        .entitlementIds;
      for (const id of [
        rightId,
        considerationId,
        ...program.slots.map((s) => s.entitlementId),
      ]) {
        const holder =
          id === rightId
            ? 'MIA'
            : id === considerationId
              ? 'MIA'
              : allocation[id];
        expect(inventory.includes(id)).toBe(holder === team);
        await expect(card.locator(`[data-entitlement-id="${id}"]`)).toHaveCount(
          holder === team ? 1 : 0
        );
      }
    }
    await verifyFinancialViews('resolved', 2026, 2);
    if (choice === 'exercise') {
      const ref = root
          .collection('teams')
          .doc('MIA')
          .collection('players')
          .doc('jaden_hardy'),
        prior = (await ref.get()).data()!;
      await ref.set({
        ...prior,
        contract: {
          ...prior.contract,
          salariesByYear: prior.contract.salariesByYear.map((r: any) => ({
            ...r,
            salary: r.salary + 1,
          })),
        },
      });
      const conflict = await conditionalStateDigest(worldId);
      const result = await page.evaluate(async (worldId) => {
        const p = '/src/features/architect/utils/seasonManager.ts';
        return (await import(p)).advanceSeasonInWorld(worldId, {
          fromSeason: '2025-26',
        });
      }, worldId);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Contract.*conflicts/);
      expect(await conditionalStateDigest(worldId)).toBe(conflict);
      await ref.set(prior);
    }
    await page.goto('/gm/MIA?season=2026');
    dialog = await room(page);
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      dialog.getByRole('button', { name: 'Advance to 2026–27' }).click(),
    ]);
    await expect
      .poll(async () => (await root.get()).data()?.currentSeason, {
        timeout: 120000,
      })
      .toBe('2026-27');
    expect((await root.collection('seasonHistory').get()).size).toBe(30);
    await expect(page).toHaveURL(/season=2027/);
    dialog = await room(page);
    await expect(
      dialog.getByRole('region', { name: 'Swap pool' })
    ).toContainText('Swap rights resolved');
    await capture(page, `${choice}-season`);
    for (const team of affected) {
      await page.goto(`/gm/${team}?season=2027`);
      await openDashboardTab(page, 'Compare');
      for (const text of expectedDelta[team])
        await expect(page.getByText(text, { exact: true })).toBeVisible();
    }
    await verifyFinancialViews('season', 2027, 3);
    const final = await completeConditionalState(worldId);
    const laterSeason = await page.evaluate(async (worldId) => {
      const modulePath = '/src/features/architect/utils/seasonManager.ts';
      const { advanceSeasonInWorld } = await import(modulePath);
      return advanceSeasonInWorld(worldId, { fromSeason: '2026-27' });
    }, worldId);
    expect(laterSeason.success).toBe(false);
    expect(await completeConditionalState(worldId)).toEqual(final);
    const initialEntitlements = initial.children.find(
      (c) => c.name === 'entitlements'
    )!.docs;
    const finalEntitlements = final.children.find(
      (c) => c.name === 'entitlements'
    )!.docs;
    const withoutHolders = (docs: typeof initialEntitlements) =>
      docs.map(({ id, data: { holderTeam, ...terms } }) => ({ id, terms }));
    expect(finalEntitlements).toHaveLength(278);
    expect(withoutHolders(finalEntitlements)).toEqual(
      withoutHolders(initialEntitlements)
    );
    expect(final.metadata!.draftSimulationUnresolved).toEqual(
      catalogue.data.unresolved
    );
    expect(await sourceState()).toEqual(sourceBefore);
    receipt(`proof-${choice}`, {
      candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
      scope: 'governed-simulation-only',
      packageSha256: createHash('sha256')
        .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
        .digest('hex'),
      catalogue: 278,
      unresolved: 29,
      choice,
      allocation,
      metadata: final.metadata,
      events: final.children.find((c) => c.name === 'events')!.docs,
      sourceUnchanged: true,
      allAffectedTeams: affected,
      participants: routes.map((r) => r.from),
      playerRoutes: routes,
      stagedCloseReopen: threeTeam && choice === 'exercise',
      teamPlan: true,
      export: true,
      reload: true,
      contractsAndBooks: true,
      allAffectedTeamsReloadedAtEveryStage: true,
    });
  });

test('mixed swap failures and stale operations leave the complete world unchanged', async ({
  page,
}) => {
  // The three-team matrix re-authenticates the full catalogue for additional
  // routing and stale-third-team cases (about 19 minutes in diagnostics).
  if (threeTeam) test.setTimeout(1500000);
  await page.goto('/gm/WAS?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `mixed_swap_negative_${Date.now()}`;
  const { program, rightId, laterId, original } = await seedMixedSwapWorld(
    uid,
    worldId,
    threeTeam
  );
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`),
    sourceBefore = await sourceState();
  const rejected: Record<string, unknown> = {};
  const prepare = (ids = [rightId], mode = '') =>
    prepareMixedSwap(page, uid, worldId, ids, mode, threeTeam);
  const pristine = await conditionalStateDigest(worldId);
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  expect(await conditionalStateDigest(worldId)).toBe(pristine);
  const expectedReasons: Record<string, RegExp> = {
    'duplicate-team': /distinct participating teams/i,
    'fourth-team': /distinct participating teams/i,
    'missing-destination': /explicit destination/i,
    'conflicting-destination': /explicit destination/i,
    'self-destination': /explicit destination/i,
    'outside-destination': /explicit destination/i,
    'neutral-third': /noncash return consideration/i,
    'incomplete-third': /matching path/i,
    'forged-third-contract': /unchanged ordinary/i,
    'wrong-receiver': /return selection/i,
    cash: /noncash entitlement/i,
    incoming: /Incoming players must be derived/i,
  };
  for (const mode of [
    'incomplete',
    'wrong-salary',
    'forged-terms',
    'forged-contract',
    ...(threeTeam
      ? [
          'duplicate-team',
          'fourth-team',
          'missing-destination',
          'conflicting-destination',
          'self-destination',
          'outside-destination',
          'neutral-third',
          'incomplete-third',
          'forged-third-contract',
          'wrong-receiver',
          'cash',
          'incoming',
        ]
      : []),
  ]) {
    const result = await prepare([rightId], mode);
    expect(
      result.status === 'error' ||
        result.status === 'blocked' ||
        result.legal === false
    ).toBe(true);
    if (expectedReasons[mode])
      expect(JSON.stringify(result)).toMatch(expectedReasons[mode]);
    expect((await applyMixedSwap(page)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(pristine);
    rejected[mode] = result;
  }
  // PHX's 2029 original is encumbered and cannot itself be traded in this
  // family. Remove its software first-round coverage instead, leaving
  // source terms intact, so the proposal reaches the third team's Stepien gate.
  const missingFirsts = threeTeam
    ? [original('PHX', 2028), original('PHX', 2029)]
    : [];
  const priorHoldings = await Promise.all(
    (threeTeam ? ['PHX', 'ORL'] : []).map(async (team) => {
      const ref = root.collection('teams').doc(team);
      return { ref, ids: (await ref.get()).data()!.entitlementIds as string[] };
    })
  );
  if (threeTeam) {
    const batch = getReviewAdminDb().batch();
    for (const id of missingFirsts)
      batch.update(root.collection('entitlements').doc(id), {
        holderTeam: 'ORL',
      });
    for (const { ref, ids } of priorHoldings)
      batch.update(ref, {
        entitlementIds:
          ref.id === 'PHX'
            ? ids.filter((id) => !missingFirsts.includes(id))
            : [...ids, ...missingFirsts],
      });
    await batch.commit();
  }
  const beforeStepien = await conditionalStateDigest(worldId);
  const stepien = await prepare(
    threeTeam
      ? [rightId]
      : [rightId, original('MIA', 2028), original('MIA', 2029)]
  );
  expect(stepien.status).toBe('blocked');
  expect(JSON.stringify(stepien)).toMatch(
    threeTeam ? /PHX: stepien:/i : /stepien/i
  );
  expect((await applyMixedSwap(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(beforeStepien);
  rejected.stepien = stepien;
  if (threeTeam) {
    const batch = getReviewAdminDb().batch();
    for (const id of missingFirsts)
      batch.update(root.collection('entitlements').doc(id), {
        holderTeam: 'PHX',
      });
    for (const { ref, ids } of priorHoldings)
      batch.update(ref, { entitlementIds: ids });
    await batch.commit();
    expect(await conditionalStateDigest(worldId)).toBe(pristine);
  }
  expect((await prepare([rightId, original('WAS')])).status).toBe('error');
  expect((await applyMixedSwap(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(pristine);
  await root.update({
    draftSwapProgram: { ...program, steps: [program.steps[0]] },
  });
  const incomplete = await conditionalStateDigest(worldId);
  expect((await prepare()).status).toBe('error');
  expect((await applyMixedSwap(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(incomplete);
  await root.update({ draftSwapProgram: program });
  for (const mode of ['hard-cap', 'roster']) {
    const ref = root.collection('teams').doc(threeTeam ? 'PHX' : 'WAS'),
      prior = (await ref.get()).data()!;
    const changed = structuredClone(prior);
    if (mode === 'hard-cap')
      changed.salaryBookInputs.apronAdjustments.lineItems[0].amount += 100000000;
    else {
      const twoWay = changed.players.find((p: any) => p.isTwoWay);
      changed.players.push({
        ...twoWay,
        id: 'extra-two-way',
        playerId: 'extra-two-way',
        player_id: 'extra-two-way',
      });
      changed.roster.push('extra-two-way');
    }
    changed.totals = createCanonicalTeamTotalsSnapshot(changed, 2026, {
      asOfDate: '2026-06-05',
    });
    await ref.set(changed);
    const before = await conditionalStateDigest(worldId),
      result = await prepare();
    expect(result.status === 'error' || result.legal === false).toBe(true);
    expect(JSON.stringify(result)).toMatch(
      mode === 'hard-cap'
        ? /hard cap violation/i
        : /two-way.*exceeded|two-way.*cannot exceed/i
    );
    expect((await applyMixedSwap(page)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(before);
    rejected[mode] = result;
    await ref.set(prior);
  }
  for (const target of [
    'teams/ORL',
    ...(threeTeam
      ? ['teams/PHX', 'teams/PHX/players/davion_mitchell']
      : ['teams/MIA/players/jaden_hardy']),
    `entitlements/${rightId}`,
  ]) {
    expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
    for (const mode of ['forged', 'changed']) {
      expect((await applyMixedSwap(page, mode)).success).toBe(false);
      expect(await conditionalStateDigest(worldId)).toBe(pristine);
    }
    const ref = root
      .collection(target.split('/')[0])
      .doc(target.split('/').slice(1).join('/'));
    const prior = await ref.get();
    await ref.set({
      ...(prior.data() ?? {}),
      concurrentMutation: true,
      ...(target.startsWith('entitlements/') ? { holderTeam: 'ORL' } : {}),
    });
    const changed = await conditionalStateDigest(worldId);
    expect((await applyMixedSwap(page)).success).toBe(false);
    expect(await conditionalStateDigest(worldId)).toBe(changed);
    if (prior.exists) await ref.set(prior.data()!);
    else await ref.delete();
  }
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  expect((await applyMixedSwap(page)).success).toBe(true);
  const traded = await conditionalStateDigest(worldId);
  expect((await applyMixedSwap(page)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(traded);
  const request = {
    operationId: 'mixed_swap_resolution',
    draftYear: 2026,
    expectedRevision: Number((await root.get()).data()!.draftInventoryRevision),
    positions: { WAS: 20, PHX: 5, ORL: 25 },
    elections: { [rightId]: true, [laterId]: true },
  };
  for (const invalid of [
    { ...request, elections: { [rightId]: true } },
    { ...request, expectedRevision: request.expectedRevision - 1 },
  ]) {
    expect((await conditionalDraft(page, worldId, invalid)).success).toBe(
      false
    );
    expect(await conditionalStateDigest(worldId)).toBe(traded);
  }
  const outcomes = await Promise.all([
    conditionalDraft(page, worldId, request),
    conditionalDraft(page, worldId, { ...request, operationId: 'race' }),
  ]);
  expect(outcomes.filter((r) => r.success)).toHaveLength(1);
  const resolved = await conditionalStateDigest(worldId);
  expect((await conditionalDraft(page, worldId, request)).success).toBe(false);
  expect(await conditionalStateDigest(worldId)).toBe(resolved);
  expect((await root.collection('events').get()).size).toBe(2);
  expect(await sourceState()).toEqual(sourceBefore);
  receipt('negative-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    scope: 'governed-simulation-only',
    rejected,
    incompleteProgramNoWrite: true,
    underlyingSelectionNoWrite: true,
    stalePoolParticipantNoWrite: true,
    ...(threeTeam
      ? {
          staleThirdTeamNoWrite: true,
          explicitRoutingNoWrite: true,
          threeGenuineParticipants: true,
        }
      : {}),
    staleDestinationContractNoWrite: true,
    staleRightNoWrite: true,
    forgedAuthorityNoWrite: true,
    changedPayloadNoWrite: true,
    duplicateTradeNoWrite: true,
    missingElectionNoWrite: true,
    staleResolutionNoWrite: true,
    concurrentResolutionOnce: true,
    duplicateResolutionNoWrite: true,
    sourceUnchanged: true,
  });
});
