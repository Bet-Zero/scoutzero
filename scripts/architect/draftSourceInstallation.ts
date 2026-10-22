/** Proposed three-record publisher. No caller/request or cloud grant activates it. */
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import {
  cloudJson,
  decryptInstallationFile,
  digest,
} from './draftReviewInstallation.js';
import { inspectDraftReviewCloud } from './draftReviewCloudPreflight.js';
import { PUBLICATION_PERMISSIONS } from './draftReviewDeploymentPlan.js';
import { decodeDraftField } from './draftSourceInventory.js';
import {
  prepareDraftSourceCommit,
  verifyDraftSourceReadRuleAddition,
} from './draftSourcePreservation.js';
import {
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  ARCHITECT_BASE_PICK_RULES_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
} from '../../src/constants/collections.js';

export const SOURCE_PUBLICATION_PERMISSIONS = [
  ...PUBLICATION_PERMISSIONS,
  'datastore.entities.update',
];
const database = 'projects/scoutzero-bf1ae/databases/(default)';
const root = `${database}/documents/`;
const rulesRoot =
  'https://firebaserules.googleapis.com/v1/projects/scoutzero-bf1ae';
const releaseUrl = `${rulesRoot}/releases/cloud.firestore`;
const rulesetPattern = /^projects\/scoutzero-bf1ae\/rulesets\/[A-Za-z0-9_-]+$/;
const fields = z.record(z.string(), z.unknown());
const Bundle = z.strictObject({
  format: z.literal('bze321-source-proof-v1'),
  baselineRuleset: z.string().regex(rulesetPattern),
  baselineRules: z.string(),
  proposedRules: z.string(),
  changes: z
    .array(
      z.strictObject({
        path: z.string(),
        kind: z.enum(['team', 'entitlement', 'pickRule']),
        before: fields.nullable(),
        after: fields,
        updateTime: z.string().optional(),
        beforeDocument: z
          .strictObject({ name: z.string(), updateTime: z.string(), fields })
          .nullable(),
      })
    )
    .length(3),
});
export type SourceInstallation = z.infer<typeof Bundle>;

/** Fetch ciphertext only from the triggering commit; never execute caller code. */
export async function readSourceCiphertext(
  githubToken: string,
  callerSha: string,
  request: typeof fetch = fetch
) {
  if (
    !githubToken ||
    /\s/.test(githubToken) ||
    !/^[a-f0-9]{40}$/.test(callerSha)
  )
    throw new Error('SOURCE_TRANSPORT_IDENTITY');
  const response = await request(
    `https://api.github.com/repos/Bet-Zero/scoutzero/contents/.github/bze321-source-installation.json.gpg?ref=${callerSha}`,
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.raw+json',
      },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('SOURCE_CIPHERTEXT_UNAVAILABLE');
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4000000) throw new Error('SOURCE_CIPHERTEXT_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

/** Owner-approved bytes bind source qualification; code enforces mechanical scope. */
export function validateSourceInstallation(value: unknown) {
  const parsed = Bundle.safeParse(value);
  if (!parsed.success) throw new Error('SOURCE_INSTALLATION_SHAPE');
  const bundle = parsed.data;
  const byKind = new Map(bundle.changes.map((change) => [change.kind, change]));
  const team = byKind.get('team');
  const entitlement = byKind.get('entitlement');
  const rule = byKind.get('pickRule');
  if (
    !team?.before ||
    !entitlement?.before ||
    !rule ||
    rule.before !== null ||
    byKind.size !== 3
  )
    throw new Error('SOURCE_INSTALLATION_SCOPE');
  const teamId = team.path.slice(ARCHITECT_BASE_TEAMS_PATH.length + 1);
  const entitlementId = entitlement.path.slice(
    ARCHITECT_BASE_ENTITLEMENTS_PATH.length + 1
  );
  const pickId = rule.path.slice(ARCHITECT_BASE_PICK_RULES_PATH.length + 1);
  if (
    entitlement.after.holderTeam !== teamId ||
    entitlement.before.underlyingPickId !== pickId ||
    !isDeepStrictEqual(team.after.entitlementIds, [entitlementId]) ||
    (team.before.entitlementIds !== undefined &&
      !isDeepStrictEqual(team.before.entitlementIds, []))
  )
    throw new Error('SOURCE_INSTALLATION_LINKS');
  // Each proposed logical before-image must be the exact retained REST document.
  for (const change of bundle.changes) {
    const document = change.beforeDocument;
    if (change.before === null) {
      if (document !== null || change.updateTime !== undefined)
        throw new Error('SOURCE_BEFORE_MISMATCH');
    } else if (
      !document ||
      document.name !== root + change.path ||
      document.updateTime !== change.updateTime ||
      !isDeepStrictEqual(
        change.before,
        decodeDraftField({ mapValue: { fields: document.fields } })
      )
    ) {
      throw new Error('SOURCE_BEFORE_MISMATCH');
    }
  }
  const commit = prepareDraftSourceCommit(bundle.changes);
  verifyDraftSourceReadRuleAddition(
    bundle.baselineRules,
    bundle.proposedRules,
    entitlementId,
    pickId
  );
  return { bundle, commit, entitlementId, pickId };
}

export function decodeSourceInstallation(bytes: Buffer, approvedHash: string) {
  if (
    !/^[a-f0-9]{64}$/.test(approvedHash) ||
    bytes.length > 4000000 ||
    digest(bytes) !== approvedHash
  )
    throw new Error('SOURCE_APPROVED_DIGEST_REQUIRED');
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('SOURCE_INSTALLATION_JSON');
  }
  return validateSourceInstallation(value).bundle;
}

