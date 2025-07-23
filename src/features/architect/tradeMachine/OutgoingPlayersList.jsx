import React, { useState } from 'react';
import TradePlayerRow from './TradePlayerRow';
import EditContractModal from '@/components/shared/EditContractModal';
import TradeExceptionModal from '@/components/shared/TradeExceptionModal';

const parseYear = (key) => {
  if (typeof key === 'number') return key;
  const match = String(key).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : NaN;
};

export const OutgoingPlayersList = ({
  team,
  sends,
  yearKey,
  otherTeams = [],
  playersMap = {},
  onSetPlayerTrade,
}) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [contractPlayer, setContractPlayer] = useState(null);
  const [tpePlayer, setTpePlayer] = useState(null);

  return (
    <div>
      <h4 className="text-sm text-white/70 mb-1">Outgoing Players</h4>
      <div className="space-y-1 max-h-[375px] overflow-y-auto pr-1">
        {team.players
          ?.slice()
          .sort((a, b) => {
            const yr = parseYear(yearKey);
            const getSalary = (player) =>
              player.contract_clean?.salaries_by_year?.[yearKey]?.salary ||
              player.contract?.annual_salaries?.find(
                (s) => parseYear(s.year) === yr
              )?.salary ||
              0;
            return getSalary(b) - getSalary(a);
          })
          .map((p) => {
            const included = sends.includes(p);
            return (
              <TradePlayerRow
                key={p.id || p.name}
                player={p}
                included={included}
                yearKey={yearKey}
                otherTeams={otherTeams}
                playersMap={playersMap}
                onSetPlayerTrade={onSetPlayerTrade}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                setContractPlayer={setContractPlayer}
                setTpePlayer={setTpePlayer}
              />
            );
          })}
        {team.players?.length === 0 && (
          <div className="text-xs text-white/40">No players available</div>
        )}
      </div>
      {contractPlayer && (
        <EditContractModal
          player={contractPlayer}
          isOpen={!!contractPlayer}
          onClose={() => setContractPlayer(null)}
          onSave={(plr, values) => console.log('Save contract', plr, values)}
          onWaive={(plr) => console.log('Waive player', plr)}
          onOptionDecision={(plr, val) =>
            console.log('Option decision', plr, val)
          }
          onExtend={(plr, ext) => console.log('Extend', plr, ext)}
          onSignAndTrade={(plr, val) => console.log('S&T', plr, val)}
        />
      )}
      {tpePlayer && (
        <TradeExceptionModal
          player={tpePlayer}
          isOpen={!!tpePlayer}
          onClose={() => setTpePlayer(null)}
          onApply={(plr, amt, create) =>
            console.log('Apply TPE', plr, amt, create)
          }
        />
      )}
    </div>
  );
};
