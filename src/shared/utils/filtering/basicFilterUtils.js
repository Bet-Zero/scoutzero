// Consolidated basic filtering utilities
// Merged from: teamOptions.js, addPlayerUtils.js

import { TeamListFull } from '@/constants/teamList';

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