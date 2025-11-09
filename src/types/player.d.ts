/**
 * V2 Player Schema Types
 * Generated from firestore-complete.json
 * 
 * This file defines the canonical v2 schema structure for players
 * including main document and subcollections (contracts, seasons, evaluations)
 */

/**
 * DEPRECATION NOTICE:
 * Canonical schemas now live in `src/schemas/players_v2.ts`.
 * Prefer importing the types below instead of these legacy interfaces.
 */
export type CanonicalPlayerMainDoc = import('@/schemas/players_v2').PlayerMainDoc;
export type CanonicalContractDoc = import('@/schemas/players_v2').ContractDoc;
export type CanonicalSeasonDoc = import('@/schemas/players_v2').SeasonDoc;
export type CanonicalEvaluationDoc = import('@/schemas/players_v2').EvaluationDoc;
export type CanonicalPlayerV2 = import('@/schemas/players_v2').PlayerV2;

export type SeasonId = string;   // e.g. "2025-26"
export type ContractId = string; // e.g. "std_202425" | "ext_202627"

/**
 * Shooting profile enum
 */
export type ShootingProfile = 'Elite' | 'Plus' | 'Capable' | 'Willing' | 'Hesitant' | 'Non';

/**
 * Shoots enum
 */
export type Shoots = 'Right' | 'Left';

/**
 * Bio information - main player biographical data
 */
export interface Bio {
  displayName: string;
  name?: string;
  slug?: string; // slugified player ID
  playerId?: string;
  position?: string;
  age?: number;
  height?: number; // inches (converted from feet-inches)
  weight?: number;
  dob?: string;
  birthplace?: string;
  nationality?: string;
  shoots?: Shoots;
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
    teamId?: string;
    POS?: string;
    yearsPro?: number;
    averageAnnualValue?: number;
    yearsLeft?: number;
    freeAgentYear?: number;
    freeAgentType?: string;
  };
  [k: string]: unknown; // allow additional schema-backed fields
}

export type ContractDoc = CanonicalContractDoc;
export type ContractFreeAgency = ContractDoc['freeAgency'];
export type SalaryByYear = ContractDoc['salariesByYear'][number];

/**
 * Contract view - denormalized contract data in season/bio
 */
export interface ContractView {
  contractId?: string; // winning contract ID for this season
  salary?: number;
  contractValue?: number;
  contractLength?: number;
  averageAnnualValue?: number;
  yearsLeft?: number;
  freeAgentYear?: number;
  freeAgentType?: string;
  signingTeam?: string;
  options?: unknown[] | null;
  birdRights?: string | null;
  [k: string]: unknown;
}

/**
 * Evaluation view - denormalized evaluation data in season
 */
export interface EvaluationView {
  overallGrade?: number;
  badges?: string[];
  roles?: {
    offense1?: string;
    offense2?: string;
    defense1?: string;
    defense2?: string;
  };
  shootingProfile?: ShootingProfile;
  twoWay?: number;
  traits?: Record<string, number>;
  [k: string]: unknown;
}

/**
 * Season document structure (subcollection)
 */
export interface SeasonDoc {
  age?: number;
  team?: string;
  pos?: string;
  stats?: {
    PTS?: number;
    AST?: number;
    REB?: number;
    STL?: number;
    BLK?: number;
    TOV?: number;
    PF?: number;
    ORB?: number;
    DRB?: number;
    FGM?: number;
    FGA?: number;
    'FG%'?: number;
    '3PM'?: number;
    '3PA'?: number;
    '3PT%'?: number;
    '2PM'?: number;
    '2PA'?: number;
    '2PT%'?: number;
    FTM?: number;
    FTA?: number;
    'FT%'?: number;
    'eFG%'?: number;
    GP?: number;
    GS?: number;
    MIN?: number;
    [k: string]: number | undefined;
  };
  evaluationView?: EvaluationView;
  contractView?: ContractView;
  meta?: {
    lastStatsUpdate?: {
      _seconds?: number;
      _nanoseconds?: number;
    };
    statsCarryOver?: boolean;
    statsSeasonTag?: string;
  };
  [k: string]: unknown;
}

/**
 * Evaluation document structure (subcollection)
 */
export interface EvaluationDoc {
  traits?: {
    Shooting?: number;
    Passing?: number;
    Playmaking?: number;
    Defense?: number;
    Feel?: number;
    Rebounding?: number;
    IQ?: number;
    Energy?: number;
  };
  twoWay?: number;
  shootingProfile?: ShootingProfile;
  roles?: {
    offense1?: string;
    offense2?: string;
    defense1?: string;
    defense2?: string;
  };
  subRoles?: {
    offense?: string[];
    defense?: string[];
  };
  badges?: string[];
  overallGrade?: number;
  blurbs?: {
    overall?: string;
    shootingProfile?: string;
    twoWayMeter?: string;
    traits?: {
      Shooting?: string;
      Passing?: string;
      Playmaking?: string;
      Rebounding?: string;
      Defense?: string;
      IQ?: string;
      Feel?: string;
      Energy?: string;
    };
    roles?: {
      offense1?: string;
      offense2?: string;
      defense1?: string;
      defense2?: string;
    };
    subroles?: Record<string, string>;
  };
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
  meta?: {
    lastBioUpdate?: {
      seconds?: number;
      nanoseconds?: number;
    };
  };
  [k: string]: unknown;
}

/**
 * Full player V2 structure with subcollections
 * For use with usePlayerDetail hook
 */
export interface PlayerV2 extends PlayerMainDoc {
  id: string;
  contracts?: Record<ContractId, ContractDoc>;
  seasons?: Record<SeasonId, SeasonDoc>;
  evaluations?: Record<string, EvaluationDoc>;
}

/**
 * Simple player list item (for list views - main doc only)
 * For use with useSimplePlayerData hook
 */
export interface PlayerListItem extends PlayerMainDoc {
  id: string;
}
