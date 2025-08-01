function computeDominanceScores(comparisons, players) {
  const n = players.length;
  const index = {};
  players.forEach((p, i) => {
    index[p.id] = i;
  });

  const beats = Array.from({ length: n }, () => Array(n).fill(false));
  comparisons.forEach(({ winner, loser }) => {
    const w = index[winner];
    const l = index[loser];
    if (w === undefined || l === undefined) return;
    beats[w][l] = true;
  });

  // transitive closure
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (!beats[i][k]) continue;
      for (let j = 0; j < n; j++) {
        if (beats[k][j]) beats[i][j] = true;
      }
    }
  }

  const scores = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (beats[i][j]) scores[i] += 1;
    }
  }

  const ratings = {};
  players.forEach((p) => {
    ratings[p.id] = scores[index[p.id]] || 0;
  });

  return { ratings, beats };
}

export function generateRankingFromComparisons(comparisons, players) {
  const { ratings } = computeDominanceScores(comparisons, players);
  return players
    .map((p) => ({ ...p, rating: ratings[p.id] }))
    .sort((a, b) => b.rating - a.rating);
}

export function suggestNextPair(comparisons, players) {
  if (players.length < 2) return [];

  const { beats } = computeDominanceScores(comparisons, players);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (!beats[i][j] && !beats[j][i]) {
        return [players[i], players[j]];
      }
    }
  }

  const ranking = generateRankingFromComparisons(comparisons, players);
  return [ranking[0], ranking[1]];
}
