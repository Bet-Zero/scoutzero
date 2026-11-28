---
name: REVIEW_OF_CODEX_PLAN.md
description: Claude's review of Codex's Sandbox unification plan, plus an assessment of Codex's review of Claude's plan, with disputed facts checked against the code.
---

# Review of Codex's plan, and of Codex's review of mine

Reviewed November 28, 2026, against `main` at `04f8dde`. Read:
[PLAN_CODEX.md](PLAN_CODEX.md) and [REVIEW_OF_CLAUDE_PLAN.md](REVIEW_OF_CLAUDE_PLAN.md)
(Codex branch `codex/sandbox-unification-plan-review-20261128`, head
`9b71692`), and my own [PLAN_CLAUDE.md](PLAN_CLAUDE.md). Neither original plan
is edited. Claims marked *verified* were checked in the code or the pinned
Canon during this review.

## 1. Summary for the owner

The two plans want the same product and agree on almost every rule: one set
of basketball calculations, one dated NBA starting point for Sandbox and new
worlds, Sandbox moves kept until Reset, and saved worlds never changed by
later NBA updates.

The main difference is the order of work. My plan rewires how Architect reads
and saves data first, then turns Sandbox on. Codex's plan gets one complete
trade working the new way first, then adds the other tools one at a time.
**Codex's order is better**: it proves the idea on a real feature within the
first couple of weeks instead of after a long refactor. I'd keep three things
from my plan: the shape of the rewiring (so each tool migrates onto the same
design instead of a new one each time), installing and measuring the data
early, and deleting each old Sandbox path as soon as its replacement works.

Codex also found real problems I missed. Plain signings are fully blocked in
Sandbox today; I said they ran on an older path. Sandbox trades skip the
15-player roster limit. Some date rules only warn instead of block. I've
checked all of these in the code and they're correct.

Two things in Codex's plan need correcting:

- **It says the live install already has your approval.** I can't find that
  approval anywhere: Linear BZE-359 says the setup is "ready for
  authorization". Please confirm either way.
- **It's hard to read as an owner.** It's long, has no one-page summary and no
  size estimates. The merged plan needs both.

## 2. Assessment of Codex's review of my plan

### Factual corrections

| Codex item | Verdict | What I checked |
| --- | --- | --- |
| F1: plain Sandbox signings are blocked, not on an older path | **Accept. My claim was wrong.** | `resolveStandardSigningExecutionRoute` always returns the world executor (`useArchitectActions.signingExecution.ts:537`), and that executor rejects a missing world (`:201`). |
| F2: I overstated "accurate checks only in worlds" | **Accept in part.** | My survey item 1 said the engine is shared, but my owner summary simplified too far. The accurate *governed inputs* are world-only (salary basis, waivers, options, extensions, draft custody). The core computation is shared. |
| F3: free agents "not in the starting data" | **Accept the correction.** | The builder skips `FREE` for rosters (`buildSimulationFinancialBaseline.ts:119`) but can embed the full contract release (`:268`). The real gap is that no dated free-agent and rights pool is wired into gameplay. |
| F4: freezing two collections doesn't protect every old world | **Accept.** | Base entitlements and pick rules are also read by legacy worlds, and sparse worlds consult ancestors. The draft-source revision envelope already keeps saved worlds on the original fields, so those are partly protected today. Preservation needs fixtures per format, not one blanket claim. |
| F5: my Firestore subset missed operations | **Accept.** | `arrayRemove` (`moveWorldEntitlement.ts:274`) and `onSnapshot` (player catalog) are both used. My grep didn't include `arrayRemove`. |
| F6: promotion doesn't require server re-checks | **Accept.** | Ordinary world mutations are computed in the browser and written under owner Rules, so promotion could replay through the existing client path. It's still reasonable to defer. |

### Design criticisms

- **A. Do a complete trade slice before the broad refactor: accept the order,
  with one condition.** The first slice should introduce the store-shaped seam
  (document reads, transaction and commit over existing paths) as the
  destination design, implemented only for what that slice needs. Without one
  agreed seam, each action family risks inventing its own interface, which
  recreates the split in a new form. Codex's review already allows "a small
  document layer can implement those interfaces", so this is a small step.
  Saved-world management (listing, creation, deletion) stays on saved
  services, as Codex says. A global backend switch would be wrong.
