import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('decorates the field with ₹ prefix and read-only words field', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-symbol')).toHaveText('₹');
    const words = wrapper.locator('.inr-input-words-field');
    await expect(words).toHaveAttribute('readonly', '');
    await expect(words).toHaveValue('');
    await expect(wrapper.locator('.inr-input-words label')).toHaveText('Amount (in words)');
  });

  test('updates words live in Indian format with paise', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const input = wrapper.locator('.inr-input-group input');
    const words = wrapper.locator('.inr-input-words-field');
    await input.pressSequentially('1234567.5');
    await expect(words).toHaveValue('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only');
    await input.fill('10000000');
    await input.dispatchEvent('input');
    await expect(words).toHaveValue('One Crore Rupees Only');
    await input.fill('1');
    await expect(words).toHaveValue('One Rupee Only');
    await input.fill('0.05');
    await expect(words).toHaveValue('Five Paise Only');
  });

  test('rejects non-numeric characters and extra decimals', async ({ page }) => {
    const input = field(page, FIELD).locator('.inr-input-group input');
    await input.pressSequentially('a1,2.345.6');
    await expect(input).toHaveValue('12.34');
  });

  test('reflects a model value set by a rule or prefill', async ({ page }) => {
    await setModel(page, FIELD, 'value', '250000');
    await expect(field(page, FIELD).locator('.inr-input-words-field')).toHaveValue('Two Lakh Fifty Thousand Rupees Only');
  });

  test('commits the model once on blur', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    const input = field(page, FIELD).locator('.inr-input-group input');
    await input.pressSequentially('4500');
    expect(await changes()).toBe(0);
    await input.blur();
    await expect.poll(() => getModel(page, FIELD)).toEqual('4500');
    expect(await changes()).toBe(1);
  });
});
