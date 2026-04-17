# Architect Type Cast Ledger

**Generated:** 2026-04-17 · **Total entries:** 167 (21 pre-filled, 146 TODO)

Companion to [.architect-cast-baseline.json](../../.architect-cast-baseline.json) and the gate at [scripts/architect-cast-gate.mjs](../../scripts/architect-cast-gate.mjs). Cross-reference: [ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md](ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md) defines Items 2–5 referenced in the Seam column.

## Protocol (four invariants)

**Invariant 1 — Baseline only goes down.** A PR may keep the per-file/per-bucket counts in [.architect-cast-baseline.json](../../.architect-cast-baseline.json) equal or reduce them. A PR may never increase them unless the new exception meets every part of Invariant 2.

**Invariant 2 — New exceptions require all four:**

1. Inline `eslint-disable-next-line` comment scoped to **the exact rule** being suppressed. No broad `eslint-disable-next-line` without a rule name; no file-level `eslint-disable`.
2. The disable comment includes a `-- LEDGER:CAST-NNN` tag.
3. A matching `CAST-NNN` row exists in this file.
4. The ledger row's Reason column is **non-placeholder** — actual prose explaining why the cast is load-bearing, with a seam reference (`Item 2`/`Item 3`/`Item 4`/`Item 5` from the deferred-work doc, or `STANDALONE`).

PR rejected if any of the four are missing.

**Invariant 3 — Removing a cast updates both stores.** Remove the inline comment (if present), the ledger row below, and regenerate the baseline with `node scripts/architect-cast-gate.mjs --write` in the same PR.

**Invariant 4 — Break-glass clause.** Temporary unledgered exceptions are forbidden except in a break-glass situation explicitly approved by the repo owner (e.g., production hotfix). Any break-glass exception must be converted to a properly-ledgered exception in the immediately-following PR. No "just this once" without a same-week follow-up.

## Seam references

Seam IDs in the table below map to the architectural work items in [ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md](ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md):

- **Item 2** — `leagueInvariants.ts` legacy payload field audit
- **Item 3** — `ArchitectContract` catch-all index signature
- **Item 4** — `ArchitectMutationTeamRecord.totals` dual-shape split
- **Item 5** — `as never` casts caused by JS-migrated utilities
- **STANDALONE** — load-bearing exception not part of a known multi-file seam
- **TODO** — awaiting categorization; needs a reading of the surrounding code to decide

When a seam is fixed, delete every ledger row tagged with that Item together, update the baseline, and remove the corresponding inline disable comments (if any).

## Entries

