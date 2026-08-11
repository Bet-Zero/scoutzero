/** Deterministic concurrency token for every writable contract overlay on a team. */

import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import {
  createContractEventLedger,
  toContractEventLedgerPayload,
} from '@/features/architect/utils/contractHistory';
import { deterministicStateDigest } from '@/features/architect/utils/contractSource/deterministicDigest';

export function contractOverlaySetDigest(
  overlays: readonly ContractEventLedgerPayload[] | null | undefined
): string {
  const normalized = [...(overlays ?? [])]
    .map((overlay) =>
      toContractEventLedgerPayload(createContractEventLedger(overlay))
    )
    .sort((left, right) => left.ledgerId.localeCompare(right.ledgerId));
  return deterministicStateDigest(normalized);
}
