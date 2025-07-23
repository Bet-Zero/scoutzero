import React, { useState, useEffect } from 'react';
import { loadTeamCapSheet } from '@/utils/architect/firebaseHelpers';
import { useNavigate } from 'react-router-dom';
import { TeamListFull } from '@/constants/teamList';
import TeamLogo from '@/components/shared/TeamLogo';

const teamsList = TeamListFull;

const LeagueView = () => {
  const [teamSummaries, setTeamSummaries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAllTeams = async () => {
      const summaries = [];
      for (const t of teamsList) {
        const capSheet = await loadTeamCapSheet(t.id);
        if (capSheet) {
          const totalSalary =
            capSheet.players?.reduce((sum, p) => {
              return (
                sum + (p.contract_clean?.salaries_by_year?.[2025]?.salary || 0)
              );
            }, 0) || 0;
          summaries.push({
            id: t.id,
            teamName: t.teamName,
            totalSalary,
            conference: t.conference,
          });
        } else {
          summaries.push({
            id: t.id,
            teamName: t.teamName,
            totalSalary: 0,
            conference: t.conference,
          });
        }
      }
      setTeamSummaries(summaries);
    };
    loadAllTeams();
  }, []);

  const goToTeam = (teamId) => {
    navigate(`/gm/${teamId.toLowerCase()}`);
  };

  const eastTeams = teamSummaries
    .filter((t) => t.conference === 'East')
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
  const westTeams = teamSummaries
    .filter((t) => t.conference === 'West')
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

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
          <tr>
            <th
              colSpan="3"
              className="bg-[#0f0f0f] text-left px-2 py-1 font-semibold"
            >
              Eastern Conference
            </th>
          </tr>
          {eastTeams.map((team) => (
            <tr key={team.id} className="odd:bg-[#171717]">
              <td className="p-2 flex items-center gap-2">
                <TeamLogo teamId={team.id} className="w-6 h-6" />
                {team.teamName}
              </td>
              <td className="p-2">${team.totalSalary.toLocaleString()}</td>
              <td className="p-2 text-right">
                <button
                  onClick={() => goToTeam(team.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                >
                  Manage Team
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <th
              colSpan="3"
              className="bg-[#0f0f0f] text-left px-2 py-1 font-semibold"
            >
              Western Conference
            </th>
          </tr>
          {westTeams.map((team) => (
            <tr key={team.id} className="odd:bg-[#171717]">
              <td className="p-2 flex items-center gap-2">
                <TeamLogo teamId={team.id} className="w-6 h-6" />
                {team.teamName}
              </td>
              <td className="p-2">${team.totalSalary.toLocaleString()}</td>
              <td className="p-2 text-right">
                <button
                  onClick={() => goToTeam(team.id)}
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
