// src/features/ranker/utils/rankingEngine.ts

export type RankerPlayer = {
  id: string;
  group?: string | null;
};

export type RankerComparison = {
  winner: string;
  loser: string;
};

export type RankerPair = [] | [RankerPlayer, RankerPlayer];

export type RankerGraph = Record<string, Set<string>>;

export type ClosureCache = {
  addEdge(winnerId: unknown, loserId: unknown): boolean;
  rebuild(comparisons: readonly RankerComparison[]): void;
  getGroupClosure(groupPlayerIds: readonly string[]): RankerGraph;
  readonly closure: RankerGraph;
};

export type SuggestNextPairOptions = {
  skippedPairs?: Set<string> | null;
  closureCache?: ClosureCache | null;
};

export type RankingGenerationOptions = {
  topTier?: readonly string[];
  bottomTier?: readonly string[];
  anchor?: string | null;
};

type RankerIdPair = [] | [string, string];
type RankerGroups = Record<string, RankerPlayer[]>;
type UsageCounts = Record<string, number>;

// ========== 🧠 UTILITY FUNCTIONS ==========

// Get list of unique player IDs
const getPlayerIds = (players: readonly RankerPlayer[]): string[] =>
  players.map((p) => p.id);

// Determine if a direct comparison already exists
const alreadyCompared = (
  a: string,
  b: string,
  comparisons: readonly RankerComparison[]
): boolean =>
  comparisons.some(
    (c) =>
      (c.winner === a && c.loser === b) || (c.winner === b && c.loser === a)
  );

// Build graph of wins/losses
const buildGraph = (comparisons: readonly RankerComparison[]): RankerGraph => {
  const graph: RankerGraph = {};
  comparisons.forEach(({ winner, loser }) => {
    if (!graph[winner]) graph[winner] = new Set();
    graph[winner].add(loser);
  });
  return graph;
};

