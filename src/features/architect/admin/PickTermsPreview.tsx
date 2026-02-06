/**
 * FILE: src/features/architect/admin/PickTermsPreview.tsx
 * PURPOSE: Live preview panel for EntitlementEditorModal showing termsShort, row preview, and JSON.
 * OWNERSHIP: Feature: architect/admin (TM-7 Pick Editor UX)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-7 Pick Editor UX.
 */

import React, { useMemo } from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';
import { buildEntitlementDocument } from './entitlementEditorFormState';
import {
  normalizeEntitlementTerms,
  formatEntitlementTermsShort,
} from '../utils/entitlements/entitlementTerms';

interface PickTermsPreviewProps {
  formState: EntitlementFormState;
}

const formatRound = (round: number | string | undefined): string => {
  const r = typeof round === 'string' ? Number(round) : round;
  if (r === 1) return '1st';
  if (r === 2) return '2nd';
  return r ? `R${r}` : '';
};

const getKindBadgeColor = (kind: string): string => {
  switch (kind) {
    case 'pick_ownership':
      return 'bg-blue-600';
    case 'swap_right':
      return 'bg-purple-600';
    case 'conveyance_right':
      return 'bg-amber-600';
    default:
      return 'bg-gray-600';
  }
};

const getKindLabel = (kind: string): string => {
  switch (kind) {
    case 'pick_ownership':
      return 'Ownership';
    case 'swap_right':
      return 'Swap';
    case 'conveyance_right':
      return 'Conveyance';
    default:
      return kind || 'Unknown';
  }
};

export const PickTermsPreview: React.FC<PickTermsPreviewProps> = ({ formState }) => {
  const previewData = useMemo(() => {
    const document = buildEntitlementDocument(formState);
    const terms = normalizeEntitlementTerms(document);
    const termsShort = formatEntitlementTermsShort(terms);

    // Build row preview label
    const year = document.seasonYear as number;
    const round = document.round as number;
    const holderTeam = (document.holderTeam as string) || 'UNK';
    const kind = (document.kind as string) || '';

    const rowLabel = `${year || '????'} ${formatRound(round)}`;

    // Build secondary text (similar to getPickRowSecondaryText)
    const secondaryParts: string[] = [];
    if (termsShort) secondaryParts.push(termsShort);
    if (document.description) {
      const desc = document.description as string;
      if (desc.length <= 50) secondaryParts.push(desc);
    }

    // Terms JSON for preview (just the terms portion, not full document)
    const termsJson = JSON.stringify(
      {
        ...(terms.protectionLadder && { protectionLadder: terms.protectionLadder }),
        ...(terms.swap && { swap: terms.swap }),
        ...(terms.conveyance && { conveyance: terms.conveyance }),
      },
      null,
      2
    );

    return {
      termsShort,
      rowLabel,
      holderTeam,
      kind,
      secondaryText: secondaryParts.length > 0 ? secondaryParts.join(' \u00B7 ') : null,
      termsJson,
      terms,
    };
  }, [formState]);

  return (
    <div className="space-y-4">
      <div className="text-xs text-white/60 uppercase tracking-wide font-semibold">
        Live Preview
      </div>

      {/* termsShort Display */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded p-3">
        <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
          Terms Summary
        </div>
        <div className="text-sm text-white font-mono">
          {previewData.termsShort || (
            <span className="text-white/30 italic">No terms configured</span>
          )}
        </div>
      </div>

      {/* Row Preview */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded p-3">
        <div className="text-[10px] text-white/40 uppercase tracking-wide mb-2">
          Trade Row Preview
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white flex items-center gap-2">
              <span className="font-medium">{previewData.rowLabel}</span>
              {previewData.holderTeam && (
                <span className="text-white/50">({previewData.holderTeam})</span>
              )}
            </div>
            {previewData.secondaryText && (
              <div className="text-xs text-white/50 mt-0.5 truncate">
                {previewData.secondaryText}
              </div>
            )}
          </div>
          {previewData.kind && (
            <span
              className={`px-2 py-0.5 text-[10px] rounded ${getKindBadgeColor(previewData.kind)} text-white`}
            >
              {getKindLabel(previewData.kind)}
            </span>
          )}
        </div>
      </div>

      {/* JSON Preview */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded p-3">
        <div className="text-[10px] text-white/40 uppercase tracking-wide mb-2">
          Terms JSON
        </div>
        <pre className="text-[10px] text-green-300/80 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
          {previewData.termsJson === '{}' ? (
            <span className="text-white/30 italic">No terms</span>
          ) : (
            previewData.termsJson
          )}
        </pre>
      </div>

      {/* Quick Status Indicators */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          active={previewData.terms.hasProtectionLadder}
          label="Protection"
        />
        <StatusBadge active={previewData.terms.hasSwap} label="Swap" />
        <StatusBadge active={previewData.terms.hasConveyance} label="Conveyance" />
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ active: boolean; label: string }> = ({
  active,
  label,
}) => (
  <span
    className={`px-2 py-0.5 text-[10px] rounded ${
      active
        ? 'bg-green-600/30 text-green-300 border border-green-500/30'
        : 'bg-gray-700/30 text-gray-500 border border-gray-600/30'
    }`}
  >
    {label}
  </span>
);
