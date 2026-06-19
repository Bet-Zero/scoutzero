/**
 * FILE: src/features/architect/utils/capTotals/hardCapSnapshotOverlay.ts
 * PURPOSE: Downstream hard-cap overlay shaping for totals snapshots.
 * OWNERSHIP: Feature: architect
 */

import type {
  ComputedTeamCapTotals,
  TeamCapSheetLike,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';

type UnknownRecord = Record<string, unknown>;

type CanonicalTotalsLike = Pick<
  ComputedTeamCapTotals,
  'totalCapAllocations' | 'firstApron' | 'secondApron'
>;

export interface HardCapSnapshotOverlay {
  isHardCapped: boolean;
  hardCapLevel: string | null;
  hardCapDetail?: string;
  hardCapReason?: string | null;
  hardCapRoom?: number | null;
}

const asRecord = (value: unknown): UnknownRecord | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return null;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * True only when the team has ACTUALLY triggered a hard cap by using a
 * hard-cap-triggering transaction (NT-MLE, BAE, or sign-and-trade). Those
 * transactions set `hardCapped` / `hardCapTriggeredBy`. This deliberately does
 * NOT look at `hardCapLevel`, which is only a band descriptor (which apron the
 * salary sits in) and must never, by itself, make a team hard-capped.
 */
function hasHardCapTrigger(rec: UnknownRecord | null): boolean {
  if (!rec) return false;

  const isMeaningfulString = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim().toLowerCase();
    return trimmed !== '' && trimmed !== 'none' && trimmed !== 'false';
  };

  const hardCapped = rec.hardCapped;
  if (hardCapped === true || hardCapped === 1 || hardCapped === 2) return true;
  if (isMeaningfulString(hardCapped)) return true;

  if (isMeaningfulString(rec.hardCapTriggeredBy)) return true;

  const triggered = rec.hardCapTriggered;
  if (triggered === true) return true;
  if (isMeaningfulString(triggered)) return true;

  return false;
}

function normalizeHardCapLevel(value: unknown): string | null {
  if (value === 2) return 'secondApron';
  if (value === 1) return 'firstApron';
  if (value === true) return 'firstApron';
  if (value === false || value == null) return null;

  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!normalized) {
    return null;
  }
  if (
    normalized === 'secondapron' ||
    normalized === 'second' ||
    normalized === '2'
  ) {
    return 'secondApron';
  }
  if (
    normalized === 'firstapron' ||
    normalized === 'first' ||
    normalized === '1' ||
    normalized === 'true'
  ) {
    return 'firstApron';
  }

  return null;
}

export function resolveHardCapSnapshotOverlay(
  teamCapSheet: TeamCapSheetLike | null | undefined,
  totals: CanonicalTotalsLike
): HardCapSnapshotOverlay {
  const teamRecord = asRecord(teamCapSheet);
  const existingTotals = asRecord(teamRecord?.totals);

  // A hard cap exists ONLY when a triggering transaction has been used. The
  // scraped `hardCapLevel` is a band descriptor (which apron the salary sits in)
  // and must not, on its own, make a team hard-capped — otherwise every
  // apron-band team is falsely reported as hard-capped at the first apron.
  const isHardCapped =
    existingTotals?.isHardCapped === true ||
    hasHardCapTrigger(teamRecord) ||
    hasHardCapTrigger(existingTotals);

  // The ceiling level prefers an explicit trigger level, falling back to the
  // band descriptor only when the team is genuinely hard-capped.
  const triggeredLevel =
    normalizeHardCapLevel(teamRecord?.hardCapped) ??
    normalizeHardCapLevel(existingTotals?.hardCapped) ??
    normalizeHardCapLevel(teamRecord?.hardCapTriggered) ??
    normalizeHardCapLevel(existingTotals?.hardCapTriggered);

  const bandLevel =
    normalizeHardCapLevel(teamRecord?.hardCapLevel) ??
    normalizeHardCapLevel(existingTotals?.hardCapLevel);

  const hardCapLevel = isHardCapped ? (triggeredLevel ?? bandLevel) : null;

  const hardCapDetail =
    toOptionalString(existingTotals?.hardCapDetail) ??
    toOptionalString(teamRecord?.hardCapDetail) ??
    toOptionalString(teamRecord?.hardCapReason) ??
    undefined;

  const hardCapReason =
    toOptionalString(teamRecord?.hardCapReason) ??
    toOptionalString(existingTotals?.hardCapReason) ??
    hardCapDetail ??
    null;

  let hardCapRoom =
    toOptionalNumber(existingTotals?.hardCapRoom) ??
    toOptionalNumber(teamRecord?.hardCapRoom);

  if (isHardCapped && hardCapLevel) {
    const hardCapCeiling =
      hardCapLevel === 'secondApron' ? totals.secondApron : totals.firstApron;
    hardCapRoom = hardCapCeiling - totals.totalCapAllocations;
  }

  return {
    isHardCapped,
    hardCapLevel,
    ...(hardCapDetail ? { hardCapDetail } : {}),
    ...(hardCapReason !== null ? { hardCapReason } : {}),
    ...(hardCapRoom !== null ? { hardCapRoom } : {}),
  };
}
