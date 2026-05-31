# Architect GM Desk Home Base UX Spec

## Purpose

Architect should feel like one desktop-first GM workspace, not a set of
separate tools. The Full Cap Table is the home base: the place where a user
understands who is on the team, what every player costs now and later, and what
the selected-season cap situation is.

Supporting rooms still matter. Trade Machine and Free Agency remain specialized
workflows because they have deeper search, legality, and validation needs. Their
options and committed results should flow back to the Full Cap Table so the user
can immediately understand the roster and money impact.

## Product Shape

The GM Desk centers on the Full Cap Table.

- The user can see the whole roster and every player financial commitment.
- The table shows the complete contract horizon for the team. It must not cut
  off future years when a long contract exists.
- The selected Architect season's cap/tax/apron posture stays visible.
- Common player contract actions launch from the table row.
- Detailed contract terms stay in the existing contract modal.
- Complex workflows stay in their rooms and return useful state to the desk.

The current-year Cap Sheet is a supporting detail room. The Full Cap Table is
the primary operating room.

## Home Base Layout

The home base has four persistent layers.

### Sticky Selected-Season Operating Status

Always-visible current operating context:

- team, world, season, and mode;
- selected-season total salary and roster count;
- selected-season cap, tax, first apron, second apron, and hard-cap posture;
- save/loading/error state where relevant.

This status answers: "What is my operating position right now?"

### Full-Horizon Roster Cap Table

The main surface is a dense roster-money table:

- one row per roster player;
- sticky player identity column;
- horizontally scrollable season columns;
- columns extend through the longest contract horizon currently on the team;
- row-level affordances for supported player actions.

The table should optimize for serious desktop/laptop use. Mobile can remain a
readable fallback, but the primary experience is a dense GM tool.

### Expandable Non-Player Money Groups

Non-player money should be present but not dominate the first read. Use
expandable grouped sections for:

- cap holds;
- dead money;
- exceptions;
- draft holds and incomplete roster charges where applicable.

These groups explain team totals without turning the top-level roster view into
noise.

### Year-Total Footer Rows

Each season column needs aligned bottom totals so future roster/team spending is
visible in place. These totals answer: "What does this roster cost in each
season?"

Selected-season cap/tax/apron status belongs in the sticky operating status.
Year-by-year spending totals belong at the bottom of the cap table.

## Contract Modal Role

The Full Cap Table is the launch/control surface. The contract modal remains
the detailed editing surface.

Pattern:

1. User chooses a player/action from the Full Cap Table row.
2. Existing contract modal opens for exact terms, rules, and validation.
3. Existing mutation pipeline applies the committed action.
4. Full Cap Table updates and highlights the affected rows and totals.
5. Activity rail keeps the receipt and navigation trail.

The table should not inline every contract form or rule. It should make actions
discoverable from the roster-money context and then delegate specifics to the
modal.

## Actions And Handoffs

### Home Base Actions

The Full Cap Table should directly launch:

- edit contract;
- extend contract;
- waive/stretch where applicable;
- option decisions where applicable;
- renounce rights or cap holds where applicable;
- manage dead money;
- manage exceptions.

All committed writes remain owned by the existing Architect action layer and
mutation pipeline.

### Trade Machine

Trade Machine remains its own room.

- Checking or validating a trade keeps the user in Trade Machine.
- No home-base redirect happens for an uncommitted trade check.
- Only applying a trade returns the user to the Full Cap Table.
- Applied trades highlight incoming/outgoing players, affected money rows, and
  changed year-total cells.
- The activity rail records the committed move.

### Free Agency

Free Agency remains its own room for discovery, filtering, and deeper free-agent
review.

Selected or queued free agents should also appear on the Full Cap Table home
base as a compact FA Options area:

- selected player names;
- projected or entered offer amount when available;
- open offer/signing flow;
- remove option;
- return to Free Agency search.

Queued free agents are options, not roster truth. They should not appear as real
roster rows until signed. Once signed, they leave FA Options, enter the roster
table, and trigger changed-row/changed-total highlighting.

### Offseason Advance

Offseason advance is a global task, not a row-level home-base action.

## Feedback And Continuity

After any committed action, Architect should make the result obvious without
requiring the user to hunt through the table.

The home base should:

- highlight affected player rows;
- highlight affected non-player money rows, such as new dead money or removed
  holds;
- highlight affected year-total cells;
- show a receipt in the activity rail;
- preserve the focused player/action until the user clears it or starts another
  action.

Refresh/share should preserve room, selected season, and focused player through
URL params where practical.

## Non-Goals

- Do not reskin the Trade Machine interior as part of this spec.
- Do not replace the existing contract modal with inline table editing.
- Do not create a new mutation pipeline or Firestore write authority.
- Do not turn the Guide into a chatbot-style product.
- Do not make mobile the primary design target.

## Acceptance Criteria

- The Full Cap Table is the default home-base room for a team desk.
- The table displays all roster players and extends through the longest team
  contract horizon.
- Selected-season cap/tax/apron status is always visible.
- Year-by-year spending totals align under the season columns.
- Cap holds, dead money, exceptions, and similar non-player money are available
  through expandable grouped sections.
- Player row actions launch the existing contract modal for detailed edits.
- Applied trades return to the Full Cap Table; legal checks do not.
- Free-agent selections can appear on the home base as FA Options without
  becoming roster rows until signed.
- Committed actions produce visible row/total highlights and an activity receipt.
