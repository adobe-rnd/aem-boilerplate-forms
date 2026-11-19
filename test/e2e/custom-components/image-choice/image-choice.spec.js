import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('image-choice');
const FIELD = 'field-under-test';

const withProps = (props) => {
  const copy = structuredClone(formDef);
  Object.assign(copy.items[0].properties, props);
  return copy;
};

const option = (page, i) => field(page, FIELD).locator('input[type="checkbox"]').nth(i);
const optionLabel = (page, i) => field(page, FIELD).locator('.checkbox-wrapper').nth(i);

test.describe('image-choice custom component', () => {
  test.describe('single selection', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('decorates options with images', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
      await expect(wrapper).toHaveClass(/image-choice/);
      await expect(wrapper.locator('img.image-choice-image')).toHaveCount(2);
      await expect(wrapper.locator('input[type="checkbox"]')).toHaveCount(3);
      await expect(wrapper.locator('.image-choice-label').nth(0)).toHaveText('Option A');
    });

    test('selecting an option replaces the previous one with a single change', async ({ page }) => {
      await optionLabel(page, 0).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      const changes = await trackChanges(page, FIELD);
      await optionLabel(page, 1).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
      await expect(option(page, 0)).not.toBeChecked();
      await expect(option(page, 1)).toBeChecked();
      expect(await changes()).toBe(1);
    });

    test('clicking the selected option deselects it', async ({ page }) => {
      await optionLabel(page, 2).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
      await optionLabel(page, 2).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual([]);
    });

    test('reflects a model value in the UI', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['b']);
      await expect(option(page, 1)).toBeChecked();
      await expect(option(page, 0)).not.toBeChecked();
    });

    test('works with the keyboard', async ({ page }) => {
      await option(page, 0).focus();
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    });
  });

  test.describe('multiple selection', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, withProps({ selectionMode: 'multiple' }));
    });

    test('allows several options', async ({ page }) => {
      await optionLabel(page, 0).click();
      await optionLabel(page, 2).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'c']);
      await optionLabel(page, 0).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
    });
  });

  test('applies columns and showLabels', async ({ page, formServer }) => {
    await renderForm(page, formServer, withProps({ columns: 2, showLabels: true }));
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveClass(/show-labels/);
    await expect(wrapper).toHaveCSS('--image-choice-columns', '2');
    await expect(wrapper.locator('.image-choice-label').first()).toBeVisible();
  });
});
