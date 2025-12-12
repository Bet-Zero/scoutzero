import CapSheetFull from '../../CapSheetFull';

const CapTableSection = ({
  teamCapSheet,
  currentYear,
  onSelectPlayer,
  onActionClick,
  playersMap,
  getRulesProfileForYear,
}) => (
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
