import React, { useState, useEffect } from 'react';
import { loadTeamCapSheet } from '@/utils/architect/firebaseHelpers';
import { useNavigate } from 'react-router-dom';

const teamsList = [
  'Lakers',
  'Warriors',
  'Nuggets',
  'Suns',
  'Clippers',
  'Celtics',
  'Bucks',
  'Sixers',
  'Knicks',
  'Heat',
  'Mavericks',
  'Grizzlies',
  'Timberwolves',
  'Pelicans',
  'Kings',
  'Hawks',
  'Raptors',
  'Bulls',
  'Cavs',
  'Pacers',
  'Thunder',
  'Jazz',
  'Blazers',
  'Spurs',
  'Rockets',
  'Wizards',
  'Magic',
  'Pistons',
  'Hornets',
  'Nets',
];

const LeagueView = () => {
  const [teamSummaries, setTeamSummaries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAllTeams = async () => {
      const summaries = [];
      for (const name of teamsList) {
        const capSheet = await loadTeamCapSheet(name.toLowerCase());
        if (capSheet) {
          const totalSalary =
            capSheet.players?.reduce((sum, p) => {
              return sum +
                (p.contract_clean?.salaries_by_year?.[2025]?.salary || 0);
            }, 0) || 0;
          summaries.push({ teamName: name, totalSalary });
        } else {
          summaries.push({ teamName: name, totalSalary: 0 });
        }
      }
      setTeamSummaries(summaries);
    };
    loadAllTeams();
  }, []);

  const goToTeam = (teamId) => {
    navigate(`/gm/${teamId.toLowerCase()}`);
  };

  return (
    <div className="text-white">
      <h1 className="text-2xl font-bold mb-4">
        HoopZero Architect – League View
      </h1>
      <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
        <thead className="bg-[#111]">
          <tr>
            <th className="p-2 text-left">Team</th>
            <th className="p-2 text-left">Total Salary</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {teamSummaries.map((team) => (
            <tr key={team.teamName} className="odd:bg-[#171717]">
              <td className="p-2">{team.teamName}</td>
              <td className="p-2">${team.totalSalary.toLocaleString()}</td>
              <td className="p-2 text-right">
                <button
                  onClick={() => goToTeam(team.teamName)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                >
                  Manage Team
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeagueView;
