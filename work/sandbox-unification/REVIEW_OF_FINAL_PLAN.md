---
name: REVIEW_OF_FINAL_PLAN.md
description: Claude's final review of PLAN_FINAL.md (commit 01778b5). Verdict ACCEPT, with non-blocking suggestions.
---

# Final review of PLAN_FINAL.md

Reviewed November 28, 2026: [PLAN_FINAL.md](PLAN_FINAL.md) at commit
`01778b5c2f7a9673d352aa8f1fe8b43e86b1a163`. The four originals are unchanged
(checked: the commit adds only `PLAN_FINAL.md`). Code claims were checked
against `main` at `04f8dde`.

## Verdict: ACCEPT

No blockers. The synthesis resolves every cross-review finding, covers the
required workflows, protects existing Worlds and gives a workable order for
data, local saving and live rollout. The suggestions below are optional
improvements, not conditions.

## For the owner, in plain words

The final plan does what you asked. Sandbox becomes the main way to use
Architect, without signup, with every V1 tool and the same rules and money as
a World. Your Sandbox moves stay on your browser until you press Reset. Saved
Worlds are protected from later NBA updates.

The work starts by getting one full trade working end to end, including
reload and Reset. Then the other tools follow, one at a time. Each old Sandbox
path is removed as soon as its replacement is live, and the live site keeps
working in between. The estimate is about 5 to 9 weeks of focused work, to be
re-checked after the first trade slice.

Three things to be aware of, none of which need a decision now:

1. **You'll be asked to approve the live data install once.** That happens
   when the first trade slice is ready to go live, with an exact list of what
   visitors will be able to see and how to undo it.
2. **Sandbox moves are judged as of the data's date, not today's date.** If
   the data says November 14 and today is December 20, Sandbox uses November
   14 by default and lets you move the date forward. That keeps the answers
   honest about the data. Tell us if you'd rather it default to today.
3. **History and Compare stay World-only in V1.** You said Sandbox should have
   all the tools. Every roster, trade, contract and free-agent tool is
   included. The two screens that look back at saved history are not. If you
   want them in Sandbox too, say so; it's a modest addition.

## Cross-review findings and how the plan resolves them

| Finding | Resolved? | Where |
| --- | --- | --- |
| A complete trade slice comes before any broad refactor | Yes | §1 table, Stage 2 |
| One agreed seam, not an interface per action | Yes | §3.3 (one narrow store contract, extended per action) |
| Sandbox scope identity with kind, instance and Reset generation | Yes | §3.2 |
| Parity plus independent Canon expectations | Yes | §8 |
| 15-player maximum bypass and advisory flags | Yes | Stage 2 (fix any bypass in the first slice), Stage 3 |
| Plain signing blocked by the resolver | Yes | Stage 4, first item |
| Legacy paths deleted per activation | Yes | §1, §7, Stages 2 and 4 |
| Live site safe between stages | Yes | §7 |
| Data prepared and measured early; published before activation | Yes | Stage 1, §4.1, §7 |
| Owner authorization treated as unconfirmed | Yes | §1, §7 |
| Copies use the parent's source, not the current pointer | Yes | §3.1, §4.3 |
| Full old-World preservation, not just freezing two collections | Yes | §4.3, A-to-B rotation case in §8 |
| Free-agent pool, dated, plus pinned offer-sheet evidence | Yes | §4.2 |
| Atomic Reset, multi-tab, app upgrades, sign-in changes | Yes | §5 |
| Mobile browser storage eviction | Yes | §5.3 |
| Owner summary with size ranges | Yes | Top section; totals are consistent with §6 (24–43 days) |
| Refresh cost measured; automation sized as a follow-on | Yes | §4.4 |

**One correction to my own earlier review, which the plan rightly makes.**
The `^[A-Za-z0-9_-]{1,100}$` check in `draftReview/capability.ts` (lines 164
and 286) applies to operation IDs, not World IDs. Local scope naming is a free
design choice.

## Coverage of required workflows

W2 through W10 and W14 are each owned by a stage:

| Workflow | Stage |
| --- | --- |
| W2 Reading the books | starting books, Stages 1 and 6 |
| W3 Waive, stretch, buyout | Stage 4 |
| W4 Options, extensions, renouncing | Stage 4 |
| W5 League free-agent signing | Stage 4 |
| W6 Own free agents | Stage 4 |
| W7 Restricted free agency | Stage 5 |
| W8 Sign-and-trade | Stage 5 |
| W9 Trades | Stages 2 and 3 |
| W10 Draft-asset rules | Stages 2 and 3 |
| W14 Guide | Stage 6 |
| Team Plan information | Stage 6 |

W16 is proven by the §8 matrix. The V1 exclusions are preserved with honest
stops in both modes.

## Non-blocking suggestions

1. **Name the approval moment.** §7 and the decisions list say approval comes
   "when the live change is ready". Say explicitly that this is expected at the
   end of Stage 1 or early Stage 2, because no Sandbox trade can go live
   before the public release is installed. That way the owner knows the first
   touchpoint is weeks away, not months.
2. **Surface the date default and the History/Compare scope as plain notes in
   the owner summary** (items 2 and 3 above). Both are already in the plan,
   but phrased as settled ("already the agreed default", "later work"). The
   owner should see them as defaults they can change. Neither changes the
   estimate.
3. **Update the V1 contract wording in Stage 0.** The plan already calls for
   this. For the record, the sentence to fix is in
   `architect-v1-completion-contract.md` line 105, which still lists "reload
   persistence" as saved-world behavior. It now contradicts the owner's
   requirement.
4. **The 2 to 5 day data catch-up is the softest number.** The draft-evidence
   procedure involves independent review of new factual judgments, so a busy
   transaction period could exceed it. The plan already says to re-measure it
   early. Keep that check-in visible to the owner.

## Material errors, omissions or contradictions found

None blocking. The plan's internal estimates add up: the owner table
(8–14 + 9–16 + 5–8 + 2–5) equals the §6 stage sums plus data work
(24–43 days). The persistence promises in the owner summary match §5. The
deferred features (local History/Compare, Save as World, future seasons) are
stated consistently throughout.
