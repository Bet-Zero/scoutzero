// Consolidated role and position utilities
// Merged from: positionMap.js, roleLabel.js, expandPositionGroup.js, roleOptions.js, subRoleUtils.js

import { SubRoleMasterList } from '@/constants/SubRoleMasterList';

// Position mapping constants
export const POSITION_MAP = {
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

// Get abbreviated position label
export function getPlayerPositionLabel(fullPosition) {
  const map = {
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
  return map[fullPosition] || fullPosition || '—';
}

// Expand position groups to specific positions
export function expandPositionGroup(position) {
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

// Offensive role options
export const offensiveRoles = [
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

// Defensive role options
export const defensiveRoles = [
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

// Shooting profile tiers
export const shootingProfileTiers = [
  'Elite',
  'Plus',
  'Capable',
  'Willing',
  'Hesitant',
  'Non',
];

// Sub-role utility functions
export const isPositiveSubRole = (roleName) => {
  const role = SubRoleMasterList.find((r) => r.name === roleName);
  return role?.isPositive;
};

export const toggleSubroleSelection = (subRoles = {}, roleName) => {
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