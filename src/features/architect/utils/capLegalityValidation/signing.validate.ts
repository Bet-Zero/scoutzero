/**
 * FILE: src/features/architect/utils/capLegalityValidation/signing.validate.ts
 * PURPOSE: validateSigning — main signing validation orchestrator.
 * OWNERSHIP: Feature: architect/capLegality
 *
 * Wave 10 Step 2: Extracted from signing.ts (L970–L1986).
 */

import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';
import { getPlayerId } from '@/features/architect/utils/capHelpers';
import { getSigningHardCapTriggerMetadata } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import {
  validateFreeAgencyState,
  normalizeTeamRef,
  normalizePlayerTeamRef,
} from '@/features/architect/utils/contractNormalization';
import {
  getRookieScaleAmount,
  ROOKIE_SCALE_MIN_PCT,
  ROOKIE_SCALE_MAX_PCT,
  ROOKIE_SCALE_TOLERANCE,
} from '@/features/architect/data/rookieScale';
import { normalizeSeasonKey } from '@/features/architect/data/capYearData';
import type {
  CapLegalityViolation,
  MutationCapHold,
  MutationValidationResult,
  ValidateSigningParams,
} from './schema';
import {
  asRecordLike,
  computeCanonicalMutationTeamCapTotals,
  countStandardRoster,
  countTwoWayContracts,
  evaluateDataConfidence,
  getContractYears,
  getDraftPickNumber,
  getFirstYearAmounts,
  getMutationYearsOfService,
  getNormalizedContractType,
  getSigningFirstYearMax,
  getSigningYearsLimits,
  getValidationHardCapStatus,
  isFinalizingSigning,
  normalizeBirdRights,
  normalizeFreeAgency,
  resolveSigningMechanism,
  toFiniteNumber,
  validateExceptionEligibility,
  validateOfferSheetTerms,
  validateSigningTermsAndRaises,
  validateStoreOnlyInvariants,
} from './signing';
import {
  isCapSpaceSigning,
  getSigningTermsForPlayer,
  normalizeSigningTerms,
  validateCanonicalSigningExceptionAvailability,
} from './signing.terms';
import { validateContractRows } from './signing.contractValidators';

