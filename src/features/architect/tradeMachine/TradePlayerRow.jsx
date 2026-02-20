import React, { useEffect, useRef } from 'react';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import TeamLogo from '@/shared/components/TeamLogo';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import { formatSalary } from '@/shared/utils/formatting';
import { getYearsRemaining } from '@/shared/utils/contracts';
import { getSalaryWithFallback } from '@/features/architect/utils/contractSalaryUtils';
import { ArrowsRightLeftIcon } from '@heroicons/react/20/solid';

const TradePlayerRow = ({
  player,
  included,
  yearKey,
  incoming = false,
  otherTeams = [],
  playersMap = {},
  onSetPlayerTrade,
  onUndoPlayerTrade,
  openMenu,
  setOpenMenu,
  setContractPlayer,
  tradeExceptions = [],
  signAndTradeActive = false,
  compact = false,
}) => {
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const details = playersMap[player.name] || {};
  const team =
    player.tradeTo ||
    player.teamCode ||
    player.teamAbbr ||
    player.teamId ||
    player.team ||
    player.bio?.display?.team ||
    details.teamCode ||
    details.teamAbbr ||
    details.teamId ||
    details.team ||
    details.bio?.display?.team;

  // Click outside handler (unchanged UI behavior)
  useEffect(() => {
    const handleClick = (e) => {
      if (
        openMenu === player.name &&
        !menuRef.current?.contains(e.target) &&
        !buttonRef.current?.contains(e.target)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu, player.name, setOpenMenu]);

  // Calculate player data (unchanged visual output)
  const primaryContract =
    player.primaryContract ||
    (player.contracts ? Object.values(player.contracts)[0] : null) ||
    details.primaryContract ||
    (details.contracts ? Object.values(details.contracts)[0] : null);

  const year =
    typeof yearKey === 'number'
      ? yearKey
      : parseInt(yearKey.match(/\d{4}/)?.[0]);
  const salary = getSalaryWithFallback(player, yearKey);
  // Get years remaining from contract schema (most reliable)
  const yearsLeft =
    player.contract?.yearsRemaining ??
    primaryContract?.yearsRemaining ??
    (() => {
      const faYear =
        player.contract?.freeAgency?.year ??
        primaryContract?.freeAgency?.year ??
        player.bio?.display?.freeAgentYear ??
        player.freeAgentYear ??
        null;
      return faYear ? getYearsRemaining(faYear, year) : 0;
    })();
  const salaryForYear = Array.isArray(primaryContract?.salariesByYear)
    ? primaryContract.salariesByYear.find(
        (s) =>
          String(s.year) === String(year) ||
          (typeof s.season === 'string' && s.season.includes(String(year)))
      )
    : null;
  const position =
    getPlayerPositionLabel(
      player.bio?.position ||
        player.position ||
        playersMap[player.name]?.bio?.position
    ) || '—';

  // Enhanced TPE check
  const canUseTPE = tradeExceptions.some(
    (tpe) =>
      !tpe.isUsed &&
      salary <= tpe.amount &&
      (!tpe.expirationDate || new Date(tpe.expirationDate) > new Date())
  );

  // Compact variant: single-line, no headshot, no height/weight
  if (compact) {
    return (
      <div
        className={`w-full h-[40px] flex items-center border border-black rounded-sm pr-2 overflow-visible relative ${
          included
            ? 'bg-green-800/40'
            : incoming
              ? 'bg-neutral-700'
              : 'bg-neutral-800'
        }`}
      >
        {canUseTPE && incoming && !included && (
          <span className="absolute top-0.5 right-0.5 bg-purple-600 text-white text-[9px] px-1 rounded leading-tight">
            TPE
          </span>
        )}

        {/* Compact: Position inline */}
        <div
          className={`h-full w-8 flex items-center justify-center text-white font-normal text-xs font-mono flex-shrink-0 ${
            incoming ? 'bg-neutral-700' : 'bg-neutral-800'
          }`}
        >
          {position}
        </div>

        {/* Player name — compact */}
        <div className="flex items-center ml-2 min-w-0 flex-1">
          <span className="text-white text-xs truncate">
            {player.bio?.displayName || player.name}
          </span>
        </div>

        {/* Trade Indicator — compact */}
        {incoming &&
          (player.signAndTrade ? (
            <span className="ml-2 text-blue-300 font-semibold text-[10px] flex-shrink-0">
              S&amp;T
            </span>
          ) : (
            <ArrowsRightLeftIcon className="ml-2 w-4 h-4 text-blue-300 flex-shrink-0" />
          ))}

        {/* Salary — compact */}
        <div className="ml-auto mr-2 flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <span className="text-white font-semibold text-xs">
            {formatSalary(salary)}
          </span>
          <span className="text-white/60 text-[10px]">{yearsLeft}Y</span>
        </div>

        {/* Menu — compact */}
        <div className="flex items-center relative">
          <button
            ref={buttonRef}
            onClick={() =>
              setOpenMenu(openMenu === player.name ? null : player.name)
            }
            className="text-xs text-blue-400 hover:underline"
          >
            •••
          </button>

          {openMenu === player.name && (
            <div
              ref={menuRef}
              className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[10rem] max-w-[14rem]"
            >
              {!incoming &&
                otherTeams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const action =
                        included && player.tradeTo === t.id ? 'keep' : 'trade';
                      onSetPlayerTrade(player, action, t.id);
                      setOpenMenu(null);
                    }}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[#333] truncate"
                  >
                    {included && player.tradeTo === t.id
                      ? `Cancel Trade`
                      : `Trade to ${t.teamName}`}
                  </button>
                ))}
              {!incoming &&
                !included &&
                !salaryForYear?.salary &&
                (!signAndTradeActive || player.signAndTrade) && (
                  <button
                    onClick={() => {
                      onSetPlayerTrade(
                        player,
                        'signAndTrade',
                        otherTeams[0]?.id
                      );
                      setOpenMenu(null);
                    }}
                    className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                  >
                    Sign-and-Trade
                  </button>
                )}
              {canUseTPE && (
                <button
                  onClick={() => {
                    const validTPE = tradeExceptions.find(
                      (tpe) => salary <= tpe.amount && !tpe.isUsed
                    );
                    if (validTPE) {
                      onSetPlayerTrade(
                        player,
                        'tradeException',
                        null,
                        validTPE
                      );
                    }
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                >
                  Use Trade Exception
                </button>
              )}
              {(included || incoming) && (
                <button
                  onClick={() => {
                    onUndoPlayerTrade(player);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                >
                  Undo Trade
                </button>
              )}
              <button
                onClick={() => {
                  setContractPlayer(player);
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-[#333]"
              >
                Modify Contract
              </button>
              <button
                onClick={() =>
                  (window.location.href = `/profiles?player=${
                    player.bio?.playerId || player.id || player.player_id
                  }`)
                }
                className="block w-full text-left px-3 py-1 hover:bg-[#333]"
              >
                View Profile
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal rendering
  return (
    <div
      className={`w-full h-[68px] flex items-center border border-black rounded-sm pr-2 overflow-visible relative ${
        included
          ? 'bg-green-800/40'
          : incoming
            ? 'bg-neutral-700'
            : 'bg-neutral-800'
      }`}
    >
      {/* TPE Badge - Only show if player is incoming and not included */}
      {canUseTPE && incoming && !included && (
        <span className="absolute top-1 right-1 bg-purple-600 text-white text-[10px] px-1 rounded leading-tight">
          TPE
        </span>
      )}

      {/* Position Bar - unchanged */}
      <div
        className={`h-full w-10 flex flex-col items-center justify-center text-white font-normal text-base font-mono relative ${
          incoming ? 'bg-neutral-700' : 'bg-neutral-800'
        }`}
      >
        <div>{position}</div>
        <div className="absolute right-0 top-0 h-full w-[2px] bg-neutral-950"></div>
      </div>

      {/* Headshot - unchanged */}
      <div className="h-full w-[70px] bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
        <img
          src={`/assets/headshots/${
            player.bio?.playerId ||
            playersMap[player.name]?.bio?.playerId ||
            player.player_id
          }.png`}
          onError={(e) => (e.target.src = '/assets/headshots/default.png')}
          alt={player.bio?.displayName || player.name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Main Info - with guaranteed team logo */}
      <div className="flex flex-col justify-center ml-3 min-w-0 max-w-[180px]">
        <div className="h-[32px] flex items-center mb-2">
          <PlayerNameMini
            name={player.bio?.displayName || player.name}
            scale={0.85}
          />
        </div>
        <div className="flex items-center mt-[0px] mb-0 gap-2 text-white/50 text-[11px]">
          {/* Team Logo - now bulletproof */}
          <TeamLogo
            teamAbbr={team}
            className="w-5 h-5"
            fallbackClassName="bg-neutral-800 rounded-full"
          />
          <div>
            {player.bio?.height || player.height || player.height_ft_in || '—'}{' '}
            <span className="text-white/30">|</span>{' '}
            {player.bio?.weight || player.weight || player.weight_lbs || '—'}{' '}
            lbs
          </div>
        </div>
      </div>

      {/* Trade Indicator */}
      {incoming &&
        (player.signAndTrade ? (
          <div
            className="ml-10 text-blue-300 font-semibold text-sm"
            title="Sign-and-Trade"
          >
            S&amp;T
          </div>
        ) : (
          <div className="ml-10 text-blue-300" title="Traded">
            <ArrowsRightLeftIcon className="w-6 h-6" />
          </div>
        ))}

      {/* Contract Info - unchanged */}
      <div className="ml-auto mr-4 flex flex-col items-end whitespace-nowrap">
        <div className="text-white font-semibold text-sm">
          {formatSalary(salary)}
        </div>
        <div className="text-white/60 text-[11px] font-semibold">
          {yearsLeft} YRS
        </div>
      </div>

      {/* Options Menu - structure unchanged but with improved actions */}
      <div className="flex items-center gap-2 relative mr-1">
        <button
          ref={buttonRef}
          onClick={() =>
            setOpenMenu(openMenu === player.name ? null : player.name)
          }
          className="text-xs text-blue-400 hover:underline"
        >
          •••
        </button>

        {openMenu === player.name && (
          <div
            ref={menuRef}
            className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[10rem] max-w-[14rem]"
          >
            {/* Trade Destinations */}
            {!incoming &&
              otherTeams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const action =
                      included && player.tradeTo === t.id ? 'keep' : 'trade';
                    onSetPlayerTrade(player, action, t.id);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left px-3 py-1.5 hover:bg-[#333] truncate"
                >
                  {included && player.tradeTo === t.id
                    ? `Cancel Trade`
                    : `Trade to ${t.teamName}`}
                </button>
              ))}

            {/* Sign-and-Trade Option */}
            {!incoming &&
              !included &&
              !salaryForYear?.salary &&
              (!signAndTradeActive || player.signAndTrade) && (
                <button
                  onClick={() => {
                    onSetPlayerTrade(player, 'signAndTrade', otherTeams[0]?.id);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                >
                  Sign-and-Trade
                </button>
              )}

            {/* Trade Exception Option */}
            {canUseTPE && (
              <button
                onClick={() => {
                  const validTPE = tradeExceptions.find(
                    (tpe) => salary <= tpe.amount && !tpe.isUsed
                  );
                  if (validTPE) {
                    onSetPlayerTrade(player, 'tradeException', null, validTPE);
                  }
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-[#333]"
              >
                Use Trade Exception
              </button>
            )}

            {/* Undo Trade Option */}
            {(included || incoming) && (
              <button
                onClick={() => {
                  onUndoPlayerTrade(player);
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-[#333]"
              >
                Undo Trade
              </button>
            )}

            {/* Modify Contract Option */}
            <button
              onClick={() => {
                setContractPlayer(player);
                setOpenMenu(null);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              Modify Contract
            </button>

            {/* View Profile Option */}
            <button
              onClick={() =>
                (window.location.href = `/profiles?player=${
                  player.bio?.playerId || player.id || player.player_id
                }`)
              }
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              View Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradePlayerRow;
