import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import aemForms from '@aemforms/eslint-plugin';
import json from 'eslint-plugin-json';

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [
      '**/.*',
      '**/helix-importer-ui/**',
      'rollup/**',
      'blocks/form/rules/formula/**',
      'blocks/form/rules/model/**',
      'blocks/form/rules/functions.js',
      'scripts/editor-support.js',
      'scripts/editor-support-rte.js',
      'tools/forms-scaffolder.js',
      'tools/update-mappings.js',
      'test/**',
      '**/dompurify.min.js',
    ],
  },
  ...compat.config({
    extends: [
      'airbnb-base',
      'plugin:xwalk/recommended',
    ],
    env: {
      browser: true,
    },
    parser: '@babel/eslint-parser',
    parserOptions: {
      allowImportExportEverywhere: true,
      sourceType: 'module',
      requireConfigFile: false,
    },
    rules: {
      'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
      'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
      'no-param-reassign': [2, { props: false }], // allow modifying properties of param
      'import/no-extraneous-dependencies': ['error', {
        devDependencies: ['**/*.test.js', '**/*.spec.js', 'playwright.config.js', 'eslint.config.js'],
      }],
      'xwalk/max-cells': ['error', {
        '*': 4, // default limit for all models
        form: 17,
        wizard: 12,
        'form-button': 7,
        'checkbox-group': 20,
        checkbox: 19,
        'date-input': 21,
        'drop-down': 20,
        email: 22,
        'file-input': 20,
        'form-fragment': 16,
        'form-image': 7,
        'multiline-input': 23,
        'number-input': 22,
        panel: 17,
        'radio-group': 20,
        'form-reset-button': 7,
        'form-submit-button': 7,
        'telephone-input': 20,
        'text-input': 23,
        accordion: 14,
        modal: 11,
        rating: 18,
        password: 20,
        tnc: 12,
        range: 19,
      }],
      'xwalk/no-orphan-collapsible-fields': 'off', // Disable until enhancement is done for Forms properties
    },
    overrides: [{
      files: ['packages/aem-forms-block/**/*.{js,mjs,json}'],
      env: { node: true, browser: false },
      rules: {
        'import/no-relative-packages': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import/no-unresolved': 'off',
        'no-restricted-syntax': 'off',
        'no-underscore-dangle': 'off',
        'no-console': 'off',
      },
    }],
  }),
  {
    files: ['**/*.json'],
    plugins: { json },
    processor: json.processors['.json'],
    rules: { 'json/*': 'error' },
  },
  {
    files: [
      '**/functions.js',
      '**/functions.source.js',
      '**/fragment/**/*.js',
      '**/fragments/**/*.js',
      '**/*-rules.js',
      '**/*.rules.js',
    ],
    ignores: ['**/*.min.js', '**/*-bundle*.js', 'blocks/fragment/**'],
    plugins: { 'aem-forms': aemForms },
    rules: {
      'aem-forms/async-value-race': 'error',
      'aem-forms/custom-fn-correctness': 'error',
      'aem-forms/headless-incompatible-usage': 'error',
      'aem-forms/interactive-change-guard': 'error',
      'aem-forms/request-error-handling': 'error',
      'aem-forms/component-rule-form-scope': 'warn',
      'aem-forms/content-in-code': 'warn',
      'aem-forms/custom-function': 'warn',
      'aem-forms/dispatch-target': 'warn',
      'aem-forms/display-format-in-code': 'warn',
      'aem-forms/field-writes-sibling': 'warn',
      'aem-forms/fragment-globals-scope': 'warn',
      'aem-forms/hardcoded-config': 'warn',
      'aem-forms/rule-vs-code': 'warn',
      'aem-forms/runtime-cls': 'warn',
      'aem-forms/should-be-component': 'warn',
      'aem-forms/storage-class-namespace': 'warn',
    },
  },
  {
    files: ['**/components/**/*.js'],
    ignores: ['**/*.min.js', '**/*-bundle*.js', '**/*-rules.js', '**/*.rules.js'],
    plugins: { 'aem-forms': aemForms },
    rules: {
      'aem-forms/block-decorator-input-mutation': 'warn',
      'aem-forms/component-owns-model-concern': 'warn',
      'aem-forms/component-value-sync': 'warn',
    },
  },
];
