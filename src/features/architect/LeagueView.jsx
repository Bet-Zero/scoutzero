import React, { useState, useEffect } from 'react';
import { loadTeamCapSheet } from '@/utils/architect/firebaseTeamPlanHelpers';
import { useNavigate } from 'react-router-dom';
import { TeamListFull } from '@/constants/teamList';
import TeamLogo from '@/components/shared/TeamLogo';

// Prefer Architect contract shape (BasePlayerContractZ) but fall back to legacy contract_clean
const getCapHitForSeason = (player, endYear) => {
  if (!player) return 0;

  const contract = player.contract;
  if (contract?.salariesByYear?.length) {
    const seasonKey = `${endYear - 1}-${String(endYear).slice(-2)}`;
    const yearEntry =
      contract.salariesByYear.find((y) => y.season === seasonKey) ||
      contract.salariesByYear.find((y) => String(y.season) === String(endYear));

    if (yearEntry) {
      return (
        yearEntry.capHit ??
        yearEntry.salary ??
        (typeof yearEntry.capHit === 'number' ? yearEntry.capHit : 0)
      );
    }
  }

  // Legacy fallback: contract_clean.salaries_by_year[endYear].salary
  const legacy =
    player.contract_clean?.salaries_by_year?.[endYear]?.salary ||
    player.contract_clean?.salaries_by_year?.[
      `${endYear}-${String((endYear + 1) % 100).padStart(2, '0')}`
    ]?.salary ||
    0;

  return legacy;
};

const teamsList = TeamListFull;

const LeagueView = () => {
  const [teamSummaries, setTeamSummaries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAllTeams = async () => {
      const summaries = [];
      const endYear = 2025; // League view currently keyed to 2024-25 season
      for (const t of teamsList) {
        const capSheet = await loadTeamCapSheet(t.id);
        if (capSheet) {
          const totalSalary =
            capSheet.players?.reduce((sum, p) => {
              return sum + getCapHitForSeason(p, endYear);
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
  const renderTable = (title, teams) => (
    <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
      <thead>
        <tr>
          <th
            colSpan="3"
            className="bg-neutral-800 text-lg text-left px-2 py-1 font-semibold"
          >
            {title}
          </th>
        </tr>
        <tr className="bg-[#111]">
          <th className="p-2 text-left">Team</th>
          <th className="p-2 text-left">Total Salary</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {teams.map((team) => (
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
  );

  return (
    <div className="text-white">
      <h1 className="text-2xl font-bold -mb-6">
        HoopZero Architect – League View
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-12 mb-20">
        {renderTable('Eastern Conference', eastTeams)}
        {renderTable('Western Conference', westTeams)}
      </div>
    </div>
  );
};

export default LeagueView;
