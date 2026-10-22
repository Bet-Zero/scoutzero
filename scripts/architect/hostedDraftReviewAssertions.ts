import type { Page } from 'playwright';

// Only this closed vocabulary crosses the public log boundary. Never copy an
// exception message, UI text, response body, token, URL or identity claim.
const codes = [
  'UNEXPECTED_HOSTED_FAILURE',
  'CANDIDATE_REQUIRED',
  'REPOSITORY_REQUIRED',
  'IDENTITY_ENDPOINT_REQUIRED',
  'IDENTITY_UNAVAILABLE',
  'IDENTITY_INVALID',
  'FRESH_ACCOUNT_REQUIRED',
  'PREVIEW_AUTHENTICATION_REQUIRED',
  'HOSTED_RELEASE_UNAVAILABLE',
  'FIREBASE_SESSION_REQUIRED',
  'PRIVATE_CACHE_REQUIRED',
  'RELEASE_DIGEST_MISMATCH',
  'INVENTORY_MISMATCH',
  'REVIEW_RENDER_TIMEOUT',
  'APPLY_SAFEGUARD_REQUIRED',
  'REVIEW_ROWS_REQUIRED',
  'QUALIFIED_PICK_REQUIRED',
  'QUALIFIED_PICK_ROW_COUNT_MISMATCH',
  'QUALIFIED_PICK_LABEL_MISMATCH',
  'QUALIFIED_PICK_OWNERSHIP_NOT_SUPPORTED',
  'WORLD_DATE_GUARD_REQUIRED',
  'HISTORICAL_INSPECTION_UNAVAILABLE',
  'HISTORICAL_SCOPE_DISCLOSURE_REQUIRED',
  'WORLD_REVIEW_RESET_FAILED',
  'APP_AUTHENTICATION_NOT_ENFORCED',
  'APP_AUTHENTICATION_PROBE_FAILED',
  'SELECTION_CANCEL_FAILED',
  'STALE_REVIEW_AFTER_CANCEL',
  'DESTINATION_RESTAGE_FAILED',
  'UNAVAILABLE_REVIEW_NOT_RENDERED',
  'FAILURE_APPLY_SAFEGUARD_REQUIRED',
  'RELOAD_FAILED',
  'STALE_REVIEW_AFTER_RELOAD',
  'UNEXPECTED_NETWORK_OPERATION',
  'TEMPORARY_AUTH_CAPTURE_FAILED',
  'TEMPORARY_AUTH_CLEANUP_FAILED',
] as const;
export type HostedFailureCode = (typeof codes)[number];
class HostedProofFailure extends Error {
  constructor(readonly code: HostedFailureCode) {
    super(code);
  }
}
export function requireHostedProof(
  condition: unknown,
  code: HostedFailureCode
): asserts condition {
  if (!condition) throw new HostedProofFailure(code);
}
export function hostedFailureCode(error: unknown): HostedFailureCode {
  return error instanceof HostedProofFailure && codes.includes(error.code)
    ? error.code
    : 'UNEXPECTED_HOSTED_FAILURE';
}
async function checked(
  action: () => Promise<unknown>,
  code: HostedFailureCode
) {
  try {
    await action();
  } catch {
    throw new HostedProofFailure(code);
  }
}
type ReviewRelease = {
  records: {
    label: string;
    ownership?: {
      pick?: { draftYear: number };
      claims?: { team: string; status: string }[];
    } | null;
  }[];
};

