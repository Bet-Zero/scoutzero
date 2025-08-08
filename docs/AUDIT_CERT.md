# NBA Trade Machine — Certification

**Commit:** 1fa30db • **Date:** 2025-08-08T05:11:02+00:00 • **Suite:** 123/123 PASS

**Verdict:** CBA 2023+ compliance (year-2 rules active) — **PASS**

**Hard-enforced invariants (bullet list):**

- Salary matching bands; 1st-apron 100%
- 2nd-apron: **no aggregation, no cash, no TPE, no FA exceptions, ≤100% take-back**
- BYC = max(prior, 50%); poison-pill average; trade-kicker proration
- S\&T: receiver ≤ 1st apron + hard-capped; 3–4 yrs; Y1 guaranteed; offseason; origin team; not taxpayer MLE
- Stepien/7-year/frozen pick; re-acq bar; consent (full/limited NTC + 1-yr Bird)
- TPE lifecycle (creation/expiry) and 2nd-apron ban; cash ledger seasonal caps

**Soft/toggled rules:** moratorium & roster window (warn → optional error)

**Known limits:** protections/encumbrances parser expects well-formed text; UI admin steps noted

**Links:**

- [Deep audit](AUDIT_DEEP.md)
- [Compliance matrix](COMPLIANCE_MATRIX.csv)
- [Order of operations](ORDER_OF_OPERATIONS.md)
