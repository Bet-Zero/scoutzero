import React from 'react';
import { stretchContract } from '../utils/contractUtils';

const RosterManager = ({ teamCapSheet, currentYear, onUpdateRoster, onEditContract }) => {
  const handleWaivePlayer = (player) => {
    const updatedRoster = teamCapSheet.activeContracts.filter(p => p.name !== player.name);
    const dead = { 
      name: `${player.name} (Waived)`, 
      amount: player.salaryByYear[currentYear] 
    };
    const updatedDeadMoney = [...teamCapSheet.deadMoney, dead];
    
    onUpdateRoster({ 
      ...teamCapSheet, 
      activeContracts: updatedRoster, 
      deadMoney: updatedDeadMoney 
    });
  };

  const handleStretchPlayer = (player) => {
    const updatedRoster = teamCapSheet.activeContracts.filter(p => p.name !== player.name);
    const stretched = stretchContract(player, currentYear);
    const deadStretched = Object.entries(stretched).map(([year, amount]) => ({
      name: `${player.name} (Stretched)`,
      year: parseInt(year),
      amount
    }));
    
    const updatedDeadMoney = [...teamCapSheet.deadMoney, ...deadStretched];
    
    onUpdateRoster({ 
      ...teamCapSheet, 
      activeContracts: updatedRoster, 
      deadMoney: updatedDeadMoney 
    });
  };

  return (
    <div className="roster-manager">
      <h2>{teamCapSheet.teamName} Roster</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Years</th>
            <th>Salary</th>
            <th>Contract Type</th>
            <th>Options</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teamCapSheet.activeContracts.map((player) => (
            <tr key={player.name}>
              <td>{player.name}</td>
              <td>{player.years}</td>
              <td>
                {player.salaryByYear[currentYear] ? 
                  `$${player.salaryByYear[currentYear].toLocaleString()}` : '—'}
              </td>
              <td>{player.type}</td>
              <td>
                {player.options?.playerOption && 'PO '}
                {player.options?.teamOption && 'TO '}
              </td>
              <td>
                <button onClick={() => onEditContract(player)}>Edit</button>
                <button onClick={() => handleWaivePlayer(player)}>Waive</button>
                <button onClick={() => handleStretchPlayer(player)}>Stretch</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RosterManager;