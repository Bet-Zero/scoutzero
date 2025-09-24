/**
 * Consolidated Player Filtering Utilities
 * Combines multiple small filter-related files for better maintainability
 * 
 * Consolidated from:
 * - basicFilterUtils.js (21 lines)
 * - physicalOptions.js (28 lines)
 * - statFilters.js (60 lines)
 * - playerFilterDefaults.js (61 lines)
 * - index.js (6 lines)
 * 
 * Total: 176 lines across 5 files → 1 organized file
 */

import { TeamListFull } from '@/constants/teamList';

// ========================================
// BASIC FILTER UTILITIES & TEAM OPTIONS
// ========================================

// Export full team objects for use across filters and dropdowns
export const teamOptions = TeamListFull;

// Default filters for add player functionality
export const getDefaultAddPlayerFilters = () => ({
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
  freeAgentType: '',
});

// ========================================
// PHYSICAL ATTRIBUTE OPTIONS
// ========================================

export const generateHeightOptions = () => {
  const options = [];
  for (let feet = 5; feet <= 7; feet++) {
    for (let inches = 0; inches < 12; inches++) {
      if (feet === 7 && inches > 6) break;
      const totalInches = feet * 12 + inches;
      const heightLabel = `${feet}'${inches}"`;
      options.push({ value: totalInches, label: heightLabel });
    }
  }
  return options;
};

export const generateWeightOptions = () => {
  const options = [];
  for (let weight = 150; weight <= 350; weight += 10) {
    options.push({ value: weight, label: `${weight} lbs` });
  }
  return options;
};

export const generateAgeOptions = () => {
  const options = [];
  for (let age = 18; age <= 45; age++) {
    options.push({ value: age, label: `${age}` });
  }
  return options;
};

// ========================================
// STAT FILTERING UTILITIES
// ========================================

export const statOptions = [
  { label: 'PPG', key: 'PPG' },
  { label: 'RPG', key: 'RPG' },
  { label: 'APG', key: 'APG' },
  { label: 'FG%', key: 'FGP' },
  { label: '3PT%', key: 'TPP' },
  { label: 'FT%', key: 'FTP' },
  { label: 'eFG%', key: 'eFGP' },
  { label: 'MIN', key: 'MIN' },
  { label: 'G', key: 'G' },
];

const defaultMaxValues = {
  PPG: 50,
  RPG: 20,
  APG: 20,
  FGP: 100,
  TPP: 100,
  FTP: 100,
  eFGP: 100,
  MIN: 48,
  G: 82,
};

export const getDefaultMaxValue = (statKey) => defaultMaxValues[statKey] || 100;

export function getActiveStatFilters(filters) {
  const activeFilters = [];
  const validStatKeys = statOptions.map((s) => s.key);

  Object.keys(filters).forEach((key) => {
    if (key.startsWith('min_') || key.startsWith('max_')) {
      const statKey = key.replace('min_', '').replace('max_', '');
      if (validStatKeys.includes(statKey)) {
        const statLabel = statOptions.find((s) => s.key === statKey)?.label;
        const operator = key.startsWith('min_') ? '>=' : '<=';
        const value = filters[key];
        if (typeof value === 'number' && !isNaN(value)) {
          const isMinFilter = key.startsWith('min_');
          const isMaxFilter = key.startsWith('max_');

          if (
            (isMinFilter && value > 0) ||
            (isMaxFilter && value < getDefaultMaxValue(statKey))
          ) {
            activeFilters.push({
              key,
              stat: statLabel,
              operator,
              value,
              fullKey: key,
            });
          }
        }
      }
    }
  });

  return activeFilters;
}

// ========================================
// DEFAULT FILTER CONFIGURATIONS
// ========================================

export function getDefaultPlayerFilters() {
  return {
    nameSearch: '',
    nameOrder: 'az',
    sortBy: '',
    sortAsc: false,
    team: '',
    position: '',
    minHeight: 0,
    maxHeight: null,
    minWeight: 0,
    maxWeight: null,
    minAge: 0,
    maxAge: null,
    minSalary: undefined,
    maxSalary: undefined,
    salaryYear: 2025,
    freeAgentYear: '',
    freeAgentType: '',
    birdRights: '',
    offenseRole: '',
    defenseRole: '',
    subRoles: { offense: [], defense: [] },
    shootingProfile: '',
    min_PPG: 0,
    max_PPG: 50,
    min_RPG: 0,
    max_RPG: 20,
    min_APG: 0,
    max_APG: 20,
    min_FGP: 0,
    max_FGP: 100,
    min_TPP: 0,
    max_TPP: 100,
    min_FTP: 0,
    max_FTP: 100,
    min_eFGP: 0,
    max_eFGP: 100,
    min_MIN: 0,
    max_MIN: 48,
    min_G: 0,
    max_G: 82,
    min_Defense: 0,
    max_Defense: 100,
    min_Energy: 0,
    max_Energy: 100,
    min_Feel: 0,
    max_Feel: 100,
    min_IQ: 0,
    max_IQ: 100,
    min_Passing: 0,
    max_Passing: 100,
    min_Playmaking: 0,
    max_Playmaking: 100,
    min_Rebounding: 0,
    max_Rebounding: 100,
    min_Shooting: 0,
    max_Shooting: 100,
    badges: [],
  };
}

// ========================================
// BARREL EXPORTS (replaces index.js)
// ========================================

// Re-export main filtering functions from other files in this directory
export * from './playerFilterUtils.js';
export * from './filterHelpers.js';