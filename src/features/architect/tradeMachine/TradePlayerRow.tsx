import React, { useEffect, useMemo, useRef } from 'react';
import { PlayerNameMini } from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import { TeamLogo } from '@/shared/components/TeamLogo';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import { formatSalary } from '@/shared/utils/formatting';
import { getPlayerProfileUrl } from '@/shared/utils/routing/playerRouteUtils';
import { getSalaryWithFallback } from '@/features/architect/utils/contractSalaryUtils';
import { getYearsRemainingDisplay } from '@/features/architect/utils/contractUtils';
import { ArrowsRightLeftIcon } from '@heroicons/react/20/solid';
import { isSignAndTradeEligible } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';

type SignAndTradeEligibilityInput = Parameters<typeof isSignAndTradeEligible>[0];

type PlayerLike = {
  id?: string | number | null;
  player_id?: string | number | null;
  playerId?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  tradeTo?: string | number | null;
  teamCode?: string | null;
  teamAbbr?: string | null;
  teamId?: string | null;
  team?: string | null;
  originTeamId?: string | number | null;
  position?: string | null;
  height?: string | number | null;
  height_ft_in?: string | number | null;
  weight?: string | number | null;
  weight_lbs?: string | number | null;
  contract?:
    | {
        salariesByYear?: Array<Record<string, unknown>>;
        freeAgency?:
          | {
              year?: number | string | null;
            }
          | string
          | null;
      }
    | null;
  primaryContract?:
    | {
        salariesByYear?: Array<Record<string, unknown>>;
        freeAgency?:
          | {
              year?: number | string | null;
            }
          | string
          | null;
      }
    | null;
  futureContract?:
    | {
        salariesByYear?: Array<Record<string, unknown>>;
      }
    | null;
  contracts?: Record<string, Record<string, unknown>> | null;
  salariesByYear?: Array<Record<string, unknown>> | null;
  contractYears?: number | null;
  years?: number | null;
  firstYearGuaranteed?: boolean | null;
  freeAgentYear?: number | string | null;
  rightsRenounced?: boolean;
  signAndTrade?: boolean | { contract?: Record<string, unknown> | null };
  signAndTradeContract?: Record<string, unknown> | null;
  currentSalary?: number | string | null;
  salary?: number | string | null;
  newSalary?: number | string | null;
  isMinimum?: boolean;
  yearsOfService?: unknown;
  mockSalary?: number;
  bio?: {
    displayName?: string | null;
    playerId?: string | number | null;
    team?: string | null;
    display?: {
      team?: string | null;
      freeAgentYear?: number | string | null;
    };
    position?: string | null;
    height?: string | number | null;
    weight?: string | number | null;
  };
};

type TeamOptionLike = {
  id?: string;
  teamName?: string;
};

interface TradePlayerRowProps {
  player: PlayerLike;
  included: boolean;
  yearKey: string | number;
  incoming?: boolean;
  otherTeams?: TeamOptionLike[];
  playersMap?: Record<string, PlayerLike | Record<string, unknown>>;
  onSetPlayerTrade?: (...args: unknown[]) => void;
  onUndoPlayerTrade?: (...args: unknown[]) => void;
  openMenu?: string | null;
  setOpenMenu: (menuId: string | null) => void;
  setContractPlayer?: ((player: PlayerLike) => void) | null;
  signAndTradeActive?: boolean;
  sourceTeamId?: string | null;
  sourceTeamCapHolds?: SignAndTradeEligibilityInput['sourceTeamCapHolds'];
  worldId?: string | null;
  onRequestSignAndTrade?:
    | ((player: PlayerLike, teamId?: string) => void)
    | null;
  compact?: boolean;
}

