# TRADE MACHINE — MASTER CHECKLIST (V1)

Purpose: a complete “everything we need to check” list.
Rule: Every item must end as one of: PASS / FAIL / NOT PRESENT / NOT IMPLEMENTED (explicitly).

---

## 0) Scope + Runtime Context (must be explicit)

- [ ] What year/season is the trade machine simulating?
- [ ] Cap, tax line, 1st apron, 2nd apron values exist and are used consistently
- [ ] Currency units are consistent everywhere (no AAV vs cap hit confusion)
- [ ] “Legal/Illegal” is defined (what rules are enforced today vs deferred)
- [ ] Any deferred rule is not silently ignored (must be NOT IMPLEMENTED or NOT PRESENT)

---

## 1) Core Inputs Are Real (Data Integrity)

### Teams / Rosters

- [ ] Every team has a roster list used by the trade machine
- [ ] No duplicate player appears on two teams
- [ ] Team totals reconcile to roster (payroll, roster count, dead money if modeled)

### Players / Contracts

- [ ] Every player has a current-year salary value used for trade logic
- [ ] Salary source-of-truth is defined (base salary vs cap hit vs “trade salary”)
- [ ] Contract flags are present if used anywhere (TO/PO, non-guaranteed, two-way, etc.)
- [ ] Missing salary/contract fields fail loudly (clear error) not NaN/quiet fallbacks
- [ ] Recently acquired / recently signed fields exist if those rules are enforced

### League Rules Inputs

- [ ] All matching thresholds/constants live in one place (not scattered magic numbers)
- [ ] Apron/tax thresholds are pulled from one canonical league config
- [ ] Any team-specific “hard-capped at X apron” state has a defined source

---

## 2) Trade Session State + UI Plumbing (Cannot Desync)

- [ ] Add/remove team updates all dependent views
- [ ] Add/remove player updates all dependent views (team card, totals, legality, summary)
- [ ] Add/remove pick updates all dependent views (pick UI, summary, legality if enforced)
- [ ] Same asset cannot be selected twice (player or pick)
- [ ] Removing a team cleans up all assets tied to that team
- [ ] Derived values are not stored in a way that can drift from source-of-truth
- [ ] Reset/Clear returns to a true empty trade state (if button exists)
- [ ] Undo/redo works (if feature exists) without drifting totals

---

## 3) Salary Matching Engine (Core Legality)

### Salary Computation (matching inputs)

- [ ] Outgoing salary computed correctly per team (sum of traded-out players’ trade salaries)
- [ ] Incoming salary computed correctly per team (sum of traded-in players’ trade salaries)
- [ ] “Trade salary” definition matches your model (base vs cap hit vs averaged)
- [ ] No rounding drift between UI display and validator logic

### Matching Bands / Ceilings

- [ ] Correct matching ceiling produced from outgoing (and league rules)
- [ ] Correct thresholds applied (the tiers/bands you’re modeling)
- [ ] Aggregation rules correct (multi-player, multi-incoming, multi-outgoing)
- [ ] Multi-team logic computes per-team legality (not one blended number)

### Single Source of Truth

- [ ] UI “Allowable Incoming” uses the same value the validator uses
- [ ] Validator uses the same salary inputs the UI shows
- [ ] If there are two compute paths, it’s a FAIL until unified

### Failure Reasons

- [ ] Salary-matching failure returns a specific reason message (not generic “illegal”)
- [ ] When multiple reasons exist, they’re either all shown or priority is deterministic

---

## 4) Hard Caps + Aprons (Your current critical gap)

### Hard-Cap State

- [ ] Team hard-cap status is determined (none / 1st apron / 2nd apron)
- [ ] Hard-cap status has a clear cause model (or explicitly NOT IMPLEMENTED)

### Post-Trade Apron Compliance

- [ ] Post-trade team salary is computed correctly
- [ ] If hard-capped, trade is illegal if post-trade salary exceeds the hard-cap apron
- [ ] **Allowable incoming is clamped by apron room when hard-capped:**
  - [ ] allowableIncoming = min(salaryMatchCeiling, apronRoomRemaining)

### UI Truth

- [ ] UI communicates apron/hard-cap constraint clearly
- [ ] UI shows why it’s illegal (e.g., “Hard-capped at 1st apron; only $X room”)

---

## 5) Roster Constraints (Post-trade validity)

