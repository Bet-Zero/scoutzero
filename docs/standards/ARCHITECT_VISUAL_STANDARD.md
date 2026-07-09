---
name: ARCHITECT_VISUAL_STANDARD.md
description: The durable visual identity every Architect UI wave is built and judged against — spacing, type, color/tone, component vocabulary, and state treatments, grounded in the approved cockpit surfaces and the locked design laws.
---

# Architect Visual Standard

This is the single visual identity for the Architect (GM cockpit) surfaces. Every
UI wave is **built to** this standard and **judged against** it. When a wave and
this doc disagree, one of them is wrong — fix the wave, or change the doc
deliberately (with the reason) and re-judge everything against the new version.

It is grounded in surfaces the owner has already approved, not invented from
scratch:

- **Canonical:** the Full Cap Table drawer (`capfull`) — the trusted money/books
  surface. Its density, dark elevation, and cap-posture treatment are the
  reference for "what finished looks like here."
- **References:** the Team Plan Hub cockpit shell and the BZE-216 rooms (Cap
  Sheet, Trade Machine, Free Agency after their approved passes).
- **Tokens of record:** `src/features/architect/cockpit/cockpitTokens.ts`
  (mirrored into `tailwind.config.js` as the `cockpit-*` utilities). The doc
  describes those tokens; the code owns them. If a value here drifts from the
  token file, the token file wins.

The identity in one line: **a dark, premium, dense sports-management cockpit —
not sci-fi, not a dashboard template.** Team color is a narrow accent, never a
panel wash. Every pixel earns its place because everything must fit 1280×720.

---

## 1. Locked design laws (owner decisions — non-negotiable)

These come from `docs/agent-guides/architect-boundary.md` and override any
aesthetic preference below.

1. **One screen.** Every player involved in a decision is visible on one screen.
   No separate sections or drawers for a decision's players.
2. **Universal cap posture.** Cap/apron posture is one shared component
   everywhere (the drawer/meter design is canonical). Never duplicated or
   restyled per feature. In the cockpit it lives in the TopBar
   (`CapPostureMeter`); rooms inherit it from the shell rather than drawing their
   own.
3. **Fits 1280×720 with zero page-level clipping.** The owner reviews at exactly
   this size. The Full Cap Table fits up to 18 rows with zero scroll. Every room
   must fit or scroll only inside its designated body region (see §7).
4. **GM language only.** Owner-facing copy speaks like a general manager. Banned
   internal vocabulary on product surfaces: *posture, truth, guard, canonical,
   authority,* raw world IDs, emulator/debug indicators, proof/scaffolding tags.
   (Note: `posture` is fine in code/token names; it must never appear in visible
   copy — the meter says "$4.2M under Cap", never "cap posture".)

---

## 2. Elevation & surfaces

The cockpit is built from a fixed ladder of dark surfaces. Depth is expressed by
**surface value + a 1px edge + at most one soft shadow** — never by heavy borders
or large drop shadows.

| Token (`cockpit-*`) | Hex | Role |
| --- | --- | --- |
| `void` | `#0A0C10` | Deepest background. The room canvas (`RoomFrame` uses `bg-cockpit-void`). |
| `inlay` | `#0B0E14` | Recessed wells — the scroll region a list/table sits *inside*, meter tracks. |
| `bar` | `#0F1218` | Chrome bands: TopBar, room header, NavRail. |
| `slab` | `#13171F` | The default panel/card surface. Most content sits on a slab. |
| `raised` | `#1A1F29` | A slab lifted above its neighbors (hover, active row, popover). |
| `edge` | `#232A36` | The 1px border between surfaces. Use `border-cockpit-edge`. |

Shadows (from `tailwind.config.js`), used sparingly:

- `shadow-cockpit-slab` — the standard panel lift (inset top highlight + soft
  down shadow). Default for any slab that should read as a card.
- `shadow-cockpit-accent` — team-accent ring + glow. Reserve for the single
  focused/active element in a view (e.g. the active team plan). Never decorative.

**Rules.** Nest at most two elevation steps (e.g. `slab` panel holding an `inlay`
list well). Do **not** stack box-in-box-in-box. Prefer replacing an inner border
with a spacing gap or a surface-value change. Ad-hoc hexes like `bg-[#070A0F]` or
`bg-white/[0.035]` are drift — use the token that means the same thing.