export function readSourceInstallation(
  approvedHash: string,
  passphrase: string
) {
  const bytes = decryptInstallationFile(
    '.github/bze321-source-installation.json.gpg',
    approvedHash,
    passphrase
  );
  decodeSourceInstallation(bytes, approvedHash);
  return bytes;
}

export function sourcePermissionCases(entitlementId: string, pickId: string) {
  const cases: object[] = [];
  for (const path of [
    `${ARCHITECT_BASE_ENTITLEMENTS_PATH}/${entitlementId}`,
    `${ARCHITECT_BASE_PICK_RULES_PATH}/${pickId}`,
    `${ARCHITECT_BASE_ENTITLEMENTS_PATH}/bze321-unapproved-probe`,
    `${ARCHITECT_BASE_PICK_RULES_PATH}/bze321-unapproved-probe`,
  ])
    for (const auth of [null, { uid: 'bze321-source-probe', token: {} }])
      for (const method of ['get', 'create', 'update', 'delete'])
        cases.push({
          expectation:
            auth &&
            method === 'get' &&
            !path.endsWith('/bze321-unapproved-probe')
              ? 'ALLOW'
              : 'DENY',
          request: {
            path: `/databases/(default)/documents/${path}`,
            method,
            auth,
            resource: { data: {} },
          },
          resource: { data: {} },
        });
  return cases;
}

