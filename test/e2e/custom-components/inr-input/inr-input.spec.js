import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders rupee prefix and read-only words field', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-symbol')).toHaveText('₹');
    const words = wrapper.locator('input.inr-input-words');
    await expect(words).toHaveAttribute('readonly', '');
    await expect(words).toHaveValue('');
    await expect(wrapper.locator('.inr-input-words-label')).toHaveText('Amount (in words)');
  });

  test('applies custom words label', async ({ page, formServer }) => {
    const def = JSON.parse(JSON.stringify(formDef));
    def.items[0].properties = { wordsLabel: 'In words' };
    await renderForm(page, formServer, def);
    await expect(field(page, FIELD).locator('.inr-input-words-label')).toHaveText('In words');
  });

  test('reflects a model value in words', async ({ page }) => {
    await setModel(page, FIELD, 'value', 12345678);
    await expect(field(page, FIELD).locator('input.inr-input-words')).toHaveValue(
      'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only',
    );
  });

  test('updates words live while typing and commits model once on blur', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const words = wrapper.locator('input.inr-input-words');
    const changes = await trackChanges(page, FIELD);
    await wrapper.locator('input[type="number"]').pressSequentially('150000.5');
    await expect(words).toHaveValue('Rupees One Lakh Fifty Thousand and Fifty Paise Only');
    expect(await changes()).toBe(0);
    await page.keyboard.press('Tab');
    await expect.poll(() => getModel(page, FIELD)).toEqual(150000.5);
    expect(await changes()).toBe(1);
  });

  test('handles paise only and clearing', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const input = wrapper.locator('input[type="number"]');
    const words = wrapper.locator('input.inr-input-words');
    await input.fill('0.07');
    await expect(words).toHaveValue('Seven Paise Only');
    await input.fill('');
    await expect(words).toHaveValue('');
  });

  test('tab order skips the read-only words field', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await wrapper.locator('input[type="number"]').focus();
    await page.keyboard.press('Tab');
    await expect(field(page, 'next-field').locator('input')).toBeFocused();
  });
});
