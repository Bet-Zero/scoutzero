import { TeamListFull } from '@/constants/teamList';

type TeamEntry = (typeof TeamListFull)[number];

const normalizeTeamKey = (value: string): string =>
  value
    .toString()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const TEAM_CODE_LOOKUP = [...TeamListFull].reduce<Map<string, string>>((map, team) => {
  const code = team.code.toUpperCase();
  map.set(team.code.toLowerCase(), code);
  map.set(team.id.toLowerCase(), code);
  map.set(team.teamName.toLowerCase(), code);
  map.set(team.nickname.toLowerCase(), code);
  map.set(normalizeTeamKey(team.teamName), code);
  map.set(normalizeTeamKey(team.nickname), code);
  return map;
}, new Map());

export const normalizeTeamCode = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (TEAM_CODE_LOOKUP.has(lower)) return TEAM_CODE_LOOKUP.get(lower)!;
  const normalized = normalizeTeamKey(raw);
  if (TEAM_CODE_LOOKUP.has(normalized)) return TEAM_CODE_LOOKUP.get(normalized)!;
  if (raw.length === 3) return raw.toUpperCase();
  return raw;
};

export const normalizeFreeAgentType = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === 'any' || raw === 'any type') return '';

  if (raw === 'ufa' || raw === 'unrestricted' || raw === 'unrestricted fa') return 'ufa';
  if (raw === 'rfa' || raw === 'restricted' || raw === 'restricted fa') return 'rfa';
  if (raw === 'sfa') return 'sfa';
  if (['two_way', 'two-way', 'two way', 'twoway', '2-way', '2w'].includes(raw)) return 'two_way';
  if (raw === 'none') return 'none';

  if (raw === 'team option' || raw === 'team_option') return 'to';
  if (raw === 'player option' || raw === 'player_option') return 'po';
  if (raw === 'early termination option' || raw === 'eto') return 'eto';

  return raw;
};

type PlayerWithFAType = {
  currentContractView?: { freeAgentType?: string | null } | null;
  bio?: {
    displayName?: string | null;
    display?: { freeAgentType?: string | null } | null;
  } | null;
  primaryContract?: { freeAgency?: { freeAgentType?: string | null } | null } | null;
  freeAgentType?: string | null;
};

export const getPlayerFreeAgentType = (
  player: PlayerWithFAType | null | undefined
): string | null => {
  if (!player) return null;

  const rawType =
    player.currentContractView?.freeAgentType ||
    player.bio?.display?.freeAgentType ||
    player.primaryContract?.freeAgency?.freeAgentType ||
    player.freeAgentType ||
    null;

  if (!rawType) return null;
  const normalized = normalizeFreeAgentType(rawType);
  return normalized || null;
};

export const teamOptions: TeamEntry[] = [...TeamListFull];

type PlayerWithOptions = {
  bio?: { displayName?: string | null } | null;
  optionByYear?: Record<string, string | null | undefined> | null;
  original?: {
    optionByYear?: Record<string, string | null | undefined> | null;
    options?: Array<{ type?: string | null } | string | null | undefined> | null;
  } | null;
  options?: Array<{ type?: string | null } | string | null | undefined> | null;
};

export const playerHasOptionType = (
  player: PlayerWithOptions | null | undefined,
  optionType: string
): boolean => {
  if (!player || !optionType) return false;

  const normalizedType = optionType.toUpperCase();

  const optionByYear = player.optionByYear || player.original?.optionByYear;
  if (optionByYear && typeof optionByYear === 'object') {
    const hasOption = Object.values(optionByYear).some(
      (opt) => opt?.toUpperCase?.() === normalizedType
    );
    if (hasOption) return true;
  }

  const options = player.options || player.original?.options;
  if (Array.isArray(options)) {
    const hasOption = options.some((opt) => {
      const type = typeof opt === 'object' && opt !== null ? opt.type : opt;
      return (type as string | undefined)?.toUpperCase?.() === normalizedType;
    });
    if (hasOption) return true;
  }

  return false;
};

