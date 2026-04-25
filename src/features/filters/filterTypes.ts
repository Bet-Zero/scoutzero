import type React from 'react';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

export type PlayerFilterSetter = React.Dispatch<React.SetStateAction<PlayerFilters>>;

export type PlayerFilterPanelProps = {
  filters: PlayerFilters;
  setFilters: PlayerFilterSetter;
};

export type ActiveFilterItem = {
  key: keyof PlayerFilters | string;
  label: string;
  value: string;
  isArrayItem?: boolean;
  isSubrole?: boolean;
  isNonRemovable?: boolean;
  isContext?: boolean;
};

export type GetDefaultPlayerFilters = () => PlayerFilters;
