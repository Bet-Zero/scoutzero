import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  BUNDLED_CONTRACT_SOURCE_RELEASE_PIN,
  verifyContractSourceRelease,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import { decodeContractFieldEvidence } from '@/schemas/governedContractState';
import type {
  ContractSourceBaselineRecord,
  ContractSourceObservation,
  ContractSourceRelease,
} from '@/schemas/contractSourceRelease';

export const RETAINED_CONTRACT_RELEASE_FILENAME =
  'salaryswish-retained-2026-06-05-v1.json';
export const RETAINED_CONTRACT_RELEASE_PATH = path.resolve(
  process.cwd(),
  'public/architect/contract-source-releases',
  RETAINED_CONTRACT_RELEASE_FILENAME
);

export const RETAINED_AUSTIN_PLAYER_ID = 'austin_reaves';
export const RETAINED_AUSTIN_TEAM_ID = 'LAL';
export const RETAINED_AUSTIN_CONTRACT_ID =
  'salaryswish:austin-reaves:july-6-2023:2023-24:2026-27:veteran-contract';
export const RETAINED_AUSTIN_TRADE_KICKER_PERCENT = 15;
export const RETAINED_AUSTIN_MISSING_EVIDENCE = 'missing-bonus-allocation';

export type RetainedContractArtifactDescriptor = {
  artifactSha256: string;
  releaseId: string;
  releaseVersion: number;
  releaseDigest: string;
};

export const RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR = Object.freeze({
  artifactSha256:
    'sha256:23304518f145babfe19ab5341fc60449f39bbfa2b06ad3ce15ef3b3159b91389',
  releaseId: BUNDLED_CONTRACT_SOURCE_RELEASE_PIN.releaseId,
  releaseVersion: BUNDLED_CONTRACT_SOURCE_RELEASE_PIN.releaseVersion,
  releaseDigest: BUNDLED_CONTRACT_SOURCE_RELEASE_PIN.releaseDigest,
} satisfies RetainedContractArtifactDescriptor);

type RecordLike = Record<string, unknown>;

export type RetainedAustinTradeBonusAuthority = {
  artifactSha256: string;
  release: ContractSourceRelease;
  record: ContractSourceBaselineRecord;
  observation: ContractSourceObservation;
  player: RecordLike;
  contractIdentity: {
    contractId: string;
    playerId: string;
    teamId: string;
    sourceObservationId: string;
    sourceContractPath: 'contract';
    resultingStateDigest: string;
  };
  tradeKickerPercent: number;
  missingEvidence: string;
};

const isRecord = (value: unknown): value is RecordLike =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const retainedArtifactSha256 = (artifact: Uint8Array): string =>
  `sha256:${createHash('sha256').update(artifact).digest('hex')}`;

const requireExactlyOne = <T>(values: T[], label: string): T => {
  if (values.length !== 1) {
    throw new Error(
      `Retained Austin trade-bonus proof requires exactly one ${label}; found ${values.length}.`
    );
  }
  return values[0];
};

