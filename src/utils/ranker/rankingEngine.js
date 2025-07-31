function computeRankCentrality(comparisons, players, iterations = 50) {
  const n = players.length;
  const index = {};
  players.forEach((p, i) => {
    index[p.id] = i;
  });

  // win counts and total comparisons
  const wins = Array.from({ length: n }, () => Array(n).fill(0));
  const counts = Array.from({ length: n }, () => Array(n).fill(0));

  comparisons.forEach(({ winner, loser }) => {
    const w = index[winner];
    const l = index[loser];
    wins[w][l] += 1;
    counts[w][l] += 1;
    counts[l][w] += 1;
  });

  const P = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    let total = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      total += counts[i][j];
    }
    if (total === 0) {
      for (let j = 0; j < n; j++) {
        if (i !== j) P[i][j] = 1 / (n - 1);
      }
    } else {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        P[i][j] = wins[j][i] / total;
      }
    }
    P[i][i] = 1 - P[i].reduce((a, b) => a + b, 0);
  }

  let rating = Array(n).fill(1 / n);
  for (let t = 0; t < iterations; t++) {
    const next = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        next[j] += rating[i] * P[i][j];
      }
    }
    const norm = next.reduce((a, b) => a + b, 0) || 1;
    rating = next.map((v) => v / norm);
  }

  const ratings = {};
  players.forEach((p) => {
    ratings[p.id] = rating[index[p.id]] || 0;
  });
  return ratings;
}

export function generateRankingFromComparisons(comparisons, players) {
  const ratings = computeRankCentrality(comparisons, players);
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

  const ratings = computeRankCentrality(comparisons, players);
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
