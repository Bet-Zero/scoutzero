/** JSON-safe review inputs. No world adoption or executable-asset schema. */
import { z } from 'zod';
import { DraftApronInputZ } from '@/schemas/draftApron';
import {
  DraftOperationContextZ,
  DraftOperationRequestZ,
} from '@/schemas/draftPickOperation';

export const DraftPickReviewInputZ = z
  .object({
    request: DraftOperationRequestZ,
    facts: z.array(z.json()),
    apron: z.array(z.json()),
  })
  .strict();

export const DraftPickApronContextZ = z
  .object({
    context: DraftOperationContextZ,
    input: DraftApronInputZ,
  })
  .strict();

export type DraftPickReviewInput = z.infer<typeof DraftPickReviewInputZ>;
