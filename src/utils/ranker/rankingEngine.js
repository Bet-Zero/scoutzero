// 📁 src/utils/ranker/rankingEngine.js

// ========== 🧠 UTILITY FUNCTIONS ==========

// Get list of unique player IDs
const getPlayerIds = (players) => players.map((p) => p.id);

// Determine if a direct comparison already exists
const alreadyCompared = (a, b, comparisons) =>
  comparisons.some(
    (c) =>
      (c.winner === a && c.loser === b) || (c.winner === b && c.loser === a)
  );

// Build graph of wins/losses
const buildGraph = (comparisons) => {
  const graph = {};
  comparisons.forEach(({ winner, loser }) => {
    if (!graph[winner]) graph[winner] = new Set();
    graph[winner].add(loser);
  });
  return graph;
};

// Check if A > B can be inferred from graph
const canInfer = (a, b, graph, visited = new Set()) => {
  if (!graph[a]) return false;
  if (graph[a].has(b)) return true;
  for (const next of graph[a]) {
    if (!visited.has(next)) {
      visited.add(next);
      if (canInfer(next, b, graph, visited)) return true;
    }
  }
  return false;
};

// ========== 🧱 PHASED COMPARISON SYSTEM ==========

// Track internal pairing state
const getNextPhasePair = (players, comparisons) => {
  const ids = getPlayerIds(players);
  const graph = buildGraph(comparisons);
  const usedInComparison = new Set();

  comparisons.forEach(({ winner, loser }) => {
    usedInComparison.add(winner);
    usedInComparison.add(loser);
  });

  // 🟦 PHASE 1: "New vs New" (maximize anchors)
  const unused = ids.filter((id) => !usedInComparison.has(id));
  if (unused.length >= 2) {
    for (let i = 0; i < unused.length; i++) {
      for (let j = i + 1; j < unused.length; j++) {
        const a = unused[i];
        const b = unused[j];
        if (!alreadyCompared(a, b, comparisons)) {
          return [a, b];
        }
      }
    }
  }

  // 🟧 PHASE 2: "Cross-Match Anchors"
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      if (a !== b && !alreadyCompared(a, b, comparisons)) {
        // Avoid if already inferable
        if (canInfer(a, b, graph) || canInfer(b, a, graph)) continue;
        return [a, b];
      }
    }
  }

  // 🟥 PHASE 3: No more meaningful comparisons
  return [];
};

// Suggest next strategic pair
// ✅ SMART MATCHUP GENERATOR
export function suggestNextPair(comparisons, players) {
  if (players.length < 2) return [];

  // Build comparison lookup
  const seen = new Set();
  comparisons.forEach(({ winner, loser }) => {
    seen.add(`${winner}->${loser}`);
    seen.add(`${loser}->${winner}`); // Treat as compared, regardless of winner
  });

  // Track how many times each player has appeared
  const usageCount = {};
  players.forEach((p) => (usageCount[p.id] = 0));
  comparisons.forEach(({ winner, loser }) => {
    usageCount[winner]++;
    usageCount[loser]++;
  });

  // Build win graph
  const graph = {};
  players.forEach((p) => (graph[p.id] = new Set()));
  comparisons.forEach(({ winner, loser }) => {
    graph[winner].add(loser);
  });

  // Transitive closure
  const closure = {};
  for (const a in graph) {
    closure[a] = new Set();
    const stack = [...graph[a]];
    while (stack.length > 0) {
      const next = stack.pop();
      if (!closure[a].has(next)) {
        closure[a].add(next);
        graph[next]?.forEach((n) => stack.push(n));
      }
    }
  }

  // PHASE 1: New vs New (anchor building)
  const unused = players.filter((p) => usageCount[p.id] === 0);
  if (unused.length >= 2) {
    for (let i = 0; i < unused.length; i++) {
      for (let j = i + 1; j < unused.length; j++) {
        const key = `${unused[i].id}->${unused[j].id}`;
        if (!seen.has(key)) return [unused[i], unused[j]];
      }
    }
  }

  // PHASE 2: Usage-balanced unresolved matchups
  const unresolved = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const key = `${a.id}->${b.id}`;
      const aBeatsB = closure[a.id]?.has(b.id);
      const bBeatsA = closure[b.id]?.has(a.id);

      if (!seen.has(key) && !aBeatsB && !bBeatsA) {
        const usageGap = Math.abs(usageCount[a.id] - usageCount[b.id]);
        const totalUsage = usageCount[a.id] + usageCount[b.id];
        unresolved.push({ pair: [a, b], score: totalUsage + usageGap * 2 });
      }
    }
  }

  if (unresolved.length > 0) {
    unresolved.sort((a, b) => a.score - b.score);
    return unresolved[0].pair;
  }

  // All pairs are resolved or inferred
  return [];
}

// ========== 🏁 FINAL RANKING LOGIC ==========

// Topological sort using DFS
export const generateRankingFromComparisons = (comparisons, players) => {
  const graph = buildGraph(comparisons);
  const visited = new Set();
  const stack = [];

  const dfs = (node) => {
    if (visited.has(node)) return;
    visited.add(node);
    if (graph[node]) {
      graph[node].forEach((neighbor) => dfs(neighbor));
    }
    stack.push(node);
  };

  players.forEach((p) => {
    if (!visited.has(p.id)) dfs(p.id);
  });

  const idToPlayer = Object.fromEntries(players.map((p) => [p.id, p]));
  return stack.reverse().map((id) => idToPlayer[id]);
};
