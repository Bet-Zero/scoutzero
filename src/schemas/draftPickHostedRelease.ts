import { z } from 'zod';

const text = z.object({ stringValue: z.string() }).strict();
const integer = z.object({ integerValue: z.string().regex(/^\d+$/) }).strict();

/** Firestore REST wire contract; no URLs, provider selectors, or mutable pointers. */
export const DraftPickHostedManifestFieldsZ = z
  .object({
    format: text,
    payloadSha256: text,
    inventorySha256: text,
    acceptanceReference: text,
    byteLength: integer,
    partBytes: integer,
    partCount: integer,
  })
  .strict();

export const DraftPickHostedPartFieldsZ = z
  .object({
    payloadSha256: text,
    index: integer,
    bytes: z.object({ bytesValue: z.string() }).strict(),
  })
  .strict();
