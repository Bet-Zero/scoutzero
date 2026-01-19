# PST Phase 7.3 Recipient-Only Rights Views Return Package

## Summary

Updated Phase 7 rights views to suppress non-recipient "owes" lines for ranked swap distributions so only recipient teams appear in ranked pools. Rebuild steps are blocked because PST ledger inputs are not present in this environment.

## Files Changed

- `team-scrape/draft-picks/scripts/pst/pst_phase_7_rights_views.ts`
- `docs/COMPONENT_INDEX.md`
- `docs/components/RankerHierarchy.md`
- `docs/team-scrape/PST_PHASE_7_3_RECIPIENT_ONLY_RIGHTS_VIEWS_RETURN_PACKAGE.md`

## Commands Run

- `npm install` (failed: puppeteer download blocked)
- `PUPPETEER_SKIP_DOWNLOAD=1 npm install`
- `npm run lint` (fails with existing lint errors)
- `npm run test -- --run` (fails with existing test failures)
- `npm run build`
- `npm run pst:manual-rights-views` (failed: missing `data/pst/pst_pick_ledger_final_2026_2033.json`)
- `npm run pst:build-final` (failed: missing `data/pst/pst_base_ledger_2026_2033.json`)

## Before/After: DAL 2029 Block

**Before** (captured from the prior Phase 7 return package at `docs/team-scrape/PST_PHASE_7_RIGHTS_VIEWS_RETURN_PACKAGE.md`; this is the owed-side line now suppressed):

```
2029 | 1 | owes most favorable to HOU | pool (DAL,HOU,PHX) | via HOU swap rights
```

**After** (blocked - ledger inputs unavailable in this environment): DAL 2029 no longer emits an owed-side line for ranked pools; only recipient lines remain once data is available.

## Proof: HOU/BKN Recipient Lines

Blocked: unable to regenerate rights views because PST ledger inputs are missing. Once `data/pst/pst_pick_ledger_final_2026_2033.json` is available, rerun `npm run pst:manual-rights-views` to confirm:
- HOU receives most of (DAL,HOU,PHX)
- HOU receives 2nd most of (DAL,HOU,PHX)
- BKN receives least of (DAL,HOU,PHX)

## Status

**BLOCKED** — missing PST ledger inputs in `data/pst/` prevent regenerating rights views and validating DAL/HOU/BKN outputs.
