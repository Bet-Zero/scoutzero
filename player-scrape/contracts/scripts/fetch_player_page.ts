import fs from "node:fs/promises";
import path from "node:path";
import { paths, isRegressionFixture } from "./config";

/**
 * getPlayerHtml
 * - If playerId is in the regression set and snapshot exists, return it.
 * - Else fetch live HTML from sourceUrl.
 * - NEVER write per-player HTML to disk in production flows.
 */
export async function getPlayerHtml(playerId: string, sourceUrl: string): Promise<string> {
  if (isRegressionFixture(playerId)) {
    const snapshotPath = path.join(paths.snapshotsDir, `${playerId}.html`);
    try {
      return await fs.readFile(snapshotPath, "utf8");
    } catch {
      // fall through to live fetch if snapshot missing
    }
  }
  const res = await fetch(sourceUrl, { cache: "no-store", mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${res.status}`);
  return await res.text();
}
