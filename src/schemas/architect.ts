import { z } from 'zod';
import { MoneyZ, PlayerIdZ, SeasonCodeZ, TeamCodeZ } from './common';

const HardCapLevelZ = z.enum(['none', 'firstApron', 'secondApron']);

// ============================
// architect canonical schemas
// ============================

// Base Team Document: /architect/baseTeams/{teamCode}
export const DeadCapItemZ = z.object({
  playerId: PlayerIdZ,
  playerName: z.string(),
  originalSalary: MoneyZ,
  amountByYear: z.array(
    z.object({
      season: SeasonCodeZ,
      amount: MoneyZ,
      isStretched: z.boolean().optional(),
    })
  ),
  waiveDate: z.string().optional(),
  notes: z.string().optional(),
});

export const CapHoldItemZ = z.object({
  playerId: PlayerIdZ,
  playerName: z.string(),
  amount: MoneyZ,
  type: z.string(),
  season: SeasonCodeZ.optional(),
  isSigned: z.boolean().optional(),
  expiresOn: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

const MleExceptionZ = z.object({
  type: z.string().optional(),
  available: z.boolean().optional(),
  totalAmount: MoneyZ.optional(),
  usedAmount: MoneyZ.optional(),
  remainingAmount: MoneyZ.optional(),
  expiresOn: z.string().optional(),
  createdFrom: z.string().optional(),
  createdOn: z.string().optional(),
});

const BaeExceptionZ = z.object({
  available: z.boolean().optional(),
  totalAmount: MoneyZ.optional(),
  usedAmount: MoneyZ.optional(),
  remainingAmount: MoneyZ.optional(),
  expiresOn: z.string().optional(),
  notes: z.string().optional(),
});

const DpeExceptionZ = z.object({
  totalAmount: MoneyZ.optional(),
  createdOn: z.string().optional(),
  expiresOn: z.string().optional(),
  notes: z.string().optional(),
});

const TradeExceptionZ = z.object({
  id: z.string(),
  totalAmount: MoneyZ.optional(),
  usedAmount: MoneyZ.optional(),
  remainingAmount: MoneyZ.optional(),
  createdFrom: z.string().optional(),
  createdOn: z.string().optional(),
  expiresOn: z.string().optional(),
  notes: z.string().optional(),
});

export const ExceptionsZ = z
  .object({
    mle: MleExceptionZ.optional(),
    taxpayerMle: MleExceptionZ.optional(),
    room: MleExceptionZ.optional(),
    bae: BaeExceptionZ.optional(),
    dpe: DpeExceptionZ.optional(),
    tpe: z.array(TradeExceptionZ).optional(),
  })
  .passthrough()
  .optional();

export const ExceptionsExtraFieldsZ = z.record(z.string(), z.any());

const DraftPickConveyanceZ = z
  .object({
    id: z.string().optional(),
    description: z.string().optional(),
    originalYear: z.number().int().optional(),
    currentYear: z.number().int().optional(),
    finalYear: z.number().int().optional(),
    stepienImpact: z
      .object({
        // ⚠️  These Stepien flags are informational hints from the scrape.
        // Architect recomputes Stepien eligibility after each simulated move,
        // so downstream code must not rely on these values as a source of truth.
        eligibleForStepien: z.boolean().optional(),
        locksYears: z.array(z.number().int()).optional(),
        deadYears: z.array(z.number().int()).optional(),
        affectedYears: z.array(z.number().int()).optional(),
        nextAvailableFirstRound: z.number().int().optional(),
        conveyanceDeadline: z.number().int().optional(),
        rolloverYears: z.array(z.number().int()).optional(),
      })
      .passthrough()
      .optional(),
    conditions: z
      .object({
        protection: z.string().optional(),
        ifConveys: z.string().optional(),
        ifRolls: z.string().optional(),
      })
      .optional(),
    affects: z.array(z.string()).optional(),
  })
  .passthrough()
  .optional();

export const DraftPickZ = z.object({
  id: z.string().optional(),
  year: z.number().int(),
  round: z.number().int(),
  pick: z.number().int().nullable(),
  owner: TeamCodeZ,
  originalTeam: TeamCodeZ.optional(),
  status: z.string().optional(),
  isSwap: z.boolean().optional(),
  protection: z.string().nullable().optional(),
  stepienEligible: z.boolean().optional(),
  tradeable: z.boolean().optional(),
  via: TeamCodeZ.optional(),
  recipient: TeamCodeZ.optional(),
  route: z.array(TeamCodeZ).optional(),
  notes: z.string().optional(),
  conveyance: DraftPickConveyanceZ,
  metadata: z.object({}).passthrough().optional(),
});

export const TeamTotalsZ = z.object({
  totalSalary: MoneyZ.optional(),
  capHit: MoneyZ.optional(),
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
  hardCapLevel: HardCapLevelZ.optional(),
  hardCapDetail: z.string().optional(),
  hardCapRoom: z.number().nullable().optional(),
}).passthrough();

export const ArchitectSourceZ = z.object({
  provider: z.string().optional(),
  teamPageUrl: z.string().optional(),
  playerPageUrl: z.string().optional(),
  scrapedAt: z.string().optional(),
  season: SeasonCodeZ.optional(),
  type: z.string().optional(),
  worldId: z.string().optional(),
  generatedAt: z.string().optional(),
  baseTeamVersion: z.string().optional(),
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
  exceptions: ExceptionsZ,
  draftPicks: z.array(DraftPickZ).optional().default([]),
  totals: TeamTotalsZ.optional(),
  source: ArchitectSourceZ.optional(),
  lastUpdated: z.string().optional(),
  version: z.string().optional(),
  mergedAt: z.string().optional(),
});

// Base Player Document: /architect/basePlayers/{playerId}
export const GuaranteeScheduleEntryZ = z.object({
  effectiveDate: z.string(),
  guaranteedAmount: MoneyZ,
  status: z.string(),
  note: z.string(),
});

export const BasePlayerContractYearZ = z.object({
  season: SeasonCodeZ,
  salary: MoneyZ,
  capHit: MoneyZ,
  guaranteed: z.boolean(),
  guaranteedAmount: MoneyZ.optional(),
  option: z.string().nullable(),
  optionUsed: z.boolean().nullable().optional(),
  optionDecisionDate: z.string().nullable().optional(),
  tradeBonus: MoneyZ.nullable().optional(),
  incentives: z.object({ likely: MoneyZ, unlikely: MoneyZ }).optional(),
  guaranteeSchedule: z.array(GuaranteeScheduleEntryZ).optional(),
  voidedByExtension: z.boolean().optional(),
  voidedOn: z.string().optional(),
});

export const BasePlayerContractZ = z.object({
  contractType: z.string(),
  isExtension: z.boolean(),
  isRookieScale: z.boolean(),
  signedUsing: z.string().optional(),
  signingTeam: TeamCodeZ.optional(),
  signingDate: z.string().optional(),
  signingExecutive: z.string().optional(),
  signedByCurrentTeam: z.boolean().optional(),
  startSeason: SeasonCodeZ,
  endSeason: SeasonCodeZ,
  contractLength: z.number().int(),
  yearsRemaining: z.number().int(),
  totalValue: MoneyZ,
  averageAnnualValue: MoneyZ,
  guaranteedValue: MoneyZ,
  guaranteedYears: z.number().int(),
  salariesByYear: z.array(BasePlayerContractYearZ),
  noTradeClause: z.boolean(),
  tradeKicker: z.number().nullable(),
  tradeRestrictions: z.array(z.string()),
  birdRights: z.object({
    status: z.string(),
    yearsOfService: z.number().int().optional(),
    yearsWithTeam: z.number().int().optional(),
    eligibleFor: z.array(z.string()).optional(),
  }),
  freeAgency: z.object({
    type: z.string().nullable(),
    year: z.number().int().optional(),
    capHold: MoneyZ.optional(),
    qualifyingOffer: MoneyZ.nullable(),
    earlyTerminationOption: z.string().nullable(),
    hasOption: z.boolean().optional(),
    optionYear: z.string().nullable().optional(),
    optionType: z.string().nullable().optional(),
  }),
  tradeEligibility: z.object({
    canBeTradedNow: z.null(),
    restrictedUntil: z.string().nullable(),
    reason: z.string().nullable(),
    rules: z.object({
      baseYearCompensation: z.boolean(),
      poisonPill: z.boolean(),
      aggregation: z.boolean(),
    }),
  }),
  isMaxContract: z.boolean().optional(),
  maxType: z.string().nullable().optional(),
  estimatedCapPercentage: z.number().nullable().optional(),
  supersededIn: z.string().optional(),
  supersededByContractRef: z.string().optional(),
  supersedesContractRef: z.string().optional(),
});

export const BasePlayerDocZ = z.object({
  playerId: PlayerIdZ,
  displayName: z.string(),
  teamCode: TeamCodeZ,
  teamName: z.string(),
  bio: z.object({
    position: z.string().optional(),
    height: z.string().optional(),
    weight: z.string().optional(),
    age: z.number().optional(),
    birthdate: z.string().optional(),
    experience: z.number().optional(),
    shoots: z.string().optional(),
    draftYear: z.string().optional(),
    draftRound: z.number().optional(),
    draftPick: z.number().optional(),
    draftedBy: z.string().nullable().optional(),
  }),
  contract: BasePlayerContractZ,
  futureContract: BasePlayerContractZ.optional(),
  representation: z
    .object({
      agent: z.string().nullable(),
      agency: z.string().nullable(),
    })
    .optional(),
  source: z
    .object({
      provider: z.string(),
      playerPageUrl: z.string(),
      scrapedAt: z.string(),
    })
    .optional(),
  lastUpdated: z.string(),
  version: z.string(),
});

// World snapshot: /architect/worlds/{worldId}/snapshot/teams/{teamCode}
export const WorldTeamSnapshotZ = BaseTeamDocZ.extend({});

// Types
export type BaseTeamDoc = z.infer<typeof BaseTeamDocZ>;
export type BasePlayerDoc = z.infer<typeof BasePlayerDocZ>;
export type WorldTeamSnapshot = z.infer<typeof WorldTeamSnapshotZ>;
