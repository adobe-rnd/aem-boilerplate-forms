import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';

const cards = ['Freedom', 'Indian Oil', 'Moneyback+', 'Tata Neu', 'Regalia'].map((name, i) => ({
  id: `c${i}`,
  name,
  tagline: 'Best Card for Rewards & Offers',
  image: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  features: ['Upto 10X CashPoints', '₹150 spent = 1 Fuel Point', 'Joining Fees - ₹500/-'],
  linkText: 'All Features & Benefits',
  linkUrl: '#',
  minAmountLabel: 'Min. FD Amount',
  minAmount: 15000 + i * 15000,
  buttonLabel: 'Get This Card',
}));

const setCards = (page) => setModel(page, FIELD, 'properties', { cards });

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await renderForm(page, formServer, formDef);
  });

  test('is loaded and has an empty carousel before data arrives', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-track')).toBeVisible();
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(0);
  });

  test('renders all card details when a rule sets the data', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(5);
    const first = wrapper.locator('.card-choice-card').first();
    await expect(first.locator('.card-choice-title')).toHaveText('Freedom');
    await expect(first.locator('.card-choice-tagline')).toHaveText('Best Card for Rewards & Offers');
    await expect(first.locator('.card-choice-image')).toHaveCount(1);
    await expect(first.locator('.card-choice-features li')).toHaveCount(3);
    await expect(first.locator('.card-choice-link')).toHaveText('All Features & Benefits');
    await expect(first.locator('.card-choice-amount-label')).toHaveText('Min. FD Amount');
    await expect(first.locator('.card-choice-amount-value')).toContainText('15,000');
    await expect(first.locator('.card-choice-select')).toHaveText('Get This Card');
  });

  test('scrolls horizontally with next/prev and dots', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    const track = wrapper.locator('.card-choice-track');
    await expect(wrapper.locator('.card-choice-prev')).toBeHidden();
    await expect(wrapper.locator('.card-choice-dot').first()).toHaveClass(/active/);
    await wrapper.locator('.card-choice-next').click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await expect(wrapper.locator('.card-choice-prev')).toBeVisible();
    await wrapper.locator('.card-choice-prev').click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThan(2);
  });

  test('selecting a card sets it in the model once', async ({ page }) => {
    await setCards(page);
    const changes = await trackChanges(page, FIELD);
    const wrapper = field(page, FIELD);
    await wrapper.locator('.card-choice-select').nth(1).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual(JSON.stringify(cards[1]));
    expect(await changes('value')).toBe(1);
    await expect(wrapper.locator('.card-choice-card').nth(1)).toHaveClass(/selected/);
    await expect(wrapper.locator('.card-choice-card.selected')).toHaveCount(1);
  });

  test('reflects a value set via the model', async ({ page }) => {
    await setCards(page);
    await setModel(page, FIELD, 'value', JSON.stringify(cards[2]));
    await expect(field(page, FIELD).locator('.card-choice-card').nth(2)).toHaveClass(/selected/);
  });
});
