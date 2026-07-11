import React from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import { getTpeExpiryISO } from '@/features/architect/utils/tpeLifecycle';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import {
  getValidationIssueText,
  normalizeValidationIssues,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  SnapshotValidationDetailsLike,
  TeamLike,
  TpeLike,
} from './validationPresentationTypes';

interface TradeExceptionDashboardProps {
  snapshotValidationDetails?: SnapshotValidationDetailsLike | null;
  teams?: TeamLike[];
}

export const TradeExceptionDashboard = ({
  snapshotValidationDetails,
  teams = [],
}: TradeExceptionDashboardProps) => {
  if (!snapshotValidationDetails?.teamResults) return null;

  const tpeData = snapshotValidationDetails.teamResults
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
        team.incomingPlayers.some(
          (player) => player.absorptionMode === 'TPE'
        ) ||
        team.tradeExceptionViolations.length > 0 ||
        team.tradeExceptionWarnings.length > 0
    );

  if (tpeData.length === 0) return null;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Unknown';
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="bg-cockpit-slab border border-cockpit-edge rounded-lg p-4">
      <h3 className="font-medium mb-3">Trade Exception Analysis</h3>

      {tpeData.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <h4 className="font-medium text-sm mb-2 text-cockpit-info">
            {team.teamName}
          </h4>

          {team.createdTPE && (
            <div className="mb-3 p-2 bg-cockpit-safe/20 border border-cockpit-safe/30 rounded">
              <div className="text-xs text-cockpit-safe font-medium mb-1">
                🎯 TPE Created
              </div>
              <div className="text-xs text-cockpit-text-secondary">
                <div>
                  Amount:{' '}
                  <span className="text-cockpit-safe font-mono">
                    {formatCurrency(team.createdTPE.amount)}
                  </span>
                </div>
                <div>
                  Expires:{' '}
                  <span className="text-cockpit-text-secondary">
                    {formatDate(
                      getTpeExpiryISO(
                        team.createdTPE as Record<string, unknown>
                      ) || undefined
                    )}
                  </span>
                </div>
                <div className="text-cockpit-text-muted mt-1">
                  Created from sending {formatCurrency(team.salaryOut)} vs
                  receiving {formatCurrency(team.salaryIn)}
                </div>
              </div>
            </div>
          )}

          {team.existingTPEs.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-cockpit-info font-medium mb-1">
                💼 Existing Trade Exceptions
              </div>
              {team.existingTPEs.map((tpe, tpeIndex: number) => (
                <div key={tpeIndex} className="text-xs text-cockpit-text-secondary mb-1 pl-2">
                  <span className="font-mono">
                    {formatCurrency(tpe.amount || 0)}
                  </span>
                  {(tpe.name || tpe.createdFrom) && (
                    <span className="text-cockpit-text-secondary ml-1">
                      ({tpe.name || tpe.createdFrom})
                    </span>
                  )}
                  <span className="text-cockpit-text-muted ml-2">
                    expires {formatDate(getTpeExpiryISO(tpe))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {team.incomingPlayers.some(
            (player) => player.absorptionMode === 'TPE'
          ) && (
            <div className="mb-3 p-2 bg-cockpit-watch/20 border border-cockpit-watch/30 rounded">
              <div className="text-xs text-cockpit-watch font-medium mb-1">
                🔄 TPE Usage
              </div>
              {team.incomingPlayers
                .filter((player) => player.absorptionMode === 'TPE')
                .map((player, playerIndex) => (
                  <div key={playerIndex} className="text-xs text-cockpit-text-secondary">
                    {player.name} ({formatCurrency(player.salary || 0)}) via TPE
                    #{(player.tpeIndex ?? 0) + 1}
                  </div>
                ))}
            </div>
          )}

          {team.tradeExceptionViolations.length > 0 && (
            <div className="mb-3 p-2 bg-cockpit-danger/20 border border-cockpit-danger/30 rounded">
              <div className="text-xs text-cockpit-danger font-medium mb-1">
                Trade Exception Blockers
              </div>
              {team.tradeExceptionViolations.map(
                (violation, violationIndex) => (
                  <div key={violationIndex} className="text-xs text-cockpit-text-secondary">
                    {getValidationIssueText(violation)}
                  </div>
                )
              )}
            </div>
          )}

          {team.tradeExceptionWarnings.length > 0 && (
            <div className="mb-3 p-2 bg-cockpit-watch/20 border border-cockpit-watch/30 rounded">
              <div className="text-xs text-cockpit-watch font-medium mb-1">
                Trade Exception Warnings
              </div>
              {team.tradeExceptionWarnings.map((warning, warningIndex) => (
                <div key={warningIndex} className="text-xs text-cockpit-text-secondary">
                  {getValidationIssueText(warning)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="mt-3 pt-2 border-t border-cockpit-edge text-xs text-cockpit-text-secondary">
        <p>
          💡 TPEs are created when sending more salary than received (over-cap
          teams only)
        </p>
      </div>
    </div>
  );
};

