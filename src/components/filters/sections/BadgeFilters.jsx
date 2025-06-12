import React from 'react';
import BadgeFilterSelect from '@/components/shared/ui/filters/BadgeFilterSelect';

const BadgeFilters = ({ filters, setFilters }) => (
  <BadgeFilterSelect
    selected={filters.badges || []}
      onChange={(badges) => setFilters((prev) => ({ ...prev, badges }))}
    cols={4}
  />
);

export default BadgeFilters;