export function deriveRetainedAustinTradeBonusAuthority(
  release: ContractSourceRelease,
  artifactSha256: string
): RetainedAustinTradeBonusAuthority {
  const record = requireExactlyOne(
    release.records.filter(
      (candidate) =>
        candidate.playerId === RETAINED_AUSTIN_PLAYER_ID &&
        candidate.resultingState.playerId === RETAINED_AUSTIN_PLAYER_ID &&
        candidate.teamId === RETAINED_AUSTIN_TEAM_ID &&
        candidate.resultingState.teamId === RETAINED_AUSTIN_TEAM_ID
    ),
    'governed Austin Reaves contract identity'
  );
  if (
    record.contractId !== RETAINED_AUSTIN_CONTRACT_ID ||
    record.resultingState.contractId !== RETAINED_AUSTIN_CONTRACT_ID ||
    record.sourceContractPath !== 'contract'
  ) {
    throw new Error(
      'Retained Austin trade-bonus proof found a changed governed Contract identity.'
    );
  }

  const observation = requireExactlyOne(
    release.observations.filter(
      (candidate) =>
        candidate.observationId === record.sourceObservationId &&
        candidate.playerId === RETAINED_AUSTIN_PLAYER_ID &&
        candidate.teamId === RETAINED_AUSTIN_TEAM_ID
    ),
    'authenticated Austin Reaves source observation'
  );
  const player = JSON.parse(observation.artifactContent) as unknown;
  if (
    !isRecord(player) ||
    player.playerId !== RETAINED_AUSTIN_PLAYER_ID ||
    player.teamCode !== RETAINED_AUSTIN_TEAM_ID ||
    typeof player.displayName !== 'string' ||
    !isRecord(player.contract)
  ) {
    throw new Error(
      'Retained Austin trade-bonus proof source observation has a changed player identity.'
    );
  }

  const tradeKickerPercent =
    record.resultingState.terms.bonuses.tradeKickerPercent;
  if (tradeKickerPercent !== RETAINED_AUSTIN_TRADE_KICKER_PERCENT) {
    throw new Error(
      `Retained Austin trade-bonus proof requires the authenticated ${RETAINED_AUSTIN_TRADE_KICKER_PERCENT}% kicker; found ${String(tradeKickerPercent)}.`
    );
  }
  if (player.contract.tradeKicker !== tradeKickerPercent) {
    throw new Error(
      'Retained Austin trade-bonus proof source observation and governed record disagree on the kicker.'
    );
  }

  const bonusEvidence = requireExactlyOne(
    record.resultingState.evidence
      .map((receipt) => decodeContractFieldEvidence(receipt))
      .filter((receipt) => receipt.fieldPath === 'terms.bonuses'),
    'governed Austin Reaves bonus-evidence receipt'
  );
  if (
    bonusEvidence.limitationIds.length !== 1 ||
    bonusEvidence.limitationIds[0] !== RETAINED_AUSTIN_MISSING_EVIDENCE
  ) {
    throw new Error(
      `Retained Austin trade-bonus proof requires ${RETAINED_AUSTIN_MISSING_EVIDENCE} evidence; found ${bonusEvidence.limitationIds.join(', ') || 'none'}.`
    );
  }
  const limitationCatalogEntries =
    release.source.evidenceCatalog.limitations.filter(
      (entry) => entry.id === bonusEvidence.limitationIds[0]
    );
  requireExactlyOne(
    limitationCatalogEntries,
    `${RETAINED_AUSTIN_MISSING_EVIDENCE} release limitation`
  );
  if (
    record.resultingState.source.releaseId !== release.releaseId ||
    record.resultingState.source.releaseVersion !== release.releaseVersion ||
    record.resultingState.source.releaseDigest !== release.releaseDigest ||
    record.resultingState.source.sourceObservationId !==
      observation.observationId
  ) {
    throw new Error(
      'Retained Austin trade-bonus proof record is not pinned to the authenticated release and observation.'
    );
  }

  return {
    artifactSha256,
    release,
    record,
    observation,
    player: {
      ...player,
      id: RETAINED_AUSTIN_PLAYER_ID,
      playerId: RETAINED_AUSTIN_PLAYER_ID,
      player_id: RETAINED_AUSTIN_PLAYER_ID,
      name: player.displayName,
      displayName: player.displayName,
      teamCode: RETAINED_AUSTIN_TEAM_ID,
      teamId: RETAINED_AUSTIN_TEAM_ID,
    },
    contractIdentity: {
      contractId: record.contractId,
      playerId: record.playerId,
      teamId: record.teamId,
      sourceObservationId: record.sourceObservationId,
      sourceContractPath: record.sourceContractPath,
      resultingStateDigest: record.resultingState.stateDigest,
    },
    tradeKickerPercent,
    missingEvidence: bonusEvidence.limitationIds[0],
  };
}

export async function authenticateRetainedAustinTradeBonusArtifact(
  artifact: Uint8Array,
  descriptor: RetainedContractArtifactDescriptor = RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR
): Promise<RetainedAustinTradeBonusAuthority> {
  const artifactSha256 = retainedArtifactSha256(artifact);
  if (artifactSha256 !== descriptor.artifactSha256) {
    throw new Error(
      `Retained contract artifact digest mismatch: expected ${descriptor.artifactSha256}, received ${artifactSha256}.`
    );
  }
  const release = await verifyContractSourceRelease(
    JSON.parse(Buffer.from(artifact).toString('utf8')),
    {
      releaseId: descriptor.releaseId,
      releaseVersion: descriptor.releaseVersion,
      releaseDigest: descriptor.releaseDigest,
    }
  );
  if (
    release.releaseId !== BUNDLED_CONTRACT_SOURCE_RELEASE_PIN.releaseId ||
    release.releaseVersion !==
      BUNDLED_CONTRACT_SOURCE_RELEASE_PIN.releaseVersion ||
    release.releaseDigest !== BUNDLED_CONTRACT_SOURCE_RELEASE_PIN.releaseDigest
  ) {
    throw new Error(
      'Retained Austin trade-bonus proof release does not match the production bundled pin.'
    );
  }
  return deriveRetainedAustinTradeBonusAuthority(release, artifactSha256);
}

export async function loadRetainedAustinTradeBonusAuthority(): Promise<RetainedAustinTradeBonusAuthority> {
  return authenticateRetainedAustinTradeBonusArtifact(
    await readFile(RETAINED_CONTRACT_RELEASE_PATH)
  );
}
