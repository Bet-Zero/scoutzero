// src/features/architect/tradeMachine/TradeExceptionDashboard.jsx
import React from 'react';
import { formatCurrency } from '@/utils/architect/tradeHelpers';

const TradeExceptionDashboard = ({ result, teams }) => {
  if (!result?.teamResults) return null;

  // Extract TPE information from validation results
  const tpeData = result.teamResults.map((team, index) => {
    const teamData = teams[index];
    return {
      teamName: team.teamName,
      createdTPE: team.createdTPE,
      existingTPEs: teamData?.team?.tradeExceptions || [],
      incomingPlayers: team.incomingPlayers || [],
      outgoingPlayers: team.outgoingPlayers || [],
      salaryIn: team.salaryIn || 0,
      salaryOut: team.salaryOut || 0,
    };
  }).filter(team => team.createdTPE || team.existingTPEs.length > 0);

  if (tpeData.length === 0) return null;

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown';
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4">
      <h3 className="font-medium mb-3">Trade Exception Analysis</h3>
      
      {tpeData.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <h4 className="font-medium text-sm mb-2 text-blue-400">{team.teamName}</h4>
          
          {/* TPE Creation */}
          {team.createdTPE && (
            <div className="mb-3 p-2 bg-green-900/20 border border-green-500/30 rounded">
              <div className="text-xs text-green-400 font-medium mb-1">🎯 TPE Created</div>
              <div className="text-xs text-white/80">
                <div>Amount: <span className="text-green-400 font-mono">{formatCurrency(team.createdTPE.amount)}</span></div>
                <div>Expires: <span className="text-white/60">{formatDate(team.createdTPE.expiryISO)}</span></div>
                <div className="text-white/50 mt-1">
                  Created from sending {formatCurrency(team.salaryOut)} vs receiving {formatCurrency(team.salaryIn)}
                </div>
              </div>
            </div>
          )}

          {/* Existing TPEs */}
          {team.existingTPEs.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-blue-400 font-medium mb-1">💼 Existing Trade Exceptions</div>
              {team.existingTPEs.map((tpe, tpeIndex) => (
                <div key={tpeIndex} className="text-xs text-white/80 mb-1 pl-2">
                  <span className="font-mono">{formatCurrency(tpe.amount || 0)}</span>
                  <span className="text-white/50 ml-2">expires {formatDate(tpe.expiryISO || tpe.expiryDate)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Players absorbed via TPE */}
          {team.incomingPlayers.some(p => p.absorptionMode === 'TPE') && (
            <div className="mb-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
              <div className="text-xs text-yellow-400 font-medium mb-1">🔄 TPE Usage</div>
              {team.incomingPlayers
                .filter(p => p.absorptionMode === 'TPE')
                .map((player, pIndex) => (
                  <div key={pIndex} className="text-xs text-white/80">
                    {player.name} ({formatCurrency(player.salary || 0)}) via TPE #{player.tpeIndex + 1}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      <div className="mt-3 pt-2 border-t border-white/10 text-xs text-white/60">
        <p>💡 TPEs are created when sending more salary than received (over-cap teams only)</p>
      </div>
    </div>
  );
};

export default TradeExceptionDashboard;