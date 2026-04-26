/**
 * FILE: src/schemas/players_v2.ts
 * PURPOSE: Zod schemas for the players_v2 Firestore collection and subcollections.
 * OWNERSHIP: Data: players_v2 schema
 *
 * HISTORY:
 *  - 2026-01-22: Added videoExamples to evaluation schemas (Phase 3)
 *  - 2026-01-21: Updated by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import { z } from 'zod';
import {
  FreeAgentTypeZ,
  JsonValueZ,
  MoneyZ,
  OptionTypeZ,
  PlayerIdZ,
  SeasonCodeZ,
  TeamCodeZ,
  TimestampZ,
  YearZ,
} from './common';
import { BasePlayerContractZ } from './architect';

// ============================
// players_v2 canonical schemas
// ============================

// Bio
export const PlayerAgentZ = z
  .object({
    name: z.string().optional().nullable(),
    agency: z.string().optional().nullable(),
  })
  .optional();

export const PlayerDraftZ = z.object({
  year: YearZ.optional().nullable(),
  round: z.number().int().optional().nullable(),
  pick: z.number().int().optional().nullable(),
  teamId: TeamCodeZ.optional().nullable(),
});

export const PlayerDisplayZ = z.object({
  team: z.string().optional().nullable(),
  yearsPro: z.number().int().optional().nullable(),
  averageAnnualValue: MoneyZ.optional().nullable(),
  yearsLeft: z.number().int().optional().nullable(),
  freeAgentYear: YearZ.optional().nullable(),
  freeAgentType: FreeAgentTypeZ.optional().nullable(),
  teamId: TeamCodeZ.optional().nullable(),
  POS: z.string().optional().nullable(),
});

export const PlayerBioZ = z
  .object({
    displayName: z.string(),
    name: z.string().optional(),
    playerId: PlayerIdZ,
    position: z.string().nullable().optional(),
    height: z.number().int().optional(),
    weight: z.number().int().optional(),
    dob: z.string().optional(),
    birthplace: z.string().optional(),
    nationality: z.string().optional(),
    shoots: z.string().optional(),
    agent: PlayerAgentZ.optional(),
    draft: PlayerDraftZ.optional(),
    display: PlayerDisplayZ.optional(),
    nbaId: z.number().int().optional(),
  })
  .optional();

// Contracts subcollection
export const ContractMetadataZ = z
  .object({
    startSeason: SeasonCodeZ,
    endSeason: SeasonCodeZ,
    isCurrent: z.boolean(),
    label: z.string(),
    currentSalary: MoneyZ.optional(),
    averageAnnualValue: MoneyZ.optional(),
    yearsRemaining: z.number().int().optional(),
    freeAgentYear: YearZ.optional(),
    freeAgentType: FreeAgentTypeZ.optional(),
    maxType: z.string().nullable().optional(),
  });

export const ContractDocZ = BasePlayerContractZ.extend({
  metadata: ContractMetadataZ,
});

// Views - Contracts
export const ContractViewSeasonZ = z.object({
  season: SeasonCodeZ,
  salary: MoneyZ.optional(),
  guaranteed: z.boolean().optional(),
  guaranteedAmount: MoneyZ.optional(),
  optionType: OptionTypeZ.optional(),
  optionDecisionDate: z.string().optional(),
  voidedByExtension: z.boolean().optional(),
  sourceContractId: z.string().optional(),
});

export const ContractsViewDocZ = z
  .object({
    seasons: z.array(ContractViewSeasonZ),
    freeAgentYear: YearZ.optional(),
    freeAgentType: FreeAgentTypeZ.optional(),
    birdRights: z
      .object({
        status: z.string(),
        eligibleFor: z.array(z.string()).optional(),
      })
      .optional(),
    currentSalary: MoneyZ.optional(),
    yearsRemaining: z.number().int().optional(),
    averageAnnualValue: MoneyZ.optional(),
    maxType: z.string().nullable().optional(),
    contractType: z.string().optional(),
  });

export const ContractOptionPayloadZ = z.object({
  year: YearZ.optional().nullable(),
  season: SeasonCodeZ.optional().nullable(),
  type: OptionTypeZ.optional(),
  optionType: OptionTypeZ.optional(),
  amount: MoneyZ.optional().nullable(),
  deadline: z.string().optional().nullable(),
  decisionDate: z.string().optional().nullable(),
  exercised: z.boolean().optional(),
});

export const ContractOptionZ = z.preprocess(
  (value) => (typeof value === 'string' ? { type: value } : value),
  ContractOptionPayloadZ
);
export const ContractOptionsListZ = z.array(ContractOptionZ);

// Denormalized views for main document (fast filtering/table views)
export const CurrentContractViewZ = z
  .object({
    freeAgentYear: YearZ.optional(),
    freeAgentType: FreeAgentTypeZ.optional(),
    contractType: z.string().optional(),
    options: ContractOptionsListZ.optional(),
    // Phase 2X SSOT: Year-specific option type mapping
    // Keys are seasonStartYear as strings (e.g., "2025" for 2025-26 season)
    // Values are option types: "PO" | "TO" | "ETO"
    optionsByYear: z.record(z.string(), OptionTypeZ).optional(),
    birdRights: z
      .object({
        status: z.string(),
        eligibleFor: z.array(z.string()).optional(),
      })
      .optional(),
    salaryByYear: z.record(z.string(), MoneyZ).optional(),
    currentSalary: MoneyZ.optional(),
    yearsRemaining: z.number().int().optional(),
    averageAnnualValue: MoneyZ.optional(),
    maxType: z.string().nullable().optional(),
    signedUsing: z.string().nullable().optional(),
  })
  .optional();

export const VideoExampleZ = z
  .object({
    url: z.string(),
    label: z.string().optional(),
    createdAt: z.number().optional(),
  });

export const VideoExamplesZ = z
  .object({
    traits: z.record(z.string(), z.array(VideoExampleZ)).optional(),
    roles: z.record(z.string(), z.array(VideoExampleZ)).optional(),
    subroles: z.record(z.string(), z.array(VideoExampleZ)).optional(),
    subRoles: z.record(z.string(), z.array(VideoExampleZ)).optional(),
    shootingProfile: z.array(VideoExampleZ).optional(),
    twoWayMeter: z.array(VideoExampleZ).optional(),
    overall: z.array(VideoExampleZ).optional(),
  })
  .partial()
  .optional();

export const CurrentEvaluationViewZ = z
  .object({
    roles: z
      .object({
        offense1: z.string().optional(),
        offense2: z.string().optional(),
        defense1: z.string().optional(),
        defense2: z.string().optional(),
      })
      .optional(),
    subRoles: z
      .object({
        offense: z.array(z.string()).optional(),
        defense: z.array(z.string()).optional(),
      })
      .optional(),
    shootingProfile: z.string().optional(),
    twoWay: z.number().optional(),
    badges: z.array(z.string()).optional(),
    traits: z.record(z.string(), z.number()).optional(),
    overallGrade: z.number().optional(),
    blurbs: z
      .union([
        z
          .object({
            traits: z.record(z.string(), z.string()).optional(),
            roles: z.record(z.string(), z.string()).optional(),
            subroles: z.record(z.string(), z.string()).optional(),
            subRoles: z.record(z.string(), z.string()).optional(),
            shootingProfile: z.string().optional(),
            twoWayMeter: z.string().optional(),
            overall: z.string().optional(),
          })
          .partial()
          .and(z.record(z.string(), JsonValueZ)),
        z.record(z.string(), JsonValueZ),
      ])
      .optional(),
    videoExamples: VideoExamplesZ,
  })
  .optional();

export const CurrentSeasonStatsZ = z
  .object({
    PTS: z.number().optional(),
    REB: z.number().optional(),
    AST: z.number().optional(),
    'FG%': z.number().optional(),
    '3PT%': z.number().optional(),
    'FT%': z.number().optional(),
    'eFG%': z.number().optional(),
    MIN: z.number().optional(),
    GP: z.number().optional(),
  })
  .and(z.record(z.string(), JsonValueZ))
  .optional();

// Seasons subcollection
export const SeasonStatsZ = z.record(
  z.union([z.string(), z.literal('%')]),
  JsonValueZ
);

export const SeasonDocZ = z.object({
  age: z.number().int().optional(),
  team: TeamCodeZ.optional(),
  stats: z.record(z.string(), z.number()).optional(),
  contractView: z
    .object({
      salary: MoneyZ.optional(),
      contractValue: MoneyZ.optional(),
      contractLength: z.number().int().optional(),
      averageAnnualValue: MoneyZ.optional(),
      yearsLeft: z.number().int().optional(),
      freeAgentYear: YearZ.optional(),
      freeAgentType: FreeAgentTypeZ.optional(),
      options: z
        .union([
          ContractOptionsListZ,
          z.record(z.string(), ContractOptionPayloadZ),
          ContractOptionPayloadZ,
          z.string(),
        ])
        .nullable()
        .optional(),
      birdRights: z.string().nullable().optional(),
      contractId: z.string().optional(),
    })
    .optional(),
  evaluationView: z
    .object({
      overallGrade: z.number().optional(),
      roles: z
        .object({
          offense1: z.string().optional(),
          offense2: z.string().optional(),
          defense1: z.string().optional(),
          defense2: z.string().optional(),
        })
        .optional(),
      shootingProfile: z.string().optional(),
      twoWay: z.number().optional(),
      badges: z.array(z.string()).optional(),
    })
    .optional(),
  meta: z.record(z.string(), JsonValueZ).optional(),
});

// Evaluations subcollection (simplified aggregate form)
export const EvaluationTraitsZ = z.record(z.string(), z.number());
export const EvaluationDocZ = z.object({
  traits: EvaluationTraitsZ.optional(),
  twoWay: z.number().optional(),
  shootingProfile: z.string().optional(),
  roles: z
    .object({
      offense1: z.string().optional(),
      offense2: z.string().optional(),
      defense1: z.string().optional(),
      defense2: z.string().optional(),
    })
    .optional(),
  subRoles: z
    .object({
      offense: z.array(z.string()).optional(),
      defense: z.array(z.string()).optional(),
    })
    .optional(),
  badges: z.array(z.string()).optional(),
  overallGrade: z.number().optional(),
  blurbs: z
    .union([
      z
        .object({
          traits: z.record(z.string(), z.string()).optional(),
          roles: z.record(z.string(), z.string()).optional(),
          subroles: z.record(z.string(), z.string()).optional(),
          subRoles: z.record(z.string(), z.string()).optional(),
          shootingProfile: z.string().optional(),
          twoWayMeter: z.string().optional(),
          overall: z.string().optional(),
        })
        .partial()
        .and(z.record(z.string(), JsonValueZ)),
      z.record(z.string(), JsonValueZ),
    ])
    .optional(),
  videoExamples: VideoExamplesZ,
  meta: z
    .object({
      methodVersion: z.string().optional(),
      updatedAt: z.string().optional(),
      updatedBy: z.string().optional(),
      seasonContext: SeasonCodeZ.optional(),
    })
    .optional(),
});

// Root player doc (main document only)
export const PlayerMainDocZ = z.object({
  bio: PlayerBioZ,
  createdAt: TimestampZ.optional(),
  updatedAt: TimestampZ.optional(),
  currentContractView: CurrentContractViewZ,
  currentEvaluationView: CurrentEvaluationViewZ,
  currentSeasonStats: CurrentSeasonStatsZ,
});

// Types
export type PlayerAgent = z.infer<typeof PlayerAgentZ>;
export type PlayerDraft = z.infer<typeof PlayerDraftZ>;
export type PlayerDisplay = z.infer<typeof PlayerDisplayZ>;
export type PlayerBio = z.infer<typeof PlayerBioZ>;
export type ContractMetadata = z.infer<typeof ContractMetadataZ>;
export type VideoExample = z.infer<typeof VideoExampleZ>;
export type VideoExamples = z.infer<typeof VideoExamplesZ>;
export type SeasonStats = z.infer<typeof SeasonStatsZ>;
export type EvaluationTraits = z.infer<typeof EvaluationTraitsZ>;
export type PlayerMainDoc = z.infer<typeof PlayerMainDocZ>;
export type ContractDoc = z.infer<typeof ContractDocZ>;
export type SeasonDoc = z.infer<typeof SeasonDocZ>;
export type EvaluationDoc = z.infer<typeof EvaluationDocZ>;
export type ContractViewSeason = z.infer<typeof ContractViewSeasonZ>;
export type ContractsViewDoc = z.infer<typeof ContractsViewDocZ>;
export type CurrentContractView = z.infer<typeof CurrentContractViewZ>;
export type CurrentEvaluationView = z.infer<typeof CurrentEvaluationViewZ>;
export type CurrentSeasonStats = z.infer<typeof CurrentSeasonStatsZ>;

// Aggregated type for convenience (not a Firestore document by itself)
export interface PlayerV2 extends PlayerMainDoc {
  id: string;
  contracts?: Record<string, ContractDoc>;
  seasons?: Record<string, SeasonDoc>;
  evaluations?: Record<string, EvaluationDoc>;
}
