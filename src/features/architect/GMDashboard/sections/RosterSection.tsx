/**
 * FILE: src/features/architect/GMDashboard/sections/RosterSection.jsx
 * PURPOSE: Render the GM dashboard roster section via RosterVisual.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Header added for documentation compliance (single-step task)
 *
 * LINKS:
 *  - Plan: n/a (single-step task)
 *  - Latest Chunk: n/a
 */
import RosterVisual from '@/features/architect/shared/RosterVisual';

type RosterSectionProps = {
  teamCapSheet: Record<string, unknown> | null | undefined;
  playersMap?: Record<string, unknown>;
  teamId?: string | null;
};

const RosterSection = ({ teamCapSheet, playersMap, teamId }: RosterSectionProps) => (
  <RosterVisual
    teamCapSheet={teamCapSheet}
    playersMap={playersMap as Record<string, Record<string, unknown>> | undefined}
    teamId={teamId}
  />
);

export { RosterSection };
