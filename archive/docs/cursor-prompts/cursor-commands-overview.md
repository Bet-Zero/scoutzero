# Slash Commands Overview

This document provides a comprehensive overview of all slash commands available in this project. The prompt files in this directory are agent-universal — any AI coding tool (Claude Code, Cursor, Copilot, Codex) can follow them.

---

## Command Categories

The commands fall into four main categories:

1. **Understanding & Analysis** - Commands that help you understand code without changing it
2. **Code Quality & Fixes** - Commands that identify and fix issues in the codebase
3. **Project Management** - Commands that help organize and structure work
4. **Artifact & Output Review** - Commands that analyze the relevance of files and outputs

---

## Understanding & Analysis Commands

### `/explain` - Code Explanation

**What it does:**

- Explains selected code in plain English without making any changes
- Builds a mental model of how the code works
- Provides structured explanation: complexity snapshot, overview, data flow, module breakdown, gotchas, system integration

**Problem it addresses:**

- Code is unclear or hard to understand
- Need to understand how a module works before making changes
- Onboarding to new codebase areas
- Explaining code to non-technical stakeholders

**When to use:**

- Before refactoring or modifying code
- When exploring unfamiliar parts of the codebase
- When you need to understand data flow or architecture
- When preparing documentation or explanations

**What it doesn't do:**

- ❌ Does NOT edit, refactor, or modify any code
- ❌ Does NOT fix bugs or issues (only notes them)
- ❌ Does NOT run audits or apply fixes
- ❌ Does NOT change logic, behavior, or structure

**Execution order:**

- Can be used independently at any time
- Often used as a first step before `/audit` or `/cleanup`
- Suggested as a precursor to other commands when understanding is needed

**Input:**

- Tag files, folders, or `#codebase` (e.g., `/explain @src/parsers/fanduel.ts`)

---

## Code Quality & Fixes Commands

### `/review` - Master Quality Review

**What it does:**

- Performs a broad, open-ended cleanup and quality audit of the scoped area
- Inspects through 10 review lenses: correctness, UX, state/data flow, architecture, cleanup, edge cases, performance, tests, docs, and anything else
- Produces a structured PREFLIGHT RETURN PACKAGE with evidence-backed findings
- Includes stop conditions that flag critical issues prominently

**Problem it addresses:**

- Need a comprehensive quality pass without specifying individual issues
- Want to surface everything wrong, risky, or worth improving in one pass
- Need structured, prioritized findings with evidence and recommended actions

**When to use:**

- When you want a broad quality sweep of a feature, component, or folder
- Before major refactoring or feature work
- Periodically for codebase health checks
- When you suspect accumulated issues but don't know specifics

**What it doesn't do:**

- Does NOT apply fixes (only identifies issues)
- Does NOT make any code changes (PREFLIGHT mode)
- Does NOT pad with generic best-practice fluff — findings must be evidence-backed

**Execution order:**

- Can be used independently at any time
- Findings can feed into `/audit-review` → `/fix-all` workflow or manual fixes

**Input:**

- Specify the feature, component, folder, or system to review (e.g., `/review Trade Machine`)

**Output:**

- PREFLIGHT RETURN PACKAGE with: Executive Summary, Overall Verdict, Findings Inventory, Top Priorities, Quick Wins, Needs Verification, What Looks Good, Coverage Summary, Recommended Execution Plan, Final Judgment

---

### `/audit` - Apex Audit

**What it does:**

- Performs a deep, technical audit of selected code
- Identifies logic errors, security issues, type-safety flaws, performance problems, architectural violations, and code smells
- Produces a comprehensive audit report with prioritized action items
- Saves audit results to `audits/` directory

**Problem it addresses:**

- Need comprehensive code quality review
- Suspect architectural issues or technical debt
- Want to identify correctness, safety, or design problems
- Need prioritized list of issues to address

**When to use:**

- Before major refactoring or feature work
- When code quality concerns arise
- Periodically for codebase health checks
- After significant changes to verify no regressions

**What it doesn't do:**

