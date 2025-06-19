// src/features/tierMaker/TierMakerBoard.jsx

import React, { useState, useMemo } from 'react';
import PlayerTierPresentation from '@/features/lists/PlayerTierPresentation';
import usePlayerData from '@/hooks/usePlayerData.js';
import { POSITION_MAP } from '@/utils/roles';
import DrawerShell from '@/components/shared/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/components/shared/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer';

const DEFAULT_TIERS = ['S', 'A', 'B', 'C', 'D'];

const TierMakerBoard = ({ players = [] }) => {
  const { players: allPlayers, loading } = usePlayerData();

  const processedPlayers = useMemo(
    () =>
      allPlayers.map((player) => ({
        id: player.id,
        player_id: player.id,
        name: (player.display_name || player.name || '').toLowerCase(),
        team: (player.bio?.Team || '').toLowerCase(),
        position:
          POSITION_MAP[player.bio?.Position] || player.bio?.Position || '',
        offenseRoles: [
          player.roles?.offense1?.toLowerCase() || '',
          player.roles?.offense2?.toLowerCase() || '',
        ],
        defenseRoles: [
          player.roles?.defense1?.toLowerCase() || '',
          player.roles?.defense2?.toLowerCase() || '',
        ],
        offenseSubroles: player.subRoles?.offense || [],
        defenseSubroles: player.subRoles?.defense || [],
        shootingProfile: (player.shootingProfile || '').toLowerCase(),
        badges: player.badges || [],
        salary: player.contract?.annual_salaries?.find((s) => s.year === 2025)
          ?.salary,
        freeAgentYear: player.free_agency_year?.toString(),
        freeAgentType: player.free_agent_type?.toLowerCase(),
        contractType: player.contract?.type?.toLowerCase(),
        extension: player.contract?.extension,
        options: player.contract?.options || [],
        original: player,
      })),
    [allPlayers]
  );

  const getInitialTiers = () =>
    [...DEFAULT_TIERS, 'Pool'].reduce((acc, tier) => {
      acc[tier] = tier === 'Pool' ? [...players] : [];
      return acc;
    }, {});

  const [tiers, setTiers] = useState(getInitialTiers);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const addPlayerToPool = (player) => {
    const formatted = { ...player, player_id: player.id };
    setTiers((prev) => ({
      ...prev,
      Pool: [...prev.Pool, formatted],
    }));
  };

  const movePlayer = (playerId, fromTier, direction) => {
    const tierKeys = [...DEFAULT_TIERS, 'Pool'];
    const currentIndex = tierKeys.indexOf(fromTier);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= tierKeys.length) return;

    const sourceItems = [...tiers[fromTier]];
    const player = sourceItems.find((p) => p.player_id === playerId);
    if (!player) return;

    setTiers((prev) => ({
      ...prev,
      [fromTier]: sourceItems.filter((p) => p.player_id !== playerId),
      [tierKeys[newIndex]]: [...prev[tierKeys[newIndex]], player],
    }));
  };

  const removePlayer = (playerId, fromTier) => {
    setTiers((prev) => ({
      ...prev,
      [fromTier]: prev[fromTier].filter((p) => p.player_id !== playerId),
    }));
  };

  const resetBoard = () => {
    setTiers(getInitialTiers());
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-white">
        Loading players...
      </div>
    );
  }

  return (
    <div className="flex relative">
      {!drawerOpen && !screenshotMode && (
        <OpenDrawerButton onClick={() => setDrawerOpen(true)} />
      )}

      <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <AddPlayerDrawer
          onClose={() => setDrawerOpen(false)}
          allPlayers={processedPlayers}
          onSelect={(player) => {
            addPlayerToPool(player);
            setDrawerOpen(false);
          }}
        />
      </DrawerShell>

      <div
        className={`flex-1 transition-[margin] duration-300 ease-in-out ${
          drawerOpen ? 'ml-[300px]' : 'ml-0'
        }`}
      >
        <div className="flex flex-col gap-2 w-full max-w-[1000px] mx-auto py-2">
          <div className="flex justify-between items-center mb-1">
            <button
              onClick={() => setScreenshotMode((prev) => !prev)}
              className="px-3 py-1 text-sm rounded bg-white/10 hover:bg-white/20 transition-all text-white"
            >
              {screenshotMode ? 'Exit Screenshot View' : 'Screenshot View'}
            </button>
            <button
              onClick={resetBoard}
              className="px-3 py-1 text-sm rounded bg-red-500 hover:bg-red-600 transition-all text-white"
            >
              Reset Board
            </button>
          </div>

          {[...DEFAULT_TIERS, 'Pool'].map((tier) => (
            <div
              key={tier}
              className={`flex items-center gap-2 border border-white/10 rounded-md min-h-[38px] ${
                tier === 'Pool' ? 'bg-neutral-950 mt-0' : 'bg-neutral-800'
              } p-0`}
            >
              <div className="w-[50px] text-sm text-white font-bold text-center">
                {tier === 'Pool' ? 'Pool' : tier}
              </div>
              <div className="flex flex-wrap gap-[2px] flex-1">
                {tiers[tier].map((player) => (
                  <div key={player.player_id} className="relative">
                    <PlayerTierPresentation player={player} />
                    {!screenshotMode && (
                      <div className="absolute top-1 right-1 flex flex-col gap-1">
                        {tier !== 'S' && (
                          <button
                            onClick={() =>
                              movePlayer(player.player_id, tier, 'up')
                            }
                            className="text-xs text-white bg-black/40 px-[6px] rounded hover:bg-white/10"
                          >
                            ↑
                          </button>
                        )}
                        {tier !== 'Pool' && (
                          <button
                            onClick={() =>
                              movePlayer(player.player_id, tier, 'down')
                            }
                            className="text-xs text-white bg-black/40 px-[6px] rounded hover:bg-white/10"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          onClick={() => removePlayer(player.player_id, tier)}
                          className="text-xs text-red-300 bg-black/40 px-[6px] rounded hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TierMakerBoard;
