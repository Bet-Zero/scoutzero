/**
 * V1 item D3: worlds created before the SIMULATION switch are not migrated
 * and still open (local emulator only).
 *
 * Two runs against the same saved emulator state:
 * 1. `SCOUTZERO_UNMIGRATED_PHASE=create` on cloud:dev WITHOUT the SIMULATION
 *    packages: an ordinary world is created and its state, books and Trade
 *    Machine verdict are recorded.
 * 2. Stop cloud:dev (SIGTERM saves state), restart it WITH the packages, then
 *    `SCOUTZERO_UNMIGRATED_PHASE=reopen`: the same world must open with the
 *    same documents, books and verdict, carry no SIMULATION fields, and save
 *    normally, while a new world is created as SIMULATION.
 */
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  readReviewUserId,
  getReviewAdminDb,
  getWorldTeamDocument,
} from './helpers/architectReviewWorld';
import { createCanonicalTeamTotalsSnapshot } from '../../src/features/architect/utils/capTotals/computeTeamCapTotals';
import { mutationSnapshotText } from '../../src/features/architect/utils/mutationPipeline.snapshotDigest';

const PHASE = process.env.SCOUTZERO_UNMIGRATED_PHASE;
test.skip(
  PHASE !== 'create' && PHASE !== 'reopen',
  'Opt in with SCOUTZERO_UNMIGRATED_PHASE=create, then =reopen after restarting cloud:dev with the SIMULATION packages.'
);
test.use({ viewport: { width: 1280, height: 720 } });
const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(300000);

const STATE_FILE =
  process.env.SCOUTZERO_UNMIGRATED_STATE ??
  path.join(os.tmpdir(), 'scoutzero-unmigrated-world.json');
const TEAMS = ['CHI', 'CHA'] as const;
const PLAYERS = { CHI: 'TRE JONES', CHA: 'TRE MANN' } as const;
const NAMES = { CHI: 'Chicago Bulls', CHA: 'Charlotte Hornets' } as const;
const OTHER = { CHI: 'CHA', CHA: 'CHI' } as const;
const SIMULATION_FIELDS = [
  'simulationFinancialBaseline',
  'draftBaseline',
  'draftInventoryRevision',
  'draftWorldTransfers',
] as const;

type Recorded = {
  worldId: string;
  worldName: string;
  teams: Record<string, string>;
  totals: Record<string, string>;
  verdict: string;
  pickCount: Record<string, number>;
};

async function signIn(page: Page) {
  await page.goto('/gm/CHI?season=2026', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  return readReviewUserId(page);
}

async function createWorld(page: Page, uid: string, name: string) {
  return page.evaluate(
    async ({ uid, name }) => {
      const { createWorld } = await import(
        '/src/features/architect/utils/worldManager.ts'
      );
      const { worldId, metadata } = await createWorld({
        userId: uid,
        name,
        currentSeason: '2025-26',
      });
      return {
        worldId: worldId as string,
        metadata: JSON.parse(JSON.stringify(metadata)) as Record<
          string,
          unknown
        >,
      };
    },
    { uid, name }
  );
}

async function activate(page: Page, uid: string, worldId: string) {
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2026');
    },
    { uid, worldId }
  );
  await page.goto('/gm/CHI?season=2026', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cockpit-activity-rail-identity')).toBeVisible({
    timeout: 60000,
  });
}

/** The Trade Machine readiness verdict for Tre Jones for Tre Mann, without applying. */
async function readVerdict(page: Page) {
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption('hornets');
  for (const code of TEAMS) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await expect(card).toBeVisible({ timeout: 60000 });
    await card
      .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
      .click();
    const row = card
      .getByAltText(new RegExp(`^${PLAYERS[code]}$`, 'i'))
      .first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]');
    await row.getByRole('button', { name: '•••' }).click();
    await page
      .getByRole('button', {
        name: new RegExp(`^Trade to ${NAMES[OTHER[code]]}$`, 'i'),
      })
      .click();
  }
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  const strip = dialog.getByTestId('trade-readiness-summary');
  // Whatever the verdict (in an older world Validate may leave it unchanged
  // until a salary path is chosen), it must read the same in both phases.
  await expect(strip).toBeVisible();
  await expect(strip).not.toContainText(/Validating/i, { timeout: 60000 });
  await page.waitForTimeout(5000);
  return (await strip.innerText()).replace(/\s+/g, ' ').trim();
}

async function record(worldId: string, page: Page): Promise<Recorded> {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const teams: Record<string, string> = {};
  const totals: Record<string, string> = {};
  const pickCount: Record<string, number> = {};
  for (const code of TEAMS) {
    const team = (await getWorldTeamDocument(worldId, code))!;
    teams[code] = mutationSnapshotText(team);
    totals[code] = JSON.stringify(
      createCanonicalTeamTotalsSnapshot(team, 2026, {
        asOfDate: String((await root.get()).data()?.asOfDate ?? ''),
      })
    );
    pickCount[code] = (
      await root
        .collection('entitlements')
        .where('holderTeam', '==', code)
        .get()
    ).size;
  }
  return {
    worldId,
    worldName: String((await root.get()).data()?.worldName),
    teams,
    totals,
    verdict: await readVerdict(page),
    pickCount,
  };
}

test('a world created before the SIMULATION switch is left as it was', async ({
  page,
}) => {
  const uid = await signIn(page);
  if (PHASE === 'create') {
    const { worldId, metadata } = await createWorld(
      page,
      uid,
      'Created before the switch'
    );
    for (const field of SIMULATION_FIELDS)
      expect(metadata[field], field).toBeUndefined();
    await activate(page, uid, worldId);
    await expect(
      page.getByTestId('cockpit-activity-rail-identity')
    ).not.toContainText('SIMULATION');
    const recorded = await record(worldId, page);
    await writeFile(STATE_FILE, JSON.stringify(recorded), { mode: 0o600 });
    return;
  }

  const before = JSON.parse(await readFile(STATE_FILE, 'utf8')) as Recorded;
  const root = getReviewAdminDb().doc(`architect_worlds/${before.worldId}`);

  // The switch is on: a new world is SIMULATION.
  const fresh = await createWorld(page, uid, 'Created after the switch');
  expect(
    (fresh.metadata.simulationFinancialBaseline as { classification?: string })
      ?.classification
  ).toBe('SIMULATION');
  expect(
    (fresh.metadata.draftBaseline as { classification?: string })
      ?.classification
  ).toBe('simulation');

  // D4: the new world shows its named assumptions as visible text.
  await activate(page, uid, fresh.worldId);
  const toggle = page.getByTestId('simulation-assumptions-toggle');
  await expect(toggle).toContainText(/SIMULATION · \d+ named assumptions/);
  await toggle.click();
  const list = page.getByTestId('simulation-assumptions-list');
  await expect(list).toContainText('Trade deadline.');
  await expect(list).toContainText('Unknown bonuses.');
  await expect(list).toContainText('Which picks can be traded.');

  // The old world was not migrated and reads the same.
  const metadata = (await root.get()).data()!;
  for (const field of SIMULATION_FIELDS)
    expect(metadata[field], field).toBeUndefined();
  expect(metadata.worldName).toBe(before.worldName);
  expect(
    (await root.collection('draftBaselines').get()).size,
    'no draft source was added'
  ).toBe(0);
  await activate(page, uid, before.worldId);
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).not.toContainText('SIMULATION');
  await expect(page.getByTestId('simulation-assumptions')).toHaveCount(0);
  const after = await record(before.worldId, page);
  expect(after).toEqual(before);
});
