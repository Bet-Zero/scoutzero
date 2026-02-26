# Refactoring Plan 6: Enable Strict TypeScript Incrementally

## Instructions for Cursor

Follow these instructions to incrementally enable strict TypeScript checking. This should be done AFTER Plans 1-5 are complete, so the newly-created `.ts` files benefit from strict checking from the start.

**Rules:**

- All new files must be `.ts` / `.tsx`
- Use `@/` import aliases (maps to `src/`)
- Do not add `// @ts-ignore` — use `// @ts-expect-error` with a descriptive comment if suppression is needed
- After completing, run the validation commands listed at the end

---

## What We're Changing

**File:** `tsconfig.json`

**Why:** Currently `strict: false` — this means implicit `any` types are allowed everywhere, null checks are not enforced, and TypeScript catches far fewer bugs than it should. Enabling strict mode incrementally improves type safety without requiring a massive one-shot migration.

## Step-by-Step

**Step 1: Enable strict flags incrementally**

- In `tsconfig.json`, add these two flags to `compilerOptions` (do NOT set `strict: true` yet):

  ```json
  "strictNullChecks": true,
  "noImplicitAny": true
  ```

**Step 2: Run typecheck and assess the damage**

- Run `npm run typecheck`
- Count the number of errors. If it's under ~100, fix them all. If it's hundreds, proceed to Step 3 for a phased approach.

**Step 3: Fix errors in priority order**

- **First priority:** Fix all errors in files created by Plans 1-5 (the newly-created `.ts` files in `actions/`, `capValidation/`, `mutationPipeline/`, `tradeMachine/`, etc.). These should be clean since they were just written.
- **Second priority:** Fix errors in `src/schemas/` files — these are the type source of truth
- **Third priority:** Fix errors in `src/features/architect/hooks/` — these are heavily used
- **Last priority:** Legacy `.js` files that are checked by TypeScript

**Step 4: For stubborn files, use targeted suppression**

- If a file has too many errors to fix quickly, add `// @ts-expect-error -- TODO: fix strict type` on specific lines
- Do NOT suppress entire files — fix what you can, suppress only individual lines
- Every suppression must have a descriptive comment explaining what needs fixing

**Step 5: Consider excluding legacy JS from strict checking**

- If the JS files produce too much noise, you can add them to `tsconfig.json`'s `exclude` array temporarily
- Or create a separate `tsconfig.strict.json` that extends the base but only includes `.ts`/`.tsx` files

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run build
```

Both must pass with zero errors (suppressions via `@ts-expect-error` are acceptable).
