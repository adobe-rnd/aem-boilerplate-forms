module.exports = {
  env: {
    node: true,
    browser: false,
  },
  rules: {
    // build.js and src/ live in a sub-package that intentionally references
    // the parent package's source via relative paths at build time.
    'import/no-relative-packages': 'off',
    // esbuild is a devDependency of this sub-package, not the root.
    // ESLint runs from the root and can't resolve sub-package node_modules.
    'import/no-extraneous-dependencies': 'off',
    'import/no-unresolved': 'off',
    // build.js is a Node.js script; no-restricted-syntax (for...of) and
    // no-underscore-dangle (__dirname emulation) are not relevant here.
    'no-restricted-syntax': 'off',
    'no-underscore-dangle': 'off',
    'no-console': 'off',
  },
};
