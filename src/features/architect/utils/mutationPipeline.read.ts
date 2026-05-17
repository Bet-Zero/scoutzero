/**
 * FILE: src/features/architect/utils/mutationPipeline.read.ts
 * PURPOSE: READ-phase helpers for the mutation pipeline — extracted from mutationPipeline.ts (Wave 4 Step 4c).
 * Contains all state-loading, context-building, and read-side helper functions.
 * Shared cross-phase utilities live in mutationPipeline.helpers.ts.
 * OWNERSHIP: Feature: architect/core
 */

// Wave 5 Step 1: data-level normalizers extracted to submodule
export * from './mutationPipeline.read.normalizeData';
// Wave 5 Step 2: team current-state construction extracted to submodule
export * from './mutationPipeline.read.normalizeTeam';
// Wave 5 Step 3: persistence/dashboard/audit helpers extracted to submodule
export * from './mutationPipeline.read.persistence';
// Wave 5 Step 4: state-loading entry point extracted to submodule
export * from './mutationPipeline.read.stateLoader';
// Wave 35: read-phase utility functions extracted to submodule
export * from './mutationPipeline.read.utils';
