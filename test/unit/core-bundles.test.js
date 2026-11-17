/* eslint-env mocha, node */
import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { rollup } from 'rollup';
import loadConfigFile from 'rollup/dist/loadConfigFile.js';

describe('Generated core bundles', function testCoreBundles() {
  this.timeout(30000);
  let temporaryDirectory;
  let modelDirectory;
  let variants;
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const eventExports = [
    'AddInstance', 'AddItem', 'BaseAction', 'Blur', 'Change', 'Click', 'CustomEvent',
    'ExecuteRule', 'FieldChanged', 'Focus', 'FormLoad', 'Initialize', 'Invalid',
    'RemoveInstance', 'RemoveItem', 'RequestFailure', 'RequestSuccess', 'Reset',
    'Save', 'ScriptError', 'Submit', 'SubmitError', 'SubmitFailure', 'SubmitSuccess',
    'UIChange', 'Valid', 'ValidationComplete', 'isDependencyChange', 'isSelfChange',
    'isUserChange', 'propertyChange',
  ];

  before(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'eds-core-bundles-'));
    modelDirectory = path.join(temporaryDirectory, 'model');
    await fs.mkdir(modelDirectory);
    await fs.writeFile(path.join(temporaryDirectory, 'package.json'), '{"type":"module"}');
    const vendoredDirectory = path.join(root, 'blocks/form/rules');
    await Promise.all([
      fs.symlink(path.join(vendoredDirectory, 'formula'), path.join(temporaryDirectory, 'formula')),
      ...['afb-formatters.js', 'afb-formatters.min.js'].map((filename) => (
        fs.symlink(path.join(vendoredDirectory, 'model', filename), path.join(modelDirectory, filename))
      )),
    ]);
    const { options } = await loadConfigFile(path.join(root, 'rollup/af-core.rollup.config.js'), {
      silent: true,
    });
    const [config] = options;
    const bundle = await rollup(config);
    try {
      const readable = await bundle.write({ ...config.output[0], dir: modelDirectory });
      const minified = await bundle.write({ ...config.output[1], dir: modelDirectory });
      variants = [readable.output, minified.output];
    } finally {
      await bundle.close();
    }
  });

  after(async () => {
    if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('does not overwrite readable files with minified output', () => {
    const filenames = variants.flat().map((chunk) => chunk.fileName);
    assert.strictEqual(new Set(filenames).size, filenames.length);
  });

  ['', '.min'].forEach((suffix, index) => {
    describe(suffix ? 'minified output' : 'readable output', () => {
      it('emits only the canonical runtime and events bundles', () => {
        assert.deepStrictEqual(
          variants[index].map((chunk) => chunk.fileName).sort(),
          [`afb-events${suffix}.js`, `afb-runtime${suffix}.js`],
        );
      });

      it('imports the matching canonical events bundle', () => {
        const runtime = variants[index].find((chunk) => chunk.fileName === `afb-runtime${suffix}.js`);
        assert.ok(runtime.imports.includes(`afb-events${suffix}.js`));
      });

      it('imports the matching formatter variant', () => {
        const runtime = variants[index].find((chunk) => chunk.fileName === `afb-runtime${suffix}.js`);
        const formatterImport = new RegExp(`['"]\\./afb-formatters${suffix.replace('.', '\\.')}\\.js['"]`);
        assert.ok(formatterImport.test(runtime.code), 'runtime must import the matching formatter');
      });

      it('preserves event exports and shares event constructors with the runtime', async () => {
        const events = await import(pathToFileURL(path.join(modelDirectory, `afb-events${suffix}.js`)));
        eventExports.forEach((name) => assert.ok(name in events, `missing event export: ${name}`));
        const runtime = await import(pathToFileURL(path.join(modelDirectory, `afb-runtime${suffix}.js`)));
        const form = runtime.createFormInstance({
          adaptiveform: '0.10.0',
          items: [{
            id: 'value', name: 'value', type: 'string', fieldType: 'text-input',
          }],
        });
        const field = form.getElement('value');
        const changes = [];
        field.subscribe((event) => changes.push(event), 'change');
        field.value = 'updated';
        assert.ok(changes.length > 0);
        changes.forEach((event) => {
          assert.ok(event instanceof events.BaseAction);
          assert.strictEqual(event.type, 'change');
        });
        assert.deepStrictEqual(form.exportData(), { value: 'updated' });
      });
    });
  });
});
