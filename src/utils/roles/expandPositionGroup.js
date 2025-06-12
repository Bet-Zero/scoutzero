export function expandPositionGroup(position) {
  switch (position) {
    case 'group_guard':
    case 'Guard':
      return ['PG', 'SG', 'G'];
    case 'group_wing':
      return ['SG', 'SF', 'G/F'];
    case 'group_forward':
      return ['SF', 'PF', 'F'];
    case 'group_big':
    case 'Big':
      return ['F/C', 'C'];
    case 'Wing':
      return ['G/F', 'F'];
    case 'Forward':
      return ['F', 'F/C'];
    case 'Center':
      return ['C'];
    default:
      return position ? [position] : [];
  }
}
