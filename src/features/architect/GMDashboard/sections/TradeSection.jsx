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
  userId = null,
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
    userId={userId}
  />
);

export { TradeSection };
