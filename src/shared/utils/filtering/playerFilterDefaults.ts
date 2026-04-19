import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

export type PlayerFilters = {
  nameSearch: string;
  sortBy: string;
  sortAsc: boolean;
  team: string;
  position: string;
  showFreeAgents: boolean;
  minHeight: number;
  maxHeight: number | null;
  minWeight: number;
  maxWeight: number | null;
  minAge: number;
  maxAge: number | null;
  minSalary: number | undefined;
  maxSalary: number | undefined;
  salaryYear: number;
  includeMissingSalary: boolean;
  freeAgentYear: string;
  freeAgentType: string;
  birdRights: string;
  optionTypes: string[];
  optionYear: number | null;
  min_overall_grade: number | undefined;
  max_overall_grade: number | undefined;
  offenseRole: string;
  defenseRole: string;
  subRoles: { offense: string[]; defense: string[] };
  shootingProfile: string;
  min_PPG: number; max_PPG: number;
  min_RPG: number; max_RPG: number;
  min_APG: number; max_APG: number;
  min_FGP: number; max_FGP: number;
  min_TPP: number; max_TPP: number;
  min_FTP: number; max_FTP: number;
  min_eFGP: number; max_eFGP: number;
  min_MIN: number; max_MIN: number;
  min_G: number; max_G: number;
  min_Defense: number; max_Defense: number;
  min_Energy: number; max_Energy: number;
  min_Feel: number; max_Feel: number;
  min_IQ: number; max_IQ: number;
  min_Passing: number; max_Passing: number;
  min_Playmaking: number; max_Playmaking: number;
  min_Rebounding: number; max_Rebounding: number;
  min_Shooting: number; max_Shooting: number;
  badges: string[];
};

export function getDefaultPlayerFilters(): PlayerFilters {
  return {
    nameSearch: '',
    sortBy: 'name',
    sortAsc: false,
    team: '',
    position: '',
    showFreeAgents: true,
    minHeight: 0,
    maxHeight: null,
    minWeight: 0,
    maxWeight: null,
    minAge: 0,
    maxAge: null,
    minSalary: undefined,
    maxSalary: undefined,
    salaryYear: DEFAULT_SALARY_YEAR,
    includeMissingSalary: true,
    freeAgentYear: '',
    freeAgentType: '',
    birdRights: '',
    optionTypes: [],
    optionYear: null,
    min_overall_grade: undefined,
    max_overall_grade: undefined,
    offenseRole: '',
    defenseRole: '',
    subRoles: { offense: [], defense: [] },
    shootingProfile: '',
    min_PPG: 0, max_PPG: 50,
    min_RPG: 0, max_RPG: 20,
    min_APG: 0, max_APG: 20,
    min_FGP: 0, max_FGP: 100,
    min_TPP: 0, max_TPP: 100,
    min_FTP: 0, max_FTP: 100,
    min_eFGP: 0, max_eFGP: 100,
    min_MIN: 0, max_MIN: 48,
    min_G: 0, max_G: 82,
    min_Defense: 0, max_Defense: 100,
    min_Energy: 0, max_Energy: 100,
    min_Feel: 0, max_Feel: 100,
    min_IQ: 0, max_IQ: 100,
    min_Passing: 0, max_Passing: 100,
    min_Playmaking: 0, max_Playmaking: 100,
    min_Rebounding: 0, max_Rebounding: 100,
    min_Shooting: 0, max_Shooting: 100,
    badges: [],
  };
}
