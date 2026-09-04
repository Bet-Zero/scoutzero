/** Strict contract for privately retained Pro Sports Transactions source releases. */

import { z } from 'zod';

const NonEmptyStringZ = z.string().trim().min(1);
const Sha256Z = z.string().regex(/^[0-9a-f]{64}$/);
const CaptureTimestampZ = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/);
const CalendarDateZ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SafeRelativePathZ = NonEmptyStringZ.refine(
  (value) =>
    !value.startsWith('/') &&
    !value.startsWith('\\') &&
    !value.split(/[\\/]/).includes('..'),
  'must be a safe relative path'
);
const PublicPstUrlZ = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.prosportstransactions.com'
    );
  }, 'must be a public HTTPS Pro Sports Transactions URL');

export const PstReleaseArtifactZ = z.strictObject({
  relativePath: SafeRelativePathZ,
  byteSize: z.number().int().nonnegative(),
  sha256: Sha256Z,
});

export const PstSourcePageCaptureZ = z.strictObject({
  sequence: z.number().int().min(1).max(42),
  captureId: NonEmptyStringZ,
  sourcePageId: z.string().regex(/^(year-index|team-[A-Z]{3}|year-\d{4})$/),
  classification: z.enum(['canonical-required', 'repeat-evidence']),
  repeatOf: z
    .string()
    .regex(/^(team-[A-Z]{3}|year-\d{4})$/)
    .nullable(),
  pageType: z.enum(['index', 'team', 'year']),
  expectedIdentity: NonEmptyStringZ,
  requestedUrl: PublicPstUrlZ,
  finalUrl: PublicPstUrlZ,
  pageTitle: NonEmptyStringZ,
  captureStartedAt: CaptureTimestampZ,
  captureCompletedAt: CaptureTimestampZ,
  pstLastUpdated: CalendarDateZ.nullable(),
  semanticSha256: Sha256Z,
  rawResponse: PstReleaseArtifactZ,
  serializedDom: PstReleaseArtifactZ,
  screenshot: PstReleaseArtifactZ.extend({
    width: z.literal(1280),
    height: z.literal(720),
  }),
});

export const PstSourceReleasePinZ = z.strictObject({
  releaseId: NonEmptyStringZ,
  releaseVersion: z.number().int().min(1),
  releaseDigestSha256: Sha256Z,
});

export const PstSourceReleaseZ = z.strictObject({
  schemaVersion: z.literal('scoutzero-pst-source-release/v1'),
  releaseId: NonEmptyStringZ,
  releaseVersion: z.literal(1),
  releaseDigestSha256: Sha256Z,
  supersedes: PstSourceReleasePinZ.nullable(),
  source: z.strictObject({
    provider: z.literal('Pro Sports Transactions'),
    sourceFamily: z.literal('NBA draft-pick transactions'),
    captureIssue: z.string().regex(/^BZE-\d+$/),
    governanceIssue: z.string().regex(/^BZE-\d+$/),
    capturedAt: z.strictObject({
      startedAt: CaptureTimestampZ,
      completedAt: CaptureTimestampZ,
    }),
  }),
  sourceCaptureManifest: z.strictObject({
    schemaVersion: NonEmptyStringZ,
    relativePath: SafeRelativePathZ,
    sha256: Sha256Z,
    sidecarRelativePath: SafeRelativePathZ,
  }),
  package: z.strictObject({
    archiveName: z.string().regex(/^[A-Za-z0-9._-]+\.tar\.gz$/),
    byteSize: z.number().int().positive(),
    sha256: Sha256Z,
    packageFileCount: z.literal(128),
    capturedFileCount: z.literal(126),
    remoteRetention: z.strictObject({
      provider: z.literal('Linear'),
      issueIdentifier: z.literal('BZE-305'),
      attachmentId: z.string().uuid(),
      attachmentUrl: z
        .string()
        .url()
        .refine(
          (value) => new URL(value).hostname === 'uploads.linear.app',
          'must identify a Linear-hosted asset'
        ),
      authenticatedRetrievalRequired: z.literal(true),
    }),
  }),
  canonicalPolicy: z.strictObject({
    canonicalBytes: z.literal('raw-response-html'),
    requiredPageCount: z.literal(39),
    repeatCaptureCount: z.literal(3),
    secondaryEvidence: z.tuple([
      z.literal('serialized-dom'),
      z.literal('screenshot'),
    ]),
  }),
  counts: z.strictObject({
    pageCaptures: z.literal(42),
    canonicalRequiredPages: z.literal(39),
    repeatEvidenceCaptures: z.literal(3),
    rawHtmlFiles: z.literal(42),
    serializedDomFiles: z.literal(42),
    screenshotFiles: z.literal(42),
  }),
  pages: z.array(PstSourcePageCaptureZ).length(42),
  sourceUse: z.strictObject({
    inspectedAt: CalendarDateZ,
    copyrightNotice: NonEmptyStringZ,
    acknowledgementsUrl: PublicPstUrlZ,
    notices: z.array(
      z.strictObject({
        category: z.enum([
          'copyright',
          'attribution',
          'terms',
          'privacy',
          'robots',
          'license',
          'reuse',
        ]),
        finding: NonEmptyStringZ,
      })
    ),
    expressReuseLicenseFound: z.literal(false),
    legalConclusion: z.literal('none'),
    distributionBoundary: z.literal('private-internal-evidence-only'),
  }),
  limitations: z.array(NonEmptyStringZ).min(1),
});

export type PstReleaseArtifact = z.infer<typeof PstReleaseArtifactZ>;
export type PstSourcePageCapture = z.infer<typeof PstSourcePageCaptureZ>;
export type PstSourceRelease = z.infer<typeof PstSourceReleaseZ>;
