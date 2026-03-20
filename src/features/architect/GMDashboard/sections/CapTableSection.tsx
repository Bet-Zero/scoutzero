import type {
  PlayerRulesProfileInput,
  PlayerRulesProfilesResult,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';
import CapSheetFull from '@/features/architect/CapSheetFull';

type CapTableSectionProps = {
  teamCapSheet: PlayerRulesProfileTeamCapSheet | null | undefined;
  currentYear: number;
  onSelectPlayer?: ((player: PlayerRulesProfileInput) => unknown) | null;
  onActionClick?: (...args: any[]) => any;
  playersMap?: Record<string, unknown>;
  getRulesProfileForYear?: PlayerRulesProfilesResult['getProfileForYear'] | null;
};

const CapTableSection = ({
  teamCapSheet,
  currentYear,
  onSelectPlayer,
  onActionClick,
  playersMap,
  getRulesProfileForYear,
}: CapTableSectionProps) => (
  <CapSheetFull
    teamCapSheet={teamCapSheet}
    currentYear={currentYear}
    onSelectPlayer={onSelectPlayer}
    onActionClick={onActionClick}
    playersMap={playersMap}
    getRulesProfileForYear={getRulesProfileForYear}
  />
);

export { CapTableSection };
