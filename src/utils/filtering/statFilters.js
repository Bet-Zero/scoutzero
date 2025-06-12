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
