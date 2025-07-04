export const TEAM_LOGO_MAP = {
  Hawks: 'hawks',
  Celtics: 'celtics',
  Nets: 'nets',
  Hornets: 'hornets',
  Bulls: 'bulls',
  Cavaliers: 'cavaliers',
  Mavericks: 'mavericks',
  Nuggets: 'nuggets',
  Pistons: 'pistons',
  Warriors: 'warriors',
  Rockets: 'rockets',
  Pacers: 'pacers',
  Clippers: 'clippers',
  Lakers: 'lakers',
  Grizzlies: 'grizzlies',
  Heat: 'heat',
  Bucks: 'bucks',
  Timberwolves: 'timberwolves',
  Pelicans: 'pelicans',
  Knicks: 'knicks',
  Thunder: 'thunder',
  Magic: 'magic',
  Sixers: 'sixers',
  '76ers': 'sixers',
  Suns: 'suns',
  BTrailBlazers: 'blazers',
  'Trail Blazers': 'blazers',
  Blazers: 'blazers',
  Kings: 'kings',
  Spurs: 'spurs',
  Raptors: 'raptors',
  Jazz: 'jazz',
  Wizards: 'wizards',
};

export function getTeamLogoFilename(teamName) {
  if (!teamName) return 'default';
  return TEAM_LOGO_MAP[teamName] || teamName.toLowerCase().replace(/\s+/g, '');
}
