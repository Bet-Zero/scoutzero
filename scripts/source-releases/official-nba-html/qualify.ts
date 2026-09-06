/** Provenance and primary-source gate, separate from byte proof and fact assessment. */
import { z } from 'zod';
import { compareOfficialHtml, sha256 } from './compare';

const pr = 'https://pr.nba.com/';
const catalog: Record<
  string,
  {
    url: string;
    primary: boolean;
    mode: 'monitoring-timing' | 'security-presence' | 'exact-only';
  }
> = {
  '2026-results': {
    url: 'https://www.nba.com/news/2026-nba-draft-order',
    primary: true,
    mode: 'security-presence',
  },
  '2026-lottery': {
    url: `${pr}2026-nba-draft-lottery-results/`,
    primary: true,
    mode: 'monitoring-timing',
  },
  '2026-ties': {
    url: `${pr}2026-nba-draft-tiebreakers/`,
    primary: true,
    mode: 'monitoring-timing',
  },
  '2026-notes': {
    url: `${pr}2026-nba-draft-notes/`,
    primary: true,
    mode: 'monitoring-timing',
  },
  '2025-lottery': {
    url: `${pr}2025-nba-draft-lottery-results/`,
    primary: true,
    mode: 'monitoring-timing',
  },
  '2025-ties': {
    url: `${pr}2025-nba-draft-tiebreakers/`,
    primary: true,
    mode: 'monitoring-timing',
  },
  '2022-lottery': {
    url: `${pr}2022-nba-draft-lottery-results/`,
    primary: true,
    mode: 'exact-only',
  },
  '2022-ties': {
    url: `${pr}2022-nba-draft-tiebreakers/`,
    primary: true,
    mode: 'exact-only',
  },
  '2023-ties': {
    url: `${pr}ties-broken-for-order-of-selection-in-nba-draft-2023-presented-by-state-farm/`,
    primary: true,
    mode: 'exact-only',
  },
  '2026-lottery-story': {
    url: 'https://www.nba.com/news/2026-nba-draft-lottery-result',
    primary: false,
    mode: 'exact-only',
  },
  '2026-draft-board': {
    url: 'https://www.nba.com/draft/2026/draft-board',
    primary: true,
    mode: 'exact-only',
  },
};
export const REGISTERED_SOURCE_IDS = Object.freeze(Object.keys(catalog).sort());
const hashZ = z.string().regex(/^[a-f0-9]{64}$/);
const timeZ = z.string().datetime({ offset: true });
const identityZ = z.object({
  targetId: z.string(),
  requestedUrl: z.string(),
  finalUrl: z.string(),
  sha256: hashZ,
  byteSize: z.number().int().positive(),
});
const metadataZ = z.object({
  publisher: z.enum(['NBA / NBA Communications', 'NBA Communications']),
  httpStatus: z.literal(200),
  contentType: z.string().regex(/^text\/html;\s*charset=utf-8$/i),
  startedAt: timeZ,
  completedAt: timeZ,
  method: z.string().min(1),
  metadataRecoveryLimitation: z.literal(false).optional(),
});
export type RetainedCapture = { bytes: Buffer; receiptBytes: Buffer };

/** Eligibility is conditional on retained-package recovery, never a fact verdict. */
export function qualifyRetainedPair(
  sourceId: string,
  captures: readonly RetainedCapture[]
) {
  const source = catalog[sourceId];
  if (!Object.hasOwn(catalog, sourceId) || !source)
    throw new Error('Unregistered source');
  if (captures.length !== 2) throw new Error('Exactly two originals required');
  const reasons: string[] = [];
  const receipts = captures.map((capture, i) => {
    const receipt: unknown = JSON.parse(capture.receiptBytes.toString('utf8'));
    const identity = identityZ.parse(receipt);
    if (
      identity.targetId !== sourceId ||
      identity.requestedUrl !== source.url ||
      identity.finalUrl !== source.url
    )
      throw new Error('Wrong-source pairing');
    if (
      identity.sha256 !== sha256(capture.bytes) ||
      identity.byteSize !== capture.bytes.length
    )
      throw new Error('Original response tampering or size mismatch');
    const metadata = metadataZ.safeParse(receipt);
    if (!metadata.success)
      reasons.push(`capture-${i + 1}: incomplete or unsupported provenance`);
    else if (
      Date.parse(metadata.data.completedAt) <
      Date.parse(metadata.data.startedAt)
    )
      reasons.push(`capture-${i + 1}: reversed capture times`);
    return {
      receipt,
      metadata,
      identity,
      receiptSha256: sha256(capture.receiptBytes),
    };
  });
  if (
    receipts.every((r) => r.metadata.success) &&
    receipts[0].metadata.data?.startedAt ===
      receipts[1].metadata.data?.startedAt
  )
    reasons.push('Two distinct capture events are required');
  if (!source.primary)
    reasons.push('Secondary AP reporting is not official primary authority');
  let byteProof: ReturnType<typeof compareOfficialHtml> | null = null;
  try {
    byteProof = compareOfficialHtml(
      captures[0].bytes,
      captures[1].bytes,
      source.mode
    );
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : String(error));
  }
  return {
    sourceId,
    url: source.url,
    officialPrimary: source.primary,
    eligibleAfterIndependentRecovery: reasons.length === 0,
    blockers: reasons,
    byteProof,
    provenance: receipts.map(({ receiptSha256, receipt }) => ({
      receiptSha256,
      receipt,
    })),
    supportedFactsAutomaticallyAdded: 0,
    completeRequirementsAutomaticallySatisfied: 0,
    runtimeAuthority: false,
  };
}
