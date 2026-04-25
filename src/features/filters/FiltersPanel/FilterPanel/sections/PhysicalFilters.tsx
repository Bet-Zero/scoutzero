import React from 'react';
import RangeSelector from '@/shared/components/ui/filters/RangeSelector';
import {
  generateHeightOptions,
  generateWeightOptions,
  generateAgeOptions,
} from '@/shared/utils/filtering';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';
import type { PlayerFilterPanelProps } from '../../../filterTypes';

const PhysicalFilters = ({ filters, setFilters }: PlayerFilterPanelProps) => {
  const update = <K extends keyof PlayerFilters>(key: K, value: PlayerFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const heightOptions = generateHeightOptions();
  const weightOptions = generateWeightOptions();
  const ageOptions = generateAgeOptions();

  return (
    <div className="space-y-4">
      <h2 className="text-white text-sm font-bold">Physical Attributes</h2>
      <div className="grid grid-cols-3 gap-4 text-white text-sm">
        <RangeSelector
          label="Height"
          minKey="minHeight"
          maxKey="maxHeight"
          allowNullMax
          options={heightOptions}
          filters={filters}
          update={update}
        />
        <RangeSelector
          label="Weight"
          minKey="minWeight"
          maxKey="maxWeight"
          options={weightOptions}
          filters={filters}
          update={update}
        />
        <RangeSelector
          label="Age"
          minKey="minAge"
          maxKey="maxAge"
          options={ageOptions}
          filters={filters}
          update={update}
        />
      </div>
    </div>
  );
};

export default PhysicalFilters;
