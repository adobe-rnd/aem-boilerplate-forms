import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders rupee symbol and read-only words field', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-symbol')).toHaveText('₹');
    const words = wrapper.locator('input.inr-input-words');
    await expect(words).toHaveAttribute('readonly', '');
    await expect(words).toHaveValue('');
  });

  test('applies authored words label', async ({ page }) => {
    await expect(field(page, FIELD).locator('.inr-input-words-label')).toHaveText('Amount (in words)');
  });

  test('updates words live while typing, in the Indian system', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const input = wrapper.locator('.inr-input-group input');
    const words = wrapper.locator('input.inr-input-words');
    await input.pressSequentially('1234567.5');
    await expect(words).toHaveValue('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only');
    await input.fill('');
    await input.pressSequentially('250000000');
    await expect(words).toHaveValue('Twenty Five Crore Rupees Only');
    await input.fill('');
    await input.pressSequentially('0.05');
    await expect(words).toHaveValue('Five Paise Only');
    await input.fill('');
    await input.pressSequentially('1a.234');
    await expect(input).toHaveValue('1.23');
    await expect(words).toHaveValue('One Rupee and Twenty Three Paise Only');
  });

  test('commits the model once on blur', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    const input = field(page, FIELD).locator('.inr-input-group input');
    await input.pressSequentially('1500');
    expect(await changes()).toBe(0);
    await page.keyboard.press('Tab');
    await expect.poll(() => getModel(page, FIELD)).toEqual(1500);
    expect(await changes()).toBe(1);
  });

  test('reflects model value changes in the words', async ({ page }) => {
    await setModel(page, FIELD, 'value', 100000);
    await expect(field(page, FIELD).locator('input.inr-input-words')).toHaveValue('One Lakh Rupees Only');
  });
});
