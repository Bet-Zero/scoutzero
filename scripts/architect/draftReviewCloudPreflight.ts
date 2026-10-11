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

/** GET-only preflight. No writes, provider selection, raw output, or credential files. */
export async function inspectDraftReviewCloud(
  accessToken: string,
  request: typeof fetch = fetch
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
    if (!response.ok || !response.body)
      throw new Error(`Cloud preflight request failed (${response.status}).`);
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
    // Do not allow JSON parse errors to echo source/rules/provider bodies.
    try {
      return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    } catch {
      throw new Error('Invalid cloud response.');
    }
  }

  const db = await read(
    `https://firestore.googleapis.com/v1/${database}`,
    16384
  );
  if (db?.name !== database || db?.type !== 'FIRESTORE_NATIVE')
    throw new Error('Unexpected production database.');
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
  const rulesSha256 = sha(files[0].content);
  if (![BASE_RULES_SHA, APPROVED_RULES_SHA].includes(rulesSha256))
    throw new Error(
      'Production rules differ; inspect drift before any deployment.'
    );

  const names = [
    DRAFT_REVIEW_DOCUMENT,
    ...[0, 1, 2, 3].map(draftReviewPartDocument),
  ];
  const docs = [];
  for (const [index, name] of names.entries()) {
    docs.push(
      await read(
        `https://firestore.googleapis.com/v1/${name}`,
        index ? 750000 : 16384,
        true
      )
    );
  }
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
        : 'accepted-base',
    documents: present ? 'approved-installed' : 'absent',
    writesPerformed: 0,
  };
}
