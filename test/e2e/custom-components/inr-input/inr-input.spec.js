import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('inr-input');
const FIELD = 'field-under-test';
const words = (page) => field(page, FIELD).locator('.inr-input-words');
const amount = (page) => field(page, FIELD).locator('input:not(.inr-input-words)');

test.describe('inr-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('decorates the field with a rupee symbol and read-only words field', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.inr-input-symbol')).toHaveText('₹');
    await expect(words(page)).toHaveJSProperty('readOnly', true);
    await expect(words(page)).toHaveValue('');
  });

  test('applies the authored words label', async ({ page, formServer }) => {
    await expect(field(page, FIELD).locator('.inr-input-words-label')).toHaveText('Amount (in words)');
    const def = JSON.parse(JSON.stringify(formDef));
    def.items[0].properties.wordsLabel = 'In words';
    await renderForm(page, formServer, def);
    await expect(field(page, FIELD).locator('.inr-input-words-label')).toHaveText('In words');
  });

  test('reflects a model value in the words field', async ({ page }) => {
    await setModel(page, FIELD, 'value', '1250000.5');
    await expect(amount(page)).toHaveValue('1250000.5');
    await expect(words(page)).toHaveValue('Twelve Lakh Fifty Thousand Rupees and Fifty Paise Only');
  });

  test('updates words live while typing and commits the model per keystroke', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await amount(page).pressSequentially('1,23a4');
    await expect(amount(page)).toHaveValue('1234');
    await expect(words(page)).toHaveValue('One Thousand Two Hundred Thirty Four Rupees Only');
    await expect.poll(() => getModel(page, FIELD)).toEqual('1234');
    expect(await changes()).toBe(4);
    await amount(page).fill('');
    await expect(words(page)).toHaveValue('');
  });

  test('keeps at most two decimals', async ({ page }) => {
    await amount(page).pressSequentially('10.256');
    await expect(amount(page)).toHaveValue('10.25');
    await expect(words(page)).toHaveValue('Ten Rupees and Twenty Five Paise Only');
  });
});
