import js from '@eslint/js';
import globals from 'globals';

// Lint for bugs, not for taste: unused and undefined names, shadowed imports (a local that hides an
// import is how a stale import slips through), loose equality, accidental globals.
export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-shadow': ['error', { builtinGlobals: false, hoist: 'functions' }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      // storage and audio can fail in private windows and old browsers; those failures are meant to be silent
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-implicit-globals': 'error',
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: false }],
    },
  },
  // layering: the model, planner, features and geometry are plain data and logic. They never reach into
  // the renderer, effects or app, so they run in Node for tests and could move to a worker
  {
    files: ['src/core/**', 'src/plan/**', 'src/features/**', 'src/geom/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['**/render/**', '**/fx/**', '**/app/**'], message: 'core, plan, features and geom must not depend on render, fx or app.' },
        { group: ['three/addons/*'], message: 'Only render/ uses Three.js addons.' },
      ] }],
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage', 'requestAnimationFrame'],
    },
  },
  {
    files: ['scripts/**', 'test/**', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
