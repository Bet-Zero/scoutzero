/** Chromium/emulator acceptance for BZE-274 governed contract baselines. */

import { expect, test } from '@playwright/test';
import {
  MIA_SEASON_ADVANCE_URL,
  enableArchitectReviewFlags,
  getReviewAdminDb,
  readReviewUserId,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

const RELEASE_ID = 'salaryswish-retained-2026-06-05';
const RELEASE_DIGEST =
  'sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950';

type RecordLike = Record<string, unknown>;

const baselineDocuments = async (worldId: string) =>
  getReviewAdminDb()
    .collection(`architect_worlds/${worldId}/contractBaselines`)
    .get()
    .then((snapshot) =>
      snapshot.docs
        .map((entry) => ({ id: entry.id, ...(entry.data() as RecordLike) }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );

const ledgersFrom = (documents: RecordLike[]) =>
  documents.flatMap((document) =>
    Array.isArray(document.ledgers) ? (document.ledgers as RecordLike[]) : []
  );

const resultingState = (ledger: RecordLike) => {
  const events = Array.isArray(ledger.events)
    ? (ledger.events as RecordLike[])
    : [];
  return events[0]?.resultingState as RecordLike | undefined;
};

const openWorldMenu = async (page: import('@playwright/test').Page) => {
  const trigger = page.getByTestId('cockpit-world-menu-trigger');
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }
  await expect(page.getByTestId('cockpit-world-menu-popover')).toBeVisible();
};

test.describe('BZE-274 governed contract baseline browser acceptance', () => {
  test('creates, reloads, branches, and rejects old worlds without inventing history', async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    await enableArchitectReviewFlags(page);
    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);

    await expect
      .poll(() => readReviewUserId(page), { timeout: 25_000 })
      .not.toBe('');
    const userId = await readReviewUserId(page);
    const db = getReviewAdminDb();
    page.on('dialog', (dialog) => void dialog.accept());
    const oldWorldId = `bze-274-old-${Date.now()}`;
    await db.doc(`architect_worlds/${oldWorldId}`).set({
      worldId: oldWorldId,
      worldName: 'Pre-ledger contract world',
      createdBy: userId,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      lastModifiedAt: new Date('2026-06-01T00:00:00Z'),
      currentSeason: '2025-26',
      baselineSeason: '2025-26',
      parentWorldId: null,
      childWorlds: [],
      modifiedTeams: [],
      actionCount: 0,
      tags: [],
      isArchived: false,
      isFavorite: false,
      rightsLedgerVersion: 1,
    });
    const oldWorldBefore = await db
      .doc(`architect_worlds/${oldWorldId}`)
      .get()
      .then((snapshot) => snapshot.data());

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await openWorldMenu(page);
    const worldSelect = page.getByLabel('Saved World');
    await expect(worldSelect).toBeVisible();
    await expect(
      worldSelect.getByRole('option', {
        name: 'Pre-ledger contract world (recreate required)',
      })
    ).toBeAttached();
    await worldSelect.selectOption(oldWorldId);
    await expect(
      page.getByText(/predates governed baseline contracts/i)
    ).toBeVisible();
    await expect(worldSelect).toHaveValue('');

    const worldName = `BZE-274 Governed Baseline ${Date.now()}`;
    await page.getByRole('button', { name: '+ New' }).click();
    await page.getByLabel('World Name').fill(worldName);
    await page
      .getByLabel('Description (optional)')
      .fill('Fresh immutable source-establishment proof');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByTestId('cockpit-world-menu-trigger')).toContainText(
      worldName,
      { timeout: 120_000 }
    );
    await openWorldMenu(page);
    await expect(page.getByTestId('contract-baseline-status')).toContainText(
      '772 verified · 2 need source details · release 1',
      { timeout: 120_000 }
    );
    const parentWorldId = await worldSelect.inputValue();
    expect(parentWorldId).toMatch(/^world_/);

    const parentMetadata = (await db
      .doc(`architect_worlds/${parentWorldId}`)
      .get()
      .then((snapshot) => snapshot.data())) as RecordLike;
    expect(parentMetadata).toMatchObject({
      contractBaselineVersion: 2,
      contractSourceRelease: {
        releaseId: RELEASE_ID,
        releaseVersion: 1,
        releaseDigest: RELEASE_DIGEST,
      },
      contractBaselineCoverage: { total: 774, complete: 772, needsInput: 2 },
      contractBaselineSalaryCapYear: 2026,
      contractBaselineEffectiveAt: '2026-06-05T12:19:56.526Z',
      asOfDate: '2026-06-05',
    });

    const parentDocuments = await baselineDocuments(parentWorldId);
    const parentLedgers = ledgersFrom(parentDocuments);
    expect(parentDocuments.length + 1).toBeLessThan(500);
    expect(parentLedgers).toHaveLength(774);
    expect(
      Math.max(
        ...parentDocuments.map((document) =>
          Buffer.byteLength(JSON.stringify(document), 'utf8')
        )
      )
    ).toBeLessThan(1_000_000);

    const completeStates = parentLedgers
      .map(resultingState)
      .filter(
        (state) =>
          state?.completeness &&
          (state.completeness as RecordLike).status === 'complete'
      );
    const needsInputStates = parentLedgers
      .map(resultingState)
      .filter(
        (state) =>
          state?.completeness &&
          (state.completeness as RecordLike).status === 'needs-input'
      );
    expect(completeStates).toHaveLength(772);
    expect(needsInputStates).toHaveLength(2);
    expect(needsInputStates.map((state) => state?.contractId).sort()).toEqual([
      'salaryswish:id-1630599:unknown:2025-26:2025-26:veteran-contract',
      'salaryswish:yang-hansen:unknown:2025-26:2025-26:veteran-contract',
    ]);
    expect((needsInputStates[0]?.completeness as RecordLike).reasons).toEqual(
      expect.arrayContaining([
        'Missing a replayable salary schedule.',
        'Missing a source-supported signing date.',
      ])
    );
    expect(completeStates[0]).toMatchObject({
      establishmentKind: 'source-establishment',
      contractVersion: 1,
      source: {
        releaseId: RELEASE_ID,
        releaseVersion: 1,
        releaseDigest: RELEASE_DIGEST,
      },
    });

    const beforeReload = JSON.stringify(parentDocuments);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await openWorldMenu(page);
    await expect(page.getByTestId('contract-baseline-status')).toContainText(
      '772 verified · 2 need source details · release 1'
    );
    expect(await worldSelect.inputValue()).toBe(parentWorldId);
    expect(JSON.stringify(await baselineDocuments(parentWorldId))).toBe(
      beforeReload
    );

    await page.getByTitle('World actions').click();
    await page.getByRole('button', { name: 'Branch', exact: true }).click();
    await page.getByLabel('Branch Name').fill(`${worldName} Branch`);
    await page.getByRole('button', { name: 'Branch', exact: true }).click();
    await expect(page.getByTestId('cockpit-world-menu-trigger')).toContainText(
      `${worldName} Branch`,
      { timeout: 120_000 }
    );
    await openWorldMenu(page);
    await expect(page.getByTestId('contract-baseline-status')).toContainText(
      '772 verified · 2 need source details · release 1',
      { timeout: 120_000 }
    );
    const childWorldId = await worldSelect.inputValue();
    expect(childWorldId).not.toBe(parentWorldId);

    const childMetadata = (await db
      .doc(`architect_worlds/${childWorldId}`)
      .get()
      .then((snapshot) => snapshot.data())) as RecordLike;
    expect(childMetadata.contractSourceRelease).toEqual(
      parentMetadata.contractSourceRelease
    );
    const childDocuments = await baselineDocuments(childWorldId);
    const childLedgers = ledgersFrom(childDocuments);
    expect(childLedgers).toHaveLength(774);
    expect(
      childLedgers.map(resultingState).map((state) => state?.stateDigest)
    ).toEqual(
      parentLedgers.map(resultingState).map((state) => state?.stateDigest)
    );
    expect(
      childLedgers.map(resultingState).map((state) => JSON.stringify(state))
    ).toEqual(
      parentLedgers.map(resultingState).map((state) => JSON.stringify(state))
    );

    const oldWorld = await db.doc(`architect_worlds/${oldWorldId}`).get();
    expect(oldWorld.data()).toEqual(oldWorldBefore);
    expect(oldWorld.data()?.contractBaselineVersion).toBeUndefined();
    expect(await baselineDocuments(oldWorldId)).toEqual([]);

    testInfo.annotations.push({
      type: 'audit-note',
      description: `BZE-274 browser proof: fresh world ${parentWorldId} pinned ${RELEASE_ID}@v1, persisted ${parentDocuments.length} safe shards / 774 roots / 772 complete / 2 needs-input, survived reload byte-for-byte, and branch ${childWorldId} preserved every state digest and evidence envelope. The pre-ledger world remained unchanged and visibly required recreation.`,
    });
  });
});
