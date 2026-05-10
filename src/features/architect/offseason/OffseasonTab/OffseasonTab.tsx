/**
 * FILE: src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx
 * PURPOSE: Single-team offseason workflow UI wiring for OSTE execution.
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-02-03: Updated to surface OSTE validation errors (plan `plans/_archive/offseason-transition-engine-phase1/plan.md`, chunk_n/a)
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93 execution.
 *
 * LINKS:
 *  - Plan: plans/_archive/offseason-transition-engine-phase1/plan.md
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */

import React, { useState } from 'react';
import { OptionManager } from './OptionManager';
import { runOffseason } from '@/features/architect/utils/runOffseason';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import type { CapProjectionOverrides } from '@/features/architect/utils/capRulesProfile';
import type {
  OffseasonOptionDecisionMap,
  OffseasonSummary,
  OffseasonTabProps,
} from './types';
import { NON_AUTHORITATIVE_OFFSEASON_PREVIEW_AUTHORITY } from './types';

type PreviewAftermath = {
  projectedSeasonCode: string;
  previewSummary: PreviewSummary;
};

type PreviewSummary = NonNullable<OffseasonSummary>;

const EMPTY_PREVIEW_SUMMARY: PreviewSummary = {
  exercisedOptions: [],
  declinedOptions: [],
  expiredContracts: [],
  expiredTPEs: [],
  capHoldsCreated: 0,
  transitionedExceptions: [],
  hardCapCleared: false,
};

const PREVIEW_PERSISTENCE_ACTION_COPY =
  'Use World Season Advance to persist real changes.';

type SummarySectionProps = {
  title: string;
  items: string[];
};

function SummarySection({ title, items }: SummarySectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h5 className="font-medium text-white">{title}</h5>
      <ul className="mt-1 list-disc pl-5 text-sm text-white/70">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export const OffseasonTab = ({
  teamCapSheet,
  currentYear,
  previewAuthority,
  capProjections = null,
  playersMap = {},
}: OffseasonTabProps) => {
  const hasExplicitNonAuthoritativePreviewAuthority =
    previewAuthority === NON_AUTHORITATIVE_OFFSEASON_PREVIEW_AUTHORITY;
  const [optionsConfirmed, setOptionsConfirmed] = useState(false);
  const [optionDecisions, setOptionDecisions] =
    useState<OffseasonOptionDecisionMap | null>(null);
  const [previewAftermath, setPreviewAftermath] =
    useState<PreviewAftermath | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!hasExplicitNonAuthoritativePreviewAuthority) {
    return (
      <div
        data-testid="offseason-preview-authority-required"
        className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
      >
        Offseason preview requires the explicit non-authoritative DEV preview
        authority.
      </div>
    );
  }

  const handleDecisionsReady = (decisions: OffseasonOptionDecisionMap) => {
    setOptionDecisions(decisions);
    setOptionsConfirmed(true);
    setPreviewAftermath(null);
    setError('');
  };

  const resetPreviewAftermath = () => {
    setPreviewAftermath(null);
    setError('');
  };

  const handleEditDecisions = () => {
    resetPreviewAftermath();
    setOptionsConfirmed(false);
  };

  const handleAdvanceYear = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { summary } = runOffseason(
        teamCapSheet,
        currentYear,
        capProjections as CapProjectionOverrides | null | undefined,
        optionDecisions || {}
      );
      const projectedSeasonYear = currentYear + 1;

      setPreviewAftermath({
        projectedSeasonCode: toSeasonCode(projectedSeasonYear),
        previewSummary: summary ?? EMPTY_PREVIEW_SUMMARY,
      });
    } catch (err: unknown) {
      console.error('Failed to advance offseason', err);
      setError(err instanceof Error ? err.message : 'Failed to advance offseason');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">Offseason Manager</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {isLoading && <p className="text-sm mb-2">Processing...</p>}

      {!optionsConfirmed && !previewAftermath && (
        <OptionManager
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onDecisionsReady={handleDecisionsReady}
          playersMap={playersMap}
        />
      )}

      {optionsConfirmed && !previewAftermath && (
        <div className="mt-5">
          <h4 className="font-semibold mb-2">
            All option decisions confirmed.
          </h4>
          <p className="mb-3 text-sm text-white/60">
            This preview stays local to this DEV surface. It will not update the
            world, dashboard year, or shared offseason summary.
          </p>
          <button
            type="button"
            onClick={handleAdvanceYear}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Preview Advance to {currentYear + 1}
          </button>
        </div>
      )}

      {previewAftermath &&
        (() => {
          const previewSummary = previewAftermath.previewSummary;

          return (
            <div
              data-testid="offseason-preview-aftermath"
              className="mt-5 rounded border border-yellow-500/40 bg-yellow-900/10 p-4"
            >
              <strong>Preview computed — not saved</strong>
              <p
                data-testid="offseason-preview-aftermath-copy"
                className="mt-2 text-sm text-yellow-100"
              >
                Preview shows projected state for the{' '}
                {previewAftermath.projectedSeasonCode} season only.{' '}
                {'No world state,'}{' '}
                {'dashboard year, or shared offseason summary was updated.'}{' '}
                {PREVIEW_PERSISTENCE_ACTION_COPY}
              </p>

              <div className="mt-4 space-y-3">
                <SummarySection
                  title="Projected Exercised Options"
                  items={previewSummary.exercisedOptions.map(
                    (option) => option.playerName
                  )}
                />
                <SummarySection
                  title="Projected Declined Options"
                  items={previewSummary.declinedOptions.map(
                    (option) => option.playerName
                  )}
                />
                <SummarySection
                  title="Projected Expired Contracts"
                  items={previewSummary.expiredContracts.map(
                    (contract) => contract.playerName
                  )}
                />
                <SummarySection
                  title="Projected Expired Trade Exceptions"
                  items={previewSummary.expiredTPEs.map((tpe) => {
                    const amount = Number(tpe.amount || 0).toLocaleString();
                    return `$${amount} from ${tpe.source || 'Trade Exception'}`;
                  })}
                />
                <SummarySection
                  title="Projected Exception Transitions"
                  items={previewSummary.transitionedExceptions}
                />
                {previewSummary.capHoldsCreated > 0 && (
                  <p className="text-sm text-white/70">
                    Projected cap holds created:{' '}
                    {previewSummary.capHoldsCreated}
                  </p>
                )}
                {previewSummary.hardCapCleared && (
                  <p className="text-sm text-white/70">
                    Hard cap would be cleared in this projected season.
                  </p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={resetPreviewAftermath}
                  className="rounded bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
                >
                  Reset Preview
                </button>
                <button
                  type="button"
                  onClick={handleEditDecisions}
                  className="rounded bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
                >
                  Edit Decisions
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

