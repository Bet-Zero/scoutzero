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

// Suggest next strategic pair while respecting group isolation
// ✅ SMART MATCHUP GENERATOR
export function suggestNextPair(comparisons, players) {
  if (players.length < 2) return [];

  // Helper to suggest a pair within a single group
  const suggestInGroup = (groupPlayers) => {
    if (groupPlayers.length < 2) return [];
    const idSet = new Set(groupPlayers.map((p) => p.id));
    const groupComps = comparisons.filter(
      (c) => idSet.has(c.winner) && idSet.has(c.loser)
    );

    const seen = new Set();
    groupComps.forEach(({ winner, loser }) => {
      seen.add(`${winner}->${loser}`);
      seen.add(`${loser}->${winner}`);
    });

    const usageCount = {};
    groupPlayers.forEach((p) => (usageCount[p.id] = 0));
    groupComps.forEach(({ winner, loser }) => {
      usageCount[winner]++;
      usageCount[loser]++;
    });

    const graph = {};
    groupPlayers.forEach((p) => (graph[p.id] = new Set()));
    groupComps.forEach(({ winner, loser }) => {
      graph[winner].add(loser);
    });

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

    // Phase 1: New vs New inside the group
    const unused = groupPlayers.filter((p) => usageCount[p.id] === 0);
    if (unused.length >= 2) {
      for (let i = 0; i < unused.length; i++) {
        for (let j = i + 1; j < unused.length; j++) {
          const key = `${unused[i].id}->${unused[j].id}`;
          if (!seen.has(key)) return [unused[i], unused[j]];
        }
      }
    }

    // Phase 2: Usage-balanced unresolved matchups
    const unresolved = [];
    for (let i = 0; i < groupPlayers.length; i++) {
      for (let j = i + 1; j < groupPlayers.length; j++) {
        const a = groupPlayers[i];
        const b = groupPlayers[j];
        const key = `${a.id}->${b.id}`;
        const aBeatsB = closure[a.id]?.has(b.id);
        const bBeatsA = closure[b.id]?.has(a.id);

        if (!seen.has(key) && !aBeatsB && !bBeatsA) {
          const usageGap = Math.abs(usageCount[a.id] - usageCount[b.id]);
          const totalUsage = usageCount[a.id] + usageCount[b.id];
          unresolved.push({
            pair: [a, b],
            score: totalUsage + usageGap * 2,
          });
        }
      }
    }

    if (unresolved.length > 0) {
      unresolved.sort((a, b) => a.score - b.score);
      return unresolved[0].pair;
    }

    return [];
  };

  // Group players by tag (default group if undefined)
  const groups = {};
  players.forEach((p) => {
    const g = p.group || 'default';
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });

  // Try to resolve matchups within each group first
  for (const g of Object.keys(groups)) {
    const pair = suggestInGroup(groups[g]);
    if (pair.length) return pair;
  }

  // Compute boundary comparisons (top↔upper and lower↔bottom)
  const rankGroup = (groupName) => {
    const list = groups[groupName] || [];
    if (list.length === 0) return [];
    const idSet = new Set(list.map((p) => p.id));
    const comps = comparisons.filter(
      (c) => idSet.has(c.winner) && idSet.has(c.loser)
    );
    const graph = buildGraph(comps);
    const visited = new Set();
    const stack = [];
    const dfs = (node) => {
      if (visited.has(node)) return;
      visited.add(node);
      graph[node]?.forEach((n) => dfs(n));
      stack.push(node);
    };
    list.forEach((p) => dfs(p.id));
    const idMap = Object.fromEntries(list.map((p) => [p.id, p]));
    return stack.reverse().map((id) => idMap[id]);
  };

  const topRanked = rankGroup('top');
  const upperRanked = rankGroup('upper');
  if (topRanked.length && upperRanked.length) {
    const worstTop = topRanked[topRanked.length - 1];
    const bestUpper = upperRanked[0];
    if (!alreadyCompared(worstTop.id, bestUpper.id, comparisons)) {
      return [worstTop, bestUpper];
    }
  }

  const lowerRanked = rankGroup('lower');
  const bottomRanked = rankGroup('bottom');
  if (lowerRanked.length && bottomRanked.length) {
    const worstLower = lowerRanked[lowerRanked.length - 1];
    const bestBottom = bottomRanked[0];
    if (!alreadyCompared(worstLower.id, bestBottom.id, comparisons)) {
      return [worstLower, bestBottom];
    }
  }

  // All groups resolved and boundaries checked
  return [];
}

