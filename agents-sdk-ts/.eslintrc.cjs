// agents-sdk-ts/.eslintrc.cjs
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    // Point ESLint's TypeScript program at the dedicated config
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: __dirname
  },
  env: { node: true, es2022: true, jest: true },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off'
  },
  // Keep build output & deps out of lint
  ignorePatterns: ['node_modules/', 'dist/'],

  // (Optional) relax tests a bit
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
};
