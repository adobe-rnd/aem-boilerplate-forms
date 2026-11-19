import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('image-choice');
const FIELD = 'field-under-test';

const withProps = (props) => {
  const def = JSON.parse(JSON.stringify(formDef));
  Object.assign(def.items[0].properties, props);
  return def;
};

test.describe('image-choice custom component', () => {
  test.describe('single selection (default)', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('renders an image per option when one is authored', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
      await expect(wrapper).toHaveClass(/image-choice-single/);
      await expect(wrapper.locator('.image-choice-item')).toHaveCount(3);
      await expect(wrapper.locator('.image-choice-item img')).toHaveCount(2);
      await expect(wrapper.locator('.image-choice-label').first()).toHaveClass(/image-choice-sr-only/);
    });

    test('reflects a model value in the checked state', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['b']);
      await expect(field(page, FIELD).locator('input').nth(1)).toBeChecked();
      await expect(field(page, FIELD).locator('input').nth(0)).not.toBeChecked();
    });

    test('selecting another image replaces the selection with one change', async ({ page }) => {
      const inputs = field(page, FIELD).locator('input');
      await inputs.nth(0).check({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      const changes = await trackChanges(page, FIELD);
      await inputs.nth(2).check({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
      await expect(inputs.nth(0)).not.toBeChecked();
      expect(await changes()).toBe(1);
    });

    test('clicking the selected image clears it', async ({ page }) => {
      const input = field(page, FIELD).locator('input').nth(0);
      await input.check({ force: true });
      await input.uncheck({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual([]);
    });

    test('is operable with the keyboard', async ({ page }) => {
      await field(page, FIELD).locator('input').nth(1).focus();
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    });
  });

  test.describe('multiple selection', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, withProps({ selectionMode: 'multi', showLabels: true, columns: 2 }));
    });

    test('keeps several selections', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).not.toHaveClass(/image-choice-single/);
      await wrapper.locator('input').nth(0).check({ force: true });
      await wrapper.locator('input').nth(2).check({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'c']);
    });

    test('applies columns and shows labels', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveCSS('--image-choice-columns', '2');
      await expect(wrapper.locator('.image-choice-label').first()).not.toHaveClass(/image-choice-sr-only/);
    });
  });

  test('re-decorates options when the enum changes', async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
    await setModel(page, FIELD, 'enum', ['x', 'y']);
    await setModel(page, FIELD, 'enumNames', ['X', 'Y']);
    await expect(field(page, FIELD).locator('.image-choice-item')).toHaveCount(2);
    await expect(field(page, FIELD).locator('.image-choice-label').first()).toHaveText('X');
  });
});
