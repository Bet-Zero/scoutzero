/** Canonical request and retained-evidence boundary for governed extensions. */

import { z } from 'zod';
import {
  ContractEvidenceStatusZ,
  ContractTemporalValueZ,
} from './governedContractState';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const MoneyZ = z.number().finite().nonnegative();

export const GovernedExtensionRouteZ = z.enum([
  'rookie-scale',
  'veteran',
  'designated-veteran',
]);

export const GovernedExtensionBonusZ = z.strictObject({
  bonusId: NonEmptyStringZ,
  classification: z.enum(['likely', 'unlikely']),
  amount: MoneyZ,
});

export const GovernedExtensionCompensationZ = z.strictObject({
  season: NonEmptyStringZ,
  salaryExcludingIncentive: MoneyZ,
  regularSalary: MoneyZ,
  bonuses: z.array(GovernedExtensionBonusZ),
});

const GovernedExtensionSourceIdentityZ = z.strictObject({
  releaseId: NonEmptyStringZ,
  releaseVersion: z.number().int().min(1),
  releaseDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  sourceProvider: NonEmptyStringZ,
  sourceRecordVersion: NonEmptyStringZ,
  sourceObservationId: NonEmptyStringZ,
  sourceArtifactSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  sourceContractPath: z.enum(['contract', 'futureContract']),
});

/**
 * Contract-side facts which the BZE-274 baseline deliberately does not infer.
 * The field is parsed from the immutable Contract state only when present.
 */
export const GovernedExtensionContractEvidenceZ = z.strictObject({
  evidenceVersion: z.literal(1),
  status: ContractEvidenceStatusZ,
  observedAt: ContractTemporalValueZ,
  sourceIdentity: GovernedExtensionSourceIdentityZ,
  transactionHistoryComplete: z.boolean(),
  originalSignedAt: ContractTemporalValueZ,
  yearsOfServiceAtFirstExtendedSeason: z.number().int().nonnegative().nullable(),
  projectedQvfaAtOriginalExpiry: z.boolean().nullable(),
  seasonsPlayedForCurrentTeam: z.number().int().nonnegative().nullable(),
  designatedTeamRoute: z
    .enum(['original-team', 'permitted-trade-history', 'ineligible'])
    .nullable(),
  latestRenegotiationAt: ContractTemporalValueZ,
  latestRenegotiationSalaryIncreasePercent: z
    .number()
    .finite()
    .nonnegative()
    .nullable(),
  fourthSeasonFirstGameAt: ContractTemporalValueZ,
  originalCompensation: z.array(GovernedExtensionCompensationZ),
  awardEvidence: z.strictObject({
    status: ContractEvidenceStatusZ,
    achievement: z.enum(['MVP', 'DPOY', 'ALL_NBA']).nullable(),
    achievementSeason: NonEmptyStringZ.nullable(),
    qualificationWindowSatisfied: z.boolean().nullable(),
    gameThresholdStatus: z.enum([
      'satisfied',
      'not-satisfied',
      'external-determination',
      'unknown',
    ]),
    determinationId: NonEmptyStringZ.nullable(),
  }),
});

/**
 * League-side inputs are acceptable only with a retained artifact receipt.
 * This prevents presenting a hash of mutable web content without preserving
 * the exact bytes which produced the certified values.
 */
export const GovernedExtensionLeagueEvidenceZ = z.strictObject({
  evidenceVersion: z.literal(1),
  status: ContractEvidenceStatusZ,
  signingSalaryCapYear: z.number().int(),
  firstExtendedSalaryCapYear: z.number().int(),
  salaryCap: MoneyZ,
  estimatedAveragePlayerSalary: MoneyZ,
  moratoriumEndsAt: ContractTemporalValueZ,
  regularSeasonFirstDay: ContractTemporalValueZ,
  source: z.strictObject({
    provider: NonEmptyStringZ,
    sourceUrl: NonEmptyStringZ,
    retainedArtifactPath: NonEmptyStringZ,
    artifactSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    artifactBytes: z.number().int().positive(),
    retrievedAt: z.string(),
  }),
});

export const GovernedExtensionSalaryProposalZ =
  GovernedExtensionCompensationZ.extend({
    guaranteed: z.boolean(),
    option: z.enum(['PO', 'TO', 'ETO']).nullable(),
  });

export const GovernedExtensionProposalZ = z.strictObject({
  proposalVersion: z.literal(1),
  contractId: NonEmptyStringZ,
  route: GovernedExtensionRouteZ,
  signedAt: z.string(),
  conditionalHigherMaxPercentage: z.number().finite().nullable(),
  agreedDesignatedVeteranPercentage: z.number().finite().nullable(),
  salariesByYear: z.array(GovernedExtensionSalaryProposalZ).min(1),
});

export type GovernedExtensionRoute = z.infer<
  typeof GovernedExtensionRouteZ
>;
export type GovernedExtensionBonus = z.infer<
  typeof GovernedExtensionBonusZ
>;
export type GovernedExtensionCompensation = z.infer<
  typeof GovernedExtensionCompensationZ
>;
export type GovernedExtensionContractEvidence = z.infer<
  typeof GovernedExtensionContractEvidenceZ
>;
export type GovernedExtensionLeagueEvidence = z.infer<
  typeof GovernedExtensionLeagueEvidenceZ
>;
export type GovernedExtensionSalaryProposal = z.infer<
  typeof GovernedExtensionSalaryProposalZ
>;
export type GovernedExtensionProposal = z.infer<
  typeof GovernedExtensionProposalZ
>;
