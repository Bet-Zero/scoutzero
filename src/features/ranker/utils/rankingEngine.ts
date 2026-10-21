// src/features/ranker/utils/rankingEngine.ts

export type RankerPlayer = {
  id: string;
  group?: string | null;
  name?: string | null;
  display_name?: string | null;
  player_id?: string | null;
  headshot?: string | null;
  headshotUrl?: string | null;
  team?: string | number | null;
  bio?: {
    displayName?: string | null;
    display?: {
      team?: string | number | null;
      teamId?: string | number | null;
    } | null;
  } | null;
  original?: RankerPlayer;
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
  firstPlace?: string | null;
  lastPlace?: string | null;
};

type UsageCounts = Record<string, number>;

// A block is a run of players the engine currently treats as one section of
// the final order. Blocks start as the setup groups; when the edge players of
// two neighbouring blocks "break out" of their assumed order, the blocks merge
// and `seam` remembers both (already ordered) sides so the remaining
// cross-section matchups can be asked from the seam outward.
type RankerBlock = {
  members: RankerPlayer[];
  seam: { upper: RankerPlayer[]; lower: RankerPlayer[] } | null;
};

type RankingResolution = {
  blocks: RankerBlock[];
  nextPair: RankerPair;
};

// Setup groups from best to worst. Untagged players (or a missing group) sit in
// the middle "upper" section.
export const RANKER_GROUP_ORDER = [
  'first',
  'top',
  'upper',
  'anchor',
  'lower',
  'bottom',
  'last',
] as const;

const DEFAULT_GROUP_INDEX = RANKER_GROUP_ORDER.indexOf('upper');

const getGroupIndex = (group: string | null | undefined): number => {
  const index = RANKER_GROUP_ORDER.indexOf(
    (group ?? '') as (typeof RANKER_GROUP_ORDER)[number]
  );
  return index === -1 ? DEFAULT_GROUP_INDEX : index;
};

// Canonical, order-independent key for a skipped pair
export const getSkipKey = (a: string, b: string): string =>
  a < b ? `${a}<>${b}` : `${b}<>${a}`;

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

const buildClosure = (comparisons: readonly RankerComparison[]): RankerGraph => {
  const cache = createClosureCache();
  cache.rebuild(comparisons);
  return cache.closure;
};

// Tag each player with the setup group it starts in.
export function assignRankerGroups<T extends RankerPlayer>(
  players: readonly T[],
  comparisons: readonly RankerComparison[],
  setup: RankingGenerationOptions = {}
): Array<T & { group: string }> {
  const {
    topTier = [],
    bottomTier = [],
    anchor = null,
    firstPlace = null,
    lastPlace = null,
  } = setup;
  const top = new Set(topTier);
  const bottom = new Set(bottomTier);
  const beatAnchor = new Set<string>();
  if (anchor) {
    comparisons.forEach(({ winner, loser }) => {
      if (loser === anchor) beatAnchor.add(winner);
    });
  }

  return players.map((p) => {
    let group: string;
    if (p.id === firstPlace) group = 'first';
    else if (p.id === lastPlace) group = 'last';
    else if (p.id === anchor) group = 'anchor';
    else if (top.has(p.id)) group = 'top';
    else if (bottom.has(p.id)) group = 'bottom';
    else if (anchor) group = beatAnchor.has(p.id) ? 'upper' : 'lower';
    else group = 'upper';
    return { ...p, group };
  });
}

const hasSetupOptions = (options: RankingGenerationOptions): boolean =>
  Boolean(
    options.anchor ||
      options.firstPlace ||
      options.lastPlace ||
      options.topTier?.length ||
      options.bottomTier?.length
  );

// Order a block best-first by how many block-mates each player is known to beat
const orderBlock = (
  members: readonly RankerPlayer[],
  closure: RankerGraph
): RankerPlayer[] => {
  const wins = new Map<string, number>();
  members.forEach((p) => {
    wins.set(
      p.id,
      members.filter((q) => q.id !== p.id && closure[p.id]?.has(q.id)).length
    );
  });
  return members
    .map((player, index) => ({ player, index }))
    .sort(
      (a, b) =>
        (wins.get(b.player.id) ?? 0) - (wins.get(a.player.id) ?? 0) ||
        a.index - b.index
    )
    .map(({ player }) => player);
};

