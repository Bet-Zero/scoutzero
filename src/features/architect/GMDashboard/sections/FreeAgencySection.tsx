/**
 * FILE: src/features/architect/GMDashboard/sections/FreeAgencySection.tsx
 * PURPOSE: Render the GM Dashboard free agency section that wires dashboard state into the FreeAgentPool view.
 * OWNERSHIP: Feature: architect/GMDashboard (free agency section)
 *
 * ARCHITECT OWNERSHIP:
 * - Wrapper-level handoff surface between dashboard action orchestration and Free Agency UI.
 * - Renders offer-sheet lifecycle lists from the published section-availability contract.
 * - Publishes only the modal/rendering action slice into FreeAgentPool.
 * - Does not own Free Agency mutation routing, world-only gating rules, or lifecycle persistence locally.
 *
 * HISTORY:
 *  - 2025-12-12: Created ad-hoc while adding required file header (no plan).
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E91.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENCY_OFFER_SHEET_SURFACE_E91_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import { FreeAgentPool } from '@/features/architect/freeAgency/FreeAgentPool';
import { OfferSheetList } from '@/features/architect/GMDashboard/components/OfferSheetList';
import type { FreeAgentPoolProps } from '@/features/architect/freeAgency/FreeAgentPool/types';

import type {
  FreeAgencySectionProps,
  OfferSheetLifecycleActionEvent,
  OfferSheetListProps,
} from '../offerSheetTypes';

type OfferSheetLifecycleActionOwner = NonNullable<
  FreeAgencySectionProps['actionOwner']['offerSheetSectionAvailability']['lifecycleActionOwner']
>;
type OfferSheetLifecycleActionHandler = NonNullable<
  OfferSheetListProps['onLifecycleAction']
>;
type OfferSheetFinalizeArg = Parameters<
  OfferSheetLifecycleActionOwner['finalizeOfferSheet']
>[0];
type FreeAgentPoolActionOwner = FreeAgentPoolProps['actionOwner'];

const FreeAgencySection = ({
  freeAgents,
  currentYear,
  actionOwner,
  playersMap,
  outgoingOfferSheets,
  incomingOfferSheets,
  onAfterSigningComplete,
  selectedPlayerKeys,
  onSelectedPlayerKeysChange,
  requestedOpenSelectionKey,
  onRequestedOpenSelectionHandled,
  onSelectedEntriesChange,
  onPlayerAction,
  pinnedPlayerIds,
  poolManagement,
}: FreeAgencySectionProps) => {
  const offerSheetSectionAvailability = actionOwner.offerSheetSectionAvailability;
  const offerSheetLifecycleActionOwner =
    offerSheetSectionAvailability.lifecycleActionOwner;
  const offerSheetLifecycleDisabledReason =
    offerSheetSectionAvailability.actionsDisabledReason || undefined;

  const wrappedSignFreeAgent: typeof actionOwner.dualPathSigning.signFreeAgent =
    async (playerObj, contract) => {
      const result = await actionOwner.dualPathSigning.signFreeAgent(playerObj, contract);
      if (result?.success) {
        onAfterSigningComplete?.();
      }
      return result;
    };

  const freeAgentPoolActionOwner = {
    dualPathSigning: { signFreeAgent: wrappedSignFreeAgent },
    freeAgentModalAvailability: actionOwner.freeAgentModalAvailability,
  } satisfies FreeAgentPoolActionOwner;
  const incomingOfferSheetSurface = {
    title: 'Incoming Offer Sheets',
    offerSheets: incomingOfferSheets,
    surfaceRole: 'incoming' as const,
  };
  const outgoingOfferSheetSurface = {
    title: 'My Offer Sheets',
    offerSheets: outgoingOfferSheets,
    surfaceRole: 'outgoing' as const,
  };

  const handleOfferSheetLifecycleAction: OfferSheetLifecycleActionHandler = ({
    action,
    offerSheet,
    surfaceRole,
  }: OfferSheetLifecycleActionEvent) => {
    switch (`${surfaceRole}:${action}`) {
      case 'incoming:match':
        offerSheetLifecycleActionOwner?.matchOfferSheet(
          offerSheet as OfferSheetFinalizeArg
        );
        return;
      case 'incoming:decline':
        offerSheetLifecycleActionOwner?.declineOfferSheet(
          offerSheet as OfferSheetFinalizeArg
        );
        return;
      case 'incoming:finalizeMatched':
      case 'outgoing:finalizeDeclined':
        offerSheetLifecycleActionOwner?.finalizeOfferSheet(
          offerSheet as OfferSheetFinalizeArg
        );
        return;
      default:
        return;
    }
  };

  const hasOfferSheets =
    (incomingOfferSheets?.length ?? 0) > 0 ||
    (outgoingOfferSheets?.length ?? 0) > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-4 py-3">
      {/*
        OFFER-SHEET SECTION CONTRACT: lifecycle actions are persist-only world
        mutations. This wrapper renders the published gating state and routes
        UI events into the lifecycle owner; it does not own those mutations.
      */}
      {hasOfferSheets &&
      offerSheetSectionAvailability.actionsDisabled &&
      offerSheetLifecycleDisabledReason ? (
        <p className="shrink-0 text-xs text-amber-400">
          {offerSheetLifecycleDisabledReason}
        </p>
      ) : null}

      {/* Offer-sheet surfaces stay pinned above the pool but never eat the
          room: they cap at ~1/4 of the viewport and scroll internally. */}
      {hasOfferSheets ? (
        <div className="max-h-[180px] shrink-0 space-y-2 overflow-y-auto">
          {/* Incoming Offers (Home Team View) */}
          <OfferSheetList
            {...incomingOfferSheetSurface}
            onLifecycleAction={handleOfferSheetLifecycleAction}
            actionsDisabled={offerSheetSectionAvailability.actionsDisabled}
            actionsDisabledReason={offerSheetLifecycleDisabledReason}
          />

          {/* Outgoing Offers (Offering Team View) */}
          <OfferSheetList
            {...outgoingOfferSheetSurface}
            onLifecycleAction={handleOfferSheetLifecycleAction}
            actionsDisabled={offerSheetSectionAvailability.actionsDisabled}
            actionsDisabledReason={offerSheetLifecycleDisabledReason}
          />
        </div>
      ) : null}

      {/* FREE-AGENT POOL CONTRACT: the pool only receives the modal/rendering
          slice of the broader Free Agency action contract. Offer-sheet
          lifecycle routing stays at the section/action-layer seam. */}
      <FreeAgentPool
        freeAgents={freeAgents as FreeAgentPoolProps['freeAgents']}
        currentYear={currentYear}
        actionOwner={freeAgentPoolActionOwner}
        playersMap={playersMap as FreeAgentPoolProps['playersMap']}
        selectedPlayerKeys={selectedPlayerKeys}
        onSelectedPlayerKeysChange={onSelectedPlayerKeysChange}
        requestedOpenSelectionKey={requestedOpenSelectionKey}
        onRequestedOpenSelectionHandled={onRequestedOpenSelectionHandled}
        onSelectedEntriesChange={onSelectedEntriesChange}
        onPlayerAction={onPlayerAction}
        pinnedPlayerIds={pinnedPlayerIds}
        poolManagement={poolManagement}
      />
    </div>
  );
};

export { FreeAgencySection };
