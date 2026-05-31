import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';

type ForwardedCapTableProps = Pick<
  Parameters<typeof CapSheetFull>[0],
  | 'teamCapSheet'
  | 'onOpenPlayerContractModal'
  | 'onLaunchContractAction'
  | 'onRenounceCapHold'
  | 'getRulesProfileForYear'
  | 'highlightPlayerId'
  | 'highlightPlayerIds'
  | 'manualCapSheetMutationAuthority'
  | 'exceptionsReadout'
  | 'onLaunchPlayerAction'
  | 'onLaunchFreeAgentSearch'
  | 'freeAgentOptions'
  | 'onOpenFreeAgentOption'
  | 'onRemoveFreeAgentOption'
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
  onLaunchPlayerAction = null,
  playersMap,
  getRulesProfileForYear,
  highlightPlayerId = null,
  highlightPlayerIds = [],
  manualCapSheetMutationAuthority = null,
  exceptionsReadout = null,
  onLaunchFreeAgentSearch = null,
  freeAgentOptions = [],
  onOpenFreeAgentOption = null,
  onRemoveFreeAgentOption = null,
}: CapTableSectionProps) => (
  <CapSheetFull
    teamCapSheet={teamCapSheet}
    currentYear={currentYear}
    onOpenPlayerContractModal={onOpenPlayerContractModal}
    onLaunchContractAction={onLaunchContractAction}
    onRenounceCapHold={onRenounceCapHold}
    onLaunchPlayerAction={onLaunchPlayerAction}
    getRulesProfileForYear={getRulesProfileForYear}
    highlightPlayerId={highlightPlayerId}
    highlightPlayerIds={highlightPlayerIds}
    manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
    exceptionsReadout={exceptionsReadout}
    onLaunchFreeAgentSearch={onLaunchFreeAgentSearch}
    freeAgentOptions={freeAgentOptions}
    onOpenFreeAgentOption={onOpenFreeAgentOption}
    onRemoveFreeAgentOption={onRemoveFreeAgentOption}
  />
);

export { CapTableSection };
