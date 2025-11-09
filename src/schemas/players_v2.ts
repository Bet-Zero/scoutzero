import { z } from 'zod';
import {
  FreeAgentTypeZ,
  MoneyZ,
  PlayerIdZ,
  SeasonCodeZ,
  TeamCodeZ,
  TimestampZ,
  YearZ
} from './common';
import { BasePlayerContractZ } from './architect';

// ============================
// players_v2 canonical schemas
// ============================

// Bio
export const PlayerAgentZ = z.object({
  name: z.string().optional().nullable(),
  agency: z.string().optional().nullable()
});

export const PlayerDraftZ = z.object({
  year: YearZ.optional().nullable(),
  round: z.number().int().optional().nullable(),
  pick: z.number().int().optional().nullable(),
  teamId: TeamCodeZ.optional().nullable()
});

export const PlayerDisplayZ = z.object({
  team: z.string().optional().nullable(),
  yearsPro: z.number().int().optional().nullable(),
  averageAnnualValue: MoneyZ.optional().nullable(),
  yearsLeft: z.number().int().optional().nullable(),
  freeAgentYear: YearZ.optional().nullable(),
  freeAgentType: FreeAgentTypeZ.optional().nullable(),
  teamId: TeamCodeZ.optional().nullable(),
  POS: z.string().optional().nullable()
});

export const PlayerBioZ = z.object({
  displayName: z.string(),
  name: z.string().optional(),
  playerId: PlayerIdZ,
  position: z.string(),
  height: z.number().int().optional(),
  weight: z.number().int().optional(),
  dob: z.string().optional(),
  birthplace: z.string().optional(),
  nationality: z.string().optional(),
  shoots: z.string().optional(),
  agent: PlayerAgentZ.optional(),
  draft: PlayerDraftZ.optional(),
  display: PlayerDisplayZ.optional(),
  nbaId: z.number().int().optional()
});

// Contracts subcollection
export const ContractMetadataZ = z.object({
  startSeason: SeasonCodeZ,
  endSeason: SeasonCodeZ,
  isCurrent: z.boolean(),
  label: z.string()
});

export const ContractDocZ = BasePlayerContractZ.extend({
  metadata: ContractMetadataZ
});

// Seasons subcollection
export const SeasonStatsZ = z.record(z.union([z.string(), z.literal('%')]), z.any());

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
      options: z.any().nullable().optional(),
      birdRights: z.string().nullable().optional(),
      contractId: z.string().optional()
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
          defense2: z.string().optional()
        })
        .optional(),
      shootingProfile: z.string().optional(),
      twoWay: z.number().optional(),
      badges: z.array(z.string()).optional()
    })
    .optional(),
  meta: z.record(z.string(), z.any()).optional()
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
      defense2: z.string().optional()
    })
    .optional(),
  subRoles: z
    .object({ offense: z.array(z.string()).optional(), defense: z.array(z.string()).optional() })
    .optional(),
  badges: z.array(z.string()).optional(),
  overallGrade: z.number().optional(),
  blurbs: z.record(z.string(), z.any()).optional(),
  meta: z
    .object({
      methodVersion: z.string().optional(),
      updatedAt: z.string().optional(),
      updatedBy: z.string().optional(),
      seasonContext: SeasonCodeZ.optional()
    })
    .optional()
});

// Root player doc (main document only)
export const PlayerMainDocZ = z.object({
  bio: PlayerBioZ,
  createdAt: TimestampZ.optional(),
  updatedAt: TimestampZ.optional()
});

// Types
export type PlayerMainDoc = z.infer<typeof PlayerMainDocZ>;
export type ContractDoc = z.infer<typeof ContractDocZ>;
export type SeasonDoc = z.infer<typeof SeasonDocZ>;
export type EvaluationDoc = z.infer<typeof EvaluationDocZ>;

// Aggregated type for convenience (not a Firestore document by itself)
export interface PlayerV2 extends PlayerMainDoc {
  id: string;
  contracts?: Record<string, ContractDoc>;
  seasons?: Record<string, SeasonDoc>;
  evaluations?: Record<string, EvaluationDoc>;
}