// Pick the next matchup inside one block. Returns the pair (or []) and whether
// the block still has any undecided matchup at all (skipped or not).
const pickPairInBlock = (
  block: RankerBlock,
  comparisons: readonly RankerComparison[],
  closure: RankerGraph,
  skipSet: Set<string>
): { pair: RankerPair; unresolved: boolean } => {
  const decided = (a: string, b: string): boolean =>
    Boolean(closure[a]?.has(b) || closure[b]?.has(a));

  if (block.seam) {
    // Merge two broken-out sections from the seam outward: the lower section's
    // best player keeps climbing and the upper section's worst keeps sinking
    // until every cross-section matchup is decided.
    const { upper, lower } = block.seam;
    let best: { pair: [RankerPlayer, RankerPlayer]; score: number } | null =
      null;
    let unresolved = false;
    for (let hi = 0; hi < upper.length; hi++) {
      for (let li = 0; li < lower.length; li++) {
        const h = upper[hi];
        const l = lower[li];
        if (decided(h.id, l.id)) continue;
        unresolved = true;
        if (skipSet.has(getSkipKey(h.id, l.id))) continue;
        // Nearest the seam first; on ties prefer the climber, then the sinker
        const fromSeam = upper.length - 1 - hi;
        const score =
          (fromSeam + li) * 4 + (li === 0 ? 0 : 2) + (fromSeam === 0 ? 0 : 1);
        if (!best || score < best.score) best = { pair: [h, l], score };
      }
    }
    return { pair: best ? best.pair : [], unresolved };
  }

  const members = block.members;
  if (members.length < 2) return { pair: [], unresolved: false };

  const idSet = new Set(members.map((p) => p.id));
  const blockComps = comparisons.filter(
    (c) => idSet.has(c.winner) && idSet.has(c.loser)
  );
  const usageCount: UsageCounts = {};
  members.forEach((p) => (usageCount[p.id] = 0));
  blockComps.forEach(({ winner, loser }) => {
    usageCount[winner]++;
    usageCount[loser]++;
  });

  let unresolved = false;

  // Phase 1: New vs New inside the block
  const unused = members.filter((p) => usageCount[p.id] === 0);
  for (let i = 0; i < unused.length; i++) {
    for (let j = i + 1; j < unused.length; j++) {
      if (decided(unused[i].id, unused[j].id)) continue;
      unresolved = true;
      if (!skipSet.has(getSkipKey(unused[i].id, unused[j].id))) {
        return { pair: [unused[i], unused[j]], unresolved };
      }
    }
  }

  // Phase 2: Usage-balanced unresolved matchups
  let best: { pair: [RankerPlayer, RankerPlayer]; score: number } | null = null;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      if (decided(a.id, b.id)) continue;
      unresolved = true;
      if (skipSet.has(getSkipKey(a.id, b.id))) continue;
      const usageGap = Math.abs(usageCount[a.id] - usageCount[b.id]);
      const score = usageCount[a.id] + usageCount[b.id] + usageGap * 2;
      if (!best || score < best.score) best = { pair: [a, b], score };
    }
  }

  return { pair: best ? best.pair : [], unresolved };
};

// Walk the blocks: settle each block internally, then confirm each boundary by
// matching the worst player above against the best player below. A boundary
// that holds confirms the whole cutoff (by transitivity); one that breaks merges
// the two blocks so the misplaced players can slide into their true spots.
const resolveRanking = (
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[],
  closure: RankerGraph,
  skipSet: Set<string>
): RankingResolution => {
  const segments = new Map<number, RankerPlayer[]>();
  players.forEach((p) => {
    const index = getGroupIndex(p.group);
    const list = segments.get(index) ?? [];
    list.push(p);
    segments.set(index, list);
  });
  let blocks: RankerBlock[] = [...segments.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, members]) => ({ members, seam: null }));

  const beats = (a: string, b: string): boolean =>
    Boolean(closure[a]?.has(b));

  for (;;) {
    let blockedBySkips = false;
    for (const block of blocks) {
      const { pair, unresolved } = pickPairInBlock(
        block,
        comparisons,
        closure,
        skipSet
      );
      if (pair.length) return { blocks, nextPair: pair };
      if (unresolved) blockedBySkips = true;
    }
    // Boundaries can only be judged once every block is fully ordered
    if (blockedBySkips) return { blocks, nextPair: [] };

    const ordered = blocks.map((b) => orderBlock(b.members, closure));
    let mergedAt = -1;
    for (let i = 0; i < blocks.length - 1; i++) {
      const high = ordered[i];
      const low = ordered[i + 1];
      const worstHigh = high[high.length - 1];
      const bestLow = low[0];
      if (beats(worstHigh.id, bestLow.id)) continue;
      if (beats(bestLow.id, worstHigh.id)) {
        mergedAt = i;
        break;
      }
      if (skipSet.has(getSkipKey(worstHigh.id, bestLow.id))) {
        return { blocks, nextPair: [] };
      }
      return { blocks, nextPair: [worstHigh, bestLow] };
    }

    if (mergedAt === -1) return { blocks, nextPair: [] };

    const high = ordered[mergedAt];
    const low = ordered[mergedAt + 1];
    blocks = [
      ...blocks.slice(0, mergedAt),
      { members: [...high, ...low], seam: { upper: high, lower: low } },
      ...blocks.slice(mergedAt + 2),
    ];
  }
};

