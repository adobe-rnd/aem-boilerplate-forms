import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

// Form: min 100000, max 600000, 5 splits => split size 100000.
const formDef = loadFormJson('loan-slider');
const FIELD = 'field-under-test';

test.describe('loan-slider custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders slider, amount box, ticks and labels from authored properties', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.loan-slider-range')).toHaveAttribute('max', '5');
    await expect(wrapper.locator('.loan-slider-tick')).toHaveCount(6);
    await expect(wrapper.locator('.loan-slider-label')).toHaveText(['1L', '2L', '3L', '4L', '5L', '6L']);
    await expect(wrapper.locator('.loan-slider-input')).toBeVisible();
  });

  test('model value updates slider and textbox', async ({ page }) => {
    await setModel(page, FIELD, 'value', 300000);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.loan-slider-range')).toHaveValue('2');
    await expect(wrapper.locator('.loan-slider-input')).toHaveValue('₹3,00,000');
  });

  test('moving the slider updates the textbox and commits the model once', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const changes = await trackChanges(page, FIELD);
    const range = wrapper.locator('.loan-slider-range');
    await range.focus();
    await page.keyboard.press('ArrowRight');
    await expect(wrapper.locator('.loan-slider-input')).toHaveValue('₹2,00,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(200000);
    await page.keyboard.press('End');
    await expect(wrapper.locator('.loan-slider-input')).toHaveValue('₹6,00,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(600000);
    expect(await changes()).toBe(2);
  });

  test('typing in the textbox moves the slider, snapping and clamping', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const box = wrapper.locator('.loan-slider-input');
    const range = wrapper.locator('.loan-slider-range');
    await box.fill('330000');
    await expect(range).toHaveValue('2');
    await box.press('Enter');
    await expect(box).toHaveValue('₹3,00,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(300000);

    await box.fill('9999999');
    await box.blur();
    await expect(range).toHaveValue('5');
    await expect(box).toHaveValue('₹6,00,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(600000);
  });

  test('keyboard: tab reaches the textbox and slider', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await wrapper.locator('.loan-slider-input').focus();
    await page.keyboard.press('Tab');
    await expect(wrapper.locator('.loan-slider-range')).toBeFocused();
  });
});
