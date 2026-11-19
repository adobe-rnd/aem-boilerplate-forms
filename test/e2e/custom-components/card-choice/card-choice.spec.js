import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';

const cards = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
  id: `c${n}`,
  title: `Card ${n}`,
  subtitle: 'Best Card for Rewards & Offers',
  features: ['Upto 10X CashPoints', { text: 'Joining Fees - ₹500/-' }],
  linkText: 'All Features & Benefits',
  linkUrl: 'https://example.com/features',
  minAmountLabel: 'Min. FD Amount',
  minAmount: '₹ 15,000/-',
  category: n > 6 ? 'Business Cards' : 'Retail Cards',
}));

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
    await setModel(page, FIELD, 'properties', { cards });
  });

  test('renders cards with all details and category tabs', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    const visibleCards = wrapper.locator('.card-choice-card:visible');
    await expect(visibleCards).toHaveCount(6);
    const first = visibleCards.first();
    await expect(first.locator('.card-choice-title')).toHaveText('Card 1');
    await expect(first.locator('.card-choice-subtitle')).toHaveText('Best Card for Rewards & Offers');
    await expect(first.locator('.card-choice-feature')).toHaveCount(2);
    await expect(first.locator('.card-choice-link')).toHaveAttribute('href', 'https://example.com/features');
    await expect(first.locator('.card-choice-amount-value')).toHaveText('₹ 15,000/-');
    await wrapper.locator('.card-choice-tab', { hasText: 'Business Cards' }).click();
    await expect(wrapper.locator('.card-choice-card:visible')).toHaveCount(2);
  });

  test('scrolls horizontally like a carousel', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const track = wrapper.locator('.card-choice-track');
    await expect(wrapper.locator('.card-choice-nav.prev')).toBeHidden();
    await wrapper.locator('.card-choice-nav.next').click();
    await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
    await expect(wrapper.locator('.card-choice-nav.prev')).toBeVisible();
    expect(await wrapper.locator('.card-choice-dot').count()).toBeGreaterThan(1);
  });

  test('selecting a card sets its details in the model once', async ({ page }) => {
    const changes = await trackChanges(page, FIELD);
    const wrapper = field(page, FIELD);
    await wrapper.locator('.card-choice-card').nth(1).locator('.card-choice-select').click();
    await expect.poll(async () => JSON.parse(await getModel(page, FIELD)).id).toBe('c2');
    expect(JSON.parse(await getModel(page, FIELD))).toMatchObject({ title: 'Card 2', minAmount: '₹ 15,000/-' });
    expect(await changes()).toBe(1);
    await expect(wrapper.locator('.card-choice-card').nth(1)).toHaveClass(/selected/);
    await expect(wrapper.locator('.card-choice-card.selected')).toHaveCount(1);
  });

  test('model value highlights the matching card', async ({ page }) => {
    await setModel(page, FIELD, 'value', JSON.stringify({ id: 'c3' }));
    await expect(field(page, FIELD).locator('.card-choice-card').nth(2)).toHaveClass(/selected/);
  });
});
