// stats/scripts/test_utils.ts
// Test utilities for stable JSON comparison (pruning volatile fields)

export function pruneVolatile(x: any): any {
  if (x && typeof x === "object") {
    if (Array.isArray(x)) return x.map(pruneVolatile);
    const out: Record<string, any> = {};
    for (const k of Object.keys(x).sort()) {
      // Prune timestamp fields
      if (k === "scrapedAt" || k === "lastUpdated") continue;
      // Prune USG% stat (ignored in comparisons) - can be at any level
      if (k === "USG%") continue;
      // Prune meta.lastStatsUpdate timestamps
      if (k === "meta" && x[k] && typeof x[k] === "object") {
        const metaPruned: Record<string, any> = {};
        for (const metaKey of Object.keys(x[k])) {
          if (metaKey !== "lastStatsUpdate") {
            metaPruned[metaKey] = pruneVolatile(x[k][metaKey]);
          }
        }
        out[k] = metaPruned;
        continue;
      }
      // Recursively prune nested objects (handles USG% inside stats objects)
      out[k] = pruneVolatile(x[k]);
    }
    return out;
  }
  return x;
}

export function deepStableStringify(obj: any): string {
  return JSON.stringify(pruneVolatile(obj), null, 2);
}

