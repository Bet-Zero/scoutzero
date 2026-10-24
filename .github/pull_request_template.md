## Change and impact

Describe the outcome, actual affected behavior/consumers, and execution level:
isolated cosmetic/content, ordinary behavior, or consequential/cross-cutting.
Explain isolation or material uncertainty briefly. Labels do not select checks.
Link an existing issue if applicable; a small change needs no new tracking issue.
When inspection finds tests outside static imports, retain additive
`Validation-Tests` commit trailers as described in AGENTS.md; labels cannot
subtract checks.

## Verification

- Relevant checks actually run and results:
- Skipped checks and why; known limitations:
- Independent review: not required with reason, or exact candidate/verdict receipt:

For consequential work, include focused failure proof and the exact frozen
candidate/base, green CI and independent acceptance receipts. Apply the Phase 3A
record only when that lane governs the work. Browser/emulator artifacts are
required only for affected risks or an existing owner-approved design wave.

## Landing

- [ ] Selected checks passed; skipped checks are not reported as passes
- [ ] Required review is accepted for the unchanged candidate; findings resolved
- [ ] Applicable owner approvals and protected production boundaries are preserved
