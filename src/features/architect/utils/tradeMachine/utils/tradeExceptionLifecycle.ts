import {
  createTpeConsumptionHistoryEntry,
  createTpeCreationHistoryEntry,
} from '@/features/architect/utils/exceptionHistory/historyHelpers';
import type { TradeExceptionRecord } from '@/features/architect/utils/tradeMachine/constants/types';
import { isTwoWayTradePlayer } from './twoWayTradeSalary';

type TradeExceptionLifecycleIncomingPlayer = {
  player_id?: string | null;
  id?: string | null;
  playerId?: string | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  absorptionMode?: string | null;
  tpeId?: string | null;
  matchIncoming?: number | null;
  isTwoWay?: boolean | null;
  contractType?: string | null;
  contract?: Record<string, unknown> | null;
  primaryContract?: Record<string, unknown> | null;
};

type TradeExceptionLifecycleOutgoingPlayer = {
  name?: string | null;
  displayName?: string | null;
  isTwoWay?: boolean | null;
  contractType?: string | null;
  contract?: Record<string, unknown> | null;
  primaryContract?: Record<string, unknown> | null;
};

export type TradeExceptionLifecycleIssue = {
  playerId?: string | null;
  tpeId?: string | null;
  reason: string;
};

type TradeAbsorbedPlayer = {
  playerId?: string | null;
  name?: string | null;
  amountAbsorbed: number;
};

type TradeExceptionHistoryEntry =
  | NonNullable<ReturnType<typeof createTpeConsumptionHistoryEntry>>
  | NonNullable<ReturnType<typeof createTpeCreationHistoryEntry>>;

type ApplyTradeExceptionLifecycleParams = {
  currentTradeExceptions?: TradeExceptionRecord[] | null;
  hasTradeExceptionsValidation?: boolean;
  createdTPE?: TradeExceptionRecord | null;
  incomingPlayers?: TradeExceptionLifecycleIncomingPlayer[] | null;
  outgoingPlayers?: TradeExceptionLifecycleOutgoingPlayer[] | null;
  teamCode?: string | null;
  seasonId: string;
  seasonYear: number;
  timestampISO: string;
  worldId?: string | null;
  mutationType?: string | null;
  mutationId?: string | null;
};

export type ApplyTradeExceptionLifecycleResult = {
  updatedTradeExceptions: TradeExceptionRecord[];
  historyEntries: TradeExceptionHistoryEntry[];
  warnings: TradeExceptionLifecycleIssue[];
  blockingIssues: TradeExceptionLifecycleIssue[];
};

