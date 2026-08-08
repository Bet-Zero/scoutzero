# Architect Contract Event History (BZE-271)

**Scope:** the immutable contract lifecycle event ledger and the dated
projection that reconstructs which contract version existed at an explicit
instant.
**Frozen references:** accepted Canon candidate
`6cf8aaf358c158a88e630e8a7336f7e9c3febc17`, canon SHA-256
`23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`, accepted
Phase 2 gap register `19dc84fc4050ce9cf749136dae1f9854adc72ef7`, accepted audit
summary `4b21456d491f9593edc2961afae47ef64ae28e32`, BZE-268 accepted head
`55ddde0dbf189c61b03f96833ad22c6847308b97`, BZE-270 accepted head
`0f2d46425bff37e05d141465266d9c1c32b20351`, baseline
`9b386a70ff1f094ae3c172a6f14f5a80719b5cac`.

---

## 1. The defect this answers

The Phase 2 audit records twelve leaves under one shared root cause,
`contract-event-ledger-incomplete`. Its inspection note for `CBA2-L02.1` reads:

> Sign, extend, and option-decision mutations are distinct persisted operations
> and season advance applies option/contract transitions. Amendments,
> conversions, ETO exercise, Renegotiation, signing versus effective dates,
> amendment lineage, and supersession are not distinct contract lifecycle
> records; much state is inferred from overwritten salary rows and flags.

Three things follow from that. Lifecycle acts are not separable, so a
conversion cannot be told from an amendment. Signing and effective dates are
collapsed, so "when did this take effect" has no answer. And because rows are
overwritten, the prior contract version is simply gone — there is nothing to
reconstruct a date from.

## 2. What this establishes

An append-only event history plus a deterministic replay of it.

A caller records lifecycle events; each one is immutable and versioned. To ask
what a contract looked like on a date, it projects the history at an explicit
zoned instant and an explicit Salary Cap Year, and gets back the contract
version in force plus the exact ordered events that produced it. Nothing is
overwritten, no runtime clock is read, and no undated "current contract"
snapshot is trusted.

### Event kinds

Nine kinds cover the seven lifecycle families `CBA2-L02.1` names:

| Kind | Family |
|---|---|
| `signing` | signing |
| `amendment` | amendment |
| `conversion` | conversion |
| `option-exercise`, `option-decline` | option |
| `eto-exercise`, `eto-decline` | eto |
| `extension` | extension |
| `renegotiation` | renegotiation |

Option and ETO split into exercise and decline because those produce different
resulting contract versions and are not the same act. Collapsing them into one
kind plus a boolean would put the distinction back into a flag the history layer
does not interpret — the defect this work exists to remove.

### What every event retains

| Retained | Field |
|---|---|
| World, contract, player, team identity | `worldId`, `contractId`, `playerId`, `teamId` |
| Event identity and version | `eventId`, `eventVersion` |
| Event kind | `eventKind` |
| When the act was executed | `executedAt` |
| When the result takes effect | `effectiveAt` |
| When this record version was appended | `recordedAt` |
| Predecessor contract version and event | `predecessorContractVersion`, `predecessorEventId` |
| Resulting contract version | `resultingContractVersion` |
| Provenance | `sourceTransactionId` or `authoringIdentity` |
| Supersession | `recordStatus`, `supersedesEventVersion` |
| Canon traceability | `canonLeafIds` |

Three timestamps, not two. `executedAt` and `effectiveAt` are the pair the
Canon asks for. `recordedAt` is separate because a correction is executed at the
original act's time but written down later; without it an append-only revision
would look like a chronology violation.

Provenance is required: an event with neither a source transaction nor an
authoring identity cannot be traced to anything that produced it, so it is
rejected rather than admitted as anonymous history.

## 3. Rules the ledger enforces

Construction is the only door into the history path, so validation is total
rather than best-effort. Every one of these is a refusal, never a repair — the
history layer has no authority to pick a winner or invent a missing link.

1. **Identity.** World, contract, player, team, event ID, event version,
   resulting contract version, at least one Canon leaf, and provenance are all
   required.
