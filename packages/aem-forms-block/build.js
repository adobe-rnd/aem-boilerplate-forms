import * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const mappingsPath = resolve(__dirname, '../../blocks/form/mappings.js');
const mappingsStatic = resolve(__dirname, './src/mappings-static.js');

// Redirects imports of blocks/form/mappings.js to the static registry so
// esbuild can bundle all components without window.hlx path lookups.
const mappingsAliasPlugin = {
  name: 'mappings-alias',
  setup(build) {
    build.onResolve({ filter: /mappings\.js/ }, (args) => {
      const resolved = resolve(args.resolveDir, args.path);
      if (resolved === mappingsPath) {
        return { path: mappingsStatic };
      }
      return null;
    });
  },
};

// Replaces `typeof Worker` with `"undefined"` across all JS files so every
// Worker guard evaluates to true. This covers both rules/index.js (which
// decides the no-worker path) and form.js (which guards the loadRuleEngine
// call). esbuild then constant-folds the conditions and the Worker branch
// becomes dead code.
const noWorkerPlugin = {
  name: 'no-worker',
  setup(build) {
    build.onLoad({ filter: /\.js/ }, async (args) => {
      const contents = await readFile(args.path, 'utf8');
      if (!contents.includes('typeof Worker')) return null;
      return {
        contents: contents.replace(/typeof Worker/g, '"undefined"'),
        loader: 'js',
      };
    });
  },
};

// Stubs out mappings.js and all components — no component decorators are
// loaded. Forms render with native HTML only (no accordion, wizard, etc.).
const stubMappingsPlugin = {
  name: 'stub-mappings',
  setup(build) {
    build.onResolve({ filter: /mappings\.js/ }, () => ({ path: 'stub-mappings', namespace: 'stub-mappings' }));
    build.onLoad({ filter: /.*/, namespace: 'stub-mappings' }, () => ({
      contents: `
        export function setCustomComponents() {}
        export function getOOTBComponents() { return []; }
        export function getCustomComponents() { return []; }
        export default async function componentDecorator() { return null; }
      `,
      loader: 'js',
    }));
  },
};

// Stubs out the legacy document-based rule engine and its transformer.
// These are only used for Excel/spreadsheet-sourced forms, not AEM adaptive
// forms. Excluding them saves ~21KB from the minified bundle.
const stubDocFormsPlugin = {
  name: 'stub-doc-forms',
  setup(build) {
    build.onResolve({ filter: /rules-doc\/index\.js/ }, () => ({ path: 'stub-rules-doc', namespace: 'stub' }));
    build.onResolve({ filter: /transform\.js/ }, () => ({ path: 'stub-transform', namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
      if (args.path === 'stub-rules-doc') {
        return { contents: 'export default function() {}', loader: 'js' };
      }
      return { contents: 'export default class DocBasedFormToAF { transform(f) { return f; } }', loader: 'js' };
    });
  },
};

// Stubs out the entire rule engine (afb-runtime, formula engine, formatters).
// The form renders with its initial/default field values but rules (show/hide,
// computed values, validation expressions) do not execute.
// Eliminates ~170KB from the minified bundle.
const stubRulesPlugin = {
  name: 'stub-rules',
  setup(build) {
    build.onResolve({ filter: /rules\/index\.js/ }, () => ({ path: 'stub-rules', namespace: 'stub-rules' }));
    build.onLoad({ filter: /.*/, namespace: 'stub-rules' }, () => ({
      contents: `
        export async function initAdaptiveForm(formDef, createForm) {
          const response = await createForm(formDef, null, 'aem');
          return response?.form;
        }
        export async function loadRuleEngine() {}
        export async function fieldChanged() {}
        export function subscribe() {}
      `,
      loader: 'js',
    }));
  },
};

async function run() {
  await esbuild.build({
    entryPoints: [resolve(__dirname, '../../blocks/form/form.js')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    minify: true,
    outfile: resolve(__dirname, 'dist/form.js'),
    plugins: [noWorkerPlugin, stubDocFormsPlugin, stubMappingsPlugin],
  });

  await esbuild.build({
    entryPoints: [resolve(__dirname, 'styles-entry.css')],
    bundle: true,
    minify: true,
    outfile: resolve(__dirname, 'dist/form.css'),
    loader: { '.png': 'dataurl' },
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