type PlayerWithContract = {
  bio?: { displayName?: string | null } | null;
  original?: PlayerWithContract | null;
  contract?: { signedUsing?: string | null; contractType?: string | null } | null;
  primaryContract?: { signedUsing?: string | null; contractType?: string | null } | null;
  contracts?: Record<
    string,
    { signedUsing?: string | null; contractType?: string | null } | null | undefined
  > | null;
  contractView?: { signedUsing?: string | null; contractType?: string | null } | null;
  currentContractView?: { signedUsing?: string | null; contractType?: string | null } | null;
};

export const isPlayerTwoWay = (player: PlayerWithContract | null | undefined): boolean => {
  if (!player) return false;

  const p = player.original || player;

  const contract =
    p.contract ||
    p.primaryContract ||
    (p.contracts ? Object.values(p.contracts)[0] : null) ||
    p.contractView ||
    p.currentContractView ||
    null;

  const fieldsToCheck = [
    typeof contract?.signedUsing === 'string' ? contract.signedUsing : null,
    typeof contract?.contractType === 'string' ? contract.contractType : null,
  ];

  return fieldsToCheck.some(
    (val) =>
      typeof val === 'string' &&
      ['two-way', 'two way', 'two_way'].some((keyword) =>
        val.toLowerCase().includes(keyword)
      )
  );
};

export type AddPlayerFilters = {
  team: string;
  position: string;
  offenseRole: string;
  defenseRole: string;
  subRoles: { offense: string[]; defense: string[] };
  shootingProfile: string;
  badges: string[];
  minSalary: number | undefined;
  maxSalary: number | undefined;
  freeAgentYear: string;
  freeAgentStatus: string;
  contractFeature: string;
  minHeight: number | undefined;
  maxHeight: number | undefined;
  minWeight: number | undefined;
  maxWeight: number | undefined;
  minAge: number | undefined;
  maxAge: number | undefined;
  PPG_op: string; min_PPG: number | undefined; max_PPG: number | undefined;
  RPG_op: string; min_RPG: number | undefined; max_RPG: number | undefined;
  APG_op: string; min_APG: number | undefined; max_APG: number | undefined;
  FGP_op: string; min_FGP: number | undefined; max_FGP: number | undefined;
  TPP_op: string; min_TPP: number | undefined; max_TPP: number | undefined;
  FTP_op: string; min_FTP: number | undefined; max_FTP: number | undefined;
  eFGP_op: string; min_eFGP: number | undefined; max_eFGP: number | undefined;
  MIN_op: string; min_MIN: number | undefined; max_MIN: number | undefined;
  G_op: string; min_G: number | undefined; max_G: number | undefined;
};

export const getDefaultAddPlayerFilters = (): AddPlayerFilters => ({
  team: '',
  position: '',
  offenseRole: '',
  defenseRole: '',
  subRoles: { offense: [], defense: [] },
  shootingProfile: '',
  badges: [],
  minSalary: undefined,
  maxSalary: undefined,
  freeAgentYear: '',
  freeAgentStatus: '',
  contractFeature: '',
  minHeight: undefined,
  maxHeight: undefined,
  minWeight: undefined,
  maxWeight: undefined,
  minAge: undefined,
  maxAge: undefined,
  PPG_op: '', min_PPG: undefined, max_PPG: undefined,
  RPG_op: '', min_RPG: undefined, max_RPG: undefined,
  APG_op: '', min_APG: undefined, max_APG: undefined,
  FGP_op: '', min_FGP: undefined, max_FGP: undefined,
  TPP_op: '', min_TPP: undefined, max_TPP: undefined,
  FTP_op: '', min_FTP: undefined, max_FTP: undefined,
  eFGP_op: '', min_eFGP: undefined, max_eFGP: undefined,
  MIN_op: '', min_MIN: undefined, max_MIN: undefined,
  G_op: '', min_G: undefined, max_G: undefined,
});