---

## 3. Color & tone

Color carries meaning, not decoration. Three families only:

**Neutral text ramp** (white at fixed opacities — `cockpit-text-*`):

| Token | Value | Use |
| --- | --- | --- |
| `text-primary` | white 92% | Primary values, names, headings. |
| `text-secondary` | white 62% | Supporting copy, labels beside a value. |
| `text-muted` | white 40% | De-emphasized meta, section captions, units. |
| `text-ghost` | white 20% | Disabled, placeholder, empty-slot outlines. |

**Status** (`cockpit-safe|watch|danger|info`) — the only saturated non-team color
allowed, and only to signal state:

| Token | Hex | Meaning |
| --- | --- | --- |
| `safe` | `#34D399` | Legal / under a threshold / healthy (green). |
| `watch` | `#FBBF24` | Caution — over cap or over tax, allowed but flagged (amber). |
| `danger` | `#F87171` | Hard stop / over an apron / blocked (red). |
| `info` | `#60A5FA` | Neutral informational accent (blue). |

**Team accent** (`--team-primary` CSS var, injected by `useTeamPalette`): a
narrow identity cue — a top hairline, an active ring, a logo mount. **Never** a
filled panel, never a large area of team color. If a team wash is filling a card,
that's wrong.

Tone rule: a surface is neutral until something is true about it. Green/amber/red
appear because the cap math says so, not to brighten the page.

---

## 4. Type scale

One compact scale. The cockpit is dense; type is small and tight, weight (not
size) carries hierarchy.

| Level | Classes | Use |
| --- | --- | --- |
| Room title | `text-sm font-semibold uppercase tracking-wide` | `RoomFrame` header; the room's name. |
| Surface title | `text-lg font-black uppercase leading-tight tracking-wide` | The one hero label per room (team name, screen subject). One per view. |
| Group heading | `text-xs font-extrabold uppercase tracking-wide` | Section/band headings inside a room. |
| Primary value | `text-sm font-extrabold tabular-nums` | Numbers that matter (counts, dollars). Always `tabular-nums`. |
| Body | `text-xs` / `text-[11px]` | Supporting copy, row detail. |
| Label / caption | `text-[10px] font-semibold uppercase tracking-wider` (muted) | Tile labels, unit captions, band details. |

Rules: never more than one Surface-title per view. Money and counts are always
`tabular-nums` so columns don't jitter. Don't introduce sizes between these steps
(no `text-[9px]`, no `text-[13px]`) — reach for weight or color instead.

---

## 5. Spacing & density

- **Base unit 4px.** Standard rhythm: `gap-2`/`gap-3` between elements,
  `px-3 py-2` inside a compact panel, `px-5 py-4` for a room's comfortable body
  padding (matches `RoomFrame`'s non-bleed default).
- **Radii:** `rounded-md` (6px) for chips/tiles/controls, `rounded-lg` (8px) for
  panels/cards. Nothing more rounded; this is a cockpit, not a consumer app.
- **Density target:** a room should feel full but never cramped. If content
  doesn't fit 1280×720, cut or collapse content and tighten the shell (one-line
  strips, `hideHeader`/`bleed`) — do **not** shrink type below the scale in §4.
- **Alignment:** numeric columns right-align; label+value pairs share a baseline
  (`items-baseline`). Ragged baselines are a defect.

---

## 6. Component vocabulary

Reuse these; don't reinvent per room.

- **RoomFrame** (`cockpit/RoomFrame.tsx`) — the room shell. 48px (`h-12`) header
  with an uppercase title, a single scrollable body, and two opt-ins: `hideHeader`
  (room draws its own title band) and `bleed` (body owns the edge, no padding).
  The body is the **only** scroll boundary in the workspace.
- **Cap posture meter** (`cockpit/CapPostureMeter.tsx`) — the universal Cap → Tax
  → Apron 1 → Apron 2 track with a status-colored marker and a plain-language
  label ("$4.2M under Cap"). Universal per design law #2; never re-drawn.
- **Panel / slab** — `rounded-lg border border-cockpit-edge bg-cockpit-slab
  shadow-cockpit-slab`. The default container for a group of related content.
- **List well** — an `inlay` region a scrolling list/table sits inside, with the
  scroll captured to the well, not the page.
