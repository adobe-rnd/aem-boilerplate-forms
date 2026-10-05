/* eslint-env mocha, node */
import assert from 'assert';
import fs from 'fs';

describe('WebMCP Universal Editor authoring model', () => {
  const source = JSON.parse(fs.readFileSync('blocks/form/_form.json', 'utf8'));
  const generated = JSON.parse(fs.readFileSync('component-models.json', 'utf8'));
  const property = 'fd:webMcpEnabled';
  const sourceForm = source.models.find((model) => model.id === 'form');
  const generatedForm = generated.find((model) => model.id === 'form');
  const basicFields = (model) => model.fields.find((field) => field.name === 'basic').fields;

  it('provides a default-off Boolean control for the persisted form property', () => {
    const field = basicFields(sourceForm).find((item) => item.name === property);
    assert.ok(field, 'form authoring model must expose the WebMCP property');
    assert.strictEqual(field.component, 'boolean');
    assert.strictEqual(field.valueType, 'boolean');
    assert.strictEqual(field.value, false);
    assert.strictEqual(field.label, 'Enable AI assistant access (WebMCP)');
    assert.ok(field.description);
    assert.strictEqual(field.condition, undefined);
  });

  it('includes the same control in the generated component model', () => {
    const sourceField = basicFields(sourceForm).find((item) => item.name === property);
    const generatedField = basicFields(generatedForm).find((item) => item.name === property);
    assert.ok(generatedField, 'generated form model must include the WebMCP property');
    assert.deepStrictEqual(generatedField, sourceField);
  });

  it('keeps existing custom function and style controls unchanged', () => {
    assert.deepStrictEqual(
      basicFields(sourceForm).filter((field) => field.name !== property),
      [
        {
          component: 'text', name: 'customFunctionsPath', label: 'Form Specific Custom Functions Path', valueType: 'string',
        },
        {
          component: 'text', name: 'style', label: 'Form Specific styles path', valueType: 'string',
        },
      ],
    );
  });
});
