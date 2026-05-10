/**
 * FILE: src/features/architect/utils/tradeMachine/utils/buildEntitlementRoutingMap.ts
 * PURPOSE: Build an explicit routing map for all entitlements in a trade.
 *          Every outgoing entitlement must map to exactly one destination team.
 *          For 2-team trades, routing is auto-resolved. For 3+, it must be explicit.
 * OWNERSHIP: Trade Machine / Entitlement Routing (TM-EXCL-E2)
 *
 * HISTORY:
 *   - 2026-02-20: Created for TM-EXCL-E2 — No Silent Skips
 *
 * INVARIANT: Every entitlement included in a trade MUST have a resolvable
 * destination team, else the trade is illegal.
 */

export interface RoutingEntry {
  fromTeamId: string;
  toTeamId: string;
  entitlementId: string;
}

export interface RoutingMapSuccess {
  ok: true;
  /** Keyed by `${fromTeamId}::${entitlementId}` → toTeamId */
  map: Map<string, string>;
  entries: RoutingEntry[];
}

export interface RoutingMapFailure {
  ok: false;
  reason: string;
  /** Individual error details for debugging */
  errors: string[];
}

export type RoutingMapResult = RoutingMapSuccess | RoutingMapFailure;

interface TeamSlot {
  teamId?: string;
  team?: {
    id?: string;
    teamId?: string;
    teamCode?: string;
  } | null;
  entitlementsOut?: Array<{
    id?: string;
    entitlementId?: string;
    toTeamId?: string | null;
    fromTeamId?: string;
  }>;
}

/**
 * Resolve a team's canonical ID from various field locations.
 */
function resolveTeamId(slot: TeamSlot): string | null {
  return (
    slot.teamId ||
    slot.team?.teamId ||
    slot.team?.id ||
    slot.team?.teamCode ||
    null
  );
}

/**
 * Build an explicit entitlement routing map for ALL trade participants.
 *
 * Rules:
 * - For 2-team trades: toTeamId is auto-resolved to the other team if missing.
 * - For 3+ team trades: toTeamId MUST be explicitly set on every outgoing entitlement.
 * - toTeamId must reference a team in the trade.
 * - toTeamId must not equal fromTeamId.
 * - The same entitlement cannot appear in multiple teams' outgoing (routing conflict).
 *
 * @param teams - Array of trade team slots
 * @returns RoutingMapResult — either { ok: true, map, entries } or { ok: false, reason, errors }
 */
export function buildEntitlementRoutingMap(
  teams: TeamSlot[]
): RoutingMapResult {
  const errors: string[] = [];
  const entries: RoutingEntry[] = [];
  const map = new Map<string, string>();

  // Only consider teams that have been selected (have a team object)
  const activeSlots = (teams || []).filter((t) => t.team);

  if (activeSlots.length < 2) {
    // No trade to validate — trivially OK (no entitlements to route)
    return { ok: true, map, entries };
  }

  // Build set of valid team IDs in this trade
  const tradeTeamIds = new Set<string>();
  for (const slot of activeSlots) {
    const id = resolveTeamId(slot);
    if (id) tradeTeamIds.add(id);
  }

  // Track all outgoing entitlement IDs to detect duplicates
  const seenEntitlements = new Map<string, string>(); // entitlementId → fromTeamId

  for (const slot of activeSlots) {
    const fromTeamId = resolveTeamId(slot);
    if (!fromTeamId) continue;

    const entitlementsOut = slot.entitlementsOut || [];
    if (entitlementsOut.length === 0) continue;

    for (const ent of entitlementsOut) {
      const entitlementId = ent.entitlementId || ent.id;
      if (!entitlementId) {
        errors.push(`Entitlement from ${fromTeamId} has no id — cannot route`);
        continue;
      }

      // Duplicate detection: same entitlement in multiple teams' outgoing
      if (seenEntitlements.has(entitlementId)) {
        const otherTeam = seenEntitlements.get(entitlementId);
        errors.push(
          `Routing conflict: entitlement "${entitlementId}" is outgoing from both ${otherTeam} and ${fromTeamId}`
        );
        continue;
      }
      seenEntitlements.set(entitlementId, fromTeamId);

      // Resolve toTeamId
      let toTeamId = ent.toTeamId || null;

      // Auto-resolve for 2-team trades
      if (!toTeamId && activeSlots.length === 2) {
        const otherSlot: TeamSlot | undefined = activeSlots.find(
          (s) => resolveTeamId(s) !== fromTeamId
        );
        toTeamId = otherSlot ? resolveTeamId(otherSlot) : null;
      }

      // Validate routing
      if (!toTeamId) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} has no destination team (toTeamId required in ${activeSlots.length}-team trade)`
        );
        continue;
      }

      if (toTeamId === fromTeamId) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} cannot be routed to the same team`
        );
        continue;
      }

      if (!tradeTeamIds.has(toTeamId)) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} has invalid destination "${toTeamId}" — not in trade`
        );
        continue;
      }

      // Valid routing
      const key = `${fromTeamId}::${entitlementId}`;
      map.set(key, toTeamId);
      entries.push({ fromTeamId, toTeamId, entitlementId });
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      reason: `Pick Exclusivity: Entitlement routing incomplete (${errors.length} error${errors.length > 1 ? 's' : ''})`,
      errors,
    };
  }

  return { ok: true, map, entries };
}

