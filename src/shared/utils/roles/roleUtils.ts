import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import type { SubRoleType } from '@/constants/SubRoleMasterList';

// Note: POSITION_MAP and getPlayerPositionLabel both define the same position → abbreviation
// mapping. Consolidation opportunity flagged — see follow-up items in TS_CONVERSION_NEXT_STEPS.md.
export const POSITION_MAP: Record<string, string> = {
  Guard: 'G',
  'Point Guard': 'PG',
  'Shooting Guard': 'SG',
  Forward: 'F',
  'Small Forward': 'SF',
  'Power Forward': 'PF',
  Center: 'C',
  'Forward-Center': 'F/C',
  'Guard-Forward': 'G/F',
  'Forward-Guard': 'F',
  'Center-Forward': 'C',
};

export function getPlayerPositionLabel(fullPosition: string | null | undefined): string {
  const map: Record<string, string> = {
    Guard: 'G',
    'Point Guard': 'PG',
    'Shooting Guard': 'SG',
    Forward: 'F',
    'Small Forward': 'SF',
    'Power Forward': 'PF',
    Center: 'C',
    'Forward-Center': 'F/C',
    'Guard-Forward': 'G/F',
    'Forward-Guard': 'F',
    'Center-Forward': 'C',
  };
  return (fullPosition && map[fullPosition]) || fullPosition || '—';
}

export function expandPositionGroup(position: string | null | undefined): string[] {
  switch (position) {
    case 'group_guard':
    case 'Guard':
      return ['PG', 'SG', 'G'];
    case 'group_wing':
      return ['SG', 'SF', 'G/F'];
    case 'group_forward':
      return ['SF', 'PF', 'F'];
    case 'group_big':
    case 'Big':
      return ['F/C', 'C'];
    case 'Wing':
      return ['G/F', 'F'];
    case 'Forward':
      return ['F', 'F/C'];
    case 'Center':
      return ['C'];
    default:
      return position ? [position] : [];
  }
}

export const offensiveRoles: string[] = [
  'Primary Playmaker',
  'Primary Ball Handler',
  'Secondary Creator',
  'Scorer',
  'Shooter',
  'Floor Spacer',
  'Off-Ball Scorer',
  'Off-Ball Mover',
  'Connector',
  'Versatile Big',
  'Post Hub',
  'Post Scorer',
  'Stretch Big',
  'Play Finisher',
];

export const defensiveRoles: string[] = [
  'Point-of-Attack',
  'Chaser',
  'Wing Stopper',
  'Off-Ball Helper',
  'Defensive Playmaker',
  'Defensive Quarterback',
  'Switchable Wing',
  'Switchable Big',
  'Mobile Big',
  'Post Defender',
  'Anchor Big',
];

export const shootingProfileTiers: string[] = [
  'Elite',
  'Plus',
  'Capable',
  'Willing',
  'Hesitant',
  'Non',
];

export const isPositiveSubRole = (roleName: string): boolean | undefined => {
  const role = SubRoleMasterList.find((r) => r.name === roleName);
  return role?.isPositive;
};

export const toggleSubroleSelection = (
  subRoles: Partial<Record<SubRoleType, string[]>> = {},
  roleName: string
): Partial<Record<SubRoleType, string[]>> => {
  const roleData = SubRoleMasterList.find((r) => r.name === roleName);
  if (!roleData) return subRoles;

  const { type } = roleData;
  const currentList = subRoles[type] || [];
  return {
    ...subRoles,
    [type]: currentList.includes(roleName)
      ? currentList.filter((r) => r !== roleName)
      : [...currentList, roleName],
  };
};
