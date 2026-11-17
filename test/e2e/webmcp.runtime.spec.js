import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = 'http://localhost:3000';
const formDefinition = {
  id: 'webmcp-submit',
  action: '/webmcp-submit',
  properties: { 'fd:webMcpEnabled': true },
  items: [
    {
      id: 'steps',
      name: 'steps',
      fieldType: 'panel',
      ':type': 'wizard',
      items: [
        {
          id: 'destination-step',
          name: 'destinationStep',
          fieldType: 'panel',
          label: { value: 'Destination' },
          items: [
            { id: 'city', name: 'city', fieldType: 'text-input', type: 'string', required: true, label: { value: 'City' } },
            { id: 'summary', name: 'summary', fieldType: 'text-input', type: 'string', readOnly: true, rules: { value: "city & '!'" } },
          ],
        },
        {
          id: 'details-step',
          name: 'detailsStep',
          fieldType: 'panel',
          label: { value: 'Details' },
          items: [{ id: 'notes', name: 'notes', fieldType: 'text-input', type: 'string' }],
        },
      ],
    },
    {
      id: 'passengers',
      name: 'passengers',
      fieldType: 'panel',
      type: 'object',
      repeatable: true,
      minOccur: 1,
      maxOccur: 3,
      items: [{ name: 'passengerName', fieldType: 'text-input', type: 'string' }],
    },
    { id: 'add-passenger', name: 'addPassenger', fieldType: 'button', label: { value: 'Add passenger' }, events: { click: 'addInstance(passengers)' } },
    { id: 'remove-passenger', name: 'removePassenger', fieldType: 'button', label: { value: 'Remove passenger' }, events: { click: 'removeInstance(passengers)' } },
    { id: 'submit', name: 'submit', fieldType: 'button', buttonType: 'submit', label: { value: 'Submit' } },
  ],
};

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context, page }) => {
  await context.route(`${origin}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><body><main></main></body>' });
    } else if (pathname === '/webmcp-submit') {
      await route.fulfill({
        json: { thankYouMessage: 'WebMCP submission received' },
      });
    } else {
      const file = path.join(root, pathname);
      const contentType = pathname.endsWith('.css') ? 'text/css' : 'text/javascript';
      await route.fulfill({ contentType, body: await fs.readFile(file) });
    }
  });
  await page.goto(origin);
  await page.evaluate(() => {
    window.hlx = { codeBasePath: '' };
    window.webMcpTools = new Map();
    navigator.modelContext = {
      registerTool(tool) {
        window.webMcpTools.set(tool.name, tool);
        return { unregister: () => window.webMcpTools.delete(tool.name) };
      },
    };
  });
});

for (const useWorker of [true, false]) {
  test(`WebMCP tools operate on a rendered form ${useWorker ? 'with' : 'without'} a worker`, async ({ page }) => {
    await page.evaluate(async ({ definition, worker }) => {
      if (!worker) window.Worker = undefined;
      const { renderForm } = await import('/blocks/form/form.js');
      await renderForm(definition, document.querySelector('main'));
    }, { definition: formDefinition, worker: useWorker });

    await expect.poll(() => page.evaluate(() => window.webMcpTools.size)).toBe(13);
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(1);
    const forms = await page.evaluate(() => window.webMcpTools.get('list_forms').execute({}));
    expect(forms.forms).toHaveLength(1);
    const formId = forms.forms[0].id;
    const execute = (name, args = {}) => page.evaluate(
      ({ tool, input }) => window.webMcpTools.get(tool).execute(input),
      { tool: name, input: { form_id: formId, ...args } },
    );

    expect((await execute('get_form_summary')).success).toBe(true);
    expect((await execute('explain_field', { field: 'city' })).success).toBe(true);
    const before = await page.evaluate(() => window.myForm.getState(true));
    expect((await execute('validate_form_completeness')).complete).toBe(false);
    expect(await page.evaluate(() => window.myForm.getState(true))).toEqual(before);
    expect((await execute('submit_form')).success).toBe(false);

    expect((await execute('set_field_value', { field: 'city', value: 'Paris' })).success).toBe(true);
    await expect(page.locator('#city')).toHaveValue('Paris');
    await expect(page.locator('#summary')).toHaveValue('Paris!');
    expect((await execute('get_field_value', { field: 'city' })).value).toBe('Paris');
    expect((await execute('focus_field', { field: 'city' })).success).toBe(true);
    await expect(page.locator('#city')).toBeFocused();
    expect((await execute('navigate_to_panel', { panel: 'detailsStep' })).success).toBe(true);
    await expect(page.locator('#details-step')).toHaveClass(/current-wizard-step/);
    expect((await execute('apply_prefill', { values: [{ field: 'notes', value: 'Window seat' }] })).success).toBe(true);
    await expect(page.locator('#notes')).toHaveValue('Window seat');

    const panel = '$form.passengers';
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(1);
    await page.locator('#add-passenger').click();
    expect((await execute('list_repeatable_instances', { panel })).instanceCount).toBe(2);
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(2);
    await page.locator('#remove-passenger').click();
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(1);
    await page.locator('.repeat-wrapper .item-add').click();
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(2);
    await page.locator('.repeat-wrapper .item-remove').last().click();
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(1);
    expect((await execute('list_repeatable_instances', { panel })).instanceCount).toBe(1);
    expect((await execute('add_repeatable_instance', { panel })).instanceCount).toBe(2);
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(2);
    expect((await execute('remove_repeatable_instance', { panel, index: 1 })).instanceCount).toBe(1);
    await expect(page.locator('.repeat-wrapper > fieldset')).toHaveCount(1);
    expect((await execute('validate_form_completeness')).complete).toBe(true);
    const submission = await execute('submit_form');
    expect(submission.success).toBe(true);
    expect(submission.submitted).toBe(true);
    await expect(page.locator('.success-message')).toHaveText('WebMCP submission received');
  });
}
