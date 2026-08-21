# BZE-285 Negative-Test Matrix

Candidate freeze requires every row below to have committed automated coverage
or a recorded rendered proof. Fixtures must keep Team Salary, Apron Team Salary,
and Tax Salary deliberately different.

| Risk | Required negative proof | Expected result |
| --- | --- | --- |
| One generic total is relabeled as three books | Change or alias one fixture book without changing the other two | A book-specific assertion fails |
| Apron component is missing | Remove any required C07.2-C07.11 input | Apron Team Salary is `needs_input`; Team and Tax identities remain intact |
| Tax component is missing | Remove C08.1 or any required C08.2-C08.8 input | Tax Salary is `needs_input`; no Team/Apron fallback |
| Component direction is malformed | Give a governed debit/credit leaf the wrong sign | Affected book is `not_evaluated` with the conflicting leaf named |
| Book identity is swapped | Store an Apron line as Tax, or vice versa | Strict schema rejects the snapshot |
| Date is missing, stale, or changes | Omit the world date, then move it across an effective-date boundary | Missing date fails closed; changed date recomputes all dependent books |
| Season lacks authenticated apron/tax authority | Evaluate outside the governed system-level window | Team-state salary may total; Apron and Tax stay unavailable with no historical guess |
| Incomplete-roster charge lacks an authenticated amount | Leave roster below the minimum without the governed charge input | Team Salary is `needs_input`; zero is not inferred |
| Validation consumes the wrong book | Put Team below a threshold while Apron/Tax are above their own thresholds | Cap, apron/hard-cap, and tax findings follow their respective books |
| Persistence or reload loses identity | Round-trip inputs and totals through saved-world normalization | Three distinct books and statuses survive unchanged |
| Branch/fallback borrows a generic total | Remove one named book from a branch/fallback payload | Missing book remains explicit and blocks dependent evaluation |
| History, Compare, or receipt collapses the books | Create before/after snapshots with three different deltas | Three labeled values/deltas render and serialize independently |
| Trade Machine uses Team Salary for apron rules | Give Team and Apron values on opposite sides of an apron | Apron rule follows Apron Team Salary; receipt still labels Team Salary separately |
| Existing completed workflows regress | Run focused option, extension, Offer Sheet, trade-path, and waiver suites | Existing governed behavior remains green or a failure is shown to be unrelated |
