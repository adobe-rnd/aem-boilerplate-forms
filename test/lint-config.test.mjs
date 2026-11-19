import assert from 'node:assert/strict';
import { test } from 'node:test';
import eslint from 'eslint/use-at-your-own-risk';

const { FlatESLint } = eslint;
const linter = new FlatESLint();
const formMessages = (result) => result.messages.filter(
  (message) => message.ruleId?.startsWith('aem-forms/'),
);

test('rejects browser access in custom functions and fragment scripts', async () => {
  const code = "export function readInput() { return document.querySelector('input'); }\n";
  for (const filePath of [
    'blocks/form/functions.js',
    'blocks/form/fragments/example.js',
    'blocks/form/components/example/example-rules.js',
  ]) {
    const [result] = await linter.lintText(code, { filePath });
    assert.ok(formMessages(result).some(
      (message) => message.ruleId === 'aem-forms/headless-incompatible-usage'
        && message.severity === 2,
    ), `Missing headless check for ${filePath}`);
  }
});

test('allows tracked model reads in custom functions', async () => {
  const [result] = await linter.lintText(
    'export function readValue(globals) { return globals.field.$value; }\n',
    { filePath: 'blocks/form/functions.js' },
  );
  assert.deepEqual(formMessages(result), []);
});

test('rejects direct model-internal reads that bypass dependency tracking', async () => {
  const [result] = await linter.lintText(
    'export function readValue(globals) { return globals.field._jsonModel.value; }\n',
    { filePath: 'blocks/form/functions.source.js' },
  );
  assert.ok(formMessages(result).some(
    (message) => message.ruleId === 'aem-forms/custom-fn-correctness'
      && message.severity === 2,
  ));
});

test('warns when a component changes DOM input values without syncing the model', async () => {
  const [result] = await linter.lintText(
    `export default function decorate(element) {
      element.addEventListener('input', (event) => {
        event.target.value = 'changed';
      });
    }\n`,
    { filePath: 'blocks/form/components/example/example.js' },
  );
  assert.ok(formMessages(result).some(
    (message) => message.ruleId === 'aem-forms/block-decorator-input-mutation'
      && message.severity === 1,
  ));
});

test('does not treat component views or browser infrastructure as headless code', async () => {
  for (const filePath of [
    'blocks/form/components/example/example.js',
    'scripts/scripts.js',
    'blocks/fragment/fragment.js',
  ]) {
    const [result] = await linter.lintText(
      "export function readInput() { return document.querySelector('input'); }\n",
      { filePath },
    );
    assert.deepEqual(formMessages(result), []);
  }
});

test('preserves Node.js lint overrides for the distributable package', async () => {
  const [result] = await linter.lintText(
    "import esbuild from 'esbuild';\n\nconsole.log(esbuild, process.cwd(), __dirname);\n",
    { filePath: 'packages/aem-forms-block/build.js' },
  );
  assert.deepEqual(result.messages, []);
  assert.equal(await linter.isPathIgnored('packages/aem-forms-block/styles-entry.css'), true);
});

test('preserves base JavaScript and JSON linting', async () => {
  const [javascript] = await linter.lintText('const unused = 1\n', {
    filePath: 'scripts/lint-probe.js',
  });
  assert.ok(javascript.messages.some((message) => message.ruleId === 'semi'));
  const [json] = await linter.lintText('{"invalid": }\n', {
    filePath: 'models/lint-probe.json',
  });
  assert.ok(json.errorCount > 0);
  const config = await linter.calculateConfigForFile('models/lint-probe.json');
  assert.equal(config.rules['xwalk/max-cells'][1].form, 17);
});

test('preserves ignored tests, tools, and vendored runtimes', async () => {
  for (const filePath of [
    'test/unit/customFunction.test.js',
    'rollup/af-core.rollup.config.js',
    'blocks/form/rules/model/afb-runtime.js',
    'blocks/form/rules/formula/index.js',
    'blocks/form/rules/functions.js',
    'scripts/editor-support.js',
    'tools/forms-scaffolder.js',
    'blocks/form/dompurify.min.js',
  ]) {
    assert.equal(await linter.isPathIgnored(filePath), true, filePath);
  }
});
