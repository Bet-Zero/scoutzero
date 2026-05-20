/**
 * FILE: src/features/architect/GMDashboard/sections/TradeSection.tsx
 * PURPOSE: Publish the dashboard shell's trade-surface handoff into TradeEditor.
 * OWNERSHIP: Feature: architect/GMDashboard (trade section)
 *
 * ARCHITECT OWNERSHIP:
 * - Wrapper-level handoff surface only.
 * - Forwards shell-selected team/year/world context into TradeEditor.
 * - Does not own committed apply/reload authority; onApplyTrade stays upstream.
 * - Does not reinterpret world/base mode truth locally; the action layer owns
 *   trade payload normalization plus world-vs-base branching.
 */
import { TradeEditor } from '@/features/architect/tradeMachine/TradeEditor';

type ForwardedTradeEditorProps = Pick<
  Parameters<typeof TradeEditor>[0],
  | 'primaryTeam'
  | 'capProjections'
  | 'currentYear'
  | 'playersMap'
  | 'onApplyTrade'
  | 'onAfterTradeApplied'
  | 'primaryTeamData'
  | 'onEditContract'
  | 'worldId'
  | 'worldAsOfDate'
  | 'userId'
>;

type TradeSectionProps = ForwardedTradeEditorProps;

const TradeSection = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap,
  onApplyTrade,
  onAfterTradeApplied,
  primaryTeamData,
  onEditContract,
  worldId = null, // World ID for world-aware team loading
  worldAsOfDate = null,
  userId = null,
}: TradeSectionProps) => {
  const tradeEditorSurfaceProps = {
    primaryTeam,
    capProjections,
    currentYear,
    playersMap,
    onApplyTrade,
    onAfterTradeApplied,
    primaryTeamData,
    onEditContract,
    worldId,
    worldAsOfDate,
    userId,
  } satisfies ForwardedTradeEditorProps;

  /* SECTION HANDOFF / FORWARDED TRADE SURFACE: TradeEditor owns local
     trade composition, validation, and preview UI. This wrapper only
     publishes shell context plus the upstream apply callback; it must not
     read like the committed trade authority or the place where mode
     branching/reload ownership lives. */
  return <TradeEditor {...tradeEditorSurfaceProps} />;
};

export { TradeSection };
