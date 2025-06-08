import React from 'react';
import RangeFilter from './RangeFilter';
import {
  generateHeightOptions,
  generateWeightOptions,
  generateAgeOptions,
} from '@/utils/physicalOptions';

const PhysicalFilters = ({ filters, setFilters }) => {
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const heightOptions = generateHeightOptions();
  const weightOptions = generateWeightOptions();
  const ageOptions = generateAgeOptions();

  return (
    <div className="space-y-4">
      <h2 className="text-white text-sm font-bold">Physical Attributes</h2>
      <div className="grid grid-cols-3 gap-4 text-white text-sm">
        <RangeFilter
          label="Height"
          minKey="minHeight"
          maxKey="maxHeight"
          allowNullMax
          options={heightOptions}
          filters={filters}
          update={update}
        />
        <RangeFilter
          label="Weight"
          minKey="minWeight"
          maxKey="maxWeight"
          options={weightOptions}
          filters={filters}
          update={update}
        />
        <RangeFilter
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
