import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  prepareDraftReviewDocuments,
  readDraftReviewPart,
  DRAFT_REVIEW_DOCUMENT,
  draftReviewPartDocument,
} from '../../server/draftReviewFirestore.js';
import { inspectDraftReviewCloud } from './draftReviewCloudPreflight.js';
import { RELEASE_BUCKET, RELEASE_OBJECT } from './draftReviewDeploymentPlan.js';

export const digest = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const rulesRoot =
  'https://firebaserules.googleapis.com/v1/projects/scoutzero-bf1ae';
const releaseName = 'projects/scoutzero-bf1ae/releases/cloud.firestore';
const database = 'projects/scoutzero-bf1ae/databases/(default)';

// Self-contained predicate: do not inherit a possibly different live helper.
export const REVIEW_RULE_ADDITION = `
    // BZE-321: immutable derived review release; client reads only.
    match /architect_draftPickReleases/{releaseId} {
      allow get: if request.auth != null && releaseId.matches('^[a-f0-9]{64}$');
      allow list, write: if false;
      match /parts/{partId} {
        allow get: if request.auth != null
          && releaseId.matches('^[a-f0-9]{64}$')
          && partId.matches('^[0-3]$')
          && exists(/databases/$(database)/documents/architect_draftPickReleases/$(releaseId));
        allow list, write: if false;
      }
    }
`;

export interface Installation {
  baselineRuleset: string;
  baselineRules: string;
  proposedRules: string;
  documents: ReturnType<typeof prepareDraftReviewDocuments>;
}

export function releasePermissionCases() {
  const names = [
    DRAFT_REVIEW_DOCUMENT,
    ...[0, 1, 2, 3].map(draftReviewPartDocument),
  ];
  const cases: object[] = [];
  for (const name of names)
    for (const auth of [null, { uid: 'bze321-permission-probe', token: {} }]) {
      for (const method of ['get', 'list', 'create', 'update', 'delete']) {
        cases.push({
          expectation: method === 'get' && auth ? 'ALLOW' : 'DENY',
          request: {
            path: '/' + name.slice(name.indexOf('databases/')),
            method,
            auth,
            resource: { data: {} },
          },
          resource: { data: {} },
          functionMocks: [
            {
              function: 'exists',
              args: [{ anyValue: {} }],
              result: { value: true },
            },
          ],
        });
      }
    }
  return cases;
}

/** Validation is deliberately insufficient to authorize publication by itself. */
export function validateInstallation(value: unknown): Installation {
  const bundle = value as Installation;
  if (
    !bundle ||
    typeof bundle.baselineRules !== 'string' ||
    typeof bundle.proposedRules !== 'string' ||
    !/^projects\/scoutzero-bf1ae\/rulesets\/[A-Za-z0-9_-]+$/.test(
      bundle.baselineRuleset
    ) ||
    !Array.isArray(bundle.documents) ||
    bundle.documents.length !== 5
  )
    throw new Error('INSTALLATION_SHAPE');
  // A reviewed insertion offset is allowed; nothing in the existing rule source
  // may be removed, reordered, normalized or replaced. Compile/permission proof
  // against these exact bytes is a separate mandatory gate.
  const offset = bundle.proposedRules.indexOf(REVIEW_RULE_ADDITION);
  if (
    offset < 0 ||
    bundle.proposedRules.indexOf(REVIEW_RULE_ADDITION, offset + 1) !== -1 ||
    bundle.proposedRules.slice(0, offset) +
      bundle.proposedRules.slice(offset + REVIEW_RULE_ADDITION.length) !==
      bundle.baselineRules ||
    bundle.baselineRules.includes('architect_draftPickReleases')
  )
    throw new Error('RULES_NOT_ADDITIVE');
  const bytes = Buffer.concat(
    bundle.documents
      .slice(1)
      .map((doc, index) => readDraftReviewPart(doc, index))
  );
  if (!isDeepStrictEqual(bundle.documents, prepareDraftReviewDocuments(bytes)))
    throw new Error('RELEASE_CONFLICT');
  return bundle;
}

/** Fixed Google endpoints only. Never return provider error bodies. */
export function cloudJson(token: string, request: typeof fetch = fetch) {
  if (!token || /\s/.test(token)) throw new Error('TOKEN_REQUIRED');
  return async (url: string, method = 'GET', body?: unknown) => {
    if (
      ![
        'firebaserules.googleapis.com',
        'firestore.googleapis.com',
        'storage.googleapis.com',
      ].includes(new URL(url).host)
    )
      throw new Error('HOST_REJECTED');
    const response = await request(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`CLOUD_HTTP_${response.status}`);
    }
    if (!response.body) throw new Error('EMPTY_RESPONSE');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 4000000) throw new Error('RESPONSE_TOO_LARGE');
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks, length);
    try {
      return { bytes, value: JSON.parse(bytes.toString('utf8')) };
    } catch {
      throw new Error('INVALID_JSON');
    }
  };
}

