import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { computePlayerRulesProfile } from '@/features/architect/utils/salaryEngine';

type ComputePlayerRulesProfileFn = typeof computePlayerRulesProfile;
type ContractSlicePlayer = NonNullable<Parameters<typeof getContractYearSlice>[0]>;
type ComputeProfilePlayer = NonNullable<
  Parameters<ComputePlayerRulesProfileFn>[0]
>;

export type PlayerRulesProfile = ReturnType<ComputePlayerRulesProfileFn>;
export type PlayerRulesProfileTeamContext = NonNullable<
  Parameters<ComputePlayerRulesProfileFn>[1]
>;
export type PlayerRulesProfileLeagueContext = NonNullable<
  Parameters<ComputePlayerRulesProfileFn>[2]
>;

export type PlayerRulesProfileFreeAgency =
  | {
      year?: number | string | null;
      type?: string | null;
    }
  | string
  | null
  | undefined;

export type PlayerRulesProfileInputBio = NonNullable<
  ComputeProfilePlayer['bio']
> & {
  playerId?: string | null;
  displayName?: string | null;
};

export type PlayerRulesProfileInputContract = NonNullable<
  ComputeProfilePlayer['contract']
> & {
  contractType?: string | null;
  freeAgency?: PlayerRulesProfileFreeAgency;
};

export type PlayerRulesProfileInput = Omit<
  ContractSlicePlayer,
  'playerId' | 'player_id' | 'id' | 'bio' | 'contract'
> &
  Omit<
    ComputeProfilePlayer,
    'playerId' | 'player_id' | 'id' | 'bio' | 'contract'
  > & {
    playerId?: string | null;
    player_id?: string | null;
    id?: string | null;
    displayName?: string | null;
    name?: string | null;
    age?: number | string | null;
    position?: string | null;
    yearsOfService?: number | string | null;
    years_of_service?: number | string | null;
    experience?: unknown;
    yearsPro?: unknown;
    ['Years Pro']?: unknown;
    isMinimum?: boolean;
    bio?: PlayerRulesProfileInputBio | null;
    contractType?: string | null;
    contract?: PlayerRulesProfileInputContract | null;
    futureContract?:
      | {
          contractType?: string | null;
          freeAgency?: PlayerRulesProfileFreeAgency;
        }
      | null;
  };

export type PlayerRulesProfileTeamCapSheet = {
  players?: PlayerRulesProfileInput[] | null;
  teamCode?: string | null;
  capHolds?: unknown[] | null;
  offerSheets?: unknown[] | null;
  incomingOfferSheets?: unknown[] | null;
  deadCap?: unknown[] | null;
  exceptions?: Record<string, unknown> | null;
};

export type UsePlayerRulesProfilesParams = {
  players?: PlayerRulesProfileInput[] | null;
  teamCapSheet?: PlayerRulesProfileTeamCapSheet | null;
  currentYear?: number | null;
  teamCode?: string | null;
  simulationDate?: Date | null;
  leaguePhase?: string | null;
  evaluationYears?: Array<number | null | undefined> | null;
};

export type PlayerRulesProfilesResult = {
  profilesById: Map<string, PlayerRulesProfile>;
  leagueContext: PlayerRulesProfileLeagueContext | null;
  teamContext: PlayerRulesProfileTeamContext | null;
  leagueContextByYear: Map<number, PlayerRulesProfileLeagueContext>;
  teamContextByYear: Map<number, PlayerRulesProfileTeamContext>;
  profilesByYear: Map<number, Map<string, PlayerRulesProfile>>;
  getProfile: (
    player: PlayerRulesProfileInput | null | undefined,
    yearOverride?: number | null
  ) => PlayerRulesProfile | null;
  getProfileForYear: (
    player: PlayerRulesProfileInput | null | undefined,
    year?: number
  ) => PlayerRulesProfile | null;
};
