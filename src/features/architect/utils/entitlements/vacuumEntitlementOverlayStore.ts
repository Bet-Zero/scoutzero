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

import { getEntitlementIdentityKey } from './entitlementIdentity';
import {
  runTeamExclusivityGate,
  type ExclusivityGateResult,
} from './runTeamExclusivityGate';
import type { EntitlementDocLike } from './entitlementExclusivityValidator';

type EntitlementRecord = Record<string, unknown>;

/** A single entitlement transfer record: moved from one team to another */
export interface TransferRecord {
  entitlementId: string;
  fromTeam: string;
  toTeam: string;
}

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
  /** TM-PICKS-E1: Entitlement transfers from trades (keyed by entitlementId) */
  transfers: Record<string, TransferRecord>;
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
    transfers: {},
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
      // TM-PICKS-E1: Ensure transfers field exists (backward compat with pre-transfer envelopes)
      if (!parsed.transfers || typeof parsed.transfers !== 'object') {
        parsed.transfers = {};
      }
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
 * Fields that may be cleared by the editor. When absent from the document,
 * a null sentinel is stored so the resolver deepMerge treats it as "delete".
 * (BUG #3 fix — TM-ENTITLEMENTS-ADV-E1)
 */
const VACUUM_CLEARABLE_FIELDS = [
  'protectionLadder',
  'poolUnderlyingPickIds',
  'receivesRank',
  'receivesComparator',
  'linkedEntitlementIds',
  'coveredByEntitlementIds',
  'swapType',
  'swapControllerPickId',
  'swapTargetDefinition',
  'residualOfEntitlementId',
  'description',
  'underlyingPickId',
  'underlyingStatus',
] as const;

/**
 * Apply an edit to an existing entitlement in the overlay.
 * Stores a FULL document (not a patch) with null sentinels for cleared fields,
 * so the resolver deepMerge correctly removes them from the base.
 * (BUG #3 fix: replaced patch-merge with full-replace + null sentinels)
 */
export function applyVacuumEdit(
  teamCode: string,
  entitlementId: string,
  document: EntitlementRecord
): void {
  const envelope = loadVacuumOverlay();
  const teamOverlay = ensureTeamOverlay(envelope, teamCode);
  // Full-replace: store the complete document with null sentinels
  // for any clearable field NOT present in the document.
  const withSentinels: EntitlementRecord = { ...document };
  for (const field of VACUUM_CLEARABLE_FIELDS) {
    if (!(field in withSentinels)) {
      withSentinels[field] = null;
    }
  }
  teamOverlay.edits[entitlementId] = withSentinels;
  saveVacuumOverlay(envelope);
}

/**
 * Add a newly created entitlement to the overlay.
 * The vacuumEntitlementId should be generated via getVacuumDeterministicId()
 * from entitlementIdentity.ts for deterministic deduplication.
 *
 * DEDUP BEHAVIOR (R3): Because creates are stored by ID key, calling this
 * function twice with the same ID will overwrite the previous entry,
 * not create a duplicate. This is the intended upsert behavior.
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
 * Remove an existing entitlement edit patch from a team's overlay.
 */
export function removeEdit(teamCode: string, entitlementId: string): void {
  const envelope = loadVacuumOverlay();
  const teamOverlay = envelope.overlays[teamCode];
  if (!teamOverlay?.edits?.[entitlementId]) return;

  delete teamOverlay.edits[entitlementId];

  const hasEdits = Object.keys(teamOverlay.edits).length > 0;
  const hasCreates = Object.keys(teamOverlay.creates || {}).length > 0;
  if (!hasEdits && !hasCreates) {
    delete envelope.overlays[teamCode];
  }

  saveVacuumOverlay(envelope);
}

/**
 * Remove a vacuum-created entitlement from a team's overlay.
 */
export function removeCreate(
  teamCode: string,
  vacuumEntitlementId: string
): void {
  const envelope = loadVacuumOverlay();
  const teamOverlay = envelope.overlays[teamCode];
  if (!teamOverlay?.creates?.[vacuumEntitlementId]) return;

  delete teamOverlay.creates[vacuumEntitlementId];

  const hasEdits = Object.keys(teamOverlay.edits || {}).length > 0;
  const hasCreates = Object.keys(teamOverlay.creates).length > 0;
  if (!hasEdits && !hasCreates) {
    delete envelope.overlays[teamCode];
  }

  saveVacuumOverlay(envelope);
}

/**
 * Returns true when a team has an edit patch for the given entitlement ID.
 */
export function hasEdit(teamCode: string, entitlementId: string): boolean {
  const overlay = getTeamOverlay(teamCode);
  if (!overlay) return false;
  return Boolean(overlay.edits?.[entitlementId]);
}

/**
 * Returns true when a team has a vacuum create entry for the given ID.
 */
export function hasCreate(
  teamCode: string,
  vacuumEntitlementId: string
): boolean {
  const overlay = getTeamOverlay(teamCode);
  if (!overlay) return false;
  return Boolean(overlay.creates?.[vacuumEntitlementId]);
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
    return (
      Object.values(parsed.overlays as Record<string, TeamOverlay>).some(
        (team) =>
          Object.keys(team.edits || {}).length > 0 ||
          Object.keys(team.creates || {}).length > 0
      ) || Object.keys(parsed.transfers || {}).length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Generate a vacuum-prefixed entitlement ID.
 * Format: vacuum:<teamCode>:<seasonYear>:<round>:<kindShort>:<8char>
 *
 * @deprecated Use `getVacuumDeterministicId` from `entitlementIdentity.ts` for
 *             deterministic IDs that enable dedupe/upsert semantics.
 *             This function uses random UUIDs and is retained for legacy test compatibility.
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

// ─── TM-PICKS-E1: Transfer operations for sandbox trade execution ────────────

/**
 * Record an entitlement transfer (trade execution in sandbox mode).
 * When an entitlement moves from one team to another via trade,
 * this records the move so the resolver can exclude it from the old team
 * and include it on the new team.
 */
export function applyVacuumTransfer(
  entitlementId: string,
  fromTeam: string,
  toTeam: string
): void {
  const envelope = loadVacuumOverlay();
  envelope.transfers[entitlementId] = { entitlementId, fromTeam, toTeam };
  saveVacuumOverlay(envelope);
}

// ─── TM-EXCL-E3: Gated vacuum transfer ──────────────────────────────────────

/**
 * Result of a gated vacuum transfer attempt.
 */
export type GatedVacuumTransferResult =
  | { ok: true }
  | { ok: false; errorType: string; message: string; violations?: unknown[] };

/**
 * Apply a vacuum transfer with exclusivity gating.
 *
 * Unlike `applyVacuumTransfer()` (which persists blindly), this function
 * validates that the receiving team's post-transfer entitlement set does not
 * violate exclusivity rules before persisting.
 *
 * The caller must provide the resolved post-transfer entitlement arrays for
 * each affected team. This keeps the gate pure/synchronous — no Firestore.
 *
 * TM-EXCL-E3 invariant: "No entitlement ownership mutation may persist if
 * exclusivity cannot be validated."
 *
 * @param entitlementId — The entitlement being transferred
 * @param fromTeam — Team code sending the entitlement
 * @param toTeam — Team code receiving the entitlement
 * @param postTransferSets — Map of teamCode → post-transfer entitlement docs
 *   for every affected team (at minimum: `toTeam`). If not provided for a team,
 *   the gate fails safely (VALIDATION_UNAVAILABLE).
 * @returns `{ ok: true }` if transfer persisted, error result otherwise.
 */
export function applyGatedVacuumTransfer(
  entitlementId: string,
  fromTeam: string,
  toTeam: string,
  postTransferSets: Record<string, EntitlementDocLike[]>
): GatedVacuumTransferResult {
  // Validate every affected team present in postTransferSets
  const affectedTeams = [toTeam, fromTeam].filter(
    (t) => t && postTransferSets[t]
  );

  // Must have at least the receiver's post-set
  if (!postTransferSets[toTeam]) {
    return {
      ok: false,
      errorType: 'VALIDATION_UNAVAILABLE',
      message: `Vacuum Transfer: Cannot validate exclusivity for ${toTeam} — post-transfer entitlement set not provided.`,
    };
  }

  for (const teamId of affectedTeams) {
    const gateResult: ExclusivityGateResult = runTeamExclusivityGate({
      teamId,
      entitlements: postTransferSets[teamId],
      context: 'VACUUM_TRANSFER',
    });

    if (!gateResult.ok) {
      return {
        ok: false,
        errorType: gateResult.errorType,
        message: gateResult.message,
        violations: gateResult.violations,
      };
    }
  }

  // All teams pass — persist the transfer
  const envelope = loadVacuumOverlay();
  envelope.transfers[entitlementId] = { entitlementId, fromTeam, toTeam };
  saveVacuumOverlay(envelope);

  return { ok: true };
}

/**
 * Remove a previously recorded transfer (undo a sandbox trade for this entitlement).
 */
export function removeTransfer(entitlementId: string): void {
  const envelope = loadVacuumOverlay();
  if (!envelope.transfers[entitlementId]) return;
  delete envelope.transfers[entitlementId];
  saveVacuumOverlay(envelope);
}

/**
 * Get all transfers affecting a specific team.
 * Returns { transfersIn: entitlementIds gained, transfersOut: entitlementIds lost }.
 */
export function getTransfersForTeam(teamCode: string): {
  transfersIn: string[];
  transfersOut: string[];
} {
  const envelope = loadVacuumOverlay();
  const transfersIn: string[] = [];
  const transfersOut: string[] = [];

  for (const transfer of Object.values(envelope.transfers)) {
    if (transfer.toTeam === teamCode) {
      transfersIn.push(transfer.entitlementId);
    }
    if (transfer.fromTeam === teamCode) {
      transfersOut.push(transfer.entitlementId);
    }
  }

  return { transfersIn, transfersOut };
}

/**
 * Check whether a specific entitlement has a transfer record.
 */
export function hasTransfer(entitlementId: string): boolean {
  const envelope = loadVacuumOverlay();
  return Boolean(envelope.transfers[entitlementId]);
}

/**
 * Get the full transfer record for a specific entitlement, or null.
 */
export function getTransfer(entitlementId: string): TransferRecord | null {
  const envelope = loadVacuumOverlay();
  return envelope.transfers[entitlementId] || null;
}

// ─── Identity-Change Rekey + Collision Utilities (TM-ENTITLEMENT-DEDUPE) ─────

/**
 * Rekey a vacuum-created entitlement when its identity fields change.
 *
 * Moves `creates[fromVacId]` → `creates[toVacId]`, overwriting any existing
 * entry at `toVacId` (collision = deterministic overwrite). Always deletes
 * the old `fromVacId` key — no ghosts left behind.
 *
 * @param teamCode  The team code that owns this create entry
 * @param fromVacId The current vacuum ID being replaced
 * @param toVacId   The newly computed deterministic vacuum ID
 * @param document  The updated full entitlement document to store
 */
export function rekeyVacuumCreate(
  teamCode: string,
  fromVacId: string,
  toVacId: string,
  document: EntitlementRecord
): void {
  const envelope = loadVacuumOverlay();
  const teamOverlay = ensureTeamOverlay(envelope, teamCode);

  // Write to new key (upsert — overwrites collision target)
  teamOverlay.creates[toVacId] = {
    ...document,
    id: toVacId,
  };

  // Delete old key (skip if same, but normally they differ)
  if (fromVacId !== toVacId) {
    delete teamOverlay.creates[fromVacId];
  }

  // Clean up empty overlay
  const hasEdits = Object.keys(teamOverlay.edits).length > 0;
  const hasCreates = Object.keys(teamOverlay.creates).length > 0;
  if (!hasEdits && !hasCreates) {
    delete envelope.overlays[teamCode];
  }

  saveVacuumOverlay(envelope);
}

/**
 * After editing a base entitlement (stored in `edits[baseId]`), ensure
 * the edit's effective identity doesn't collide with any `creates[...]`.
 *
 * Policy: if a vacuum create has the same identity as this edit,
 * the edit to the base entitlement wins (it's the canonical record).
 * The colliding create is deleted.
 *
 * This import-free helper uses `getEntitlementIdentityKey` to compute
 * identity from a document — imported at module level to avoid circular deps.
 *
 * @param teamCode  The team code
 * @param editDocument  The document that was just saved as an edit
 */
export function resolveVacuumEditCollisions(
  teamCode: string,
  editDocument: EntitlementRecord
): void {
  const editIdentity = getEntitlementIdentityKey(editDocument);
  const envelope = loadVacuumOverlay();
  const teamOverlay = envelope.overlays[teamCode];
  if (!teamOverlay) return;

  let changed = false;
  for (const [vacId, createDoc] of Object.entries(teamOverlay.creates)) {
    const createIdentity = getEntitlementIdentityKey(createDoc);
    if (createIdentity === editIdentity) {
      // Collision: base-edit wins, remove the vacuum create
      delete teamOverlay.creates[vacId];
      changed = true;
    }
  }

  if (changed) {
    // Clean up empty overlay
    const hasEdits = Object.keys(teamOverlay.edits).length > 0;
    const hasCreates = Object.keys(teamOverlay.creates).length > 0;
    if (!hasEdits && !hasCreates) {
      delete envelope.overlays[teamCode];
    }
    saveVacuumOverlay(envelope);
  }
}

/**
 * Find a vacuum create entry whose identity matches the given identity key.
 * Returns the vacuum ID and document, or null if not found.
 *
 * @param teamCode  The team code to search
 * @param identityKey  The identity key to match against
 * @returns  The matching entry, or null
 */
export function findVacuumCreateByIdentityKey(
  teamCode: string,
  identityKey: string
): { vacuumId: string; document: EntitlementRecord } | null {
  const envelope = loadVacuumOverlay();
  const teamOverlay = envelope.overlays[teamCode];
  if (!teamOverlay) return null;

  for (const [vacId, createDoc] of Object.entries(teamOverlay.creates)) {
    if (getEntitlementIdentityKey(createDoc) === identityKey) {
      return { vacuumId: vacId, document: createDoc };
    }
  }
  return null;
}

/**
 * Deduplicate all vacuum entries for a team by identity key.
 * If multiple creates share the same identity, keep only the last one
 * (by iteration order, which in practice is insertion order).
 *
 * This is a safety net — normal save paths should prevent duplicates.
 *
 * @param teamCode The team code to deduplicate
 * @returns Number of duplicates removed
 */
export function dedupeVacuumByIdentity(teamCode: string): number {
  const envelope = loadVacuumOverlay();
  const teamOverlay = envelope.overlays[teamCode];
  if (!teamOverlay) return 0;

  // Track seen identity keys → the latest vacuum ID wins
  const seen = new Map<string, string>(); // identityKey → vacId
  const toDelete: string[] = [];

  for (const [vacId, createDoc] of Object.entries(teamOverlay.creates)) {
    const key = getEntitlementIdentityKey(createDoc);
    const existing = seen.get(key);
    if (existing) {
      // Duplicate found: mark the older one for deletion
      toDelete.push(existing);
    }
    seen.set(key, vacId);
  }

  for (const vacId of toDelete) {
    delete teamOverlay.creates[vacId];
  }

  if (toDelete.length > 0) {
    const hasEdits = Object.keys(teamOverlay.edits).length > 0;
    const hasCreates = Object.keys(teamOverlay.creates).length > 0;
    if (!hasEdits && !hasCreates) {
      delete envelope.overlays[teamCode];
    }
    saveVacuumOverlay(envelope);
  }

  return toDelete.length;
}
