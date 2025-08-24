import { POSITION_MAP } from '../roles/positionMap.js';

const calculateHeight = (ht = '0-0') => {
  const parts = ht.split('-');
  return parseInt(parts[0]) * 12 + parseInt(parts[1]);
};

export function normalizePlayerData(playerData) {
  const rawPosition = playerData.bio?.Position;
  const formattedPosition = POSITION_MAP[rawPosition] || rawPosition || '—';

  const salaryMap = {};
  (playerData.contract?.annual_salaries || []).forEach((s) => {
    let raw = s.salary;
    if (typeof raw === 'string') {
      raw = raw.replace(/[\$,]/g, '');
      if (raw.includes('M')) {
        raw = raw.replace('M', '');
        salaryMap[s.year] = parseFloat(raw);
      } else {
        salaryMap[s.year] = parseFloat(raw) / 1_000_000;
      }
    } else if (typeof raw === 'number') {
      salaryMap[s.year] = raw / 1_000_000;
    } else {
      salaryMap[s.year] = null;
    }
    if (isNaN(salaryMap[s.year])) salaryMap[s.year] = null;
  });

  return {
    ...playerData,
    formattedPosition,
    heightInInches: calculateHeight(playerData.bio?.HT),
    weight: parseInt(playerData.bio?.WT || 0),
    age: parseInt(playerData.bio?.AGE || 0),
    headshotUrl: `/assets/headshots/${playerData.player_id}.png`,
    offenseRole: playerData.roles?.offense1 || '—',
    defenseRole: playerData.roles?.defense1 || '—',
    shootingProfile: playerData.shootingProfile || '—',
    subRoles: {
      offense: playerData.subRoles?.offense || [],
      defense: playerData.subRoles?.defense || [],
    },
    traits: playerData.traits || {},
    badges: playerData.badges || [],
    salaryByYear: salaryMap,
    PPG: playerData.system?.stats?.PTS ?? null,
    RPG: playerData.system?.stats?.TRB ?? null,
    APG: playerData.system?.stats?.AST ?? null,
    ...playerData.system?.stats,
  };
}
