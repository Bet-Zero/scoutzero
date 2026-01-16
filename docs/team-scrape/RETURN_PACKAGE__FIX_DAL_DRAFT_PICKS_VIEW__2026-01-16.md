# Return Package: Fix DAL Draft Picks View

**Date:** 2026-01-16
**Author:** Antigravity

## 1. Objective

Fix the Dallas Mavericks (DAL) draft picks assets in the Trade Machine to precisely match the "team-facing holdings view" as depicted on Fanspo (9 picks). This involves handling encumbered picks where DAL retains the asset despite a pending swap, and ensuring that definitively outgoing picks are excluded.

## 2. Summary of Changes

### A. Logic Refinement (`buildDraftAssets.ts`)

The `classifyAssetType` logic was updated to better handle edge cases in pick ownership and conveyance:

1. **Inventory "Outgoing" Fix (Validity Check)**:
    * Picks marked as `status: outgoing` in inventory (often due to parsing "To TEAM" on another team's page) are now validated.
    * **Rule:** If `recipient === teamCode`, we verify the conveyance **Route**.
        * If the route ends in another team (e.g., `SAS_2027_2nd` Route: SAS -> DAL -> DET), the pick is excluded.
        * If the route implies we keep it (e.g., `LAL_2029_1st` Route: LAL -> DAL), the pick is included.
    * **Impact:** Correctly removed `SAS_2027_2nd` (false positive) and kept `LAL_2029_1st` (false negative).

2. **Encumbered Picks Inclusion**:
    * Picks that are `contested` (usually due to swaps) are now considered **Assets** (`outright_pick`) if the team is the **Original Owner** and **Current Owner**, even if the `recipient` field points elsewhere (e.g., to a swap partner).
    * **Impact:** Resurrected `DAL_2029_1st` and `DAL_2030_1st` (Swap Encumbered), bringing DAL's total to the expected 9.

### B. Verification Tooling (`generate_draft_assets_manual_check_md.ts`)

The manual check script was significantly enhanced to serve as a strict verification gate:

1. **Expected Counts Enforcement**: Added `EXPECTED_COUNTS` map (DAL: 9). The script now checks generated counts against this map.
2. **Exit Code**: Script now exits with `1` if mismatches are found, ensuring `npm run draft-picks:verify` fails on count regression.
3. **Improved Output**: cleaned up "Origin" strings to properly show `own` vs `via XXX` for encumbered picks, making manual cross-referencing easier.

## 3. Verification Results

### DAL Manual Check

**Command:** `npm run draft-picks:assets-manual-check -- --teams=DAL`
**Result:** ✅ 9 Picks

| Year | Round | Origin | Status | Logic Applied |
| :--- | :--- | :--- | :--- | :--- |
| 2026 | 1 | own | Asset | Standard Inventory |
| 2027 | 2 | via SAS | **REMOVED** | Route Check (Ends in DET) |
| 2028 | 1 | own | Encumbered | Standard Own |
| 2029 | 1 | via LAL | **ADDED** | Inventory w/ Route Validation |
| 2029 | 1 | own | **ADDED** | Contested/Encumbered Ownership |
| 2030 | 1 | own | **ADDED** | Contested/Encumbered Ownership |
| 2030 | 2 | via PHI | Asset | Recipient |
| 2031 | 1 | own | Asset | Standard Inventory |
| 2032 | 1 | own | Asset | Standard Inventory |
| 2032 | 2 | own | Asset | Standard Inventory |

### Full Pipeline Verification

**Command:** `npm run draft-picks:verify`
**Status:** ✅ Passed
* **Build:** Successful
* **Manual Check:** Passed (DAL = 9 verified)
* **Audits:** Passed (30/30 teams coverage, 0 failures)

## 4. Adjusted Files
* `team-scrape/shared/ledger/buildDraftAssets.ts`
* `team-scrape/draft-picks/scripts/generate_draft_assets_manual_check_md.ts`

## 5. Git Diff

```diff
diff --git a/team-scrape/draft-picks/scripts/generate_draft_assets_manual_check_md.ts b/team-scrape/draft-picks/scripts/generate_draft_assets_manual_check_md.ts
index 73e6d24a..f8021c17 100644
--- a/team-scrape/draft-picks/scripts/generate_draft_assets_manual_check_md.ts
+++ b/team-scrape/draft-picks/scripts/generate_draft_assets_manual_check_md.ts
@@ -19,6 +19,11 @@ import fs from "fs";
 import path from "path";
 
+// Expected counts for validation (User verified)
+const EXPECTED_COUNTS: Record<string, number> = {
+  'DAL': 9
+};
+
 // Default paths
 const DEFAULT_ASSETS_DIR =
   "team-scrape/shared/firestore_staging/_artifacts/output/draft_assets";
@@ -176,14 +181,19 @@ function sortAssets(assets: DraftAsset[]): DraftAsset[] {
  * - swap XXX: swap right with single counterparty
  * - swap pool: XXX/YYY/ZZZ: multi-team swap pool
  */
-function getOrigin(asset: DraftAsset, teamCode: string): string {
-  const isOwn = asset.originalTeam === teamCode;
-  const isSwap = asset.assetType === "swap_right" || asset.isSwap;
-
-  if (isSwap && asset.swapDetails) {
-    const sd = asset.swapDetails;
-
-    // Check for pool teams (multi-team swap)
-    if (sd.poolTeams && sd.poolTeams.length > 0) {
-      const poolStr = sd.poolTeams.join("/");
-      return `swap pool: ${poolStr}`;
-    }
-
-    // Check for swapWith
-    if (sd.swapWith && sd.swapWith.length > 0) {
-      if (sd.swapWith.length === 1) {
-        return `swap ${sd.swapWith[0]}`;
-      } else {
-        return `swap pool: ${sd.swapWith.join("/")}`;
-      }
-    }
-
-    // Check controller as fallback
-    if (sd.controller) {
-      return `swap ${sd.controller}`;
-    }
-
-    // Fallback for unresolved swaps
-    return "swap (multi)";
+function getOrigin(asset: DraftAsset): string {
+  // If explicitly a swap right (control)
+  if (asset.assetType === 'swap_right') {
+     if (asset.swapDetails && (asset.swapDetails as any).swapWith) {
+        const others = (asset.swapDetails as any).swapWith.filter((t: string) => t !== asset.team);
+        if (others.length === 1) return `swap ${others[0]}`;
+        if (others.length > 0) return `swap pool: ${others.join('/')}`;
+     }
+     return 'swap right';
   }
 
-  // Non-swap cases
-  if (isOwn) {
-    return "own";
+  // If it's an outright or conditional pick (even if encumbered/swappable)
+  if (asset.originalTeam === asset.team) {
+    return 'own';
   }
 
-  // Via case: received from another team
-  return `via ${asset.originalTeam}`;
+  return `via ${asset.originalTeam}`;
 }
 
 /**
@@ -303,28 +313,28 @@ function getSwapHierarchy(asset: DraftAsset): string {
  * - For conditional: protection text
  * - For via picks: "unprotected" if no protection
  */
-function getConditions(asset: DraftAsset, teamCode: string): string {
-  const isSwap = asset.assetType === "swap_right" || asset.isSwap;
-  const isOwn = asset.originalTeam === teamCode;
-
-  // For swaps, show hierarchy
-  if (isSwap) {
-    const hierarchy = getSwapHierarchy(asset);
-    if (hierarchy) return hierarchy;
-
-    // If swap but no hierarchy detected, return empty
-    return "";
+function getConditions(asset: DraftAsset): string {
+  const parts: string[] = [];
+  
+  if (asset.protection) {
+    parts.push(normalizeProtection(asset.protection));
+  } else if (asset.assetType === 'conditional_right') {
+    parts.push('conditional');
+  } else if (asset.assetType === 'outright_pick' && asset.originalTeam !== asset.team) {
+    // Only show "unprotected" for incoming picks to distinguish from protected ones
+    parts.push('unprotected');
   } 
-
-  // For conditional rights with protection
-  if (asset.protection) {
-    return normalizeProtection(asset.protection);
-  }
-
-  // For "via" picks without protection -> unprotected
-  if (!isOwn && asset.assetType !== "swap_right") {
-    return "unprotected";
-  }
-
-  // Own picks with no protection - leave blank
-  return "";
+  
+  // Show swap info for encumbered picks
+  if (asset.isSwap && asset.swapDetails) {
+     const controller = (asset.swapDetails as any).controller;
+     if (controller && controller !== asset.team) {
+         // It's encumbered by someone else's swap right
+         parts.push(`swap ${controller}`);
+     } else if (asset.assetType === 'swap_right') {
+         // It IS a swap right (already handled in Origin?)
+         // Maybe add hierarchy here
+         const h = getSwapHierarchy(asset);
+         if (h) parts.push(h);
+     } else {
+         // Encumbered but unknown controller or complex
+         const h = getSwapHierarchy(asset);
+         if (h) parts.push(h);
+         else parts.push('swap attached');
+     }
   }
 
+  return parts.join(', ');
 }
 
 /**
@@ -338,8 +329,8 @@ function getConditions(asset: DraftAsset, teamCode: string): string {
 function formatAssetLine(asset: DraftAsset, teamCode: string): string {
   const year = asset.year;
   const round = roundLabel(asset.round);
-  const origin = getOrigin(asset, teamCode);
-  const conditions = getConditions(asset, teamCode);
+  const origin = getOrigin(asset);
+  const conditions = getConditions(asset);
 
   if (conditions) {
     return `${year} | ${round} | ${origin} | ${conditions}`;
@@ -419,6 +410,7 @@ function main() {
 
   let totalAssets = 0;
   let teamsProcessed = 0;
+  const actualCounts: Record<string, number> = {};
 
   for (const team of teams) {
     const data = loadDraftAssets(assetsDir, team);
@@ -429,6 +421,7 @@ function main() {
 
     const assets = data.picks || [];
     totalAssets += assets.length;
+    actualCounts[team] = assets.length;
     teamsProcessed++;
 
     lines.push(...generateTeamSection(team, assets));
@@ -453,6 +446,33 @@ function main() {
   console.log(`✔ Wrote: ${out}`);
   console.log(`  Teams: ${teamsProcessed}`);
   console.log(`  Total picks: ${totalAssets}`);
+
+  // Count Verification
+  console.log('\n🔍 Verifying counts against expected values...');
+  const failures: Array<{team: string, expected: number, actual: number}> = [];
+
+  for (const [team, expected] of Object.entries(EXPECTED_COUNTS)) {
+    if (teams.includes(team)) {
+      const actual = actualCounts[team] || 0;
+      if (actual !== expected) {
+        failures.push({ team, expected, actual });
+      }
+    }
+  }
+
+  if (failures.length > 0) {
+    console.error('\n❌ COUNT MISMATCHES DETECTED:');
+    console.error('Team | Your Count | File Count | Diff');
+    console.error('---|---|---|---');
+    for (const f of failures) {
+      const diff = f.actual - f.expected;
+      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
+      console.error(`${f.team} | ${f.expected} | ${f.actual} | ${diffStr}`);
+    }
+    process.exit(1);
+  } else {
+    console.log('✅ All checked teams match expected counts.');
+  }
 }
 
 main();
diff --git a/team-scrape/shared/ledger/buildDraftAssets.ts b/team-scrape/shared/ledger/buildDraftAssets.ts
index 4c8a0450..dd9c18b3 100644
--- a/team-scrape/shared/ledger/buildDraftAssets.ts
+++ b/team-scrape/shared/ledger/buildDraftAssets.ts
@@ -320,60 +320,100 @@ function serialize(obj: unknown, pretty = true): string {
  * Determines asset type for a pick based on its properties
  */
 function classifyAssetType(pick: LedgerPick, teamCode: string): AssetType | null {
-  // Swap rights
+  // 1. Swap Rights
+  // Only assign swap_right if the team explicitly CONTROLS the swap.
+  // Merely being involved in a swap (as the pick holder) does not grant a swap_right asset.
   if (pick.isSwap || pick.swapDetails) {
-    // Team must be involved in the swap
-    if (
-      pick.owner === teamCode ||
-      pick.originalTeam === teamCode ||
-      pick.swapDetails?.swapWith?.includes(teamCode) ||
-      pick.swapDetails?.controller === teamCode
-    ) {
+    const controller = pick.swapDetails?.controller;
+    
+    // Strict verification: Controller must match teamCode
+    if (controller && normalizeTeamCode(controller) === teamCode) {
       return 'swap_right';
     }
-    return null;
   }
 
-  // Conditional rights (protected picks, conditional status)
+  // 2. Conditional Rights
+  // If the pick is conditional/protected, determine beneficiary
   if (
     pick.status === 'conditional' ||
     (pick.protection && pick.protection.trim() !== '')
   ) {
-    // For conditional picks, the beneficiary (recipient team) gets the conditional_right
-    // NOT the owner (who retains it if protection triggers)
     const beneficiary = extractBeneficiaryTeam(pick);
     
     if (beneficiary) {
-      // If this team is the beneficiary, they get the conditional_right asset
-      if (beneficiary === teamCode) {
-        return 'conditional_right';
-      }
-      // If this team is the owner but NOT the beneficiary, skip - they retain conditionally
-      // but it's not a tradeable asset for them
-      return null;
-    }
-    
-    // Fallback: if no explicit beneficiary found but team is recipient, assign conditional_right
-    if (pick.recipient === teamCode) {
-      return 'conditional_right';
+      if (beneficiary === teamCode) return 'conditional_right';
+      return null; // Owned by team but goes to someone else
     }
     
+    // Fallback: use recipient
+    if (pick.recipient === teamCode) return 'conditional_right';
     return null;
   }
 
-  // Outright picks (unconditional ownership)
+  // 3. Outright Picks (including Encumbered Picks)
+  // An asset is an outright pick if:
+  // - The team is the explicit recipient (e.g. from a trade/swap result)
+  // - OR The team is the owner AND it's not outgoing/conditional
+  //
+  // NOTE: We now ALLOW isSwap=true here. This covers "Encumbered Picks" 
+  // (picks owned by the team but subject to a swap controlled by another team).
+  
+  const isRecipient = pick.recipient === teamCode;
+  
+  // For contested picks (like swap results), we MUST rely on recipient or resolved ownership
+  if (pick.status === 'contested') {
+     // Scenario A: We are the designated recipient (e.g. PHI_2030_2nd -> DAL)
+     if (isRecipient) {
+        // Enforce route check (Fix for SAS_2027_2nd where recipient=DAL but route=DET)
+        if (pick.route && pick.route.length > 0) {
+            const lastStop = pick.route[pick.route.length - 1];
+            if (normalizeTeamCode(lastStop) !== teamCode) {
+                 return null;
+            }
+        }
+        return 'outright_pick';
+     }
+
+     // Scenario B: We are the original owner AND current owner (Encumbered)
+     if (pick.owner === teamCode && pick.originalTeam === teamCode) {
+        return 'outright_pick';
+     }
+
+     return null;
+  }
+  
+  // For normal inventory
+  // Critical Fix: Explicitly exclude 'outgoing' status UNLESS confirmation via Route
+  if (pick.status === 'outgoing') {
+      if (!isRecipient) return null;
+
+      if (pick.route && pick.route.length > 0) {
+          const lastStop = pick.route[pick.route.length - 1];
+          if (normalizeTeamCode(lastStop) !== teamCode) return null;
+      }
+  }
+
   if (
     (pick.status === 'own' || pick.status === 'incoming') &&
-    pick.owner === teamCode &&
-    !pick.protection &&
-    !pick.isSwap
+    (pick.owner === teamCode || isRecipient) &&
+    !pick.protection
   ) {
     return 'outright_pick';
   }
 
-  // Fallback: if team owns it and it's in inventory, treat as outright
+  // Fallback for inventory items
   if (pick.owner === teamCode && pick.relation === 'inventory') {
-    return 'outright_pick';
+     if (pick.recipient && pick.recipient !== teamCode) return null;
+     
+     if (pick.status === 'outgoing') {
+         if (!isRecipient) return null;
+         if (pick.route && pick.route.length > 0) {
+             const lastStop = pick.route[pick.route.length - 1];
+             if (normalizeTeamCode(lastStop) !== teamCode) return null;
+         }
+     }
+
+     return 'outright_pick';
   }
 
   return null;
```
