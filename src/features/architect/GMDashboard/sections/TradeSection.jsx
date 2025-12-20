import TradeEditor from '@/features/architect/tradeMachine/TradeEditor';

const TradeSection = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap,
  onApplyTrade,
  primaryTeamData,
  onEditContract,
  worldId = null, // World ID for world-aware team loading
}) => (
  <TradeEditor
    primaryTeam={primaryTeam}
    capProjections={capProjections}
    currentYear={currentYear}
    playersMap={playersMap}
    onApplyTrade={onApplyTrade}
    primaryTeamData={primaryTeamData}
    onEditContract={onEditContract}
    worldId={worldId}
  />
);

export { TradeSection };