- [ ] Minimum roster size enforced post-trade (NBA rule or your chosen rule)
- [ ] Maximum roster size enforced post-trade
- [ ] Two-way slots enforced (if modeled)
- [ ] If any roster rule is not modeled, it must be labeled NOT IMPLEMENTED

---

## 6) Player Trade Restrictions (If you claim them)

Mark each as PASS/FAIL/NOT PRESENT/NOT IMPLEMENTED:

- [ ] Recently signed restrictions (e.g., cannot be traded for X time)
- [ ] Recently acquired restrictions (aggregation limitations if modeled)
- [ ] Reacquisition restrictions (if modeled)
- [ ] No-trade clause handling (if modeled)
- [ ] Trade kicker handling (if modeled)
- [ ] Poison pill handling (if modeled)
- [ ] BYC handling (if modeled)
- [ ] Two-way specific restrictions (if modeled)
- [ ] Non-guaranteed / partial guarantees handling (if modeled)

(If you don’t model them: must not silently pass — they’re NOT IMPLEMENTED.)

---

## 7) Picks + Entitlement Editor (If pick trading exists)

### Ownership / Source of Truth

- [ ] Pick ownership shown matches the entitlement/ledger source-of-truth
- [ ] No “phantom picks” exist (all expected picks accounted for, if your system tracks that)
- [ ] Pick identity is stable (year/round/owning team/protection terms)

### Editing / Wizard Wiring

- [ ] Add/remove pick modifies the same state used by summary + validator
- [ ] Protection editing persists in-session
- [ ] Swap handling works (if supported)
- [ ] Multi-team pick routing works (cannot end in impossible ownership)

### Constraints

- [ ] Stepien rule enforced (at least the level you claim)
- [ ] Protection logic doesn’t allow impossible states (if modeled)
- [ ] Validation provides clear pick-legality reasons

---

## 8) Exceptions / Tools (Only if shown in UI)

### TPE (Trade Player Exceptions)

- [ ] TPE objects have real values (amount, expiration, owner)
- [ ] Selecting a TPE affects legality and allowable incoming (if selection exists)
- [ ] If TPEs are displayed but not selectable/used → FAIL (lying UI)

### Cash

- [ ] Cash is supported and validated (if shown)
- [ ] If shown but not validated → FAIL

### Sign-and-trade

- [ ] If present in UI, legality rules exist (or clearly NOT IMPLEMENTED)

---

## 9) Multi-team Trade Support (If UI allows 3+ teams)

- [ ] Each team’s incoming/outgoing tracked independently
- [ ] Salary matching evaluated per team correctly
- [ ] Pick routing evaluated per team correctly
- [ ] Summary displays each team’s net assets correctly
- [ ] No asset can be both incoming and outgoing for the same team

---

## 10) UI Numbers + Messaging (No Lies)

For EVERY number displayed:

- [ ] Computed from real state (not placeholder)
- [ ] Updates live as edits happen
- [ ] Matches validator inputs
- [ ] Correct label/meaning (not misleading)

For EVERY legality indicator:

- [ ] “Legal” only when all enforced rules pass
- [ ] “Illegal” shows specific reasons

---

## 11) Summary + Export

- [ ] Summary lists correct players out/in per team
- [ ] Summary lists correct picks out/in per team (including protections/swaps)
- [ ] Summary shows correct net salary deltas
- [ ] Summary uses the same state as validator (single source-of-truth)
- [ ] Export (if exists) matches on-screen state exactly
- [ ] Export includes all assets (no missing picks/protections)

---

## 12) Save/Load + Immutability

- [ ] Save captures full trade session state (teams, players, picks, protections, notes)
- [ ] Load restores state exactly (no drift)
- [ ] Save location is correct (plans collection, not base data)
- [ ] **Base `/teams` (or base collections) are never written by the trade machine**
- [ ] Firestore rules assumptions match behavior (dev-open vs prod-locked)

---

## 13) Minimum Scenario Suite (Manual scripts you can run)

Salary / Hard-cap:

- [ ] Legal 1-for-1 (simple)
- [ ] Illegal salary match case
- [ ] **Near-apron hard-cap clamp case (your Lakers example class)**
      Roster:
- [ ] Max roster violation
- [ ] Min roster violation
      Picks (if enabled):
- [ ] Simple pick trade
- [ ] Protected pick edit
- [ ] Stepien violation attempt
      Multi-team (if enabled):
- [ ] 3-team trade with mixed players + picks
      Persistence (if enabled):
- [ ] Save → reload app → load → identical summary + legality
