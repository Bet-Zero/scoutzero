export function getPlayerPositionLabel(fullPosition) {
  const map = {
    Guard: 'G',
    'Point Guard': 'PG',
    'Shooting Guard': 'SG',
    Forward: 'F',
    'Small Forward': 'SF',
    'Power Forward': 'PF',
    Center: 'C',
    'Forward-Center': 'F/C',
    'Guard-Forward': 'G/F',
    'Forward-Guard': 'F',
    'Center-Forward': 'C',
  };
  return map[fullPosition] || fullPosition || '—';
}
