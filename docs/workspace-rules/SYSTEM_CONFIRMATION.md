# System Confirmation - Design for Cleanup

## My Understanding of the System

### The Goal
Create a self-organizing, self-cleansing workflow where:
1. **You facilitate** - Give direction, answer questions, review outputs
2. **I execute** - Use plan mode to create plans, execute chunks, make decisions
3. **Files organize themselves** - Permanent files go to permanent locations, temporary files go to workspace
4. **Cleanup is automatic** - When done, temporary files are deleted, only permanent files remain

### The Workflow

**1. You Start a Plan**
- "I want to build feature X"
- I create `plans/<plan-slug>/plan.md` using template

**2. I Break It Into Chunks**
- Each chunk is actionable and testable
- Each chunk has clear inputs/outputs
- Each chunk knows what files it will create

**3. I Execute Chunks**
- **Before creating ANY file, I ask**: "Is this permanent or temporary?"
- **Permanent files** → Save directly to `src/`, `data/`, `docs/`, `tools/`, `tests/`
- **Temporary files** → Save to `cursor_work/<slug>/temp/`
  - Test scripts → `temp/scripts/`
  - One-time use scripts → `temp/scripts/`
  - Interim docs → `temp/docs/`
  - Test outputs → `temp/output/`
  - Experiments → `drafts/`

**4. You Facilitate**
- Answer questions if I'm stuck
- Review outputs
- Give direction when needed
- Mostly hands-off - I follow the plan

**5. Chunk Completes**
- I verify all permanent files are in permanent locations
- I delete `temp/` directory (all temporary files)
- I delete `drafts/` directory (experiments moved or discarded)
- I keep only `notes/` for audit trail
- Result: Only permanent files remain

**6. Plan Completes**
- All chunks done
- All temporary files cleaned up
- Only permanent files remain in repo
- Clean, organized, done

## File Decision Process

**Every time I create a file, I follow this:**

```
Is this file meant to be permanent?
├─ YES → Is it production-ready?
│   ├─ YES → Save to src/, data/, docs/, tools/, or tests/
│   └─ NO → Save to workspace drafts/ (will move or delete)
└─ NO → Save to workspace temp/ (will be deleted)
```

**Examples:**
- ✅ New React component → `src/features/myFeature/Component.jsx` (permanent)
- ✅ Test script to verify data → `cursor_work/my-chunk/temp/scripts/test_data.js` (temporary)
- ✅ "How I updated schema" doc → `cursor_work/my-chunk/temp/docs/schema_update.md` (temporary)
- ✅ Final documentation → `docs/features/myFeature.md` (permanent)

## What's In Place

### ✅ Templates
- `plans/_templates/plan.template.md` - Plan structure
- `plans/_templates/chunk.template.md` - Chunk structure with file placement guidance
- `cursor_work/_templates/workspace_readme.template.md` - Workspace rules with cleanup guidance
- `docs/templates/file_header.template.txt` - File header for permanent files

### ✅ Documentation
- `docs/workspace-rules/plan.md` - Main plan document
- `docs/workspace-rules/WORKFLOW_CHECKLIST.md` - Step-by-step workflow
- `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` - Decision tree and examples
- `docs/workspace-rules/README.md` - Directory overview

### ✅ Design Principles
- **Design for cleanup** - Files go to correct location from the start
- **Decision point** - Before creating any file, decide permanent vs temporary
- **Automatic cleanup** - Temporary files in `temp/` are deleted when chunk completes
- **Only permanent files survive** - Everything else is cleaned up

## System Status: ✅ READY

The system is in place and ready to use. When you start a new plan:
1. I'll create the plan using the template
2. I'll break it into chunks
3. I'll execute chunks, making file placement decisions
4. I'll clean up temporary files when chunks complete
5. You facilitate and review - minimal intervention needed

The system is **self-organizing** (files go to right place from start) and **self-cleansing** (temporary files automatically removed).

