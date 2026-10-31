import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  seedPenaltyDraftWorld,
  penaltyBaseOrder,
} from './fixtures/penaltyDraftWorld';
import { registerSoftwareSeasonEnvironment } from '@/features/architect/utils/governedSeason/softwareSeasonEnvironment';
import { conditionalState } from './helpers/conditionalDraftJourney';
import {
  readReviewUserId,
  getReviewAdminDb,
  openDashboardTab,
} from './helpers/architectReviewWorld';
import { loadSnapshot, coverage } from '../../scripts/dev/cloudData';

registerSoftwareSeasonEnvironment(() => true);
test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 20000,
  trace: 'on',
});
test.setTimeout(1800000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE,
  'Protected retained catalogue required.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ??
  'work/bze-329-placement/private/browser';
async function capture(page: Page, key: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${key}-1280x720.png`) });
}
async function room(page: Page) {
  if (new URL(page.url()).searchParams.get('room') !== 'trade')
    await page.getByRole('tab', { name: /^Trade Machine$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(
    dialog.getByRole('region', { name: 'Second-apron freeze' })
  ).toBeVisible({ timeout: 60000 });
  return dialog;
}
async function prepare(page: Page, worldId: string) {
  return page.evaluate(async (worldId) => {
    const loader =
      '/src/features/architect/utils/draftReview/conditionalWorld.ts';
    const digest =
      '/src/features/architect/utils/mutationPipeline.snapshotDigest.ts';
    const state = await (await import(loader)).loadConditionalWorld(worldId);
    return {
      operationId: `penalty_${crypto.randomUUID()}`,
      expectedRevision: state.revision,
      draftYear: 2033,
      positions: {},
      expectedDraftStateDigest: (await import(digest)).mutationSnapshotDigest(
        state.snapshots
      ),
    };
  }, worldId);
}
async function apply(
  page: Page,
  worldId: string,
  request: Awaited<ReturnType<typeof prepare>>
) {
  return page.evaluate(
    async ({ worldId, request }) => {
      const manager = '/src/features/architect/utils/seasonManager.ts';
      try {
        return {
          success: true,
          result: await (
            await import(manager)
          ).advanceConditionalDraftInWorld(worldId, request),
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    { worldId, request }
  );
}

for (const multiple of [false, true])
  test(`final placement: ${multiple ? 'multiple-transferred' : 'single'}`, async ({
    page,
  }) => {
    const mode = multiple ? 'multiple' : 'single';
    await page.goto('/gm/TOR?season=2026');
    await expect
      .poll(() => readReviewUserId(page), { timeout: 30000 })
      .not.toBe('');
    const uid = await readReviewUserId(page),
      worldId = `placement_${mode}_${Date.now()}`;
    const f = await seedPenaltyDraftWorld(uid, worldId, multiple);
    const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
    const initial = await conditionalState(worldId);
    const sourceBefore = coverage(await loadSnapshot()).sha256;
    if (process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE)
      expect(sourceBefore).toBe(
        coverage(
          JSON.parse(
            fs.readFileSync(
              process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE,
              'utf8'
            )
          )
        ).sha256
      );
    const sourceState = async () =>
      (
        await getReviewAdminDb().collection('architect_baseEntitlements').get()
      ).docs.map((d) => ({ id: d.id, data: d.data() }));
    const sources = await sourceState();
    await page.evaluate(
      ({ uid, worldId }) => {
        localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
        localStorage.setItem('hz.currentSeasonEndYear', '2026');
      },
      { uid, worldId }
    );
    await page.reload();
    await room(page);
    const early = await prepare(page, worldId);
    expect((await apply(page, worldId, early)).success).toBe(false);
    expect(await conditionalState(worldId)).toEqual(initial);
    for (let step = 1; step <= 7; step++) {
      const dialog = await room(page);
      const season = `${2025 + step}–${String(2026 + step).slice(-2)}`;
      await Promise.all([
        page.waitForEvent('load', { timeout: 180000 }),
        dialog.getByRole('button', { name: `Advance to ${season}` }).click(),
      ]);
      await expect
        .poll(async () => (await root.get()).data()?.draftApronHistory.length, {
          timeout: 120000,
        })
        .toBe(step);
      expect((await root.collection('seasonHistory').get()).size).toBe(
        30 * step
      );
      if (step === 5) {
        const before = await conditionalState(worldId);
        expect(
          (await apply(page, worldId, await prepare(page, worldId))).success
        ).toBe(false);
        expect(await conditionalState(worldId)).toEqual(before);
      }
      if (step >= 6) {
        await room(page);
        await expect(
          page.getByRole('combobox', { name: 'Viewing season' })
        ).toHaveValue(String(2026 + step));
        await capture(page, `${mode}-season-${2026 + step}`);
      }
    }
    const beforeDraft = await conditionalState(worldId);
    const stableInput = f.input;
    const failureCases = [
      [
        'incomplete-order',
        (x: typeof f.input) => {
          x.ordering = 'incomplete';
        },
      ],
      [
        'membership',
        (x: typeof f.input) => {
          x.penalizedPickIds = [];
        },
      ],
      [
        'conflicting-claim',
        (x: typeof f.input) => {
          x.selections[0].claimEntitlementIds.push('competing');
        },
      ],
      [
        'missing-right-coverage',
        (x: typeof f.input) => {
          x.reviewedRightIds.pop();
        },
      ],
      [
        'wrong-owner',
        (x: typeof f.input) => {
          x.selections[0].holderTeam = 'BOS';
        },
      ],
      ...(multiple
        ? [
            [
              'tie',
              (x: typeof f.input) => {
                x.selections[1].originalTeamWinningPercentage = '0.6000';
              },
            ],
          ]
        : []),
    ] as Array<[string, (input: typeof f.input) => void]>;
    const negatives: string[] = [];
    for (const [name, mutate] of failureCases) {
      const changed = structuredClone(stableInput);
      mutate(changed);
      await root.update({ draftPenaltyInput: changed });
      const snapshot = await conditionalState(worldId);
      const result = await apply(page, worldId, await prepare(page, worldId));
      expect(result.success, `${name}: ${JSON.stringify(result)}`).toBe(false);
      expect(await conditionalState(worldId)).toEqual(snapshot);
      negatives.push(name);
      await root.update({ draftPenaltyInput: stableInput });
    }
    const staleRequest = await prepare(page, worldId);
    await root.update({
      'draftPenaltyInput.evidenceReference': 'changed-software-input',
    });
    const stale = await conditionalState(worldId);
    expect((await apply(page, worldId, staleRequest)).success).toBe(false);
    expect(await conditionalState(worldId)).toEqual(stale);
    await root.update({ draftPenaltyInput: stableInput });
    await page.reload();
    const dialog = await room(page);
    await expect(
      dialog.getByRole('button', { name: 'Save final 2033 draft positions' })
    ).toBeEnabled();
    await Promise.all([
      page.waitForEvent('load', { timeout: 180000 }),
      dialog
        .getByRole('button', { name: 'Save final 2033 draft positions' })
        .click(),
    ]);
    await room(page);
    await expect(page.getByTestId('penalty-draft-order')).toContainText(
      'Saved 2033'
    );
    await capture(page, `${mode}-final-order`);
    const final = await conditionalState(worldId);
    const receipt = final.metadata!.draftPenaltyReceipt;
    // Independent oracle: one penalty removes slot 1; three remove slots 1–3.
    const expectedTeams = multiple
      ? [...penaltyBaseOrder.slice(3), 'MIA', 'BOS', 'TOR']
      : [...penaltyBaseOrder.slice(1), 'TOR'];
    expect(
      receipt.positions.map((r: { originalTeam: string }) => r.originalTeam)
    ).toEqual(expectedTeams);
    expect(
      receipt.positions.map((r: { position: number }) => r.position)
    ).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(final.metadata!.asOfDate).toBe('2033-06-23');
    expect(final.metadata!.draftInventoryRevision).toBe(
      beforeDraft.metadata!.draftInventoryRevision + 1
    );
    const ids = (s: typeof final) =>
      s.children.find((c) => c.name === 'entitlements')!.docs;
    expect(ids(final)).toEqual(ids(initial));
    expect(ids(final)).toHaveLength(278);
    expect(final.metadata!.draftSimulationUnresolved).toEqual(
      initial.metadata!.draftSimulationUnresolved
    );
    expect(final.metadata!.draftSimulationUnresolved).toHaveLength(29);
    expect(final.children.find((c) => c.name === 'teams')!.docs).toEqual(
      beforeDraft.children.find((c) => c.name === 'teams')!.docs
    );
    expect(
      (await apply(page, worldId, await prepare(page, worldId))).success
    ).toBe(false);
    expect(await conditionalState(worldId)).toEqual(final);

    // Every original/holding team sees the same saved positions after full navigation/reload.
    for (const team of [...penaltyBaseOrder].sort()) {
      await page.goto(`/gm/${team}?season=2033`);
      const relevant = receipt.positions.filter(
        (r: { originalTeam: string; holderTeam: string }) =>
          r.originalTeam === team || r.holderTeam === team
      );
      const own = relevant.find(
        (r: { originalTeam: string }) => r.originalTeam === team
      );
      await openDashboardTab(page, 'Team History');
      const timeline = page.getByTestId('team-history-section-timeline');
      await timeline
        .getByRole('button')
        .filter({ hasText: /final first-round positions/i })
        .first()
        .click();
      const detail = page.getByTestId('team-history-detail-sections');
      for (const p of relevant)
        await expect(detail).toContainText(
          `${p.originalTeam} 2033 first: pick ${p.beforePosition} → ${p.position} · held by ${p.holderTeam}`
        );
      await capture(page, `${mode}-${team}-history`);
      await page.getByTestId('team-history-detail-close').click();
      await openDashboardTab(page, 'Compare');
      await expect(
        page.getByText(
          `${team} 2033 first: pick ${own.beforePosition} → ${own.position} · held by ${own.holderTeam}${own.penalized ? ' · draft-pick penalty' : ''}`,
          { exact: true }
        )
      ).toBeVisible();
      await capture(page, `${mode}-${team}-compare`);
      const expand = page.getByRole('button', { name: 'Expand activity rail' });
      if (await expand.isVisible()) await expand.click();
      await page.getByTestId('cockpit-activity-rail-assets-open').click();
      const assets = page.getByTestId('cockpit-assets-panel-picks-2033-first');
      for (const p of relevant.filter(
        (r: { holderTeam: string }) => r.holderTeam === team
      ))
        await expect(assets).toContainText(`Final pick ${p.position}`);
      await capture(page, `${mode}-${team}-assets`);
    }
    expect(await sourceState()).toEqual(sources);
    expect(coverage(await loadSnapshot()).sha256).toBe(sourceBefore);
    expect(await conditionalState(worldId)).toEqual(final);
    const hash = (x: unknown) =>
      createHash('sha256').update(JSON.stringify(x)).digest('hex');
    fs.writeFileSync(
      path.join(proofDir, `${mode}-proof.json`),
      JSON.stringify(
        {
          candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
          worldId,
          softwareOnly: true,
          expectedTeams,
          receipt,
          negatives: [
            ...negatives,
            'premature-before-transition',
            'premature-at-2030-31',
            'stale-input',
            'duplicate',
          ],
          originalInventorySha256: hash(ids(initial)),
          finalInventorySha256: hash(ids(final)),
          originalUnresolvedSha256: hash(
            initial.metadata!.draftSimulationUnresolved
          ),
          finalUnresolvedSha256: hash(
            final.metadata!.draftSimulationUnresolved
          ),
          sourceBefore,
          allTeamsReloaded: [...penaltyBaseOrder].sort(),
        },
        null,
        2
      )
    );
    const cases = ['single', 'multiple'].flatMap((name) => {
      const file = path.join(proofDir, `${name}-proof.json`);
      return fs.existsSync(file)
        ? [JSON.parse(fs.readFileSync(file, 'utf8'))]
        : [];
    });
    fs.writeFileSync(
      path.join(proofDir, 'proof.json'),
      JSON.stringify(
        {
          candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
          scope: 'governed-simulation-only',
          packageSha256: createHash('sha256')
            .update(
              fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!)
            )
            .digest('hex'),
          cases,
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(proofDir, 'negative-proof.json'),
      JSON.stringify(
        {
          candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
          cases: cases.map((c) => ({
            worldId: c.worldId,
            negatives: c.negatives,
          })),
        },
        null,
        2
      )
    );
  });
