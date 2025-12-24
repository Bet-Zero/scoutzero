# When to Use Plan Mode

## Quick Answer

**Plan mode is for large, multi-step initiatives.** For small tasks, just ask directly - no plan needed.

## Use Plan Mode When

✅ **Large features** - Building a new feature that will take multiple steps
✅ **Refactors** - Significant refactoring that affects multiple files/systems
✅ **Migrations** - Data migrations, schema changes, or structural updates
✅ **Complex tasks** - Tasks that need careful planning and tracking
✅ **Multi-chunk work** - Work that naturally breaks into multiple chunks

**Examples:**

- "Build a new trade machine feature"
- "Migrate all player data to new schema"
- "Refactor the entire roster system"
- "Add authentication system"

## Skip Plan Mode For

❌ **Bug fixes** - Fixing a typo, correcting logic, fixing CSS
❌ **Small tweaks** - Minor UI adjustments, text changes
❌ **Single-file changes** - Changes that only touch one file
❌ **Quick tasks** - Tasks that can be completed in one go
❌ **Configuration** - Updating configs, dependencies (unless it affects structure)

**Examples:**

- "Fix the typo in PlayerCard.jsx"
- "Change the button color to blue"
- "Update the README with new instructions"
- "Fix the bug where headshots don't load"

## How It Works

### For Small Tasks (No Plan Mode)

Just ask directly:

- "Fix the typo in line 42 of PlayerCard.jsx"
- "Change the button color to blue"
- "Update the README"

I'll:

1. Make the change
2. Update documentation if it's a significant change (see `DOCUMENTATION_UPDATE_RULES.md`)
3. Done - no plan structure needed

### For Large Tasks (Use Plan Mode)

Say: "I want to build [feature]. Use plan mode."

I'll:

1. Create `plans/<plan-slug>/plan.md`
2. Break it into chunks
3. Execute chunks one by one
4. Track progress in plan files

## Documentation Still Applies

**Even for small tasks**, documentation update rules still apply:

- **Significant changes** → Update documentation
- **Minor changes** → Skip documentation

This is independent of whether you used plan mode or not.

## Examples

### Example 1: Small Task (No Plan Mode)

**You:** "Fix the typo in PlayerCard.jsx line 42"

**Me:**

- Fixes typo
- Checks if documentation needed (no - it's a typo fix)
- Done

**No plan files created.**

### Example 2: Large Task (Plan Mode)

**You:** "I want to build a new trade machine feature. Use plan mode."

**Me:**

- Creates `plans/trade-machine/plan.md`
- Breaks into chunks (chunk_01: Setup, chunk_02: Core logic, etc.)
- Executes chunks with full tracking
- Updates documentation as needed

**Full plan structure created.**

### Example 3: Medium Task (Your Choice)

**You:** "Add a filter to the player list"

**Options:**

- **Small approach:** "Add a filter to the player list" → I do it directly, no plan
- **Plan approach:** "Add a filter to the player list. Use plan mode." → I create a plan

**Either works - your choice based on complexity.**

## Summary

- **Small tasks** → Just ask, no plan mode needed
- **Large tasks** → Use plan mode for tracking and organization
- **Documentation** → Still applies based on significance, not plan mode usage
- **Your choice** → You decide when to use plan mode

**The plan/chunk/workspace system is a tool for organization, not a requirement for every task.**
