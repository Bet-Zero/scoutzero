import React from 'react';
import BadgeFilterSelect from '@/shared/components/ui/filters/BadgeFilterSelect';
import type { PlayerFilterPanelProps } from '../../../filterTypes';

const BadgeFilters = ({ filters, setFilters }: PlayerFilterPanelProps) => (
  <BadgeFilterSelect
    selected={filters.badges || []}
    onChange={(badges: string[]) => setFilters((prev) => ({ ...prev, badges }))}
  />
);

export default BadgeFilters;
