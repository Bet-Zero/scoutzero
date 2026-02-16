// src/features/architect/tradeMachine/FaExceptionTracker.jsx
import React from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';

const FaExceptionTracker = ({ result, teams }) => {
  if (!result?.teamResults) return null;

  // Extract FA Exception information
  const faExceptionData = result.teamResults.map((team, index) => {
    const teamData = teams[index];
    const faExceptions = teamData?.team?.faExceptions || {};
    
    // Get available buckets
    const buckets = [];
    if (faExceptions.mle) buckets.push({ type: 'MLE', amount: faExceptions.mle, name: 'Mid-Level Exception' });
    if (faExceptions.bae) buckets.push({ type: 'BAE', amount: faExceptions.bae, name: 'Bi-Annual Exception' });
    if (faExceptions.minimum) buckets.push({ type: 'MIN', amount: faExceptions.minimum, name: 'Minimum Exception' });

    // Check for FA exception usage in incoming players
    const faUsage = (team.incomingPlayers || []).filter(p => p.absorptionMode === 'FA_EXCEPTION');
    
    return {
      teamName: team.teamName,
      buckets,
      faUsage,
      teamTotalSalary: team.totalSalary || 0,
      projectedSalary: team.projectedSalary || 0,
      hardCapped: Boolean(team.hardCapped),
      apronStatus: team.apronStatus || '',
    };
  }).filter(team => team.buckets.length > 0 || team.faUsage.length > 0);

  if (faExceptionData.length === 0) return null;

  const getApronClass = (apronStatus) => {
    if (apronStatus.includes('2nd Apron')) return 'text-red-400 bg-red-900/20';
    if (apronStatus.includes('1st Apron')) return 'text-yellow-400 bg-yellow-900/20';
    return 'text-green-400 bg-green-900/20';
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4">
      <h3 className="font-medium mb-3">Free Agent Exception Tracker</h3>
      
      {faExceptionData.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm text-blue-400">{team.teamName}</h4>
            {team.apronStatus && (
              <span className={`text-xs px-2 py-1 rounded ${getApronClass(team.apronStatus)}`}>
                {team.apronStatus}
              </span>
            )}
          </div>

          {/* Available Buckets */}
          {team.buckets.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-green-400 font-medium mb-1">💰 Available Buckets</div>
              <div className="grid grid-cols-3 gap-2">
                {team.buckets.map((bucket, bIndex) => (
                  <div key={bIndex} className="p-2 bg-[#1a1a1a] border border-white/10 rounded text-xs">
                    <div className="font-medium text-white/90">{bucket.type}</div>
                    <div className="font-mono text-green-400">{formatCurrency(bucket.amount)}</div>
                    <div className="text-white/50 text-xs">{bucket.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FA Exception Usage */}
          {team.faUsage.length > 0 && (
            <div className="mb-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
              <div className="text-xs text-blue-400 font-medium mb-1">🎯 Exception Usage</div>
              {team.faUsage.map((player, pIndex) => (
                <div key={pIndex} className="text-xs text-white/80 flex justify-between">
                  <span>{player.name}</span>
                  <span className="font-mono">{formatCurrency(player.salary || 0)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hard Cap Warning */}
          {team.hardCapped && (
            <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-xs">
              <span className="text-red-400 font-medium">⚠️ Hard Capped</span>
              <div className="text-white/80 mt-1">
                Team is hard-capped at First Apron ({formatCurrency(result?.capSettings?.firstApron)}) due to FA exception usage
              </div>
            </div>
          )}

          {/* Apron proximity warning */}
          {result?.capSettings?.firstApron && team.projectedSalary > result.capSettings.firstApron * 0.925 && !team.apronStatus.includes('Apron') && (
            <div className="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-xs">
              <span className="text-yellow-400 font-medium">⚠️ Apron Warning</span>
              <div className="text-white/80 mt-1">
                Projected salary: {formatCurrency(team.projectedSalary)} - approaching First Apron
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="mt-3 pt-2 border-t border-white/10 text-xs text-white/60">
        <p>💡 FA Exceptions unavailable to teams above First Apron • Usage triggers hard cap</p>
      </div>
    </div>
  );
};

export default FaExceptionTracker;