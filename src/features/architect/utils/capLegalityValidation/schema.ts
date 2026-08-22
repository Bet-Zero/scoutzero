/**
 * FILE: src/features/architect/utils/capLegalityValidation/schema.ts
 * PURPOSE: Internal type definitions for capLegalityValidation — extracted from capLegalityValidation.ts (Wave 4 Step 2b).
 * OWNERSHIP: Feature: architect/core
 */
import type { CapHold } from '@/features/architect/utils/capHolds';
import type {
  ArchitectMutationContract,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile/computeProfile';

export type CapLegalityViolation = {
  rule: string;
  message: string;
  severity?: string;
  // eslint-disable-next-line no-restricted-syntax -- LEDGER:CAST-169
  [key: string]: unknown;
};

export type MutationSalaryRow = Omit<
  NonNullable<ArchitectMutationContract['salariesByYear']>[number],
  | 'season'
  | 'salary'
  | 'capHit'
  | 'guaranteed'
  | 'guaranteedAmount'
  | 'optionUsed'
  | 'isExtensionSeason'
> & {
  season?: string | null;
  salary?: number | string | null;
  capHit?: number | string | null;
  guaranteed?: boolean | null;
  guaranteedAmount?: number | string | null;
  optionUsed?: boolean | null;
  isExtensionSeason?: boolean | null;
};
export type MutationContract = Omit<
  ArchitectMutationContract,
  'salariesByYear' | 'freeAgency'
> & {
  salariesByYear?: MutationSalaryRow[];
  freeAgency?:
    | {
        year?: number | string | null;
        type?: string | null;
        qualifyingOffer?: number | null;
      }
    | string
    | null;
  startSeason?: string | null;
  endSeason?: string | null;
  draftPick?: unknown;
};
export type MutationPlayer = Omit<
  ArchitectMutationPlayerRecord,
  'contract' | 'futureContract'
> & {
  contract?: MutationContract | null;
  futureContract?: MutationContract | null;
  yearsOfService?: number | string | null;
  experience?: unknown;
  teamId?: string | null;
  team_id?: string | null;
  draftPick?: unknown;
};
export type MutationTeamTotals = {
  teamSalary?: number | string | null;
  apronTeamSalary?: number | string | null;
  taxSalary?: number | string | null;
  totalSalary?: number | string | null;
  capHit?: number | string | null;
  totalCapAllocations?: number | string | null;
  isHardCapped?: boolean | null;
  hardCapLevel?: string | null;
};
export type MutationTeam = Omit<
  ArchitectMutationTeamRecord,
  'players' | 'twoWayPlayers' | 'capHolds' | 'roster' | 'totals'
> & {
  players?: MutationPlayer[];
  twoWayPlayers?: MutationPlayer[];
  capHolds?: MutationCapHold[];
  roster?: MutationRosterEntry[];
  totals?: MutationTeamTotals | null;
  code?: string | null;
};
export type MutationRosterEntry =
  | string
  | number
  | {
      player_id?: string | null;
      playerId?: string | null;
      id?: string | null;
    };
export type MutationCapHold = Omit<Partial<CapHold>, 'playerId'> & {
  playerId?: string | number | null;
  playerName?: string | null;
  amount?: number | null;
  active?: boolean | null;
  isSigned?: boolean | null;
};
export type KnownCapHold = CapHold & MutationCapHold;
export type MutationValidationResult = {
  valid: boolean;
  violations: CapLegalityViolation[];
  warnings: CapLegalityViolation[];
};

export type SigningTerms = {
  source?: string;
  mechanism?: string | null;
  rightsType?: string | null;
  maxYears?: number | null;
  minYears?: number | null;
  raisePercentage?: number | null;
  maxFirstYearSalary?: number | null;
  minFirstYearSalary?: number | null;
  notes?: string;
};

export type NormalizeSigningTermsOptions = {
  fallbackMechanism?: string | null;
};

export type PlayerRulesProfileResult = ReturnType<
  typeof computePlayerRulesProfile
>;
export type ProducedExtensionTerms = NonNullable<
  PlayerRulesProfileResult['extensionTerms']
>;

export type ValidateOptionDecisionParams = {
  originalTeam?: MutationTeam | null;
  updatedTeam?: MutationTeam | null;
  originalPlayer?: MutationPlayer | null;
  updatedPlayer?: MutationPlayer | null;
  team?: MutationTeam | null;
  player?: MutationPlayer | null;
  accepted?: boolean | null;
  contractId?: string | null;
  targetYear?: number | string | null;
  currentYear?: number | string | null;
};

export type ValidateSigningParams = {
  team: MutationTeam;
  player: MutationPlayer;
  contract: MutationContract | null | undefined;
  signedUsing: string | null | undefined;
  year: number;
  asOfDate?: string;
};

export type ValidateWaiveParams = {
  team: MutationTeam;
  player: MutationPlayer;
  stretch: boolean;
  year: number;
  isGracePeriod?: boolean;
  asOfDate?: string;
};

export type ValidateExtensionParams = {
  team: MutationTeam;
  player: MutationPlayer;
  extension: MutationContract | null | undefined;
  year: number;
  asOfDate?: string;
};

export type ValidateRenounceRightsParams = {
  team: MutationTeam;
  player: MutationPlayer;
  year?: number | null;
};