- **Metric tile** — a compact `label + value` unit: muted uppercase label (§4),
  `tabular-nums` value, on a slab or inset. Used for at-a-glance counts. Keep
  tiles a consistent height and align their baselines in a row.
- **Player row / card** — the shared roster/pool player unit. Card click = open;
  a corner overflow (`PlayerActionMenu`) carries secondary actions (pin, trade,
  cross-room nav). A "just changed" highlight is a team-accent outline, not a
  fill.
- **Chip / pill** — small status or filter token, `rounded-md`, status- or
  neutral-toned. Never more than one saturated chip competing for attention in a
  row.
- **Buttons** — primary action uses the team accent or a single orange CTA
  (existing convention); a disabled control must **look** disabled (never render
  a disabled action in the enabled/active color) and, where non-obvious, carry a
  one-line plain-language reason.

---

## 7. Layout & the 1280×720 budget

- Chrome (TopBar + NavRail) is fixed; the room body flexes. Reviewer height after
  chrome is ~660px — design the tallest state to fit it.
- **Exactly one scroll region per room** — the `RoomFrame` body (or a single
  designated list well inside it). The page itself never scrolls horizontally and
  never scrolls vertically at the document level.
- When a room's own interior already provides a title/toolbar (Full Cap Table,
  Roster), use `hideHeader` + `bleed` and hand those pixels to content. One-line
  title/banner strips over stacked headers.
- Verify fit, don't assume it: check `scrollHeight <= clientHeight` on
  `[data-testid="cockpit-room-frame-body"]` at 1280×720 with realistic seeded
  data before calling a state finished.

---

## 8. State treatments

Every room must define — and every review must show — all applicable states.

| State | Treatment |
| --- | --- |
| **Pass / healthy** | Neutral surface + `safe` accent only where a value is affirmatively good. No green wash. |
| **Blocked** | `danger` marker/label with a plain-language reason. A blocked state must never read as success (no orange/green CTA, no "done" affordance). This is a guarded promise — see §9. |
| **Warning** | `watch` marker/label; the action is still allowed but flagged (over cap/tax). Distinct from blocked. |
| **Empty** | An intentional, composed empty state: what belongs here, why it's empty, and the next move — using `text-ghost` slots/outlines, not a blank void. Empty-slot outlines (open roster spots) are drawn, labeled, and counted. |
| **Loading** | A quiet skeleton on the real layout (slab placeholders at final positions), not a spinner on a blank page and not a layout that jumps when data lands. |

---

## 9. Honesty & guarded promises

Some copy/structure is pinned by tests because it encodes a product promise, not
a design choice. A better design may change the wording or layout of these, but
**the intent must survive** and the test moves with the design:

- A blocked/illegal state can never be styled or worded to read as success.
- Required honesty disclosures (preview/world-gating markers, apply-only gates)
  stay present and legible — restyle them, don't delete them.
- No implied guarantee the engine doesn't back (a "(Preview)" marker stays a
  preview marker).

Never ship a worse design *around* a pinned string and file it as a "known
weakness." Update the test with the work; only the owner changes the underlying
promise.

---

## 10. Wave judging checklist (adversarial self-review)

Before any wave goes to the owner, render **every** state at 1280×720 with
realistic seeded data and confirm — as a hostile design critic — none of these
survive:

- [ ] Page-level clipping or scroll at 1280×720; body-region overflow.
- [ ] Off-scale type, ad-hoc hex/opacity instead of `cockpit-*` tokens.
- [ ] Box-in-box nesting deeper than two elevation steps.
- [ ] Misaligned baselines / non-`tabular-nums` numeric columns that jitter.
- [ ] Team color used as a fill/wash instead of a narrow accent.
- [ ] A disabled control rendered in an enabled color; a blocked state that reads
      as success.
- [ ] Banned internal vocabulary or raw IDs on a visible surface.
- [ ] A blank/void empty state; a loading state that jumps.
- [ ] More than one hero (Surface-title) or competing saturated chips in a row.
- [ ] Any state the owner would obviously demand fixed. If one exists, the
      self-review failed — fix it before review, don't list it as a weakness.

---

## Change control

Changing this standard changes what "finished" means for every future wave.
Update it deliberately: state what changed and why in the commit, and re-judge
open waves against the new version. The token file
(`cockpitTokens.ts` / `tailwind.config.js`) remains the source of truth for exact
values; this doc is the intent and the rules around them.
