import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, dispatchModelEvent, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';
const CARDS = ['freedom', 'indian-oil', 'moneyback'].map((id, i) => ({
  id,
  title: `Card ${id}`,
  subtitle: 'Best Card for Rewards & Offers',
  image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  features: ['Upto 10X CashPoints', 'Joining Fees - ₹500/-'],
  detailsUrl: `https://example.com/${id}`,
  minAmount: 15000 * (i + 1),
  ctaLabel: `Get ${id}`,
}));

const setCards = (page, cards = CARDS) => dispatchModelEvent(page, FIELD, 'custom:setProperty', { properties: { cards } });

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders no cards before data is set, with the input hidden', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(0);
    await expect(wrapper.locator('input')).toBeHidden();
  });

  test('renders cards when properties.cards is set', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(3);
    const first = wrapper.locator('.card-choice-card').first();
    await expect(first).toContainText('Card freedom');
    await expect(first).toContainText('₹15,000/-');
    await expect(first.getByRole('link', { name: /All Features & Benefits/ })).toHaveAttribute('href', 'https://example.com/freedom');
    await expect(first.locator('.card-choice-feature')).toHaveCount(2);
    const overflow = await wrapper.locator('.card-choice-track').evaluate((el) => getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(overflow);
    await expect(wrapper.getByRole('button', { name: 'Get freedom' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('re-renders when cards change', async ({ page }) => {
    await setCards(page);
    await setCards(page, CARDS.slice(0, 1));
    await expect(field(page, FIELD).locator('.card-choice-card')).toHaveCount(1);
  });

  test('model value selects the matching card', async ({ page }) => {
    await setCards(page);
    await setModel(page, FIELD, 'value', 'moneyback');
    const wrapper = field(page, FIELD);
    await expect(wrapper.getByRole('button', { name: 'Get moneyback' })).toHaveAttribute('aria-pressed', 'true');
    await expect(wrapper.getByRole('button', { name: 'Get freedom' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking a call-to-action sets the model value once, single selection', async ({ page }) => {
    await setCards(page);
    const changes = await trackChanges(page, FIELD);
    const wrapper = field(page, FIELD);
    await wrapper.getByRole('button', { name: 'Get indian-oil' }).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual('indian-oil');
    expect(await changes()).toBe(1);
    await wrapper.getByRole('button', { name: 'Get freedom' }).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual('freedom');
    await expect(wrapper.getByRole('button', { name: 'Get indian-oil' })).toHaveAttribute('aria-pressed', 'false');
    await expect(wrapper.getByRole('button', { name: 'Get freedom' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('next and previous buttons scroll the track', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 900 });
    await setCards(page);
    const wrapper = field(page, FIELD);
    const track = wrapper.locator('.card-choice-track');
    await wrapper.getByRole('button', { name: 'Next' }).click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await wrapper.getByRole('button', { name: 'Previous' }).click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBe(0);
  });
});
