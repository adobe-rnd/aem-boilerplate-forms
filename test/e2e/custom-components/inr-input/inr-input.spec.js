import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

// End-to-end test for the "inr-input" custom component. The form is rendered locally from
// inr-input.form.json (no deployed page needed). Replace every TODO with real assertions;
// add more forms/fields to inr-input.form.json for authored-property variants.
const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';

const words = (page) => field(page, FIELD).locator('.inr-input-words');
const input = (page) => field(page, FIELD).locator('input:not(.inr-input-words)');

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders rupee prefix and a read-only words field below the input', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-symbol')).toHaveText('₹');
    await expect(words(page)).toHaveAttribute('readonly', '');
    await expect(wrapper.locator('.inr-input-words-label')).toHaveText('Amount (in words)');
    const a = await input(page).boundingBox();
    const b = await words(page).boundingBox();
    expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  });

  test('updates words live per keystroke using Indian numbering', async ({ page }) => {
    await input(page).pressSequentially('123456.5');
    await expect(words(page)).toHaveValue('Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only');
    await input(page).fill('');
    await input(page).pressSequentially('25000000');
    await expect(words(page)).toHaveValue('Rupees Two Crore Fifty Lakh Only');
    await input(page).fill('0.05');
    await expect(words(page)).toHaveValue('Five Paise Only');
    await input(page).fill('');
    await expect(words(page)).toHaveValue('');
  });

  test('rejects non numeric characters and limits paise to two digits', async ({ page }) => {
    await input(page).pressSequentially('1a2,3.456');
    await expect(input(page)).toHaveValue('123.45');
  });

  test('reflects a model value set by a rule or prefill', async ({ page }) => {
    await setModel(page, FIELD, 'value', '1000');
    await expect(words(page)).toHaveValue('Rupees One Thousand Only');
  });

  test('commits model value once on blur', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await input(page).pressSequentially('4500');
    await page.keyboard.press('Tab');
    await expect.poll(() => getModel(page, FIELD)).toEqual('4500');
    expect(await changes()).toBe(1);
    await expect(words(page)).toHaveValue('Rupees Four Thousand Five Hundred Only');
  });
});
