/**
 * TM-5A CANONICAL: TPE legality owner.
 * Owns trade-exception legality and the validator-stage `createdTPE` seed for a legal trade.
 * It does NOT apply lifecycle mutations or generate history entries; apply-time lifecycle ownership
 * lives in tradeMachine/utils/tradeExceptionLifecycle.ts.
 */
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import { SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';
import { isSecondApronTeam as checkSecondApron } from '../utils/capUtils';
import {
  TradeExceptionPlayer,
  TradeExceptionRecord,
  TradeExceptionValidationResult,
  TradeTeam,
  ValidationIssue,
} from '../constants/types';
import {
  getFirstValidationIssueText,
  summarizeValidationIssues,
} from '../utils/validationIssueText';
import {
  buildCanonicalTeamTpeUsage,
  createTPE,
  isExpiredTPE,
  isPriorYearTPE,
} from '../utils/tpeValidation';

function createIssue(
  message: string,
  code: string,
  details: string | null = null,
  meta: Record<string, unknown> | null = null
): ValidationIssue {
  return {
    message,
    severity: 'error',
    rule: 'tradeExceptions',
    code,
    details,
    meta,
  };
}

function resolveNumericYear(yearKey: number | string | undefined): number {
  if (typeof yearKey === 'number') return yearKey;
  if (typeof yearKey === 'string' && yearKey.trim()) {
    const parsed = parseInt(yearKey.split('-')[0], 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return new Date().getFullYear();
}

function hasOutgoingSalary(
  salaryOut: number,
  outgoingPlayers: TradeExceptionPlayer[],
  sends: TradeExceptionPlayer[]
): boolean {
  return (
    Number(salaryOut || 0) > 0 ||
    [...(outgoingPlayers || []), ...(sends || [])].some(
      (player) => Number(player?.matchOutgoing ?? player?.salary ?? 0) > 0
    )
  );
}

function applyTpeMutation(
  tpe: TradeExceptionRecord,
  nextRemaining: number
): void {
  tpe.remaining = nextRemaining;
  tpe.remainingAmount = nextRemaining;
  tpe.isUsed = nextRemaining === 0;

  const sourceRef =
    tpe.sourceRef && typeof tpe.sourceRef === 'object'
      ? (tpe.sourceRef as TradeExceptionRecord)
      : null;
  if (sourceRef && sourceRef !== tpe) {
    sourceRef.remaining = nextRemaining;
    sourceRef.remainingAmount = nextRemaining;
    sourceRef.isUsed = nextRemaining === 0;
  }
}

export function validateTradeExceptions(
  team: TradeTeam
): TradeExceptionValidationResult {
  const violations: ValidationIssue[] = [];
  const {
    teamTotalSalary = 0,
    context = {},
    incomingPlayers = [],
    outgoingPlayers = [],
    sends = [],
    appliedTPEs = [],
    tradeExceptions = [],
    salaryOut = 0,
    salaryIn = 0,
  } = team;

  const { capSettings = {}, yearKey } = context;
  const canonicalTradeDate = context.tradeDate || new Date().toISOString();
  const numericYear = resolveNumericYear(yearKey);

  const canonicalTpeUsage = buildCanonicalTeamTpeUsage({
    team,
    incomingPlayers,
    appliedTPEs,
    tradeExceptions,
  });
  const { usedTpes, unresolvedPlayers, usesTpe } = canonicalTpeUsage;

  unresolvedPlayers.forEach(({ player, tpeId, reason }) => {
    const playerName = player?.name || player?.displayName || 'Unknown';

    if (reason === 'missingTpeId') {
      violations.push(
        createIssue(
          `Player ${playerName} has absorptionMode='TPE' but no tpeId specified`,
          'TRADE_EXCEPTIONS__MISSING_TPE_ID',
          'Fail-closed TPE usage requires an explicit tpeId',
          { playerName, reason }
        )
      );
      return;
    }

    if (reason === 'missingOnTeam') {
      violations.push(
        createIssue(
          `Player ${playerName} references tpeId '${tpeId}' which does not exist on this team`,
          'TRADE_EXCEPTIONS__UNKNOWN_TPE_ID',
          'Assigned tpeId could not be resolved against the team-held or compatibility TPE set',
          { playerName, tpeId, reason }
        )
      );
    }
  });

  const isSecondApronTeam = checkSecondApron(
    { totalSalary: teamTotalSalary },
    capSettings
  );

  // TM-1C CANONICAL: Second-apron prior-year TPE USAGE ban.
  // Fires only when the team is actively using a prior-year TPE in this trade.
  if (isSecondApronTeam && usesTpe) {
    const hasPriorYearTPE = usedTpes.some(({ tpe }) =>
      tpe ? isPriorYearTPE(tpe, numericYear) : false
    );

    if (hasPriorYearTPE) {
      violations.push(
        createIssue(
          SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED,
          'TRADE_EXCEPTIONS__SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED',
          'Second apron teams cannot use prior-year TPEs',
          { numericYear }
        )
      );
    }
  }

  if (usesTpe && hasOutgoingSalary(salaryOut, outgoingPlayers, sends)) {
    violations.push(
      createIssue(
        'Cannot aggregate trade exception with outgoing salary',
        'TRADE_EXCEPTIONS__CANNOT_AGGREGATE_WITH_OUTGOING_SALARY',
        'TPE usage is only legal when no outgoing salary is aggregated'
      )
    );
  }

  usedTpes.forEach(({ tpe, tpeId, totalUsage, source }) => {
    if (!tpe) return;

    const tpeViolations: ValidationIssue[] = [];
    if (tpe.isUsed || tpe.isBeingUsed) {
      tpeViolations.push(
        createIssue(
          `Trade exception ${tpe.id || tpeId} already being processed`,
          'TRADE_EXCEPTIONS__ALREADY_IN_USE',
          'The selected TPE is already marked as used or in-flight',
          { tpeId, source }
        )
      );
      violations.push(...tpeViolations);
      return;
    }

    if (isExpiredTPE(tpe, canonicalTradeDate)) {
      tpeViolations.push(
        createIssue(
          `Trade exception ${tpe.id || tpeId} is expired`,
          'TRADE_EXCEPTIONS__EXPIRED',
          `Evaluated against canonical tradeDate ${canonicalTradeDate}`,
          { tpeId, source }
        )
      );
    }

    const tpeAmount = tpe.amount || 0;
    if (totalUsage > tpeAmount) {
      tpeViolations.push(
        createIssue(
          `TPE usage ${formatCurrency(totalUsage)} exceeds TPE capacity ${formatCurrency(tpeAmount)} - TPE is too small`,
          'TRADE_EXCEPTIONS__CAPACITY_EXCEEDED',
          `totalUsage=${totalUsage} tpeAmount=${tpeAmount}`,
          { tpeId, source, totalUsage, tpeAmount }
        )
      );
    }

    if (tpeViolations.length === 0) {
      applyTpeMutation(tpe, tpeAmount - totalUsage);
    }

    violations.push(...tpeViolations);
  });

  const salaryDifference = salaryOut - salaryIn;
  let createdTPE: TradeExceptionRecord | null = null;

  if (salaryDifference > 0 && teamTotalSalary > (capSettings.salaryCap || 0)) {
    createdTPE = createTPE({
      teamCtx: { isOverCap: true },
      outgoing: salaryOut,
      incoming: salaryIn,
      tradeDate: canonicalTradeDate,
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    message: getFirstValidationIssueText(violations, 'TPE usage validated'),
    details: summarizeValidationIssues(violations),
    createdTPE,
  };
}