2. **Supported kinds only.** An unrecognised kind is rejected, not stored as an
   opaque string.
3. **Zoned instants only.** `executedAt`, `effectiveAt`, and `recordedAt` must
   each carry an explicit `Z` or numeric UTC offset, using BZE-270's validated
   primitives.
4. **Causality.** An event cannot take effect before it was executed, and cannot
   be recorded before it was executed.
5. **Unique identities.** One `eventId@eventVersion` identifies exactly one
   record.
6. **One current version per event.** A correction appends a new `eventVersion`
   that marks the prior one `superseded`. Two `current` versions, zero current
   versions, a revision superseding a version the ledger does not hold, or a
   revision recorded before the version it replaces are all rejected.
7. **One origin.** Exactly one `signing` per contract. A signing names no
   predecessor; every other kind must name both a predecessor contract version
   and the event that produced it, and the two must agree.
8. **No gaps, no forks, no competing versions.** A consumed contract version
   must have been produced. Two events succeeding the same version is a fork.
   Two events producing the same version is a competing-current-version
   conflict.
9. **One contract, one subject.** All events of a contract must agree on the
   player and the team.
10. **Unambiguous ordering.** Effective instants must strictly increase along
    the chain. A decrease is invalid chronology; a tie is ambiguous ordering,
    because no single contract version could be projected at that instant.
11. **Deep immutability.** Events are cloned away from the caller and frozen to
    their leaves, so a retained caller reference cannot alter a validated ledger
    or an earlier projection. Appending produces a new ledger at the next
    version and re-validates the whole history; the original object is untouched.

Both a throwing constructor (`createContractEventLedger`) and a non-throwing
validator (`validateContractEventLedger`) are provided. They run identical
validation — neither is a laxer door — so a caller can read every problem as
data instead of catching an error.

## 4. Projection semantics

`projectContractStateAsOf({ ledger, worldId, contractId, asOfDate, salaryCapYear })`

- Every input is required. There is no default date, no default Salary Cap Year,
  and no "most recent event" shortcut. A caller that cannot say when it is
  asking about gets `unavailable`, because answering would mean inventing a time.
