import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, dispatchModelEvent, trackChanges,
} from '../form-harness.js';

// End-to-end test for the "inr-input" custom component. The form is rendered locally from
// inr-input.form.json (no deployed page needed). Replace every TODO with real assertions;
// add more forms/fields to inr-input.form.json for authored-property variants.
const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';

const words = (page) => field(page, FIELD).getByLabel(/in words/i);
const amount = (page) => field(page, FIELD).locator('input[type="number"]');

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders prefix and read-only words field', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-prefix')).toHaveText('₹');
    await expect(words(page)).toHaveAttribute('readonly', '');
    await expect(words(page)).toHaveValue('');
    await expect(wrapper.locator('.inr-input-words-hint')).toHaveText('Read-only');
  });

  test('updates words live while typing, commits model on blur only', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await amount(page).click();
    await amount(page).pressSequentially('250000');
    await expect(words(page)).toHaveValue('Two Lakh Fifty Thousand Rupees Only');
    expect(await changes()).toBe(0);
    await page.getByLabel('Next field').click();
    await expect.poll(() => getModel(page, FIELD)).toEqual(250000);
    expect(await changes()).toBe(1);
  });

  const cases = [
    [100000, 'One Lakh Rupees Only'],
    [1500, 'One Thousand Five Hundred Rupees Only'],
    [123456.78, 'One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paise Only'],
    [12345678.9, 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees and Ninety Paise Only'],
    [0.05, 'Five Paise Only'],
  ];
  cases.forEach(([value, text]) => {
    test(`typing ${value} shows words`, async ({ page }) => {
      await amount(page).fill(String(value));
      await expect(words(page)).toHaveValue(text);
    });
  });

  test('clearing the input empties the words', async ({ page }) => {
    await amount(page).fill('1500');
    await amount(page).fill('');
    await expect(words(page)).toHaveValue('');
  });

  test('reflects external model changes', async ({ page }) => {
    await setModel(page, FIELD, 'value', 100000);
    await expect(words(page)).toHaveValue('One Lakh Rupees Only');
    await expect(amount(page)).toHaveValue('100000');
  });

  test('keyboard: tab into amount and out to next field', async ({ page }) => {
    await amount(page).focus();
    await page.keyboard.type('1500');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Next field')).toBeFocused();
    await expect.poll(() => getModel(page, FIELD)).toEqual(1500);
    expect(dispatchModelEvent).toBeDefined();
  });
});
