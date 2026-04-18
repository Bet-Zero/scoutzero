// File: src/shared/utils/selectors/newSchemeSelectors.ts
//
// Purpose: Centralized getters for a player season document shape.
//
// NOTE: This file has ZERO callers in the codebase (as of 2026-04-18).
// It was written against a richer "new schema" shape (bio, team.code, evaluations)
// that does NOT match the SeasonDocZ Zod schema in src/schemas/players_v2.ts.
// SeasonDocZ has: age (flat), team (string), evaluationView, contractView (no optionType/rights).
// Before wiring up any callers, reconcile which schema shape applies.

type ContractView = {
  salary?: number | null;
  yearsLeft?: number | null;
  freeAgentYear?: number | null;
  optionType?: string | null;
  rights?: string | null;
  [key: string]: unknown;
};

type EvaluationView = {
  grades?: Record<string, number>;
  roles?: { offense: string | null; defense: string | null };
  subroles?: { offense: string[]; defense: string[] };
  shootingProfile?: string | null;
  twoWayMeter?: number | null;
  blurbs?: Record<string, unknown>;
  [key: string]: unknown;
};

type SeasonDocShape = {
  bio?: {
    displayName?: string | null;
    age?: number | null;
    position?: string | null;
    height?: number | null;
    weight?: number | null;
    [key: string]: unknown;
  } | null;
  team?: { code?: string | null } | null;
  stats?: Record<string, number> | null;
  contractView?: ContractView | null;
  evaluations?: EvaluationView | null;
};

export function getDisplayName(seasonDoc: SeasonDocShape | null | undefined, fallback = '—'): string {
  return seasonDoc?.bio?.displayName ?? fallback;
}
export function getAge(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.bio?.age ?? fallback;
}
export function getPosition(seasonDoc: SeasonDocShape | null | undefined, fallback: string | null = null): string | null {
  return seasonDoc?.bio?.position ?? fallback;
}
export function getHeight(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.bio?.height ?? fallback;
}
export function getWeight(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.bio?.weight ?? fallback;
}

export function getTeamCode(seasonDoc: SeasonDocShape | null | undefined, fallback: string | null = null): string | null {
  return seasonDoc?.team?.code ?? fallback;
}

export function getPTS(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.stats?.['pts'] ?? fallback;
}
export function getAST(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.stats?.['ast'] ?? fallback;
}
export function getREB(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.stats?.['reb'] ?? fallback;
}
export function getFGPct(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.stats?.['fgPct'] ?? fallback;
}
export function get3PPct(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.stats?.['tpPct'] ?? fallback;
}
export function getFTPct(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.stats?.['ftPct'] ?? fallback;
}
export function getStat(seasonDoc: SeasonDocShape | null | undefined, key: string, fallback: number | null = null): number | null {
  return seasonDoc?.stats?.[key] ?? fallback;
}

export function getContractView(seasonDoc: SeasonDocShape | null | undefined, fallback: ContractView | null = null): ContractView | null {
  return seasonDoc?.contractView ?? fallback;
}
export function getSalary(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.contractView?.salary ?? fallback;
}
export function getYearsLeft(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.contractView?.yearsLeft ?? fallback;
}
export function getFAYear(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.contractView?.freeAgentYear ?? fallback;
}
export function hasPlayerOption(seasonDoc: SeasonDocShape | null | undefined): boolean {
  return seasonDoc?.contractView?.optionType?.toLowerCase() === 'player';
}
export function hasTeamOption(seasonDoc: SeasonDocShape | null | undefined): boolean {
  return seasonDoc?.contractView?.optionType?.toLowerCase() === 'team';
}
export function getContractRights(seasonDoc: SeasonDocShape | null | undefined, fallback = 'None'): string {
  return seasonDoc?.contractView?.rights ?? fallback;
}

export function hasEvaluations(seasonDoc: SeasonDocShape | null | undefined): boolean {
  return !!seasonDoc?.evaluations;
}
export function getEvalGrades(seasonDoc: SeasonDocShape | null | undefined): Record<string, number> {
  return seasonDoc?.evaluations?.grades ?? {};
}
export function getEvalRoles(seasonDoc: SeasonDocShape | null | undefined): { offense: string | null; defense: string | null } {
  return seasonDoc?.evaluations?.roles ?? { offense: null, defense: null };
}
export function getEvalSubroles(seasonDoc: SeasonDocShape | null | undefined): { offense: string[]; defense: string[] } {
  return seasonDoc?.evaluations?.subroles ?? { offense: [], defense: [] };
}
export function getEvalShootingProfile(seasonDoc: SeasonDocShape | null | undefined, fallback: string | null = null): string | null {
  return seasonDoc?.evaluations?.shootingProfile ?? fallback;
}
export function getEvalTwoWay(seasonDoc: SeasonDocShape | null | undefined, fallback: number | null = null): number | null {
  return seasonDoc?.evaluations?.twoWayMeter ?? fallback;
}
export function getEvalBlurbs(seasonDoc: SeasonDocShape | null | undefined): Record<string, unknown> {
  return seasonDoc?.evaluations?.blurbs ?? {};
}

export function assertSeasonDocShape(seasonDoc: SeasonDocShape | null | undefined): true {
  if (!seasonDoc) throw new Error('seasonDoc is null/undefined');
  if (!seasonDoc.bio) throw new Error('seasonDoc.bio missing');
  if (!seasonDoc.team) throw new Error('seasonDoc.team missing');
  return true;
}