- **B. Parity alone is not proof of correctness: accept fully.** I verified
  Codex's example. `validationFlags.timingEnforcement` is `'warn'`, and
  `tests/trade/timingEnforcement_authoritative.test.ts:147` expects a July 3
  trade to stay legal. The pinned Canon leaf **CBA2-L03.15** bars Assignment
  Transactions during the Moratorium (July 1, 12:01 a.m. through July 6, noon
  ET). The governed salary-basis path enforces the deadline window under the
  same leaf, but I found no Moratorium block there. The case isn't reachable
  inside today's November-to-June V1 window, but it shows unchanged suites can
  encode wrong rules. Independent Canon-derived expectations must be part of
  acceptance.
- **C. A version ID isn't a scenario identity: accept.** Reset to the same
  version would reuse `sandbox-<versionId>`, and the same-ID shortcut in
  `setActiveWorld` (`useArchitectState.worldLoader.ts:194`) would skip the
  reload. `deriveArchitectTeamPlanSaveState` treats any world ID as a durable
  saved world (`teamPlanSaveState.ts:105`). The scope must carry workspace
  kind, a stable local instance, the source version and a Reset generation.
  Note that the existing ID pattern in draft capability checks is
  `^[A-Za-z0-9_-]{1,100}$` (`capability.ts`), so the scope ID can't use
  colons.
- **D. Local History and Compare: accept that it's optional.** I described it
  as free with my design. That's true technically, but the V1 contract keeps
  W12 and W13 world-only. I'd offer it to the owner as a cheap option, not
  make it required.
- **E. Copies must start from the parent's retained source, not the current
  pointer: accept.** My plan didn't say otherwise, but the shared builder must
  take its source explicitly, as the initializer already does for copies.
- **F. Approvals: partly disagree.** See section 4. I agree my 6 to 8 week
  figure and 1 to 3 MB size were estimates, and the first slice should
  re-measure both.

## 3. Agreements

Beyond everything listed in Codex's section 2, we also agree on:

- Keep W12 and W13 world-only by default, defer "Save this session as a
  world" past V1, and keep both optional.
- Bind every legal verdict to source, scenario, date, state revision and the
  full proposal, so a stale green result can't be applied or exported.
- Keep source date, scenario date and the displayed salary season separate,
  and fix the draft loader's same-date gate (`governedDraftWorld.load.ts:164`,
  verified).
- Replace the global picks-only overlay with one coherent session checkpoint.
- Reuse PR #688's private Firestore packages and Vercel endpoint. No Blaze, no
  new provider.

## 4. Disagreements and corrections to Codex's plan

1. **Owner authorization is overstated.** The plan says "The documented setup
   already has owner authorization" and "Verify the existing authorization...
   rather than re-requesting approval." The cited PR comment
   (`#688#issuecomment-7238254123`) is a status update without an approval.
   Linear BZE-359's latest comments say the setup is "ready for authorization"
   and that the Firebase install and Vercel configuration "remain pending". The
   owner may have approved it somewhere I can't see, but the plan should not
   assert it without a record. **The synthesis should ask the owner
   directly.**
2. **Live-site safety between stages isn't addressed.** Merges to `main`
   deploy straight to the live site. Stage 8 publishes the new release last,
   but Stages 2 to 7 change Sandbox code paths. Each stage must either leave
   live Sandbox working on its current inputs or run behind a switch until
   its data is live. I'd publish the release (my step 1, Codex's Stage 8 data
   part) as early as the approval allows, because every later stage needs it
   for real verification.
3. **Delete legacy paths as each action moves, not at Stage 7.** Codex
   already says this for the trade path in Stage 2. Make it the rule for every
   family. Otherwise old and new Sandbox paths coexist for weeks, which is the
   condition that caused this problem.