/** The same remaining-stage proof is exercised by the public browser tests. */
export async function verifyHostedReviewStages({
  page,
  release,
  primaryTeam,
  stage,
  setUnavailable,
  setPhase,
  forbiddenRequests,
}: {
  page: Page;
  release: ReviewRelease;
  primaryTeam: string;
  stage: (cancel?: boolean) => Promise<void>;
  setUnavailable: (value: boolean) => void;
  setPhase: (value: string) => void;
  forbiddenRequests: () => number;
}) {
  const panel = page.getByTestId('real-draft-review');
  const text = async () =>
    (await panel.innerText()).replace(/\s+/g, ' ').trim();
  const dateGuard = () =>
    panel.getByText(/does not establish this world’s date/).waitFor();
  setPhase('rendered-review');
  await checked(
    () => panel.getByText(/Starting position:/).waitFor(),
    'REVIEW_RENDER_TIMEOUT'
  );
  requireHostedProof(
    (await text()).includes('Apply unavailable'),
    'APPLY_SAFEGUARD_REQUIRED'
  );
  requireHostedProof(
    (await panel.locator('details').count()) > 0,
    'REVIEW_ROWS_REQUIRED'
  );
  const qualified = release.records.filter(
    (record) =>
      record.ownership?.pick?.draftYear === 2028 &&
      record.ownership.claims?.some(
        (claim) =>
          claim.team === primaryTeam && claim.status === 'owned-unconditionally'
      )
  );
  requireHostedProof(qualified.length === 1, 'QUALIFIED_PICK_REQUIRED');
  requireHostedProof(
    (await panel.locator('details').count()) === 1,
    'QUALIFIED_PICK_ROW_COUNT_MISMATCH'
  );
  requireHostedProof(
    (await text()).includes(qualified[0].label),
    'QUALIFIED_PICK_LABEL_MISMATCH'
  );

  // A fresh unsaved session has no world date. It must stay fail-closed.
  setPhase('world-date-boundary');
  await checked(dateGuard, 'WORLD_DATE_GUARD_REQUIRED');
  requireHostedProof(
    !(await text()).includes('Recorded ownership: Supported for this team'),
    'WORLD_DATE_GUARD_REQUIRED'
  );
  setPhase('historical-starting-position');
  await checked(
    () =>
      panel
        .getByRole('button', {
          name: 'Inspect retained starting position',
          exact: true,
        })
        .click(),
    'HISTORICAL_INSPECTION_UNAVAILABLE'
  );
  await checked(
    () =>
      panel
        .getByText(
          'Historical starting position only. Missing or different world dates remain unverified.',
          { exact: true }
        )
        .waitFor(),
    'HISTORICAL_SCOPE_DISCLOSURE_REQUIRED'
  );
  requireHostedProof(
    (await panel.locator('details').count()) === 1,
    'QUALIFIED_PICK_ROW_COUNT_MISMATCH'
  );
  requireHostedProof(
    (await text()).includes(qualified[0].label),
    'QUALIFIED_PICK_LABEL_MISMATCH'
  );
  requireHostedProof(
    (await text()).includes('Recorded ownership: Supported for this team'),
    'QUALIFIED_PICK_OWNERSHIP_NOT_SUPPORTED'
  );
  requireHostedProof(
    (await text()).includes('Apply unavailable'),
    'APPLY_SAFEGUARD_REQUIRED'
  );
  await checked(
    () =>
      panel
        .getByRole('button', {
          name: 'Return to date-limited review',
          exact: true,
        })
        .click(),
    'WORLD_REVIEW_RESET_FAILED'
  );
  await checked(dateGuard, 'WORLD_REVIEW_RESET_FAILED');
  requireHostedProof(
    !(await text()).includes('Recorded ownership: Supported for this team'),
    'WORLD_REVIEW_RESET_FAILED'
  );

  setPhase('application-authentication');
  let statuses: number[] = [];
  await checked(async () => {
    statuses = await page.evaluate(async (path) => {
      const a = await fetch(path, { cache: 'no-store' });
      const b = await fetch(path, {
        headers: { Authorization: 'Bearer invalid-verification-token' },
        cache: 'no-store',
      });
      return [a.status, b.status];
    }, '/api/architect/draft-review');
  }, 'APP_AUTHENTICATION_PROBE_FAILED');
  requireHostedProof(
    statuses.length === 2 && statuses.every((s) => s === 401),
    'APP_AUTHENTICATION_NOT_ENFORCED'
  );
  setPhase('unavailable-and-selection-reset');
  await checked(() => stage(true), 'SELECTION_CANCEL_FAILED');
  await checked(
    () => panel.waitFor({ state: 'detached' }),
    'STALE_REVIEW_AFTER_CANCEL'
  );
  setUnavailable(true);
  await checked(() => stage(), 'DESTINATION_RESTAGE_FAILED');
  setPhase('render-unavailable-review');
  await checked(
    () => panel.getByText(/retained pick review is unavailable/).waitFor(),
    'UNAVAILABLE_REVIEW_NOT_RENDERED'
  );
  requireHostedProof(
    (await text()).includes('Apply unavailable'),
    'FAILURE_APPLY_SAFEGUARD_REQUIRED'
  );
  await checked(() => stage(true), 'SELECTION_CANCEL_FAILED');
  await checked(
    () => panel.waitFor({ state: 'detached' }),
    'STALE_REVIEW_AFTER_CANCEL'
  );
  setUnavailable(false);
  setPhase('reload-selection-reset');
  await checked(async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Reopen the actual product surface; a closed dialog cannot prove reset.
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
    await page.getByRole('dialog', { name: /Trade Machine/i }).waitFor();
  }, 'RELOAD_FAILED');
  requireHostedProof((await panel.count()) === 0, 'STALE_REVIEW_AFTER_RELOAD');
  requireHostedProof(forbiddenRequests() === 0, 'UNEXPECTED_NETWORK_OPERATION');
}
