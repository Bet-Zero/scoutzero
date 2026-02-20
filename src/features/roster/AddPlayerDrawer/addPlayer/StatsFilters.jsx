import React from 'react';

const STAT_DEFS = [
  { label: 'PPG',  opKey: 'PPG_op',  minKey: 'min_PPG',  maxKey: 'max_PPG',  step: 0.5 },
  { label: 'RPG',  opKey: 'RPG_op',  minKey: 'min_RPG',  maxKey: 'max_RPG',  step: 0.5 },
  { label: 'APG',  opKey: 'APG_op',  minKey: 'min_APG',  maxKey: 'max_APG',  step: 0.5 },
  { label: 'MPG',  opKey: 'MIN_op',  minKey: 'min_MIN',  maxKey: 'max_MIN',  step: 1   },
  { label: 'GP',   opKey: 'G_op',    minKey: 'min_G',    maxKey: 'max_G',    step: 1   },
  { label: 'FG%',  opKey: 'FGP_op',  minKey: 'min_FGP',  maxKey: 'max_FGP',  step: 1   },
  { label: '3PT%', opKey: 'TPP_op',  minKey: 'min_TPP',  maxKey: 'max_TPP',  step: 1   },
  { label: 'FT%',  opKey: 'FTP_op',  minKey: 'min_FTP',  maxKey: 'max_FTP',  step: 1   },
  { label: 'eFG%', opKey: 'eFGP_op', minKey: 'min_eFGP', maxKey: 'max_eFGP', step: 1   },
];

const inputCls = 'flex-1 min-w-0 bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs';

const StatRow = ({ def, filters, setFilters }) => {
  const { label, opKey, minKey, maxKey, step } = def;
  const op = filters[opKey] || '';

  const handleOpChange = (newOp) => {
    setFilters({
      ...filters,
      [opKey]: newOp,
      // Clear the value that doesn't apply to the new operator
      [minKey]: newOp === 'lt' ? undefined : filters[minKey],
      [maxKey]: newOp === 'gt' ? undefined : filters[maxKey],
    });
  };

  const setMin = (raw) =>
    setFilters({ ...filters, [minKey]: raw === '' ? undefined : parseFloat(raw) });
  const setMax = (raw) =>
    setFilters({ ...filters, [maxKey]: raw === '' ? undefined : parseFloat(raw) });

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-white/60 text-xs font-medium w-10 flex-shrink-0">{label}</span>

      <select
        value={op}
        onChange={(e) => handleOpChange(e.target.value)}
        className="bg-[#2a2a2a] text-white text-xs px-1.5 py-1 rounded flex-shrink-0 w-[76px]"
      >
        <option value="">Any</option>
        <option value="gt">≥ at least</option>
        <option value="lt">≤ at most</option>
        <option value="btwn">between</option>
      </select>

      {(op === 'gt' || op === 'btwn') && (
        <input
          type="number"
          min={0}
          step={step}
          placeholder={op === 'btwn' ? 'from' : '0'}
          value={filters[minKey] ?? ''}
          onChange={(e) => setMin(e.target.value)}
          className={inputCls}
        />
      )}

      {op === 'btwn' && (
        <span className="text-white/30 text-xs flex-shrink-0">–</span>
      )}

      {(op === 'lt' || op === 'btwn') && (
        <input
          type="number"
          min={0}
          step={step}
          placeholder={op === 'btwn' ? 'to' : '0'}
          value={filters[maxKey] ?? ''}
          onChange={(e) => setMax(e.target.value)}
          className={inputCls}
        />
      )}
    </div>
  );
};

const StatsFilters = ({ filters, setFilters }) => (
  <div className="p-2 space-y-2">
    {STAT_DEFS.map((def) => (
      <StatRow key={def.opKey} def={def} filters={filters} setFilters={setFilters} />
    ))}
  </div>
);

export default StatsFilters;
