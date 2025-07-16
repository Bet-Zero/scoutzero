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
  onTogglePlayer,
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
          <li key={p.name} className="text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sends.includes(p)}
                onChange={() => onTogglePlayer(p)}
              />
              {p.name} – $
              {p.contract_clean?.salaries_by_year?.[
                yearKey
              ]?.salary?.toLocaleString() || 0}
              {p.signAndTrade && ' (Sign & Trade)'}
            </label>
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
      <p className="text-sm">
        <strong>Total Salary:</strong> $
        {getSalary(sends, yearKey).toLocaleString()}
      </p>
    </div>
  );
};

export default TradeTeamBlock;
