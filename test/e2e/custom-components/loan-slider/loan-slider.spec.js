import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('loan-slider');
const FIELD = 'field-under-test';

const variant = (patch, props = {}) => {
  const copy = JSON.parse(JSON.stringify(formDef));
  Object.assign(copy.items[0], patch);
  Object.assign(copy.items[0].properties, props);
  return copy;
};

const amountBox = (page) => field(page, FIELD).locator('input.loan-slider-amount');
const slider = (page) => field(page, FIELD).locator('input[type="range"]');

test.describe('loan-slider custom component', () => {
  test.describe('default form', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('decorates the field with slider, amount box, ticks', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
      await expect(amountBox(page)).toBeVisible();
      await expect(amountBox(page)).toBeEditable();
      await expect(slider(page)).toHaveAttribute('min', '50000');
      await expect(slider(page)).toHaveAttribute('max', '1250000');
      await expect(wrapper.locator('.loan-slider-tick')).toHaveCount(6);
      await expect(wrapper.locator('.loan-slider-tick-label')).toHaveText(['50K', '2.9L', '5.3L', '7.7L', '10.1L', '12.5L']);
    });

    test('model -> UI: formats in rupees and moves slider', async ({ page }) => {
      await setModel(page, FIELD, 'value', 500000);
      await expect(amountBox(page)).toHaveValue('₹5,00,000');
      await expect(slider(page)).toHaveValue('500000');
      await expect(slider(page)).toHaveAttribute('aria-valuenow', '500000');
    });

    test('slider -> model', async ({ page }) => {
      const changes = await trackChanges(page, FIELD);
      await slider(page).focus();
      await page.keyboard.press('End');
      await expect.poll(() => getModel(page, FIELD)).toBe(1250000);
      await expect(amountBox(page)).toHaveValue('₹12,50,000');
      await page.keyboard.press('Home');
      await expect.poll(() => getModel(page, FIELD)).toBe(50000);
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => getModel(page, FIELD)).toBeGreaterThan(50000);
      expect(await changes()).toBeGreaterThanOrEqual(3);
    });

    test('text box commits on blur/Enter, clamps and ignores symbols', async ({ page }) => {
      const changes = await trackChanges(page, FIELD);
      await amountBox(page).fill('₹7,50,000');
      await amountBox(page).press('Enter');
      await expect.poll(() => getModel(page, FIELD)).toBe(750000);
      await expect(slider(page)).toHaveValue('750000');
      await expect(amountBox(page)).toHaveValue('₹7,50,000');
      expect(await changes()).toBe(1);

      await amountBox(page).fill('99999999');
      await page.keyboard.press('Tab');
      await expect.poll(() => getModel(page, FIELD)).toBe(1250000);
      await amountBox(page).fill('10');
      await page.keyboard.press('Tab');
      await expect.poll(() => getModel(page, FIELD)).toBe(50000);
      await expect(amountBox(page)).toHaveValue('₹50,000');
    });
  });

  test('applies authored minimum, maximum and splits', async ({ page, formServer }) => {
    await renderForm(page, formServer, variant({ minimum: 100000, maximum: 20000000 }, { splits: 4 }));
    const wrapper = field(page, FIELD);
    await expect(slider(page)).toHaveAttribute('min', '100000');
    await expect(slider(page)).toHaveAttribute('max', '20000000');
    await expect(wrapper.locator('.loan-slider-tick')).toHaveCount(5);
    const labels = wrapper.locator('.loan-slider-tick-label');
    await expect(labels.first()).toHaveText('1L');
    await expect(labels.last()).toHaveText('2Cr');
  });

  test('uses defaults when min/max/splits are not authored', async ({ page, formServer }) => {
    const def = variant({});
    delete def.items[0].minimum;
    delete def.items[0].maximum;
    delete def.items[0].properties.splits;
    await renderForm(page, formServer, def);
    await expect(slider(page)).toHaveAttribute('min', '50000');
    await expect(slider(page)).toHaveAttribute('max', '1250000');
    await expect(field(page, FIELD).locator('.loan-slider-tick')).toHaveCount(6);
  });
});
