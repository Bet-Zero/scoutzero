import React from 'react';

const ComparisonMatrix = ({ players, comparisons, className = '' }) => {
  const playerIds = players.map((p) => p.id);
  const comparisonMap = {};

  // Build map: comparisonMap[a][b] = 'win' | 'loss' | undefined
  playerIds.forEach((id) => {
    comparisonMap[id] = {};
  });

  comparisons.forEach(({ winner, loser }) => {
    comparisonMap[winner][loser] = 'win';
    comparisonMap[loser][winner] = 'loss';
  });

  return (
    <div className={`overflow-x-auto mt-8 border border-white/10 rounded text-sm ${className}`}>
      <table className="border-collapse text-white">
        <thead>
          <tr>
            <th className="border border-white/10 bg-black/40 p-1">vs</th>
            {players.map((p) => (
              <th
                key={p.id}
                className="border border-white/10 px-2 py-1 bg-black/40"
              >
                {p.display_name || p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((rowPlayer) => (
            <tr key={rowPlayer.id}>
              <td className="border border-white/10 px-2 py-1 bg-black/40 font-semibold">
                {rowPlayer.display_name || rowPlayer.name}
              </td>
              {players.map((colPlayer) => {
                if (rowPlayer.id === colPlayer.id) {
                  return (
                    <td
                      key={colPlayer.id}
                      className="text-center text-white/30 border border-white/10 px-2"
                    >
                      —
                    </td>
                  );
                }

                const result = comparisonMap[rowPlayer.id][colPlayer.id];
                return (
                  <td
                    key={colPlayer.id}
                    className={`text-center border border-white/10 px-2 ${
                      result === 'win'
                        ? 'text-green-400'
                        : result === 'loss'
                          ? 'text-red-400'
                          : 'text-white/30'
                    }`}
                  >
                    {result === 'win' ? '✅' : result === 'loss' ? '❌' : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonMatrix;
