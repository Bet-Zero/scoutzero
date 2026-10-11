import { createHash } from 'node:crypto';
import {
  DRAFT_REVIEW_DOCUMENT,
  draftReviewPartDocument,
  verifyDraftReviewManifest,
  readDraftReviewPart,
  verifyDraftReviewBytes,
} from '../../server/draftReviewFirestore.js';
import { DRAFT_CLOUD_PROJECT } from './draftReviewCloudConnection.js';

const BASE_RULES_SHA =
  '8356ad1b83fb4c7ddf25893928ba99b365cd02bee57554bfb940af84ee73cc59';
const APPROVED_RULES_SHA =
  '40069e84f342f06e50da3e7ed15755935d3c41627751b2226cb73c6cde5b19cd';
const database = `projects/${DRAFT_CLOUD_PROJECT}/databases/(default)`;
const releaseName = `projects/${DRAFT_CLOUD_PROJECT}/releases/cloud.firestore`;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const stages = [
  'credential',
  'database',
  'rules-release',
  'ruleset',
  'rules-compatibility',
  'manifest',
  'part-0',
  'part-1',
  'part-2',
  'part-3',
  'release-integrity',
] as const;
type Stage = (typeof stages)[number];
const failures = new Map([
  ['A short-lived Google Cloud access token is required.', 'TOKEN_REQUIRED'],
  ['Unexpected production database.', 'DATABASE_MISMATCH'],
  ['Unexpected production rules release.', 'RULES_RELEASE_MISMATCH'],
  ['Unexpected production ruleset.', 'RULESET_SHAPE_MISMATCH'],
  [
    'Production rules differ; inspect drift before any deployment.',
    'RULES_DRIFT',
  ],
  [
    'Partial release exists; inspect before create-only installation.',
    'PARTIAL_RELEASE',
  ],
  [
    'Existing release conflicts with the approved immutable version.',
    'RELEASE_CONFLICT',
  ],
  ['Cloud response exceeds limit.', 'RESPONSE_TOO_LARGE'],
  ['Invalid cloud response.', 'INVALID_JSON'],
]);
const allowedReasons = new Set([
  'SERVICE_DISABLED',
  'IAM_PERMISSION_DENIED',
  'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
  'CONSUMER_INVALID',
  'RATE_LIMIT_EXCEEDED',
]);

class CloudHttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly reason?: string
  ) {
    super(`Cloud preflight request failed (${status}).`);
  }
}

class CloudPreflightFailure extends Error {
  readonly diagnostic: Record<string, string | number>;
  constructor(stage: Stage, error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const code = failures.get(message);
    const http = error instanceof CloudHttpFailure;
    // Never retain an unknown exception's message, stack or cause: fetch/SDK
    // and schema errors can contain provider bodies or credential material.
    super(code || http ? message : 'Unexpected cloud preflight failure.');
    this.diagnostic = {
      stage,
      code: http ? 'HTTP_ERROR' : (code ?? 'REQUEST_OR_INTERNAL_FAILURE'),
      ...(http ? { status: error.status } : {}),
      ...(http && error.reason ? { reason: error.reason } : {}),
      writesPerformed: 0,
    };
  }
}

/** Only locally assigned stages/codes and whitelisted Google reasons leave the job. */
export function draftCloudFailureSummary(error: unknown) {
  return error instanceof CloudPreflightFailure
    ? error.diagnostic
    : { code: 'UNCLASSIFIED_FAILURE', writesPerformed: 0 };
}

/** GET-only preflight. No writes, provider selection, raw output, or credential files. */
export async function inspectDraftReviewCloud(
  accessToken: string,
  request: typeof fetch = fetch,
  evidence?: {
    retain: (snapshot: {
      rulesetName: string;
      content: string;
      sha256: string;
    }) => void;
  }
) {
  let stage: Stage = 'credential';
  try {
    return await inspect(
      accessToken,
      request,
      (next) => {
        stage = next;
      },
      evidence
    );
  } catch (error) {
    throw new CloudPreflightFailure(stage, error);
  }
}

