/** Read-only bridge from immutable governed Contract baselines to waiver actions. */

import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import {
  createContractEventLedger,
  walkChain,
} from '@/features/architect/utils/contractHistory';
import { listWorldContractBaselines } from '@/features/architect/utils/contractSource/worldContractBaseline';
import { resolveContractBaselineWorldCompatibility } from '@/features/architect/utils/contractSource/contractSourceRelease';
import { getWorldMetadata } from '@/features/architect/utils/worldManager.core';
import {
  resolveGovernedOptionLedgerAuthority,
  type GovernedOptionLedgerAuthority,
} from '@/features/architect/utils/optionDecisions';
import {
  inspectGovernedWaiver,
  type GovernedWaiverAvailability,
} from './governedWaiver';
import type { GovernedWaiverLifecycle } from '@/schemas/governedWaiver';

export interface WorldGovernedWaiverEntry {
  readonly playerId: string;
  readonly contractId: string;
  readonly authority: GovernedOptionLedgerAuthority;
  readonly availability: GovernedWaiverAvailability;
}

function latestState(ledgerInput: ContractEventLedgerPayload) {
  const ledger = createContractEventLedger(ledgerInput);
  const chain = walkChain(
    ledger.events.filter((event) => event.recordStatus === 'current')
  );
  return chain?.at(-1)?.resultingState ?? null;
}

async function baselineContext(worldId: string) {
  const [documents, metadata] = await Promise.all([
    listWorldContractBaselines(worldId),
    getWorldMetadata(worldId),
  ]);
  const compatibility = resolveContractBaselineWorldCompatibility(metadata);
  if (!compatibility.compatible) throw new Error(compatibility.message);
  return {
    ledgers: documents.flatMap((document) => document.ledgers),
    baselineSalaryCapYear:
      compatibility.metadata.contractBaselineSalaryCapYear,
  };
}

export async function loadWorldGovernedWaiverEntries({
  worldId,
  teamId,
  overlays = [],
  existingLifecycles = [],
  worldAsOfDate,
}: {
  worldId: string;
  teamId: string;
  overlays?: readonly ContractEventLedgerPayload[] | null;
  existingLifecycles?: readonly GovernedWaiverLifecycle[] | null;
  worldAsOfDate: string;
}): Promise<readonly WorldGovernedWaiverEntry[]> {
  const context = await baselineContext(worldId);
  const overlayByLedgerId = new Map(
    (overlays ?? []).map((ledger) => [ledger.ledgerId, ledger] as const)
  );
  const entries: WorldGovernedWaiverEntry[] = [];
  for (const baselineLedger of context.ledgers) {
    let authority: GovernedOptionLedgerAuthority;
    let overlayError: string | null = null;
    try {
      authority = resolveGovernedOptionLedgerAuthority({
        baselineLedger,
        overlayLedger: overlayByLedgerId.get(baselineLedger.ledgerId),
        baselineSalaryCapYear: context.baselineSalaryCapYear,
      });
    } catch (error) {
      overlayError =
        error instanceof Error
          ? error.message
          : 'The saved Contract history cannot be read.';
      try {
        authority = resolveGovernedOptionLedgerAuthority({
          baselineLedger,
          baselineSalaryCapYear: context.baselineSalaryCapYear,
        });
      } catch {
        continue;
      }
    }
    const state = latestState(authority.currentLedger);
    if (!state || state.teamId !== teamId) continue;
    entries.push(
      Object.freeze({
        playerId: state.playerId,
        contractId: state.contractId,
        authority,
        availability: overlayError
          ? Object.freeze({
              status: 'incompatible' as const,
              playerId: state.playerId,
              contractId: state.contractId,
              reasons: Object.freeze([
                `Saved Contract history is incompatible: ${overlayError}`,
              ]),
            })
          : inspectGovernedWaiver({
              authority,
              existingLifecycles,
              worldId,
              teamId,
              playerId: state.playerId,
              contractId: state.contractId,
              worldAsOfDate,
            }),
      })
    );
  }
  return Object.freeze(entries);
}

export async function loadWorldGovernedWaiverAuthority({
  worldId,
  contractId,
  overlays = [],
}: {
  worldId: string;
  contractId: string;
  overlays?: readonly ContractEventLedgerPayload[] | null;
}): Promise<GovernedOptionLedgerAuthority> {
  const context = await baselineContext(worldId);
  const baselineLedger = context.ledgers.find((ledger) =>
    ledger.events.some((event) => event.contractId === contractId)
  );
  if (!baselineLedger) {
    throw new Error(`Required Contract ${contractId} is missing from this Team Plan.`);
  }
  const overlay = (overlays ?? []).find(
    (ledger) => ledger.ledgerId === baselineLedger.ledgerId
  );
  return resolveGovernedOptionLedgerAuthority({
    baselineLedger,
    overlayLedger: overlay,
    baselineSalaryCapYear: context.baselineSalaryCapYear,
  });
}
