import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';
const cards = [
  {
    id: 'freedom',
    title: 'Freedom',
    subtitle: 'Best Card for Rewards & Offers',
    features: ['Upto 10X CashPoints', { text: 'Joining Fees - ₹500/-' }],
    linkText: 'All Features & Benefits',
    minAmount: '₹ 15,000/-',
  },
  { id: 'oil', title: 'Indian Oil', minAmount: '₹ 30,000/-' },
  { id: 'mb', title: 'Moneyback+' },
  { id: 'tata', title: 'Tata Neu' },
  { id: 'x', title: 'Fifth' },
];

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('is loaded and renders no cards before data arrives', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-track')).toBeVisible();
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(0);
  });

  test('renders cards with all details when a rule sets the data', async ({ page }) => {
    await setModel(page, FIELD, 'properties', { cards });
    const first = field(page, FIELD).locator('.card-choice-card').first();
    await expect(field(page, FIELD).locator('.card-choice-card')).toHaveCount(5);
    await expect(first.locator('.card-choice-title')).toHaveText('Freedom');
    await expect(first.locator('.card-choice-subtitle')).toHaveText('Best Card for Rewards & Offers');
    await expect(first.locator('.card-choice-feature')).toHaveCount(2);
    await expect(first.locator('.card-choice-link')).toHaveText('All Features & Benefits');
    await expect(first.locator('.card-choice-amount-value')).toHaveText('₹ 15,000/-');
    await expect(first.locator('.card-choice-select')).toHaveText('Get This Card');
  });

  test('selecting a card sets its details in the model once', async ({ page }) => {
    await setModel(page, FIELD, 'properties', { cards });
    const changes = await trackChanges(page, FIELD);
    const second = field(page, FIELD).locator('.card-choice-card').nth(1);
    await second.locator('.card-choice-select').click();
    await expect.poll(() => getModel(page, FIELD)).toEqual(JSON.stringify(cards[1]));
    expect(await changes()).toBe(1);
    await expect(second).toHaveClass(/selected/);
    await field(page, FIELD).locator('.card-choice-card').first().locator('.card-choice-select').click();
    await expect(second).not.toHaveClass(/selected/);
  });

  test('model value highlights the card', async ({ page }) => {
    await setModel(page, FIELD, 'properties', { cards });
    await setModel(page, FIELD, 'value', JSON.stringify(cards[2]));
    await expect(field(page, FIELD).locator('.card-choice-card').nth(2)).toHaveClass(/selected/);
  });

  test('cards scroll horizontally via the next button', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await setModel(page, FIELD, 'properties', { cards });
    const track = field(page, FIELD).locator('.card-choice-track');
    const next = field(page, FIELD).locator('.card-choice-next');
    await expect(next).toBeVisible();
    await next.click();
    await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
  });
});
