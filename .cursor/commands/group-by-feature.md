---
name: group-by-feature
description: Refactor ScoutZero into shared/core/feature structure using docs/GroupByFeatureRefactor.md
---

You are running the /group-by-feature command in Cursor.

The project already has src/features/\* with feature components.
Your job is to move hooks and utils into their feature folders,
and split out shared/core code as described in:

docs/GroupByFeatureRefactor.md

Follow these rules:

1. Load and follow the full instructions in docs/GroupByFeatureRefactor.md.
2. Wait for the user to specify which chunk to execute, for example:
   - "Execute Chunk 1: Shared Components & Core Layout."
   - "Execute Chunk 2: Shared Hooks & Shared Utils."
   - "Execute Chunk 3: Feature Hooks."
   - "Execute Chunk 4: Feature Utils."
3. Only execute the requested chunk. Do NOT run multiple chunks in a single invocation.
4. Apply the chunk to the relevant parts of the codebase (not just a single file),
   unless the user explicitly restricts the TARGET_SCOPE.
5. After making changes, summarize:
   - Files moved
   - Imports updated
   - Any TODOs or ambiguities you left untouched
6. Do not modify runtime behavior. This is a behavior-preserving refactor only.
7. If ownership of a file is ambiguous (shared vs feature), leave it in place
   and mention it in your summary instead of guessing.
