const shootingProfileRank = {
  Elite: 6,
  Plus: 5,
  Capable: 4,
  Willing: 3,
  Hesitant: 2,
  Non: 1,
};

const traitSort = [
  'Defense',
  'Energy',
  'Feel',
  'IQ',
  'Passing',
  'Playmaking',
  'Rebounding',
  'Shooting',
];

export default function sortPlayers(players, filters) {
  return [...players].sort((a, b) => {
    const getValue = (player, field) => {
      if (traitSort.includes(field)) return player.traits?.[field] ?? -1;
      if (player.system?.stats?.hasOwnProperty(field))
        return parseFloat(player.system.stats[field]) ?? -1;
      switch (field) {
        case 'name':
          return (player.display_name || player.name || '').toLowerCase();
        case 'height':
          return player.heightInInches;
        case 'weight':
          return player.weight;
        case 'age':
          return player.age;
        case 'salary':
          return player.salaryByYear?.[filters.salaryYear] ?? -1;
        case 'shootingProfile':
          return shootingProfileRank[player.shootingProfile] ?? 0;
        case 'yearsRemaining':
          return parseInt(player.free_agency_year) - 2024 || -1;
        case 'totalContract':
          return Array.isArray(player.contract?.annual_salaries)
            ? player.contract.annual_salaries.reduce((sum, s) => {
                const val =
                  typeof s.salary === 'number'
                    ? s.salary
                    : parseFloat((s.salary || '').replace(/[^0-9.]/g, ''));
                return isNaN(val) ? sum : sum + val;
              }, 0)
            : -1;
        case 'overall':
          return parseFloat(player.overall) ?? -1;
        default:
          return -1;
      }
    };

    const valA = getValue(a, filters.sortBy);
    const valB = getValue(b, filters.sortBy);

    if (typeof valA === 'string' && typeof valB === 'string') {
      return filters.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return filters.sortAsc ? valA - valB : valB - valA;
  });
}
