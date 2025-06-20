export function getPlayersForTeam(playersData, team) {
  if (!team) return [];
  return Object.keys(playersData)
    .filter((key) => playersData[key]?.bio?.Team === team)
    .sort((a, b) => {
      const aName = playersData[a]?.display_name || playersData[a]?.name || '';
      const bName = playersData[b]?.display_name || playersData[b]?.name || '';
      return aName
        .split(' ')
        .slice(-1)[0]
        .localeCompare(bName.split(' ').slice(-1)[0]);
    });
}

export function getModalTitle(key) {
  if (!key) return 'Breakdown';
  if (key.startsWith('trait_')) return `Trait Breakdown: ${key.slice(6)}`;
  if (key.startsWith('role_')) return `Role Breakdown: ${key.slice(5)}`;
  if (key.startsWith('subrole_')) return `Sub-Role Breakdown: ${key.slice(8)}`;
  if (key === 'shooting_profile') return 'Shooting Profile Breakdown';
  if (key === 'two_way_meter') return 'Two-Way Meter Breakdown';
  return 'Breakdown';
}

export function getBlurbValue(blurbs, key) {
  if (!key) return '';
  if (key.startsWith('trait_')) return blurbs.traits?.[key.slice(6)] || '';
  if (key.startsWith('role_')) return blurbs.roles?.[key.slice(5)] || '';
  if (key.startsWith('subrole_')) return blurbs.subroles?.[key.slice(8)] || '';
  if (key === 'shooting_profile') return blurbs.shootingProfile || '';
  if (key === 'two_way_meter') return blurbs.twoWayMeter || '';
  if (key === 'overall') return blurbs.overall || '';
  return '';
}

export function getVideoExamples(key) {
  const examples = {
    trait_Shooting: ['https://www.youtube.com/embed/sampleVideo1'],
  };
  return examples[key] || [];
}
