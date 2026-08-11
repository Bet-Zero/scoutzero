/** Read-only bridge from immutable world baselines to the option action. */

import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import {
  createContractEventLedger,
  walkChain,
} from '@/features/architect/utils/contractHistory';
import { getWorldContractBaselineTeam } from '@/features/architect/utils/contractSource/worldContractBaseline';
import { resolveContractBaselineWorldCompatibility } from '@/features/architect/utils/contractSource/contractSourceRelease';
import { getWorldMetadata } from '@/features/architect/utils/worldManager.core';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  inspectGovernedOptionDecision,
  resolveGovernedOptionLedgerAuthority,
  type GovernedOptionDecisionAvailability,
  type GovernedOptionLedgerAuthority,
} from './governedOptionDecision';

export interface WorldGovernedOptionEntry {
  readonly playerId: string;
  readonly contractId: string;
  readonly targetYear: number;
  readonly authority: GovernedOptionLedgerAuthority;
  readonly availability: GovernedOptionDecisionAvailability;
}

function latestState(ledgerInput: ContractEventLedgerPayload) {
  const ledger = createContractEventLedger(ledgerInput);
  const chain = walkChain(
    ledger.events.filter((event) => event.recordStatus === 'current')
  );
  return chain?.at(-1)?.resultingState ?? null;
}

export async function loadWorldGovernedOptionEntries({
  worldId,
  teamId,
  overlays = [],
  worldAsOfDate,
}: {
  worldId: string;
  teamId: string;
  overlays?: readonly ContractEventLedgerPayload[] | null;
  worldAsOfDate: string;
}): Promise<readonly WorldGovernedOptionEntry[]> {
  const [documents, metadata] = await Promise.all([
    getWorldContractBaselineTeam(worldId, teamId),
    getWorldMetadata(worldId),
  ]);
  const compatibility = resolveContractBaselineWorldCompatibility(metadata);
  if (!compatibility.compatible) throw new Error(compatibility.message);
  const baselineSalaryCapYear =
    compatibility.metadata.contractBaselineSalaryCapYear;
  const overlayByLedgerId = new Map(
    (overlays ?? []).map((ledger) => [ledger.ledgerId, ledger] as const)
  );
  const entries: WorldGovernedOptionEntry[] = [];
  for (const baselineLedger of documents.flatMap(
    (document) => document.ledgers
  )) {
    const authority = resolveGovernedOptionLedgerAuthority({
      baselineLedger,
      overlayLedger: overlayByLedgerId.get(baselineLedger.ledgerId),
      baselineSalaryCapYear,
    });
    const state = latestState(authority.currentLedger);
    if (!state) continue;
    state.terms.salaries.forEach((row) => {
      if (!row.option) return;
      const targetYear = toEndYear(row.season);
      if (!targetYear) return;
      entries.push(
        Object.freeze({
          playerId: state.playerId,
          contractId: state.contractId,
          targetYear,
          authority,
          availability: inspectGovernedOptionDecision({
            authority,
            worldId,
            teamId,
            playerId: state.playerId,
            contractId: state.contractId,
            targetYear,
            baselineSalaryCapYear,
            worldAsOfDate,
          }),
        })
      );
    });
  }
  return Object.freeze(entries);
}

export async function loadWorldGovernedOptionAuthority({
  worldId,
  teamId,
  contractId,
  overlays = [],
}: {
  worldId: string;
  teamId: string;
  contractId: string;
  overlays?: readonly ContractEventLedgerPayload[] | null;
}): Promise<GovernedOptionLedgerAuthority> {
  const [documents, metadata] = await Promise.all([
    getWorldContractBaselineTeam(worldId, teamId),
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
      `Governed contract ${contractId} is missing from the pinned release.`
    );
  }
  const overlay = (overlays ?? []).find(
    (ledger) => ledger.ledgerId === baselineLedger.ledgerId
  );
  return resolveGovernedOptionLedgerAuthority({
    baselineLedger,
    overlayLedger: overlay,
    baselineSalaryCapYear: compatibility.metadata.contractBaselineSalaryCapYear,
  });
}
