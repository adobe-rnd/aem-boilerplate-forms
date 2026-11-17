import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, dispatchModelEvent, trackChanges,
} from '../form-harness.js';

// End-to-end test for the "inr-input" custom component. The form is rendered locally from
// inr-input.form.json (no deployed page needed). Replace every TODO with real assertions;
// add more forms/fields to inr-input.form.json for authored-property variants.
const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';

const CASES = [
  [100000, 'One Lakh Rupees Only'],
  [250000, 'Two Lakh Fifty Thousand Rupees Only'],
  [1500, 'One Thousand Five Hundred Rupees Only'],
  [123456.78, 'One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paise Only'],
  [12345678.9, 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees and Ninety Paise Only'],
  [0.05, 'Five Paise Only'],
];

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  const words = (page) => field(page, FIELD).locator('input[readonly], textarea[readonly], output');

  test('renders prefix, amount input and read-only words field', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-prefix')).toHaveText('₹');
    await expect(wrapper.getByLabel('in words')).toHaveCount(1);
    await expect(words(page)).toHaveValue('');
    await expect(wrapper.locator('.inr-input-readonly-hint')).toHaveText('Read-only');
  });

  for (const [amount, expected] of CASES) {
    test(`model value ${amount} shows words`, async ({ page }) => {
      await setModel(page, FIELD, 'value', amount);
      await expect(words(page)).toHaveValue(expected);
    });
  }

  test('words update live while typing; model commits once on blur', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    const input = field(page, FIELD).locator('input:not([readonly])');
    await input.click();
    await input.pressSequentially('123456.78');
    await expect(words(page)).toHaveValue(CASES[3][1]);
    expect(await getModel(page, FIELD)).toBeFalsy();
    await page.keyboard.press('Tab');
    await expect.poll(() => getModel(page, FIELD)).toEqual(123456.78);
    expect(await changes()).toBe(1);
    await input.fill('');
    await expect(words(page)).toHaveValue('');
  });
});
