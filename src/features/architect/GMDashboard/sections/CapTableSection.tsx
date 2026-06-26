import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';

type ForwardedCapTableProps = Pick<
  Parameters<typeof CapSheetFull>[0],
  | 'teamCapSheet'
  | 'onOpenPlayerContractModal'
  | 'onLaunchContractAction'
  | 'onRenounceCapHold'
  | 'onSignAndTradeFreeAgent'
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
  | 'standardExtendExposureClassification'
  | 'standardWaiveExposureClassification'
  | 'standardWaiveStretchExposureClassification'
  | 'standardBuyoutExposureClassification'
  | 'optionDecisionExposureClassification'
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
  onSignAndTradeFreeAgent = null,
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
  standardExtendExposureClassification = 'preview-only',
  standardWaiveExposureClassification = 'preview-only',
  standardWaiveStretchExposureClassification = 'preview-only',
  standardBuyoutExposureClassification = 'preview-only',
  optionDecisionExposureClassification = 'preview-only',
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
    onSignAndTradeFreeAgent={onSignAndTradeFreeAgent}
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
    standardExtendExposureClassification={standardExtendExposureClassification}
    standardWaiveExposureClassification={standardWaiveExposureClassification}
    standardWaiveStretchExposureClassification={
      standardWaiveStretchExposureClassification
    }
    standardBuyoutExposureClassification={standardBuyoutExposureClassification}
    optionDecisionExposureClassification={optionDecisionExposureClassification}
    freeAgentOptions={freeAgentOptions}
    onOpenFreeAgentOption={onOpenFreeAgentOption}
    onRemoveFreeAgentOption={onRemoveFreeAgentOption}
  />
);

export { CapTableSection };
