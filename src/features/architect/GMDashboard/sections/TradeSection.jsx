import TradeEditor from '@/features/architect/tradeMachine/TradeEditor';

const TradeSection = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap,
  onApplyTrade,
  primaryTeamData,
  onEditContract,
}) => (
  <TradeEditor
    primaryTeam={primaryTeam}
    capProjections={capProjections}
    currentYear={currentYear}
    playersMap={playersMap}
    onApplyTrade={onApplyTrade}
    primaryTeamData={primaryTeamData}
    onEditContract={onEditContract}
  />
);

export { TradeSection };
