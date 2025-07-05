# AGENTS.md – HoopZero AI Instructions

## Project Overview

HoopZero is a public-facing NBA scouting platform. It displays player bios, stats, roles, contracts, and grades using a clean layout. All player data is loaded from Firebase Firestore using a flattened player structure (no nested documents).

This is the read-only counterpart to ScoutZero, an internal grading tool used to assign player attributes and evaluations. You should never write to Firestore or attempt to save data — only read.

## Coding Conventions

- Framework: React + Vite + Firebase
- Backend: Firestore (flattened player documents in 'players' collection)
- Style: Tailwind CSS with utility classes
- Imports: Use alias paths (e.g., @/components/...)
- File Format: Named exports preferred; default exports only for top-level views

## File Structure

Project is organized by feature-first structure with scoped utility and component folders:

src/
  components/
    layout/
    shared/
      ui/
        drawers/
        filters/
        grades/
  features/
    table/
    profile/
    roster/
    lists/
    filters/
    tierMaker/
  hooks/
  utils/
    filtering/
    formatting/
    roles/
    roster/
  constants/
  firebase/
  pages/
  styles/

All new code should be grouped by feature when possible. Reusable UI or logic goes in `shared/`, `hooks/`, or `utils/`.

## Task Rules for Agents

- ✅ Refactors should preserve visual layout and logic
- ✅ Break large components (>200 lines) into clean, shallow subcomponents
- ✅ Keep logic and layout separated where appropriate
- ✅ Use smart, readable file naming (TraitGradesBlock.jsx, AddPlayerDrawer.jsx, etc.)
- ✅ Preserve modals, filters, blurbs, and Firestore reads
- ✅ Leave the worktree clean (git status should show no changes)
- ❌ Never create new branches
- ❌ Never amend or squash existing commits

## Firebase Rules

- All data is read from Firestore.
- The Firestore collection is 'players' and each document is a flattened player object.
- Do not modify Firestore read logic without validating schema against usePlayerData.js and Firebase helpers.

## PR Guidelines

- Start PR titles with a clear, concise summary (e.g., `refactor: split PlayerProfileView`)
- Include a bullet summary of the changes
- Cite file paths using `【F:path†L#】` format
- Skip descriptions for unchanged UI unless relevant to the task

## Other Notes

- DEVELOPER_GUIDE.md contains detailed file structure, key files, and component logic
- README.md contains instructions for running and setting up the project
- Use /features/profile/ and /features/lists/ as structural examples if needed
