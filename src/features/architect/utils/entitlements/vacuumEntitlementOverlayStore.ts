/**
 * FILE: src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts
 * PURPOSE: localStorage-backed session overlay for vacuum-mode entitlement editing.
 * OWNERSHIP: Feature: architect/tradeMachine (TM-VACUUM-E1)
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E1 — Vacuum Pick Editing MVP.
 *
 * When worldId is null (vacuum mode), pick-right edits and creates are persisted
 * here instead of Firestore. The overlay is merged at the resolver seam
 * (resolveEntitlementsForTeam) so all downstream consumers see the changes.
 *
 * Storage key: "vacuum_entitlement_overlay"
 * Envelope format: { version: 1, overlays: { [teamCode]: { edits, creates } }, _updatedAt }
 *
 * This file follows the same localStorage pattern as pickRightWizardDraft.ts:
 * try/catch wrapping, silent failure on quota/unavailability.
 */

// ─── types ───────────────────────────────────────────────────────────────────

type EntitlementRecord = Record<string, unknown>;

/** Per-team overlay: edits to existing entitlements + newly created ones */
export interface TeamOverlay {
  /** Patches keyed by existing entitlement ID — deep-merged onto base at resolve time */
  edits: Record<string, EntitlementRecord>;
  /** Full entitlement docs keyed by vacuum-prefixed ID — appended to resolved list */
  creates: Record<string, EntitlementRecord>;
}

/** Top-level localStorage envelope */
export interface OverlayEnvelope {
  version: 1;
  overlays: Record<string, TeamOverlay>;
  _updatedAt: string;
}

// ─── constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vacuum_entitlement_overlay';

const KIND_SHORT: Record<string, string> = {
  pick_ownership: 'own',
  swap_right: 'swap',
  conveyance_right: 'conv',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function emptyEnvelope(): OverlayEnvelope {
  return {
    version: 1,
    overlays: {},
    _updatedAt: new Date().toISOString(),
  };
}

function emptyTeamOverlay(): TeamOverlay {
  return { edits: {}, creates: {} };
}

function ensureTeamOverlay(
  envelope: OverlayEnvelope,
  teamCode: string
): TeamOverlay {
  if (!envelope.overlays[teamCode]) {
    envelope.overlays[teamCode] = emptyTeamOverlay();
  }
  return envelope.overlays[teamCode];
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Load the vacuum overlay envelope from localStorage.
 * Returns an empty envelope if nothing is stored or data is corrupt.
 */
export function loadVacuumOverlay(): OverlayEnvelope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === 1 &&
      typeof parsed.overlays === 'object'
    ) {
      return parsed as OverlayEnvelope;
    }
    return emptyEnvelope();
  } catch {
    return emptyEnvelope();
  }
}

/**
 * Persist the full overlay envelope to localStorage.
 */
export function saveVacuumOverlay(envelope: OverlayEnvelope): void {
  try {
    envelope._updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Get the overlay for a specific team. Returns null if no overlay exists for that team.
 */
export function getTeamOverlay(teamCode: string): TeamOverlay | null {
  const envelope = loadVacuumOverlay();
  const overlay = envelope.overlays[teamCode];
  if (!overlay) return null;
  const hasEdits = Object.keys(overlay.edits).length > 0;
  const hasCreates = Object.keys(overlay.creates).length > 0;
  if (!hasEdits && !hasCreates) return null;
  return overlay;
}

/**
 * Apply an edit (patch) to an existing entitlement in the overlay.
 * The patch will be deep-merged onto the base entitlement at resolve time.
 */
export function applyVacuumEdit(
  teamCode: string,
  entitlementId: string,
  patch: EntitlementRecord
): void {
  const envelope = loadVacuumOverlay();
  const teamOverlay = ensureTeamOverlay(envelope, teamCode);
  // Merge with any existing patch for this entitlement
  teamOverlay.edits[entitlementId] = {
    ...(teamOverlay.edits[entitlementId] || {}),
    ...patch,
  };
  saveVacuumOverlay(envelope);
}

/**
 * Add a newly created entitlement to the overlay.
 * The vacuumEntitlementId should be generated via makeVacuumEntitlementId().
 */
export function applyVacuumCreate(
  teamCode: string,
  vacuumEntitlementId: string,
  fullDoc: EntitlementRecord
): void {
  const envelope = loadVacuumOverlay();
  const teamOverlay = ensureTeamOverlay(envelope, teamCode);
  teamOverlay.creates[vacuumEntitlementId] = {
    ...fullDoc,
    id: vacuumEntitlementId,
  };
  saveVacuumOverlay(envelope);
}

/**
 * Clear all vacuum overlay data from localStorage.
 */
export function clearVacuumOverlay(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
}

/**
 * Check whether any vacuum overlay data exists.
 */
export function hasVacuumOverlay(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !parsed.overlays) return false;
    return Object.values(parsed.overlays as Record<string, TeamOverlay>).some(
      (team) =>
        Object.keys(team.edits || {}).length > 0 ||
        Object.keys(team.creates || {}).length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Generate a vacuum-prefixed entitlement ID.
 * Format: vacuum:<teamCode>:<seasonYear>:<round>:<kindShort>:<8char>
 *
 * Mirrors generateEntitlementId() from entitlementWriter.ts but uses
 * the "vacuum:" prefix to prevent collision with real Firestore IDs.
 */
export function makeVacuumEntitlementId(params: {
  teamCode: string;
  seasonYear: number;
  round: number;
  kind: string;
}): string {
  const { teamCode, seasonYear, round, kind } = params;
  const kindShort = KIND_SHORT[kind] || kind;
  const shortUuid = Math.random().toString(36).substring(2, 10);
  return `vacuum:${teamCode}:${seasonYear}:${round}:${kindShort}:${shortUuid}`;
}
