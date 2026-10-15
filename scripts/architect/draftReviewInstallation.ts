import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  prepareDraftReviewDocuments,
  readDraftReviewPart,
  DRAFT_REVIEW_DOCUMENT,
  draftReviewPartDocument,
} from '../../server/draftReviewFirestore.js';
import { inspectDraftReviewCloud } from './draftReviewCloudPreflight.js';
import { PUBLICATION_PERMISSIONS } from './draftReviewDeploymentPlan.js';

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
        'cloudresourcemanager.googleapis.com',
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

/** Offline transport: only ciphertext is committed; the protected environment holds its key. */
export function readInstallation(approvedHash: string, passphrase: string) {
  return decodeInstallation(
    decryptInstallationFile(
      '.github/bze321-installation.json.gpg',
      approvedHash,
      passphrase
    ),
    approvedHash
  );
}

/** Shared bounded transport only; callers must validate the decoded format. */
export function decryptInstallationFile(
  file: string,
  approvedHash: string,
  passphrase: string
) {
  if (
    !/^[a-f0-9]{64}$/.test(approvedHash) ||
    !/^[A-Za-z0-9_-]{64}$/.test(passphrase)
  )
    throw new Error('APPROVED_INSTALLATION_REQUIRED');
  let home: string | undefined;
  let bytes: Buffer;
  try {
    if (statSync(file).size > 4000000) throw new Error('INPUT_TOO_LARGE');
    home = mkdtempSync(join(tmpdir(), 'draft-installation-gpg-'));
    bytes = execFileSync(
      'gpg',
      [
        '--homedir',
        home,
        '--batch',
        '--quiet',
        '--pinentry-mode',
        'loopback',
        '--passphrase-fd',
        '0',
        '--no-symkey-cache',
        '--decrypt',
        file,
      ],
      {
        input: passphrase,
        maxBuffer: 4000000,
        timeout: 20000,
        // Never pass a cloud token or other runner secrets to the decryptor.
        env: { PATH: process.env.PATH, LANG: 'C.UTF-8' },
        stdio: ['pipe', 'pipe', 'ignore'],
      }
    );
  } catch {
    throw new Error('INSTALLATION_DECRYPTION_FAILED');
  } finally {
    if (home) rmSync(home, { recursive: true, force: true });
  }
  if (digest(bytes) !== approvedHash)
    throw new Error('INSTALLATION_DIGEST_MISMATCH');
  return bytes;
}

export function decodeInstallation(bytes: Buffer, approvedHash: string) {
  if (!/^[a-f0-9]{64}$/.test(approvedHash))
    throw new Error('APPROVED_INSTALLATION_REQUIRED');
  if (bytes.length > 4000000 || digest(bytes) !== approvedHash)
    throw new Error('INSTALLATION_DIGEST_MISMATCH');
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('INSTALLATION_INVALID_JSON');
  }
  return validateInstallation(value);
}

/** Create-only documents; byte-preserving reviewed rules addition. No generic deploy command. */
export async function publishInstallation(
  token: string,
  bundle: Installation,
  request: typeof fetch = fetch
) {
  validateInstallation(bundle);
  const api = cloudJson(token, request);
  // Non-mutating IAM check: refuse to change rules when the account cannot
  // complete the entire installation. Actual API authorization remains binding.
  const access = await api(
    'https://cloudresourcemanager.googleapis.com/v1/projects/scoutzero-bf1ae:testIamPermissions',
    'POST',
    { permissions: PUBLICATION_PERMISSIONS }
  );
  if (
    !Array.isArray(access.value.permissions) ||
    PUBLICATION_PERMISSIONS.some(
      (permission) => !access.value.permissions.includes(permission)
    )
  )
    throw new Error('PUBLICATION_PERMISSIONS_INCOMPLETE');
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
