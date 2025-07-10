import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const FreeAgencyTab = ({ teamCapSheet, setTeamCapSheet, currentYear }) => {
  const [freeAgents, setFreeAgents] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchFreeAgents = async () => {
      const res = await fetch('/data/freeAgents.json');
      const data = await res.json();
      setFreeAgents(data);
    };
    fetchFreeAgents();
  }, []);

  const handleSignPlayer = (player) => {
    const salary = player.expectedSalary || 2200000;
    const years = 1;
    
    const newContract = {
      id: uuidv4(),
      name: player.name,
      salaryByYear: { [currentYear]: salary },
      startYear: currentYear,
      length: years,
      position: player.position,
      isMinimum: salary <= 2200000,
      yearsOfService: player.yearsPro || 0,
      guaranteed: true
    };

    const updatedCapSheet = {
      ...teamCapSheet,
      activeContracts: [...teamCapSheet.activeContracts, newContract],
      freeAgentsSigned: [...(teamCapSheet.freeAgentsSigned || []), player.name]
    };

    setTeamCapSheet(updatedCapSheet);
  };

  const filteredFAs = freeAgents.filter((p) => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="free-agency-tab">
      <h2>Free Agent Pool</h2>
      <input
        type="text"
        placeholder="Search player name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: '12px', padding: '6px' }}
      />
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Pos</th>
            <th>Age</th>
            <th>Expected $</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredFAs.map((player, idx) => (
            <tr key={idx}>
              <td>{player.name}</td>
              <td>{player.position}</td>
              <td>{player.age}</td>
              <td>${(player.expectedSalary || 2200000).toLocaleString()}</td>
              <td>
                <button onClick={() => handleSignPlayer(player)}>
                  Sign to Team
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FreeAgencyTab;