import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('image-choice');
const FIELD = 'field-under-test';

function withProps(props) {
  const def = structuredClone(formDef);
  Object.assign(def.items[0].properties, props);
  return def;
}

const options = (page) => field(page, FIELD).locator('.image-choice-option');
const optionLabel = (page, index) => options(page).nth(index).locator('label');
const checkedValues = (page) => field(page, FIELD).locator('input:checked')
  .evaluateAll((inputs) => inputs.map((i) => i.value));

test.describe('image-choice custom component', () => {
  test.describe('single mode', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('decorates options with images', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
      await expect(wrapper).toHaveClass(/image-choice-single/);
      await expect(options(page)).toHaveCount(3);
      await expect(wrapper.locator('.image-choice-image')).toHaveCount(3);
      await expect(wrapper.locator('.image-choice-image').first()).toHaveAttribute('alt', 'Option A');
      const box = await wrapper.locator('.image-choice-text').first().boundingBox();
      expect(box.width).toBeLessThanOrEqual(1);
    });

    test('selecting an image replaces the previous selection with one model change each', async ({ page }) => {
      const changes = await trackChanges(page, FIELD);
      await optionLabel(page, 0).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      await optionLabel(page, 1).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
      expect(await checkedValues(page)).toEqual(['b']);
      expect(await changes()).toBe(2);
    });

    test('clicking the selected image clears it', async ({ page }) => {
      await optionLabel(page, 2).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
      await optionLabel(page, 2).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual([]);
    });

    test('reflects a model value', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['b']);
      await expect.poll(() => checkedValues(page)).toEqual(['b']);
      await expect(options(page).nth(1).locator('input')).toBeChecked();
    });

    test('is operable with the keyboard', async ({ page }) => {
      await optionLabel(page, 0).click();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    });
  });

  test.describe('multi mode', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, withProps({ selectionMode: 'multi' }));
    });

    test('allows several selections', async ({ page }) => {
      await expect(field(page, FIELD)).toHaveClass(/image-choice-multi/);
      await optionLabel(page, 0).click();
      await optionLabel(page, 2).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'c']);
      expect(await checkedValues(page)).toEqual(['a', 'c']);
    });
  });

  test.describe('authored properties', () => {
    test('columns and showLabels', async ({ page, formServer }) => {
      await renderForm(page, formServer, withProps({ columns: 2, showLabels: true }));
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveClass(/image-choice-show-labels/);
      await expect(wrapper.locator('.image-choice-text').first()).toBeVisible();
      const tops = await options(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
      expect(tops[1]).toBe(tops[0]);
      expect(tops[2]).toBeGreaterThan(tops[0]);
    });
  });
});
