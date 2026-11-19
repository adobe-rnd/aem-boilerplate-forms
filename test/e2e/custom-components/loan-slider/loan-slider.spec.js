import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

// End-to-end test for the "loan-slider" custom component. The form is rendered locally from
// loan-slider.form.json (no deployed page needed). Replace every TODO with real assertions;
// add more forms/fields to loan-slider.form.json for authored-property variants.
const formDef = loadFormJson('loan-slider');
const FIELD = 'field-under-test';

const slider = (page) => field(page, FIELD).locator('.loan-slider-range');
const textBox = (page) => field(page, FIELD).locator('.loan-slider-value');

test.describe('loan-slider custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders slider, text box and equal-split ticks', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(slider(page)).toHaveAttribute('max', '24');
    await expect(wrapper.locator('.loan-slider-tick')).toHaveCount(25);
    await expect(wrapper.locator('.loan-slider-label').first()).toHaveText('50K');
    await expect(wrapper.locator('.loan-slider-label').last()).toHaveText('12.5L');
    await expect(textBox(page)).toHaveValue('₹5,00,000');
    await expect(slider(page)).toHaveValue('9');
  });

  test('model value moves slider and text box', async ({ page }) => {
    await setModel(page, FIELD, 'value', 1000000);
    await expect(textBox(page)).toHaveValue('₹10,00,000');
    await expect(slider(page)).toHaveValue('19');
  });

  test('sliding updates text box and commits the model once', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await slider(page).focus();
    await slider(page).press('ArrowRight');
    await expect(textBox(page)).toHaveValue('₹5,50,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(550000);
    expect(await changes()).toBe(1);
  });

  test('typing in the text box updates slider and model, clamped and snapped', async ({ page }) => {
    await textBox(page).fill('726000');
    await textBox(page).press('Enter');
    await expect(slider(page)).toHaveValue('14');
    await expect(textBox(page)).toHaveValue('₹7,50,000');
    await expect.poll(() => getModel(page, FIELD)).toEqual(750000);

    await textBox(page).fill('99999999');
    await textBox(page).press('Tab');
    await expect(textBox(page)).toHaveValue('₹12,50,000');
    await expect(slider(page)).toHaveValue('24');
    await expect.poll(() => getModel(page, FIELD)).toEqual(1250000);
  });

  test('tabs through text box and slider to the next field', async ({ page }) => {
    await textBox(page).focus();
    await page.keyboard.press('Tab');
    await expect(slider(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-id="next-field"] input')).toBeFocused();
  });
});
