import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('loan-slider');
const FIELD = 'field-under-test';

const variant = (props) => {
  const def = JSON.parse(JSON.stringify(formDef));
  Object.assign(def.items[0], props.field || {});
  def.items[0].properties = { ...def.items[0].properties, ...(props.properties || {}) };
  return def;
};

const slider = (page) => field(page, FIELD).locator('input[type="range"]');
const amount = (page) => field(page, FIELD).locator('input.loan-slider-amount');
const labelsOf = (page) => field(page, FIELD).locator('.loan-slider-tick-label');

test.describe('loan-slider custom component', () => {
  test.describe('defaults', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('renders slider, editable amount box and default ticks', async ({ page }) => {
      await expect(field(page, FIELD)).toHaveAttribute('data-component-status', 'loaded');
      await expect(slider(page)).toHaveAttribute('min', '50000');
      await expect(slider(page)).toHaveAttribute('max', '1250000');
      await expect(amount(page)).toBeVisible();
      await expect(amount(page)).toBeEditable();
      await expect(field(page, FIELD).locator('.loan-slider-tick')).toHaveCount(6);
      await expect(labelsOf(page)).toHaveText(['50K', '2.9L', '5.3L', '7.7L', '10.1L', '12.5L']);
    });

    test('reflects model value set externally', async ({ page }) => {
      await setModel(page, FIELD, 'value', 500000);
      await expect(amount(page)).toHaveValue('₹5,00,000');
      await expect(slider(page)).toHaveValue('500000');
    });

    test('slider movement updates amount and model', async ({ page }) => {
      await slider(page).focus();
      await slider(page).press('End');
      await expect(amount(page)).toHaveValue('₹12,50,000');
      await expect.poll(() => getModel(page, FIELD)).toEqual(1250000);
      await slider(page).press('Home');
      await expect(amount(page)).toHaveValue('₹50,000');
      await expect.poll(() => getModel(page, FIELD)).toEqual(50000);
    });

    test('amount edits commit once, are parsed and clamped', async ({ page }) => {
      const changes = await trackChanges(page, FIELD);
      await amount(page).fill('₹7,50,000');
      await amount(page).press('Enter');
      await expect(slider(page)).toHaveValue('750000');
      await expect.poll(() => getModel(page, FIELD)).toEqual(750000);
      expect(await changes()).toBe(1);
      await amount(page).fill('99999999');
      await amount(page).blur();
      await expect(slider(page)).toHaveValue('1250000');
      await expect(amount(page)).toHaveValue('₹12,50,000');
      await amount(page).fill('10');
      await amount(page).blur();
      await expect.poll(() => getModel(page, FIELD)).toEqual(50000);
    });
  });

  test('applies authored min, max and splits', async ({ page, formServer }) => {
    await renderForm(page, formServer, variant({
      field: { minimum: 100000, maximum: 10000000 },
      properties: { splits: 3 },
    }));
    await expect(slider(page)).toHaveAttribute('min', '100000');
    await expect(slider(page)).toHaveAttribute('max', '10000000');
    await expect(labelsOf(page)).toHaveText(['1L', '34L', '67L', '1Cr']);
  });
});
