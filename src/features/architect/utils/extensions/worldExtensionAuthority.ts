/** Read-only bridge from immutable world Contract baselines to extension actions. */

import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import {
  createContractEventLedger,
  walkChain,
} from '@/features/architect/utils/contractHistory';
import { listWorldContractBaselines } from '@/features/architect/utils/contractSource/worldContractBaseline';
import { resolveContractBaselineWorldCompatibility } from '@/features/architect/utils/contractSource/contractSourceRelease';
import { getWorldMetadata } from '@/features/architect/utils/worldManager.core';
import {
  inspectGovernedExtension,
  resolveGovernedExtensionLedgerAuthority,
  type GovernedExtensionAvailability,
  type GovernedExtensionLedgerAuthority,
} from './governedExtension';

export interface WorldGovernedExtensionEntry {
  readonly playerId: string;
  readonly contractId: string;
  readonly authority: GovernedExtensionLedgerAuthority;
  readonly availability: GovernedExtensionAvailability;
}

function latestState(ledgerInput: ContractEventLedgerPayload) {
  const ledger = createContractEventLedger(ledgerInput);
  const chain = walkChain(
    ledger.events.filter((event) => event.recordStatus === 'current')
  );
  return chain?.at(-1)?.resultingState ?? null;
}

export async function loadWorldGovernedExtensionEntries({
  worldId,
  teamId,
  overlays = [],
  worldAsOfDate,
}: {
  worldId: string;
  teamId: string;
  overlays?: readonly ContractEventLedgerPayload[] | null;
  worldAsOfDate: string;
}): Promise<readonly WorldGovernedExtensionEntry[]> {
  const [documents, metadata] = await Promise.all([
    listWorldContractBaselines(worldId),
    getWorldMetadata(worldId),
  ]);
  const compatibility = resolveContractBaselineWorldCompatibility(metadata);
  if (!compatibility.compatible) throw new Error(compatibility.message);
  const baselineSalaryCapYear =
    compatibility.metadata.contractBaselineSalaryCapYear;
  const overlayByLedgerId = new Map(
    (overlays ?? []).map((ledger) => [ledger.ledgerId, ledger] as const)
  );
  const entries: WorldGovernedExtensionEntry[] = [];
  for (const baselineLedger of documents.flatMap(
    (document) => document.ledgers
  )) {
    let authority: GovernedExtensionLedgerAuthority;
    let overlayError: string | null = null;
    try {
      authority = resolveGovernedExtensionLedgerAuthority({
        baselineLedger,
        overlayLedger: overlayByLedgerId.get(baselineLedger.ledgerId),
        baselineSalaryCapYear,
      });
    } catch (error) {
      overlayError =
        error instanceof Error
          ? error.message
          : 'The writable governed Contract history is unreadable.';
      try {
        authority = resolveGovernedExtensionLedgerAuthority({
          baselineLedger,
          baselineSalaryCapYear,
        });
      } catch {
        continue;
      }
    }
    const state = latestState(authority.currentLedger);
    if (!state || state.teamId !== teamId) continue;
    const availability = overlayError
      ? Object.freeze({
          status: 'incompatible' as const,
          playerId: state.playerId,
          contractId: state.contractId,
          reasons: Object.freeze([
            `Governed Contract history is incompatible: ${overlayError}`,
          ]),
          suggestedRoute: null,
          allowedRoutes: Object.freeze([]),
          firstExtendedSeason: null,
        })
      : inspectGovernedExtension({
          authority,
          worldAsOfDate,
          playerId: state.playerId,
          contractId: state.contractId,
        });
    entries.push(
      Object.freeze({
        playerId: state.playerId,
        contractId: state.contractId,
        authority,
        availability,
      })
    );
  }
  return Object.freeze(entries);
}

export async function loadWorldGovernedExtensionAuthority({
  worldId,
  contractId,
  overlays = [],
}: {
  worldId: string;
  contractId: string;
  overlays?: readonly ContractEventLedgerPayload[] | null;
}): Promise<GovernedExtensionLedgerAuthority> {
  const [documents, metadata] = await Promise.all([
    listWorldContractBaselines(worldId),
    getWorldMetadata(worldId),
  ]);
  const compatibility = resolveContractBaselineWorldCompatibility(metadata);
  if (!compatibility.compatible) throw new Error(compatibility.message);
  const baselineLedger = documents
    .flatMap((document) => document.ledgers)
    .find((ledger) =>
      ledger.events.some((event) => event.contractId === contractId)
    );
  if (!baselineLedger) {
    throw new Error(
      `Governed Contract ${contractId} is missing from the pinned release.`
    );
  }
  const overlay = (overlays ?? []).find(
    (ledger) => ledger.ledgerId === baselineLedger.ledgerId
  );
  return resolveGovernedExtensionLedgerAuthority({
    baselineLedger,
    overlayLedger: overlay,
    baselineSalaryCapYear: compatibility.metadata.contractBaselineSalaryCapYear,
  });
}
