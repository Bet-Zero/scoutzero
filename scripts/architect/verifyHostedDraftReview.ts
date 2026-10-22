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
import {
  requireHostedProof as requireProof,
  hostedFailureCode,
  verifyHostedReviewStages,
  type HostedFailureCode,
} from './hostedDraftReviewAssertions.js';

// Only fixed, non-sensitive labels reach public Actions logs. Never retain
// traces, HARs, cookies, screenshots, response bodies or raw exception messages.
let phase = 'configuration';
let failureCode: HostedFailureCode = 'UNEXPECTED_HOSTED_FAILURE';
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
            failureCode = 'TEMPORARY_AUTH_CAPTURE_FAILED';
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
    await verifyHostedReviewStages({
      page,
      release,
      primaryTeam: HOSTED_DRAFT_REVIEW_PRIMARY_TEAM,
      stage,
      setUnavailable: (value) => {
        failedResponse = value;
      },
      setPhase: (value) => {
        phase = value;
      },
      forbiddenRequests: () => forbiddenRequests,
    });
  } catch (error) {
    failed = true;
    failureCode = hostedFailureCode(error);
  } finally {
    let deletedAccounts = 0;
    const captured = await Promise.allSettled(pendingAccounts);
    if (captured.some((r) => r.status === 'rejected')) {
      failed = true;
      authCaptureFailed = true;
      phase = 'temporary-auth-account-capture';
      failureCode = 'TEMPORARY_AUTH_CAPTURE_FAILED';
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
        failureCode = 'TEMPORARY_AUTH_CLEANUP_FAILED';
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
      historicalStartingPosition: true,
      worldDateFailClosed: true,
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
main().catch((error) => {
  if (failureCode === 'UNEXPECTED_HOSTED_FAILURE')
    failureCode = hostedFailureCode(error);
  console.error(
    JSON.stringify({ hostedReview: false, phase, code: failureCode })
  );
  process.exitCode = 1;
});
