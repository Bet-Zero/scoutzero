/**
 * FILE: src/features/architect/cockpit/teamPlanTrustPanelModel.ts
 * PURPOSE: Display-only view models for the Architect Team Plan trust panel.
 * OWNERSHIP: Feature: architect/cockpit
 */
import {
  getArchitectTeamPlanUnsafeContextExitWarnings,
  type ArchitectTeamPlanSaveState,
} from '@/features/architect/GMDashboard/hooks/teamPlanSaveState';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import type {
  ArchitectPostActionImpactArea,
  ArchitectPostActionImpactDelta,
  ArchitectPostActionImpactDeltaUnit,
  ArchitectPostActionImpactSection,
  ArchitectPostActionReceipt,
} from '@/features/architect/GMDashboard/postActionHandoff/types';
import type { HardCapCockpitStatus } from './TeamStatusStrip';

export type TrustPanelTone = 'safe' | 'info' | 'watch' | 'danger' | 'muted';

export interface TeamPlanTruthPanel {
  tone: TrustPanelTone;
  statusLabel: string;
  modeLabel: string;
  detail: string;
  switchSafetyLabel: string;
  lastSavedLabel: string | null;
  warnings: string[];
}

export interface CapPosturePanel {
  tone: TrustPanelTone;
  statusLabel: string;
  detail: string;
  /**
   * The single number that drives the verdict (e.g. 2nd-apron space when above
   * the 2nd apron). Signed: negative = over the binding threshold. The panel
   * renders this as the hero figure; `null` while cap posture is unavailable.
   */
  headlineAmount: number | null;
  /** Plain-language caption under the hero number, e.g. "over the 2nd apron". */
  headlineCaption: string | null;
  rosterLabel: string;
  hardCapLabel: string | null;
  hardCapDetail: string | null;
}

export interface ReceiptImpactRow {
  id: ArchitectPostActionImpactArea;
  label: string;
  tone: TrustPanelTone;
  statusLabel: string;
  summary: string;
  deltas: string[];
}

export interface ReceiptImpactPanel {
  status: 'empty' | 'available';
  emptyMessage: string | null;
  rows: ReceiptImpactRow[];
}

const SAVE_STATUS_LABELS: Record<ArchitectTeamPlanSaveState['status'], string> =
  {
    loading: 'Checking save status',
    saved: 'All changes saved',
    saving: 'Saving changes',
    'save-failed': 'Save failed',
    'uncommitted-draft': 'Unsaved work',
    'local-only': 'What-if session (not saved)',
  };

const IMPACT_ORDER: ArchitectPostActionImpactArea[] = [
  'cap',
  'roster',
  'exceptions',
  'rights',
  'deadMoney',
  'contract',
];

const IMPACT_LABELS: Record<ArchitectPostActionImpactArea, string> = {
  cap: 'Cap',
  roster: 'Roster',
  exceptions: 'Exceptions',
  rights: 'Rights',
  deadMoney: 'Dead money',
  contract: 'Contract',
};

