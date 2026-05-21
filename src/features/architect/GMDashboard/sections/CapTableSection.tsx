import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';

type ForwardedCapTableProps = Pick<
  Parameters<typeof CapSheetFull>[0],
  | 'teamCapSheet'
  | 'onOpenPlayerContractModal'
  | 'onLaunchContractAction'
  | 'onRenounceCapHold'
  | 'getRulesProfileForYear'
  | 'highlightPlayerId'
>;

type CapTableSectionProps = ForwardedCapTableProps & {
  currentYear: number;
  playersMap?: Record<string, unknown>;
};

const CapTableSection = ({
  teamCapSheet,
  currentYear,
  onOpenPlayerContractModal,
  onLaunchContractAction,
  onRenounceCapHold,
  playersMap,
  getRulesProfileForYear,
  highlightPlayerId = null,
}: CapTableSectionProps) => (
  <CapSheetFull
    teamCapSheet={teamCapSheet}
    currentYear={currentYear}
    onOpenPlayerContractModal={onOpenPlayerContractModal}
    onLaunchContractAction={onLaunchContractAction}
    onRenounceCapHold={onRenounceCapHold}
    getRulesProfileForYear={getRulesProfileForYear}
    highlightPlayerId={highlightPlayerId}
  />
);

export { CapTableSection };
