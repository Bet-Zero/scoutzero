import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Bytes,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  DRAFT_REVIEW_MANIFEST_FIELDS,
  prepareDraftReviewDocuments,
  readDraftReviewPart,
  verifyDraftReviewBytes,
  verifyDraftReviewManifest,
} from '../../server/draftReviewFirestore';
import { REAL_DRAFT_REVIEW_PIN } from '../../src/features/architect/utils/draftPickRealReviewPin';
import { ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION } from '../../src/constants/collections';

const projectId = 'demo-draft-review-rules';
const release = `${ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION}/${REAL_DRAFT_REVIEW_PIN.payloadSha256}`;
let env: RulesTestEnvironment;
const fieldsToData = (fields: Record<string, Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      'stringValue' in value
        ? value.stringValue
        : 'integerValue' in value
          ? Number(value.integerValue)
          : Bytes.fromBase64String(value.bytesValue),
    ])
  );

beforeAll(async () => {
  const endpoint = process.env.FIRESTORE_EMULATOR_HOST;
  if (!endpoint || !/^127\.0\.0\.1:\d+$/.test(endpoint))
    throw new Error('Loopback Firestore emulator required');
  const [host, port] = endpoint.split(':');
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), release),
      fieldsToData(DRAFT_REVIEW_MANIFEST_FIELDS)
    );
    await setDoc(doc(context.firestore(), `${release}/parts/0`), {
      bytes: Bytes.fromUint8Array(new Uint8Array([1, 2])),
    });
    await setDoc(doc(context.firestore(), `${release}/parts/4`), {
      bytes: Bytes.fromUint8Array(new Uint8Array([1])),
    });
    await setDoc(doc(context.firestore(), `${release}/privateEvidence/raw`), {
      private: true,
    });
  });
});
afterAll(async () => {
  await env?.cleanup();
});

describe('Firebase draft release permission boundary', () => {
  it('allows exact release and part reads for signed-in and anonymous GM sessions', async () => {
    for (const provider of ['password', 'anonymous']) {
      const db = env
        .authenticatedContext(`gm-${provider}`, {
          firebase: { sign_in_provider: provider },
        })
        .firestore();
      await assertSucceeds(getDoc(doc(db, release)));
      await assertSucceeds(getDoc(doc(db, `${release}/parts/0`)));
    }
  });
  it('rejects unsigned reads and all release/part listing', async () => {
    const unsigned = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unsigned, release)));
    await assertFails(getDoc(doc(unsigned, `${release}/parts/0`)));
    const db = env.authenticatedContext('gm').firestore();
    await assertFails(
      getDocs(collection(db, ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION))
    );
    await assertFails(getDocs(collection(db, `${release}/parts`)));
  });
  it('denies client create/update/delete, including another version and all parts', async () => {
    const db = env.authenticatedContext('gm').firestore();
    for (const target of [
      release,
      `${release}/parts/0`,
      `${ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION}/${'a'.repeat(64)}`,
    ]) {
      await assertFails(setDoc(doc(db, target), { forged: true }));
      await assertFails(updateDoc(doc(db, target), { forged: true }));
      await assertFails(deleteDoc(doc(db, target)));
    }
  });
  it('rejects unknown versions, orphan parts, out-of-range parts and raw evidence paths', async () => {
    const db = env.authenticatedContext('gm').firestore();
    for (const target of [
      `${ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION}/latest`,
      `${ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION}/${'a'.repeat(64)}/parts/0`,
      `${release}/parts/4`,
      `${release}/privateEvidence/raw`,
    ])
      await assertFails(getDoc(doc(db, target)));
  });
  it.skipIf(!process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE)(
    'reads and reconstructs all real retained bytes under the deployed rules contract, without client writes',
    async () => {
      const bytes = readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!);
      const documents = prepareDraftReviewDocuments(bytes);
      await env.withSecurityRulesDisabled(async (context) => {
        for (const document of documents) {
          const documentPath = document.name.split('/documents/')[1];
          await setDoc(
            doc(context.firestore(), documentPath),
            fieldsToData(document.fields)
          );
        }
      });
      const db = env.authenticatedContext('real-data-gm').firestore();
      const readDocument = async (document: (typeof documents)[number]) => {
        const snapshot = await getDoc(
          doc(db, document.name.split('/documents/')[1])
        );
        const fields = Object.fromEntries(
          Object.entries(snapshot.data()!).map(([key, value]) => [
            key,
            typeof value === 'string'
              ? { stringValue: value }
              : typeof value === 'number'
                ? { integerValue: String(value) }
                : { bytesValue: value.toBase64() },
          ])
        );
        return { name: document.name, fields };
      };
      verifyDraftReviewManifest(await readDocument(documents[0]));
      const parts = await Promise.all(
        documents
          .slice(1)
          .map(async (document, index) =>
            readDraftReviewPart(await readDocument(document), index)
          )
      );
      const restored = Buffer.concat(parts);
      verifyDraftReviewBytes(restored);
      expect(restored).toEqual(bytes);
      const data = JSON.parse(restored.toString());
      expect(data.records).toHaveLength(278);
      expect(data.unresolved).toHaveLength(29);
      // Same reads again: immutable version and content, no release/world mutation.
      expect(await readDocument(documents[0])).toEqual(documents[0]);
    }
  );
});
