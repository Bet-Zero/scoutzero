import CapSheetFull from '../../CapSheetFull';

type CapTableSectionProps = {
  teamCapSheet: Record<string, unknown> | null | undefined;
  currentYear: number;
  onSelectPlayer?: (...args: any[]) => any;
  onActionClick?: (...args: any[]) => any;
  playersMap?: Record<string, unknown>;
  getRulesProfileForYear?: (...args: any[]) => any;
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
