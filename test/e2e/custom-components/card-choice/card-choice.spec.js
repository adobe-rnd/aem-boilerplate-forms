import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';

const cards = Array.from({ length: 6 }, (_, i) => ({
  id: `c${i}`,
  title: `Card ${i}`,
  subtitle: 'Best Card',
  features: ['Upto 10X CashPoints', 'Joining Fees - ₹500/-'],
  linkText: 'All Features & Benefits',
  minAmount: '₹ 15,000/-',
  category: i < 4 ? 'Retail Cards' : 'Business Cards',
}));

const setCards = (page) => setModel(page, FIELD, 'properties', { cards });

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await renderForm(page, formServer, formDef);
  });

  test('decorates the field and renders cards set by a rule', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(0);
    await setCards(page);
    const rendered = wrapper.locator('.card-choice-card');
    await expect(rendered).toHaveCount(4);
    await expect(rendered.first().locator('.card-choice-title')).toHaveText('Card 0');
    await expect(rendered.first().locator('.card-choice-feature')).toHaveCount(2);
    await expect(rendered.first().locator('.card-choice-amount-value')).toHaveText('₹ 15,000/-');
    await expect(rendered.first().locator('.card-choice-select')).toHaveText('Get This Card');
    await expect(wrapper.locator('.card-choice-category')).toHaveCount(2);
  });

  test('scrolls horizontally with the next arrow', async ({ page }) => {
    await setCards(page);
    const viewport = field(page, FIELD).locator('.card-choice-viewport');
    await expect(field(page, FIELD).locator('.card-choice-next')).toBeVisible();
    await field(page, FIELD).locator('.card-choice-next').click();
    await expect.poll(() => viewport.evaluate((v) => v.scrollLeft)).toBeGreaterThan(0);
    await expect(field(page, FIELD).locator('.card-choice-prev')).toBeVisible();
  });

  test('switching category shows that category cards', async ({ page }) => {
    await setCards(page);
    await field(page, FIELD).locator('.card-choice-category', { hasText: 'Business Cards' }).click();
    await expect(field(page, FIELD).locator('.card-choice-card')).toHaveCount(2);
  });

  test('selecting a card sets the selected card in the model once', async ({ page }) => {
    await setCards(page);
    const changes = await trackChanges(page, FIELD);
    const card = field(page, FIELD).locator('.card-choice-card').nth(1);
    await card.locator('.card-choice-select').click();
    await expect.poll(async () => JSON.parse((await getModel(page, FIELD)) || 'null')?.id).toBe('c1');
    await expect(card).toHaveClass(/selected/);
    expect(await changes()).toBe(1);
  });

  test('reflects a model value set by a rule', async ({ page }) => {
    await setCards(page);
    await setModel(page, FIELD, 'value', JSON.stringify(cards[2]));
    await expect(field(page, FIELD).locator('.card-choice-card').nth(2)).toHaveClass(/selected/);
  });

  test('cards are operable by keyboard', async ({ page }) => {
    await setCards(page);
    await field(page, FIELD).locator('.card-choice-select').first().focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => JSON.parse((await getModel(page, FIELD)) || 'null')?.id).toBe('c0');
  });
});
