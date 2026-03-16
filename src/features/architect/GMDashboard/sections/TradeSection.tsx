import TradeEditor from '@/features/architect/tradeMachine/TradeEditor';

type TradeSectionProps = {
  primaryTeam: string | null | undefined;
  capProjections: Record<string, unknown> | null | undefined;
  currentYear: number | null | undefined;
  playersMap?: Record<string, unknown>;
  onApplyTrade?: (...args: any[]) => any;
  primaryTeamData?: Record<string, unknown> | null;
  onEditContract?: (...args: any[]) => any;
  worldId?: string | null;
  worldAsOfDate?: string | Date | null;
  userId?: string | null;
};

const TradeSection = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap,
  onApplyTrade,
  primaryTeamData,
  onEditContract,
  worldId = null, // World ID for world-aware team loading
  worldAsOfDate = null,
  userId = null,
}: TradeSectionProps) => (
  <TradeEditor
    primaryTeam={primaryTeam}
    capProjections={capProjections}
    currentYear={currentYear}
    playersMap={playersMap}
    onApplyTrade={onApplyTrade}
    primaryTeamData={primaryTeamData}
    onEditContract={onEditContract}
    worldId={worldId}
    worldAsOfDate={worldAsOfDate}
    userId={userId}
  />
);

export { TradeSection };
