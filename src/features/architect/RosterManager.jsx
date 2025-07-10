import React from 'react';
import { stretchContract } from '../utils/contractUtils';

const RosterManager = ({
  teamCapSheet,
  currentYear,
  onUpdateRoster,
  onEditContract,
  playersMap = {},
}) => {
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
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">{teamCapSheet.teamName} Roster</h2>
      <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
        <thead className="bg-[#111]">
          <tr>
            <th className="p-2 text-left">Player</th>
            <th className="p-2 text-left">Years</th>
            <th className="p-2 text-left">Salary</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-left">Options</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {teamCapSheet.activeContracts.map((player) => {
            const details = playersMap[player.name] || {};
            return (
              <tr key={player.name} className="odd:bg-[#171717]">
                <td className="p-2">{details.display_name || player.name}</td>
                <td className="p-2">{player.years}</td>
                <td className="p-2">
                  {player.salaryByYear[currentYear]
                    ? `$${player.salaryByYear[currentYear].toLocaleString()}`
                    : '—'}
                </td>
                <td className="p-2">{player.type}</td>
                <td className="p-2">
                  {player.options?.playerOption && 'PO '}
                  {player.options?.teamOption && 'TO '}
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onEditContract(player)}
                    className="text-xs text-blue-400 hover:underline mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleWaivePlayer(player)}
                    className="text-xs text-red-500 hover:underline mr-2"
                  >
                    Waive
                  </button>
                  <button
                    onClick={() => handleStretchPlayer(player)}
                    className="text-xs text-yellow-500 hover:underline"
                  >
                    Stretch
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RosterManager;