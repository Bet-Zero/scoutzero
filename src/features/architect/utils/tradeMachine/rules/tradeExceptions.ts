import { isSecondApronTeam } from '../utils/capUtils';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';

interface LegacyTradeExceptionRecord {
  id?: string | null;
  isUsed?: boolean;
  remaining?: number;
  expirationDate?: string | null;
  [key: string]: unknown;
}

interface LegacyTradeExceptionPlayer {
  absorptionMode?: string;
  tpeId?: string | null;
  matchIncoming?: number;
  [key: string]: unknown;
}

interface LegacyTradeExceptionTeamState {
  [key: string]: unknown;
}

interface LegacyTradeExceptionsTeam {
  team?: LegacyTradeExceptionTeamState | null;
  receives?: LegacyTradeExceptionPlayer[] | null;
  sends?: unknown[] | null;
  [key: string]: unknown;
}

interface LegacyTradeExceptionsContext {
  capSettings?: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface LegacyTradeExceptionsResult {
  passed: boolean;
  violations: string[];
  message: string;
  details?: string;
}

export function validateTradeExceptions(
  team: LegacyTradeExceptionsTeam,
  tradeCtx: LegacyTradeExceptionsContext = {}
): LegacyTradeExceptionsResult {
  const violations: string[] = [];

  const usesTPE = team.receives?.some((player) => player.absorptionMode === 'TPE');
  if (!usesTPE) {
    return {
      passed: true,
      violations: [],
      message: 'Trade exceptions validated',
      details: '',
    };
  }

  if (isSecondApronTeam(team.team, tradeCtx.capSettings)) {
    violations.push('Teams above the Second Apron cannot use TPEs');
    return {
      passed: false,
      violations,
      message: violations[0] as string,
    };
  }

  const teamTpes = getTeamTpeList(team.team) as LegacyTradeExceptionRecord[];

  team.receives?.forEach((player) => {
    if (player.absorptionMode === 'TPE') {
      const tpe = teamTpes.find((candidate) => candidate.id === player.tpeId);

      if (!tpe) {
        violations.push('Invalid TPE specified');
        return;
      }

      if (tpe.isUsed) {
        violations.push('TPE is already being processed in another trade');
        return;
      }

      if (tpe.expirationDate && new Date(tpe.expirationDate) < new Date()) {
        violations.push('TPE has expired');
        return;
      }

      if ((tpe.remaining as number) < (player.matchIncoming as number)) {
        violations.push('TPE is too small for incoming salary');
        return;
      }

      tpe.isUsed = true;
      tpe.remaining =
        (tpe.remaining as number) - (player.matchIncoming as number);
    }
  });

  if (usesTPE && (team.sends?.length ?? 0) > 0) {
    violations.push('Cannot combine TPE with outgoing salary');
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? (violations[0] as string)
      : 'Trade exceptions validated',
    details: '',
  };
}
