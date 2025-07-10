import React, { useState, useEffect } from 'react';
import { loadTeamCapSheet } from '../utils/firebaseHelpers';
import { useNavigate } from 'react-router-dom';

const teamsList = [
  "Lakers", "Warriors", "Nuggets", "Suns", "Clippers",
  "Celtics", "Bucks", "Sixers", "Knicks", "Heat",
  "Mavericks", "Grizzlies", "Timberwolves", "Pelicans", "Kings",
  "Hawks", "Raptors", "Bulls", "Cavs", "Pacers",
  "Thunder", "Jazz", "Blazers", "Spurs", "Rockets",
  "Wizards", "Magic", "Pistons", "Hornets", "Nets"
];

const LeagueView = () => {
  const [teamSummaries, setTeamSummaries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAllTeams = async () => {
      const summaries = [];
      for (const name of teamsList) {
        const data = await loadTeamCapSheet(name.toLowerCase());
        if (data) {
          const totalSalary = data.activeContracts?.reduce((sum, p) => {
            return sum + (p.salaryByYear?.[2025] || 0);
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
    <div className="league-view">
      <h1>HoopZero Architect – League View</h1>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Total Salary</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {teamSummaries.map(team => (
            <tr key={team.teamName}>
              <td>{team.teamName}</td>
              <td>${team.totalSalary.toLocaleString()}</td>
              <td>
                <button onClick={() => goToTeam(team.teamName)}>
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