// Suggest the next matchup. Players carry a `group` from setup; groups are
// settled first, then the edges between neighbouring groups are checked.
export function suggestNextPair(
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[],
  { skippedPairs, closureCache }: SuggestNextPairOptions = {}
): RankerPair {
  if (players.length < 2) return [];

  const closure = closureCache ? closureCache.closure : buildClosure(comparisons);
  const skipSet = skippedPairs || new Set<string>();

  const { nextPair } = resolveRanking(comparisons, players, closure, skipSet);
  if (nextPair.length || skipSet.size === 0) return nextPair;

  // Only skipped matchups remain — offer them again rather than ending early
  return resolveRanking(comparisons, players, closure, new Set()).nextPair;
}

const log2Factorial = (n: number): number => {
  let total = 0;
  for (let i = 2; i <= n; i++) total += Math.log2(i);
  return total;
};

// Estimate how many more comparisons are needed (a forecast, not a promise)
export function estimateRemainingComparisons(
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[],
  { closureCache }: Pick<SuggestNextPairOptions, 'closureCache'> = {}
): number {
  if (players.length < 2) return 0;

  const closure = closureCache ? closureCache.closure : buildClosure(comparisons);
  const decided = (a: string, b: string): boolean =>
    Boolean(closure[a]?.has(b) || closure[b]?.has(a));
  const { blocks } = resolveRanking(comparisons, players, closure, new Set());

  let remaining = 0;
  const resolvedBlocks = blocks.map((block) => {
    const { members, seam } = block;
    let undecided = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (!decided(members[i].id, members[j].id)) undecided++;
      }
    }
    if (undecided === 0) return true;

    const idSet = new Set(members.map((p) => p.id));
    const made = comparisons.filter(
      (c) => idSet.has(c.winner) && idSet.has(c.loser)
    ).length;
    const budget = seam
      ? seam.upper.length +
        seam.lower.length -
        1 -
        (made - countInside(seam, comparisons))
      : Math.ceil(log2Factorial(members.length)) - made;
    remaining += Math.min(undecided, Math.max(1, budget));
    return false;
  });

  // Each unconfirmed boundary costs at least one edge matchup
  for (let i = 0; i < blocks.length - 1; i++) {
    if (!resolvedBlocks[i] || !resolvedBlocks[i + 1]) {
      remaining++;
      continue;
    }
    const high = orderBlock(blocks[i].members, closure);
    const low = orderBlock(blocks[i + 1].members, closure);
    if (!decided(high[high.length - 1].id, low[0].id)) remaining++;
  }

  return remaining;
}

// Comparisons made inside each side of a seam (i.e. before the sides merged)
const countInside = (
  seam: NonNullable<RankerBlock['seam']>,
  comparisons: readonly RankerComparison[]
): number => {
  const upperIds = new Set(seam.upper.map((p) => p.id));
  const lowerIds = new Set(seam.lower.map((p) => p.id));
  return comparisons.filter(
    (c) =>
      (upperIds.has(c.winner) && upperIds.has(c.loser)) ||
      (lowerIds.has(c.winner) && lowerIds.has(c.loser))
  ).length;
};

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

// Seed comparisons implied by the #1 / last-place lock-ins
export function buildLockInComparisons(
  players: readonly RankerPlayer[],
  { firstPlace = null, lastPlace = null }: RankingGenerationOptions = {}
): RankerComparison[] {
  const seeds: RankerComparison[] = [];
  if (firstPlace) {
    players.forEach((p) => {
      if (p.id !== firstPlace) seeds.push({ winner: firstPlace, loser: p.id });
    });
  }
  if (lastPlace) {
    players.forEach((p) => {
      if (p.id !== lastPlace && p.id !== firstPlace) {
        seeds.push({ winner: p.id, loser: lastPlace });
      }
    });
  }
  return seeds;
}

// ========== 🏁 FINAL RANKING LOGIC ==========

export const generateRankingFromComparisons = (
  comparisons: readonly RankerComparison[],
  players: readonly RankerPlayer[],
  options: RankingGenerationOptions = {}
): RankerPlayer[] => {
  const grouped = hasSetupOptions(options)
    ? assignRankerGroups(players, comparisons, options)
    : players;
  const closure = buildClosure(comparisons);
  const { blocks } = resolveRanking(comparisons, grouped, closure, new Set());

  const byId = new Map(players.map((p) => [p.id, p]));
  return blocks
    .flatMap((block) => orderBlock(block.members, closure))
    .map((p) => byId.get(p.id) ?? p);
};
