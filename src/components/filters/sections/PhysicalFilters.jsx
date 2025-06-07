import React from 'react';

const PhysicalFilters = ({ filters, setFilters }) => {
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const generateHeightOptions = () => {
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

  const generateWeightOptions = () => {
    const options = [];
    for (let weight = 150; weight <= 350; weight += 10) {
      options.push({ value: weight, label: `${weight} lbs` });
    }
    return options;
  };

  const generateAgeOptions = () => {
    const options = [];
    for (let age = 18; age <= 45; age++) {
      options.push({ value: age, label: `${age}` });
    }
    return options;
  };

  const heightOptions = generateHeightOptions();
  const weightOptions = generateWeightOptions();
  const ageOptions = generateAgeOptions();

  return (
    <div className="space-y-4">
      <h2 className="text-white text-sm font-bold">Physical Attributes</h2>
      <div className="grid grid-cols-3 gap-4 text-white text-sm">
        {/* Height Range */}
        <div className="flex flex-col">
          <label className="text-white mb-1 text-[11px] tracking-wide uppercase">
            Height
          </label>
          <div className="flex items-center gap-2">
            <select
              value={filters.minHeight || ''}
              onChange={(e) =>
                update(
                  'minHeight',
                  e.target.value ? parseInt(e.target.value, 10) : 0
                )
              }
              className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
                !filters.minHeight ? 'text-white/40' : 'text-white'
              }`}
            >
              <option value="" disabled hidden>
                Min
              </option>
              {heightOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-white/50 text-xs">to</span>
            <select
              value={
                filters.maxHeight !== null && filters.maxHeight !== undefined
                  ? filters.maxHeight
                  : ''
              }
              onChange={(e) =>
                update(
                  'maxHeight',
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
              className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
                filters.maxHeight === null ? 'text-white/40' : 'text-white'
              }`}
            >
              <option value="" disabled hidden>
                Max
              </option>
              {heightOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weight Range */}
        <div className="flex flex-col">
          <label className="text-white mb-1 text-[11px] tracking-wide uppercase">
            Weight
          </label>
          <div className="flex items-center gap-2">
            <select
              value={filters.minWeight || ''}
              onChange={(e) =>
                update(
                  'minWeight',
                  e.target.value ? parseInt(e.target.value, 10) : 0
                )
              }
              className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
                !filters.minWeight ? 'text-white/40' : 'text-white'
              }`}
            >
              <option value="" disabled hidden>
                Min
              </option>
              {weightOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-white/50 text-xs">to</span>
            <select
              value={filters.maxWeight || ''}
              onChange={(e) =>
                update(
                  'maxWeight',
                  e.target.value ? parseInt(e.target.value, 10) : ''
                )
              }
              className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
                !filters.maxWeight ? 'text-white/40' : 'text-white'
              }`}
            >
              <option value="" disabled hidden>
                Max
              </option>
              {weightOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Age Range */}
        <div className="flex flex-col">
          <label className="text-white mb-1 text-[11px] tracking-wide uppercase">
            Age
          </label>
          <div className="flex items-center gap-2">
            <select
              value={filters.minAge || ''}
              onChange={(e) =>
                update(
                  'minAge',
                  e.target.value ? parseInt(e.target.value, 10) : 0
                )
              }
              className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
                !filters.minAge ? 'text-white/40' : 'text-white'
              }`}
            >
              <option value="" disabled hidden>
                Min
              </option>
              {ageOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-white/50 text-xs">to</span>
            <select
              value={filters.maxAge || ''}
              onChange={(e) =>
                update(
                  'maxAge',
                  e.target.value ? parseInt(e.target.value, 10) : ''
                )
              }
              className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
                !filters.maxAge ? 'text-white/40' : 'text-white'
              }`}
            >
              <option value="" disabled hidden>
                Max
              </option>
              {ageOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicalFilters;
