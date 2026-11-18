import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('nps-rating');
const FIELD = 'field-under-test';
const score = (page, value) => field(page, FIELD).getByRole('radio', { name: String(value), exact: true });

test.describe('nps-rating custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders the reference scale, selected score, and proportional legend', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.getByRole('radiogroup')).toHaveAccessibleName(formDef.items[0].label.value);
    await expect(wrapper.getByRole('radio')).toHaveCount(11);
    await expect(wrapper.locator('input')).toBeHidden();
    await expect(score(page, 9)).toHaveAttribute('aria-checked', 'true');
    await expect(score(page, 9)).toHaveCSS('background-color', 'rgb(37, 183, 131)');
    await expect(wrapper.locator('.nps-rating-segment')).toHaveText(['Not likely', 'May be', 'Very likely']);
    const spans = await wrapper.locator('.nps-rating-segment').evaluateAll((segments) => (
      segments.map((segment) => segment.style.gridColumn)
    ));
    expect(spans).toEqual(['span 7', 'span 2', 'span 2']);
  });

  test('applies all authored thresholds, labels, and colors', async ({ page, formServer }) => {
    const definition = structuredClone(formDef);
    definition.items[0].properties = {
      lowMax: 3,
      middleMax: 7,
      lowLabel: 'Unlikely',
      middleLabel: 'Neutral',
      highLabel: 'Likely',
      lowColor: '#990000',
      middleColor: '#996600',
      highColor: '#006633',
    };
    await renderForm(page, formServer, definition);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.nps-rating-segment')).toHaveText(['Unlikely', 'Neutral', 'Likely']);
    for (const [value, color, caption] of [
      [3, 'rgb(153, 0, 0)', 'Unlikely'],
      [4, 'rgb(153, 102, 0)', 'Neutral'],
      [8, 'rgb(0, 102, 51)', 'Likely'],
    ]) {
      await score(page, value).click();
      await expect(score(page, value)).toHaveCSS('background-color', color);
      await expect(score(page, value)).toHaveAccessibleDescription(caption);
    }
    const segments = wrapper.locator('.nps-rating-segment');
    await expect(segments.nth(0)).toHaveCSS('border-top-color', 'rgb(153, 0, 0)');
    await expect(segments.nth(1)).toHaveCSS('border-top-color', 'rgb(153, 102, 0)');
    await expect(segments.nth(2)).toHaveCSS('border-top-color', 'rgb(0, 102, 51)');
  });

  test('uses default properties and leaves an unanswered field unselected', async ({ page, formServer }) => {
    const definition = structuredClone(formDef);
    delete definition.items[0].default;
    delete definition.items[0].properties;
    await renderForm(page, formServer, definition);
    await expect(field(page, FIELD).locator('[aria-checked="true"]')).toHaveCount(0);
    await expect(score(page, 0)).toHaveAttribute('tabindex', '0');
    await expect(field(page, FIELD).locator('.nps-rating-segment')).toHaveText(['Not likely', 'May be', 'Very likely']);
  });

  test('reflects model selection, zero, and clearing without feedback commits', async ({ page }) => {
    await setModel(page, FIELD, 'value', 5);
    await expect(score(page, 5)).toHaveAttribute('aria-checked', 'true');
    await setModel(page, FIELD, 'value', 0);
    await expect(score(page, 0)).toHaveAttribute('aria-checked', 'true');
    await setModel(page, FIELD, 'value', null);
    await expect(field(page, FIELD).locator('[aria-checked="true"]')).toHaveCount(0);
    expect(await getModel(page, FIELD)).toBeNull();
    await setModel(page, FIELD, 'value', 11);
    await expect(field(page, FIELD).locator('[aria-checked="true"]')).toHaveCount(0);
    await expect(score(page, 0)).toHaveAttribute('tabindex', '0');
  });

  test('commits each new score exactly once and does not recommit on blur or reselection', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await score(page, 7).click();
    await expect.poll(() => getModel(page, FIELD)).toBe(7);
    await expect.poll(changes).toBe(1);
    await score(page, 7).click();
    await page.locator('#next-field').focus();
    expect(await changes()).toBe(1);
    await score(page, 0).click();
    await expect.poll(() => getModel(page, FIELD)).toBe(0);
    await expect.poll(changes).toBe(2);
  });

  test('supports a single tab stop, arrows, Home/End, Space, and Enter', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(score(page, 9)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(score(page, 8)).toBeFocused();
    await expect.poll(() => getModel(page, FIELD)).toBe(8);
    await page.keyboard.press('Home');
    await expect.poll(() => getModel(page, FIELD)).toBe(0);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => getModel(page, FIELD)).toBe(10);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => getModel(page, FIELD)).toBe(0);
    await page.keyboard.press('End');
    await expect.poll(() => getModel(page, FIELD)).toBe(10);
    await score(page, 4).focus();
    await page.keyboard.press('Space');
    await expect.poll(() => getModel(page, FIELD)).toBe(4);
    await score(page, 6).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => getModel(page, FIELD)).toBe(6);
    await page.keyboard.press('Tab');
    await expect(page.locator('#next-field')).toBeFocused();
  });

  for (const [property, value] of [['enabled', false], ['readOnly', true]]) {
    test(`honors initial and changing ${property} state`, async ({ page, formServer }) => {
      const definition = structuredClone(formDef);
      definition.items[0][property] = value;
      await renderForm(page, formServer, definition);
      await expect(score(page, 9)).toBeDisabled();
      await setModel(page, FIELD, property, !value);
      await expect(score(page, 9)).toBeEnabled();
      await score(page, 3).click();
      await expect.poll(() => getModel(page, FIELD)).toBe(3);
      await setModel(page, FIELD, property, value);
      await expect(score(page, 3)).toBeDisabled();
      await score(page, 5).evaluate((button) => button.click());
      expect(await getModel(page, FIELD)).toBe(3);
    });
  }

  test('reflects required validation and visibility changes', async ({ page }) => {
    await setModel(page, FIELD, 'required', true);
    await expect(field(page, FIELD).getByRole('radiogroup')).toHaveAttribute('aria-required', 'true');
    await setModel(page, FIELD, 'value', null);
    await expect.poll(() => getModel(page, FIELD, 'valid')).toBe(false);
    await expect(field(page, FIELD).getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
    await score(page, 2).click();
    await expect.poll(() => getModel(page, FIELD, 'valid')).toBe(true);
    await expect(field(page, FIELD).getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'false');
    await setModel(page, FIELD, 'visible', false);
    await expect(field(page, FIELD)).toBeHidden();
    await setModel(page, FIELD, 'visible', true);
    await expect(field(page, FIELD)).toBeVisible();
  });

  test('keeps all score targets inside a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const buttons = field(page, FIELD).getByRole('radio');
    const first = await buttons.first().boundingBox();
    const last = await buttons.last().boundingBox();
    expect(first.x).toBeGreaterThanOrEqual(0);
    expect(last.x + last.width).toBeLessThanOrEqual(375);
    await score(page, 10).click();
    await expect.poll(() => getModel(page, FIELD)).toBe(10);
  });
});
