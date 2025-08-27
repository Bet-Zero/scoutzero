/** Dependency rules for src/utils/architect/tradeMachine
 *  Run with: npx depcruise src --config scripts/depcruise.architect.cjs -T text
 */
module.exports = {
  forbidden: [
    // 1) No circular deps anywhere in the subtree
    {
      name: 'no-circular',
      severity: 'error',
      from: { path: '^src/utils/architect/tradeMachine' },
      to: { circular: true },
    },

    // 2) Rules must not reach up into engine or cache
    {
      name: 'no-rules-to-engine-or-cache',
      severity: 'error',
      from: { path: '^src/utils/architect/tradeMachine/rules' },
      to: { path: '^src/utils/architect/tradeMachine/(engine|cache)' },
    },

    // 3) Utils are leaf-ish: no importing rules/engine/cache
    {
      name: 'no-utils-upwards',
      severity: 'error',
      from: { path: '^src/utils/architect/tradeMachine/utils' },
      to: { path: '^src/utils/architect/tradeMachine/(rules|engine|cache)' },
    },

    // 4) Only the engine is allowed to import cache
    {
      name: 'cache-only-from-engine',
      severity: 'error',
      from: {
        path: '^src/utils/architect/tradeMachine/(rules|utils|constants|validators)',
      },
      to: { path: '^src/utils/architect/tradeMachine/cache' },
    },

    // 5) Internal code should NOT import the compatibility folder.
    //    (Engine is allowed to import services there only until the reorg moves them.)
    {
      name: 'no-internal-use-of-validators',
      severity: 'error',
      from: {
        path: '^src/utils/architect/tradeMachine/(rules|utils|constants)',
      },
      to: { path: '^src/utils/architect/tradeMachine/validators' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
