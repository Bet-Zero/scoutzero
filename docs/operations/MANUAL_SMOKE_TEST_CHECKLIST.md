# Manual Smoke Test Checklist

**Date:** After full data push (674 players, 30 teams)  
**Purpose:** Verify application works correctly with new Firestore data

---

## ✅ Quick Pre-Check

Before starting, verify data is in Firestore:

- [ ] Open browser console → Network tab
- [ ] Navigate to any page
- [ ] Check for Firestore read errors (should see successful reads)

---

## 1. Player Profile Page (`/player/:id`)

**Test Players:**

- `austin_reaves` (LAL - has contract + stats)
- `shai_gilgeous_alexander` (OKC - previously had URL issues)
- `mac_mcclung` (IND - had season code issues)

**What to Check:**

- [ ] Page loads without errors (check browser console)
- [ ] **Bio section** displays:
  - [ ] Player name
  - [ ] Age/position/team
  - [ ] Headshot image
- [ ] **Contract section** displays:
  - [ ] Contract details (years, salary, etc.)
  - [ ] Salary breakdown by year
  - [ ] No "undefined" or "null" values showing
- [ ] **Stats section** displays:
  - [ ] Season stats table (if player has stats)
  - [ ] No errors if stats missing
- [ ] **Evaluations** (if you have any saved):
  - [ ] Existing evaluations still display
  - [ ] Can add new evaluations

**Expected:** All data loads from `players_v2` collection

---

## 2. League View (`/gm/league`)

**What to Check:**

- [ ] Page loads without errors
- [ ] **All 30 teams** are listed:
  - [ ] Count teams (should be 30)
  - [ ] No duplicate teams
  - [ ] Team names display correctly
- [ ] **Team totals** display:
  - [ ] Salary totals show (e.g., LAL ~$210M)
  - [ ] No "NaN" or "undefined" values
- [ ] **Click a team** (e.g., LAL, BOS, DEN):
  - [ ] Navigates to team dashboard
  - [ ] No errors in console

**Expected:** Data loads from `/architect/baseTeams` collection

---

## 3. GM Dashboard (`/gm/:teamSlug`)

**Test Teams:**

- `lakers` (LAL - large roster)
- `celtics` (BOS - deep roster)
- `nuggets` (DEN - championship team)

**What to Check:**

- [ ] **Baseline plan loads:**
  - [ ] Roster players display
  - [ ] Player names, positions, salaries show
  - [ ] Headshots display (if available)
- [ ] **Cap sheet totals:**
  - [ ] Total salary displays
  - [ ] Cap space/over cap shows correctly
  - [ ] Luxury tax threshold shows
- [ ] **Exception tracker:**
  - [ ] Trade exceptions (TPE) display
  - [ ] MLE/TPMLE/BAE values show
  - [ ] No placeholder "TBD" values (unless actually missing)
- [ ] **Draft picks:**
  - [ ] Draft picks section displays
  - [ ] Future picks show correctly
- [ ] **Trade machine:**
  - [ ] Can add players to trade
  - [ ] Totals update when adding/removing players
  - [ ] No calculation errors

**Expected:** Data hydrates from `/architect/baseTeams` + `/architect/basePlayers`

---

## 4. Roster Visual / Planner

**What to Check:**

- [ ] **Roster sections populate:**
  - [ ] Players grouped by position
  - [ ] Player cards show name, position, salary
  - [ ] Headshots display
- [ ] **Can save a plan:**
  - [ ] Make a change (add/remove player)
  - [ ] Click save
  - [ ] Plan persists (refresh page, change should remain)
- [ ] **No console errors** during save/load

**Expected:** Reads from `/architect/basePlayers`, saves to `teamPlans`

---

## 5. Free Agents (if applicable)

**Test Player:** Any free agent (check `player_index.json` for `teamCode: null`)

**What to Check:**

- [ ] Free agent profile loads
- [ ] Bio displays correctly
- [ ] Contract section shows "Free Agent" status
- [ ] No errors about missing contract data
- [ ] Can be added to Architect roster (if that's a feature)

**Expected:** Free agents have cleared contracts but preserved bio data

---

## 6. Edge Cases

**What to Check:**

- [ ] **Player with no stats:**
  - [ ] Profile still loads
  - [ ] Contract displays
  - [ ] Stats section shows empty/placeholder
- [ ] **Player with two-way contract:**
  - [ ] Season codes display correctly (no " W" suffix)
  - [ ] Contract details show properly
- [ ] **Team with no draft picks:**
  - [ ] Draft picks section shows empty/placeholder
  - [ ] No errors

---

## 🚨 Red Flags (Stop if you see these)

- ❌ **Console errors** about missing Firestore collections
- ❌ **Blank pages** or infinite loading
- ❌ **"undefined" or "null"** displayed in UI
- ❌ **Salary totals showing $0** for teams with players
- ❌ **Players missing** from rosters that should be there
- ❌ **Cannot save** team plans

---

## ✅ Success Criteria

- [ ] All 4 main pages load without errors
- [ ] Data displays correctly (no undefined/null in UI)
- [ ] Can navigate between pages smoothly
- [ ] Can save/load team plans
- [ ] Existing evaluations preserved (if you had any)

---

## 📝 Notes Section

**Issues Found:**

[Write any issues here]

**Screenshots:**

- [ ] Player profile working
- [ ] League view working
- [ ] GM dashboard working
- [ ] Roster visual working

**Time Taken:** _____ minutes

---

## Next Steps After Verification

- ✅ **If all checks pass:** Proceed to archive legacy collections
- ❌ **If issues found:** Document issues, fix, then re-test
- 📝 **Update runbooks:** Document any findings or edge cases discovered
