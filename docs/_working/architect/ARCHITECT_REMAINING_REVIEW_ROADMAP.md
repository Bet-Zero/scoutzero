# ARCHITECT REMAINING REVIEW ROADMAP

## Purpose

This file is the current roadmap for what remains in the Architect review workflow after completed feature closeouts.

It exists so a new chat can quickly understand:

- what is already closed
- what is currently in progress
- what major review areas are likely still worth doing
- the preferred order for tackling them

This is a planning / continuity file, not a verdict document.

---

# 1. Completed Whole-Feature Closeouts

The following feature areas are already whole-feature closed:

- **Free Agency** — whole-feature closeout complete
- **Offseason** — whole-feature closeout complete

These should be treated as closed unless a future unrelated bug or new scope reopens them.

---

# 2. Current Feature In Progress

## League / World Time / As-Of

Current status:

- **Step 1** — complete
- **Step 2 Review Record** — complete
- **Step 2 Action Breakdown** — complete
- **Step 2 Bootstrap prompt** — written
- Current working state: **Step 2 bootstrap / execution stage**

This remains the active feature area to continue first.

---

# 3. Remaining Major Architect Review Areas

After League / World Time / As-Of, the most likely remaining Architect review areas are:

## A. Team History

Reason:

- still appears to be a distinct feature area worth its own full review flow
- likely smaller and more self-contained than broader cross-system reviews
- good next feature after the world/time system is complete

## B. Dedicated Multi-Year Cap Table Truth Pass

Reason:

- specifically requested as a separate dedicated review
- should not be buried inside generic cap work
- should focus on full cap-table truth across multiple years / future-year behavior

Important note:

- this is not just “Cap Sheet again”
- it is a dedicated truth pass around multi-year behavior for the full cap table

## C. League-Wide / Cross-Team World Behavior (if still needed after the above)

Reason:

- there may still be broader cross-team / league-wide world truth seams that do not fit cleanly under one tab
- examples could include system-level world propagation, consistency across teams, and broader world-wide behavior after mutations
- whether this becomes a formal feature area should be reassessed after World Time and Team History are further along

## D. Smaller Shared-System / Utility Seams (only if still necessary)

Reason:

- after the major feature areas are done, there may still be smaller shared seams worth targeted review
- these should only become formal review areas if they remain important after the larger work is complete

---

# 4. Preferred Order

The preferred order at the time this roadmap was written is:

1. **Finish League / World Time / As-Of**
2. **Team History**
3. **Dedicated Multi-Year Cap Table Truth Pass**
4. **Reassess whether a broader League-Wide / Cross-Team World review is still needed**
5. **Only then consider smaller leftover utility/shared-system seams**

---

# 5. Why This Order

## 1. Finish World / Time / As-Of first

Reason:

- it is already in progress
- it is upstream of many downstream Architect truth surfaces
- it is more central than Team History

## 2. Team History second

Reason:

- likely more self-contained
- likely smaller and cleaner than broader cross-system world reviews
- good next major feature after upstream world/time truth is finished

## 3. Multi-Year Cap Table Truth third

Reason:

- explicitly requested as a dedicated pass
- likely important but more specialized/heavier
- better to do after the current upstream system and a smaller contained feature are closed

## 4. Reassess broader league-wide/system-level reviews afterward

Reason:

- some broader cross-team/system seams may already be partly resolved by the time the above areas are complete
- better to reassess than to prematurely define a large vague review area

---

# 6. Practical Continuation Rule

When a new chat continues this workflow:

1. read the active continuation workflow guide
2. read this roadmap
3. continue the current in-progress feature first
4. after that feature closes, move to the next item on this roadmap unless new repo evidence changes priorities

Current continuation rule:

- **Do not skip ahead to Team History yet**
- finish **League / World Time / As-Of** first

---

# 7. Short Version

## Closed

- Free Agency
- Offseason

## In progress

- League / World Time / As-Of

## Next likely order

1. League / World Time / As-Of
2. Team History
3. Multi-Year Cap Table Truth Pass
4. Reassess broader League-Wide / Cross-Team World review
5. Smaller leftovers only if still needed

---

## End of Remaining Review Roadmap