// Check if A > B can be inferred from graph
const canInfer = (
  a: string,
  b: string,
  graph: RankerGraph,
  visited = new Set<string>()
): boolean => {
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
// @deprecated Currently unused - reserved for future pairing algorithm
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _getNextPhasePair = (
  players: readonly RankerPlayer[],
  comparisons: readonly RankerComparison[]
): RankerIdPair => {
  const ids = getPlayerIds(players);
  const graph = buildGraph(comparisons);
  const usedInComparison = new Set<string>();

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

// ========== 🔁 INCREMENTAL TRANSITIVE CLOSURE CACHE ==========

// Create a reusable closure cache that can be incrementally updated
export function createClosureCache(): ClosureCache {
  const closure: RankerGraph = {}; // { [id]: Set of all transitively reachable ids }
  const directEdges: RankerGraph = {}; // { [id]: Set of direct wins }

  const ensureNode = (id: string): void => {
    if (!closure[id]) closure[id] = new Set();
    if (!directEdges[id]) directEdges[id] = new Set();
  };

  return {
    // Add a comparison edge and incrementally update reachability
    // Returns true if edge was added, false if rejected (cycle/duplicate/invalid)
    addEdge(winnerId: unknown, loserId: unknown): boolean {
      // Safety belt: ID validation
      if (typeof winnerId !== 'string' || typeof loserId !== 'string') {
        console.warn('[rankingEngine] addEdge rejected: IDs must be strings', {
          winnerId,
          loserId,
        });
        return false;
      }

      if (winnerId === loserId) {
        console.warn('[rankingEngine] addEdge rejected: self-comparison', {
          winnerId,
        });
        return false;
      }

      ensureNode(winnerId);
      ensureNode(loserId);

      // Already tracked (duplicate edge)
      if (directEdges[winnerId].has(loserId)) return false;

      // Safety belt: Cycle guard
      // If loser can already reach winner, adding winner > loser creates a cycle
      if (closure[loserId].has(winnerId)) {
        console.warn('[rankingEngine] addEdge rejected: would create cycle', {
          winnerId,
          loserId,
          loserReaches: [...closure[loserId]],
        });
        return false;
      }

      directEdges[winnerId].add(loserId);

      // Winner now reaches loser + everything loser reaches
      const newReachable = new Set<string>([loserId, ...closure[loserId]]);
      // Remove what winner already knew about
      for (const id of closure[winnerId]) newReachable.delete(id);
      if (newReachable.size === 0) return true;

      // Propagate: anyone who can reach winner also gains the new nodes
      for (const id of newReachable) closure[winnerId].add(id);
      for (const nodeId in closure) {
        if (closure[nodeId].has(winnerId)) {
          for (const id of newReachable) closure[nodeId].add(id);
        }
      }

      return true;
    },

    // Bulk-load from a comparisons array (used on init / undo)
    rebuild(comparisons: readonly RankerComparison[]): void {
      for (const key in closure) delete closure[key];
      for (const key in directEdges) delete directEdges[key];
      comparisons.forEach(({ winner, loser }) => {
        ensureNode(winner);
        ensureNode(loser);
        directEdges[winner].add(loser);
      });
      // Build full closure from scratch
      for (const a in directEdges) {
        closure[a] = new Set();
        const stack = [...directEdges[a]];
        while (stack.length > 0) {
          const next = stack.pop();
          if (!next) continue;
          if (!closure[a].has(next)) {
            closure[a].add(next);
            directEdges[next]?.forEach((n) => stack.push(n));
          }
        }
      }
    },

    // Get the closure for a specific group of players
    getGroupClosure(groupPlayerIds: readonly string[]): RankerGraph {
      const idSet = new Set(groupPlayerIds);
      const groupClosure: RankerGraph = {};
      for (const id of groupPlayerIds) {
        groupClosure[id] = new Set();
        if (closure[id]) {
          for (const reachable of closure[id]) {
            if (idSet.has(reachable)) groupClosure[id].add(reachable);
          }
        }
      }
      return groupClosure;
    },

    get closure() {
      return closure;
    },
  };
}

// Suggest next strategic pair while respecting group isolation
// ✅ SMART MATCHUP GENERATOR
export function suggestNextPair(
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[],
  { skippedPairs, closureCache }: SuggestNextPairOptions = {}
): RankerPair {
  if (players.length < 2) return [];

  const skipSet = skippedPairs || new Set();

  // Helper: make a canonical skip key for a pair (order-independent)
  const skipKey = (a: string, b: string): string =>
    a < b ? `${a}<>${b}` : `${b}<>${a}`;

  // Helper to suggest a pair within a single group
  const suggestInGroup = (groupPlayers: readonly RankerPlayer[]): RankerPair => {
    if (groupPlayers.length < 2) return [];
    const idSet = new Set(groupPlayers.map((p) => p.id));
    const groupComps = comparisons.filter(
      (c) => idSet.has(c.winner) && idSet.has(c.loser)
    );

    const seen = new Set<string>();
    groupComps.forEach(({ winner, loser }) => {
      seen.add(`${winner}->${loser}`);
      seen.add(`${loser}->${winner}`);
    });

    const usageCount: UsageCounts = {};
    groupPlayers.forEach((p) => (usageCount[p.id] = 0));
    groupComps.forEach(({ winner, loser }) => {
      usageCount[winner]++;
      usageCount[loser]++;
    });

    // Use closure cache if available, otherwise compute inline
    const groupIds = groupPlayers.map((p) => p.id);
    const closure = closureCache
      ? closureCache.getGroupClosure(groupIds)
      : (() => {
          const graph: RankerGraph = {};
          groupPlayers.forEach((p) => (graph[p.id] = new Set()));
          groupComps.forEach(({ winner, loser }) => {
            graph[winner].add(loser);
          });
          const c: RankerGraph = {};
          for (const a in graph) {
            c[a] = new Set();
            const stack = [...graph[a]];
            while (stack.length > 0) {
              const next = stack.pop();
              if (!next) continue;
              if (!c[a].has(next)) {
                c[a].add(next);
                graph[next]?.forEach((n) => stack.push(n));
              }
            }
          }
          return c;
        })();

    // Phase 1: New vs New inside the group
    const unused = groupPlayers.filter((p) => usageCount[p.id] === 0);
    if (unused.length >= 2) {
      for (let i = 0; i < unused.length; i++) {
        for (let j = i + 1; j < unused.length; j++) {
          const key = `${unused[i].id}->${unused[j].id}`;
          if (
            !seen.has(key) &&
            !skipSet.has(skipKey(unused[i].id, unused[j].id))
          ) {
            return [unused[i], unused[j]];
          }
        }
      }
    }

    // Phase 2: Usage-balanced unresolved matchups
    const unresolved: Array<{ pair: [RankerPlayer, RankerPlayer]; score: number }> =
      [];
    for (let i = 0; i < groupPlayers.length; i++) {
      for (let j = i + 1; j < groupPlayers.length; j++) {
        const a = groupPlayers[i];
        const b = groupPlayers[j];
        const key = `${a.id}->${b.id}`;
        const aBeatsB = closure[a.id]?.has(b.id);
        const bBeatsA = closure[b.id]?.has(a.id);

        if (
          !seen.has(key) &&
          !aBeatsB &&
          !bBeatsA &&
          !skipSet.has(skipKey(a.id, b.id))
        ) {
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
      return unresolved[0]?.pair ?? [];
    }

    return [];
  };

  // Group players by tag (default group if undefined)
  const groups: RankerGroups = {};
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
  const rankGroup = (groupName: string): RankerPlayer[] => {
    const list = groups[groupName] || [];
    if (list.length === 0) return [];
    const idSet = new Set(list.map((p) => p.id));
    const comps = comparisons.filter(
      (c) => idSet.has(c.winner) && idSet.has(c.loser)
    );
    const graph = buildGraph(comps);
    const visited = new Set<string>();
    const stack: string[] = [];
    const dfs = (node: string): void => {
      if (visited.has(node)) return;
      visited.add(node);
      graph[node]?.forEach((n) => dfs(n));
      stack.push(node);
    };
    list.forEach((p) => dfs(p.id));
    const idMap = list.reduce<Record<string, RankerPlayer>>((acc, player) => {
      acc[player.id] = player;
      return acc;
    }, {});
    return stack
      .reverse()
      .map((id) => idMap[id])
      .filter((player): player is RankerPlayer => Boolean(player));
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

// Estimate how many additional comparisons remain (formula-based, O(n²) single pass)
export function estimateRemainingComparisons(
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[]
): number {
  if (players.length < 2) return 0;

  // Group players the same way suggestNextPair does
  const groups: RankerGroups = {};
  players.forEach((p) => {
    const g = p.group || 'default';
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });

  let unresolvedCount = 0;

  for (const g of Object.keys(groups)) {
    const groupPlayers = groups[g];
    if (groupPlayers.length < 2) continue;

    const idSet = new Set(groupPlayers.map((p) => p.id));
    const groupComps = comparisons.filter(
      (c) => idSet.has(c.winner) && idSet.has(c.loser)
    );

    // Build seen set (directly compared pairs)
    const seen = new Set<string>();
    groupComps.forEach(({ winner, loser }) => {
      seen.add(`${winner}->${loser}`);
      seen.add(`${loser}->${winner}`);
    });

    // Build transitive closure for this group
    const graph: RankerGraph = {};
    groupPlayers.forEach((p) => (graph[p.id] = new Set()));
    groupComps.forEach(({ winner, loser }) => {
      graph[winner].add(loser);
    });
    const closure: RankerGraph = {};
    for (const a in graph) {
      closure[a] = new Set();
      const stack = [...graph[a]];
      while (stack.length > 0) {
        const next = stack.pop();
        if (!next) continue;
        if (!closure[a].has(next)) {
          closure[a].add(next);
          graph[next]?.forEach((n) => stack.push(n));
        }
      }
    }

    // Count unresolved pairs: not directly compared AND not transitively resolved
    for (let i = 0; i < groupPlayers.length; i++) {
      for (let j = i + 1; j < groupPlayers.length; j++) {
        const a = groupPlayers[i];
        const b = groupPlayers[j];
        const key = `${a.id}->${b.id}`;
        if (
          !seen.has(key) &&
          !closure[a.id]?.has(b.id) &&
          !closure[b.id]?.has(a.id)
        ) {
          unresolvedCount++;
        }
      }
    }
  }

  // Add pending boundary comparisons
  const hasGroup = (name: string): boolean => (groups[name]?.length || 0) > 0;
  if (hasGroup('top') && hasGroup('upper')) {
    const topIds = new Set(groups.top.map((p) => p.id));
    const upperIds = new Set(groups.upper.map((p) => p.id));
    const hasBoundaryComp = comparisons.some(
      (c) =>
        (topIds.has(c.winner) && upperIds.has(c.loser)) ||
        (upperIds.has(c.winner) && topIds.has(c.loser))
    );
    if (!hasBoundaryComp) unresolvedCount++;
  }
  if (hasGroup('lower') && hasGroup('bottom')) {
    const lowerIds = new Set(groups.lower.map((p) => p.id));
    const bottomIds = new Set(groups.bottom.map((p) => p.id));
    const hasBoundaryComp = comparisons.some(
      (c) =>
        (lowerIds.has(c.winner) && bottomIds.has(c.loser)) ||
        (bottomIds.has(c.winner) && lowerIds.has(c.loser))
    );
    if (!hasBoundaryComp) unresolvedCount++;
  }

  return unresolvedCount;
}

// Build direct comparisons against an anchor player
export function buildAnchorComparisons(
  anchorId: string,
  players: readonly RankerPlayer[],
  betterIds: readonly string[] = []
): RankerComparison[] {
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
const topologicalSort = (
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[]
): RankerPlayer[] => {
  const graph = buildGraph(comparisons);
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (node: string): void => {
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

  const idToPlayer = players.reduce<Record<string, RankerPlayer>>(
    (acc, player) => {
      acc[player.id] = player;
      return acc;
    },
    {}
  );
  return stack
    .reverse()
    .map((id) => idToPlayer[id])
    .filter((player): player is RankerPlayer => Boolean(player));
};

export const generateRankingFromComparisons = (
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[],
  options: RankingGenerationOptions = {}
): RankerPlayer[] => {
  const { topTier = [], bottomTier = [], anchor } = options;

  // Fallback to simple topological sort if no grouping info provided
  if (!anchor && topTier.length === 0 && bottomTier.length === 0) {
    return topologicalSort(comparisons, players);
  }

  const idMap = players.reduce<Record<string, RankerPlayer>>((acc, player) => {
    acc[player.id] = player;
    return acc;
  }, {});
  const anchorPlayer = anchor ? idMap[anchor] : null;

  // Step 1: segment players
  const groups: Record<'top' | 'upper' | 'lower' | 'bottom', RankerPlayer[]> = {
    top: [],
    upper: [],
    lower: [],
    bottom: [],
  };
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

  const rankGroup = (list: readonly RankerPlayer[]): RankerPlayer[] => {
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

  const boundaryCheck = (
    high: RankerPlayer[],
    low: RankerPlayer[]
  ): [RankerPlayer[], RankerPlayer[]] => {
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
