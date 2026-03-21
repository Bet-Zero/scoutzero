import CapSheetFull from '@/features/architect/capSheet/CapSheetFull';

type ForwardedCapTableProps = Pick<
  Parameters<typeof CapSheetFull>[0],
  'teamCapSheet' | 'onSelectPlayer' | 'onActionClick' | 'getRulesProfileForYear'
>;

type CapTableSectionProps = ForwardedCapTableProps & {
  currentYear: number;
  playersMap?: Record<string, unknown>;
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
    getRulesProfileForYear={getRulesProfileForYear}
  />
);

export { CapTableSection };
