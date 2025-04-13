import React, { useState, useEffect } from 'react';
import PlayerHeadshot from './components/PlayerHeadshot';
import PlayerName from './components/PlayerName';
import TeamLogo from './components/TeamLogo';
import PlayerPosition from './components/PlayerPosition';
import playersData from './data/players.json';

const getTraitColor = (rating) => {
  if (rating >= 98) return '#13895b';
  if (rating >= 94) return '#369972';
  if (rating >= 91) return '#55b48f';
  if (rating >= 86) return '#6cbd9d';
  if (rating >= 80) return '#8bc8b0';
  if (rating >= 73) return '#bce6df';
  if (rating >= 66) return '#d9efe6';
  if (rating >= 56) return '#efd9d9';
  if (rating >= 46) return '#e6bcbc';
  if (rating >= 41) return '#c88b8b';
  if (rating >= 36) return '#bd6c6c';
  if (rating >= 26) return '#b45555';
  if (rating >= 16) return '#993636';
  return '#891313';
};

const formatStat = (stat, isInteger = false) =>
  isInteger ? parseInt(stat) : parseFloat(stat).toFixed(1);

const defaultRatings = {
  Shooting: 0,
  Passing: 0,
  Playmaking: 0,
  Rebounding: 0,
  Defense: 0,
  IQ: 0,
  Feel: 0,
  Energy: 0
};

const defaultRoles = {
  offense1: '',
  offense2: '',
  defense1: '',
  defense2: '',
  twoWay: 50
};

