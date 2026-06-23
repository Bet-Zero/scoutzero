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
  | 'pinnedPlayerIds'
  | 'onTogglePin'
  | 'manualCapSheetMutationAuthority'
  | 'exceptionsReadout'
  | 'onLaunchPlayerAction'
  | 'onPlayerAction'
  | 'onLaunchFreeAgentSearch'
  | 'standardFreeAgentLauncherExposureClassification'
  | 'standardWaiveExposureClassification'
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
  onPlayerAction = null,
  playersMap,
  getRulesProfileForYear,
  highlightPlayerId = null,
  highlightPlayerIds = [],
  pinnedPlayerIds = [],
  onTogglePin = null,
  manualCapSheetMutationAuthority = null,
  exceptionsReadout = null,
  onLaunchFreeAgentSearch = null,
  standardFreeAgentLauncherExposureClassification = 'preview-only',
  standardWaiveExposureClassification = 'preview-only',
  freeAgentOptions = [],
  onOpenFreeAgentOption = null,
  onRemoveFreeAgentOption = null,
}: CapTableSectionProps) => (
  <CapSheetFull
    teamCapSheet={teamCapSheet}
    currentYear={currentYear}
    playersMap={playersMap}
    onOpenPlayerContractModal={onOpenPlayerContractModal}
    onLaunchContractAction={onLaunchContractAction}
    onRenounceCapHold={onRenounceCapHold}
    onLaunchPlayerAction={onLaunchPlayerAction}
    onPlayerAction={onPlayerAction}
    getRulesProfileForYear={getRulesProfileForYear}
    highlightPlayerId={highlightPlayerId}
    highlightPlayerIds={highlightPlayerIds}
    pinnedPlayerIds={pinnedPlayerIds}
    onTogglePin={onTogglePin}
    manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
    exceptionsReadout={exceptionsReadout}
    onLaunchFreeAgentSearch={onLaunchFreeAgentSearch}
    standardFreeAgentLauncherExposureClassification={
      standardFreeAgentLauncherExposureClassification
    }
    standardWaiveExposureClassification={standardWaiveExposureClassification}
    freeAgentOptions={freeAgentOptions}
    onOpenFreeAgentOption={onOpenFreeAgentOption}
    onRemoveFreeAgentOption={onRemoveFreeAgentOption}
  />
);

export { CapTableSection };
