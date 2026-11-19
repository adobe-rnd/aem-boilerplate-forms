import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('decorates the field with ₹ prefix and read-only words output', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-symbol')).toHaveText('₹');
    await expect(wrapper.locator('.inr-input-group input')).toBeVisible();
    await expect(wrapper.locator('.inr-input-words')).toHaveText('');
    await expect(wrapper.locator('.inr-input-words-label')).toHaveText('Amount (in words)');
  });

  test('applies the authored words label', async ({ page, formServer }) => {
    const def = JSON.parse(JSON.stringify(formDef));
    def.items[0].properties.wordsLabel = 'In words';
    await renderForm(page, formServer, def);
    await expect(field(page, FIELD).locator('.inr-input-words-label')).toHaveText('In words');
  });

  test('reflects a model value in the words', async ({ page }) => {
    await setModel(page, FIELD, 'value', '1234567.5');
    await expect(field(page, FIELD).locator('.inr-input-words'))
      .toHaveText('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only');
  });

  test('updates words live while typing and commits the model per keystroke', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    const input = field(page, FIELD).locator('input');
    const words = field(page, FIELD).locator('.inr-input-words');
    await input.pressSequentially('12,5a0000000.456');
    await expect(input).toHaveValue('1250000000.45');
    await expect(words).toHaveText('One Hundred Twenty Five Crore Rupees and Forty Five Paise Only');
    await expect.poll(() => getModel(page, FIELD)).toEqual('1250000000.45');
    expect(await changes()).toBeGreaterThan(1);
    await input.fill('1');
    await expect(words).toHaveText('One Rupee Only');
    await input.fill('0.05');
    await expect(words).toHaveText('Five Paise Only');
  });

  test('keyboard tab moves to the next field', async ({ page }) => {
    await field(page, FIELD).locator('input').focus();
    await page.keyboard.type('100');
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-id="next-field"] input')).toBeFocused();
    await expect(field(page, FIELD).locator('.inr-input-words')).toHaveText('One Hundred Rupees Only');
  });
});
