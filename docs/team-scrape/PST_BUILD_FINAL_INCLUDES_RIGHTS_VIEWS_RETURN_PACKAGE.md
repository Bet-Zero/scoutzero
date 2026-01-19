# RETURN PACKAGE: PST Build Final Includes Rights Views

## Summary

The `pst:build-final` convenience command has been updated to include the generation of manual rights views. This ensures that a single command produces all final outputs for the draft pick ledger, including the new rights-style views.

## Files Changed

- `package.json`
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`

## New Build-Final Command Chain

```bash
npm run pst:apply:overlay && npm run pst:phase-4 && npm run pst:phase-5 && npm run pst:phase-5:validate && npm run pst:manual-views && npm run pst:manual-rights-views
```

## Output Paths Updated by build-final

- `data/pst/manual_check_views.txt` (and per-team files)
- `data/pst/manual_rights_views.txt` (and per-team files)

## Phase Status

COMPLETE
