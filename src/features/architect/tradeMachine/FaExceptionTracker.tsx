import React from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import {
  getValidationIssueText,
  normalizeValidationIssues,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  SnapshotValidationDetailsLike,
  TeamLike,
} from './validationPresentationTypes';

interface FaExceptionTrackerProps {
  snapshotValidationDetails?: SnapshotValidationDetailsLike | null;
  teams?: TeamLike[];
}

export const FaExceptionTracker = ({
  snapshotValidationDetails,
  teams = [],
}: FaExceptionTrackerProps) => {
  if (!snapshotValidationDetails?.teamResults) return null;

  const faExceptionData = snapshotValidationDetails.teamResults
    .map((team, index) => {
      const teamData = teams[index];
      const faExceptionRule = team.rules?.faExceptionUsage;
      const faExceptionViolations = normalizeValidationIssues(
        faExceptionRule?.violations
      );
      const faExceptionWarnings = normalizeValidationIssues(
        faExceptionRule?.warnings
      );
      const faUsage = (team.incomingPlayers || []).filter(
        (player) => player.absorptionMode === 'FA_EXCEPTION'
      );

      return {
        teamName: team.teamName,
        buckets: team.faExceptionBuckets || teamData?.team?.faExceptionBuckets || [],
        faUsage,
        faExceptionViolations,
        faExceptionWarnings,
        teamTotalSalary: team.totalSalary || 0,
        projectedSalary: team.projectedSalary || 0,
        hardCapped: Boolean(team.hardCapped),
        apronStatus: team.apronStatus || '',
      };
    })
    .filter(
      (team) =>
        team.buckets.length > 0 ||
        team.faUsage.length > 0 ||
        team.faExceptionViolations.length > 0 ||
        team.faExceptionWarnings.length > 0
    );

  if (faExceptionData.length === 0) return null;

  const getApronClass = (apronStatus: string) => {
    if (apronStatus.includes('2nd Apron')) return 'text-red-400 bg-red-900/20';
    if (apronStatus.includes('1st Apron')) {
      return 'text-yellow-400 bg-yellow-900/20';
    }
    return 'text-green-400 bg-green-900/20';
  };

  const firstApron = Number(snapshotValidationDetails?.capSettings?.firstApron || 0);

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4">
      <h3 className="font-medium mb-3">Free Agent Exception Tracker</h3>

      {faExceptionData.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm text-blue-400">{team.teamName}</h4>
            {team.apronStatus && (
              <span
                className={`text-xs px-2 py-1 rounded ${getApronClass(team.apronStatus)}`}
              >
                {team.apronStatus}
              </span>
            )}
          </div>

          {team.buckets.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-green-400 font-medium mb-1">
                💰 Available Buckets
              </div>
              <div className="grid grid-cols-3 gap-2">
                {team.buckets.map((bucket, bucketIndex) => (
                  <div
                    key={bucketIndex}
                    className="p-2 bg-[#1a1a1a] border border-white/10 rounded text-xs"
                  >
                    <div className="font-medium text-white/90">{bucket.type}</div>
                    <div className="font-mono text-green-400">
                      {formatCurrency(bucket.remaining ?? bucket.amount ?? 0)}
                    </div>
                    <div className="text-white/50 text-xs">
                      {bucket.label || bucket.name || 'FA Exception'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {team.faUsage.length > 0 && (
            <div className="mb-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
              <div className="text-xs text-blue-400 font-medium mb-1">
                🎯 Exception Usage
              </div>
              {team.faUsage.map((player, playerIndex) => (
                <div
                  key={playerIndex}
                  className="text-xs text-white/80 flex justify-between"
                >
                  <span>{player.name}</span>
                  <span className="font-mono">
                    {formatCurrency(player.matchIncoming ?? player.salary ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {team.faExceptionViolations.length > 0 && (
            <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded">
              <div className="text-xs text-red-300 font-medium mb-1">
                FA Exception Blockers
              </div>
              {team.faExceptionViolations.map((violation, violationIndex) => (
                <div key={violationIndex} className="text-xs text-white/80">
                  {getValidationIssueText(violation)}
                </div>
              ))}
            </div>
          )}

          {team.faExceptionWarnings.length > 0 && (
            <div className="mb-3 p-2 bg-amber-900/20 border border-amber-500/30 rounded">
              <div className="text-xs text-amber-300 font-medium mb-1">
                FA Exception Warnings
              </div>
              {team.faExceptionWarnings.map((warning, warningIndex) => (
                <div key={warningIndex} className="text-xs text-white/80">
                  {getValidationIssueText(warning)}
                </div>
              ))}
            </div>
          )}

          {team.hardCapped && (
            <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-xs">
              <span className="text-red-400 font-medium">⚠️ Hard Capped</span>
              <div className="text-white/80 mt-1">
                Team is hard-capped at First Apron ({formatCurrency(firstApron)})
                {' '}due to FA exception usage
              </div>
            </div>
          )}

          {firstApron > 0 &&
            team.projectedSalary > firstApron * 0.925 &&
            !team.apronStatus.includes('Apron') && (
              <div className="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-xs">
                <span className="text-yellow-400 font-medium">
                  ⚠️ Apron Warning
                </span>
                <div className="text-white/80 mt-1">
                  Projected salary: {formatCurrency(team.projectedSalary)} -
                  approaching First Apron
                </div>
              </div>
            )}
        </div>
      ))}

      <div className="mt-3 pt-2 border-t border-white/10 text-xs text-white/60">
        <p>
          💡 FA Exceptions unavailable to teams above First Apron • Usage
          triggers hard cap
        </p>
      </div>
    </div>
  );
};

