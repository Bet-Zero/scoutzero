/** Chromium/emulator acceptance for BZE-274 governed contract baselines. */

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import {
  MIA_SEASON_ADVANCE_URL,
  enableArchitectReviewFlags,
  getReviewAdminDb,
  readReviewIdToken,
  readReviewUserId,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

const RELEASE_ID = 'salaryswish-retained-2026-06-05';
const RELEASE_DIGEST =
  'sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950';
const REVIEW_FUNCTIONS_BASE_URL =
  'http://127.0.0.1:5001/demo-architect-review/us-central1';

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

const openWorldMenu = async (page: Page) => {
  const trigger = page.getByTestId('cockpit-world-menu-trigger');
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }
  await expect(page.getByTestId('cockpit-world-menu-popover')).toBeVisible();
};

const callReviewFunction = async (
  request: APIRequestContext,
  functionName: string,
  idToken: string,
  data: RecordLike
) => {
  const response = await request.post(
    `${REVIEW_FUNCTIONS_BASE_URL}/${functionName}`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { data },
    }
  );
  return {
    status: response.status(),
    body: (await response.json()) as RecordLike,
  };
};

test.describe('BZE-274 governed contract baseline browser acceptance', () => {
  test('creates, reloads, branches, and rejects old worlds without inventing history', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(240_000);
    await enableArchitectReviewFlags(page);
    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);

    await expect
      .poll(() => readReviewUserId(page), { timeout: 25_000 })
      .not.toBe('');
    const userId = await readReviewUserId(page);
    const idToken = await readReviewIdToken(page);
    expect(idToken).not.toBe('');
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

    for (const invalidSeason of ['2030-31', '1999-00']) {
      const invalidWorldId = `bze-274-invalid-${invalidSeason}-${Date.now()}`;
      const invalidResult = await callReviewFunction(
        request,
        'initializeArchitectWorld',
        idToken,
        {
          worldId: invalidWorldId,
          worldName: `Invalid ${invalidSeason}`,
          description: '',
          userId,
          currentSeason: invalidSeason,
          parentWorldId: null,
        }
      );
      expect(invalidResult.status).toBe(400);
      expect(JSON.stringify(invalidResult.body)).toContain(
        'currentSeason must match governed release season 2025-26'
      );
      expect(
        (await db.doc(`architect_worlds/${invalidWorldId}`).get()).exists
      ).toBe(false);
    }

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
      '774 baseline contracts · 2 need source details · release 1',
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
      '774 baseline contracts · 2 need source details · release 1'
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
      '774 baseline contracts · 2 need source details · release 1',
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
    expect(childDocuments).toHaveLength(33);

    const finalizedChildBeforeCleanup = childMetadata;
    const finalizedShardsBeforeCleanup = childDocuments;
    const parentLineageBeforeCleanup = (
      await db.doc(`architect_worlds/${parentWorldId}`).get()
    ).data();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const refusedCleanup = await callReviewFunction(
        request,
        'purgeArchitectWorld',
        idToken,
        {
          worldId: childWorldId,
          cleanupPartialBranch: true,
          expectedParentWorldId: parentWorldId,
        }
      );
      expect(refusedCleanup).toMatchObject({
        status: 200,
        body: {
          result: {
            ok: false,
            queued: false,
            cleanupRefused: true,
            details: {
              worldDeleted: false,
              cleanupState: 'refused',
              cleanupRefusalReason: 'child-is-visible',
            },
          },
        },
      });
    }
    expect(
      (await db.doc(`architect_worlds/${childWorldId}`).get()).data()
    ).toEqual(finalizedChildBeforeCleanup);
    expect(await baselineDocuments(childWorldId)).toEqual(
      finalizedShardsBeforeCleanup
    );
    expect(
      (await db.doc(`architect_worlds/${parentWorldId}`).get()).data()
    ).toEqual(parentLineageBeforeCleanup);

    const simulatedV2WorldId = `bze-274-simulated-v2-${Date.now()}`;
    const simulatedV2Metadata = {
      worldId: simulatedV2WorldId,
      worldName: 'Simulated later-release world',
      createdBy: userId,
      createdAt: new Date('2027-06-05T12:19:56.526Z'),
      lastModifiedAt: new Date('2027-06-05T12:19:56.526Z'),
      currentSeason: '2026-27',
      baselineSeason: '2026-27',
      parentWorldId: null,
      childWorlds: [],
      modifiedTeams: [],
      actionCount: 0,
      tags: [],
      isArchived: false,
      isFavorite: false,
      rightsLedgerVersion: 1,
      asOfDate: '2027-06-05',
      contractBaselineVersion: 2,
      contractSourceRelease: {
        releaseId: RELEASE_ID,
        releaseVersion: 2,
        releaseDigest: `sha256:${'b'.repeat(64)}`,
      },
      contractBaselineEffectiveAt: '2027-06-05T12:19:56.526Z',
      contractBaselineSalaryCapYear: 2027,
      contractBaselineCoverage: { total: 774, complete: 772, needsInput: 2 },
    };
    await db
      .doc(`architect_worlds/${simulatedV2WorldId}`)
      .set(simulatedV2Metadata);
    const versionOneBeforeIsolation = JSON.stringify(
      await db
        .doc(`architect_worlds/${parentWorldId}`)
        .get()
        .then((doc) => doc.data())
    );
    const versionTwoBeforeIsolation = JSON.stringify(
      await db
        .doc(`architect_worlds/${simulatedV2WorldId}`)
        .get()
        .then((doc) => doc.data())
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await openWorldMenu(page);
    await worldSelect.selectOption(simulatedV2WorldId);
    await openWorldMenu(page);
    await expect(page.getByTestId('contract-baseline-status')).toContainText(
      '774 baseline contracts · 2 need source details · release 2'
    );
    await worldSelect.selectOption(parentWorldId);
    await openWorldMenu(page);
    await expect(page.getByTestId('contract-baseline-status')).toContainText(
      '774 baseline contracts · 2 need source details · release 1'
    );
    expect(
      JSON.stringify(
        await db
          .doc(`architect_worlds/${parentWorldId}`)
          .get()
          .then((doc) => doc.data())
      )
    ).toBe(versionOneBeforeIsolation);
    expect(
      JSON.stringify(
        await db
          .doc(`architect_worlds/${simulatedV2WorldId}`)
          .get()
          .then((doc) => doc.data())
      )
    ).toBe(versionTwoBeforeIsolation);

    const oldWorld = await db.doc(`architect_worlds/${oldWorldId}`).get();
    expect(oldWorld.data()).toEqual(oldWorldBefore);
    expect(oldWorld.data()?.contractBaselineVersion).toBeUndefined();
    expect(await baselineDocuments(oldWorldId)).toEqual([]);

    testInfo.annotations.push({
      type: 'audit-note',
      description: `BZE-274 browser proof: fresh world ${parentWorldId} pinned ${RELEASE_ID}@v1, persisted ${parentDocuments.length} safe shards / 774 roots / 772 complete / 2 needs-input, survived reload byte-for-byte, and branch ${childWorldId} preserved every state digest and evidence envelope. Two partial-cleanup attempts refused the finalized child and preserved its metadata, all 33 shards, and parent lineage. Future and past season mismatches failed before writes, simulated v2 selection did not mutate either release-pinned world, and the pre-ledger world remained unchanged and visibly required recreation.`,
    });
  });

  test('keeps a partial branch hidden and supports idempotent cleanup retry', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(240_000);
    await enableArchitectReviewFlags(page);
    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await expect
      .poll(() => readReviewUserId(page), { timeout: 25_000 })
      .not.toBe('');
    const userId = await readReviewUserId(page);
    const idToken = await readReviewIdToken(page);
    expect(idToken).not.toBe('');
    const db = getReviewAdminDb();
    page.on('dialog', (dialog) => void dialog.accept());

    const worldName = `BZE-274 Cleanup Parent ${Date.now()}`;
    await openWorldMenu(page);
    await page.getByRole('button', { name: '+ New' }).click();
    await page.getByLabel('World Name').fill(worldName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByTestId('cockpit-world-menu-trigger')).toContainText(
      worldName,
      { timeout: 120_000 }
    );
    await openWorldMenu(page);
    const parentWorldId = await page.getByLabel('Saved World').inputValue();
    expect(parentWorldId).toMatch(/^world_/);
    const parentMetadata = await db
      .doc(`architect_worlds/${parentWorldId}`)
      .get()
      .then((snapshot) => snapshot.data());
    const parentBaseline = await db
      .collection(`architect_worlds/${parentWorldId}/contractBaselines`)
      .limit(1)
      .get();
    expect(parentMetadata).toBeDefined();
    expect(parentBaseline.docs).toHaveLength(1);

    const partialChildId = `bze-274-partial-${Date.now()}`;
    const nonChildId = `bze-274-non-child-${Date.now()}`;
    await db.doc(`architect_worlds/${partialChildId}`).set({
      ...parentMetadata,
      worldId: partialChildId,
      worldName: `${worldName} Partial`,
      createdBy: userId,
      parentWorldId,
      branchedFrom: new Date('2026-08-11T00:00:00.000Z'),
      isArchived: true,
      childWorlds: [],
    });
    await db
      .doc(
        `architect_worlds/${partialChildId}/contractBaselines/${parentBaseline.docs[0].id}`
      )
      .set(parentBaseline.docs[0].data());
    await db.doc(`architect_worlds/${nonChildId}`).set({
      ...parentMetadata,
      worldId: nonChildId,
      worldName: `${worldName} Archived Non-Child`,
      createdBy: userId,
      parentWorldId: null,
      branchedFrom: null,
      isArchived: true,
      childWorlds: [],
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await openWorldMenu(page);
    expect(
      await page
        .getByLabel('Saved World')
        .locator(`option[value="${partialChildId}"]`)
        .count()
    ).toBe(0);

    const parentBeforeRefusals = (
      await db.doc(`architect_worlds/${parentWorldId}`).get()
    ).data();
    for (const refusedRequest of [
      {
        worldId: partialChildId,
        cleanupPartialBranch: true,
        expectedParentWorldId: `${parentWorldId}-wrong`,
      },
      {
        worldId: nonChildId,
        cleanupPartialBranch: true,
        expectedParentWorldId: parentWorldId,
      },
    ]) {
      const refusal = await callReviewFunction(
        request,
        'purgeArchitectWorld',
        idToken,
        refusedRequest
      );
      expect(refusal).toMatchObject({
        status: 200,
        body: {
          result: {
            ok: false,
            queued: false,
            cleanupRefused: true,
            details: {
              worldDeleted: false,
              cleanupState: 'refused',
              cleanupRefusalReason: 'child-not-branch',
            },
          },
        },
      });
    }
    expect(
      (await db.doc(`architect_worlds/${partialChildId}`).get()).exists
    ).toBe(true);
    expect((await db.doc(`architect_worlds/${nonChildId}`).get()).exists).toBe(
      true
    );
    expect(
      (await db.doc(`architect_worlds/${parentWorldId}`).get()).data()
    ).toEqual(parentBeforeRefusals);

    const firstRetry = await callReviewFunction(
      request,
      'purgeArchitectWorld',
      idToken,
      {
        worldId: partialChildId,
        cleanupPartialBranch: true,
        expectedParentWorldId: parentWorldId,
      }
    );
    expect(firstRetry).toMatchObject({
      status: 200,
      body: { result: { ok: true, queued: false } },
    });
    const secondRetry = await callReviewFunction(
      request,
      'purgeArchitectWorld',
      idToken,
      {
        worldId: partialChildId,
        cleanupPartialBranch: true,
        expectedParentWorldId: parentWorldId,
      }
    );
    expect(secondRetry).toMatchObject({
      status: 200,
      body: {
        result: {
          ok: true,
          queued: false,
          details: { alreadyAbsent: true },
        },
      },
    });
    expect(
      (await db.doc(`architect_worlds/${partialChildId}`).get()).exists
    ).toBe(false);
    expect(
      (
        await db
          .collection(`architect_worlds/${partialChildId}/contractBaselines`)
          .get()
      ).empty
    ).toBe(true);
    await db.doc(`architect_worlds/${nonChildId}`).delete();

    testInfo.annotations.push({
      type: 'audit-note',
      description: `BZE-274 browser cleanup proof: mismatched-parent and archived non-child cleanup attempts returned structured refusals without changing parent lineage. Recoverable partial child ${partialChildId} stayed archived and absent from the selector, its governed baseline shard was removed by cleanup retry, and a second retry completed idempotently. Focused world-manager failure injection separately proves that a queued purge preserves both the original branch failure and cleanup result.`,
    });
  });
});
