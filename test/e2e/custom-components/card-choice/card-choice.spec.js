import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders cards set by a rule, filtered by category tab', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-tab')).toHaveText(['Retail', 'Business']);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(4);
    const first = wrapper.locator('.card-choice-card').first();
    await expect(first.locator('.card-choice-title')).toHaveText('Card 1');
    await expect(first.locator('.card-choice-features li')).toHaveCount(2);
    await expect(first.locator('.card-choice-amount-value')).toHaveText('₹ 15,000/-');
    await wrapper.locator('.card-choice-tab', { hasText: 'Business' }).click();
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(2);
  });

  test('scrolls horizontally with the arrow buttons', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    const track = field(page, FIELD).locator('.card-choice-track');
    await expect(track).toBeVisible();
    expect(await track.evaluate((t) => t.scrollWidth > t.clientWidth)).toBe(true);
    await field(page, FIELD).locator('.card-choice-nav.next').click();
    await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
  });

  test('selecting a card writes it to the model once', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    const wrapper = field(page, FIELD);
    await wrapper.locator('.card-choice-card').nth(1).locator('.card-choice-select').click();
    await expect.poll(async () => JSON.parse(await getModel(page, FIELD)).title).toBe('Card 2');
    await expect(wrapper.locator('.card-choice-card.selected')).toHaveCount(1);
    expect(await changes()).toBe(1);
  });

  test('model value highlights the matching card', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const stored = await wrapper.locator('.card-choice-card').nth(2).evaluate((li) => JSON.stringify(li.cardData));
    await setModel(page, FIELD, 'value', stored);
    await expect(wrapper.locator('.card-choice-card').nth(2)).toHaveClass(/selected/);
  });
});