export function validateSigning({
  team,
  player,
  contract,
  signedUsing,
  year,
  asOfDate,
}: ValidateSigningParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const rules = getCapRulesForYear(year);
  const canonicalSalaryTotals = computeCanonicalMutationTeamCapTotals(
    team,
    year,
    asOfDate ?? null
  );
  if (
    canonicalSalaryTotals.teamSalary === null ||
    canonicalSalaryTotals.apronTeamSalary === null ||
    canonicalSalaryTotals.taxSalary === null
  ) {
    const taxBook = canonicalSalaryTotals.salaryBooks?.ledgers.taxSalary;
    const taxNeedsInputReason =
      canonicalSalaryTotals.taxSalary === null &&
      taxBook &&
      taxBook.status !== 'complete'
        ? taxBook.reason
        : null;
    violations.push({
      rule: 'salary_book_needs_input',
      message:
        taxNeedsInputReason
          ? `Tax Salary needs input before this signing can be committed: ${taxNeedsInputReason}`
          : 'Signing legality needs complete Team Salary, Apron Team Salary, and Tax Salary books.',
      severity: 'error',
    });
  }
  if (!rules) {
    warnings.push({
      rule: 'cap_data',
      message: 'Cap data not available for this season',
      severity: 'warning',
    });
  }

  // 00. CHECK DATA CONFIDENCE (New Policy)
  // Blocks operations in STRICT mode if data is projected
  const confidenceCheck = evaluateDataConfidence(rules, 'Signing');
  if (confidenceCheck.blocked && confidenceCheck.violation) {
    violations.push(confidenceCheck.violation);
    // In strict mode block, we might typically stop here, but we can let other checks run
    // to show all errors. However, if data is unknown, other checks might crash.
    // For safety, if it's unknown/missing, we should probably stop or rely on safe math defaults.
  }
  if (confidenceCheck.warning) {
    warnings.push(confidenceCheck.warning);
  }

  // 0. CHECK CANONICAL EXCEPTION OWNER AVAILABILITY
  const exceptionOwnerCheck = validateCanonicalSigningExceptionAvailability({
    team,
    contract,
    signedUsing,
  });
  if (exceptionOwnerCheck.blocked && exceptionOwnerCheck.violation) {
    violations.push(exceptionOwnerCheck.violation);
  }

  // 0.1. CHECK EXCEPTION ELIGIBILITY (G0-2: Post-apron exception blocking)
  // This is a HARD BLOCK - if an exception is blocked by apron status, the signing cannot proceed.
  const exceptionCheck = validateExceptionEligibility({
    team,
    signedUsing,
    year,
    asOfDate: asOfDate ?? null,
  });
  if (exceptionCheck.blocked && exceptionCheck.violation) {
    violations.push(exceptionCheck.violation);
  }

  // 0.5. PHASE 5: CONTRACT ROW SCHEMA VALIDATION
  // Validates salary rows for schema correctness, guarantees, and options.
  // Two-way contracts are also validated (schema issues can affect any contract type).
  const contractRowsResult = validateContractRows(contract);
  if (contractRowsResult.violations.length > 0) {
    violations.push(...contractRowsResult.violations);
  }
  if (contractRowsResult.warnings.length > 0) {
    warnings.push(...contractRowsResult.warnings);
  }

  // 0.6. PHASE 7: FREE AGENCY STATE VALIDATION
  // Validates freeAgency object (if present) for canonical invariants.
  // Blocks legacy string format at persist time; warns on RFA/UFA inconsistencies.
  if (contract?.freeAgency !== undefined) {
    const faStateResult = validateFreeAgencyState(contract.freeAgency);
    if (faStateResult.violations.length > 0) {
      violations.push(...faStateResult.violations);
    }
    if (faStateResult.warnings.length > 0) {
      warnings.push(...faStateResult.warnings);
    }
  }

  // 0.7. PHASE 10/12: DIFFERENTIATED RFA GUARDRAILS + OFFER SHEET STUB
  // Home team RFA actions are allowed. Offer sheet attempts (non-home team) require
  // explicit flag and valid resolution state (Phase 12).
  // Unverifiable team identity is also blocked to prevent silent incorrect state.
  const playerFreeAgency = normalizeFreeAgency(
    player?.freeAgency || player?.contract?.freeAgency
  );
  if (playerFreeAgency?.type === 'RFA') {
    const normalizedSigningTeam = normalizeTeamRef(team);
    const normalizedPlayerTeam = normalizePlayerTeamRef(player);

    // Case 1: Cannot verify team identity - hard block
    if (normalizedSigningTeam === null || normalizedPlayerTeam === null) {
      violations.push({
        rule: 'rfa_team_identity_unverifiable',
        message:
          'Cannot verify RFA home team status. Team/player identity could not be normalized.',
        severity: 'error',
        playerName: player?.name || player?.displayName || player?.player_id,
        rawSigningTeamRef: team?.teamCode || team?.code || 'missing',
        rawPlayerTeamRef:
          player?.teamId ||
          player?.team_id ||
          player?.contract?.signingTeam ||
          'missing',
        freeAgency: {
          type: 'RFA',
          year: playerFreeAgency?.year,
          qualifyingOffer: playerFreeAgency?.qualifyingOffer,
        },
      });
    }
    // Case 2: Non-home team - PHASE 12 Offer Sheet Path
    else if (normalizedPlayerTeam !== normalizedSigningTeam) {
      // Phase 14: Check store-only invariants FIRST (before isOfferSheetAttempt check)
      // This catches misuse where rfaOfferSheetOnly=true but rfaOfferSheet is missing
      const storeOnlyInvariantResult = validateStoreOnlyInvariants({
        contract,
      });
      if (!storeOnlyInvariantResult.valid) {
        violations.push(...storeOnlyInvariantResult.violations);
        // Don't proceed with further offer sheet validation - invariants are broken
      }

      // Check if this is an explicit offer sheet attempt
      const isOfferSheetAttempt = contract?.rfaOfferSheet === true;

      if (!isOfferSheetAttempt) {
        // Only block with rfa_offer_sheet_not_supported if we didn't already block with store-only invalid
        if (storeOnlyInvariantResult.valid) {
          // No offer sheet flag - block with legacy rule
          violations.push({
            rule: 'rfa_offer_sheet_not_supported',
            message: `Signing RFA player from non-home team requires offer sheet flag. Set contract.rfaOfferSheet = true for ${normalizedPlayerTeam} player, signed by ${normalizedSigningTeam}.`,
            severity: 'error',
            playerName:
              player?.name || player?.displayName || player?.player_id,
            normalizedPlayerTeam,
            normalizedSigningTeam,
            freeAgency: {
              type: 'RFA',
              year: playerFreeAgency?.year,
              qualifyingOffer: playerFreeAgency?.qualifyingOffer,
            },
          });
        }
      } else {
        // PHASE 12/13: Offer sheet attempt with flag set
        // Validate offer sheet terms (years/raises)
        const offerSheetResult = validateOfferSheetTerms(contract);
        if (!offerSheetResult.valid) {
          violations.push(...offerSheetResult.violations);
        }

        // Phase 13: Finalization gate for PENDING_MATCH offer sheets
        // Determine status with default to PENDING_MATCH
        const status = contract?.rfaOfferSheetStatus || 'PENDING_MATCH';

        // Phase 13: Determine if this is a finalizing action
        const finalizing = isFinalizingSigning({ contract });

        // Case A: DECLINED status
        if (status === 'DECLINED') {
          // Phase 16: DECLINED status is allowed if finalizing (offering team signing the player)
          // It is BLOCKED if trying to store/update it again without finalizing
          if (!finalizing) {
            violations.push({
              rule: 'rfa_offer_sheet_declined',
              message: `Offer sheet has been declined. You must finalize it to sign the player, or leave it as is. Cannot update store-only state.`,
              severity: 'error',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              currentStatus: status,
              freeAgency: {
                type: 'RFA',
                year: playerFreeAgency?.year,
                qualifyingOffer: playerFreeAgency?.qualifyingOffer,
              },
            });
          }
          // Else: Finalizing a DECLINED offer sheet is VALID (Proceed to signFreeAgent)
        }
        // Case B: PENDING_MATCH status
        else if (status === 'PENDING_MATCH') {
          if (finalizing) {
            // Phase 13: Finalizing a PENDING_MATCH offer sheet is blocked
            violations.push({
              rule: 'rfa_offer_sheet_resolution_required',
              message: `Offer sheet cannot be finalized without resolution. Current status: "${status}". Must be "MATCHED" to complete signing. Set contract.rfaOfferSheetOnly = true to store without finalizing.`,
              severity: 'error',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              currentStatus: status,
              isFinalizingAttempt: true,
              freeAgency: {
                type: 'RFA',
                year: playerFreeAgency?.year,
                qualifyingOffer: playerFreeAgency?.qualifyingOffer,
              },
            });
          }
          // else: PENDING_MATCH + not finalizing = allowed (storing offer sheet)
          // Phase 14: Add informational warning when store-only mode is active (invariants already checked earlier)
          if (!finalizing && storeOnlyInvariantResult.valid) {
            // Valid store-only mode - add informational warning
            warnings.push({
              rule: 'rfa_offer_sheet_store_only_flag_in_use',
              message: `Store-only mode active: Offer sheet is being recorded but NOT finalized. Player will NOT be added to roster. Status: "${status}".`,
              severity: 'info',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              offerSheetStatus: status,
              storeOnlyFlag: true,
            });
          }
        }
        // Case C: MATCHED status - allowed for finalization
        // No block needed, proceed through normal signing validation
      }
    }
    // Case 3: Home team RFA action - allowed, continue through normal validation
    // No additional block here - QO and re-signing checks remain enforced.
  }

  // 0.8. PHASE 8/9: RE-SIGNING ELIGIBILITY CHECK
  // If this is a re-signing (using Bird rights), verify the player is eligible to be re-signed by this team.
  // Eligibility requires: (1) player was on this team (normalized team match) AND (2) birdRights not None/renounced
  // Phase 9: Uses canonical normalizers to avoid false-blocks from format mismatches (e.g., "NBA:LAL" vs "LAL")
  const signingTermsForEligibility = getSigningTermsForPlayer({
    team,
    player,
    contract,
    year,
    signedUsing,
  });
  const normalizedTerms = signingTermsForEligibility
    ? normalizeSigningTerms(signingTermsForEligibility, {
        fallbackMechanism: 'UNKNOWN',
      })
    : null;
  const rightsType = normalizedTerms?.rightsType;

  // Only check eligibility for Bird rights re-signings (FULL_BIRD, EARLY_BIRD, NON_BIRD)
  if (
    rightsType &&
    ['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD'].includes(rightsType)
  ) {
    // Phase 9: Use canonical normalizers for team identity
    const normalizedTeamCode = normalizeTeamRef(team);
    const normalizedPlayerTeam = normalizePlayerTeamRef(player);
    const contractBirdRights = normalizeBirdRights(
      player?.contract?.birdRights
    );
    const playerBirdRights = normalizeBirdRights(player?.birdRights);
    const birdRightsStatus =
      contractBirdRights?.status || playerBirdRights?.status;
    const rightsRenounced =
      contractBirdRights?.renounced === true ||
      playerBirdRights?.renounced === true;

    // Phase 9: Check if we can verify eligibility (both sides must be normalizable)
    const canVerifyTeamMatch =
      normalizedTeamCode !== null && normalizedPlayerTeam !== null;

    // Check 1: Player must belong to this team (normalized comparison)
    const hasTeamMatch =
      canVerifyTeamMatch && normalizedPlayerTeam === normalizedTeamCode;

    // Check 2: Bird rights must not be None, renounced, or explicitly rightsRenounced
    const hasValidRights =
      birdRightsStatus &&
      birdRightsStatus.toLowerCase() !== 'none' &&
      birdRightsStatus.toLowerCase() !== 'renounced' &&
      !rightsRenounced;

    // Phase 9: If we cannot verify eligibility, add warning instead of hard-blocking
    if (!canVerifyTeamMatch) {
      const rawPlayerTeamId =
        player?.teamId || player?.team_id || player?.contract?.signingTeam;
      const rawTeamCode = team?.teamCode || team?.code;
      warnings.push({
        rule: 'resigning_eligibility_unverifiable',
        message: `Cannot verify re-signing eligibility: team identity could not be normalized. Team ref: "${rawTeamCode || 'missing'}", Player team ref: "${rawPlayerTeamId || 'missing'}".`,
        severity: 'warning',
        playerName: player?.name || player?.displayName || player?.player_id,
        rightsType,
        rawTeamCode,
        rawPlayerTeamId: rawPlayerTeamId || null,
      });
    } else if (!hasTeamMatch || !hasValidRights) {
      // If we CAN verify and it fails, hard-block
      const reason = !hasTeamMatch
        ? `Player's team (${normalizedPlayerTeam}) does not match signing team (${normalizedTeamCode}).`
        : rightsRenounced
          ? `Player's Bird rights have been explicitly renounced.`
          : `Player's Bird rights status is "${birdRightsStatus || 'None'}".`;
      violations.push({
        rule: 'resigning_ineligible',
        message: `Cannot re-sign player using ${rightsType.replace(/_/g, ' ')} rights. ${reason}`,
        severity: 'error',
        playerName: player?.name || player?.displayName || player?.player_id,
        rightsType,
        normalizedPlayerTeam,
        normalizedTeamCode,
        birdRightsStatus,
        rightsRenounced,
      });
    }
  }

  // 0.9. PHASE 19: CAP HOLD / CAP SPACE ENFORCEMENT
  // For cap-space signings (no exception, no Bird rights), the signing must fit
  // under the salary cap INCLUDING all cap holds. Re-signings replace their
  // player's cap hold with the new contract.
  // Only apply to standard contracts (not two-way).
  const isTwoWayContract = getNormalizedContractType(contract) === 'two-way';
  if (!isTwoWayContract && rules) {
    // Get signing mechanism and rights type for cap-space detection
    const capSpaceCheckMechanism = resolveSigningMechanism(
      contract,
      signedUsing
    );
    const capSpaceCheckTerms = getSigningTermsForPlayer({
      team,
      player,
      contract,
      year,
      signedUsing,
    });
    const normalizedCapSpaceTerms = capSpaceCheckTerms
      ? normalizeSigningTerms(capSpaceCheckTerms, {
          fallbackMechanism: capSpaceCheckMechanism,
        })
      : null;
    const capSpaceCheckRightsType = normalizedCapSpaceTerms?.rightsType;

    // Only enforce for cap-space signings (no exception, no Bird rights)
    if (isCapSpaceSigning(capSpaceCheckMechanism, capSpaceCheckRightsType)) {
      // Get the current named salary books (Team Salary includes cap holds).
      const teamTotals = canonicalSalaryTotals;
      const currentCapAllocations = teamTotals.teamSalary ?? Number.NaN;
      const salaryCap = toFiniteNumber(
        teamTotals.salaryCap ?? rules.cap.salaryCap,
        0
      );

      // Get the first-year cap hit for the new contract
      const newContractCapHit = toFiniteNumber(
        contract?.salariesByYear?.[0]?.capHit ??
          contract?.salariesByYear?.[0]?.salary,
        0
      );

      // Check if this player has an existing cap hold that will be replaced
      const playerId = getPlayerId(player as Parameters<typeof getPlayerId>[0]);
      const existingCapHold = Array.isArray(team.capHolds)
        ? team.capHolds.find(
            (h: MutationCapHold) =>
              h.playerId === playerId &&
              h.active !== false &&
              h.isSigned !== true
          )
        : null;
      const capHoldReplacement = existingCapHold?.amount || 0;

      // Calculate projected cap allocations:
      // - Start with current (includes all cap holds)
      // - Subtract the cap hold being replaced (if any)
      // - Add the new contract's cap hit
      const projectedCapAllocations =
        currentCapAllocations - capHoldReplacement + newContractCapHit;

      // If projected exceeds salary cap, hard-block the signing
      if (projectedCapAllocations > salaryCap) {
        const overCapAmount = projectedCapAllocations - salaryCap;
        violations.push({
          rule: 'cap_hold_signing_violation',
          message:
            `Cap-space signing would exceed salary cap. Current allocations: $${(currentCapAllocations / 1_000_000).toFixed(2)}M, ` +
            `New contract: $${(newContractCapHit / 1_000_000).toFixed(2)}M` +
            (capHoldReplacement > 0
              ? `, Cap hold replaced: $${(capHoldReplacement / 1_000_000).toFixed(2)}M`
              : '') +
            `. Projected: $${(projectedCapAllocations / 1_000_000).toFixed(2)}M, Cap: $${(salaryCap / 1_000_000).toFixed(2)}M. ` +
            `Over by: $${(overCapAmount / 1_000_000).toFixed(2)}M.`,
          severity: 'error',
          details: {
            currentCapAllocations,
            newContractCapHit,
            capHoldReplacement,
            projectedCapAllocations,
            salaryCap,
            overCapAmount,
            capHoldsTotal: teamTotals.capHoldsTotal,
          },
        });
      }

      // Optional: Check if renouncing specific cap holds would make it fit
      // and emit a warning if so (cap_hold_renounce_required)
      if (projectedCapAllocations > salaryCap && teamTotals.capHoldsTotal > 0) {
        const spaceNeeded = projectedCapAllocations - salaryCap;
        const capHoldsExcludingPlayer = (team.capHolds || [])
          .filter(
            (h: MutationCapHold) =>
              h.playerId !== playerId &&
              h.active !== false &&
              h.isSigned !== true
          )
          .map((h: MutationCapHold) => ({
            playerId: h.playerId,
            playerName: h.playerName,
            amount: (h.amount as number) || 0,
          }))
          .sort(
            (a: { amount: number }, b: { amount: number }) =>
              b.amount - a.amount
          ); // Sort by largest first

        // Check if renouncing some holds would free enough space
        let accumulatedSavings = 0;
        const holdsToRenounce = [];
        for (const hold of capHoldsExcludingPlayer) {
          if (accumulatedSavings >= spaceNeeded) break;
          accumulatedSavings += hold.amount;
          holdsToRenounce.push(hold);
        }

        if (accumulatedSavings >= spaceNeeded && holdsToRenounce.length > 0) {
          const holdNames = holdsToRenounce
            .map((h) => h.playerName || h.playerId)
            .join(', ');
          const holdAmount = holdsToRenounce.reduce(
            (sum, h) => sum + h.amount,
            0
          );
          warnings.push({
            rule: 'cap_hold_renounce_required',
            message:
              `This signing would fit if you renounce cap holds for: ${holdNames} ` +
              `(freeing $${(holdAmount / 1_000_000).toFixed(2)}M).`,
            severity: 'warning',
            details: {
              spaceNeeded,
              holdsToRenounce,
              holdAmount,
            },
          });
        }
      }
    }
  }

  const players = team.players || [];

  // 1. Roster size check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = getNormalizedContractType(contract) === 'two-way';
  const signingMechanism = resolveSigningMechanism(contract, signedUsing);
  const signingContractYears = getContractYears(contract);
  const signingYearsOfService = getMutationYearsOfService(player);
  const signingPlayerBio = asRecordLike(player?.bio);
  const signingPlayerAge = toFiniteNumber(
    signingPlayerBio?.age ?? player?.age,
    0
  );
  const signingPlayerHasDraftYear = signingPlayerBio?.draftYear != null;
  const isSigningYosUnreliable =
    signingYearsOfService === 0 &&
    !signingPlayerHasDraftYear &&
    signingPlayerAge >= 25;
  const minimumReimbursementApplies =
    signingMechanism === 'MINIMUM' &&
    signingContractYears === 1 &&
    !isSigningYosUnreliable &&
    signingYearsOfService >= 3;
  const minimumTeamCharge =
    !isSigningYosUnreliable
      ? rules.salaries.getMinimumForYOS(
          minimumReimbursementApplies ? 2 : signingYearsOfService
        )
      : null;
  if (signingMechanism === 'MINIMUM' && isSigningYosUnreliable) {
    warnings.push({
      rule: 'minimum_reimbursement_yos_unverified',
      message: `YOS=0 for player age ${signingPlayerAge}. Minimum reimbursement eligibility needs verified service time.`,
      severity: 'warning',
      details: {
        yearsOfService: signingYearsOfService,
        age: signingPlayerAge,
        hasDraftYear: signingPlayerHasDraftYear,
      },
    });
  }
  const signingTerms = !isTwoWay
    ? getSigningTermsForPlayer({ team, player, contract, year, signedUsing })
    : null;
  const engineSigningTerms =
    signingTerms?.source === 'salary_engine' ? signingTerms : null;
  const normalizedPrimarySigningTerms = signingTerms
    ? normalizeSigningTerms(signingTerms, {
        fallbackMechanism: signingMechanism,
      })
    : null;
  const isBirdRightsResigning =
    !!normalizedPrimarySigningTerms?.rightsType &&
    ['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD'].includes(
      normalizedPrimarySigningTerms.rightsType
    );
  const hasEngineMaxYears = engineSigningTerms?.maxYears != null;

  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster + 1;
    if (projectedRoster > rules.roster.maxStandard) {
      violations.push({
        rule: 'roster_size',
        message: `Signing would exceed ${rules.roster.maxStandard}-player roster limit (currently ${currentStandardRoster})`,
        severity: 'error',
      });
    }
  } else {
    // Two-way contract check
    const currentTwoWay = countTwoWayContracts(players);
    if (currentTwoWay >= rules.roster.maxTwoWay) {
      violations.push({
        rule: 'two_way_limit',
        message: `Team already has ${rules.roster.maxTwoWay} two-way contracts`,
        severity: 'error',
      });
    }
  }

  // 1.5. Minimum salary check (PHASE 1 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate salary rules not governed by YOS scale
  if (!isTwoWay && rules) {
    const firstYearSalary = toFiniteNumber(
      contract?.salariesByYear?.[0]?.salary,
      Number.NaN
    );
    const firstYearCapHit = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit,
      Number.NaN
    );

    if (Number.isFinite(firstYearSalary)) {
      // Get player's years of service - defaults to 0 (rookie) if not found
      const yos = getMutationYearsOfService(player);
      const minSalary = rules.salaries.getMinimumForYOS(yos);

      // Check if first-year salary is below minimum
      if (firstYearSalary < minSalary) {
        violations.push({
          rule: 'min_salary_violation',
          message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) is below CBA minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service`,
          severity: 'error',
        });
      }

      // If capHit exists and differs from salary, validate capHit separately
      // Cap charge also cannot be below minimum (prevents cap manipulation)
      if (
        Number.isFinite(firstYearCapHit) &&
        firstYearCapHit !== firstYearSalary &&
        minimumTeamCharge !== null
      ) {
        if (firstYearCapHit < minimumTeamCharge) {
          violations.push({
            rule: 'min_salary_violation',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) is below the governed Team Salary charge ($${(minimumTeamCharge / 1_000_000).toFixed(2)}M).`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 1.5.5 PHASE 11: ROOKIE SCALE ENFORCEMENT
  // Enforces 80%-120% band for first-round picks derived from authoritative 100% scale table.
  if (!isTwoWay) {
    // Detect rookie scale signing context
    // We look for draftPick metadata on contract (preferred) or player
    const pickNumber = getDraftPickNumber(
      contract?.draftPick ?? player?.draftPick
    );

    // Only enforce if we successfully resolved a 1st Round Pick (1-30)
    // and we have a valid season key to lookup scale data.
    const seasonKey = normalizeSeasonKey(year);

    if (pickNumber !== null && pickNumber >= 1 && pickNumber <= 30 && seasonKey) {
      const scaleAmount = getRookieScaleAmount({ seasonKey, pick: pickNumber });

      // If we have authoritative scale data for this season/pick
      if (scaleAmount) {
        const firstYearSalary = contract?.salariesByYear?.[0]?.salary;
        const firstYearCapHit = contract?.salariesByYear?.[0]?.capHit; // Optional, defaults to salary if undefined

        // Calculate bounds (floored/ceiled for safety, plus tolerance check)
        const minAllowed = Math.floor(scaleAmount * ROOKIE_SCALE_MIN_PCT);
        const maxAllowed = Math.ceil(scaleAmount * ROOKIE_SCALE_MAX_PCT);

        // Helper to check value against bounds
        const checkBounds = (val: number, label: string) => {
          if (
            val < minAllowed - ROOKIE_SCALE_TOLERANCE ||
            val > maxAllowed + ROOKIE_SCALE_TOLERANCE
          ) {
            violations.push({
              rule: 'rookie_scale_invalid',
              message: `Rookie scale ${label} ($${(val / 1_000_000).toFixed(3)}M) for pick #${pickNumber} must be between 80% ($${(minAllowed / 1_000_000).toFixed(3)}M) and 120% ($${(maxAllowed / 1_000_000).toFixed(3)}M) of scale amount ($${(scaleAmount / 1_000_000).toFixed(3)}M).`,
              severity: 'error',
              details: {
                pickNumber,
                scaleAmount,
                val,
                minAllowed,
                maxAllowed,
                seasonKey,
              },
            });
          }
        };

        if (typeof firstYearSalary === 'number') {
          checkBounds(firstYearSalary, 'salary');
        }

        // ALSO check Cap Hit if explicit
        // Rookie scale Cap Hit is usually equal to Salary, but if different it must also be legal?
        // Actually, for Rookie Scale, Cap Hit = Salary typically.
        // But if they diverge, the CBA rule is on the "Salary".
        // However, we should ensure consistency or at least warn if capHit is wild?
        // The Prompt asked: "compare against first-year salary (and capHit if differs) using tolerance"
        if (
          typeof firstYearCapHit === 'number' &&
          firstYearCapHit !== firstYearSalary
        ) {
          checkBounds(firstYearCapHit, 'cap hit');
        }
      }
    }
  }

  // 1.6. Contract years validation (PHASE 2 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate term rules
  if (!isTwoWay) {
    const contractYears = getContractYears(contract);

    const termsValidation = validateSigningTermsAndRaises({
      contract,
      signingTerms: engineSigningTerms,
      mechanism: signingMechanism,
    });
    violations.push(...termsValidation.violations);

    // Only validate if we can determine contract length
    if (contractYears > 0) {
      if (!hasEngineMaxYears) {
        const limits = getSigningYearsLimits(signingMechanism);

        // Only enforce limits for known mechanisms
        // UNKNOWN mechanism means we can't determine how the contract was signed,
        // so we skip years validation (other rules like min salary still apply)
        if (limits) {
          if (contractYears < limits.minYears) {
            violations.push({
              rule: 'contract_years_invalid',
              message: `Contract length (${contractYears} year${contractYears === 1 ? '' : 's'}) is below minimum (${limits.minYears}) for ${signingMechanism.replace(/_/g, ' ')} signing`,
              severity: 'error',
            });
          } else if (contractYears > limits.maxYears) {
            violations.push({
              rule: 'contract_years_invalid',
              message: `Contract length (${contractYears} years) exceeds maximum (${limits.maxYears}) for ${signingMechanism.replace(/_/g, ' ')} signing`,
              severity: 'error',
            });
          }
        }
      }
    }
  }

  // 1.7. First-year max enforcement (PHASE 2.5 - CBA Contract Rules)
  // Validates first-year salary/capHit against mechanism-specific caps
  // Two-way contracts are excluded - they follow separate salary rules
  if (!isTwoWay && rules) {
    const { salary: firstYearSalary, capHit: firstYearCapHit } =
      getFirstYearAmounts(contract);

    if (firstYearSalary !== null) {
      if (signingMechanism === 'MINIMUM') {
        // MINIMUM mechanism: salary must be EXACTLY at minimum (not above)
        // This enforces "minimum exception" means minimum salary, not just "at least minimum"
        const yos = getMutationYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);

        if (!isSigningYosUnreliable && firstYearSalary > minSalary) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds minimum salary ($${(minSalary / 1_000_000).toFixed(2)}M) for MINIMUM signing. Use a different exception.`,
            severity: 'error',
          });
        }

        // Also check capHit if it differs from salary
        if (
          firstYearCapHit !== null &&
          minimumTeamCharge !== null &&
          firstYearCapHit !== minimumTeamCharge
        ) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) must equal the governed Team Salary charge ($${(minimumTeamCharge / 1_000_000).toFixed(2)}M) for this MINIMUM signing.`,
            severity: 'error',
          });
        }
      } else {
        // For FULL_MLE, TPMLE, ROOM_MLE, BAE: enforce exception amount cap
        // UNKNOWN mechanism: do not enforce (cannot determine limits)
        const maxFirstYear = getSigningFirstYearMax(signingMechanism, rules);

        if (maxFirstYear !== null) {
          if (firstYearSalary > maxFirstYear) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds ${signingMechanism.replace(/_/g, ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }

          // Also check capHit if it differs from salary
          if (
            firstYearCapHit !== null &&
            firstYearCapHit !== firstYearSalary &&
            firstYearCapHit > maxFirstYear
          ) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds ${signingMechanism.replace(/_/g, ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }
        }
      }

      // Phase 6: Engine first-year max enforcement with proper mechanism/rightsType
      if (
        engineSigningTerms?.maxFirstYearSalary != null &&
        signingMechanism !== 'MINIMUM'
      ) {
        // Normalize terms to get proper mechanism/rightsType separation
        const normalizedEngineTerms = normalizeSigningTerms(
          engineSigningTerms,
          {
            fallbackMechanism: signingMechanism,
          }
        );
        const engineMaxFirstYear = normalizedEngineTerms.maxFirstYearSalary;

        // Phase 6: Build descriptive label using both mechanism and rightsType
        const mechanismLabel =
          normalizedEngineTerms.mechanism &&
          normalizedEngineTerms.mechanism !== 'UNKNOWN'
            ? normalizedEngineTerms.mechanism.replace(/_/g, ' ')
            : null;
        const rightsLabel =
          normalizedEngineTerms.rightsType &&
          normalizedEngineTerms.rightsType !== 'NONE'
            ? normalizedEngineTerms.rightsType.replace(/_/g, ' ')
            : null;
        const primaryLabel = mechanismLabel || rightsLabel || 'signing terms';
        const secondaryLabel =
          mechanismLabel && rightsLabel ? ` (${rightsLabel})` : '';

        if (
          engineMaxFirstYear != null &&
          firstYearSalary > engineMaxFirstYear
        ) {
          violations.push({
            rule: 'signing_first_year_engine_max_invalid',
            message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds Salary Engine max ($${(engineMaxFirstYear / 1_000_000).toFixed(2)}M) for ${primaryLabel}${secondaryLabel}`,
            severity: 'error',
            // Phase 6: Include both mechanism and rightsType in payload
            mechanism: normalizedEngineTerms.mechanism,
            rightsType: normalizedEngineTerms.rightsType,
            engineMaxFirstYearSalary: engineMaxFirstYear,
          });
        }

        if (
          engineMaxFirstYear != null &&
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          firstYearCapHit > engineMaxFirstYear
        ) {
          violations.push({
            rule: 'signing_first_year_engine_max_invalid',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds Salary Engine max ($${(engineMaxFirstYear / 1_000_000).toFixed(2)}M) for ${primaryLabel}${secondaryLabel}`,
            severity: 'error',
            // Phase 6: Include both mechanism and rightsType in payload
            mechanism: normalizedEngineTerms.mechanism,
            rightsType: normalizedEngineTerms.rightsType,
            engineMaxFirstYearSalary: engineMaxFirstYear,
          });
        }
      }
    }
  }

  // 1.7.5 PHASE 31: MAX SALARY ENFORCEMENT
  // Enforces max contract salary (25%/30%/35% of cap based on YOS)
  // Two-way and minimum signings are exempt
  // Uses Salary Engine max when available, fallback to YOS tier calculation
  if (!isTwoWay && signingMechanism !== 'MINIMUM' && rules) {
    const { salary: firstYearSalary } = getFirstYearAmounts(contract);

    if (firstYearSalary !== null) {
      const yos = signingYearsOfService;
      const playerAge = signingPlayerAge;
      const hasDraftYear = signingPlayerHasDraftYear;

      // Phase 31 Safety Net: Detect unreliable YOS data
      // YOS=0 + no draftYear + age>=25 = likely missing data for veteran
      const isYOSUnreliable = isSigningYosUnreliable;

      if (isYOSUnreliable) {
        // Emit warning about unreliable YOS data
        warnings.push({
          rule: 'max_salary_yos_unverified',
          message: `YOS=0 for player age ${playerAge}. Cannot verify max tier. Using conservative 35% max to avoid false blocks.`,
          severity: 'warning',
          details: {
            yearsOfService: yos,
            age: playerAge,
            hasDraftYear,
          },
        });
      }

      // Determine max salary amount
      let maxSalaryAmount = null;
      let maxSalarySource = null;

      // Priority 1: Use Salary Engine computed max if available
      if (engineSigningTerms?.source === 'salary_engine') {
        // Check if this is a Bird rights signing (use Bird max) or cap space (standard max)
        const isBirdSigning =
          engineSigningTerms.rightsType &&
          engineSigningTerms.rightsType !== 'CAP_SPACE' &&
          engineSigningTerms.rightsType !== 'NONE';

        if (isBirdSigning && engineSigningTerms.maxFirstYearSalary != null) {
          // Bird rights: use engine's Bird max (includes 105% prior salary consideration)
          maxSalaryAmount = engineSigningTerms.maxFirstYearSalary;
          maxSalarySource = 'salary_engine_bird';
        }
      }

      // Priority 2: Fallback to YOS tier calculation
      if (maxSalaryAmount == null) {
        const capAmount = rules.cap.salaryCap;

        // Determine tier percentage based on YOS
        // Use conservative 35% if YOS data is unreliable (prevents false blocks)
        let tierPercent;
        if (isYOSUnreliable) {
          tierPercent = 0.35; // Conservative max to avoid false blocks
        } else if (yos >= 10) {
          tierPercent = 0.35; // 10+ years
        } else if (yos >= 7) {
          tierPercent = 0.3; // 7-9 years
        } else {
          tierPercent = 0.25; // 0-6 years
        }

        maxSalaryAmount = Math.round(capAmount * tierPercent);
        maxSalarySource = isYOSUnreliable
          ? 'yos_tier_conservative'
          : 'yos_tier_fallback';
      }

      // Enforce max salary check
      if (maxSalaryAmount != null && firstYearSalary > maxSalaryAmount) {
        violations.push({
          rule: 'max_salary_violation',
          message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds player max ($${(maxSalaryAmount / 1_000_000).toFixed(2)}M) based on ${(maxSalarySource || 'UNKNOWN_SOURCE').replace(/_/g, ' ')}`,
          severity: 'error',
          details: {
            firstYearSalary,
            maxSalaryAmount,
            maxSalarySource,
            yearsOfService: yos,
            tierPercent: isYOSUnreliable
              ? 0.35
              : yos >= 10
                ? 0.35
                : yos >= 7
                  ? 0.3
                  : 0.25,
          },
        });
      }
    }
  }

  // 1.8. Second apron minimum-only enforcement (PHASE 2.5 - CBA Contract Rules)
  // Teams above second apron can only add outside free agents on minimum salary
  // contracts. Verified Bird-rights re-signings are exempt because the team is
  // retaining its own player through rights, not adding an outside FA.
  // Two-way contracts are excluded - they don't count against standard cap
  // PHASE 2.5 PATCH: Use capHit (not salary) for projected cap calculation
  if (!isTwoWay && rules && !isBirdRightsResigning) {
    const currentCapHit = canonicalSalaryTotals.apronTeamSalary ?? Number.NaN;
    // Use capHit for projection (fallback to salary if capHit not set)
    const contractCapImpact = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit ??
        contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedCapHit = currentCapHit + contractCapImpact;

    // Check if the signing would put/keep team above second apron
    const isAboveSecondApron = projectedCapHit > rules.cap.secondApron;

    if (isAboveSecondApron) {
      const { salary: firstYearSalary, capHit: firstYearCapHit } =
        getFirstYearAmounts(contract);

      if (firstYearSalary !== null) {
        const yos = getMutationYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);

        // Block if salary is above minimum while team is at/above second apron
        if (!isSigningYosUnreliable && firstYearSalary > minSalary) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron ($${(projectedCapHit / 1_000_000).toFixed(1)}M). First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) must be at minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service.`,
            severity: 'error',
          });
        }

        // Also check capHit if it differs from salary
        if (
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          minimumTeamCharge !== null &&
          firstYearCapHit > minimumTeamCharge
        ) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron. First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) must not exceed the governed Team Salary charge ($${(minimumTeamCharge / 1_000_000).toFixed(2)}M).`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 2. Hard cap check
  if (rules) {
    const hardCapStatus = getValidationHardCapStatus(team, rules);
    const signingHardCapTrigger =
      getSigningHardCapTriggerMetadata(signingMechanism);
    const currentHardCapCapHit =
      canonicalSalaryTotals.apronTeamSalary ?? Number.NaN;
    const hardCapContractValue = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit ??
        contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedHardCapHit = currentHardCapCapHit + hardCapContractValue;

    let enforcedHardCapCeiling =
      hardCapStatus.isHardCapped && hardCapStatus.ceiling
        ? hardCapStatus.ceiling
        : null;
    let enforcedHardCapLevel = hardCapStatus.hardCapLevel;

    const triggerCeiling = toFiniteNumber(rules.cap.firstApron, 0);
    if (
      signingHardCapTrigger &&
      triggerCeiling > 0 &&
      (enforcedHardCapCeiling === null ||
        triggerCeiling < enforcedHardCapCeiling)
    ) {
      enforcedHardCapCeiling = triggerCeiling;
      enforcedHardCapLevel = signingHardCapTrigger.hardCapLevel;
    }

    if (
      enforcedHardCapCeiling !== null &&
      projectedHardCapHit > enforcedHardCapCeiling
    ) {
      violations.push({
        rule: 'hard_cap',
        message: `Signing would exceed ${enforcedHardCapLevel === 'secondApron' ? 'second apron' : 'first apron'} hard cap ceiling`,
        severity: 'error',
      });
    }

    // 3. MLE triggers hard cap warning
    if (
      signedUsing?.toLowerCase() === 'mle' ||
      signedUsing?.toLowerCase() === 'full mle'
    ) {
      const currentCapHit = canonicalSalaryTotals.taxSalary ?? Number.NaN;
      if (currentCapHit > rules.cap.luxuryTax) {
        warnings.push({
          rule: 'mle_taxpayer',
          message:
            'Using MLE while over luxury tax will hard cap team at first apron',
          severity: 'warning',
        });
      }
    }

    // 4. Apron proximity warnings
    const currentCapHit =
      canonicalSalaryTotals.apronTeamSalary ?? Number.NaN;
    const contractValue = toFiniteNumber(
      contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedCapHit = currentCapHit + contractValue;

    if (projectedCapHit > rules.cap.secondApron) {
      warnings.push({
        rule: 'second_apron',
        message:
          'Signing puts team over second apron - significant restrictions apply',
        severity: 'warning',
      });
    } else if (projectedCapHit > rules.cap.firstApron) {
      warnings.push({
        rule: 'first_apron',
        message: 'Signing puts team over first apron',
        severity: 'warning',
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
