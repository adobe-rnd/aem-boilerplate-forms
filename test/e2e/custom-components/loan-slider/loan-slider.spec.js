import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('loan-slider');
const FIELD = 'field-under-test';

test.describe('loan-slider custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('decorates the field with slider, textbox, ticks and labels', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.loan-slider-range')).toBeVisible();
    await expect(wrapper.locator('.loan-slider-text')).toHaveValue('₹50,000');
    await expect(wrapper.locator('.loan-slider-tick')).toHaveCount(13);
    const labels = await wrapper.locator('.loan-slider-label').allTextContents();
    expect(labels[0]).toBe('50K');
    expect(labels[labels.length - 1]).toBe('12.5L');
  });

  test('splits and min/max come from authored properties', async ({ page, formServer }) => {
    const def = JSON.parse(JSON.stringify(formDef));
    def.items[0].properties.splits = 4;
    def.items[0].minimum = 100000;
    def.items[0].maximum = 500000;
    await renderForm(page, formServer, def);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.loan-slider-tick')).toHaveCount(5);
    await expect(wrapper.locator('.loan-slider-range')).toHaveAttribute('max', '4');
    await expect(wrapper.locator('.loan-slider-text')).toHaveValue('₹1,00,000');
    await expect(wrapper.locator('.loan-slider-label').nth(1)).toHaveText('2L');
  });

  test('reflects a model value set by a rule or prefill', async ({ page }) => {
    await setModel(page, FIELD, 'value', 500000);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.loan-slider-text')).toHaveValue('₹5,00,000');
    await expect(wrapper.locator('.loan-slider-range')).toHaveValue('5');
  });

  test('slider updates the textbox and commits the model on each release', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    const wrapper = field(page, FIELD);
    const slider = wrapper.locator('.loan-slider-range');
    await slider.focus();
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await expect(wrapper.locator('.loan-slider-text')).toHaveValue('₹2,50,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(250000);
    expect(await changes()).toBe(2);
  });

  test('textbox updates the slider and the model', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const text = wrapper.locator('.loan-slider-text');
    await text.fill('6,50,000');
    await expect(wrapper.locator('.loan-slider-range')).toHaveValue('6');
    await text.press('Enter');
    await expect(text).toHaveValue('₹6,50,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(650000);
  });

  test('textbox clamps values outside min/max', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const text = wrapper.locator('.loan-slider-text');
    await text.fill('99999999');
    await text.press('Tab');
    await expect(text).toHaveValue('₹12,50,000');
    await expect(wrapper.locator('.loan-slider-range')).toHaveValue('12');
    await expect.poll(() => getModel(page, FIELD)).toEqual(1250000);
    await text.fill('10');
    await text.press('Tab');
    await expect(text).toHaveValue('₹50,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(50000);
  });
});
