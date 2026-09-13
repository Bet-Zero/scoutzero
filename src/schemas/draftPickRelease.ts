/** Pins come from the retained review record, never from the payload being loaded. */
import { z } from 'zod';
import {
  DraftEvidenceHashZ,
  DraftFoundationReleaseZ,
} from '@/schemas/draftPickEvidence';

export const DraftPickReleasePinZ = z
  .object({
    payloadSha256: DraftEvidenceHashZ,
    release: DraftFoundationReleaseZ,
  })
  .strict();

export const DraftPickReleaseUseZ = z.enum(['retained-baseline', 'proposal']);

export type DraftPickReleasePin = z.infer<typeof DraftPickReleasePinZ>;
export type DraftPickReleaseUse = z.infer<typeof DraftPickReleaseUseZ>;
