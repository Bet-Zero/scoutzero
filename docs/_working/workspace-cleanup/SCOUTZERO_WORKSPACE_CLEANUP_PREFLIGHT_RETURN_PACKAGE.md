# ScoutZero Workspace Cleanup Preflight Return Package

## Files Created / Changed

- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT.md`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT_RETURN_PACKAGE.md`

Fallback used:

- The requested output path `return_packages/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT_RETURN_PACKAGE.md` is ignored by the current `.gitignore`.
- This return package was therefore written to `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT_RETURN_PACKAGE.md` instead.

## Commands Run

Repository reading and inventory also used editor file-read, file-search, and directory-listing tools for the required docs and folders.

### Inventory Commands

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && for dir in docs docs/_working docs/architect docs/audits docs/return_packages docs/return-packages docs/team-scrape docs/tradeMachine docs/typescript docs/workspace-rules docs/project docs/features docs/runbooks docs/guides; do if [[ -d "$dir" ]]; then total=$(find "$dir" -type f | wc -l | tr -d ' '); md=$(find "$dir" -type f -name '*.md' | wc -l | tr -d ' '); echo "DIR|$dir|files=$total|md=$md"; else echo "DIR|$dir|missing"; fi; done
```

Result:

- Confirmed `docs/audits/`, `docs/return_packages/`, and `docs/return-packages/` are missing.
- Confirmed direct doc-surface counts, including `docs/` with 334 files and `docs/_working/` with 89 markdown files.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && for dir in return_packages docs/return_packages docs/return-packages docs/architect/return_packages docs/tradeMachine/return_packages docs/tradeMachine/return-packages docs/team-scrape/return_packages docs/team-scrape/return-packages; do if [[ -d "$dir" ]]; then total=$(find "$dir" -type f | wc -l | tr -d ' '); md=$(find "$dir" -type f -name '*.md' | wc -l | tr -d ' '); tracked=$(git ls-files "$dir" | wc -l | tr -d ' '); ignored=no; if git check-ignore -q "$dir"; then ignored=yes; fi; readme=no; if [[ -f "$dir/README.md" ]]; then readme=yes; fi; echo "RP|$dir|files=$total|md=$md|tracked=$tracked|ignored=$ignored|readme=$readme"; else echo "RP|$dir|missing"; fi; done
```

Result:

- Confirmed root `return_packages/` exists with visible files and tracked content.
- Confirmed all requested `docs/.../return_packages` and `docs/.../return-packages` locations are currently missing.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && for dir in docs/*/; do name=${dir%/}; files=$(find "$name" -type f | wc -l | tr -d ' '); md=$(find "$name" -type f -name '*.md' | wc -l | tr -d ' '); echo "DOC1|$name|files=$files|md=$md"; done | sort
```

Result:

- Produced first-level counts for every docs subfolder.
- Highlighted the largest doc surfaces: `docs/architect/`, `docs/team-scrape/`, and `docs/_working/`.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && for dir in docs/_working/architect/*; do if [[ -d "$dir" ]]; then files=$(find "$dir" -type f | wc -l | tr -d ' '); md=$(find "$dir" -type f -name '*.md' | wc -l | tr -d ' '); echo "DOC2|$dir|files=$files|md=$md"; fi; done | sort
```

Result:

- Produced per-cluster counts for architect working-doc folders.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && for dir in docs/_working/architect/*; do if [[ -d "$dir" ]]; then latest=$(find "$dir" -type f -exec stat -f '%m %N' {} \; | sort -nr | head -n 1 | cut -d' ' -f2-); echo "WKLATEST|$dir|$latest"; fi; done | sort
```

Result:

- Showed that most architect working clusters now end in `REVIEW_RECORD` or `CLOSEOUT_REVIEW_RECORD` documents.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && find . -type f \( -name '*RETURN_PACKAGE*.md' -o -name 'RETURN_PACKAGE*.md' -o -path './return_packages/*.md' -o -path './return_packages/*/*.md' -o -path './docs/return_packages/*.md' -o -path './docs/return_packages/*/*.md' -o -path './docs/return-packages/*.md' -o -path './docs/return-packages/*/*.md' \) | sed 's#^./##' | awk -F/ '{path="."; for (i=1; i<NF; i++) path=(path=="."?$i:path"/"$i); counts[path]++} END {for (dir in counts) print counts[dir] "|" dir}' | sort -t'|' -k2,2
```

Result:

- Confirmed actual return-package-like files live in `return_packages/typescript/`, `return_packages/docs/`, `docs/team-scrape/`, and `docs/architect/`.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && git check-ignore --no-index return_packages/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT_RETURN_PACKAGE.md && echo IGNORED
```

Result:

- Confirmed the requested root `return_packages/workspace-cleanup/...` output path is ignored, so the fallback location was required.

### Validation Commands

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && git status --short
```

Result:

- `?? docs/_working/workspace-cleanup/`

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && npm run lint:md
```

Result:

- First run failed with `MD047` on both new markdown files because they did not end with a single trailing newline.
- After adding the missing trailing newlines, the same command passed cleanly.

## Commands Skipped

- `npm run build` skipped because this was a docs-only preflight and the prompt explicitly disallowed build validation.
- `npm run typecheck` skipped because there were no source-code changes and the prompt explicitly disallowed typecheck for this preflight.
- Test suites skipped because the prompt explicitly disallowed build/typecheck/tests and requested discovery only.
- No archive, delete, move, rename, or cleanup commands were run because this was a preflight inventory only.

## Key Findings

- The repo has no single clean return-package standard today.
- Root `return_packages/` is the actual evidence archive in practice, but new files there are ignored by policy.
- `docs/INDEX.md` points to several missing return-package and audit paths.
- `docs/team-scrape/` and `docs/architect/` both mix evergreen docs with retained execution evidence.
- `docs/_working/architect/` still contains many completed-looking review records.
- `.claudeignore` and `PROJECT_SCHEMA.md` disagree about whether `plans/` is active.

## Recommended Next Prompt

- Execution Phase 1: Documentation standard + cleanup master doc

## Validation

- `git status --short`
  Result: `?? docs/_working/workspace-cleanup/`
- `npm run lint:md`
  Result: Passed after fixing the trailing-newline issues in the two new files.