// Estimate how many additional comparisons remain
export function estimateRemainingComparisons(comparisons, players) {
  const simulated = comparisons.map((c) => ({ ...c }));
  let count = 0;
  let next = suggestNextPair(simulated, players);

  while (next.length > 0) {
    // arbitrarily assume the first player wins to progress the simulation
    simulated.push({ winner: next[0].id, loser: next[1].id });
    count++;
    next = suggestNextPair(simulated, players);
  }

  return count;
}

// Build direct comparisons against an anchor player
export function buildAnchorComparisons(anchorId, players, betterIds = []) {
  const betterSet = new Set(betterIds);
  return players.map((p) =>
    betterSet.has(p.id)
      ? { winner: p.id, loser: anchorId }
      : { winner: anchorId, loser: p.id }
  );
}

// ========== 🏁 FINAL RANKING LOGIC ==========

// Topological sort using DFS
// Topological sort helper for a subset of players
const topologicalSort = (comparisons, players) => {
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

export const generateRankingFromComparisons = (
  comparisons,
  players,
  options = {}
) => {
  const { topTier = [], bottomTier = [], anchor } = options;

  // Fallback to simple topological sort if no grouping info provided
  if (!anchor && topTier.length === 0 && bottomTier.length === 0) {
    return topologicalSort(comparisons, players);
  }

  const idMap = Object.fromEntries(players.map((p) => [p.id, p]));
  const anchorPlayer = anchor ? idMap[anchor] : null;

  // Step 1: segment players
  const groups = { top: [], upper: [], lower: [], bottom: [] };
  players.forEach((p) => {
    if (p.id === anchor) return;
    if (topTier.includes(p.id)) groups.top.push(p);
    else if (bottomTier.includes(p.id)) groups.bottom.push(p);
    else if (anchor) {
      const beatAnchor = comparisons.some(
        (c) => c.winner === p.id && c.loser === anchor
      );
      groups[beatAnchor ? 'upper' : 'lower'].push(p);
    } else {
      groups.upper.push(p);
    }
  });

  const rankGroup = (list) => {
    if (!list.length) return [];
    const set = new Set(list.map((p) => p.id));
    const comps = comparisons.filter(
      (c) => set.has(c.winner) && set.has(c.loser)
    );
    return topologicalSort(comps, list);
  };

  let rankedTop = rankGroup(groups.top);
  let rankedUpper = rankGroup(groups.upper);
  let rankedLower = rankGroup(groups.lower);
  let rankedBottom = rankGroup(groups.bottom);

  const boundaryCheck = (high, low) => {
    if (high.length === 0 || low.length === 0) return [high, low];
    const highWorst = high[high.length - 1];
    const lowBest = low[0];
    const res = comparisons.find(
      (c) =>
        (c.winner === highWorst.id && c.loser === lowBest.id) ||
        (c.winner === lowBest.id && c.loser === highWorst.id)
    );
    if (res && res.winner === lowBest.id) {
      const newHigh = [...high.slice(0, -1), lowBest];
      const newLow = [highWorst, ...low.slice(1)];
      return [rankGroup(newHigh), rankGroup(newLow)];
    }
    return [high, low];
  };

  [rankedTop, rankedUpper] = boundaryCheck(rankedTop, rankedUpper);
  [rankedUpper, rankedLower] = boundaryCheck(rankedUpper, rankedLower);
  [rankedLower, rankedBottom] = boundaryCheck(rankedLower, rankedBottom);

  const final = [
    ...rankedTop,
    ...rankedUpper,
    ...(anchorPlayer ? [anchorPlayer] : []),
    ...rankedLower,
    ...rankedBottom,
  ];

  return final;
};