| ID | File:line | Pattern | Seam | Reason |
| -- | --------- | ------- | ---- | ------ |
| CAST-001 | src/features/architect/freeAgency/FreeAgentPool/types.ts:29 | `[key: string]: unknown` | TODO | TODO |
| CAST-002 | src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1525 | `any` | TODO | TODO |
| CAST-003 | src/features/architect/history/TeamHistoryTab/types.ts:119 | `[key: string]: unknown` | TODO | TODO |
| CAST-004 | src/features/architect/hooks/useArchitectPlayerData.ts:18 | `any` | TODO | TODO |
| CAST-005 | src/features/architect/hooks/usePlayerRulesProfiles.ts:92 | `as unknown as` | TODO | TODO |
| CAST-006 | src/features/architect/hooks/usePlayerRulesProfiles.ts:93 | `as unknown as` | TODO | TODO |
| CAST-007 | src/features/architect/hooks/useTradeMachine.ts:697 | `any` | TODO | TODO |
| CAST-008 | src/features/architect/hooks/useTradeMachine.ts:1140 | `as unknown as` | TODO | TODO |
| CAST-009 | src/features/architect/hooks/useTradeMachine.ts:1141 | `as unknown as` | TODO | TODO |
| CAST-010 | src/features/architect/hooks/useTradeMachine.ts:1159 | `as unknown as` | TODO | TODO |
| CAST-011 | src/features/architect/hooks/useTradeMachine.ts:1207 | `as unknown as` | TODO | TODO |
| CAST-012 | src/features/architect/hooks/useTradeMachine.ts:1265 | `any` | TODO | TODO |
| CAST-013 | src/features/architect/hooks/useTradeMachineSnapshot.ts:26 | `[key: string]: unknown` | TODO | TODO |
| CAST-014 | src/features/architect/hooks/useTradeMachineSnapshot.ts:31 | `[key: string]: unknown` | TODO | TODO |
| CAST-015 | src/features/architect/hooks/useTradeMachineSnapshot.ts:37 | `[key: string]: unknown` | TODO | TODO |
| CAST-016 | src/features/architect/hooks/useTradeMachineSnapshot.ts:42 | `[key: string]: unknown` | TODO | TODO |
| CAST-017 | src/features/architect/hooks/useTradeMachineSnapshot.ts:49 | `[key: string]: unknown` | TODO | TODO |
| CAST-018 | src/features/architect/hooks/useTradeMachineSnapshot.ts:66 | `[key: string]: unknown` | TODO | TODO |
| CAST-019 | src/features/architect/hooks/useTradeMachineSnapshot.ts:71 | `[key: string]: unknown` | TODO | TODO |
| CAST-020 | src/features/architect/hooks/useTradeMachineSnapshot.ts:83 | `[key: string]: unknown` | TODO | TODO |
| CAST-021 | src/features/architect/offseason/OffseasonTab/types.ts:39 | `[key: string]: unknown` | TODO | TODO |
| CAST-022 | src/features/architect/offseason/OffseasonTab/types.ts:44 | `[key: string]: unknown` | TODO | TODO |
| CAST-023 | src/features/architect/offseason/OffseasonTab/types.ts:54 | `[key: string]: unknown` | TODO | TODO |
| CAST-024 | src/features/architect/offseason/OffseasonTab/types.ts:60 | `[key: string]: unknown` | TODO | TODO |
| CAST-025 | src/features/architect/shared/RosterVisual/RosterVisual.tsx:30 | `[key: string]: unknown` | TODO | TODO |
| CAST-026 | src/features/architect/shared/RosterVisual/RosterVisual.tsx:40 | `[key: string]: unknown` | TODO | TODO |
| CAST-027 | src/features/architect/shared/RosterVisual/RosterVisual.tsx:43 | `[key: string]: unknown` | TODO | TODO |
| CAST-028 | src/features/architect/tradeMachine/CapImpactTiles.tsx:51 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-029 | src/features/architect/tradeMachine/CapImpactTiles.tsx:67 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-030 | src/features/architect/tradeMachine/CapImpactTiles.tsx:74 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-031 | src/features/architect/tradeMachine/CapImpactTiles.tsx:90 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-032 | src/features/architect/tradeMachine/CapImpactTiles.tsx:90 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-033 | src/features/architect/tradeMachine/CapImpactTiles.tsx:91 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-034 | src/features/architect/tradeMachine/CapImpactTiles.tsx:91 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-035 | src/features/architect/tradeMachine/EntitlementPickRow.tsx:110 | `as unknown as` | TODO | TODO |
| CAST-036 | src/features/architect/tradeMachine/OutgoingPlayersList.tsx:78 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-037 | src/features/architect/tradeMachine/OutgoingPlayersList.tsx:78 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-038 | src/features/architect/tradeMachine/TradePlayerRow.tsx:134 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-039 | src/features/architect/tradeMachine/TradePlayerRow.tsx:134 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-040 | src/features/architect/tradeMachine/TradePlayerRow.tsx:139 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-041 | src/features/architect/tradeMachine/TradePlayerRow.tsx:155 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-042 | src/features/architect/tradeMachine/TradePlayerRow.tsx:272 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-043 | src/features/architect/tradeMachine/TradePlayerRow.tsx:434 | `as never` | Item 5 | JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side. |
| CAST-044 | src/features/architect/tradeMachine/TradeReceiptPanel.tsx:421 | `any` | TODO | TODO |
| CAST-045 | src/features/architect/tradeMachine/TradeReceiptPanel.tsx:471 | `any` | TODO | TODO |
| CAST-046 | src/features/architect/tradeMachine/TradeSummaryPanel.tsx:321 | `any` | TODO | TODO |
| CAST-047 | src/features/architect/tradeMachine/TradeSummaryPanel.tsx:383 | `any` | TODO | TODO |
| CAST-048 | src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts:42 | `[key: string]: unknown` | TODO | TODO |
| CAST-049 | src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts:49 | `[key: string]: unknown` | TODO | TODO |
| CAST-050 | src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts:57 | `[key: string]: unknown` | TODO | TODO |
| CAST-051 | src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts:67 | `[key: string]: unknown` | TODO | TODO |
| CAST-052 | src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts:72 | `[key: string]: unknown` | TODO | TODO |
| CAST-053 | src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts:81 | `[key: string]: unknown` | TODO | TODO |
| CAST-054 | src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts:86 | `[key: string]: unknown` | TODO | TODO |
| CAST-055 | src/features/architect/utils/capHoldTransitionHelpers.ts:88 | `[key: string]: unknown` | TODO | TODO |
| CAST-056 | src/features/architect/utils/capLegality/localCapAuditLog.ts:39 | `[key: string]: unknown` | STANDALONE | Cap-legality adapter boundary — see `memory/MEMORY.md` "Cap Legality Validation Hardening Pass". Loose field retained for ArchitectDashboardPlayer callers and draftPick object shapes. |
| CAST-057 | src/features/architect/utils/capLegalityValidation.ts:109 | `[key: string]: unknown` | STANDALONE | Cap-legality adapter boundary — see `memory/MEMORY.md` "Cap Legality Validation Hardening Pass". Loose field retained for ArchitectDashboardPlayer callers and draftPick object shapes. |
| CAST-058 | src/features/architect/utils/capLegalityValidation.ts:769 | `as unknown as` | TODO | TODO |
| CAST-059 | src/features/architect/utils/capLegalityValidation.ts:1333 | `any` | STANDALONE | Cap-legality adapter boundary — see `memory/MEMORY.md` "Cap Legality Validation Hardening Pass". Loose field retained for ArchitectDashboardPlayer callers and draftPick object shapes. |
| CAST-060 | src/features/architect/utils/capRulesProfile/capRulesProfile.ts:387 | `any` | TODO | TODO |
| CAST-061 | src/features/architect/utils/capTotals/computeTeamCapTotals.ts:46 | `[key: string]: unknown` | TODO | TODO |
| CAST-062 | src/features/architect/utils/capTotals/computeTeamCapTotals.ts:193 | `any` | TODO | TODO |
| CAST-063 | src/features/architect/utils/capTotals/computeTeamCapTotals.ts:202 | `any` | TODO | TODO |
| CAST-064 | src/features/architect/utils/capTotals/deadMoneyForYear.ts:30 | `[key: string]: unknown` | TODO | TODO |
| CAST-065 | src/features/architect/utils/capTotals/hardCapSnapshotOverlay.ts:16 | `[key: string]: unknown` | TODO | TODO |
| CAST-066 | src/features/architect/utils/contractNormalization.ts:27 | `[key: string]: unknown` | TODO | TODO |
| CAST-067 | src/features/architect/utils/contractNormalization.ts:40 | `[key: string]: unknown` | TODO | TODO |
| CAST-068 | src/features/architect/utils/contractNormalization.ts:42 | `[key: string]: unknown` | TODO | TODO |
| CAST-069 | src/features/architect/utils/contractNormalization.ts:52 | `[key: string]: unknown` | TODO | TODO |
| CAST-070 | src/features/architect/utils/contractNormalization.ts:67 | `[key: string]: unknown` | TODO | TODO |
| CAST-071 | src/features/architect/utils/contractNormalization.ts:77 | `[key: string]: unknown` | TODO | TODO |
| CAST-072 | src/features/architect/utils/contractNormalization.ts:89 | `[key: string]: unknown` | TODO | TODO |
| CAST-073 | src/features/architect/utils/contractNormalization.ts:98 | `[key: string]: unknown` | TODO | TODO |
| CAST-074 | src/features/architect/utils/contractSalaryUtils.ts:16 | `any` | TODO | TODO |
| CAST-075 | src/features/architect/utils/contractSalaryUtils.ts:22 | `[key: string]: unknown` | TODO | TODO |
| CAST-076 | src/features/architect/utils/contractSalaryUtils.ts:26 | `[key: string]: unknown` | TODO | TODO |
| CAST-077 | src/features/architect/utils/contractSalaryUtils.ts:35 | `[key: string]: unknown` | TODO | TODO |
| CAST-078 | src/features/architect/utils/contractSalaryUtils.ts:38 | `any` | TODO | TODO |
| CAST-079 | src/features/architect/utils/contractUtils.ts:37 | `[key: string]: unknown` | TODO | TODO |
| CAST-080 | src/features/architect/utils/contractUtils.ts:51 | `[key: string]: unknown` | TODO | TODO |
| CAST-081 | src/features/architect/utils/contractUtils.ts:63 | `[key: string]: unknown` | TODO | TODO |
| CAST-082 | src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts:93 | `[key: string]: unknown` | TODO | TODO |
| CAST-083 | src/features/architect/utils/entitlements/entitlementHealthReport.ts:37 | `[key: string]: unknown` | TODO | TODO |
| CAST-084 | src/features/architect/utils/entitlements/entitlementHealthReport.ts:39 | `[key: string]: unknown` | TODO | TODO |
| CAST-085 | src/features/architect/utils/entitlements/entitlementIdentity.ts:45 | `[key: string]: unknown` | TODO | TODO |
| CAST-086 | src/features/architect/utils/entitlements/entitlementWriter.ts:174 | `[key: string]: unknown` | TODO | TODO |
| CAST-087 | src/features/architect/utils/exceptionHistory/historyHelpers.ts:58 | `[key: string]: unknown` | TODO | TODO |
| CAST-088 | src/features/architect/utils/exceptionHistory/historyHelpers.ts:63 | `[key: string]: unknown` | TODO | TODO |
| CAST-089 | src/features/architect/utils/exceptions/exceptionLifecycle.ts:37 | `[key: string]: unknown` | TODO | TODO |
| CAST-090 | src/features/architect/utils/exceptions/exceptionLifecycle.ts:46 | `[key: string]: unknown` | TODO | TODO |
| CAST-091 | src/features/architect/utils/faExceptionUtils.ts:36 | `[key: string]: unknown` | TODO | TODO |
| CAST-092 | src/features/architect/utils/firebaseTeamPlanHelpers.ts:192 | `any` | TODO | TODO |
| CAST-093 | src/features/architect/utils/firebaseTeamPlanHelpers.ts:194 | `any` | TODO | TODO |
| CAST-094 | src/features/architect/utils/leagueInvariants.ts:135 | `any` | Item 2 | Legacy `receiving`/`playersReceiving` fields on team entries not present in `ArchitectMutationPayload`. Needs payload-shape audit before narrowing. |
| CAST-095 | src/features/architect/utils/leagueInvariants.ts:280 | `any` | Item 2 | Legacy `receiving`/`playersReceiving` fields on team entries not present in `ArchitectMutationPayload`. Needs payload-shape audit before narrowing. |
| CAST-096 | src/features/architect/utils/leagueInvariants.ts:374 | `any` | Item 2 | Legacy `receiving`/`playersReceiving` fields on team entries not present in `ArchitectMutationPayload`. Needs payload-shape audit before narrowing. |
| CAST-097 | src/features/architect/utils/loadArchitectBasePlayer.ts:21 | `[key: string]: unknown` | TODO | TODO |
| CAST-098 | src/features/architect/utils/loadArchitectBasePlayer.ts:37 | `[key: string]: unknown` | TODO | TODO |
| CAST-099 | src/features/architect/utils/salaryEngine/salaryEngine.ts:68 | `as unknown as` | TODO | TODO |
| CAST-100 | src/features/architect/utils/salaryEngine/salaryEngine.ts:143 | `as unknown as` | TODO | TODO |
| CAST-101 | src/features/architect/utils/seasonFormat.ts:11 | `any` | TODO | TODO |
| CAST-102 | src/features/architect/utils/seasonManagerLegacy.ts:35 | `[key: string]: unknown` | TODO | TODO |
| CAST-103 | src/features/architect/utils/subscribeArchitectPlayerData.ts:57 | `[key: string]: unknown` | TODO | TODO |
| CAST-104 | src/features/architect/utils/subscribeArchitectPlayerData.ts:60 | `[key: string]: unknown` | TODO | TODO |
| CAST-105 | src/features/architect/utils/subscribeArchitectPlayerData.ts:81 | `as unknown as` | TODO | TODO |
| CAST-106 | src/features/architect/utils/subscribeArchitectPlayerData.ts:115 | `as unknown as` | TODO | TODO |
| CAST-107 | src/features/architect/utils/tradeContext/tradeContext.ts:1482 | `as unknown as` | TODO | TODO |
| CAST-108 | src/features/architect/utils/tradeContext/tradeContext.ts:1490 | `as unknown as` | TODO | TODO |
| CAST-109 | src/features/architect/utils/tradeContext/types.ts:18 | `any` | TODO | TODO |
| CAST-110 | src/features/architect/utils/tradeHelpers.ts:39 | `[key: string]: unknown` | TODO | TODO |
| CAST-111 | src/features/architect/utils/tradeHelpers.ts:49 | `[key: string]: unknown` | TODO | TODO |
| CAST-112 | src/features/architect/utils/tradeHelpers.ts:53 | `[key: string]: unknown` | TODO | TODO |
| CAST-113 | src/features/architect/utils/tradeHelpers.ts:97 | `[key: string]: unknown` | TODO | TODO |
| CAST-114 | src/features/architect/utils/tradeHelpers.ts:101 | `[key: string]: unknown` | TODO | TODO |
| CAST-115 | src/features/architect/utils/tradeMachine/engine/tradeValidator.ts:82 | `[key: string]: unknown` | TODO | TODO |
| CAST-116 | src/features/architect/utils/tradeMachine/engine/tradeValidator.ts:1469 | `[key: string]: unknown` | TODO | TODO |
| CAST-117 | src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.ts:77 | `as unknown as` | TODO | TODO |
| CAST-118 | src/features/architect/utils/tradeMachine/engine/validationUtils.ts:12 | `any` | TODO | TODO |
| CAST-119 | src/features/architect/utils/tradeMachine/engine/validationUtils.ts:12 | `any` | TODO | TODO |
| CAST-120 | src/features/architect/utils/tradeMachine/rules/miscRules.ts:169 | `as unknown as` | TODO | TODO |
| CAST-121 | src/features/architect/utils/tradeMachine/rules/miscRules.ts:174 | `as never` | TODO | TODO |
| CAST-122 | src/features/architect/utils/tradeMachine/rules/miscRules.ts:176 | `as unknown as` | TODO | TODO |
| CAST-123 | src/features/architect/utils/tradeMachine/rules/miscRules.ts:179 | `as unknown as` | TODO | TODO |
| CAST-124 | src/features/architect/utils/tradeMachine/rules/miscRules.ts:183 | `as unknown as` | TODO | TODO |
| CAST-125 | src/features/architect/utils/tradeMachine/rules/miscRules.ts:184 | `as unknown as` | TODO | TODO |
| CAST-126 | src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts:9 | `[key: string]: unknown` | TODO | TODO |
| CAST-127 | src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts:16 | `[key: string]: unknown` | TODO | TODO |
| CAST-128 | src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts:20 | `[key: string]: unknown` | TODO | TODO |
| CAST-129 | src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts:27 | `[key: string]: unknown` | TODO | TODO |
| CAST-130 | src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts:32 | `[key: string]: unknown` | TODO | TODO |
| CAST-131 | src/features/architect/utils/tradeMachine/rules/validateEligibility.ts:18 | `[key: string]: unknown` | TODO | TODO |
| CAST-132 | src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.ts:49 | `[key: string]: unknown` | TODO | TODO |
| CAST-133 | src/features/architect/utils/tradeMachine/rules/validateRoster.ts:113 | `[key: string]: unknown` | TODO | TODO |
| CAST-134 | src/features/architect/utils/tradeMachine/rules/validateRoster.ts:128 | `[key: string]: unknown` | TODO | TODO |
| CAST-135 | src/features/architect/utils/tradeMachine/utils/capSettingsProvider.ts:39 | `[key: string]: unknown` | TODO | TODO |
| CAST-136 | src/features/architect/utils/tradeMachine/utils/capSettingsProvider.ts:59 | `[key: string]: unknown` | TODO | TODO |
| CAST-137 | src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:28 | `[key: string]: unknown` | TODO | TODO |
| CAST-138 | src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:36 | `[key: string]: unknown` | TODO | TODO |
| CAST-139 | src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:43 | `[key: string]: unknown` | TODO | TODO |
| CAST-140 | src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:59 | `[key: string]: unknown` | TODO | TODO |
| CAST-141 | src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:61 | `[key: string]: unknown` | TODO | TODO |
| CAST-142 | src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:78 | `[key: string]: unknown` | TODO | TODO |
| CAST-143 | src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:80 | `[key: string]: unknown` | TODO | TODO |
| CAST-144 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:19 | `[key: string]: unknown` | TODO | TODO |
| CAST-145 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:38 | `[key: string]: unknown` | TODO | TODO |
| CAST-146 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:42 | `[key: string]: unknown` | TODO | TODO |
| CAST-147 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:44 | `[key: string]: unknown` | TODO | TODO |
| CAST-148 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:64 | `[key: string]: unknown` | TODO | TODO |
| CAST-149 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:87 | `[key: string]: unknown` | TODO | TODO |
| CAST-150 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:89 | `[key: string]: unknown` | TODO | TODO |
| CAST-151 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:100 | `[key: string]: unknown` | TODO | TODO |
| CAST-152 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:114 | `[key: string]: unknown` | TODO | TODO |
| CAST-153 | src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts:121 | `[key: string]: unknown` | TODO | TODO |
| CAST-154 | src/features/architect/utils/tradeMachine/utils/salaryMargin.ts:20 | `[key: string]: unknown` | TODO | TODO |
| CAST-155 | src/features/architect/utils/tradeMachine/utils/salaryMargin.ts:27 | `[key: string]: unknown` | TODO | TODO |
| CAST-156 | src/features/architect/utils/tradeMachine/utils/salaryMargin.ts:34 | `[key: string]: unknown` | TODO | TODO |
| CAST-157 | src/features/architect/utils/tradeMachine/utils/salaryMargin.ts:39 | `[key: string]: unknown` | TODO | TODO |
| CAST-158 | src/features/architect/utils/tradeMachine/utils/salaryMargin.ts:45 | `[key: string]: unknown` | TODO | TODO |
| CAST-159 | src/features/architect/utils/tradeMachine/utils/salaryMargin.ts:61 | `[key: string]: unknown` | TODO | TODO |
| CAST-160 | src/features/architect/utils/tradeMachine/utils/salaryMargin.ts:68 | `[key: string]: unknown` | TODO | TODO |
| CAST-161 | src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts:35 | `[key: string]: unknown` | TODO | TODO |
| CAST-162 | src/features/architect/utils/tradeMachine/utils/validateInput.ts:10 | `[key: string]: unknown` | TODO | TODO |
| CAST-163 | src/features/architect/utils/tradeMachine/utils/validateInput.ts:16 | `[key: string]: unknown` | TODO | TODO |
| CAST-164 | src/features/architect/utils/tradeMachine/utils/validateInput.ts:22 | `[key: string]: unknown` | TODO | TODO |
| CAST-165 | src/features/architect/utils/tradeMachine/utils/validateInput.ts:28 | `[key: string]: unknown` | TODO | TODO |
| CAST-166 | src/features/architect/utils/tradeMachine/utils/validateInput.ts:35 | `[key: string]: unknown` | TODO | TODO |
| CAST-167 | src/features/architect/utils/tradeMachine/utils/validateInput.ts:41 | `[key: string]: unknown` | TODO | TODO |
