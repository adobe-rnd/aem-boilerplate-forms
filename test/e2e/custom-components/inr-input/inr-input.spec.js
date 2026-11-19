import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';
const words = (page) => field(page, FIELD).locator('.inr-input-words-output');
const input = (page) => field(page, FIELD).locator('.inr-input-group input');

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('decorates the field with ₹ prefix and read-only words field', async ({ page }) => {
    await expect(field(page, FIELD)).toHaveAttribute('data-component-status', 'loaded');
    await expect(field(page, FIELD).locator('.inr-input-symbol')).toHaveText('₹');
    await expect(words(page)).toHaveAttribute('readonly', '');
    await expect(words(page)).toHaveValue('');
    await expect(field(page, FIELD).locator('.inr-input-words-label')).toHaveText('Amount (in words)');
  });

  test('applies authored wordsLabel', async ({ page, formServer }) => {
    const def = JSON.parse(JSON.stringify(formDef));
    def.items[0].properties = { wordsLabel: 'In words' };
    await renderForm(page, formServer, def);
    await expect(field(page, FIELD).locator('.inr-input-words-label')).toHaveText('In words');
  });

  test('reflects a model value set by a rule or prefill', async ({ page }) => {
    await setModel(page, FIELD, 'value', '1234567.5');
    await expect(words(page)).toHaveValue(
      'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only',
    );
  });

  test('updates words live while typing and commits the model once on blur', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await input(page).click();
    await page.keyboard.type('25000000');
    await expect(words(page)).toHaveValue('Two Crore Fifty Lakh Rupees Only');
    await page.keyboard.type('.05');
    await expect(words(page)).toHaveValue('Two Crore Fifty Lakh Rupees and Five Paise Only');
    expect(await changes()).toBe(0);
    await page.keyboard.press('Tab');
    await expect.poll(() => getModel(page, FIELD)).toEqual('25000000.05');
    expect(await changes()).toBe(1);
  });

  test('handles one rupee, paise only, and rejects invalid characters', async ({ page }) => {
    await input(page).click();
    await page.keyboard.type('1');
    await expect(words(page)).toHaveValue('One Rupee Only');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('0.99');
    await expect(words(page)).toHaveValue('Ninety Nine Paise Only');
    await input(page).fill('');
    await page.keyboard.type('a1,0b0');
    await expect(input(page)).toHaveValue('100');
    await expect(words(page)).toHaveValue('One Hundred Rupees Only');
  });
});
