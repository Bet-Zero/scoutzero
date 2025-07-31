export function generateRankingFromComparisons(comparisons, players) {
  const score = {};
  players.forEach((p) => {
    score[p.id] = 0;
  });
  comparisons.forEach((c) => {
    score[c.winner] = (score[c.winner] || 0) + 1;
  });
  return players.slice().sort((a, b) => {
    return (score[b.id] || 0) - (score[a.id] || 0);
  });
}

export function suggestNextPair(comparisons, players) {
  if (players.length < 2) return [];
  const compared = new Set(
    comparisons.map((c) => `${c.winner}-${c.loser}`)
  );
  let attempts = 0;
  while (attempts < 100) {
    const a = players[Math.floor(Math.random() * players.length)];
    let b = players[Math.floor(Math.random() * players.length)];
    if (b.id === a.id) {
      attempts++;
      continue;
    }
    const key1 = `${a.id}-${b.id}`;
    const key2 = `${b.id}-${a.id}`;
    if (!compared.has(key1) && !compared.has(key2)) {
      return [a, b];
    }
    attempts++;
  }
  return [players[0], players[1]];
}
