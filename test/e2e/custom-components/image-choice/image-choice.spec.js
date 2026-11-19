import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('image-choice');
const FIELD = 'field-under-test';

const variant = (props) => {
  const copy = structuredClone(formDef);
  Object.assign(copy.items[0].properties, props);
  return copy;
};

test.describe('image-choice custom component', () => {
  test.describe('single selection', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('renders one image tile per option', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
      await expect(wrapper).toHaveClass(/image-choice/);
      await expect(wrapper.locator('.image-choice-option')).toHaveCount(3);
      await expect(wrapper.locator('.image-choice-option img.image-choice-image')).toHaveCount(3);
      await expect(wrapper).toHaveAttribute('role', 'radiogroup');
    });

    test('hides labels visually by default and keeps them accessible', async ({ page }) => {
      const text = field(page, FIELD).locator('.image-choice-text').first();
      await expect(text).toHaveText('Option A');
      expect((await text.boundingBox()).width).toBeLessThanOrEqual(1);
    });

    test('reflects a model value in the checked state', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['b']);
      await expect(field(page, FIELD).locator('input').nth(1)).toBeChecked();
      await expect(field(page, FIELD).locator('input').nth(0)).not.toBeChecked();
    });

    test('selecting another tile replaces the selection with a single change', async ({ page }) => {
      const inputs = field(page, FIELD).locator('input');
      await inputs.nth(0).check({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      const changes = await trackChanges(page, FIELD);
      await inputs.nth(2).check({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
      await expect(inputs.nth(0)).not.toBeChecked();
      expect(await changes()).toBe(1);
    });

    test('trims a multi-value set by a rule to the first value', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['b', 'c']);
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
      await expect(field(page, FIELD).locator('input').nth(2)).not.toBeChecked();
    });

    test('works with the keyboard', async ({ page }) => {
      const inputs = field(page, FIELD).locator('input');
      await inputs.nth(0).focus();
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    });
  });

  test.describe('multiple selection', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, variant({ selectionMode: 'multi', showLabels: true, columns: 2 }));
    });

    test('allows several selections and applies columns and labels', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).not.toHaveAttribute('role', 'radiogroup');
      await expect(wrapper).toHaveClass(/image-choice-labels/);
      expect(await wrapper.evaluate((el) => el.style.getPropertyValue('--image-choice-columns'))).toBe('2');
      const inputs = wrapper.locator('input');
      await inputs.nth(0).check({ force: true });
      await inputs.nth(2).check({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'c']);
      await inputs.nth(0).uncheck({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
    });

    test('keeps multiple values set by a rule', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['a', 'b']);
      await expect(field(page, FIELD).locator('input').nth(0)).toBeChecked();
      await expect(field(page, FIELD).locator('input').nth(1)).toBeChecked();
    });
  });
});
