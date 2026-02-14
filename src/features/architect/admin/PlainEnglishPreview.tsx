/**
 * FILE: src/features/architect/admin/PlainEnglishPreview.tsx
 * PURPOSE: Plain-English + termsShort + validity indicator preview for Pick Right Wizard.
 * OWNERSHIP: Feature: architect/admin (TM-8 Pick Editor UX)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *
 * Provides a human-readable sentence describing the pick right being created,
 * the machine-generated termsShort line, and a valid/invalid indicator.
 */

import React, { useMemo } from 'react';
import type {
  EntitlementFormState,
  ProtectionLadderTierForm,
} from './entitlementEditorFormState';
import { buildEntitlementDocument } from './entitlementEditorFormState';
import {
  normalizeEntitlementTerms,
  formatEntitlementTermsShort,
} from '../utils/entitlements/entitlementTerms';
import type { FieldErrors } from './useEntitlementEditorState';

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatRound = (round: number | string | undefined): string => {
  const r = typeof round === 'string' ? Number(round) : round;
  if (r === 1) return '1st Round';
  if (r === 2) return '2nd Round';
  return r ? `Round ${r}` : '';
};

const formatCondition = (condition: string): string => {
  if (!condition) return 'Unprotected';
  return `${condition} protected`;
};

const formatTrigger = (tier: ProtectionLadderTierForm): string => {
  if (tier.ifTriggered === 'convert') {
    const rd =
      tier.convertToRound === '2' ? '2nd round pick' : '1st round pick';
    return `converts to ${rd}`;
  }
  if (tier.ifTriggered === 'cancel') {
    return 'unprotected (pick conveys)';
  }
  if (tier.rollToYear) {
    return `rolls to ${tier.rollToYear}`;
  }
  return 'rolls forward';
};

/**
 * Build a plain English description from the form state.
 */
function buildPlainEnglish(formState: EntitlementFormState): string {
  const year = formState.seasonYear || '????';
  const round = formatRound(formState.round);
  const team = formState.holderTeam || 'UNK';
  const kind = formState.kind;

  if (kind === 'pick_ownership') {
    const header = `${year} ${round} pick from ${team}`;

    if (formState.protectionLadder.length === 0) {
      return `${header}: Unprotected — conveys regardless of position.`;
    }

    const tierDescriptions = formState.protectionLadder.map((tier, idx) => {
      const tierYear = tier.year || year;
      const condition = formatCondition(tier.condition);
      const trigger = formatTrigger(tier);
      const isFirst = idx === 0;
      if (isFirst) {
        return `${condition} in ${tierYear}`;
      }
      return `→ ${condition} in ${tierYear} (${trigger})`;
    });

    // Last tier outcome
    const lastTier =
      formState.protectionLadder[formState.protectionLadder.length - 1];
    const lastOutcome = formatTrigger(lastTier);

    // If only one tier, describe it inline
    if (formState.protectionLadder.length === 1) {
      return `${header}: ${tierDescriptions[0]} — if triggered, ${lastOutcome}.`;
    }

    return `${header}: ${tierDescriptions.join(' ')} — ${lastOutcome}.`;
  }

  if (kind === 'swap_right') {
    const direction = formState.swapType === 'worst_of' ? 'worst' : 'best';
    const controller = formState.swapControllerPickId || '(no pick selected)';
    return `Swap right (${direction} of): ${team} controls — controller pick: ${controller} in ${year} ${round}.`;
  }

  if (kind === 'conveyance_right') {
    const poolIds = formState.poolUnderlyingPickIdsText
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean);
    const comparator =
      formState.receivesComparator === 'more_favorable'
        ? 'most favorable'
        : formState.receivesComparator === 'less_favorable'
          ? 'least favorable'
          : formState.receivesComparator === 'middle'
            ? 'middle'
            : '(no method selected)';
    const poolDisplay =
      poolIds.length > 0 ? poolIds.join(', ') : '(no picks in pool)';
    return `Pool right for ${team} ${year} ${round}: receives ${comparator} from pool [${poolDisplay}].`;
  }

  return 'Select a pick right type to see a preview.';
}

// ─── component ───────────────────────────────────────────────────────────────

interface PlainEnglishPreviewProps {
  formState: EntitlementFormState;
  fieldErrors: FieldErrors;
}

export const PlainEnglishPreview: React.FC<PlainEnglishPreviewProps> = ({
  formState,
  fieldErrors,
}) => {
  const { plainEnglish, termsShort, isValid, errorCount } = useMemo(() => {
    const document = buildEntitlementDocument(formState);
    const terms = normalizeEntitlementTerms(document);
    const short = formatEntitlementTermsShort(terms);
    const errors = Object.keys(fieldErrors).length;

    return {
      plainEnglish: buildPlainEnglish(formState),
      termsShort: short,
      isValid: errors === 0,
      errorCount: errors,
    };
  }, [formState, fieldErrors]);

  return (
    <div className="space-y-3" data-testid="plain-english-preview">
      {/* Validity indicator */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
          isValid
            ? 'bg-green-900/20 border border-green-700/40 text-green-300'
            : 'bg-red-900/20 border border-red-700/40 text-red-300'
        }`}
        data-testid="validity-indicator"
      >
        {isValid ? (
          <>
            <span className="text-green-400">✅</span>
            <span>Valid — ready to apply</span>
          </>
        ) : (
          <>
            <span className="text-red-400">❌</span>
            <span>
              Fix {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>

      {/* Plain English */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded p-4">
        <div className="text-[10px] text-white/40 uppercase tracking-wide mb-2 font-semibold">
          Plain English
        </div>
        <div
          className="text-sm text-white leading-relaxed"
          data-testid="plain-english-text"
        >
          {plainEnglish}
        </div>
      </div>

      {/* termsShort */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded p-3">
        <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
          Terms Summary
        </div>
        <div
          className="text-sm text-white font-mono"
          data-testid="terms-short-text"
        >
          {termsShort || (
            <span className="text-white/30 italic">No terms configured</span>
          )}
        </div>
      </div>
    </div>
  );
};
