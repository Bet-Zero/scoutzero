# File Placement Guide - Design for Cleanup

## The Golden Rule

### Before creating any file, ask: "Is this permanent or temporary?"

- **Permanent** → Save directly to permanent location (`src/`, `data/`, `docs/`, `tools/`, `tests/`)
- **Temporary** → Save to workspace `temp/` (will be automatically deleted)

## Decision Tree

```text
Is this file meant to be permanent?
├─ YES → Is it production-ready?
│   ├─ YES → Save to permanent location (src/, data/, docs/, tools/, tests/)
│   └─ NO → Save to workspace drafts/ (will be moved or deleted)
└─ NO → Save to workspace temp/ (will be deleted)
```

## Permanent Locations (Final Files Only)

### `src/`

- ✅ Final React components
- ✅ Final hooks, utilities
- ✅ Final constants, configs
- ❌ Test scripts
- ❌ One-time use scripts
- ❌ Experiments

### `data/`

- ✅ Final data files
- ✅ Final configuration files
- ❌ Test data
- ❌ Generated test outputs

### `docs/`

- ✅ Final documentation
- ✅ User guides
- ✅ API documentation
- ❌ Interim notes about process
- ❌ "How I updated X" docs

### `tools/` or `scripts/`

- ✅ Final, reusable scripts
- ✅ Production utilities
- ❌ Test scripts
- ❌ One-time use scripts
- ❌ Debugging scripts

### `tests/`

- ✅ Final test files
- ✅ Test utilities
- ❌ Test outputs/results
- ❌ Test logs

## Workspace Locations (Temporary - Will Be Deleted)

### `cursor_work/<slug>/temp/scripts/`

- Test scripts
- One-time use scripts
- Debugging scripts
- Scripts for data processing that won't be reused

### `cursor_work/<slug>/temp/docs/`

- Interim documentation
- "How I updated X" notes
- Process notes
- Anything that's only needed during chunk execution

### `cursor_work/<slug>/temp/output/`

- Test results
- Generated test data
- Logs
- Any output from test scripts

### `cursor_work/<slug>/drafts/`

- Code experiments
- Prototypes
- "What if I try this?" code
- Will be moved to permanent location or deleted

### `cursor_work/<slug>/notes/`

- Scratch notes
- May be kept for audit trail
- Minimal notes only

## Examples

### ✅ Good: Permanent File

**Scenario**: Creating a new React component for the feature
**Decision**: Permanent - this is production code
**Location**: `src/features/myFeature/MyComponent.jsx`
**Result**: File survives chunk completion

### ✅ Good: Temporary File

**Scenario**: Script to test data transformation
**Decision**: Temporary - only needed during development
**Location**: `cursor_work/my-chunk/temp/scripts/test_transform.js`
**Result**: File deleted when chunk completes

### ✅ Good: Temporary File (Another Example)

**Decision**: Temporary - only needed while working on chunk
**Location**: `cursor_work/my-chunk/temp/docs/how_i_updated_schema.md`
**Result**: File deleted when chunk completes

### ❌ Bad: Permanent Location for Temporary File

**Scenario**: Test script saved to `scripts/test_something.js`
**Problem**: This is temporary but in permanent location
**Fix**: Move to `cursor_work/<slug>/temp/scripts/test_something.js`

### ❌ Bad: Workspace for Permanent File

**Scenario**: Final component saved to `cursor_work/<slug>/drafts/Component.jsx`
**Problem**: This is permanent but in temporary location
**Fix**: Move to `src/features/myFeature/Component.jsx` before chunk completion

## Cleanup Rules

When chunk is marked `completed`:

1. **Verify**: All permanent files are in permanent locations (not in workspace)
2. **Delete**: `temp/` directory entirely
3. **Delete**: `drafts/` directory (move anything needed to permanent first)
4. **Keep**: `notes/` directory (minimal audit trail)
5. **Result**: Workspace only contains `notes/` and `README.md`

## When in Doubt

**If you're not sure if a file should be permanent:**

1. Put it in workspace `temp/` first
2. You can always move it to permanent location later
3. But temporary files will be automatically cleaned up

**Better to be safe**: Put temporary files in `temp/` rather than polluting permanent locations.
