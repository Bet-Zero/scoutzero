import {
  birdRightsVetoApplies,
  destinationRequiresLimitedNTCConsent,
  hasConsent,
  hasFullNTC,
} from '@/features/architect/utils/consentUtils';
import {
  ConsentValidationResult,
  TeamContext,
  TradeExceptionPlayer,
  TradeTeam,
  ValidationIssue,
} from '../constants/types';
import { inspectGovernedOfferSheetMatchRestriction } from '@/features/architect/utils/offerSheets';
import { summarizeValidationIssues } from '../utils/validationIssueText';

type ConsentPlayer = TradeExceptionPlayer & {
  destTeamId?: string | number | null;
  toTeamId?: string | null;
  hasFullNTC?: boolean;
  noTradeClause?: boolean;
  limitedNTCTeamIds?: Array<string | number>;
  limitedNTCTeams?: Array<string | number>;
  onOneYearBirdDeal?: boolean;
  oneYearBirdVeto?: boolean;
  consentGranted?: boolean;
  consent?: boolean;
  currentTeamId?: string | number | null;
  contract?: {
    fullNTC?: boolean;
    limitedNTCList?: Array<string | number>;
    yearsRemaining?: number;
    offerSheetMatchRestriction?: unknown;
  };
};

function createIssue(
  message: string,
  code: string,
  details: string | null = null,
  meta: Record<string, unknown> | null = null
): ValidationIssue {
  return {
    message,
    severity: 'error',
    rule: 'consent',
    code,
    details,
    meta,
  };
}

function getPlayerName(player: ConsentPlayer): string {
  return player.name || 'Player';
}

function getTeamName(team: TradeTeam): string | null {
  const teamName = team.teamName || team.team?.teamName;
  return typeof teamName === 'string' && teamName.trim() ? teamName : null;
}

function resolveDestinationTeamId(
  team: TradeTeam,
  player: ConsentPlayer,
  tradeCtx: TeamContext
): string | number | null {
  const teams = Array.isArray(tradeCtx.teams) ? tradeCtx.teams : [];
  let destTeamId: string | number | null = null;

  if (teams.length === 2) {
    const otherTeam = teams.find(
      (candidate) => candidate.teamId !== team.teamId
    );
    if (otherTeam) {
      destTeamId =
        (otherTeam.teamId as string | number | null | undefined) || null;
    }
  } else if (teams.length > 2) {
    destTeamId = player.destTeamId || player.toTeamId || null;
  }

  if (!destTeamId && teams.length === 2) {
    const currentTeamName = getTeamName(team);
    const otherTeam = teams.find(
      (candidate) => getTeamName(candidate) !== currentTeamName
    );
    if (otherTeam) {
      destTeamId = getTeamName(otherTeam);
    }
  }

  return destTeamId;
}

export function validateConsent(
  team: TradeTeam,
  tradeCtx: TeamContext = {}
): ConsentValidationResult {
  const violations: ValidationIssue[] = [];
  const outgoingPlayers = Array.isArray(team.sends)
    ? (team.sends as ConsentPlayer[])
    : [];

  outgoingPlayers.forEach((player) => {
    const playerName = getPlayerName(player);
    const destTeamId = resolveDestinationTeamId(team, player, tradeCtx);
    const offerSheetRestriction = inspectGovernedOfferSheetMatchRestriction(
      player.contract?.offerSheetMatchRestriction,
      tradeCtx.asOfDate ?? tradeCtx.tradeDate
    );

    if (
      offerSheetRestriction.status === 'incompatible' ||
      offerSheetRestriction.status === 'needs-input'
    ) {
      violations.push(
        createIssue(
          `${playerName}'s matched Offer Sheet restriction cannot be certified for this trade`,
          'CONSENT__OFFER_SHEET_RESTRICTION_UNRESOLVED',
          null,
          { playerName }
        )
      );
    } else if (offerSheetRestriction.status === 'active') {
      const offeringTeamId =
        offerSheetRestriction.restriction.offeringTeamId.toUpperCase();
      if (!destTeamId) {
        violations.push(
          createIssue(
            `${playerName}'s trade destination is required while matched Offer Sheet restrictions are active`,
            'CONSENT__OFFER_SHEET_DESTINATION_REQUIRED',
            null,
            { playerName }
          )
        );
      } else if (String(destTeamId).toUpperCase() === offeringTeamId) {
        violations.push(
          createIssue(
            `${playerName} cannot be traded to the Offer Sheet's offering Team before ${offerSheetRestriction.restriction.restrictedUntil}`,
            'CONSENT__OFFER_SHEET_OFFERING_TEAM_BARRED',
            null,
            { playerName, destTeamId }
          )
        );
      } else if (!hasConsent(player)) {
        violations.push(
          createIssue(
            `${playerName} must consent to a trade before ${offerSheetRestriction.restriction.restrictedUntil} after a matched Offer Sheet`,
            'CONSENT__OFFER_SHEET_PLAYER_CONSENT_REQUIRED',
            null,
            { playerName, destTeamId }
          )
        );
      }
    }

    if (hasFullNTC(player) && !hasConsent(player)) {
      violations.push(
        createIssue(
          `${playerName} has a full no-trade clause and must consent`,
          'CONSENT__FULL_NTC_REQUIRED',
          null,
          { playerName }
        )
      );
    }

    if (
      destTeamId &&
      destinationRequiresLimitedNTCConsent(player, destTeamId) &&
      !hasConsent(player)
    ) {
      violations.push(
        createIssue(
          `${playerName} has not waived their limited no-trade clause for ${destTeamId}`,
          'CONSENT__LIMITED_NTC_REQUIRED',
          null,
          { playerName, destTeamId }
        )
      );
    }

    if (
      destTeamId &&
      birdRightsVetoApplies(player, destTeamId) &&
      !hasConsent(player)
    ) {
      violations.push(
        createIssue(
          `${playerName} has Bird rights veto power and must consent`,
          'CONSENT__BIRD_VETO_REQUIRED',
          null,
          { playerName, destTeamId }
        )
      );
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Player consent required'
      : 'Player consent validated',
    details: summarizeValidationIssues(violations),
  };
}
