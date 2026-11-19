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

test.describe('image-choice custom component', () => {
  test.describe('Single selection (default)', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('renders images for options and a text fallback without one', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
      await expect(wrapper).toHaveClass(/image-choice-single/);
      await expect(wrapper.locator('label img.image-choice-picture')).toHaveCount(2);
      await expect(wrapper.locator('.image-choice-noimage')).toHaveText('Option C');
      await expect(wrapper.locator('label').first()).toHaveAttribute('title', 'Option A');
    });

    test('model value shows as selected', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['b']);
      await expect(field(page, FIELD).locator('input[value="b"]')).toBeChecked();
      await expect(field(page, FIELD).locator('input[value="a"]')).not.toBeChecked();
    });

    test('selecting another image replaces the selection with one change', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await wrapper.locator('label').nth(0).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      const changes = await trackChanges(page, FIELD);
      await wrapper.locator('label').nth(1).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
      await expect(wrapper.locator('input[value="a"]')).not.toBeChecked();
      expect(await changes()).toBe(1);
    });

    test('clicking the selected image clears it', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await wrapper.locator('label').nth(0).click();
      await wrapper.locator('label').nth(0).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual([]);
    });

    test('keyboard Space selects the focused image', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await wrapper.locator('input[value="a"]').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    });
  });

  test.describe('Multiple selection', () => {
    test('allows several images and applies columns', async ({ page, formServer }) => {
      await renderForm(page, formServer, withProps({ selectionMode: 'multiple', columns: 2 }));
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveClass(/image-choice/);
      await expect(wrapper).not.toHaveClass(/image-choice-single/);
      await expect(wrapper).toHaveCSS('--image-choice-columns', '2');
      await wrapper.locator('label').nth(0).click();
      await wrapper.locator('label').nth(1).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'b']);
      await wrapper.locator('label').nth(0).click();
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    });
  });
});
