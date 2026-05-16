/**
 * Wave 17 Step 2: Option-decision normalizers extracted from resolveOffseasonTransition.ts.
 * Contains getPlayerId, getPlayerName, and the normalizeOptionDecisions pipeline.
 */

// type-only back-reference — erased at runtime, no circular dep
import type {
  OffseasonPlayer,
  OffseasonOptionDecisionInput,
  OffseasonOptionDecisionMap,
  OffseasonViolation,
  OffseasonOptionDecision,
} from './resolveOffseasonTransition';

type OffseasonOptionDecisionObject = {
  decision?: string | null;
  choice?: string | null;
  action?: string | null;
  accepted?: boolean;
  optionType?: string | null;
  season?: string | null;
};

type NormalizedOptionDecisionMap = Record<string, OffseasonOptionDecision>;

export function getPlayerId(player: OffseasonPlayer | null | undefined): string | null {
  if (!player) return null;
  return player.player_id || player.id || player.playerId || null;
}

export function getPlayerName(player: OffseasonPlayer | null | undefined): string {
  return player?.displayName || player?.name || player?.playerName || '';
}

function getDecisionMetadata(
  rawDecision: OffseasonOptionDecisionInput
): Pick<OffseasonOptionDecision, 'optionType' | 'season'> {
  if (
    !rawDecision ||
    typeof rawDecision !== 'object' ||
    Array.isArray(rawDecision)
  ) {
    return {};
  }

  const decisionObject = rawDecision as OffseasonOptionDecisionObject;
  return {
    optionType:
      typeof decisionObject.optionType === 'string'
        ? decisionObject.optionType
        : undefined,
    season:
      typeof decisionObject.season === 'string'
        ? decisionObject.season
        : undefined,
  };
}

function normalizeDecisionValue(
  rawDecision: OffseasonOptionDecisionInput
): OffseasonOptionDecision | null {
  if (rawDecision === null || rawDecision === undefined) return null;

  if (typeof rawDecision === 'boolean') {
    return { decision: rawDecision ? 'exercise' : 'decline' };
  }

  if (typeof rawDecision === 'string') {
    const normalized = rawDecision.trim().toLowerCase();
    if (['accept', 'exercise', 'yes', 'true'].includes(normalized)) {
      return { decision: 'exercise' };
    }
    if (['decline', 'reject', 'no', 'false'].includes(normalized)) {
      return { decision: 'decline' };
    }
    return null;
  }

  if (typeof rawDecision === 'object' && !Array.isArray(rawDecision)) {
    const obj = rawDecision as OffseasonOptionDecisionObject;
    const decisionValue =
      obj.decision ?? obj.choice ?? obj.action ?? null;
    if (typeof decisionValue === 'string') {
      const normalized = decisionValue.trim().toLowerCase();
      if (['accept', 'exercise', 'yes', 'true'].includes(normalized)) {
        return {
          decision: 'exercise',
          ...getDecisionMetadata(obj),
        };
      }
      if (['decline', 'reject', 'no', 'false'].includes(normalized)) {
        return {
          decision: 'decline',
          ...getDecisionMetadata(obj),
        };
      }
    }

    if (typeof obj.accepted === 'boolean') {
      return {
        decision: obj.accepted ? 'exercise' : 'decline',
        ...getDecisionMetadata(obj),
      };
    }
  }

  return null;
}

export function normalizeOptionDecisions(
  optionDecisions: OffseasonOptionDecisionMap | null | undefined,
  players: OffseasonPlayer[]
): { decisionsById: NormalizedOptionDecisionMap; violations: OffseasonViolation[] } {
  const decisionsById: NormalizedOptionDecisionMap = {};
  const violations: OffseasonViolation[] = [];

  if (!optionDecisions || typeof optionDecisions !== 'object') {
    return { decisionsById, violations };
  }

  const playersById = new Map<string, OffseasonPlayer>();
  const playersByName = new Map<string, OffseasonPlayer[]>();

  for (const player of players || []) {
    const playerId = getPlayerId(player);
    const playerName = getPlayerName(player);

    if (playerId) {
      playersById.set(playerId, player);
    }

    if (playerName) {
      const existing = playersByName.get(playerName) || [];
      existing.push(player);
      playersByName.set(playerName, existing);
    }
  }

  for (const [rawKey, rawDecision] of Object.entries(optionDecisions)) {
    let resolvedId: string | null = null;

    if (playersById.has(rawKey)) {
      resolvedId = rawKey;
    } else if (playersByName.has(rawKey)) {
      const matches = playersByName.get(rawKey) || [];
      if (matches.length > 1) {
        violations.push({
          rule: 'option_decision_duplicate_name',
          message: `Option decision key "${rawKey}" is ambiguous (multiple players share this name). Use playerId instead.`,
          severity: 'error',
        });
        continue;
      }
      resolvedId = getPlayerId(matches[0]) || rawKey;
    }

    if (!resolvedId) {
      // Decision key does not apply to this team; ignore
      continue;
    }

    const normalizedDecision = normalizeDecisionValue(rawDecision);
    if (!normalizedDecision) {
      violations.push({
        rule: 'option_decision_invalid_value',
        message: `Option decision for player "${rawKey}" is invalid or unsupported.`,
        severity: 'error',
      });
      continue;
    }

    const decisionMetadata = getDecisionMetadata(rawDecision);
    decisionsById[resolvedId] = {
      ...normalizedDecision,
      ...decisionMetadata,
      optionType: normalizedDecision.optionType ?? decisionMetadata.optionType,
      season: normalizedDecision.season ?? decisionMetadata.season,
    };
  }

  return { decisionsById, violations };
}