export async function readInstallation(
  token: string,
  generation: string,
  approvedHash: string,
  request: typeof fetch = fetch
) {
  if (
    !/^[1-9][0-9]{0,29}$/.test(generation) ||
    !/^[a-f0-9]{64}$/.test(approvedHash)
  )
    throw new Error('APPROVED_INSTALLATION_REQUIRED');
  const response = await cloudJson(
    token,
    request
  )(
    `https://storage.googleapis.com/storage/v1/b/${RELEASE_BUCKET}/o/${encodeURIComponent(RELEASE_OBJECT)}?alt=media&generation=${generation}`
  );
  if (digest(response.bytes) !== approvedHash)
    throw new Error('INSTALLATION_DIGEST_MISMATCH');
  return validateInstallation(response.value);
}

/** Create-only documents; byte-preserving reviewed rules addition. No generic deploy command. */
export async function publishInstallation(
  token: string,
  bundle: Installation,
  request: typeof fetch = fetch
) {
  validateInstallation(bundle);
  const api = cloudJson(token, request);
  let live: { content: string; rulesetName: string } | undefined;
  const inspected = await inspectDraftReviewCloud(token, request, {
    retain: (snapshot) => {
      live = snapshot;
    },
  });
  const rulesAlreadyInstalled = live?.content === bundle.proposedRules;
  if (
    !live ||
    (!rulesAlreadyInstalled &&
      (live.content !== bundle.baselineRules ||
        live.rulesetName !== bundle.baselineRuleset))
  )
    throw new Error('BASELINE_CHANGED');

  // Google compiles the proposed source before the active release is touched.
  // Complete emulator authorization tests on these exact bytes are required in
  // the approval receipt, not inferred from a successful compilation response.
  const testCases = releasePermissionCases();
  const test = await api(`${rulesRoot}:test`, 'POST', {
    source: {
      files: [{ name: 'firestore.rules', content: bundle.proposedRules }],
    },
    testSuite: { testCases },
  });
  if (
    test.value.issues?.length ||
    !Array.isArray(test.value.testResults) ||
    test.value.testResults.length !== testCases.length ||
    test.value.testResults.some(
      (result: any) =>
        result.state !== 'SUCCESS' ||
        result.errorPosition ||
        result.debugMessages?.length
    )
  )
    throw new Error('RULES_TEST_FAILED');
  if (!rulesAlreadyInstalled) {
    const rules = await api(`${rulesRoot}/rulesets`, 'POST', {
      source: {
        files: [{ name: 'firestore.rules', content: bundle.proposedRules }],
      },
    });
    const name = rules.value.name;
    if (
      typeof name !== 'string' ||
      !/^projects\/scoutzero-bf1ae\/rulesets\/[A-Za-z0-9_-]+$/.test(name)
    )
      throw new Error('RULESET_RESPONSE_MISMATCH');
    const before = await api(`${rulesRoot}/releases/cloud.firestore`);
    if (before.value.rulesetName !== bundle.baselineRuleset)
      throw new Error('BASELINE_CHANGED');
    // Rules Releases API has no compare-and-swap precondition. The production
    // approval must reserve this short window against other rule publishers.
    await api(`${rulesRoot}/releases/cloud.firestore`, 'PATCH', {
      release: { name: releaseName, rulesetName: name },
      updateMask: 'rulesetName',
    });
    const after = await api(`${rulesRoot}/releases/cloud.firestore`);
    if (after.value.rulesetName !== name)
      throw new Error('RULES_RELEASE_CHANGED');
  }
  if (inspected.documents === 'absent') {
    await api(
      `https://firestore.googleapis.com/v1/${database}/documents:commit`,
      'POST',
      {
        writes: bundle.documents.map((update) => ({
          update,
          currentDocument: { exists: false },
        })),
      }
    );
  }
  let installed: { content: string } | undefined;
  const verified = await inspectDraftReviewCloud(token, request, {
    retain: (snapshot) => {
      installed = snapshot;
    },
  });
  if (
    !installed ||
    (installed as { content: string }).content !== bundle.proposedRules ||
    verified.documents !== 'approved-installed'
  )
    throw new Error('POST_INSTALLATION_MISMATCH');
  return {
    rulesVerified: true,
    releaseVerified: true,
    documentWrites: inspected.documents === 'absent' ? 5 : 0,
  };
}
