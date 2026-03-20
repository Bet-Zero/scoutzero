import React from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import { getTpeExpiryISO } from '@/features/architect/utils/tpeLifecycle';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import {
  getValidationIssueText,
  normalizeValidationIssues,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';
import type {
  TeamLike,
  TpeLike,
  ValidationResultLike,
} from './validationPresentationTypes';

interface TradeExceptionDashboardProps {
  result?: ValidationResultLike | null;
  teams?: TeamLike[];
}

const TradeExceptionDashboard = ({
  result,
  teams = [],
}: TradeExceptionDashboardProps) => {
  if (!result?.teamResults) return null;

  const tpeData = result.teamResults
    .map((team, index) => {
      const teamData = teams[index];
      const tradeExceptionRule = team.rules?.tradeExceptions;
      const tradeExceptionViolations = normalizeValidationIssues(
        tradeExceptionRule?.violations
      );
      const tradeExceptionWarnings = normalizeValidationIssues(
        tradeExceptionRule?.warnings
      );

      return {
        teamName: team.teamName,
        createdTPE: team.createdTPE,
        existingTPEs: getTeamTpeList(teamData?.team),
        incomingPlayers: team.incomingPlayers || [],
        outgoingPlayers: team.outgoingPlayers || [],
        salaryIn: team.salaryIn || 0,
        salaryOut: team.salaryOut || 0,
        tradeExceptionViolations,
        tradeExceptionWarnings,
      };
    })
    .filter(
      (team) =>
        team.createdTPE ||
        team.existingTPEs.length > 0 ||
        team.incomingPlayers.some((player) => player.absorptionMode === 'TPE') ||
        team.tradeExceptionViolations.length > 0 ||
        team.tradeExceptionWarnings.length > 0
    );

  if (tpeData.length === 0) return null;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Unknown';
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4">
      <h3 className="font-medium mb-3">Trade Exception Analysis</h3>

      {tpeData.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <h4 className="font-medium text-sm mb-2 text-blue-400">
            {team.teamName}
          </h4>

          {team.createdTPE && (
            <div className="mb-3 p-2 bg-green-900/20 border border-green-500/30 rounded">
              <div className="text-xs text-green-400 font-medium mb-1">
                🎯 TPE Created
              </div>
              <div className="text-xs text-white/80">
                <div>
                  Amount:{' '}
                  <span className="text-green-400 font-mono">
                    {formatCurrency(team.createdTPE.amount)}
                  </span>
                </div>
                <div>
                  Expires:{' '}
                  <span className="text-white/60">
                    {formatDate(
                      getTpeExpiryISO(
                        team.createdTPE as Record<string, unknown>
                      ) || undefined
                    )}
                  </span>
                </div>
                <div className="text-white/50 mt-1">
                  Created from sending {formatCurrency(team.salaryOut)} vs
                  receiving {formatCurrency(team.salaryIn)}
                </div>
              </div>
            </div>
          )}

          {team.existingTPEs.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-blue-400 font-medium mb-1">
                💼 Existing Trade Exceptions
              </div>
              {team.existingTPEs.map((tpe: any, tpeIndex: number) => (
                <div key={tpeIndex} className="text-xs text-white/80 mb-1 pl-2">
                  <span className="font-mono">
                    {formatCurrency(tpe.amount || 0)}
                  </span>
                  {(tpe.name || tpe.createdFrom) && (
                    <span className="text-white/60 ml-1">
                      ({tpe.name || tpe.createdFrom})
                    </span>
                  )}
                  <span className="text-white/50 ml-2">
                    expires {formatDate(getTpeExpiryISO(tpe))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {team.incomingPlayers.some((player) => player.absorptionMode === 'TPE') && (
            <div className="mb-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
              <div className="text-xs text-yellow-400 font-medium mb-1">
                🔄 TPE Usage
              </div>
              {team.incomingPlayers
                .filter((player) => player.absorptionMode === 'TPE')
                .map((player, playerIndex) => (
                  <div key={playerIndex} className="text-xs text-white/80">
                    {player.name} ({formatCurrency(player.salary || 0)}) via TPE
                    #{(player.tpeIndex ?? 0) + 1}
                  </div>
                ))}
            </div>
          )}

          {team.tradeExceptionViolations.length > 0 && (
            <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded">
              <div className="text-xs text-red-300 font-medium mb-1">
                Trade Exception Blockers
              </div>
              {team.tradeExceptionViolations.map((violation, violationIndex) => (
                <div key={violationIndex} className="text-xs text-white/80">
                  {getValidationIssueText(violation)}
                </div>
              ))}
            </div>
          )}

          {team.tradeExceptionWarnings.length > 0 && (
            <div className="mb-3 p-2 bg-amber-900/20 border border-amber-500/30 rounded">
              <div className="text-xs text-amber-300 font-medium mb-1">
                Trade Exception Warnings
              </div>
              {team.tradeExceptionWarnings.map((warning, warningIndex) => (
                <div key={warningIndex} className="text-xs text-white/80">
                  {getValidationIssueText(warning)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="mt-3 pt-2 border-t border-white/10 text-xs text-white/60">
        <p>
          💡 TPEs are created when sending more salary than received (over-cap
          teams only)
        </p>
      </div>
    </div>
  );
};

export default TradeExceptionDashboard;