export const TradePlayerRow = ({
  player,
  included,
  yearKey,
  incoming = false,
  otherTeams = [],
  playersMap = {},
  onSetPlayerTrade,
  onUndoPlayerTrade,
  openMenu = null,
  setOpenMenu,
  setContractPlayer,
  signAndTradeActive = false,
  sourceTeamId = null,
  sourceTeamCapHolds = [],
  worldId = null,
  onRequestSignAndTrade = null,
  compact = false,
}: TradePlayerRowProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // TMUI-08: stable menu identity (avoid name collisions / nameless rows)
  const menuId =
    String(player.id ?? player.player_id ?? player.name ?? '') || null;
  const details = (playersMap[String(player.name || '')] || {}) as PlayerLike;
  const team =
    player.tradeTo ||
    player.teamCode ||
    player.teamAbbr ||
    player.teamId ||
    player.team ||
    player.bio?.display?.team ||
    player.bio?.team ||
    details.teamCode ||
    details.teamAbbr ||
    details.teamId ||
    details.team ||
    details.bio?.display?.team ||
    details.bio?.team;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        openMenu === menuId &&
        !menuRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu, menuId, setOpenMenu]);

  const primaryContract =
    player.primaryContract ||
    (player.contracts ? Object.values(player.contracts)[0] : null) ||
    details.primaryContract ||
    (details.contracts ? Object.values(details.contracts)[0] : null);

  const year =
    typeof yearKey === 'number'
      ? yearKey
      : parseInt(String(yearKey).match(/\d{4}/)?.[0] || '', 10);
  const salary = getSalaryWithFallback(player, yearKey);
  const yearsLeft = getYearsRemainingDisplay({
    player,
    currentYear: year,
    primaryContract,
  });
  const position =
    getPlayerPositionLabel(
      player.bio?.position || player.position || details.bio?.position
    ) || '—';

  const signAndTradeEligibility = useMemo(
    () =>
      isSignAndTradeEligible({
        player,
        yearKey,
        sourceTeamId,
        worldId,
        sourceTeamCapHolds,
      }),
    [player, yearKey, sourceTeamId, worldId, sourceTeamCapHolds]
  );

  const canOfferSignAndTrade =
    Boolean(onRequestSignAndTrade) &&
    !incoming &&
    !included &&
    signAndTradeEligibility.eligible &&
    (!signAndTradeActive || player.signAndTrade);

  if (compact) {
    return (
      <div
        className={`w-full h-[40px] flex items-center border border-cockpit-edge rounded-sm pr-2 overflow-visible relative ${
          included
            ? 'bg-cockpit-safe/15'
            : incoming
              ? 'bg-cockpit-raised'
              : 'bg-cockpit-slab'
        }`}
      >
        <div
          className={`h-full w-8 flex items-center justify-center text-cockpit-text-primary font-normal text-xs font-mono flex-shrink-0 ${
            incoming ? 'bg-cockpit-raised' : 'bg-cockpit-slab'
          }`}
        >
          {position}
        </div>

        <div className="flex items-center ml-2 min-w-0 flex-1">
          <span className="text-cockpit-text-primary text-xs truncate">
            {player.bio?.displayName || player.name}
          </span>
        </div>

        {incoming &&
          (player.signAndTrade ? (
            <span className="ml-2 text-cockpit-info font-semibold text-[10px] flex-shrink-0">
              S&amp;T
            </span>
          ) : (
            <ArrowsRightLeftIcon className="ml-2 w-4 h-4 text-cockpit-info flex-shrink-0" />
          ))}

        <div className="ml-auto mr-2 flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <span className="text-cockpit-text-primary font-semibold text-xs">
            {formatSalary(salary)}
          </span>
          <span className="text-cockpit-text-secondary text-[10px]">{yearsLeft}Y</span>
        </div>

        <div className="flex items-center relative">
          <button
            ref={buttonRef}
            onClick={() => setOpenMenu(openMenu === menuId ? null : menuId)}
            className="text-xs text-cockpit-text-muted hover:text-cockpit-text-primary"
          >
            •••
          </button>

          {openMenu === menuId && (
            <div
              ref={menuRef}
              className="absolute right-0 top-5 bg-cockpit-raised border border-cockpit-edge rounded-md z-20 text-xs min-w-[10rem] max-w-[14rem]"
            >
              {!incoming &&
                otherTeams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const action =
                        included && player.tradeTo === t.id ? 'keep' : 'trade';
                      onSetPlayerTrade?.(player, action, t.id);
                      setOpenMenu(null);
                    }}
                    className="block w-full text-left px-3 py-1.5 hover:bg-cockpit-edge truncate"
                  >
                    {included && player.tradeTo === t.id
                      ? 'Cancel Trade'
                      : `Trade to ${t.teamName}`}
                  </button>
                ))}
              {!incoming && canOfferSignAndTrade && (
                <button
                  onClick={() => {
                    onRequestSignAndTrade?.(player, otherTeams[0]?.id);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
                >
                  Sign-and-Trade
                </button>
              )}
              {(included || incoming) && (
                <button
                  onClick={() => {
                    onUndoPlayerTrade?.(player);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
                >
                  Undo Trade
                </button>
              )}
              <button
                onClick={() => {
                  setContractPlayer?.(player);
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
              >
                Contract Actions
              </button>
              <button
                onClick={() =>
                  window.open(getPlayerProfileUrl(player), '_blank', 'noopener')
                }
                className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
              >
                View Profile
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-[68px] flex items-center border border-cockpit-edge rounded-sm pr-2 overflow-visible relative ${
        included
          ? 'bg-cockpit-safe/15'
          : incoming
            ? 'bg-cockpit-raised'
            : 'bg-cockpit-slab'
      }`}
    >
      <div
        className={`h-full w-10 flex flex-col items-center justify-center text-cockpit-text-primary font-normal text-base font-mono relative ${
          incoming ? 'bg-cockpit-raised' : 'bg-cockpit-slab'
        }`}
      >
        <div>{position}</div>
        <div className="absolute right-0 top-0 h-full w-[2px] bg-cockpit-void"></div>
      </div>

      <div className="h-full w-[70px] bg-cockpit-raised flex items-center justify-center overflow-hidden">
        <img
          src={`/assets/headshots/${
            player.bio?.playerId || details.bio?.playerId || player.player_id
          }.png`}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.onerror = null; e.currentTarget.src = '/assets/headshots/default.png';
          }}
          alt={player.bio?.displayName || player.name || 'Player headshot'}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-col justify-center ml-3 min-w-0 max-w-[180px]">
        <div className="h-[32px] flex items-center mb-2">
          <PlayerNameMini
            name={player.bio?.displayName || player.name || 'Unnamed player'}
            scale={0.85}
          />
        </div>
        <div className="flex items-center mt-[0px] mb-0 gap-2 text-cockpit-text-muted text-[11px]">
          <TeamLogo
            teamAbbr={team}
            className="w-5 h-5"
          />
          <div>
            {player.bio?.height || player.height || player.height_ft_in || '—'}{' '}
            <span className="text-cockpit-text-ghost">|</span>{' '}
            {player.bio?.weight || player.weight || player.weight_lbs || '—'}{' '}
            lbs
          </div>
        </div>
      </div>

      {incoming &&
        (player.signAndTrade ? (
          <div
            className="ml-10 text-cockpit-info font-semibold text-sm"
            title="Sign-and-Trade"
          >
            S&amp;T
          </div>
        ) : (
          <div className="ml-10 text-cockpit-info" title="Traded">
            <ArrowsRightLeftIcon className="w-6 h-6" />
          </div>
        ))}

      <div className="ml-auto mr-4 flex flex-col items-end whitespace-nowrap">
        <div className="text-cockpit-text-primary font-semibold text-sm">
          {formatSalary(salary)}
        </div>
        <div className="text-cockpit-text-secondary text-[11px] font-semibold">
          {yearsLeft} YRS
        </div>
      </div>

      <div className="flex items-center gap-2 relative mr-1">
        <button
          ref={buttonRef}
          onClick={() => setOpenMenu(openMenu === menuId ? null : menuId)}
          className="text-xs text-cockpit-text-muted hover:text-cockpit-text-primary"
        >
          •••
        </button>

        {openMenu === menuId && (
          <div
            ref={menuRef}
            className="absolute right-0 top-5 bg-cockpit-raised border border-cockpit-edge rounded-md z-20 text-xs min-w-[10rem] max-w-[14rem]"
          >
            {!incoming &&
              otherTeams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const action =
                      included && player.tradeTo === t.id ? 'keep' : 'trade';
                    onSetPlayerTrade?.(player, action, t.id);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left px-3 py-1.5 hover:bg-cockpit-edge truncate"
                >
                  {included && player.tradeTo === t.id
                    ? 'Cancel Trade'
                    : `Trade to ${t.teamName}`}
                </button>
              ))}

            {!incoming && canOfferSignAndTrade && (
              <button
                onClick={() => {
                  onRequestSignAndTrade?.(player, otherTeams[0]?.id);
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
              >
                Sign-and-Trade
              </button>
            )}

            {(included || incoming) && (
              <button
                onClick={() => {
                  onUndoPlayerTrade?.(player);
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
              >
                Undo Trade
              </button>
            )}

            <button
              onClick={() => {
                setContractPlayer?.(player);
                setOpenMenu(null);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
            >
              Contract Actions
            </button>

            <button
              onClick={() => (window.location.href = getPlayerProfileUrl(player))}
              className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
            >
              View Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
