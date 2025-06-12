import React from 'react';

const teamLogoMap = {
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
  Sixers: 'sixers', // ✅ full name version
  '76ers': 'sixers', // ✅ alternate version with number
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

const TeamLogo = ({ teamAbbr, className = '' }) => {
  const fileName = teamLogoMap[teamAbbr] || 'default';
  const logoPath = `/assets/logos/${fileName}.png`;

  return (
    <div className={`relative w-[3.5rem] h-[3.5rem] ${className}`}>
      <img
        src={logoPath}
        alt={`${teamAbbr} logo`}
        className="w-full h-full object-contain"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '/assets/logos/default.png';
        }}
      />
    </div>
  );
};

export default TeamLogo;