/** Not a bulk importer. Never retries a write, removes data, or rolls back other publishers. */
export async function publishSourceInstallation(
  token: string,
  approvedBytes: Buffer,
  approvedHash: string,
  request: typeof fetch = fetch
) {
  const { bundle, commit, entitlementId, pickId } = validateSourceInstallation(
    decodeSourceInstallation(approvedBytes, approvedHash)
  );
  const api = cloudJson(token, request);
  const access = await api(
    'https://cloudresourcemanager.googleapis.com/v1/projects/scoutzero-bf1ae:testIamPermissions',
    'POST',
    { permissions: SOURCE_PUBLICATION_PERMISSIONS }
  );
  if (
    !Array.isArray(access.value.permissions) ||
    SOURCE_PUBLICATION_PERMISSIONS.some(
      (permission) => !access.value.permissions.includes(permission)
    )
  )
    throw new Error('SOURCE_PUBLICATION_PERMISSIONS_INCOMPLETE');
  let live: { content: string; rulesetName: string } | undefined;
  const inspected = await inspectDraftReviewCloud(token, request, {
    retain: (value) => {
      live = value;
    },
  });
  if (
    inspected.documents !== 'approved-installed' ||
    !live ||
    live.content !== bundle.baselineRules ||
    live.rulesetName !== bundle.baselineRuleset
  )
    throw new Error('SOURCE_BASELINE_CHANGED');
  async function readDocument(path: string) {
    try {
      return (await api(`https://firestore.googleapis.com/v1/${root}${path}`))
        .value;
    } catch (error) {
      if (error instanceof Error && error.message === 'CLOUD_HTTP_404')
        return null;
      throw error;
    }
  }
  async function checkBefore() {
    for (const change of bundle.changes) {
      const document = await readDocument(change.path);
      const normalized = document && {
        name: document.name,
        fields: document.fields,
        updateTime: document.updateTime,
      };
      if (!isDeepStrictEqual(normalized, change.beforeDocument))
        throw new Error('SOURCE_DOCUMENT_CHANGED');
    }
  }
  await checkBefore();
  const testCases = sourcePermissionCases(entitlementId, pickId);
  const source = {
    files: [{ name: 'firestore.rules', content: bundle.proposedRules }],
  };
  const tested = (
    await api(`${rulesRoot}:test`, 'POST', { source, testSuite: { testCases } })
  ).value;
  if (
    tested.issues?.length ||
    !Array.isArray(tested.testResults) ||
    tested.testResults.length !== testCases.length ||
    tested.testResults.some(
      (result: any) =>
        result.state !== 'SUCCESS' ||
        result.errorPosition ||
        result.debugMessages?.length
    )
  )
    throw new Error('SOURCE_RULES_TEST_FAILED');
  // No mutation above this line. Exact private query/emulator proof is an approval prerequisite.
  const rulesetName = (await api(`${rulesRoot}/rulesets`, 'POST', { source }))
    .value.name;
  if (typeof rulesetName !== 'string' || !rulesetPattern.test(rulesetName))
    throw new Error('SOURCE_RULESET_RESPONSE');
  await checkBefore();
  if ((await api(releaseUrl)).value.rulesetName !== bundle.baselineRuleset)
    throw new Error('SOURCE_BASELINE_CHANGED');
  // Rules API has no CAS. Owner-approved exclusive publication window is required.
  await api(releaseUrl, 'PATCH', {
    release: {
      name: 'projects/scoutzero-bf1ae/releases/cloud.firestore',
      rulesetName,
    },
    updateMask: 'rulesetName',
  });
  if ((await api(releaseUrl)).value.rulesetName !== rulesetName)
    throw new Error('SOURCE_RULES_RELEASE_CHANGED');
  // Existing records use exact updateTime; the new record uses exists:false.
  await api(
    `https://firestore.googleapis.com/v1/${database}/documents:commit`,
    'POST',
    commit
  );
  for (const [index, change] of bundle.changes.entries()) {
    const installed = await readDocument(change.path);
    const expected = {
      ...change.beforeDocument?.fields,
      ...commit.writes[index].update.fields,
    };
    if (
      !installed ||
      installed.name !== root + change.path ||
      !isDeepStrictEqual(
        decodeDraftField({ mapValue: { fields: installed.fields } }),
        decodeDraftField({ mapValue: { fields: expected } })
      )
    )
      throw new Error('SOURCE_POST_INSTALLATION_MISMATCH');
  }
  let afterRules: { content: string; rulesetName: string } | undefined;
  const verified = await inspectDraftReviewCloud(token, request, {
    retain: (value) => {
      afterRules = value;
    },
  });
  if (
    verified.documents !== 'approved-installed' ||
    !afterRules ||
    afterRules.content !== bundle.proposedRules ||
    afterRules.rulesetName !== rulesetName
  )
    throw new Error('SOURCE_POST_INSTALLATION_MISMATCH');
  return {
    documentWrites: 3,
    sourceVerified: true,
    rulesVerified: true,
    existingReviewReleaseVerified: true,
  };
}
