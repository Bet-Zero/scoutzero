# Proactive Code Audit — Reusable Prompt Template

**What this is:** a copy-paste prompt for having an AI agent read an entire feature/scope and hand you ONE categorized, severity-ranked punch-list of issues — *before* you go testing by hand. Discovery only; nothing gets changed.

**Also known as:** static feature audit · static feature sweep · punch-list audit · preflight audit.

**When to use it:** when a feature "feels not as ready as it should be" and you keep hitting small issues one at a time at runtime. This front-loads the discovery so you get the whole batch up front instead of round-tripping on each one.

---

## The template (fill in one blank)

> Do a PROACTIVE CODE AUDIT of: **[SCOPE]**
>
> Mode: DISCOVERY ONLY. Read the code — do not change, fix, or run anything yet.
>
> Goal: find everything wrong, risky, dead, inconsistent, confusing, or incomplete
> in this scope BEFORE I test it by hand, so I'm not discovering issues one at a
> time at runtime.
>
> Look for: real bugs, broken/dead buttons, mis-wired or unused props, wrong or
> unformatted display values, missing loading/empty/error states, places that show
> stale or wrong data, silent failures, and accessibility/disabled-state gaps.
>
> Trace it properly: don't skim filenames — follow the components, child
> components, hooks, and helpers that actually affect behavior. Read the whole
> scope, not a sample.
>
> Output: ONE categorized punch-list, ranked by severity (real bugs first, then
> papercuts/polish). For EACH finding give: severity, type, exact file:line,
> what's wrong, why it matters, the recommended fix, and your confidence
> (Certain / Likely / Needs Verification).
>
> Rules: don't invent issues or pad with generic best-practice fluff — every
> finding needs a real location and evidence. If something's solid, say so. If
> you're not sure, label it "Needs Verification" instead of overstating. If you
> hit something genuinely dangerous (data loss, a control that allows an invalid
> action, UI and logic out of sync), call it out at the top.

In practice you only ever change **[SCOPE]** (the first line).

---

## Optional add-ons (paste only when you want them)

**Get a saved plan out of it** (survives losing the chat):
> Then write the findings + a phased implementation plan to a new markdown file in
> the repo, so I can follow it later without this chat. Each finding should be a
> self-contained ticket with its own acceptance criteria.

**Control how wide the net is:**
> Severity bar: report EVERYTHING ranked.
>
> — or —
>
> Severity bar: real bugs only, skip cosmetic polish.

**Narrow the focus when the scope is large:**
> Focus on [the UI/surface] — not [the core validation logic, which is well-tested].

---

## How to fill in [SCOPE] well (this determines the quality)

1. **Point at folders/files, not vibes.** "the Settings page in `src/features/settings/`, all components + its hooks" gets a far better audit than "the settings feature."

2. **Don't know the path? Make finding it step one.** It's completely fine to write:
   > First find where [feature X] lives in the codebase, show me the main files,
   > then audit that scope.
   The agent will locate it, and you can confirm before it digs in.

3. **Say what to exclude if there's a lot of code.** e.g. "focus on the UI/surface, not the core logic" — this keeps the audit sharp instead of drowning in already-solid code.

4. **Scope size guidance:** one feature folder, one page, or one subsystem at a time is ideal. "The whole app" is too big to do well in one pass — break it into a list of scopes and run the template once per scope.

---

## Example (filled in)

> Do a PROACTIVE CODE AUDIT of: the Roster Builder in `src/features/architect/roster/`, all components plus its hooks. Focus on the UI/surface, not the core roster-rules logic.
>
> Mode: DISCOVERY ONLY. Read the code — do not change, fix, or run anything yet.
> [...rest of template unchanged...]
> Severity bar: report EVERYTHING ranked.
> Then write the findings + a phased implementation plan to a new markdown file in the repo.
