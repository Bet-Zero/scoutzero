import { z } from 'zod';
import {
  MoneyZ,
  PlayerIdZ,
  SeasonCodeZ,
  TeamCodeZ,
  TimestampZ
} from './common';

// ============================
// architect canonical schemas
// ============================

// Base Team Document: /architect/baseTeams/{teamCode}
export const DeadCapItemZ = z.object({
  playerId: PlayerIdZ,
  playerName: z.string(),
  originalSalary: MoneyZ,
  amountByYear: z.array(
    z.object({ season: SeasonCodeZ, amount: MoneyZ, isStretched: z.boolean().optional() })
  ),
  waiveDate: z.string().optional(),
  notes: z.string().optional()
});

export const CapHoldItemZ = z.object({
  playerId: PlayerIdZ,
  playerName: z.string(),
  amount: MoneyZ,
  type: z.string(),
  isSigned: z.boolean().optional(),
  expiresOn: z.string().optional()
});

export const ExceptionsZ = z.object({
  mle: z
    .object({
      type: z.string().optional(),
      available: z.boolean().optional(),
      totalAmount: MoneyZ.optional(),
      usedAmount: MoneyZ.optional(),
      remainingAmount: MoneyZ.optional(),
      expiresOn: z.string().optional()
    })
    .optional()
}).catchall(z.any());

export const DraftPickZ = z.object({
  season: SeasonCodeZ,
  round: z.number().int(),
  pick: z.number().int().nullable(),
  owner: TeamCodeZ,
  notes: z.string().optional()
});

export const TeamTotalsZ = z.object({
  totalSalary: MoneyZ.optional(),
  guaranteedSalary: MoneyZ.optional(),
  nonGuaranteedSalary: MoneyZ.optional(),
  rosterCount: z.number().int().optional(),
  guaranteedContracts: z.number().int().optional(),
  nonGuaranteedContracts: z.number().int().optional(),
  twoWayContracts: z.number().int().optional(),
  emptyRosterCharges: z.number().int().optional(),
  capSpace: z.number().optional(),
  capRoom: z.number().optional(),
  effectiveCap: z.number().optional(),
  luxuryTaxLine: z.number().optional(),
  taxablePayroll: z.number().optional(),
  isOverTax: z.boolean().optional(),
  taxBill: z.number().optional(),
  taxRate: z.number().optional(),
  firstApron: z.number().optional(),
  firstApronRoom: z.number().optional(),
  isFirstApron: z.boolean().optional(),
  secondApron: z.number().optional(),
  secondApronRoom: z.number().optional(),
  isSecondApron: z.boolean().optional(),
  isHardCapped: z.boolean().optional(),
  hardCapLevel: z.string().nullable().optional(),
  hardCapRoom: z.number().nullable().optional()
});

export const ArchitectSourceZ = z.object({
  provider: z.string().optional(),
  teamPageUrl: z.string().optional(),
  playerPageUrl: z.string().optional(),
  scrapedAt: z.string().optional(),
  season: SeasonCodeZ.optional(),
  type: z.string().optional(),
  worldId: z.string().optional(),
  generatedAt: z.string().optional(),
  baseTeamVersion: z.string().optional()
});

export const BaseTeamDocZ = z.object({
  teamCode: TeamCodeZ,
  teamName: z.string(),
  season: SeasonCodeZ,
  abbreviation: TeamCodeZ.optional(),
  city: z.string().optional(),
  conference: z.string().optional(),
  division: z.string().optional(),
  roster: z.array(PlayerIdZ),
  deadCap: z.array(DeadCapItemZ).optional().default([]),
  capHolds: z.array(CapHoldItemZ).optional().default([]),
  exceptions: ExceptionsZ.optional(),
  draftPicks: z.array(DraftPickZ).optional().default([]),
  totals: TeamTotalsZ.optional(),
  source: ArchitectSourceZ.optional(),
  lastUpdated: z.string().optional(),
  version: z.string().optional()
});

// Base Player Document: /architect/basePlayers/{playerId}
export const BasePlayerContractYearZ = z.object({
  season: SeasonCodeZ,
  salary: MoneyZ,
  capHit: MoneyZ,
  guaranteed: z.boolean(),
  guaranteedAmount: MoneyZ.optional(),
  option: z.string().nullable(),
  tradeBonus: MoneyZ.nullable().optional(),
  incentives: z.object({ likely: MoneyZ, unlikely: MoneyZ }).partial().optional()
});

export const BasePlayerContractZ = z.object({
  contractType: z.string(),
  isExtension: z.boolean().nullable().optional(),
  isRookieScale: z.boolean().optional(),
  signedUsing: z.string().optional(),
  signingTeam: TeamCodeZ.optional(),
  signingDate: z.string().optional(),
  signingExecutive: z.string().optional(),
  signedByCurrentTeam: z.boolean().optional(),
  startSeason: SeasonCodeZ,
  endSeason: SeasonCodeZ,
  contractLength: z.number().int(),
  yearsRemaining: z.number().int().optional(),
  totalValue: MoneyZ,
  averageAnnualValue: MoneyZ,
  guaranteedValue: MoneyZ.optional(),
  guaranteedYears: z.number().int().optional(),
  salariesByYear: z.array(BasePlayerContractYearZ),
  noTradeClause: z.boolean().optional(),
  tradeKicker: z.number().nullable().optional(),
  tradeRestrictions: z.array(z.string()).optional(),
  birdRights: z
    .object({
      status: z.string(),
      yearsOfService: z.number().int().optional(),
      yearsWithTeam: z.number().int().optional(),
      eligibleFor: z.array(z.string()).optional()
    })
    .optional(),
  freeAgency: z
    .object({
      type: z.string().optional(),
      year: z.number().int().optional(),
      capHold: MoneyZ.optional(),
      qualifyingOffer: MoneyZ.nullable().optional(),
      earlyTerminationOption: z.string().nullable().optional()
    })
    .optional(),
  tradeEligibility: z
    .object({
      canBeTradedNow: z.boolean().optional(),
      restrictedUntil: z.string().nullable().optional(),
      reason: z.string().nullable().optional(),
      rules: z
        .object({
          baseYearCompensation: z.boolean().optional(),
          poisonPill: z.boolean().optional(),
          aggregation: z.boolean().optional()
        })
        .optional()
    })
    .optional()
});

export const BasePlayerDocZ = z.object({
  playerId: PlayerIdZ,
  displayName: z.string(),
  teamCode: TeamCodeZ.optional(),
  teamName: z.string().optional(),
  bio: z
    .object({
      position: z.string().optional(),
      height: z.string().optional(),
      weight: z.string().optional(),
      age: z.number().int().optional(),
      birthdate: z.string().optional(),
      experience: z.number().int().optional()
    })
    .optional(),
  contract: BasePlayerContractZ,
  source: z
    .object({
      provider: z.string().optional(),
      playerPageUrl: z.string().optional(),
      scrapedAt: z.string().optional()
    })
    .optional(),
  lastUpdated: z.string().optional(),
  version: z.string().optional()
});

// World snapshot: /architect/worlds/{worldId}/snapshot/teams/{teamCode}
export const WorldTeamSnapshotZ = BaseTeamDocZ.extend({});

// Types
export type BaseTeamDoc = z.infer<typeof BaseTeamDocZ>;
export type BasePlayerDoc = z.infer<typeof BasePlayerDocZ>;
export type WorldTeamSnapshot = z.infer<typeof WorldTeamSnapshotZ>;