- ❌ Does NOT apply fixes (only identifies issues)
- ❌ Does NOT create a Fix Plan (that's `/audit-review`)
- ❌ Does NOT make any code changes

**Execution order:**

- **Step 1** in the audit → fix workflow
- Must be run before `/audit-review`
- Can be used independently for analysis

**Input:**

- Tag files, folders, or `#codebase` (e.g., `/audit @src/parsers/`)

**Output:**

- Audit markdown file in `audits/` directory
- Named based on scope: `audits/<filename>-audit.md`, `audits/<folder-name>-audit.md`, or `audits/codebase-audit.md`

---

### `/audit-review` - Fix Plan Builder

**What it does:**

- Reviews an existing Apex Audit (does NOT create a new audit)
- Validates each issue against current codebase
- Classifies issues with fix-safety flags: `SAFE_AUTO`, `NEEDS_CONTEXT`, `NEEDS_DECISION`
- Assigns review status: `CONFIRMED`, `ADJUSTED`, or `REJECTED`
- Creates a structured Fix Plan markdown file for execution

**Problem it addresses:**

- Audit findings need validation and prioritization
- Need to determine which fixes are safe to auto-apply
- Want a structured execution plan from audit results
- Need to identify issues requiring human decisions

**When to use:**

- **After** running `/audit` and getting an audit file
- When you want to prepare fixes for automated application
- Before running `/apply-critical` or `/fix-all`

**What it doesn't do:**

- ❌ Does NOT run a new audit (only reviews existing one)
- ❌ Does NOT apply fixes (only creates the plan)
- ❌ Does NOT change code (only creates Fix Plan document)

**Execution order:**

- **Step 2** in the audit → fix workflow
- **Required** after `/audit` and before `/apply-critical` or `/fix-all`
- Must be run before any fixes can be applied

**Input:**

- **Must** tag exactly one audit markdown file (e.g., `/audit-review @audits/codebase-audit.md`)

**Output:**

- Fix Plan markdown file: `audits/<audit-name>_fixplan.md`
- Contains structured, execution-ready fix instructions

**Important:** The name might be misleading - this does NOT review code directly, it reviews an audit file and creates a Fix Plan.

---

### `/apply-critical` - Critical Safe Fixes Only

**What it does:**

- Applies **only** Critical severity issues marked as `SAFE_AUTO` from a Fix Plan
- Makes minimal, safe code changes to fix critical problems
- Focuses on the highest-priority, safest fixes

**Problem it addresses:**

- Critical issues that are safe to fix automatically
- Need to address urgent problems without manual intervention
- Want to apply only the safest critical fixes first

**When to use:**

- **After** `/audit-review` has created a Fix Plan
- When you want to apply only critical fixes first
- Before running `/fix-all` to handle critical issues separately
- When you want a conservative, low-risk fix application

**What it doesn't do:**

- ❌ Does NOT apply High, Medium, or Low severity issues
- ❌ Does NOT apply Critical issues marked `NEEDS_CONTEXT` or `NEEDS_DECISION`
- ❌ Does NOT run a new audit or create a Fix Plan
- ❌ Does NOT apply all fixes (only critical safe ones)

**Execution order:**

- **Step 3a** (optional) in the audit → fix workflow
- Can be run after `/audit-review` instead of `/fix-all`
- Can be followed by `/fix-all` to handle remaining issues

**Input:**

- **Must** tag exactly one Fix Plan file (e.g., `/apply-critical @audits/codebase-audit_fixplan.md`)

**Important:** This is a conservative command - it only applies the safest critical fixes. For broader fixes, use `/fix-all`.

---

### `/fix-all` - Apply All Appropriate Fixes

**What it does:**

- Applies all `SAFE_AUTO` fixes from a Fix Plan (all severities)
- Cautiously applies `NEEDS_CONTEXT` fixes when instructions are clear
- Adds TODOs for `NEEDS_DECISION` items (does not change behavior)
- Makes comprehensive code changes following the Fix Plan

**Problem it addresses:**

- Need to apply multiple fixes from an audit systematically
- Want comprehensive code quality improvements
- Have a validated Fix Plan ready for execution

**When to use:**

- **After** `/audit-review` has created a Fix Plan
- When you want to apply all safe fixes at once
- Instead of `/apply-critical` if you want broader coverage
- After `/apply-critical` to handle remaining issues

**What it doesn't do:**

- ❌ Does NOT run a new audit or create a Fix Plan
- ❌ Does NOT change behavior for `NEEDS_DECISION` items
- ❌ Does NOT apply fixes marked `REJECTED`
- ❌ Does NOT make changes outside the Fix Plan scope

**Execution order:**

- **Step 3b** (alternative to `/apply-critical`) in the audit → fix workflow
- Can be run after `/audit-review` instead of `/apply-critical`
- Can be run after `/apply-critical` to handle remaining issues

**Input:**

- **Must** tag exactly one Fix Plan file (e.g., `/fix-all @audits/codebase-audit_fixplan.md`)

**Important:** This applies fixes more broadly than `/apply-critical`, including all severities (not just Critical).

---

### `/doc-sync` - Documentation Synchronization

**What it does:**

- Updates documentation and comments to match current code behavior
- Fixes mismatches between docs/comments and actual code
- Updates references to canonical implementations
- Keeps documentation honest and accurate

**Problem it addresses:**

- Documentation is outdated or misleading
- Comments describe old behavior that no longer exists
- Docs reference deprecated patterns or architectures
- Need to align documentation with code reality

**When to use:**

- After code changes that affect behavior
- When documentation is clearly out of sync
- After `/audit-review` + `/fix-all` have updated code
- Periodically to maintain documentation accuracy

**What it doesn't do:**

- ❌ Does NOT change core logic or behavior
- ❌ Does NOT perform refactors or rewrites
- ❌ Does NOT add new features or systems
- ❌ Does NOT change public APIs, schemas, or Firestore paths

**Execution order:**

- Often used **after** `/fix-all` to update docs for code changes
- Can be used independently when docs are out of sync
- Suggested as a final step after code quality improvements

**Input:**

- Tag files, folders, or `#codebase` (e.g., `/doc-sync @parsing/ @docs/`)

**Important:** This is a **description** pass, not a **design** pass. It only updates words (docs/comments), not code behavior.

---

### `/cleanup` - Safe Code Cleanup

**What it does:**

- Performs safe, behavior-preserving cleanup
- Removes dead code (unused locals, imports, commented blocks)
- Normalizes style and patterns (naming, organization)
- Improves readability (comments, structure)
- Makes only risk-free edits

**Problem it addresses:**

- Code has accumulated cruft and noise
- Inconsistent patterns or style
- Unused code cluttering files
- Readability issues that don't require logic changes

**When to use:**

- When code needs hygiene improvements
- Before or after refactoring
- When you want safe improvements without behavior changes
- Periodically for code maintenance

**What it doesn't do:**

- ❌ Does NOT change business logic or calculations
- ❌ Does NOT modify schemas, database paths, or Firestore structures
- ❌ Does NOT change or rename public APIs/exported signatures
- ❌ Does NOT introduce new patterns, frameworks, or libraries
- ❌ Does NOT perform large refactors

**Execution order:**

- Can be used independently at any time
- Often used after `/fix-all` for final polish
- Can be used before `/audit` to clean up before analysis

**Input:**

- Tag files, folders, or `#codebase` (e.g., `/cleanup @src/parsers/`)

**Important:** This is **strictly behavior-preserving**. If there's any doubt about safety, it won't make the change.

---

## Project Management Commands

### `/group-by-feature` - Feature-Based Refactoring

**What it does:**

- Refactors codebase into shared/core/feature structure
- Moves hooks and utils into their feature folders
- Splits out shared/core code from feature-specific code
- Updates imports across the codebase
- Executes in 4 chunks (Shared Components, Shared Hooks/Utils, Feature Hooks, Feature Utils)

**Problem it addresses:**

- Codebase needs better organization by feature
- Hooks and utils are in global buckets instead of feature folders
- Need to separate shared code from feature-specific code
- Want clearer feature boundaries and ownership

**When to use:**

- When codebase structure needs reorganization
- Before starting major feature work
- When feature boundaries are unclear
- When you want better code organization

**What it doesn't do:**

- ❌ Does NOT change runtime behavior (behavior-preserving refactor only)
- ❌ Does NOT modify logic or functionality
- ❌ Does NOT execute all chunks at once (user must specify which chunk)

**Execution order:**

- Used independently for structural refactoring
- Executes in 4 sequential chunks:
  1. Shared Components & Core Layout
  2. Shared Hooks & Shared Utils
  3. Feature-Specific Hooks
  4. Feature-Specific Utils

**Input:**

- User must specify which chunk to execute (e.g., "Execute Chunk 1: Shared Components & Core Layout")

**Important:** This is a **behavior-preserving refactor only**. It reorganizes files and updates imports, but does not change functionality.

---

## Recommended Workflows

### Code Quality Improvement Workflow

**Ideal order:**

1. `/explain` - Understand the code (optional but recommended)
2. `/audit` - Identify issues
3. `/audit-review` - Create Fix Plan
4. `/apply-critical` - Apply critical safe fixes (optional, conservative approach)
5. `/fix-all` - Apply all appropriate fixes (or use instead of step 4)
6. `/doc-sync` - Update documentation to match changes
7. `/cleanup` - Final polish (optional)

**Alternative (faster):**

1. `/audit` - Identify issues
2. `/audit-review` - Create Fix Plan
3. `/fix-all` - Apply all fixes at once
4. `/doc-sync` - Update documentation

### Understanding New Code Workflow

**Ideal order:**

1. `/explain` - Get comprehensive explanation
2. `/audit` - Check for issues (optional)
3. `/cleanup` - Safe improvements (optional)

### Major Feature Development Workflow

**Ideal order:**

1. Use your agent's native plan mode for complex tasks
2. Execute plan (may use other commands as needed)
3. `/doc-sync` - Update documentation
4. `/cleanup` - Final polish

### Structural Refactoring Workflow

**Ideal order:**

1. `/group-by-feature` Chunk 1 - Shared Components & Core Layout
2. `/group-by-feature` Chunk 2 - Shared Hooks & Shared Utils
3. `/group-by-feature` Chunk 3 - Feature-Specific Hooks
4. `/group-by-feature` Chunk 4 - Feature-Specific Utils
5. `/doc-sync` - Update documentation
6. `/cleanup` - Final polish

---

## Command Dependencies

**Required order (must follow):**

- `/audit` → `/audit-review` → `/apply-critical` or `/fix-all`
  - Cannot run `/audit-review` without an audit file
  - Cannot run `/apply-critical` or `/fix-all` without a Fix Plan

**Optional but recommended:**

- `/explain` before `/audit` or `/cleanup` (for understanding)
- `/doc-sync` after `/fix-all` (to update docs)
- `/cleanup` after `/fix-all` (for final polish)

**Independent (can use anytime):**

- `/review` - Standalone broad quality audit
- `/explain` - Standalone understanding
- `/cleanup` - Standalone cleanup
- `/group-by-feature` - Standalone refactoring (with chunk specification)
- `/relevance` - Standalone artifact & output review

---

## Common Misconceptions

### `/audit-review` doesn't review code

- It reviews an **audit file**, not code directly
- It creates a Fix Plan from audit findings
- Must have an audit file from `/audit` first

### `/apply-critical` vs `/fix-all`

- `/apply-critical`: Only Critical + SAFE_AUTO (conservative)
- `/fix-all`: All severities + SAFE_AUTO, plus cautious NEEDS_CONTEXT (comprehensive)
- Both require a Fix Plan from `/audit-review`

### `/doc-sync` doesn't change behavior

- Only updates documentation and comments
- Does NOT modify code logic or functionality
- It's a "description" pass, not a "design" pass

### `/cleanup` is very conservative

- Only makes risk-free, behavior-preserving changes
- Won't change logic, APIs, schemas, or public interfaces
- If there's any doubt about safety, it won't make the change

### `/group-by-feature` requires chunk specification

- User must specify which chunk to execute
- Does NOT run all chunks automatically
- Each chunk is a separate command invocation

---

## Quick Reference

| Command             | Category                 | Changes Code?      | Input Type             | Output                            |
| ------------------- | ------------------------ | ------------------ | ---------------------- | --------------------------------- |
| `/review`           | Quality                  | ❌ No              | Feature/component/folder | Preflight Return Package          |
| `/explain`          | Understanding            | ❌ No              | Files/folders/codebase | Explanation                       |
| `/audit`            | Quality                  | ❌ No              | Files/folders/codebase | Audit file                        |
| `/audit-review`     | Quality                  | ❌ No              | Audit file             | Fix Plan                          |
| `/apply-critical`   | Quality                  | ✅ Yes             | Fix Plan               | Code changes                      |
| `/fix-all`          | Quality                  | ✅ Yes             | Fix Plan               | Code changes                      |
| `/doc-sync`         | Quality                  | ✅ Yes (docs only) | Files/folders/codebase | Doc updates                       |
| `/cleanup`          | Quality                  | ✅ Yes             | Files/folders/codebase | Code cleanup                      |
| `/group-by-feature` | Management               | ✅ Yes             | Chunk spec             | Refactored structure              |
| `/relevance`        | Artifact & Output Review | ❌ No              | Files/folders/codebase | Relevance report + cleanup script |

---

## Getting Help

For detailed instructions on any command, see:

- Command files: `.cursor/commands/<command>.md`
- Detailed prompts: `docs/cursor-prompts/<PromptName>.md`

For project-wide agent instructions:

- `AGENTS.md` (main agent instructions)
