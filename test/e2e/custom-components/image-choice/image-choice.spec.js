import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('image-choice');
const FIELD = 'field-under-test';
const tile = (page, name) => field(page, FIELD).getByRole('checkbox', { name, exact: true });
const withProps = (props) => {
  const copy = JSON.parse(JSON.stringify(formDef));
  Object.assign(copy.items[0].properties, props);
  return copy;
};

test.describe('image-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders one image tile per option with label as alt', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.image-choice-tile')).toHaveCount(3);
    await expect(wrapper.locator('.image-choice-tile img').nth(1)).toHaveAttribute('alt', 'Option B');
    await expect(wrapper.locator('.image-choice-tile img').nth(1)).toHaveAttribute('src', '/b.svg');
    await expect(tile(page, 'Option C')).toHaveCount(1);
  });

  test('multiple mode toggles tiles and commits one change per click', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await tile(page, 'Option A').check({ force: true });
    await tile(page, 'Option B').check({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'b']);
    await expect(field(page, FIELD).locator('.image-choice-tile.selected')).toHaveCount(2);
    await tile(page, 'Option A').uncheck({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    expect(await changes()).toBe(3);
  });

  test('single mode replaces the selection and keeps the selected tile', async ({ page, formServer }) => {
    await renderForm(page, formServer, withProps({ selectionMode: 'single' }));
    await tile(page, 'Option A').check({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
    await tile(page, 'Option B').check({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    await expect(tile(page, 'Option A')).not.toBeChecked();
    await tile(page, 'Option B').click({ force: true });
    await expect(tile(page, 'Option B')).toBeChecked();
    expect(await getModel(page, FIELD)).toEqual(['b']);
    await expect(field(page, FIELD).locator('.image-choice-tile.selected')).toHaveCount(1);
  });

  test('reflects model value set externally', async ({ page }) => {
    await setModel(page, FIELD, 'value', ['b', 'c']);
    await expect(tile(page, 'Option B')).toBeChecked();
    await expect(tile(page, 'Option C')).toBeChecked();
    await expect(tile(page, 'Option A')).not.toBeChecked();
    await expect(field(page, FIELD).locator('.image-choice-tile.selected')).toHaveCount(2);
    await setModel(page, FIELD, 'value', ['a']);
    await expect(tile(page, 'Option B')).not.toBeChecked();
    await expect(field(page, FIELD).locator('.image-choice-tile.selected')).toHaveCount(1);
  });

  test('is keyboard operable', async ({ page }) => {
    await tile(page, 'Option A').focus();
    await page.keyboard.press('Space');
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'b']);
  });

  test('single mode keyboard selection replaces', async ({ page, formServer }) => {
    await renderForm(page, formServer, withProps({ selectionMode: 'single' }));
    await tile(page, 'Option A').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
  });
});