export const formatTrustPanelMoney = (amount: number): string => {
  if (!Number.isFinite(amount)) return '-';
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`;
};

const formatDate = (iso: string): string | null => {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso.slice(0, 10) || null;
  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const saveTone = (saveState: ArchitectTeamPlanSaveState): TrustPanelTone => {
  if (saveState.hasSaveError) return 'danger';
  if (saveState.isSaving || saveState.hasUncommittedDraft) return 'watch';
  if (saveState.status === 'loading') return 'info';
  if (saveState.isSaved) return 'safe';
  if (saveState.isLocalOnly) return 'watch';
  return 'muted';
};

export function deriveTeamPlanTruthPanel(
  saveState: ArchitectTeamPlanSaveState
): TeamPlanTruthPanel {
  const warnings = getArchitectTeamPlanUnsafeContextExitWarnings(
    saveState,
    'switch-world'
  );

  return {
    tone: saveTone(saveState),
    statusLabel: SAVE_STATUS_LABELS[saveState.status],
    modeLabel: saveState.isDurableWorldMode
      ? 'Saved plan'
      : 'What-if session',
    detail: saveState.detail,
    switchSafetyLabel:
      warnings.length > 0
        ? 'You will be warned before switching'
        : 'Safe to switch plans or seasons',
    lastSavedLabel: saveState.lastSavedAt
      ? formatDate(saveState.lastSavedAt)
      : null,
    warnings,
  };
}

export function isHardCapActiveForViewingSeason(
  workspace: ArchitectWorkspaceContext,
  hardCapStatus?: HardCapCockpitStatus
): boolean {
  const onCurrentSeason =
    workspace.seasons.viewingSeasonDiffersFromWorldSeason === false ||
    workspace.seasons.authoritativeWorldSeasonStatus !== 'available';
  return onCurrentSeason && Boolean(hardCapStatus?.isHardCapped);
}

export function deriveCapPosturePanel(
  workspace: ArchitectWorkspaceContext,
  hardCapStatus?: HardCapCockpitStatus
): CapPosturePanel {
  const cap = workspace.cap;
  if (cap.status !== 'available') {
    return {
      tone: 'muted',
      statusLabel: 'Cap status unavailable',
      detail:
        cap.status === 'unavailable'
          ? cap.reason
          : 'Cap status is still loading.',
      rosterLabel:
        workspace.roster.status === 'available'
          ? `${workspace.roster.count} players`
          : 'Roster count unavailable',
      headlineAmount: null,
      headlineCaption: null,
      hardCapLabel: null,
      hardCapDetail: null,
    };
  }

  const hardCapActive = isHardCapActiveForViewingSeason(
    workspace,
    hardCapStatus
  );
  let tone: TrustPanelTone = 'safe';
  let statusLabel = 'Below cap pressure';
  // Default headline (safe team): the cap room it has left.
  let headlineAmount = cap.capSpace;
  let headlineCaption = 'cap space';

  if (hardCapActive) {
    tone = 'danger';
    statusLabel = hardCapStatus?.hardCapCeilingLabel
      ? `Hard capped at ${hardCapStatus.hardCapCeilingLabel}`
      : 'Hard capped';
    headlineAmount =
      hardCapStatus?.hardCapCeilingType === 'FIRST_APRON'
        ? cap.firstApronSpace
        : cap.secondApronSpace;
    headlineCaption = headlineAmount < 0 ? 'over the hard cap' : 'under hard cap';
  } else if (cap.isAboveSecondApron) {
    tone = 'danger';
    statusLabel = 'Above 2nd apron';
    headlineAmount = cap.secondApronSpace;
    headlineCaption = 'over the 2nd apron';
  } else if (cap.isAtOrAboveFirstApron) {
    tone = 'danger';
    statusLabel = 'At or above 1st apron';
    headlineAmount = cap.firstApronSpace;
    headlineCaption = 'over the 1st apron';
  } else if (cap.isOverTax) {
    tone = 'watch';
    statusLabel = 'Over luxury tax';
    headlineAmount = cap.taxSpace;
    headlineCaption = 'over the luxury tax';
  } else if (cap.isOverCap) {
    tone = 'watch';
    statusLabel = 'Over salary cap';
    headlineAmount = cap.capSpace;
    headlineCaption = 'over the cap';
  }

  return {
    tone,
    statusLabel,
    detail: `${cap.seasonLabel}: ${formatTrustPanelMoney(
      cap.capSpace
    )} cap space, ${formatTrustPanelMoney(cap.taxSpace)} tax space.`,
    headlineAmount,
    headlineCaption,
    rosterLabel:
      workspace.roster.status === 'available'
        ? `${workspace.roster.count} / 15 roster spots shown`
        : 'Roster count unavailable',
    hardCapLabel: hardCapActive ? statusLabel : null,
    hardCapDetail: hardCapActive ? hardCapStatus?.reason || null : null,
  };
}

const impactTone = (
  section: ArchitectPostActionImpactSection
): TrustPanelTone => {
  if (section.status === 'available') return 'info';
  if (section.status === 'partial') return 'watch';
  if (section.status === 'unavailable') return 'muted';
  return 'muted';
};

const impactStatusLabel = (
  section: ArchitectPostActionImpactSection,
  hasDeltas: boolean
): string => {
  if (section.status === 'available' && hasDeltas) return 'Exact values';
  if (section.status === 'available') return 'Available';
  if (section.status === 'partial') return 'Partial';
  return 'Unavailable';
};

const formatDeltaValue = (
  unit: ArchitectPostActionImpactDeltaUnit,
  value: ArchitectPostActionImpactDelta['before']
): string => {
  if (value === null || value === undefined) return '-';
  if (unit === 'currency' && typeof value === 'number') {
    return formatTrustPanelMoney(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
};

const formatSignedDelta = (
  unit: ArchitectPostActionImpactDeltaUnit,
  delta: number
): string => {
  const sign = delta > 0 ? '+' : '';
  if (unit === 'currency') {
    return `${sign}${formatTrustPanelMoney(delta)}`;
  }
  return `${sign}${delta.toLocaleString()}`;
};

const formatImpactDelta = (
  delta: ArchitectPostActionImpactDelta
): string | null => {
  const hasBeforeAfter = delta.before !== null || delta.after !== null;
  const hasDelta =
    typeof delta.delta === 'number' && Number.isFinite(delta.delta);
  if (!hasBeforeAfter && !hasDelta) return null;

  const beforeAfter = hasBeforeAfter
    ? `${formatDeltaValue(delta.unit, delta.before)} -> ${formatDeltaValue(
        delta.unit,
        delta.after
      )}`
    : null;
  const change = hasDelta ? formatSignedDelta(delta.unit, delta.delta!) : null;
  return `${delta.label}: ${[beforeAfter, change && `(${change})`]
    .filter(Boolean)
    .join(' ')}`;
};

export function deriveReceiptImpactPanel(
  receipt: ArchitectPostActionReceipt | null
): ReceiptImpactPanel {
  if (!receipt) {
    return {
      status: 'empty',
      emptyMessage:
        'No recent committed actions. Exact deltas appear here only when the latest receipt provides them.',
      rows: [],
    };
  }

  const rows = IMPACT_ORDER.map((area) => {
    const section = receipt.impact[area];
    if (!section || section.status === 'not-applicable') return null;
    const deltas = section.deltas
      .map(formatImpactDelta)
      .filter((value): value is string => Boolean(value));
    return {
      id: area,
      label: IMPACT_LABELS[area],
      tone: impactTone(section),
      statusLabel: impactStatusLabel(section, deltas.length > 0),
      summary: section.summary,
      deltas,
    };
  }).filter((row): row is ReceiptImpactRow => Boolean(row));

  return {
    status: 'available',
    emptyMessage:
      rows.length > 0
        ? null
        : 'The latest receipt has no panel-impact sections to summarize.',
    rows,
  };
}
