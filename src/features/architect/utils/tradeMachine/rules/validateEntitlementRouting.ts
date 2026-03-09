type TeamIdentifierValue = string | number | null | undefined;

type TeamIdentifierLike =
  | TeamIdentifierValue
  | {
      teamCode?: TeamIdentifierValue;
      id?: TeamIdentifierValue;
      code?: TeamIdentifierValue;
      abbreviation?: TeamIdentifierValue;
      [key: string]: unknown;
    };

type EntitlementIdentifier = string | number;

type EntitlementRoutingEntitlement = {
  entitlementId?: EntitlementIdentifier | null;
  id?: EntitlementIdentifier | null;
  toTeamId?: TeamIdentifierLike;
  linkedEntitlementIds?: unknown;
  residualOfEntitlementId?: string | null;
  [key: string]: unknown;
};

type EntitlementRoutingTeam = {
  id?: TeamIdentifierValue;
  teamId?: TeamIdentifierValue;
  teamCode?: TeamIdentifierValue;
  code?: TeamIdentifierValue;
  abbreviation?: TeamIdentifierValue;
  entitlementIds?: EntitlementIdentifier[] | null;
  [key: string]: unknown;
};

type EntitlementRoutingTeamSlot = {
  team?: EntitlementRoutingTeam | null;
  entitlementsOut?: EntitlementRoutingEntitlement[] | null;
  validationEntitlements?: EntitlementRoutingEntitlement[] | null;
  [key: string]: unknown;
};

type EntitlementRoutingParams = {
  teams?: EntitlementRoutingTeamSlot[] | null;
};

type EntitlementRoutingResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

type EntitlementRoutingContext = {
  teams?: EntitlementRoutingTeamSlot[] | null;
  [key: string]: unknown;
};

type EntitlementRoutingEnforcementResult = {
  pass: boolean;
  errors: string[];
  warnings: string[];
};

function normalizeTeamCode(teamIdLike: TeamIdentifierLike): string | number | null {
  if (!teamIdLike) return null;

  if (typeof teamIdLike === 'string') {
    if (teamIdLike.length === 3) return teamIdLike.toUpperCase();
    return teamIdLike;
  }

  if (typeof teamIdLike === 'object') {
    return (
      teamIdLike.teamCode ||
      teamIdLike.id ||
      teamIdLike.code ||
      teamIdLike.abbreviation ||
      null
    );
  }

  return null;
}

function getEntitlementId(
  entitlement: EntitlementRoutingEntitlement | null | undefined
): EntitlementIdentifier | null {
  return entitlement?.entitlementId || entitlement?.id || null;
}