const LayoutPreview = () => {
  const [selectedPlayer, setSelectedPlayer] = useState('lebron_james');
  const [player, setPlayer] = useState(playersData['lebron_james']);
  const [ratings, setRatings] = useState(defaultRatings);
  const [roles, setRoles] = useState(defaultRoles);

  const offensiveRoles = [
    'Primary Playmaker', 'Primary Ball Handler', 'Secondary Creator', 'Scorer', 'Shooter', 'Floor Spacer',
    'Off-Ball Scorer', 'Off-Ball Mover', 'Connector', 'Versatile Big', 'Post Hub', 'Post Scorer',
    'Stretch Big', 'Play Finisher'
  ];

  const defensiveRoles = [
    'Point-of-Attack Defender', 'Chaser', 'Wing Stopper', 'Off-Ball Helper', 'Defensive Playmaker',
    'Defensive Quarterback', 'Switchable Wing', 'Switchable Big', 'Mobile Big', 'Post Defender', 'Anchor Big'
  ];

  useEffect(() => {
    const newPlayer = playersData[selectedPlayer];
    setPlayer(newPlayer);

    const savedRatings = localStorage.getItem(`scoutzero_${selectedPlayer}_ratings`);
    const savedRoles = localStorage.getItem(`scoutzero_${selectedPlayer}_roles`);
    setRatings(savedRatings ? JSON.parse(savedRatings) : defaultRatings);
    setRoles(savedRoles ? JSON.parse(savedRoles) : defaultRoles);
  }, [selectedPlayer]);

  useEffect(() => {
    localStorage.setItem(`scoutzero_${selectedPlayer}_ratings`, JSON.stringify(ratings));
  }, [ratings, selectedPlayer]);

  useEffect(() => {
    localStorage.setItem(`scoutzero_${selectedPlayer}_roles`, JSON.stringify(roles));
  }, [roles, selectedPlayer]);

  const handleRoleChange = (e, key) => setRoles({ ...roles, [key]: e.target.value });

  const handleRatingClick = (e, trait) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.round((clickX / rect.width) * 100);
    setRatings({ ...ratings, [trait]: percentage });
  };

  const handleTwoWayClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.round((clickX / rect.width) * 100);
    setRoles({ ...roles, twoWay: percentage });
  };

  const exportPlayerData = () => {
    const data = {
      id: selectedPlayer,
      name: player.name,
      headshot: player.headshot,
      team: player.team,
      position: player.position,
      bio: player.bio,
      stats: player.stats,
      ratings,
      roles
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedPlayer}.json`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center gap-6 py-20 relative">
      <div className="absolute top-6 left-6">
        <label className="text-white text-sm block mb-1">Select Player</label>
        <select
          className="bg-neutral-800 text-white px-4 py-1 rounded-lg text-sm border border-white shadow"
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
        >
          {Object.entries(playersData).map(([key, p]) => (
            <option key={key} value={key}>{p.name}</option>
          ))}
        </select>
      </div>

      <button
        className="absolute top-6 right-6 bg-blue-600 text-white px-4 py-2 rounded-md text-sm shadow"
        onClick={exportPlayerData}
      >
        Export Player
      </button>

      <div className="h-[220px] w-[750px] flex items-center gap-4">
        <div className="flex items-start gap-[4.5rem] w-[500px]">
          <div className="flex flex-col items-start relative -top-2 left-2 justify-center">
            <PlayerName name={player.name} />
            <div className="flex items-center gap-4 mt-[1.5rem] relative top-[1.15rem]">
              <TeamLogo teamLogo={player.teamLogo} />
              <div className="h-[2.5rem] w-[2px] bg-black" />
              <PlayerPosition position={player.position} />
            </div>
          </div>
          <PlayerHeadshot playerId={player.id} name={player.name} />
        </div>
        <div className="w-[230px] h-[190px] bg-[#1f1f1f] rounded-2xl shadow-lg text-white text-[13px] font-thin px-4 py-3 flex flex-col relative top-[0.11rem] justify-center">
          <div className="space-y-[2px]">
            <p><span className="font-bold">HT</span>: {player.bio?.HT}</p>
            <p><span className="font-bold">WT</span>: {player.bio?.WT}</p>
            <p><span className="font-bold">AGE</span>: {player.bio?.Age}</p>
            <p><span className="font-bold">YEARS PRO</span>: {player.bio?.['Years Pro']}</p>
          </div>
          <div className="h-6" />
          <div className="space-y-[2px]">
            <p><span className="font-bold">TEAM</span>: {player.team}</p>
            <p><span className="font-bold">CONTRACT</span>: {player.bio?.Contract}</p>
            <p><span className="font-bold">FREE AGENT</span>: {player.bio?.['Free Agent']}</p>
          </div>
        </div>
      </div>

      <div className="w-[750px] bg-[#1f1f1f] rounded-2xl shadow-lg px-6 pt-[0.5rem] pb-[0.75rem] text-white text-sm font-medium">
        <div className="flex justify-between items-center mb-[0.5rem] font-bold">
          <div className="w-[60px] font-bold whitespace-nowrap"></div>
          <div className="h-4 w-[1px] bg-neutral-700" />
          <div className="w-[50px] text-center">G</div>
          <div className="w-[50px] text-center">PTS</div>
          <div className="w-[50px] text-center">REB</div>
          <div className="w-[50px] text-center">AST</div>
          <div className="h-4 w-[1px] bg-neutral-700" />
          <div className="w-[50px] text-center">FG%</div>
          <div className="w-[50px] text-center">3PT%</div>
          <div className="w-[50px] text-center">FT%</div>
          <div className="w-[50px] text-center">eFG%</div>
        </div>
        <div className="h-[1px] bg-neutral-700 mb-[0.5rem]" />
        <div className="flex justify-between items-center font-light">
          <div className="w-[60px] font-normal whitespace-nowrap">2024-25</div>
          <div className="h-4 w-[1px] bg-neutral-700" />
          <div className="w-[50px] text-center">{formatStat(player.stats?.G, true)}</div>
          <div className="w-[50px] text-center">{formatStat(player.stats?.PPG)}</div>
          <div className="w-[50px] text-center">{formatStat(player.stats?.RPG)}</div>
          <div className="w-[50px] text-center">{formatStat(player.stats?.APG)}</div>
          <div className="h-4 w-[1px] bg-neutral-700" />
          <div className="w-[50px] text-center">{formatStat(player.stats?.['FG%'])}</div>
          <div className="w-[50px] text-center">{formatStat(player.stats?.['3PT%'])}</div>
          <div className="w-[50px] text-center">{formatStat(player.stats?.['FT%'])}</div>
          <div className="w-[50px] text-center">{formatStat(player.stats?.['EFG%'])}</div>
        </div>
      </div>

      <div className="flex gap-[1.25rem]">
        <div className="bg-[#1f1f1f] rounded-2xl shadow-lg px-4 py-4 text-white text-sm font-medium flex flex-col gap-4 justify-center" style={{ width: '270px', height: '460px' }}>
          {Object.entries(ratings).map(([trait, value]) => (
            <div key={trait} className="flex items-center justify-between text-sm font-bold px-4 h-10 rounded-full cursor-pointer text-black"
              style={{ backgroundColor: getTraitColor(value) }}
              onClick={(e) => handleRatingClick(e, trait)}>
              <span>{trait}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <div className="bg-[#1f1f1f] rounded-2xl shadow-lg px-4 py-4 text-white text-sm font-medium flex flex-col justify-between" style={{ width: '500px', height: '460px' }}>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-4">
              <div className="w-1/2 flex flex-col items-center">
                <div className="text-lg font-bold mb-2 text-center underline">Offense</div>
                <select className="bg-neutral-800 text-white px-3 py-2 rounded-full w-full mb-2 border border-black" value={roles.offense1} onChange={(e) => handleRoleChange(e, 'offense1')}>
                  <option value="">Select Offensive Role 1</option>
                  {offensiveRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
                <select className="bg-neutral-800 text-white px-3 py-2 rounded-full w-full border border-black" value={roles.offense2} onChange={(e) => handleRoleChange(e, 'offense2')}>
                  <option value="">Select Offensive Role 2</option>
                  {offensiveRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="w-1/2 flex flex-col items-center">
                <div className="text-lg font-bold mb-2 text-center underline">Defense</div>
                <select className="bg-neutral-800 text-white px-3 py-2 rounded-full w-full mb-2 border border-black" value={roles.defense1} onChange={(e) => handleRoleChange(e, 'defense1')}>
                  <option value="">Select Defensive Role 1</option>
                  {defensiveRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
                <select className="bg-neutral-800 text-white px-3 py-2 rounded-full w-full border border-black" value={roles.defense2} onChange={(e) => handleRoleChange(e, 'defense2')}>
                  <option value="">Select Defensive Role 2</option>
                  {defensiveRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-center items-center text-neutral-500 text-xs italic mt-2">Sub-Roles will appear here once finalized.</div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {Array(6).fill('').map((_, i) => (
                <div key={i} className="bg-neutral-800 text-white px-3 py-1 rounded-full text-xs text-center h-6" />
              ))}
            </div>
          </div>
          <div className="mt-6">
            <div className="text-center text-base font-bold mb-4">Two-Way Meter</div>
            <div className="relative w-full h-4 rounded-full cursor-pointer" style={{ background: 'linear-gradient(to right, #3b82f6, white, #9333ea)' }} onClick={handleTwoWayClick}>
              <div className="absolute top-[-6px] w-[6px] h-[28px] bg-white rounded-sm" style={{ left: `${roles.twoWay}%`, transform: 'translateX(-50%)' }} />
            </div>
            <div className="flex justify-between text-xs text-white font-medium mt-1">
              <span>Defense</span>
              <span>Offense</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutPreview;
