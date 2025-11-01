module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
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
              'Do not declare Player*/Contract* interfaces outside src/schemas. Import from src/schemas/players_v2 instead.'
          }
        ]
      }
    }
  ]
};


