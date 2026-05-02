# Return Packages Directory Consolidation

## Phase 2 Status Note

- Phase 2 moved the tracked legacy root `return_packages/` markdown evidence into `docs/return_packages/`.
- The canonical docs-facing evidence areas now include `docs/return_packages/docs/` and `docs/return_packages/typescript/`.
- No root local-log artifacts were moved into `docs/`; the legacy root remains ignored/local-only for that purpose.
- `docs/architect/` and `docs/team-scrape/` evidence separation is still pending for a later phase.

## Phase 1 Status Note

- Phase 1 decision: the future canonical return-package path is `/docs/return_packages/`.
- Root `/return_packages/` remains legacy historical evidence until consolidation.
- No files were moved in Phase 1.

**Date**: February 12, 2026
**Issue**: Multiple return-packages directories with inconsistent naming (hyphen vs underscore)

---

## Current State

The inventory below is the historical pre-consolidation snapshot from 2026-02-12. Phase 2 changed the active docs-facing archive location but did not rewrite this original baseline table.

### Directories Found

| Directory                             | Files | Latest Date  | Naming         |
| ------------------------------------- | ----- | ------------ | -------------- |
| `/docs/return-packages/`              | 27    | Jan 10, 2026 | Hyphen         |
| `/docs/return_packages/`              | 63    | Feb 4, 2026  | **Underscore** |
| `/return_packages/` (root)            | 79    | Feb 12, 2026 | **Underscore** |
| `/docs/architect/return_packages/`    | 107   | Feb 2, 2026  | **Underscore** |
| `/docs/team-scrape/return-packages/`  | 3     | Jan 11, 2026 | Hyphen         |
| `/docs/team-scrape/return_packages/`  | 43    | Feb 4, 2026  | **Underscore** |
| `/docs/tradeMachine/return-packages/` | 15    | Jan 16, 2026 | Hyphen         |

### Observations

1. **Naming inconsistency**: Both `return-packages` (hyphen) and `return_packages` (underscore) exist
2. **Underscore naming is canonical**: Based on project memory and more recent files
3. **Root-level directory**: `/return_packages/` exists at root but should be in `/docs`
4. **Hyphen directories appear older**: Jan dates vs Feb dates for underscore versions
5. **Different content**: Hyphen vs underscore directories contain different files (not duplicates)

### From Project Memory

> **Codebase Patterns**: `return_packages/` and `docs/architect/return_packages/` are the two deliverable-drop directories.

This confirms **underscore** (`return_packages`) is the canonical naming.

---

## Issues

1. **Confusing organization**: Developers don't know which directory to use
2. **Root-level clutter**: `/return_packages/` should be under `/docs`
3. **Naming inconsistency**: Mixed hyphen and underscore naming
4. **Potential lost documentation**: Hyphen directories may contain unique historical docs

---

## Recommended Consolidation Plan

### Phase 1: Investigation (Do NOT Execute Automatically)

**Manually review** to understand what's unique in each directory:

```bash
# Compare hyphen vs underscore in docs/
diff -qr docs/return-packages docs/return_packages

# Check for unique files in hyphen versions
comm -23 <(ls docs/return-packages | sort) <(ls docs/return_packages | sort)
comm -23 <(ls docs/team-scrape/return-packages | sort) <(ls docs/team-scrape/return_packages | sort)
```

### Phase 2: Decision Points

**Option A: Merge into canonical underscore directories**

- Move unique files from hyphen dirs to underscore dirs
- Delete empty hyphen directories
- Update any references in code/docs

**Option B: Keep as historical archive**

- Rename hyphen dirs to `return-packages-archive/`
- Add README explaining they're historical
- Keep underscore as active

**Option C: Consolidate all to single location**

- Move everything to `/docs/return_packages/`
- Organize by subsystem subdirectories:
  - `/docs/return_packages/architect/`
  - `/docs/return_packages/team-scrape/`
  - `/docs/return_packages/trade-machine/`
  - `/docs/return_packages/general/`

### Phase 3: Recommended Actions (Manual)

**⚠️ DO NOT AUTO-EXECUTE**: Risk of data loss. Manual review required.

1. **Audit unique files in hyphen directories**:

   ```bash
   # For each hyphen directory, check if files are duplicated in underscore version
   for file in docs/return-packages/*; do
     basename_file=$(basename "$file")
     if [ ! -f "docs/return_packages/$basename_file" ]; then
       echo "UNIQUE: $file"
     fi
   done
   ```

2. **Move root-level return_packages to docs**:

   ```bash
   # After verifying no conflicts:
   # mv /Users/brenthibbitts/Desktop/ScoutZero/return_packages /Users/brenthibbitts/Desktop/ScoutZero/docs/return_packages-root
   # Add README explaining it's from root level
   ```

3. **Standardize on underscore naming**:
   - Move unique files from hyphen dirs to underscore equivalents
   - Delete empty hyphen directories
   - Update INDEX.md to reflect new structure

4. **Add documentation**:
   - Create `/docs/return_packages/README.md` explaining:
     - Purpose of return packages
     - Naming conventions
     - Where to put new deliverables
     - Archive policy

---

## Naming Convention Decision

**Canonical naming**: `return_packages` (underscore)

**Rationale**:

- Matches project memory documentation
- More recent files use underscore
- Consistent with Python naming conventions (which project uses)
- Two primary deliverable directories already use underscore

**Going forward**:

- All new return packages → `return_packages` (underscore)
- No more `return-packages` (hyphen) directories

---

## Impact Assessment

### Low Risk

- Adding README documentation
- Renaming empty directories
- Creating archive folders

### Medium Risk

- Moving files between directories (potential reference breakage)
- Deleting hyphen directories (if unique files exist)

### High Risk

- Deleting root-level `/return_packages/` without audit
- Merging without checking for duplicate filenames
- Auto-execution without manual review

---

## Next Steps (Manual Only)

1. **Audit phase** (safe):

   ```bash
   # Create audit report of unique files
   mkdir -p docs/return_packages_audit

   # Document unique files in each hyphen directory
   # (Run commands from above and save output)
   ```

2. **Decision phase** (requires human judgment):
   - Review unique files
   - Decide on Option A, B, or C
   - Get stakeholder approval if needed

3. **Execution phase** (careful):
   - Create backups first
   - Execute moves/renames one directory at a time
   - Test that no references are broken
   - Update documentation

4. **Cleanup phase**:
   - Remove old directories
   - Update INDEX.md
   - Update .gitignore if needed
   - Add README to consolidated directory

---

## Files to Update After Consolidation

- [ ] `/docs/INDEX.md` - Update return packages section
- [ ] `/.gitignore` - Add archive directories if keeping them
- [ ] `/docs/return_packages/README.md` - Create new file explaining structure
- [ ] Project memory - Update deliverable directory locations

---

## Notes for Future

**To prevent this issue**:

1. Document canonical naming in CONTRIBUTING.md
2. Add linter rule to check for `return-packages` (hyphen) creation
3. Include in project schema validation
4. Add to new contributor onboarding

---

**Status**: INVESTIGATION REQUIRED - Do not execute consolidation without manual review

**Owner**: Project maintainer / Architect

**Last Updated**: February 12, 2026
