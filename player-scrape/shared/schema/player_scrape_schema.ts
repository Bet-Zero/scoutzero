// player_scrape_schema.ts — Type definitions for basePlayers data structure
//
// DESCRIPTION:
//   Zod schema and TypeScript types for NBA player contract data extracted from SalarySwish.
//   This schema defines the structure for /architect/basePlayers/{playerId} documents.
//
// USAGE:
//   import { BasePlayerDoc, basePlayerSchema } from './player_scrape_schema';
//
// RELATED:
//   - parse_player.ts uses this schema for validation
//   - architect-teams-plan/03-TARGET-SCHEMA.md defines the target structure

import { z } from 'zod';

// ===== BIO INFORMATION =====
const BioSchema = z.object({
  position: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  age: z.number().optional(),
  birthdate: z.string().optional(),
  experience: z.number().optional(), // Years in NBA
  draft: z
    .object({
      year: z.number(),
      round: z.number(),
      pick: z.number(),
      team: z.string(),
    })
    .optional(),
});

// ===== CONTRACT DETAILS =====

const GuaranteeScheduleEntrySchema = z.object({
  effectiveDate: z.string(), // "first regular season game" | "Jan 10, 2026"
  guaranteedAmount: z.number(),
  status: z.string(), // "Requirements Met" | "Decision Pending"
  note: z.string(), // Human-readable description
});

const SalaryYearSchema = z.object({
  season: z.string(), // "2025-26"
  salary: z.number(),
  capHit: z.number(),
  guaranteed: z.boolean(),
  guaranteedAmount: z.number(),
  option: z.string().nullable(), // "PO" | "TO" | "ETO" | null
  optionUsed: z.boolean().nullable().optional(), // true | false | null | undefined
  optionDecisionDate: z.string().nullable().optional(), // ISO date string for option decision
  tradeBonus: z.number().nullable(),
  incentives: z.object({
    likely: z.number(),
    unlikely: z.number(),
  }),
  // Guarantee schedule for partially guaranteed contracts
  guaranteeSchedule: z.array(GuaranteeScheduleEntrySchema).optional(),
  // Fields for tracking voided options (when extension supersedes a PO)
  voidedByExtension: z.boolean().optional(),
  voidedOn: z.string().optional(), // ISO date when option was voided
});

const BirdRightsSchema = z.object({
  status: z.string(), // "None" | "Non-Bird" | "Early Bird" | "Bird"
  yearsOfService: z.number().optional(),
  yearsWithTeam: z.number().optional(),
  eligibleFor: z.array(z.string()).optional(),
});

const FreeAgencySchema = z.object({
  type: z.string().nullable(), // "RFA" | "UFA" | null
  year: z.number().optional(),
  capHold: z.number().optional(),
  qualifyingOffer: z.number().nullable(),
  earlyTerminationOption: z.string().nullable(),
});

const TradeEligibilitySchema = z.object({
  canBeTradedNow: z.boolean().nullable(),
  restrictedUntil: z.string().nullable(),
  reason: z.string().nullable(),
  rules: z.object({
    baseYearCompensation: z.boolean(),
    poisonPill: z.boolean(),
    aggregation: z.boolean(),
  }),
});

const ContractSchema = z.object({
  // Contract type
  contractType: z.string(), // "ROOKIE SCALE" | "VETERAN CONTRACT" | "TWO-WAY"
  isExtension: z.boolean(),
  isRookieScale: z.boolean(),

  // Signing details
  signedUsing: z.string().optional(), // "Bird" | "Early Bird" | "MLE" | etc.
  signingTeam: z.string().optional(),
  signingDate: z.string().optional(),
  signingExecutive: z.string().optional(), // Executive who signed the deal (e.g., "Rob Pelinka")
  signedByCurrentTeam: z.boolean().optional(),

  // Contract duration
  startSeason: z.string(),
  endSeason: z.string(),
  contractLength: z.number(),
  yearsRemaining: z.number(),

  // Financial summary
  totalValue: z.number(),
  averageAnnualValue: z.number(),
  guaranteedValue: z.number(),
  guaranteedYears: z.number(),

  // Per-season breakdown
  salariesByYear: z.array(SalaryYearSchema),

  // Trade clauses
  noTradeClause: z.boolean(),
  tradeKicker: z.number().nullable(),
  tradeRestrictions: z.array(z.string()),

  // Bird rights & free agency
  birdRights: BirdRightsSchema,
  freeAgency: FreeAgencySchema,

  // Trade eligibility
  tradeEligibility: TradeEligibilitySchema,

  // Max contract fields
  isMaxContract: z.boolean().optional(),
  maxType: z.string().nullable().optional(), // "Max-25" | "Max-30" | "Max-35" | null
  estimatedCapPercentage: z.number().nullable().optional(), // e.g., 25, 30, 35

  // Supersession tracking (when this contract is replaced by an extension)
  supersededIn: z.string().optional(), // Season when superseded (e.g., "2026-27")
  supersededByContractRef: z.string().optional(), // Reference to the superseding contract
});

// ===== SOURCE METADATA =====
const SourceMetaSchema = z.object({
  provider: z.string(),
  playerPageUrl: z.string(),
  scrapedAt: z.string(),
});

// ===== BASE PLAYER DOCUMENT =====
export const basePlayerSchema = z.object({
  // Player identity
  playerId: z.string(),
  displayName: z.string(),
  teamCode: z.string(),
  teamName: z.string(),

  // Bio
  bio: BioSchema,

  // Contract
  contract: ContractSchema,

  // Future contract (for players with extensions)
  futureContract: ContractSchema.optional(),

  // Metadata
  source: SourceMetaSchema,
  lastUpdated: z.string(),
  version: z.string(),
});

// Export TypeScript types
export type BasePlayerDoc = z.infer<typeof basePlayerSchema>;
export type Bio = z.infer<typeof BioSchema>;
export type SalaryYear = z.infer<typeof SalaryYearSchema>;
export type BirdRights = z.infer<typeof BirdRightsSchema>;
export type FreeAgency = z.infer<typeof FreeAgencySchema>;
export type TradeEligibility = z.infer<typeof TradeEligibilitySchema>;
export type Contract = z.infer<typeof ContractSchema>;
export type SourceMeta = z.infer<typeof SourceMetaSchema>;
