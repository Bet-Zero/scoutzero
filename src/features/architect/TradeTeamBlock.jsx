import { TeamList } from '@/constants/teamList';

const getSalary = (players, yearKey) =>
  players.reduce(
    (sum, p) =>
      sum + (p.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0),
    0
  );

const TradeTeamBlock = ({
  team,
  sends,
  picks,
  yearKey,
  tradePartnerName,
  incomingPlayers = [],
  incomingPicks = [],
  capImpact = null,
  onSetPlayerTrade,
  onTogglePick,
  onSelectTeam,
  onRemove,
}) => {
  if (!team) {
    return (
      <div className="flex-1 border border-white/20 rounded p-2 relative">
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 text-red-400 text-xs"
          >
            ✕
          </button>
        )}
        <label className="text-sm">Select Team</label>
        <select
          className="w-full bg-[#111] text-white p-1 rounded mt-1 text-sm"
          onChange={(e) => onSelectTeam(e.target.value)}
        >
          <option value="">Select Team</option>
          {TeamList.map((t) => (
            <option key={t} value={t.toLowerCase()}>
              {t}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex-1 border border-white/20 rounded p-2 relative">
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 text-red-400 text-xs"
        >
          ✕
        </button>
      )}
      <h3 className="font-semibold mb-1">{team.teamName}</h3>
      <strong>Players:</strong>
      <ul className="mb-2">
        {team.players.map((p) => (
          <li key={p.name} className="text-sm flex items-center gap-2 mb-1">
            <select
              className="bg-[#111] text-white text-xs rounded px-1 py-0.5"
              value={sends.includes(p) ? 'trade' : 'keep'}
              onChange={(e) => onSetPlayerTrade(p, e.target.value)}
            >
              <option value="keep">Keep</option>
              <option value="trade">
                Trade to {tradePartnerName || 'other team'}
              </option>
            </select>
            <span>
              {p.name} – $
              {p.contract_clean?.salaries_by_year?.[
                yearKey
              ]?.salary?.toLocaleString() || 0}
            </span>
            {sends.includes(p) && (
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={!!p.signAndTrade}
                  onChange={(e) =>
                    onSetPlayerTrade(p, 'signAndTrade', e.target.checked)
                  }
                />
                S&T
              </label>
            )}
            {p.signAndTrade && <span className="text-xs">(Sign & Trade)</span>}
          </li>
        ))}
      </ul>
      <strong>Picks:</strong>
      <ul className="mb-2">
        {team.picks?.map((pick) => (
          <li key={`${pick.year}-${pick.round}`} className="text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={picks.includes(pick)}
                onChange={() => onTogglePick(pick)}
              />
              {pick.year} {pick.round} Round{' '}
              {pick.via ? `(via ${pick.via})` : ''}
            </label>
          </li>
        ))}
      </ul>
      <strong>Incoming Players:</strong>
      <ul className="mb-2">
        {incomingPlayers.length > 0 ? (
          incomingPlayers.map((p) => (
            <li key={p.name} className="text-sm">
              {p.name}
            </li>
          ))
        ) : (
          <li className="text-sm">None</li>
        )}
      </ul>
      <strong>Incoming Picks:</strong>
      <ul className="mb-2">
        {incomingPicks.length > 0 ? (
          incomingPicks.map((p, i) => (
            <li key={`${p.year}-${p.round}-${i}`} className="text-sm">
              {p.year} {p.round} Round
            </li>
          ))
        ) : (
          <li className="text-sm">None</li>
        )}
      </ul>
      <p className="text-sm">
        <strong>Total Salary:</strong> $
        {getSalary(sends, yearKey).toLocaleString()}
      </p>
      {capImpact && (
        <div className="text-sm mt-2">
          <strong>Cap Impact Summary:</strong>
          <div>
            In: ${((capImpact.in || 0) / 1_000_000).toFixed(1)}M | Out: $
            {((capImpact.out || 0) / 1_000_000).toFixed(1)}M
          </div>
          <div>
            Projected Salary: $
            {((capImpact.projected || 0) / 1_000_000).toFixed(1)}M
          </div>
          <div>
            Status: {capImpact.capStatus}, {capImpact.apronStatus}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeTeamBlock;
