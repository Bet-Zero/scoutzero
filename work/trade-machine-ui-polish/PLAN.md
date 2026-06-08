# Trade Machine UI Polish — Chrome Cleanup Plan

**Goal:** Make the Trade Machine look like a finished product *outside* the
editor / team-card area. Fix inconsistent buttons, separate debug from real
output, and remove developer-only labels that leak into the user-facing view.

**Explicitly out of scope (later round):** The team-card internals
(`TradeTeamCard` and its children — player rows, entitlement rows, cap tiles).
This pass only touches the surrounding chrome.

**Surface (files this pass may touch):**
- `TradeEditor.tsx` — header bar, action buttons, layout
- `ValidationStateHeader.tsx` — validation pill + mode legend
- `ValidationDetailsPanel.tsx` — results vs. dev-tools panels, section headers
- New: `tradeMachineChrome.buttons.tsx` (scoped button set)

**Product decisions locked (2026-06-04):**
1. **Debug = dev-flag gated.** The whole Development Tools panel is hidden for
   normal users and only appears when a dev flag is on. Nothing is deleted.
2. **Mode labels removed from production.** The "Mode legend" strip and the
   per-section OFFICIAL/SETUP/EXPLORATORY/DEBUG tags come out of the user-facing
   view. (Tags may remain *inside* the dev-only panel.)
3. **Plan-doc-first**, execute slice-by-slice with a validation gate each step.

**Validation gate (every source slice):**
`npx tsc --noEmit` clean + `npm run test:architect -- --reporter=dot`
(only pre-existing failures allowed). Commit after each completed slice.

---

## Slice 1 — Shared button system for the chrome

**Problem:** Validate (blue), Clear-session (amber), Reset (bare icon), Add Team
(gray), and Apply (green, separate style) each use ad-hoc Tailwind. No shared
vocabulary, so the toolbar looks unformatted.

**Change:** Add `tradeMachineChrome.buttons.tsx` exporting a tiny set of named
components with consistent sizing/typography/focus states:
- `PrimaryButton` — the main affirmative action (Validate, Apply)
- `SecondaryButton` — neutral actions (Add Team)
- `SubtleButton` — low-emphasis / session actions (Clear session changes)
- `IconButton` — icon-only (Reset)

Intent (not deletion) stays expressible via a `tone` prop
(`default | positive | warning`) so Apply can read green and Clear-session amber
*within* one consistent shape, instead of five unrelated styles.

**Apply to:** every button in `TradeEditor.tsx` and the panel toggles.

**No behavior change.** Same onClicks, same disabled logic, same test IDs.

**Gate:** typecheck + `test:architect`.

---

## Slice 2 — Consolidate the action toolbar

**Problem:** Validate / Reset / Add Team sit in the top header; Apply Trade sits
at the very bottom in a different style. Primary actions are scattered.

**Change:** Group the trade actions into one coherent toolbar in the header:
`Validate → Apply → Reset`, with Add Team kept near them. The bottom controls
row keeps only the *contextual warning text* (apply-time world checks, blocked
reason), not a stray button.

- Apply button keeps all current guards (re-validate, legality, double-submit
  lock, vacuum overlay persistence). Pure relocation + restyle.
- Keep the `data-testid`s and the existing enable/disable conditions intact so
  guardrail tests still pass.

**Gate:** typecheck + `test:architect` + `npm run test:trade -- --reporter=dot`.

---

## Slice 3 — Dev-flag gate the Development Tools panel

**Problem:** The "🛠️ Development Tools" collapsible (salary calculator sandbox,
trade receipt, entitlement health, S&T injector) is always rendered for users.

**Change:** Gate the *entire* Development Tools section behind a single runtime
flag, consistent with the existing `hz.dev.injectSntPlayers` pattern:

- New flag constant: `hz.dev.tradeMachineDebug` (localStorage).
- Helper `isTradeMachineDebugEnabled()` → `import.meta.env.DEV ||
  localStorage['hz.dev.tradeMachineDebug'] === 'true'`.
  - In a dev build: visible by default (so you keep it day-to-day).
  - In a production build: hidden unless you set the flag in the console.
- When the flag is off, the amber Development Tools panel is not rendered at all
  — finished-product users only ever see "Validation Results".
- The S&T injector keeps its own nested flag inside, unchanged.

**Note:** This relies on `import.meta.env.DEV`, so the panel stays available in
your normal `npm run dev` workflow with zero extra steps.

**Gate:** typecheck + `test:architect`. Add/adjust a test asserting the dev
panel is absent when the flag is off.

---

## Slice 4 — Strip mode labels & emoji from the production view

**Problem:** The "Mode legend" strip and the colored OFFICIAL/EXPLORATORY/DEBUG
chips on every section explain a developer taxonomy to end users. Emoji icons
(📋 🛠️) read as clipart.

**Change:**
- `ValidationStateHeader`: drop the `Mode legend` block entirely. Keep the
  validation status pill (Validating / Validated at HH:MM / Not validated) — that
  *is* real user-facing status. Fold it into a slimmer bar (or next to the title;
  final placement decided in Slice 2's toolbar pass).
- `ValidationDetailsPanel` `SectionHeader`: remove the `ModeTag` from the
  user-facing Validation Results sections. Replace emoji headers with plain text
  or a lucide icon to match the rest of the app.
- `ModeTag` / `MODE_TAGS` stay exported (still used inside the dev-gated panel),
  so nothing is deleted — just removed from the production surface.

**Gate:** typecheck + `test:architect`. Update any test asserting legend/tag
presence to reflect the production view.

---

## Slice 5 — Context banner + header tidy

**Problem:** The trade-context banner and the title/header spacing are the last
visible chrome rough edges once buttons and panels are clean.

**Change:** Light pass only — align the context banner styling with the new
button/tag vocabulary, verify spacing rhythm (`space-y`) reads cleanly, confirm
the init-error block still stands out. No logic changes.

**Gate:** typecheck + `test:architect`.

---

## Done criteria

- A finished-product user sees: title, a clean action toolbar, the team cards,
  a validation status pill, and the "Validation Results" panel — no mode legend,
  no colored mode chips, no debug panel, no emoji.
- With `hz.dev.tradeMachineDebug` (or a dev build), all current debug tooling is
  back, unchanged in capability.
- All chrome buttons share one visual system.
- `test:architect` (+ `test:trade` where touched) green except pre-existing
  failures; worktree clean; this folder moves to `archive/work/` when complete.
