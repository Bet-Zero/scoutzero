/** Historical regressions must use their original capture, never today's season. */
export function fixtureCaptureDate(scrapedAt: unknown): Date {
  if (typeof scrapedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(scrapedAt)) {
    throw new Error('Regression fixture requires its original source.scrapedAt capture date');
  }
  const date = new Date(scrapedAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== scrapedAt.slice(0, 10)) {
    throw new Error('Regression fixture has an invalid source.scrapedAt capture date');
  }
  return date;
}

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
