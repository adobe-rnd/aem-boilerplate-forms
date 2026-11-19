import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('image-choice');
const FIELD = 'field-under-test';

const withProps = (props) => {
  const copy = JSON.parse(JSON.stringify(formDef));
  Object.assign(copy.items[0].properties, props);
  return copy;
};
const option = (page, index) => field(page, FIELD).locator('.image-choice-option').nth(index);
const box = (page, index) => option(page, index).locator('input');

test.describe('image-choice custom component', () => {
  test('decorates options with images and hides labels by default', async ({ page, formServer }) => {
    await renderForm(page, formServer, withProps({ showLabels: false }));
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper).toHaveClass(/image-choice/);
    await expect(wrapper.locator('.image-choice-option')).toHaveCount(3);
    await expect(wrapper.locator('.image-choice-image')).toHaveCount(3);
    await expect(wrapper.locator('.image-choice-image').nth(1)).toHaveAttribute('alt', 'Option B');
    await expect(wrapper.locator('.image-choice-label').first()).toHaveClass(/visually-hidden/);
  });

  test('applies authored properties', async ({ page, formServer }) => {
    await renderForm(page, formServer, withProps({ showLabels: true, imageSize: 'large', selectionMode: 'multiple' }));
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveClass(/image-choice-large/);
    await expect(wrapper).toHaveAttribute('data-selection-mode', 'multiple');
    await expect(wrapper.locator('.image-choice-label').first()).not.toHaveClass(/visually-hidden/);
  });

  test('reflects a model value set by a rule', async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
    await setModel(page, FIELD, 'value', ['b']);
    await expect(box(page, 1)).toBeChecked();
    await expect(box(page, 0)).not.toBeChecked();
  });

  test('single mode keeps one selection and commits once per click', async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
    const changes = await trackChanges(page, FIELD);
    await box(page, 0).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
    await box(page, 2).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
    await expect(box(page, 0)).not.toBeChecked();
    expect(await changes()).toBe(2);
  });

  test('multiple mode allows several selections', async ({ page, formServer }) => {
    await renderForm(page, formServer, withProps({ selectionMode: 'multiple' }));
    await box(page, 0).click();
    await box(page, 2).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'c']);
    await box(page, 0).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
  });

  test('is operable with the keyboard', async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
    await box(page, 0).focus();
    await page.keyboard.press('Space');
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
  });

  test('re-decorates options when enum changes', async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
    await setModel(page, FIELD, 'enum', ['a', 'b']);
    await setModel(page, FIELD, 'enumNames', ['Option A', 'Option B']);
    await expect(field(page, FIELD).locator('.image-choice-option')).toHaveCount(2);
    await expect(field(page, FIELD).locator('.image-choice-image')).toHaveCount(2);
  });
});
