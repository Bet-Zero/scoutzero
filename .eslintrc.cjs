module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',

  env: {
    browser: true,
    node: true,
    es2021: true,
  },

  settings: {
    react: {
      version: 'detect',
    },
  },

  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],

  rules: {
    // Modern React (new JSX transform) does NOT require "import React" in files using JSX
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',

    // You’re TS-first. PropTypes are redundant + create tons of noise.
    'react/prop-types': 'off',
  },

  overrides: [
    {
      files: ['**/*.{ts,tsx,d.ts}'],
      excludedFiles: ['src/schemas/**', 'src/types/**', 'player-scrape/**'],
      rules: {
        // Forbid declaring interfaces that start with Player or Contract outside canonical schemas
        'no-restricted-syntax': [
          'error',
          {
            selector: 'TSInterfaceDeclaration[id.name=/^(Player|Contract)/]',
            message:
              'Do not declare Player*/Contract* interfaces outside src/schemas. Import from src/schemas/players_v2 instead.',
          },
        ],
      },
    },

    // ============================================================
    // Architect layering rule: do NOT import playerRulesProfile directly
    // - UI/hooks/etc must use salaryEngine
    // - Blocks alias imports AND relative imports
    // ============================================================
    {
      files: ['src/features/architect/**/*.{js,jsx,ts,tsx}'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  // Alias imports
                  '@/features/architect/utils/playerRulesProfile',
                  '@/features/architect/utils/playerRulesProfile/*',
                  '@/features/architect/utils/playerRulesProfile/**',

                  // Relative imports (block "sneaking in")
                  './playerRulesProfile',
                  './playerRulesProfile/*',
                  './playerRulesProfile/**',
                  '../playerRulesProfile',
                  '../playerRulesProfile/*',
                  '../playerRulesProfile/**',

                  // Catch-all patterns
                  '**/playerRulesProfile',
                  '**/playerRulesProfile/*',
                  '**/playerRulesProfile/**',
                ],
                message:
                  'Don’t import from playerRulesProfile directly. Use salaryEngine instead: @/features/architect/utils/salaryEngine',
              },
            ],
          },
        ],
      },
    },

    // Allow salaryEngine + playerRulesProfile itself to access internals
    {
      files: [
        'src/features/architect/utils/playerRulesProfile/**/*.{js,ts}',
        'src/features/architect/utils/salaryEngine/**/*.{ts,tsx}',
      ],
      rules: {
        '@typescript-eslint/no-restricted-imports': 'off',
      },
    },

    // ============================================================
    // Phase 43: Prevent apron logic drift by blocking direct imports
    // from tradeMachine/utils/capUtils.js outside tradeMachine folder.
    // Use @/features/architect/utils/capUtils instead.
    // ============================================================
    {
      files: ['src/features/architect/**/*.{js,jsx,ts,tsx}'],
      excludedFiles: [
        'src/features/architect/utils/tradeMachine/**',
        'src/features/architect/utils/capUtils.js', // Canonical facade delegates to SSOT
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  // Relative imports to tradeMachine capUtils
                  './tradeMachine/utils/capUtils*',
                  '../tradeMachine/utils/capUtils*',
                  '../../tradeMachine/utils/capUtils*',
                  '**/tradeMachine/utils/capUtils*',
                ],
                message:
                  'Import apron helpers from @/features/architect/utils/capUtils instead of directly from tradeMachine.',
              },
            ],
          },
        ],
      },
    },
  ],
};