function toFiniteAmount(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getTpeRemaining(tpe: TradeExceptionRecord): number {
  return toFiniteAmount(tpe?.remainingAmount ?? tpe?.amount, 0);
}

function buildCreatedFrom(
  outgoingPlayers: TradeExceptionLifecycleOutgoingPlayer[] = []
): string {
  return (
    outgoingPlayers
      .map((player) => player.name || player.displayName)
      .filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
      .join(', ') || 'Trade'
  );
}

function buildTpeConsumptionState({
  currentTradeExceptions,
  hasTradeExceptionsValidation,
  incomingPlayers,
}: {
  currentTradeExceptions: TradeExceptionRecord[];
  hasTradeExceptionsValidation: boolean;
  incomingPlayers: TradeExceptionLifecycleIncomingPlayer[];
}): {
  updatedTradeExceptions: TradeExceptionRecord[];
  warnings: TradeExceptionLifecycleIssue[];
  blockingIssues: TradeExceptionLifecycleIssue[];
  absorptionDetails: Map<string, TradeAbsorbedPlayer[]>;
} {
  if (!hasTradeExceptionsValidation) {
    return {
      updatedTradeExceptions: [...currentTradeExceptions],
      warnings: [],
      blockingIssues: [],
      absorptionDetails: new Map<string, TradeAbsorbedPlayer[]>(),
    };
  }

  const tpeUsageMap = new Map<string, number>();
  const warnings: TradeExceptionLifecycleIssue[] = [];
  const blockingIssues: TradeExceptionLifecycleIssue[] = [];
  const absorptionDetails = new Map<string, TradeAbsorbedPlayer[]>();
  const tpeEligibleIncomingPlayers = incomingPlayers.filter(
    (player) => !isTwoWayTradePlayer(player)
  );

  tpeEligibleIncomingPlayers.forEach((player) => {
    if (player.absorptionMode === 'TPE') {
      const playerLabel = player.name || player.player_id || 'unknown';
      if (!player.tpeId) {
        blockingIssues.push({
          playerId: player.player_id || player.name,
          reason: `Player ${playerLabel} has absorptionMode='TPE' but no tpeId — apply-time blocked`,
        });
      }
      if (
        player.tpeId &&
        (player.matchIncoming === undefined || player.matchIncoming === null)
      ) {
        blockingIssues.push({
          playerId: player.player_id || player.name,
          tpeId: player.tpeId,
          reason: `Player ${playerLabel} has absorptionMode='TPE' with tpeId but missing matchIncoming — apply-time blocked`,
        });
      }
    }
  });

  if (blockingIssues.length > 0) {
    return {
      updatedTradeExceptions: [...currentTradeExceptions],
      warnings,
      blockingIssues,
      absorptionDetails,
    };
  }

  tpeEligibleIncomingPlayers.forEach((player) => {
    if (!player.tpeId) return;

    if (player.matchIncoming === undefined || player.matchIncoming === null) {
      warnings.push({
        playerId: player.player_id || player.name,
        tpeId: player.tpeId,
        reason: 'matchIncoming missing for TPE consumption - consumption skipped',
      });
      return;
    }

    const consumed = player.matchIncoming ?? 0;
    if (consumed <= 0) {
      return;
    }

    const current = tpeUsageMap.get(player.tpeId) || 0;
    tpeUsageMap.set(player.tpeId, current + consumed);

    const absorptionList = absorptionDetails.get(player.tpeId) || [];
    absorptionList.push({
      playerId: player.player_id || player.id || player.playerId || null,
      name: player.name || player.displayName || player.playerName || null,
      amountAbsorbed: consumed,
    });
    absorptionDetails.set(player.tpeId, absorptionList);
  });

  return {
    updatedTradeExceptions: currentTradeExceptions.map((tpe) => {
      const currentTpeId = typeof tpe.id === 'string' ? tpe.id : null;
      const consumed = currentTpeId ? tpeUsageMap.get(currentTpeId) || 0 : 0;
      if (consumed === 0) return tpe;

      const currentRemaining = getTpeRemaining(tpe);
      const currentUsed = toFiniteAmount(tpe.usedAmount, 0);
      const newRemaining = Math.max(0, currentRemaining - consumed);
      const newUsed = currentUsed + consumed;

      return {
        ...tpe,
        remainingAmount: newRemaining,
        usedAmount: newUsed,
        isUsed: newRemaining === 0,
      };
    }),
    warnings,
    blockingIssues,
    absorptionDetails,
  };
}

function buildTpeConsumptionHistoryEntries({
  currentTradeExceptions,
  updatedTradeExceptions,
  absorptionDetails,
  teamCode,
  seasonId,
  seasonYear,
  timestampISO,
  worldId,
  mutationType,
  mutationId,
}: {
  currentTradeExceptions: TradeExceptionRecord[];
  updatedTradeExceptions: TradeExceptionRecord[];
  absorptionDetails: Map<string, TradeAbsorbedPlayer[]>;
  teamCode: string;
  seasonId: string;
  seasonYear: number;
  timestampISO: string;
  worldId?: string | null;
  mutationType?: string | null;
  mutationId?: string | null;
}): TradeExceptionHistoryEntry[] {
  const historyEntries: TradeExceptionHistoryEntry[] = [];

  currentTradeExceptions.forEach((previousTpe) => {
    const previousTpeId =
      typeof previousTpe.id === 'string' ? previousTpe.id : null;
    if (!previousTpeId) {
      return;
    }

    const nextTpe =
      updatedTradeExceptions.find((candidate) => candidate.id === previousTpeId) ||
      previousTpe;
    const previousRemaining = getTpeRemaining(previousTpe);
    const nextRemaining = getTpeRemaining(nextTpe);
    const consumedAmount = Math.max(0, previousRemaining - nextRemaining);
    if (consumedAmount <= 0) {
      return;
    }

    const historyEntry = createTpeConsumptionHistoryEntry({
      teamCode,
      tpeId: previousTpeId,
      amountConsumed: consumedAmount,
      remainingAmountAfter: nextRemaining,
      fullyConsumed: nextRemaining === 0,
      absorbedPlayers: absorptionDetails.get(previousTpeId) || [],
      seasonId,
      seasonYear,
      timestampISO,
      worldId: typeof worldId === 'string' ? worldId : undefined,
      mutationType: mutationType || 'executeTrade',
      mutationId,
    });

    if (historyEntry) {
      historyEntries.push(historyEntry);
    }
  });

  return historyEntries;
}

function applyCreatedTpe({
  updatedTradeExceptions,
  createdTPE,
  outgoingPlayers,
  teamCode,
  seasonId,
  seasonYear,
  timestampISO,
  worldId,
  mutationType,
  mutationId,
}: {
  updatedTradeExceptions: TradeExceptionRecord[];
  createdTPE?: TradeExceptionRecord | null;
  outgoingPlayers: TradeExceptionLifecycleOutgoingPlayer[];
  teamCode: string;
  seasonId: string;
  seasonYear: number;
  timestampISO: string;
  worldId?: string | null;
  mutationType?: string | null;
  mutationId?: string | null;
}): {
  updatedTradeExceptions: TradeExceptionRecord[];
  creationHistoryEntry: TradeExceptionHistoryEntry | null;
} {
  const tpeEligibleOutgoingPlayers = outgoingPlayers.filter(
    (player) => !isTwoWayTradePlayer(player)
  );

  if (!createdTPE || tpeEligibleOutgoingPlayers.length === 0) {
    return {
      updatedTradeExceptions,
      creationHistoryEntry: null,
    };
  }

  const createdAmount = toFiniteAmount(createdTPE.amount, 0);
  const tpeId =
    (typeof createdTPE.id === 'string' && createdTPE.id) ||
    `tpe_${teamCode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdFrom = buildCreatedFrom(tpeEligibleOutgoingPlayers);
  const newTpeSignature = [
    createdTPE.createdSeason,
    createdTPE.expiresOn,
    createdAmount,
    createdFrom,
  ].join('|');

  const hasDuplicateById = updatedTradeExceptions.some((tpe) => tpe.id === tpeId);
  const hasDuplicateBySignature = updatedTradeExceptions.some((tpe) => {
    const existingSignature = [
      tpe.createdSeason,
      tpe.expiresOn,
      tpe.totalAmount ?? tpe.amount,
      tpe.createdFrom,
    ].join('|');
    return existingSignature === newTpeSignature;
  });

  if (hasDuplicateById || hasDuplicateBySignature) {
    const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';
    if (isDev) {
      console.info(
        '[tradeExceptionLifecycle] Duplicate TPE detected, skipping creation',
        {
          tpeId,
          byId: hasDuplicateById,
          bySignature: hasDuplicateBySignature,
        }
      );
    }

    return {
      updatedTradeExceptions,
      creationHistoryEntry: null,
    };
  }

  const nextTradeExceptions = [
    ...updatedTradeExceptions,
    {
      id: tpeId,
      amount: createdAmount,
      totalAmount: createdAmount,
      remainingAmount: createdAmount,
      usedAmount: 0,
      createdSeason: createdTPE.createdSeason,
      expiresOn: createdTPE.expiresOn,
      createdFrom,
      isUsed: false,
    },
  ];

  return {
    updatedTradeExceptions: nextTradeExceptions,
    creationHistoryEntry: createTpeCreationHistoryEntry({
      teamCode,
      tpeId,
      amountCreated: createdAmount,
      createdFrom,
      createdSeason: createdTPE.createdSeason,
      expiresOn: createdTPE.expiresOn,
      seasonId,
      seasonYear,
      timestampISO,
      worldId: typeof worldId === 'string' ? worldId : undefined,
      mutationType: mutationType || 'executeTrade',
      mutationId,
    }),
  };
}

/**
 * Applies trade-exception lifecycle effects after validator legality has passed.
 *
 * Ownership boundary:
 * - Validation decides whether TPE usage/creation is legal and seeds `createdTPE`
 * - This helper applies lifecycle state transitions and generates trade history
 * - Persistence remains outside this helper
 */
export function applyTradeExceptionLifecycle({
  currentTradeExceptions = [],
  hasTradeExceptionsValidation = false,
  createdTPE = null,
  incomingPlayers = [],
  outgoingPlayers = [],
  teamCode,
  seasonId,
  seasonYear,
  timestampISO,
  worldId,
  mutationType,
  mutationId,
}: ApplyTradeExceptionLifecycleParams): ApplyTradeExceptionLifecycleResult {
  const normalizedTeamCode = typeof teamCode === 'string' ? teamCode : '';
  const normalizedCurrentTradeExceptions = Array.isArray(currentTradeExceptions)
    ? [...currentTradeExceptions]
    : [];

  const consumptionState = buildTpeConsumptionState({
    currentTradeExceptions: normalizedCurrentTradeExceptions,
    hasTradeExceptionsValidation,
    incomingPlayers: Array.isArray(incomingPlayers) ? incomingPlayers : [],
  });

  const historyEntries = buildTpeConsumptionHistoryEntries({
    currentTradeExceptions: normalizedCurrentTradeExceptions,
    updatedTradeExceptions: consumptionState.updatedTradeExceptions,
    absorptionDetails: consumptionState.absorptionDetails,
    teamCode: normalizedTeamCode,
    seasonId,
    seasonYear,
    timestampISO,
    worldId,
    mutationType,
    mutationId,
  });

  const creationState = applyCreatedTpe({
    updatedTradeExceptions: consumptionState.updatedTradeExceptions,
    createdTPE,
    outgoingPlayers: Array.isArray(outgoingPlayers) ? outgoingPlayers : [],
    teamCode: normalizedTeamCode,
    seasonId,
    seasonYear,
    timestampISO,
    worldId,
    mutationType,
    mutationId,
  });

  if (creationState.creationHistoryEntry) {
    historyEntries.push(creationState.creationHistoryEntry);
  }

  return {
    updatedTradeExceptions: creationState.updatedTradeExceptions,
    historyEntries,
    warnings: consumptionState.warnings,
    blockingIssues: consumptionState.blockingIssues,
  };
}
