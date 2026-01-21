import CapSheet from '@/features/architect/CapSheet';
import ExceptionTracker from '@/features/architect/ExceptionTracker';

const CapSheetSection = ({
  teamCapSheet,
  currentYear,
  onSelectPlayer,
  onSetDeadCap,
  onSetExceptions,
  playersMap,
}) => {
  if (!teamCapSheet?.players) {
    return <div className="text-white/80 mt-4">Loading cap sheet...</div>;
  }

  return (
    <>
      <CapSheet
        teamCapSheet={teamCapSheet}
        currentYear={currentYear}
        onSelectPlayer={onSelectPlayer}
        onSetDeadCap={onSetDeadCap}
        onSetExceptions={onSetExceptions}
        playersMap={playersMap}
      />
      <ExceptionTracker teamCapSheet={teamCapSheet} currentYear={currentYear} />
    </>
  );
};

export { CapSheetSection };
