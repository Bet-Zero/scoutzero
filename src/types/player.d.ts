/**
 * V2 Player Schema Types
 * Generated from firestore-complete.json
 * 
 * This file defines the canonical v2 schema structure for players
 * including main document and subcollections (contracts, seasons, evaluations)
 */

export type SeasonId = string;   // e.g. "2025-26"
export type ContractId = string; // e.g. "std_202425" | "ext_202627"

/**
 * Bio information - main player biographical data
 */
export interface Bio {
  displayName: string;
  name?: string;
  playerId?: string;
  position?: string;
  age?: number;
  height?: number; // inches
  weight?: number;
  dob?: string;
  birthplace?: string;
  nationality?: string;
  shoots?: 'Right' | 'Left';
  nbaId?: number;
  agent?: {
    name?: string;
    agency?: string;
  };
  draft?: {
    year?: number;
    round?: number;
    pick?: number;
    teamId?: string;
  };
  display?: {
    team?: string;
    yearsPro?: number;
    averageAnnualValue?: number;
    yearsLeft?: number;
    freeAgentYear?: number;
    freeAgentType?: string;
    teamId?: string;
    POS?: string;
  };
  [k: string]: unknown; // allow additional schema-backed fields
}

/**
 * Free agency information within contract
 */
export interface ContractFreeAgency {
  freeAgentType?: string;
  freeAgentYear?: number;
  qualifyingOffer?: number | null;
  capHold?: number | null;
  birdRights?: string | null;
  [k: string]: unknown;
}

/**
 * Salary information by year
 */
export interface SalaryByYear {
  year?: number;
  season?: SeasonId;
  salary?: number;
  guaranteed?: boolean;
  option?: string | null;
  [k: string]: unknown;
}

/**
 * Contract document structure (subcollection)
 */
export interface ContractDoc {
  signingTeam?: string | null;
  contractType?: string | null;
  signedUsing?: string | null;
  contractValue?: number | null;
  contractLength?: number | null;
  averageAnnualValue?: number | null;
  guaranteedValue?: number | null;
  guaranteedYears?: number | null;
  capPercentage?: number | null;
  signingDate?: string | null;
  isExtension?: boolean;
  noTradeClause?: boolean;
  tradeKicker?: number | null;
  options?: unknown[] | null;
  incentives?: { likely?: number | null; unlikely?: number | null } | null;
  freeAgency?: ContractFreeAgency | null;
  salariesByYear?: SalaryByYear[];
  startSeason?: SeasonId | null;
  endSeason?: SeasonId | null;
  [k: string]: unknown;
}

/**
 * Contract view - denormalized contract data in season/bio
 */
export interface ContractView {
  salary?: number;
  contractValue?: number;
  contractLength?: number;
  averageAnnualValue?: number;
  yearsLeft?: number;
  freeAgentYear?: number;
  freeAgentType?: string;
  signingTeam?: string;
  [k: string]: unknown;
}

/**
 * Evaluation view - denormalized evaluation data in season
 */
export interface EvaluationView {
  overallGrade?: number;
  badges?: string[];
  roles?: Record<string, string>;
  traits?: Record<string, number>;
  [k: string]: unknown;
}

/**
 * Season document structure (subcollection)
 */
export interface SeasonDoc {
  age?: number;
  team?: string;
  stats?: Record<string, number>;
  evaluationView?: EvaluationView;
  contractView?: ContractView;
  [k: string]: unknown;
}

/**
 * Evaluation document structure (subcollection)
 */
export interface EvaluationDoc {
  traits?: Record<string, number>;
  twoWay?: number;
  shootingProfile?: string;
  roles?: Record<string, string>;
  subRoles?: {
    offense?: string[];
    defense?: string[];
  };
  badges?: string[];
  overallGrade?: number;
  blurbs?: Record<string, unknown>;
  meta?: {
    methodVersion?: string;
    updatedAt?: string;
    updatedBy?: string;
    seasonContext?: string;
  };
  [k: string]: unknown;
}

/**
 * Main player document (top-level fields only, no subcollections)
 */
export interface PlayerMainDoc {
  bio: Bio;
  contractView?: ContractView;
  evaluationView?: EvaluationView;
  [k: string]: unknown;
}

/**
 * Full player V2 structure with subcollections
 */
export interface PlayerV2 {
  id: string;
  doc: PlayerMainDoc;
  contracts?: Record<ContractId, ContractDoc>;
  seasons?: Record<SeasonId, SeasonDoc>;
  evaluations?: Record<string, EvaluationDoc>;
}

/**
 * Simple player list item (for list views - main doc only)
 */
export interface PlayerListItem {
  id: string;
  doc: PlayerMainDoc;
}