async function inspect(
  accessToken: string,
  request: typeof fetch,
  setStage: (stage: Stage) => void,
  evidence?: {
    retain: (snapshot: {
      rulesetName: string;
      content: string;
      sha256: string;
    }) => void;
  }
) {
  if (!accessToken || /\s/.test(accessToken))
    throw new Error('A short-lived Google Cloud access token is required.');
  async function read(url: string, maximum: number, absentAllowed = false) {
    const response = await request(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404 && absentAllowed) {
      await response.body?.cancel();
      return null;
    }
    if (!response.body) throw new CloudHttpFailure(response.status);
    // An error body is read only to identify an allowlisted Google reason.
    // It is never logged or attached to the thrown error.
    if (!response.ok) maximum = Math.min(maximum, 16384);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maximum) throw new Error('Cloud response exceeds limit.');
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!response.ok) {
      let reason: string | undefined;
      try {
        const body = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
        const details = body?.error?.details;
        if (Array.isArray(details)) {
          reason = details.find(
            (item) =>
              item?.['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' &&
              allowedReasons.has(item.reason)
          )?.reason;
        }
      } catch {
        /* The HTTP status remains useful without a JSON body. */
      }
      throw new CloudHttpFailure(response.status, reason);
    }
    // Do not allow JSON parse errors to echo source/rules/provider bodies.
    try {
      return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    } catch {
      throw new Error('Invalid cloud response.');
    }
  }

  setStage('database');
  const db = await read(
    `https://firestore.googleapis.com/v1/${database}`,
    16384
  );
  if (db?.name !== database || db?.type !== 'FIRESTORE_NATIVE')
    throw new Error('Unexpected production database.');
  setStage('rules-release');
  const release = await read(
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    16384
  );
  if (
    release?.name !== releaseName ||
    typeof release.rulesetName !== 'string' ||
    !/^projects\/scoutzero-bf1ae\/rulesets\/[A-Za-z0-9_-]+$/.test(
      release.rulesetName
    )
  )
    throw new Error('Unexpected production rules release.');
  setStage('ruleset');
  const rules = await read(
    `https://firebaserules.googleapis.com/v1/${release.rulesetName}`,
    1000000
  );
  const files = rules?.source?.files;
  if (
    rules?.name !== release.rulesetName ||
    !Array.isArray(files) ||
    files.length !== 1 ||
    files[0]?.name !== 'firestore.rules' ||
    typeof files[0]?.content !== 'string'
  )
    throw new Error('Unexpected production ruleset.');
  setStage('rules-compatibility');
  const rulesSha256 = sha(files[0].content);
  evidence?.retain({
    rulesetName: release.rulesetName,
    content: files[0].content,
    sha256: rulesSha256,
  });
  if (!evidence && ![BASE_RULES_SHA, APPROVED_RULES_SHA].includes(rulesSha256))
    throw new Error(
      'Production rules differ; inspect drift before any deployment.'
    );

  const names = [
    DRAFT_REVIEW_DOCUMENT,
    ...[0, 1, 2, 3].map(draftReviewPartDocument),
  ];
  const docs = [];
  for (const [index, name] of names.entries()) {
    setStage(
      (['manifest', 'part-0', 'part-1', 'part-2', 'part-3'] as const)[index]
    );
    docs.push(
      await read(
        `https://firestore.googleapis.com/v1/${name}`,
        index ? 750000 : 16384,
        true
      )
    );
  }
  setStage('release-integrity');
  const present = docs.filter((doc) => doc !== null).length;
  if (present !== 0 && present !== 5)
    throw new Error(
      'Partial release exists; inspect before create-only installation.'
    );
  if (present) {
    try {
      verifyDraftReviewManifest(docs[0]);
      verifyDraftReviewBytes(
        Buffer.concat(
          docs.slice(1).map((doc, index) => readDraftReviewPart(doc, index))
        )
      );
    } catch {
      throw new Error(
        'Existing release conflicts with the approved immutable version.'
      );
    }
  }
  return {
    project: DRAFT_CLOUD_PROJECT,
    rulesSha256,
    rules:
      rulesSha256 === APPROVED_RULES_SHA
        ? 'approved-installed'
        : rulesSha256 === BASE_RULES_SHA
          ? 'accepted-base'
          : 'different-preserved-for-review',
    documents: present ? 'approved-installed' : 'absent',
    writesPerformed: 0,
  };
}
