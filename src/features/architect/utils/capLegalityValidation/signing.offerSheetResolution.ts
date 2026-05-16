/**
 * FILE: src/features/architect/utils/capLegalityValidation/signing.offerSheetResolution.ts
 * PURPOSE: validateOfferSheetResolution — offer-sheet lifecycle state transition validator.
 * OWNERSHIP: Feature: architect/capLegality
 *
 * Wave 10 Step 1: Extracted from signing.ts (L1987–L2076).
 */

import type { ArchitectMutationOfferSheet } from '@/features/architect/utils/mutationPipeline';
import type { CapLegalityViolation } from './schema';

export function validateOfferSheetResolution({
  offerSheet,
  actingTeamCode,
  action,
  asOfDate,
}: {
  offerSheet: ArchitectMutationOfferSheet | null | undefined;
  actingTeamCode: string;
  action: string;
  asOfDate?: string;
}) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const status = offerSheet?.status;
  const homeTeamCode = offerSheet?.homeTeamCode;
  const offeringTeamCode = offerSheet?.offeringTeamCode;

  // 1. Offering Team attempting to Finalize
  if (action === 'finalize' && actingTeamCode === offeringTeamCode) {
    if (status === 'MATCHED') {
      violations.push({
        rule: 'rfa_offer_sheet_matched_offering_team_cannot_finalize',
        message:
          'Offer sheet has been MATCHED by home team. The player stays with home team. Offering team cannot finalize.',
        severity: 'error',
      });
    } else if (status === 'PENDING_MATCH') {
      violations.push({
        rule: 'rfa_offer_sheet_resolution_required',
        message: 'Offer sheet is pending match decision. Cannot finalize yet.',
        severity: 'error',
      });
    }
  }

  // 2. Home Team attempting to Finalize Match
  if (action === 'finalize' && actingTeamCode === homeTeamCode) {
    if (status === 'DECLINED') {
      violations.push({
        rule: 'rfa_offer_sheet_declined_home_team_cannot_finalize',
        message:
          'Offer sheet has been DECLINED by home team. The player goes to the offering team. Home team cannot finalize.',
        severity: 'error',
        actingTeamCode,
        offeringTeamCode,
        homeTeamCode,
        status,
      });
    } else if (status !== 'MATCHED') {
      violations.push({
        rule: 'rfa_offer_sheet_resolution_required',
        message: `Home team cannot finalize match when status is ${status}. Must be MATCHED.`,
        severity: 'error',
      });
    }
  }

  // 3. Match/Decline Actions (Home Team Only)
  if (action === 'match' || action === 'decline') {
    if (actingTeamCode !== homeTeamCode) {
      violations.push({
        rule: 'rfa_offer_sheet_resolution_required',
        message: 'Only the home team can Match or Decline an offer sheet.',
        severity: 'error',
      });
    }

    // Phase 21: Check 48-hour window (blocking violation — late match is not allowed)
    if (action === 'match' && asOfDate && offerSheet?.createdAt) {
      const created = new Date(offerSheet.createdAt);
      const deadline = new Date(created.getTime() + 48 * 60 * 60 * 1000);
      const cutoff = deadline.toISOString().slice(0, 10);

      if (asOfDate > cutoff) {
        violations.push({
          rule: 'offer_sheet_window_expired',
          message: `48-hour match window expired on ${cutoff} (As of: ${asOfDate}).`,
          severity: 'error',
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
