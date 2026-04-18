export const TeamListFull = [
  { id: 'hawks', code: 'ATL', teamId: 'ATL', teamName: 'Atlanta Hawks', nickname: 'Hawks', conference: 'East' },
  { id: 'celtics', code: 'BOS', teamId: 'BOS', teamName: 'Boston Celtics', nickname: 'Celtics', conference: 'East' },
  { id: 'nets', code: 'BKN', teamId: 'BKN', teamName: 'Brooklyn Nets', nickname: 'Nets', conference: 'East' },
  { id: 'hornets', code: 'CHA', teamId: 'CHA', teamName: 'Charlotte Hornets', nickname: 'Hornets', conference: 'East' },
  { id: 'bulls', code: 'CHI', teamId: 'CHI', teamName: 'Chicago Bulls', nickname: 'Bulls', conference: 'East' },
  { id: 'cavaliers', code: 'CLE', teamId: 'CLE', teamName: 'Cleveland Cavaliers', nickname: 'Cavaliers', conference: 'East' },
  { id: 'mavericks', code: 'DAL', teamId: 'DAL', teamName: 'Dallas Mavericks', nickname: 'Mavericks', conference: 'West' },
  { id: 'nuggets', code: 'DEN', teamId: 'DEN', teamName: 'Denver Nuggets', nickname: 'Nuggets', conference: 'West' },
  { id: 'pistons', code: 'DET', teamId: 'DET', teamName: 'Detroit Pistons', nickname: 'Pistons', conference: 'East' },
  { id: 'warriors', code: 'GSW', teamId: 'GSW', teamName: 'Golden State Warriors', nickname: 'Warriors', conference: 'West' },
  { id: 'rockets', code: 'HOU', teamId: 'HOU', teamName: 'Houston Rockets', nickname: 'Rockets', conference: 'West' },
  { id: 'pacers', code: 'IND', teamId: 'IND', teamName: 'Indiana Pacers', nickname: 'Pacers', conference: 'East' },
  { id: 'clippers', code: 'LAC', teamId: 'LAC', teamName: 'Los Angeles Clippers', nickname: 'Clippers', conference: 'West' },
  { id: 'lakers', code: 'LAL', teamId: 'LAL', teamName: 'Los Angeles Lakers', nickname: 'Lakers', conference: 'West' },
  { id: 'grizzlies', code: 'MEM', teamId: 'MEM', teamName: 'Memphis Grizzlies', nickname: 'Grizzlies', conference: 'West' },
  { id: 'heat', code: 'MIA', teamId: 'MIA', teamName: 'Miami Heat', nickname: 'Heat', conference: 'East' },
  { id: 'bucks', code: 'MIL', teamId: 'MIL', teamName: 'Milwaukee Bucks', nickname: 'Bucks', conference: 'East' },
  { id: 'timberwolves', code: 'MIN', teamId: 'MIN', teamName: 'Minnesota Timberwolves', nickname: 'Timberwolves', conference: 'West' },
  { id: 'pelicans', code: 'NOP', teamId: 'NOP', teamName: 'New Orleans Pelicans', nickname: 'Pelicans', conference: 'West' },
  { id: 'knicks', code: 'NYK', teamId: 'NYK', teamName: 'New York Knicks', nickname: 'Knicks', conference: 'East' },
  { id: 'thunder', code: 'OKC', teamId: 'OKC', teamName: 'Oklahoma City Thunder', nickname: 'Thunder', conference: 'West' },
  { id: 'magic', code: 'ORL', teamId: 'ORL', teamName: 'Orlando Magic', nickname: 'Magic', conference: 'East' },
  { id: 'sixers', code: 'PHI', teamId: 'PHI', teamName: 'Philadelphia 76ers', nickname: 'Sixers', conference: 'East' },
  { id: 'suns', code: 'PHX', teamId: 'PHX', teamName: 'Phoenix Suns', nickname: 'Suns', conference: 'West' },
  { id: 'blazers', code: 'POR', teamId: 'POR', teamName: 'Portland Trail Blazers', nickname: 'Blazers', conference: 'West' },
  { id: 'kings', code: 'SAC', teamId: 'SAC', teamName: 'Sacramento Kings', nickname: 'Kings', conference: 'West' },
  { id: 'spurs', code: 'SAS', teamId: 'SAS', teamName: 'San Antonio Spurs', nickname: 'Spurs', conference: 'West' },
  { id: 'raptors', code: 'TOR', teamId: 'TOR', teamName: 'Toronto Raptors', nickname: 'Raptors', conference: 'East' },
  { id: 'jazz', code: 'UTA', teamId: 'UTA', teamName: 'Utah Jazz', nickname: 'Jazz', conference: 'West' },
  { id: 'wizards', code: 'WAS', teamId: 'WAS', teamName: 'Washington Wizards', nickname: 'Wizards', conference: 'East' },
] as const;

export type TeamEntry = (typeof TeamListFull)[number];
export type TeamCode = TeamEntry['code'];
export type TeamSlug = TeamEntry['id'];
export type Conference = TeamEntry['conference'];

export const TeamMap = Object.fromEntries(
  TeamListFull.map((t) => [t.id, t])
) as Record<TeamSlug, TeamEntry>;

export const TeamCodeMap = Object.fromEntries(
  TeamListFull.map((t) => [t.code, t])
) as Record<TeamCode, TeamEntry>;

export const TeamSlugToCode = Object.fromEntries(
  TeamListFull.map((t) => [t.id, t.code])
) as Record<TeamSlug, TeamCode>;