function normalizeLinkedIds(linkedIds: unknown): string[] {
  if (!Array.isArray(linkedIds)) return [];

  return [
    ...new Set(
      linkedIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];
}

function getKnownEntitlementMap(
  teams: EntitlementRoutingTeamSlot[] | null | undefined
): Map<EntitlementIdentifier, EntitlementRoutingEntitlement> {
  const knownById = new Map<EntitlementIdentifier, EntitlementRoutingEntitlement>();

  for (const slot of teams || []) {
    for (const ent of slot.validationEntitlements || []) {
      const entId = getEntitlementId(ent);
      if (entId && !knownById.has(entId)) {
        knownById.set(entId, ent);
      }
    }
    for (const ent of slot.entitlementsOut || []) {
      const entId = getEntitlementId(ent);
      if (entId && !knownById.has(entId)) {
        knownById.set(entId, ent);
      }
    }
  }

  return knownById;
}

export function validateEntitlementRouting({
  teams,
}: EntitlementRoutingParams): EntitlementRoutingResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(teams) || teams.length === 0) {
    return { valid: true, errors, warnings };
  }

  const activeTeams = teams.filter((slot) => slot.team);
  const activeTeamCount = activeTeams.length;

  if (activeTeamCount < 2) {
    return { valid: true, errors, warnings };
  }

  const tradeTeamIds = new Set<string | number>();
  for (const slot of activeTeams) {
    const teamId = normalizeTeamCode(slot.team?.id || slot.team?.teamCode);
    if (teamId) tradeTeamIds.add(teamId);
  }

  const seenEntitlementIds = new Map<EntitlementIdentifier, string | number | null>();

  for (const slot of teams) {
    if (!slot.team) continue;

    const fromTeamId = normalizeTeamCode(slot.team.id || slot.team.teamCode);
    const teamEntitlementIds = slot.team.entitlementIds || [];
    const entitlementsOut = slot.entitlementsOut || [];

    for (const ent of entitlementsOut) {
      const entitlementId = ent.entitlementId || ent.id;
      if (!entitlementId) {
        warnings.push(
          `Entitlement from ${fromTeamId} has no id/entitlementId field`
        );
        continue;
      }

      if (seenEntitlementIds.has(entitlementId)) {
        const otherTeam = seenEntitlementIds.get(entitlementId);
        errors.push(
          `Entitlement "${entitlementId}" is selected by both ${otherTeam} and ${fromTeamId} — same asset cannot be traded by multiple teams`
        );
      } else {
        seenEntitlementIds.set(entitlementId, fromTeamId);
      }

      const toTeamId = normalizeTeamCode(ent.toTeamId);
      if (activeTeamCount > 2 && !toTeamId) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} has no destination (toTeamId required in ${activeTeamCount}-team trade)`
        );
      }

      if (toTeamId && !tradeTeamIds.has(toTeamId)) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} has invalid destination "${toTeamId}" — not a team in this trade`
        );
      }

      if (toTeamId && toTeamId === fromTeamId) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} cannot be routed to the same team`
        );
      }

      if (!teamEntitlementIds.includes(entitlementId)) {
        errors.push(
          `Entitlement "${entitlementId}" is not owned by ${fromTeamId} — cannot trade asset you don't own`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEntitlementLinkageLegality({
  teams,
}: EntitlementRoutingParams): EntitlementRoutingResult {
  const warnings: string[] = [];

  if (!Array.isArray(teams) || teams.length === 0) {
    return { valid: true, errors: [], warnings };
  }

  const knownEntitlements = getKnownEntitlementMap(teams);
  const outgoingIds = new Set<EntitlementIdentifier>();

  for (const slot of teams) {
    for (const ent of slot.entitlementsOut || []) {
      const entId = getEntitlementId(ent);
      if (entId) outgoingIds.add(entId);
    }
  }

  const errorSet = new Set<string>();

  for (const slot of teams) {
    if (!slot.team) continue;

    const fromTeamId = normalizeTeamCode(slot.team.id || slot.team.teamCode);
    for (const entitlement of slot.entitlementsOut || []) {
      const entitlementId = getEntitlementId(entitlement);
      if (!entitlementId) continue;

      const linkedIds = normalizeLinkedIds(entitlement.linkedEntitlementIds);
      if (linkedIds.length > 0) {
        const missingLinkedIds = linkedIds.filter(
          (linkedId) => !knownEntitlements.has(linkedId)
        );
        if (missingLinkedIds.length > 0) {
          errorSet.add(
            `Entitlement "${entitlementId}" from ${fromTeamId} has missing linked references: ${missingLinkedIds.join(', ')}`
          );
        }

        const missingFromTrade = linkedIds.filter(
          (linkedId) => !outgoingIds.has(linkedId)
        );
        if (missingFromTrade.length > 0) {
          errorSet.add(
            `Entitlement "${entitlementId}" from ${fromTeamId} is linked to ${missingFromTrade.join(', ')} and must trade as a complete linked package`
          );
        }
      }

      const residualId =
        typeof entitlement.residualOfEntitlementId === 'string'
          ? entitlement.residualOfEntitlementId.trim()
          : '';
      if (residualId && !knownEntitlements.has(residualId)) {
        errorSet.add(
          `Entitlement "${entitlementId}" from ${fromTeamId} has missing residual reference: ${residualId}`
        );
      }
    }
  }

  return {
    valid: errorSet.size === 0,
    errors: [...errorSet],
    warnings,
  };
}

export function enforceEntitlementRouting(
  ctx: EntitlementRoutingContext
): EntitlementRoutingEnforcementResult {
  const { teams } = ctx;
  const result = validateEntitlementRouting({ teams });

  return {
    pass: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export default validateEntitlementRouting;
