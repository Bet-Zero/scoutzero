import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import {
  selectHostedDraftReviewPick,
  HOSTED_DRAFT_REVIEW_PRIMARY_TEAM,
} from './hostedDraftReviewSelection.js';
import { REAL_DRAFT_REVIEW_PIN } from '../../src/features/architect/utils/draftPickRealReviewPin.js';
import {
  hostedPreviewOrigin,
  hostedRequestPolicy,
  continueHostedRequest,
} from './hostedDraftReviewPolicy.js';

// Only fixed, non-sensitive labels reach public Actions logs. Never retain
// traces, HARs, cookies, screenshots, response bodies or raw exception messages.
let phase = 'configuration';
function requireProof(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}
async function main() {
  const origin = hostedPreviewOrigin(
    process.env.SCOUTZERO_HOSTED_PREVIEW || ''
  );
  const candidate = process.env.GITHUB_SHA || '';
  requireProof(/^[a-f0-9]{40}$/.test(candidate), 'CANDIDATE_REQUIRED');
  requireProof(
    process.env.GITHUB_REPOSITORY === 'Bet-Zero/scoutzero',
    'REPOSITORY_REQUIRED'
  );
  phase = 'github-identity';
  const tokenUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL || '');
  requireProof(
    tokenUrl.protocol === 'https:' &&
      tokenUrl.hostname.endsWith('.actions.githubusercontent.com'),
    'IDENTITY_ENDPOINT_REQUIRED'
  );
  tokenUrl.searchParams.set('audience', 'https://github.com/Bet-Zero');
  const identity = await fetch(tokenUrl, {
    headers: {
      Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  requireProof(identity.ok, 'IDENTITY_UNAVAILABLE');
  const { value: oidc } = (await identity.json()) as { value: string };
  requireProof(
    typeof oidc === 'string' && oidc.split('.').length === 3,
    'IDENTITY_INVALID'
  );

  const browser = await chromium.launch();
  // Reserve time for the finally cleanup before the enclosing job step expires.
  const watchdog = setTimeout(() => {
    void browser.close();
  }, 180000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    serviceWorkers: 'block',
  });
  let failed = false;
  let authCaptureFailed = false;
  const accounts = new Map<string, { idToken: string; key: string }>();
  let forbiddenRequests = 0;
  let blockedExternalReads = 0;
  let failedResponse = false;
  const reviewPath = '/api/architect/draft-review';
  const pendingAccounts: Promise<void>[] = [];
  try {
    await context.route('**/*', async (route) => {
      const request = route.request();
      const policy = hostedRequestPolicy(
        request.url(),
        request.method(),
        origin
      );
      if (policy === 'deny') {
        // Preview toolbar/third-party assets are not GM data writes. They stay
        // blocked, but must not be mislabeled as an attempted Firestore write.
        if (
          !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) ||
          new URL(request.url()).hostname === 'firestore.googleapis.com'
        )
          forbiddenRequests++;
        else blockedExternalReads++;
        await route.abort();
        return;
      }
      if (
        failedResponse &&
        new URL(request.url()).origin === origin &&
        new URL(request.url()).pathname === reviewPath
      ) {
        await route.fulfill({ status: 503, body: '' });
        return;
      }
      await continueHostedRequest(route, origin, oidc);
    });
    context.on('response', (response) => {
      const url = new URL(response.url());
      if (
        url.hostname === 'identitytoolkit.googleapis.com' &&
        url.pathname === '/v1/accounts:signUp'
      ) {
        pendingAccounts.push(
          (async () => {
            if (response.ok()) {
              const body = await response.json();
              requireProof(
                typeof body.idToken === 'string' &&
                  typeof body.localId === 'string',
                'FRESH_ACCOUNT_REQUIRED'
              );
              accounts.set(body.localId, {
                idToken: body.idToken,
                key: url.searchParams.get('key') || '',
              });
            }
          })().catch(() => {
            failed = true;
            authCaptureFailed = true;
            phase = 'temporary-auth-account-capture';
          })
        );
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    phase = 'protected-preview-access';
    await page.goto(
      `${origin}/gm/${HOSTED_DRAFT_REVIEW_PRIMARY_TEAM}?season=2027`,
      {
        waitUntil: 'domcontentloaded',
      }
    );
    requireProof(
      new URL(page.url()).origin === origin,
      'PREVIEW_AUTHENTICATION_REQUIRED'
    );
    await page.getByRole('tab', { name: /^Trade Machine$/i }).waitFor();
    const stage = await selectHostedDraftReviewPick(page, (value) => {
      phase = value;
    });
    const responsePromise = page.waitForResponse(
      (r) =>
        new URL(r.url()).origin === origin &&
        new URL(r.url()).pathname === reviewPath
    );
    const [response] = await Promise.all([
      responsePromise,
      stage().then(() => {
        phase = 'await-authenticated-release-response';
      }),
    ]);
    phase = 'authenticated-release-integrity';
    requireProof(response.status() === 200, 'HOSTED_RELEASE_UNAVAILABLE');
    requireProof(
      /^Bearer \S+$/.test(response.request().headers().authorization || ''),
      'FIREBASE_SESSION_REQUIRED'
    );
    requireProof(
      /no-store/.test(response.headers()['cache-control'] || ''),
      'PRIVATE_CACHE_REQUIRED'
    );
    const bytes = await response.body();
    requireProof(
      createHash('sha256').update(bytes).digest('hex') ===
        REAL_DRAFT_REVIEW_PIN.payloadSha256,
      'RELEASE_DIGEST_MISMATCH'
    );
    const release = JSON.parse(bytes.toString());
    requireProof(
      release.records.length === 278 && release.unresolved.length === 29,
      'INVENTORY_MISMATCH'
    );
    phase = 'rendered-review';
    const panel = page.getByTestId('real-draft-review');
    await panel.getByText(/Starting position:/).waitFor();
    requireProof(
      (await panel.innerText()).includes('Apply unavailable'),
      'APPLY_SAFEGUARD_REQUIRED'
    );
    requireProof(
      (await panel.locator('details').count()) > 0,
      'REVIEW_ROWS_REQUIRED'
    );
    const qualified = release.records.filter(
      (record: any) =>
        record.ownership?.pick?.draftYear === 2028 &&
        record.ownership?.claims?.some(
          (claim: any) =>
            claim.team === HOSTED_DRAFT_REVIEW_PRIMARY_TEAM &&
            claim.status === 'owned-unconditionally'
        )
    );
    requireProof(qualified.length === 1, 'QUALIFIED_PICK_REQUIRED');
    const rendered = await panel.innerText();
    requireProof(
      (await panel.locator('details').count()) === 1 &&
        rendered.includes(qualified[0].label) &&
        rendered.includes('Recorded ownership: Supported for this team'),
      'QUALIFIED_PICK_REVIEW_REQUIRED'
    );

    phase = 'application-authentication';
    const statuses = await page.evaluate(async (path) => {
      const a = await fetch(path, { cache: 'no-store' });
      const b = await fetch(path, {
        headers: { Authorization: 'Bearer invalid-verification-token' },
        cache: 'no-store',
      });
      return [a.status, b.status];
    }, reviewPath);
    requireProof(
      statuses.every((s) => s === 401),
      'APP_AUTHENTICATION_NOT_ENFORCED'
    );

    phase = 'unavailable-and-selection-reset';
    await stage(true);
    await panel.waitFor({ state: 'detached' });
    failedResponse = true;
    await stage();
    phase = 'render-unavailable-review';
    await panel.getByText(/retained pick review is unavailable/).waitFor();
    requireProof(
      (await panel.innerText()).includes('Apply unavailable'),
      'FAILURE_APPLY_SAFEGUARD_REQUIRED'
    );
    await stage(true);
    await panel.waitFor({ state: 'detached' });
    failedResponse = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /^Trade Machine$/i }).waitFor();
    requireProof((await panel.count()) === 0, 'STALE_REVIEW_AFTER_RELOAD');
    requireProof(forbiddenRequests === 0, 'UNEXPECTED_NETWORK_OPERATION');
  } catch {
    failed = true;
  } finally {
    let deletedAccounts = 0;
    const captured = await Promise.allSettled(pendingAccounts);
    if (captured.some((r) => r.status === 'rejected')) {
      failed = true;
      authCaptureFailed = true;
      phase = 'temporary-auth-account-capture';
    }
    // Delete only the fresh anonymous Auth account made by this empty browser
    // context. Never select, alter, or delete an existing user or saved world.
    for (const account of accounts.values()) {
      const result = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(account.key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: account.idToken }),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        }
      ).catch(() => null);
      if (!result?.ok) {
        failed = true;
        phase = 'temporary-auth-account-cleanup';
      } else deletedAccounts++;
    }
    await context.close();
    await browser.close();
    clearTimeout(watchdog);
    console.log(
      JSON.stringify({
        temporaryAuthAccountsCreated: accounts.size,
        temporaryAuthAccountsDeleted: deletedAccounts,
        temporaryAuthCleanupComplete:
          !authCaptureFailed && accounts.size === deletedAccounts,
      })
    );
  }
  if (failed) throw new Error('HOSTED_PROOF_INCOMPLETE');
  console.log(
    JSON.stringify({
      candidate,
      hostedReview: true,
      releaseDigest: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      entitlements: 278,
      unresolved: 29,
      appAuthentication: true,
      unavailableState: true,
      selectionReset: true,
      applyUnavailable: true,
      firestoreWrites: 0,
      blockedExternalReads,
      temporaryAuthAccountsDeleted: accounts.size,
    })
  );
}
main().catch(() => {
  console.error(JSON.stringify({ hostedReview: false, phase }));
  process.exitCode = 1;
});
