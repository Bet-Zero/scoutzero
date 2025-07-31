function computeEloRatings(comparisons, players, initial = 1000, k = 32) {
  const ratings = {};
  players.forEach((p) => {
    ratings[p.id] = initial;
  });
  comparisons.forEach(({ winner, loser }) => {
    const winnerRating = ratings[winner];
    const loserRating = ratings[loser];
    const expectedWinner = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
    const expectedLoser = 1 / (1 + 10 ** ((winnerRating - loserRating) / 400));
    ratings[winner] = winnerRating + k * (1 - expectedWinner);
    ratings[loser] = loserRating + k * (0 - expectedLoser);
  });
  return ratings;
}

export function generateRankingFromComparisons(comparisons, players) {
  const ratings = computeEloRatings(comparisons, players);
  return players
    .map((p) => ({ ...p, rating: ratings[p.id] }))
    .sort((a, b) => b.rating - a.rating);
}

export function suggestNextPair(comparisons, players) {
  if (players.length < 2) return [];

  // Track how many times each player has been compared
  const compareCounts = {};
  players.forEach((p) => {
    compareCounts[p.id] = 0;
  });
  comparisons.forEach((c) => {
    compareCounts[c.winner] = (compareCounts[c.winner] || 0) + 1;
    compareCounts[c.loser] = (compareCounts[c.loser] || 0) + 1;
  });

  const ratings = computeEloRatings(comparisons, players);
  const compared = new Set(comparisons.map((c) => `${c.winner}-${c.loser}`));

  const sorted = players.slice().sort((a, b) => {
    const countDiff = (compareCounts[a.id] || 0) - (compareCounts[b.id] || 0);
    if (countDiff !== 0) return countDiff;
    return (ratings[a.id] || 0) - (ratings[b.id] || 0);
  });

  let bestPair = null;
  let smallestDiff = Infinity;

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const key1 = `${sorted[i].id}-${sorted[j].id}`;
      const key2 = `${sorted[j].id}-${sorted[i].id}`;
      if (compared.has(key1) || compared.has(key2)) continue;
      const diff = Math.abs((ratings[sorted[i].id] || 0) - (ratings[sorted[j].id] || 0));
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestPair = [sorted[i], sorted[j]];
      }
    }
  }

  return bestPair || [sorted[0], sorted[1]];
}
