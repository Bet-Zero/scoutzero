/**
 * FILE: src/features/ranker/utils/exportImages.ts
 * PURPOSE: Wait for an offscreen export's images before capturing it as a picture
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created with the size-aware export layouts
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingResults.tsx
 */

// Resolves once every image in the export has loaded or failed (capped, so a
// stuck image can't block the download)
export const waitForImages = (root: HTMLElement, timeoutMs = 8000) =>
  Promise.race([
    Promise.all(
      Array.from(root.querySelectorAll('img')).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
