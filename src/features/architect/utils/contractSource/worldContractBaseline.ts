/** Read and validate persisted governed contract baselines for one world. */

import { getDocs } from 'firebase/firestore';

import type { ContractBaselineTeamDocument } from '@/schemas/contractSourceRelease';
import { worldContractBaselinesCol } from '@/features/architect/utils/architectFirestorePaths';
import { getWorldMetadata } from '@/features/architect/utils/worldManager.core';
import {
  parseContractBaselineTeamDocument,
  resolveContractBaselineWorldCompatibility,
  validateContractBaselineDocumentSet,
} from './contractSourceRelease';

export async function getWorldContractBaselineTeam(
  worldId: string,
  teamId: string
): Promise<readonly ContractBaselineTeamDocument[]> {
  const documents = (await listWorldContractBaselines(worldId)).filter(
    (document) => document.teamId === teamId
  );
  if (documents.length === 0) {
    throw new Error(`Governed contract baseline ${teamId} is missing.`);
  }
  return Object.freeze(documents);
}

export async function listWorldContractBaselines(
  worldId: string
): Promise<readonly ContractBaselineTeamDocument[]> {
  const metadata = await getWorldMetadata(worldId);
  const compatibility = resolveContractBaselineWorldCompatibility(metadata);
  if (!compatibility.compatible) throw new Error(compatibility.message);
  const snapshot = await getDocs(worldContractBaselinesCol(worldId));
  const documents = snapshot.docs
    .map((entry) =>
      parseContractBaselineTeamDocument(entry.data(), {
        worldId,
        release: compatibility.metadata.contractSourceRelease,
      })
    );
  return validateContractBaselineDocumentSet(
    documents,
    compatibility.metadata.contractBaselineCoverage.total
  );
}
