// @ts-check
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'scripts/', '**/*.d.ts'],
  },
  {
    files: ['**/*.{ts,mts}'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      prettierConfig,
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  /**
   * Additional JavaScript rules.
   */
  {
    files: ['**/*.{ts,mts}'],
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      curly: ['error', 'multi-line'],
      'default-case': 'error',
      'default-case-last': 'error',
      eqeqeq: ['error', 'always'],
      'guard-for-in': 'error',
      'id-denylist': [
        'error',
        'any',
        'boolean',
        'Boolean',
        'number',
        'Number',
        'object',
        'Object',
        'string',
        'String',
        'undefined',
        'Undefined',
      ],
      'no-alert': 'error',
      'no-caller': 'error',
      'no-console': 'error',
      'no-constructor-return': 'error',
      'no-duplicate-imports': ['error', { includeExports: true }],
      'no-eval': 'error',
      'no-lonely-if': 'error',
      'no-mixed-operators': 'error',
      'no-new-wrappers': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-useless-return': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-regex-literals': 'error',
      radix: 'error',
      'require-atomic-updates': 'error',
    },
  },

  /**
   * Additional typescript-eslint rules.
   */
  {
    files: ['**/*.{ts,mts}'],
    rules: {
      // Floating rules that don't belong in a typescript-eslint ruleset.
      // ================================================================
      'default-param-last': 'off',
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { overrides: { constructors: 'no-public' } },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false,
          classes: true,
          variables: true,
          allowNamedExports: false,
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          considerDefaultExhaustiveForUnions: true,
        },
      ],

      // Overrides from typescript-eslint's "recommendedTypeChecked" ruleset.
      // ====================================================================
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],

      // Cherry-picked rules from typescript-eslint's "strict" ruleset.
      // ==============================================================-
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',

      // Cherry-picked rules from typescript-eslint's "strictTypeChecked" ruleset.
      // =========================================================================
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/prefer-return-this-type': 'error',

      // Cherry-picked rules from typescript-eslint's "stylistic" ruleset.
      // =================================================================
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/consistent-generic-constructors': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error',

      // Cherry-picked rules from typescript-eslint's "stylisticTypeChecked" ruleset.
      // =============================================================================
      'dot-notation': 'off',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/non-nullable-type-assertion-style': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { bigint: true, number: true, string: true } },
      ],
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
    },
  },

  /**
   * Disable no-console for plugin files where build-time logging is intentional.
   */
  {
    files: ['src/plugins/**/*.{ts,mts}'],
    rules: {
      'no-console': 'off',
    },
  },

  /**
   * Relax unsafe type rules for spec files that manipulate untyped external
   * API structures (style-dictionary token trees, JSON fixtures, etc.).
   */
  {
    files: ['**/*.spec.{ts,mts}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