- `asOfDate` must be a zoned instant and must fall inside the requested Salary
  Cap Year (July 1 to June 30 Eastern, via BZE-270's `isWithinSalaryCapYear`).
- Only `current` event versions are read; superseded versions are never
  projected.
- The **chain**, not a timestamp sort, is the order. Because effective instants
  strictly increase along the chain, an as-of filter always yields a prefix.
- The boundary is **inclusive**: an event effective exactly at the requested
  instant is included, and the same event one millisecond earlier is not.
- Events not yet effective are returned separately as `futureEvents` and never
  affect `contractVersion`.

Result states:

| State | Meaning |
|---|---|
| `projected` | A contract version was in force; `contractVersion` and `manifest` are populated. |
| `not-yet-effective` | History exists but nothing was effective yet at that instant. No manifest, and no invented version. |
| `unavailable` | The request or the history cannot support an answer; `missingInputs` and `unavailableReasons` say why. |

Every `projected` result carries a manifest holding the ledger identity, the
subject, the as-of date, the Salary Cap Year and season key, and the **exact
ordered event IDs and versions consumed**. Versions are kept, not just IDs,
because a corrected event keeps its ID and changes only its version — without
the version an earlier projection would appear to have been computed from
history it never saw.

`verifyContractProjectionManifest` compares an earlier manifest against a
current ledger and reports drift (`event-absent`, `event-superseded`,
`event-content-changed`, `history-extended`) instead of rewriting anything.

### Money is not an input

Replaying contract history needs no Salary Cap, Minimum Team Salary, Tax Level,
or apron value, so none is required and none is consulted. Taking that
dependency would make history unavailable whenever a money input was. A later
legality calculation that does need those values remains responsible for
obtaining the complete BZE-270 governed envelope.

## 5. What this deliberately does not do

This tranche establishes trustworthy history and deterministic projection. It
does **not** certify the complete CBA legality of every recorded event.

It computes no compensation, no eligibility decision, no deadline, and no
route-specific rule result, because none of those has a Canon-backed owner on
this path yet. A committed event retains the `resultingContractVersion` its
author supplied; the ledger never pretends it independently validated that
version.

Concretely out of scope and untouched: complete Renegotiation, Extension,
option, ETO, protection, compensation, and bonus rules; consent and trade bars;
RFA and Offer Sheets; TPE/DPE lifecycles; transaction commit manifests; waivers;
trade paths; hard-cap rows; roster and list state; production persistence and
consumer migration. No historical event is invented, and no screen is redesigned.

## 6. Compatibility fence

BZE-271 establishes a history path; it does not migrate the application onto it.
Both paths exist on purpose.

- **History side:** `src/features/architect/utils/contractHistory/**`.
- **Mutable side:** `contractUtils`, `contractNormalization`,
  `mutationPipeline.compute.signings.playerOps`,
  `mutationPipeline.helpers.playerNorm.contract`, and
  `offseason/resolveOffseasonTransition` — all unchanged, still overwriting
  contract rows and inferring lifecycle state from flags.

Fence rules, enforced by
`tests/architect/contractHistory/contractHistoryFence.test.ts`:

1. The history path never imports a mutable contract module or an ungoverned
   money module.
2. The mutable path never imports the history path, and no module outside the
   history boundary imports it.
3. The history path imports exactly one governed module,
   `governedSeason/governedTime`, for validated date and Salary Cap Year
   primitives. The governed envelope, registry, and system levels are fenced out.
4. Crossing the fence is a migration, done per consumer, with its own issue and
   tests. Nothing in BZE-271 authorizes it.

No mutable consumer is fixed by this work. The Cap Sheet, Trade Machine, Free
Agency, the contract editor, the mutation pipeline, the offseason transition,
world persistence, and every saved world still read and overwrite the mutable
contract shape.

The serialization in this module is a wire format that proves the ledger
round-trips losslessly. It is not production persistence: no Firestore document
and no saved world is migrated.

## 7. Audit position

Established on this new path only, not product-wide:

- `contract-event-ledger-incomplete` — the shared root cause is addressed as a
  foundation: distinct immutable lifecycle events with signed and effective
  dates, versioned supersession, and a contract version projected from those
  events rather than inferred from overwritten rows.
- `CBA2-L02.1` — signing, amendment, conversion, option, ETO, Extension, and
  Renegotiation are separate lifecycle events with their own effective dates, on
  this path.

Prepared but **not** closed. These leaves gain the dated, versioned,
non-rewriting substrate their remediation needs, and nothing more:

- `CBA2-L02.2` — protection triggers can be recorded as events without rewriting
  prior history, but no protection state, category, or trigger is modelled.
- `CBA2-L02.3`, `CBA2-L02.4` — no protection categories, conditions, or
  exclusions are implemented.
- `CBA2-L02.5`, `CBA2-L02.9`, `CBA2-L02.10` — signing date and original covered
  term are now retrievable at a date; no Renegotiation eligibility, anniversary,
  or cap-room condition is computed.
- `CBA2-L02.6` — Renegotiation events carry exact effective instants; the
  March 1 to June 30 window is not enforced.
- `CBA2-L02.7`, `CBA2-L02.12`, `CBA2-L02.13`, `CBA2-L02.14` — no compensation
  validity, annual-change limit, no-reduction floor, bonus rule, or
  forty-percent first-extended-year boundary is computed.

Explicitly still open:

- every leaf's product-wide state;
- consent and trade-bar lifecycle (`CBA2-L03`);
- RFA and Offer Sheet lifecycle (`CBA2-L04`);
- transaction-state provenance and commit manifests (`CBA2-L06`);
- complete protection, option, ETO, Extension, Renegotiation, compensation, and
  contract-route legality;
- production persistence and consumer migration.

The existence of this history path closes no leaf or cluster product-wide.
