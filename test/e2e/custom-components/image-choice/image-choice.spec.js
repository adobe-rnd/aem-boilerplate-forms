import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('image-choice');
const FIELD = 'field-under-test';

const withMode = (mode) => {
  const copy = JSON.parse(JSON.stringify(formDef));
  copy.items[0].properties.selectionMode = mode;
  return copy;
};
const tile = (page, i) => field(page, FIELD).locator('input[type="checkbox"]').nth(i);

test.describe('image-choice custom component (multiple)', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders one image tile per option with label as alt', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.image-choice-tile')).toHaveCount(3);
    await expect(wrapper.locator('img').nth(1)).toHaveAttribute('src', 'b.png');
    await expect(wrapper.locator('img').nth(1)).toHaveAttribute('alt', 'Option B');
    await expect(wrapper.getByRole('checkbox', { name: 'Option C' })).toHaveCount(1);
  });

  test('model value highlights tiles', async ({ page }) => {
    await setModel(page, FIELD, 'value', ['b', 'c']);
    await expect(tile(page, 0)).not.toBeChecked();
    await expect(tile(page, 1)).toBeChecked();
    await expect(tile(page, 2)).toBeChecked();
  });

  test('clicking toggles and commits once per click', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    await tile(page, 0).click({ force: true });
    await tile(page, 2).click({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a', 'c']);
    await tile(page, 0).click({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['c']);
    expect(await changes()).toBe(3);
  });

  test('keyboard: Tab focuses, Space toggles', async ({ page }) => {
    await tile(page, 0).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    await expect(tile(page, 1)).toBeChecked();
  });
});

test.describe('image-choice custom component (single)', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, withMode('single'));
  });

  test('selecting replaces; clicking selected keeps it', async ({ page }) => {
    await tile(page, 0).click({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['a']);
    await tile(page, 1).click({ force: true });
    await expect.poll(() => getModel(page, FIELD)).toEqual(['b']);
    await expect(tile(page, 0)).not.toBeChecked();
    await tile(page, 1).click({ force: true });
    await expect(tile(page, 1)).toBeChecked();
    expect(await getModel(page, FIELD)).toEqual(['b']);
  });

  test('external value updates the tile', async ({ page }) => {
    await setModel(page, FIELD, 'value', ['c']);
    await expect(tile(page, 2)).toBeChecked();
    await setModel(page, FIELD, 'value', ['a']);
    await expect(tile(page, 0)).toBeChecked();
    await expect(tile(page, 2)).not.toBeChecked();
  });
});
