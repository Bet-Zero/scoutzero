export function pruneVolatile(x: any): any {
  if (x && typeof x === "object") {
    if (Array.isArray(x)) return x.map(pruneVolatile);
    const out: Record<string, any> = {};
    for (const k of Object.keys(x).sort()) {
      if (k === "scrapedAt" || k === "lastUpdated") continue;
      out[k] = pruneVolatile(x[k]);
    }
    return out;
  }
  return x;
}

export function deepStableStringify(obj: any): string {
  return JSON.stringify(pruneVolatile(obj), null, 2);
}
