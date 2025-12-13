module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  overrides: [
    {
      files: ['**/*.{ts,tsx,d.ts}'],
      excludedFiles: ['src/schemas/**', 'src/types/**', 'player-scrape/**'],
      rules: {
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
    // - This blocks both alias imports AND relative imports
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
                  // Alias imports (your standard style)
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

                  // Catch-all patterns (covers deeper relative paths)
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
  ],
};
