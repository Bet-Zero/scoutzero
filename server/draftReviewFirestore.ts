import { createHash } from 'node:crypto';
import {
  ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION,
  ARCHITECT_DRAFT_PICK_RELEASE_PARTS_SUBCOLLECTION,
} from '../src/constants/collections.js';
import { REAL_DRAFT_REVIEW_PIN } from '../src/features/architect/utils/draftPickRealReviewPin.js';
import {
  DraftPickHostedManifestFieldsZ,
  DraftPickHostedPartFieldsZ,
} from '../src/schemas/draftPickHostedRelease.js';

export const DRAFT_REVIEW_PROJECT_ID = 'scoutzero-bf1ae';
export const DRAFT_REVIEW_PART_BYTES = 524288;
export const DRAFT_REVIEW_BYTE_LENGTH = 1608904;
export const DRAFT_REVIEW_PART_COUNT = Math.ceil(
  DRAFT_REVIEW_BYTE_LENGTH / DRAFT_REVIEW_PART_BYTES
);
export const DRAFT_REVIEW_DOCUMENT = `projects/${DRAFT_REVIEW_PROJECT_ID}/databases/(default)/documents/${ARCHITECT_DRAFT_PICK_RELEASES_COLLECTION}/${REAL_DRAFT_REVIEW_PIN.payloadSha256}`;
export const DRAFT_REVIEW_MANIFEST_FIELDS = Object.freeze({
  format: { stringValue: 'scoutzero-draft-review/v1' },
  payloadSha256: { stringValue: REAL_DRAFT_REVIEW_PIN.payloadSha256 },
  inventorySha256: { stringValue: REAL_DRAFT_REVIEW_PIN.inventorySha256 },
  acceptanceReference: {
    stringValue: REAL_DRAFT_REVIEW_PIN.acceptanceReference,
  },
  byteLength: { integerValue: String(DRAFT_REVIEW_BYTE_LENGTH) },
  partBytes: { integerValue: String(DRAFT_REVIEW_PART_BYTES) },
  partCount: { integerValue: String(DRAFT_REVIEW_PART_COUNT) },
});

export function draftReviewPartDocument(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= DRAFT_REVIEW_PART_COUNT)
    throw new Error('Invalid release part');
  return `${DRAFT_REVIEW_DOCUMENT}/${ARCHITECT_DRAFT_PICK_RELEASE_PARTS_SUBCOLLECTION}/${index}`;
}

/** Pure preparation only. Publication requires its separate authorization gate. */
export function prepareDraftReviewDocuments(bytes: Buffer) {
  verifyDraftReviewBytes(bytes);
  return [
    { name: DRAFT_REVIEW_DOCUMENT, fields: DRAFT_REVIEW_MANIFEST_FIELDS },
    ...Array.from({ length: DRAFT_REVIEW_PART_COUNT }, (_, index) => ({
      name: draftReviewPartDocument(index),
      fields: {
        payloadSha256: { stringValue: REAL_DRAFT_REVIEW_PIN.payloadSha256 },
        index: { integerValue: String(index) },
        bytes: {
          bytesValue: bytes
            .subarray(
              index * DRAFT_REVIEW_PART_BYTES,
              (index + 1) * DRAFT_REVIEW_PART_BYTES
            )
            .toString('base64'),
        },
      },
    })),
  ];
}

export function verifyDraftReviewBytes(bytes: Buffer): void {
  if (
    bytes.length !== DRAFT_REVIEW_BYTE_LENGTH ||
    createHash('sha256').update(bytes).digest('hex') !==
      REAL_DRAFT_REVIEW_PIN.payloadSha256
  )
    throw new Error('Unrecognized release');
}

/** Response names and every manifest field must match the pinned version. */
export function verifyDraftReviewManifest(value: unknown): void {
  const fields = DraftPickHostedManifestFieldsZ.parse(
    documentFields(value, DRAFT_REVIEW_DOCUMENT)
  );
  if (JSON.stringify(fields) !== JSON.stringify(DRAFT_REVIEW_MANIFEST_FIELDS))
    throw new Error('Unrecognized release manifest');
}

export function readDraftReviewPart(value: unknown, index: number): Buffer {
  const fields = DraftPickHostedPartFieldsZ.parse(
    documentFields(value, draftReviewPartDocument(index))
  );
  const encoded = fields.bytes.bytesValue;
  const bytes = Buffer.from(encoded, 'base64');
  if (
    fields.index.integerValue !== String(index) ||
    fields.payloadSha256.stringValue !== REAL_DRAFT_REVIEW_PIN.payloadSha256 ||
    bytes.toString('base64') !== encoded ||
    bytes.length !==
      Math.min(
        DRAFT_REVIEW_PART_BYTES,
        DRAFT_REVIEW_BYTE_LENGTH - index * DRAFT_REVIEW_PART_BYTES
      )
  )
    throw new Error('Invalid release part');
  return bytes;
}

function documentFields(value: unknown, name: string): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    !('name' in value) ||
    value.name !== name ||
    !('fields' in value)
  )
    throw new Error('Invalid release document');
  return value.fields;
}
