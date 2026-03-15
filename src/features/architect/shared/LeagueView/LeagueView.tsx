import React, { useState, useEffect } from 'react';
import { loadTeamCapSheet } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { useNavigate } from 'react-router-dom';
import { TeamListFull } from '@/constants/teamList';
import TeamLogo from '@/shared/components/TeamLogo';
import { getDefaultSeasonEndYear } from '@/features/architect/utils/seasonUtils';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

type TeamSummaryLike = {
  id: string;
  code?: string;
  teamName: string;
  totalSalary: number;
  conference?: string;
};

const teamsList = TeamListFull;

const LeagueView = () => {
  const [teamSummaries, setTeamSummaries] = useState<TeamSummaryLike[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAllTeams = async () => {
      const currentYear = getDefaultSeasonEndYear();

      // Load all teams in parallel for better performance
      const teamPromises = teamsList.map(async (t: any) => {
        try {
          const capSheet = await loadTeamCapSheet(t.code || t.id);
          if (capSheet) {
            // SSOT: Use computeTeamCapTotals for canonical totals
            const capTotals = computeTeamCapTotals(capSheet, currentYear);
            const totalSalary = capTotals.totalCapAllocations;
            return {
              id: t.id,
              code: t.code,
              teamName: t.teamName,
              totalSalary,
              conference: t.conference,
            };
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to load team ${t.code || t.id}:`, error);
        }
        // Fallback for teams that fail to load
        return {
          id: t.id,
          code: t.code,
          teamName: t.teamName,
          totalSalary: 0,
          conference: t.conference,
        };
      });

      const summaries = await Promise.all(teamPromises);
      setTeamSummaries(summaries);
    };
    loadAllTeams();
  }, []);

  const goToTeam = (teamSlug: string) => {
    navigate(`/gm/${teamSlug}`);
  };

  const eastTeams = teamSummaries
    .filter((t) => t.conference === 'East')
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
  const westTeams = teamSummaries
    .filter((t) => t.conference === 'West')
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
  const renderTable = (title: string, teams: TeamSummaryLike[]) => (
    <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
      <thead>
        <tr>
          <th
            colSpan={3}
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
