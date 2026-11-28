# Architect completion execution plan

Source: November 26, 2026 completion review and findings workbook. The
[V1 finish checklist](V1_FINISH_CHECKLIST.md) remains the sole V1 status home.
[V1 scope](../../docs/agent-guides/architect-v1-completion-contract.md) stays
frozen at a dated 2026–27 starting world and the promised current-season
workflows. BZE-243 owns the finish. BZE-267 is completed foundation.
Use [current agent rules](../../AGENTS.md) and the
[Architect boundary](../../docs/agent-guides/architect-boundary.md).
The Phase 3A execution guide is archived. For exact NBA rules use
`npm run architect:canon:lookup -- <leaf>`.

## Execution order

1. **Restore main.** The consumer registration landed in
   [#666](https://github.com/Bet-Zero/scoutzero/pull/666). The
   [full main workflow](https://github.com/Bet-Zero/scoutzero/actions/runs/46078698577)
   verified the repair.
2. **Deliver on the normal ScoutZero site.** Vercel automatically deploys
   reviewed `main` merges. Use normal accounts and account-owned worlds. The
   owner-only rollout, branch holds and per-build private inputs were
   temporary. Keep the reviewed [#668](https://github.com/Bet-Zero/scoutzero/pull/668)
   draft as a source for the proven lifecycle, deletion fences, recovery,
   slug/code fix and signed-in evidence. Bring over the parts needed for each
   normal-site change. #662 is in #665's ancestry. Reuse #660's Node 22 and
   callable identity changes if the chosen runtime requires them.
   History index definitions belong in Git. Install private versioned inputs
   once through an authorized runtime path and verify new worlds with normal
   sign-in. Keep existing worlds on their original baselines. Use existing
   free infrastructure where feasible.
   [#665](https://github.com/Bet-Zero/scoutzero/pull/665) ·
   [#662](https://github.com/Bet-Zero/scoutzero/pull/662) ·
   [#660](https://github.com/Bet-Zero/scoutzero/pull/660)
3. **Fix ordinary actions.** On green main do saved-roster legality, ordinary
   signing proration, then app-derived trade money. Run the initial action
   readiness slice alongside roster work and extend it with each action.
   Distinguish rule prohibition, closed window, missing decisive fact,
   missing approved assumption and unimplemented mechanism. Use dated evidence
   and eligible denominators for the 30 teams. Require only the inputs each
   action needs. Protect existing free-agent and pending-action inputs before
   enabling any source refresh.
4. **Finish the current experience.** Follow the dependencies below for the
   clock guard, books and rights, History/Compare/Guide, accessibility and
   final proof. Keep known liabilities and obligations. Show projections
   separately from final tax assessment, whose baseline needs each team's
   last regular-season game (CBA2-C08.1). Validate lawful cases at their
   world dates and exercise save, room return and full reload for each
   touched team. For changed UI verify 1280×720 and phone width.
5. **Close V1 through its checklist.** Reuse accepted engines, atomic writes,
   revision and digest protections and valid case evidence. Add focused proof
   for changed or missing behavior and then one integrated scenario battery.
   Routine merges use the owner's standing authorization. Private publication,
   shared Firebase deployments, permissions, migration, billing and material
   scope decisions require separate authorization. Obtain the owner's
   hands-on acceptance for E2.

## Active queue

The step issues are children of BZE-243. The normal-account baseline and
ordinary correctness work proceed independently on green main. Final V1
proof joins them.

| Issue | Outcome | Prerequisite |
| --- | --- | --- |
| [BZE-347](https://linear.app/bzero/issue/BZE-347) | Main contract-history validation restored in [#666](https://github.com/Bet-Zero/scoutzero/pull/666) | First |
| [BZE-358](https://linear.app/bzero/issue/BZE-358) | Normal site delivery and both History index definitions landed in [#676](https://github.com/Bet-Zero/scoutzero/pull/676). The former BZE-348 rollout is superseded. | BZE-347 |
| [BZE-360](https://linear.app/bzero/issue/BZE-360) | [#678](https://github.com/Bet-Zero/scoutzero/pull/678) reads compressed, pinned starting packages directly from private Firestore documents. | Existing private packages and repository Rules |
| [BZE-361](https://linear.app/bzero/issue/BZE-361) | [#680](https://github.com/Bet-Zero/scoutzero/pull/680) shares trusted world initialization across server runtimes. | Existing callable and baseline logic |
| [BZE-359](https://linear.app/bzero/issue/BZE-359) | Create a current 2026–27 world on the main site as a normal account. Verify private runtime inputs, existing worlds and account isolation. | BZE-360, BZE-361, authorized private installation and the applicable runtime, Rules and index setup |
| [BZE-349](https://linear.app/bzero/issue/BZE-349) | Current standard and Two-Way trade ceilings landed in [#670](https://github.com/Bet-Zero/scoutzero/pull/670). Dated shortage and hardship remain open under ARCH-003 and ARCH-052. | BZE-347 |
| [BZE-350](https://linear.app/bzero/issue/BZE-350) | First action-readiness slice landed in [#669](https://github.com/Bet-Zero/scoutzero/pull/669) | BZE-347, alongside BZE-349 |
| [BZE-351](https://linear.app/bzero/issue/BZE-351) | Dated ordinary signing proration landed in [#672](https://github.com/Bet-Zero/scoutzero/pull/672). November Minimum, January full-value exception and post-deadline reduced exception signings saved and reloaded. | BZE-349, BZE-350 |
| [BZE-352](https://linear.app/bzero/issue/BZE-352) | Dated trade figures landed in [#673](https://github.com/Bet-Zero/scoutzero/pull/673). Ordinary and mixed deals saved and reloaded with the money fields blank. | BZE-351 in the original sequence. This independently reviewable change proceeded during its review. |
| [BZE-354](https://linear.app/bzero/issue/BZE-354) | The first date guard landed in [#674](https://github.com/Bet-Zero/scoutzero/pull/674). It refused rewinds and year changes and preserved a forward edit on reload. | BZE-347 |
| [BZE-355](https://linear.app/bzero/issue/BZE-355) | Attribute opening obligations separately in History. Landed in [#679](https://github.com/Bet-Zero/scoutzero/pull/679). | Existing waiver and History models |
| [BZE-356](https://linear.app/bzero/issue/BZE-356) | The shared current-season roster policy in Guide landed in [#677](https://github.com/Bet-Zero/scoutzero/pull/677). | BZE-349 |
| [BZE-357](https://linear.app/bzero/issue/BZE-357) | Show unknown stretch status accurately. Landed in [#681](https://github.com/Bet-Zero/scoutzero/pull/681). | BZE-355 |
| [BZE-362](https://linear.app/bzero/issue/BZE-362) | Show signed cap and apron space in the shared team status strip. Landed in [#682](https://github.com/Bet-Zero/scoutzero/pull/682). | Existing salary books |
| [BZE-364](https://linear.app/bzero/issue/BZE-364) | Explain why an ordinary signing cannot proceed in Free Agency. Landed in [#683](https://github.com/Bet-Zero/scoutzero/pull/683). | BZE-350, BZE-351 |
| [BZE-363](https://linear.app/bzero/issue/BZE-363) | Distinguish a dated tax projection from a final assessment. | BZE-350; CBA2-C08.1 |
| [BZE-365](https://linear.app/bzero/issue/BZE-365) | Show exception creation and use in Compare from committed records. | BZE-352 |
| [BZE-366](https://linear.app/bzero/issue/BZE-366) | Load earlier saved moves in Compare before reporting the original-baseline salary change. | BZE-365 |

## Inspect current action inputs

Run the read-only inventory against the approved local financial package and
its existing SHA-256 pin:

```sh
node --import tsx scripts/architect/inspectCurrentActionReadiness.ts <file> <sha256>
```

The report checks dated roster, salary books, trade window and Minimum route
coverage for all 30 teams. Each proposal still needs its specific player and
terms. Keep private source files and inspection output outside Git.

## Proposed full Architect scope

Propose a multi-season GM simulator within ScoutZero. Select a finite supported horizon
and projection policy before implementation, with two consecutive complete
annual transitions as the minimum proof. Cover ordinary first/second-round
portfolios, obligation settlement, rookie rights/outcomes, options/extensions,
common signing and waiver routes, S&T with picks, incentives, trade bonuses,
poison pill, DPE, authored contract lifecycles, and scenario branching/recovery.
Two-Way conversion and Ten-Day/rest-of-season routes are proposed additions.
Preserve exact accepted rules and distinguish dated known facts and labeled
simulation assumptions.

Set the shared requirements for future calendars, contract provenance and
transition inputs before expanding authoring. Build the seasonal transition
seams on the accepted engine, then exercise connected draft settlement and
rookie authoring before the complete multi-year proof. Admit compensation and
exception routes by the actual affected population and only with enough
evidence for their books, history and subsequent transactions.

Owner choices stay outside the active queue. They include horizon and refresh policy,
capacity and recovery promise, conditional options, waiver/set-off depth,
Exhibit/Summer and roster/medical detail, four teams, the guided Offseason
room, interactive draft night, custom pick authoring, and real-franchise
history or historical certification. Any operational protection settings
are a separate choice. Existing V1 exclusions and adjacent product boundaries
apply. The full-product records below are proposals until their scope is
chosen.

## Finding coverage and prerequisites

Numbers in **After** refer to ARCH IDs. A dependency can supply an
implementation input or a later proof. Three feedback loops have distinct
entry and exit steps:

- Land ordinary fixes incrementally. Integrate 001 through normal accounts,
  reusing relevant 027 and 029–034 proof, then seek 035 V1 acceptance.
- Define 030 version identity first, implement 012 and 061, then rehearse
  030 rotation across new and existing worlds.
- Agree 037, define 036 transition seams and 040 provenance requirements,
  then implement basic 046 terms, 040 replay, and 038/039 draft outcomes.
  Integrate 036 and run the shared multi-year 036/040 proof.

The proof rows apply to the selected scope. A dash means existing authority
or evidence is sufficient to start.

| Finding | Disposition and finish condition | After |
| --- | --- | --- |
| ARCH-001 | Main repair is merged. Integrate the needed lifecycle for normal account-owned worlds, reusing the retained Preview proof. Verify affected lifecycle paths on the normal site. | BZE-347 first; BZE-359 and relevant 027, 029–034 for normal V1 delivery |
| ARCH-002 | Correct live pointers to checklist, candidate and next issue. Retain historical records and label their evidence accurately. | — |
| ARCH-003 | Use dated roster policy at preflight and before any saved-trade write. Prove 15 standard plus 3 Two-Way, rejection of either excess, and applicable dated exceptions/grace. | BZE-347; CBA2-R06.8, CBA2-C20.1 |
| ARCH-004 | Guard unsupported date moves in BZE-354. Prove a forward move, rewind refusal and year-boundary refusal. Keep pending offers, options and prior actions in the later progression proof. | BZE-347 now; 036/037 for future progression |
| ARCH-005 | Compute ordinary Minimum and affected exception proration. Prove pre-opening October 2, lawful November and January saves/reload, and cutoff refusals. | 003, 007 initial slice; governed calendar; CBA2-C13.23 and applicable exception leaves |
| ARCH-006 | Derive salaries/apron effects from governed books and matching. Prove HOU–MIL and another legal trade without manual arithmetic, recomputation and stale-choice expiry. | 005, 007 initial slice |
| ARCH-007 | Establish per-action 30-team readiness and plain reasons. Start from the November 14 snapshot, then add tax, rights, dates, cash and selected compensation as each becomes relevant. | BZE-347; extend with 008–011, 042–045 and 062 |
| ARCH-008 | Implement labeled tax projection and receipt distinction. Verify known cap/apron effects and preserve unavailable final assessment. | 007 initial slice; CBA2-C08.1 |
| ARCH-009 | Resolve action-critical dated rights/holds and future obligations. Prove own FA/RFA effects and field-specific gaps. | 007 initial slice, 008 tax distinction, 012 |
| ARCH-010 | Supply eligible dated option/ETO terms and reuse option engine. Exercise/no-exercise, closed windows and books/history/Compare persist correctly. Conditional depth is an owner choice. | 004, 007, 009; 036/037 for future-window proof |
| ARCH-011 | Supply decisive contract/league evidence for eligible extension families. Verify Veteran, ten-Team-Seasons, Designated Veteran and Rookie Scale with lawful dates or governed fixtures. | 007 and applicable dated evidence |
| ARCH-012 | Pin the world-relevant FA universe/terms. Prove a controlled release rotation leaves old worlds stable and new worlds can take a new version. | 030 versioning design; coordinate final rotation with 061 |
| ARCH-013 | Verify FA identity/aliases, age date or DOB and height units against sources. Fix approved facts and distinguish appearance from eligibility. | 012 |
| ARCH-014 | Reconcile ordinary seconds by team/year and reuse connected-rights custody. Prove transfer, reload, branch and history without duplicate claims. | 030 versioning, 015 receipt/Compare path |
| ARCH-015 | Surface actual pick and connected-right deltas from saved receipts. Prove before/after for all affected teams after reload. | Existing #659 receipts and integrated 001 for candidate proof |
| ARCH-016 | Show exception creation/consumption in Compare. Prove net and per-move effects from retained records. | 006 for representative trades; included in 026 proof |
| ARCH-017 | Paginate Compare from the original baseline in BZE-366. Prove 51+ events, earlier deltas, branch and reload. | Existing snapshot/event models; 015/016 for combined proof |
| ARCH-018 | Attribute opening obligations separately from saved moves. Prove an empty new timeline and correctly attributed new waiver after reload. | Existing history/waiver model |
| ARCH-019 | Preserve explicit stretched, explicit unstretched and unknown with unchanged underlying money. | 018 attribution fixtures |
| ARCH-020 | Reuse roster policy in Guide. Prove 15+3, each excess and unknown list state. | 003 |
| ARCH-021 | Use shared signed cap/apron display. Prove positive, zero and negative space without reliance on color. | Existing books |
| ARCH-022 | Use plain, actionable feedback for success, rejection, unavailable, pending and retry states. | 007 reasons and affected action repairs |
| ARCH-023 | Fix dialogs and verify focus, cancellation, deletion feedback, all changed states at desktop/phone and realistic full rosters. | 001 lifecycle, 020–022 and changed UI |
| ARCH-024 | Prove stage retention or explicit discard across rooms, teams and worlds. Integrate the journey into the final battery. | 001 world identity and 027 saved-write boundary |
| ARCH-025 | Verify existing export matches the mixed deal and identifies proposed/applied status. | 006, 024; include in 026 |
| ARCH-026 | Prove current W1–W15 promises through normal entry points at lawful times, with cross-room and persisted consistency, and honest scoped exclusions. | Affected current defects/readiness, 023–025, 027/029, 060–063 |
| ARCH-027 | Prove duplicate retry, stale tab, interrupted response and atomic multi-team no-partial-write behavior. | 001 candidate |
| ARCH-028 | Prove independent branching and parent/child constraints. Owner chooses recovery depth and capacity; demonstrate an authorized restore if promised. | 027, 029, 030; 060 for pending offers |
| ARCH-029 | Prove preservation for the relevant older-world cohort or approved representatives. Record regenerated fixtures and missing original exports at their actual scope. | 001, 027, 030 version identity; reuse #659 proof |
| ARCH-030 | Define private runtime version/hash/recovery and intentional refresh policy. Verify prior worlds still use their original versions after rotation. | Design before 012/061; rotation after both and 031 runtime setup |
| ARCH-031 | Use normal Git delivery and version the needed History/Recent Moves indexes. Verify the trusted runtime, deployed Rules and both query shapes when the hosted baseline is installed. | 001 and 030 for hosted baseline; authorization for shared Firebase changes |
| ARCH-032 | Verify normal account ownership, runtime least privilege and private package isolation. Reuse proof of unchanged behavior. | 001, 031; permission changes reserved |
| ARCH-033 | Check existing quotas for actual usage. Bring a capacity, recovery or cost decision only when the intended workload requires it. | 027, 030, 031; 028 for selected recovery |
| ARCH-034 | Apply scoped green checks and fresh independent review where required. Optional branch/ruleset enforcement is an owner settings decision. | Current AGENTS; verify at 001/035 |
| ARCH-035 | Complete D2 on the normal site and obtain E2 hands-on acceptance of the current-season V1 milestone, with explicit capabilities and limitations. | 001, 026, applicable 029–034 |
| ARCH-036 | Define transition seams after future authority; use the existing 30-team engine. Prove two consecutive atomic annual transitions across all teams, branches and reloads. | 004, 037 for seams; 038–040 for full proof |
| ARCH-037 | Owner selects horizon/projection policy. Establish versioned future calendar and levels, preserve known actuals and expose projections on replay. | 030 version policy |
| ARCH-038 | Settle protected, pooled, swap and frozen rights from simulated results, preserving lineage and all parties. | 014, 037 and 036 transition seams |
| ARCH-039 | Connect settled selection, rookie rights, terms and books; prove signed/unsigned outcomes into the next year. | 038, 040 requirements and 046 basic terms |
| ARCH-040 | Implement replayable authored provenance/shared lifecycle. Prove sign, advance, amend, trade and waive without fabricating source artifacts. | 037, 036 seams for design; 046 and 036 integration for chained proof |
| ARCH-041 | Support offseason S&T with connected picks, first-apron hard cap and atomic reload; certify applicable compensation variants. | 036–038, 046; 042/043 where applicable |
| ARCH-042 | Fold governed incentive evidence/assumptions into matching and books. Verify independent salary results and replay. | 007/008, 030; 046 where authored |
| ARCH-043 | Preserve known bonuses and govern allocation, waiver, payer and repeated trades. Verify independently against Canon and reconcile policy. | 040 provenance, 046 basic terms |
| ARCH-044 | Apply sender/receiver poison-pill bases with the proper effective date. Prove mixed trade and boundary controls. | 011, 040 provenance, 046 basic terms |
| ARCH-045 | Support dated DPE grant/use, expiry and single consumption through signing/trade. Verify History/Compare. | 016, 037, 046 basic terms |
| ARCH-046 | Extend existing contract editors to selected structured terms and guarantees. Verify future books and lifecycle; owner chooses conditional-option depth. | 037, 040 requirements before authoring; integrate 042–044 as their authorities land |
| ARCH-047 | Propose Two-Way signing/conversion across dates with correct category and money effects; prove refusal at limits. | 003, 036 seams, 040, 046 |
| ARCH-048 | Propose Ten-Day and rest-of-season routes; owner chooses Exhibit/Summer depth. Prove expiry, repeat limits, dates and roster treatment. | 004, 005, 036 seams, 046 |
| ARCH-049 | Support second-round signing routes using governed rookie rights and common authoring. Prove exception, minimum alternative and future books. | 014, 036 seams, 039, 046 |
| ARCH-050 | Expose governed renegotiation and chosen extension combination. Prove eligibility, cap constraints, persistent current/future books and Compare. | 011, 040, 046 |
| ARCH-051 | Propose common claims, priority and clearing; owner chooses partial/medical/non-NBA set-off depth. Prove atomic acquisition and preserved obligations. | 004, 027, 036 seams, 040 |
| ARCH-052 | Owner chooses operational list/medical depth beyond necessary legality state. Prove selected actions and state limits honestly. | 003, 004 and selected 045, 047, 048 |
| ARCH-053 | Verify conditional cash/reimbursement status before sizing. Implement selected legal paths or record owner-approved exclusion; prove ledger conservation. | 062, 043/046 where applicable |
| ARCH-054 | Owner decides four-team breadth. If selected, prove unified atomic routing and all participants visible. Existing scope covers two/three teams. | 026, 027 and relevant trade mechanisms |
| ARCH-055 | Owner decides guided Offseason presentation. Keep the room parked under V1. If chosen, connect it to the working offseason actions. | 036–041 |
| ARCH-056 | Owner decides interactive draft night. If selected, use shared outcomes and verify rights/contracts after reload. | 038/039 |
| ARCH-057 | Keep custom authoring hidden under V1. Owner may choose later sandbox forms with provenance and custody validation. | 014/038 if chosen |
| ARCH-058 | Preserve agreed simulation boundary with transparent assumptions and opening obligations. Owner may separately choose real-history reconstruction/certification. | 018/030 for proof of simulation promise |
| ARCH-059 | Preserve agreed exclusion of adjacent scouting tools, new provider, platform rewrite and generic polish. Admit concrete dependencies only. | Applies throughout |
| ARCH-060 | Contain unsupported pending-offer copies before writes, then preserve child offer authority and mirrors. Prove independent resolution and reload in both worlds. | 027 and 028 branch contract; complete branch proof uses 060 |
| ARCH-061 | Resolve pending actions with pinned creation evidence and intact digest checks. Prove both match and decline across controlled source rotation. | 012, 030 versioning; 060 for the copied-world case |
| ARCH-062 | Establish dated annual cash ledgers or permitted visible assumptions preserving prior spend. Prove both parties and saved effects, then future rollover. | 007 and 030 versioning; 036/037 for rollover |
| ARCH-063 | Accept complete rare-event input with exact obligations. Prove neither/either/both combinations and keep missing-input behavior. | Existing compiler and governed inputs |
