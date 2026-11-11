import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('live-amount-input');
const FIELD = 'field-under-test';
const referenceWords = 'Rupees Twelve Thousand Three Hundred Forty Five and Sixty Seven Paise Only';
const amount = (page) => field(page, FIELD).locator('.live-amount-input-value');
const words = (page) => field(page, FIELD).locator('.live-amount-input-words');

test.describe('live-amount-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders the reference styling and read-only prefilled words', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper).toBeVisible();
    await expect(wrapper.locator('h3')).toHaveText('live-amount-input');
    await expect(wrapper.locator('h3')).toHaveCSS('color', 'rgb(12, 18, 34)');
    await expect(wrapper.locator('.live-amount-input-currency')).toHaveText('\u20b9');
    await expect(amount(page)).toHaveValue('12,345.67');
    await expect(words(page)).toHaveValue(referenceWords);
    await expect(words(page)).toHaveAttribute('readonly', '');
    await expect(words(page)).not.toHaveAttribute('name');
    await expect(wrapper.locator('.live-amount-input-note')).toHaveText('Read-only');
    await expect(wrapper.locator('.live-amount-input-entry')).toHaveCSS('border-radius', '12px');
  });

  test('applies authored heading and words label', async ({ page, formServer }) => {
    const customized = structuredClone(formDef);
    customized.items[0].properties = { heading: 'Transfer amount', wordsLabel: 'In words' };
    await renderForm(page, formServer, customized);
    await expect(field(page, FIELD).locator('h3')).toHaveText('Transfer amount');
    await expect(page.getByLabel('In words', { exact: true })).toHaveValue(referenceWords);
  });

  test('reflects programmatic values and a form reset', async ({ page }) => {
    await setModel(page, FIELD, 'value', '1,00,000.05');
    await expect(amount(page)).toHaveValue('1,00,000.05');
    await expect(words(page)).toHaveValue('Rupees One Lakh and Five Paise Only');
    await setModel(page, FIELD, 'value', null);
    await expect(words(page)).toHaveValue('');
    await page.evaluate(() => window.myForm.reset());
    await expect(amount(page)).toHaveValue('12,345.67');
    await expect(words(page)).toHaveValue(referenceWords);
  });

  test('updates words, model and a dependent rule on every keystroke before blur', async ({ page }) => {
    await amount(page).fill('');
    const changes = await trackChanges(page, FIELD);
    let text = '';
    for (const character of '12345.67') {
      await amount(page).pressSequentially(character);
      text += character;
      await expect(amount(page)).toBeFocused();
      await expect.poll(() => getModel(page, FIELD)).toBe(text);
      await expect(field(page, 'next-field').locator('input')).toHaveValue(text);
      await expect(words(page)).not.toHaveValue('');
    }
    await expect(words(page)).toHaveValue(referenceWords);
    expect(await changes()).toBe(8);
    await amount(page).press('Tab');
    expect(await changes()).toBe(8);
  });

  test('preserves partial decimals and caret position during rapid editing', async ({ page }) => {
    await amount(page).fill('');
    await amount(page).pressSequentially('12345678.90');
    await expect(amount(page)).toHaveValue('12345678.90');
    await expect.poll(() => getModel(page, FIELD)).toBe('12345678.90');
    await amount(page).fill('12.');
    await expect(words(page)).toHaveValue('Rupees Twelve Only');
    await amount(page).press('Home');
    await amount(page).press('ArrowRight');
    await amount(page).pressSequentially('3');
    await expect(amount(page)).toHaveValue('132.');
    expect(await amount(page).evaluate((input) => input.selectionStart)).toBe(2);
    await expect(words(page)).toHaveValue('Rupees One Hundred Thirty Two Only');
  });

  test('shows errors instead of stale words for invalid amounts and recovers', async ({ page }) => {
    const error = field(page, FIELD).locator('.live-amount-input-error');
    for (const invalid of ['-1', '1.234', 'abc', '1000000000', '1,00']) {
      await amount(page).fill(invalid);
      await expect(words(page)).toHaveValue('');
      await expect(error).toBeVisible();
      await expect(amount(page)).toHaveAttribute('aria-invalid', 'true');
      expect(await amount(page).evaluate((input) => input.validity.valid)).toBe(false);
      expect(await getModel(page, FIELD, 'valid')).toBe(false);
    }
    await amount(page).fill('0.01');
    await expect(error).toBeHidden();
    await expect(words(page)).toHaveValue('Rupees Zero and One Paise Only');
    expect(await amount(page).evaluate((input) => input.validity.valid)).toBe(true);
  });

  test('clears with the keyboard and keeps the words selectable but non-editable', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await words(page).focus();
    await words(page).pressSequentially('99');
    await expect(words(page)).toHaveValue(referenceWords);
    expect(await getModel(page, FIELD)).toBe('12,345.67');
    await amount(page).focus();
    await amount(page).press('Tab');
    await expect(page.getByRole('button', { name: 'Clear amount' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(amount(page)).toBeFocused();
    await expect(amount(page)).toHaveValue('');
    await expect(words(page)).toHaveValue('');
    expect(await getModel(page, FIELD)).toBe('');
    expect(await changes()).toBe(1);
    await amount(page).press('Tab');
    await expect(words(page)).toBeFocused();
    await words(page).press('Tab');
    await expect(field(page, 'next-field').locator('input')).toBeFocused();
  });

  test('honors disabled and read-only model states', async ({ page }) => {
    const clear = page.getByRole('button', { name: 'Clear amount' });
    await setModel(page, FIELD, 'enabled', false);
    await expect(amount(page)).toBeDisabled();
    await expect(clear).toBeDisabled();
    await setModel(page, FIELD, 'enabled', true);
    await setModel(page, FIELD, 'readOnly', true);
    await expect(amount(page)).not.toBeEditable();
    await expect(clear).toBeDisabled();
    await setModel(page, FIELD, 'readOnly', false);
    await expect(clear).toBeEnabled();
    await amount(page).fill('42');
    await expect(words(page)).toHaveValue('Rupees Forty Two Only');
  });

  test('can unlock an initially read-only amount without enabling a disabled field', async ({ page, formServer }) => {
    const locked = structuredClone(formDef);
    locked.items[0].readOnly = true;
    await renderForm(page, formServer, locked);
    await expect(amount(page)).not.toBeEditable();
    await setModel(page, FIELD, 'enabled', false);
    await setModel(page, FIELD, 'readOnly', false);
    await expect(amount(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear amount' })).toBeDisabled();
    await setModel(page, FIELD, 'enabled', true);
    await expect(amount(page)).toBeEditable();
    await amount(page).fill('5.50');
    await expect(words(page)).toHaveValue('Rupees Five and Fifty Paise Only');
  });

  test('fits a narrow screen without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(words(page)).toBeVisible();
    const fits = await field(page, FIELD).evaluate((element) => {
      const { left, right } = element.getBoundingClientRect();
      return left >= 0 && right <= window.innerWidth && element.scrollWidth <= element.clientWidth;
    });
    expect(fits).toBe(true);
    expect(await amount(page).evaluate((input) => input.scrollWidth <= input.clientWidth)).toBe(true);
  });
});