4. **"Do not add fake world IDs" needs one agreed meaning.** The plan forbids
   them, and Codex's review then accepts "a legitimate local namespace in
   existing normalized schemas". The synthesis should state the rule once: a
   local scope ID in the existing world-ID field is allowed, with an explicit
   workspace kind, so it's never treated as an account-owned saved world.
5. **No sizes at all.** The owner needs rough ranges to plan around. Give
   ranges per stage, mark them as estimates, and re-estimate after the first
   slice.
6. **Readability.** The synthesized plan needs a one-page owner section in
   plain words. Detail for agents can follow.

## 5. What Codex caught that I missed

All verified:

- **Plain signings are blocked in Sandbox** (F1 above).
- **Sandbox trades skip the 15-player maximum.** `postStateCapValidator.ts:818`
  only enforces the in-season standard maximum when
  `worldId !== 'preview-world'`, and Sandbox trades run as `'preview-world'`
  (`tradeExecutionAuthority.ts:462`, `tradeContext.ts:243`). That's a real
  legality gap today.
- **Roster size and timing are advisory by flag.** `rosterEnforcement: 'warn'`
  is commented as a "deliberate sandbox-friendly choice". The roster minimum
  has a genuine grace period and the maximum doesn't, so Stage 3 needs the
  Canon to set each one.
- **The forward-date conflict in the draft loader**, validation freshness, the
  full result-state contract (legal, illegal, needs input, unavailable,
  stale), source-rotation acceptance, the ARCH-finding reconciliation, and
  dated free-agent membership (an expired row is not "available now").

## 6. What my plan covered that Codex's doesn't

- A concrete, reusable seam: the shared starting-document builder
  (`buildContractBaselineTeamDocuments` already takes any scope ID) and a
  store-shaped interface. Codex now adopts both in its review.
- The anonymous sign-in that already exists (`useAuth.ts`), plus the cost of
  the whole-collection player subscription. Codex acknowledges both.
- Early data publication with a measured public payload. The June 5 contract
  release is already public in `public/architect/contract-source-releases/`,
  which matters for the data-terms question.
- An owner-readable summary and size ranges.

## 7. Risks neither plan handles well

1. **Mobile browsers can delete Sandbox data on their own.** Safari can clear
   a site's stored data after about seven days without a visit, unless the
   site is added to the home screen. Chrome can evict data under storage
   pressure. That directly threatens "kept until Reset". Request persistent
   storage (`navigator.storage.persist()`), keep the checkpoint small, and show
   an honest notice when the browser can't guarantee it.
2. **Which date Sandbox uses by default.** Snapshot date (honest about the
   data) or today's date (what visitors expect)? Rules like the December 15
   signing bar depend on it. I'd default to the snapshot date with a clear
   label and allow moving forward. This is a product choice the owner should
   confirm.
3. **The cost of keeping the data current.** Both plans say "reconcile since
   November 14" without sizing it. The owner wants this as automated as
   possible. Name the refresh effort and what it would take to automate it as
   its own follow-on item, so it isn't hidden inside "publish".
4. **Codex's six risks also stand:** atomic Reset, the exact public format,
   app upgrades with an old checkpoint, sign-in changes, cached pointers, and
   scope growth. Atomic Reset and app-upgrade compatibility should be
   acceptance cases in the first slice, not later stages.

## 8. Recommendation for the synthesis

- Use **Codex's stage order and acceptance matrix** as the spine.
- Add **one agreed seam** introduced by the first slice: the shared
  starting-document builder plus a store-shaped interface for the paths the
  slice needs.
- Define the **Sandbox scope identity**: kind, instance, version and Reset
  generation, with a valid ID pattern.
- Fix the **15-player maximum skip and the advisory flags** in Stage 3 from
  the Canon.
- **Delete each legacy Sandbox path** in the same change that replaces it.
- Keep **live Sandbox working between stages**, and publish the data early.
- Treat **owner authorization for the install** as unconfirmed until the owner
  says so.
- Put a **one-page owner summary with size ranges** at the top.
- Owner decisions to list:
  1. install approval;
  2. Sandbox's default date;
  3. the data terms question, framed concretely;
  4. optional local History and Compare.
