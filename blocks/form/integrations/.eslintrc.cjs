module.exports = {
  env: {
    // The provider is a browser ES2020+ module; enable `globalThis` and friends.
    browser: true,
    es2021: true,
  },
  rules: {
    // The provider is migrated out of the web agent's `sdk/` tree and intentionally imports the
    // in-repo built Adaptive Forms bundle by relative path (the same renderer the published
    // `@aemforms/af-forms-block` package wraps). Mirrors `packages/aem-forms-block`.
    'import/no-relative-packages': 'off',
    // `emit`, `progress`, and `fail` are mutually recursive lifecycle callbacks; one forward
    // reference between them is unavoidable and safe (they only run after render completes).
    'no-use-before-define': ['error', { functions: false, classes: true, variables: false }],
    // Provider modules export named helpers so the adapter and the web agent can import them
    // individually; a forced default export would not match the shared contract/registry shape.
    'import/prefer-default-export': 'off',
    // Intentional operational diagnostics: the provider logs errors the host cannot observe.
    'no-console': 'off',
  },
};
