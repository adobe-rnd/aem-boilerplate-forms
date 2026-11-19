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

const option = (page, index) => field(page, FIELD).locator('.image-choice-option').nth(index);

test.describe('image-choice custom component', () => {
  test.describe('single selection (default)', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, formDef);
    });

    test('decorates options with images', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
      await expect(wrapper).toHaveClass(/image-choice-single/);
      await expect(wrapper.locator('.image-choice-option')).toHaveCount(3);
      await expect(wrapper.locator('.image-choice-option img')).toHaveCount(3);
      await expect(option(page, 0).locator('img')).toHaveAttribute('alt', 'Option A');
    });

    test('hides captions unless showLabels is set', async ({ page }) => {
      await expect(option(page, 0).locator('.image-choice-caption')).toHaveClass(/image-choice-sr-only/);
    });

    test('only one image stays selected and the model follows', async ({ page }) => {
      const changes = await trackChanges(page, FIELD);
      await option(page, 0).locator('input').click({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
      await option(page, 2).locator('input').click({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
      await expect(option(page, 0).locator('input')).not.toBeChecked();
      expect(await changes()).toBe(2);
    });

    test('reflects a model value set by a rule', async ({ page }) => {
      await setModel(page, FIELD, 'value', ['b']);
      await expect(option(page, 1).locator('input')).toBeChecked();
      await expect(option(page, 0).locator('input')).not.toBeChecked();
    });

    test('is keyboard operable', async ({ page }) => {
      await option(page, 1).locator('input').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="nextField"], #next-field')).toBeFocused();
    });
  });

  test.describe('multiple selection', () => {
    test.beforeEach(async ({ page, formServer }) => {
      await renderForm(page, formServer, withProps({ selectionMode: 'multiple', showLabels: true, columns: 2 }));
    });

    test('allows several images and shows captions', async ({ page }) => {
      const wrapper = field(page, FIELD);
      await expect(wrapper).toHaveClass(/image-choice-multiple/);
      await expect(option(page, 0).locator('.image-choice-caption')).not.toHaveClass(/image-choice-sr-only/);
      await expect(option(page, 0).locator('.image-choice-caption')).toHaveText('Option A');
      expect(await wrapper.evaluate((el) => el.style.getPropertyValue('--image-choice-columns'))).toBe('2');
      await option(page, 0).locator('input').click({ force: true });
      await option(page, 2).locator('input').click({ force: true });
      await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'c']);
    });
  });

  test('re-applies images when the options change', async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
    await setModel(page, FIELD, 'enum', ['a', 'b', 'c', 'd']);
    await setModel(page, FIELD, 'enumNames', ['A', 'B', 'C', 'D']);
    await expect(field(page, FIELD).locator('.image-choice-option')).toHaveCount(4);
    await expect(field(page, FIELD).locator('.image-choice-option img')).toHaveCount(3);
  });
});
