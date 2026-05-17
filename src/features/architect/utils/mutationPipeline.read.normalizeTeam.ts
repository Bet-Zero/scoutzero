/**
 * FILE: src/features/architect/utils/mutationPipeline.read.normalizeTeam.ts
 * PURPOSE: Team current-state construction — normalizes loaded Firestore team data
 *          into typed current-state objects for each mutation type.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 5 Step 2: Extracted from mutationPipeline.read.ts (L1046-2092).
 */

// Wave 19 Step 1: foundation functions, preserved fields, and boundary types extracted.
export * from './mutationPipeline.read.normalizeTeam.foundation';
// Wave 36 Step 1a: builder functions (buildCurrentState*) extracted to submodule.
export * from './mutationPipeline.read.normalizeTeam.builders';
// Wave 36 Step 1b: current-state snapshot and mutation normalizers extracted to submodule.
export * from './mutationPipeline.read.normalizeTeam.currentState';
