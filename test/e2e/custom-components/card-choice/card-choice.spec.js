import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, dispatchModelEvent, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';

const CARDS = [
  {
    id: 'freedom',
    title: 'Freedom',
    subtitle: 'Best Card for Rewards & Offers',
    image: 'https://example.com/freedom.png',
    features: ['Upto 10X CashPoints', '₹150 spent = 1 Fuel Point', 'Joining Fees - ₹500/-'],
    detailsUrl: 'https://example.com/freedom',
    minAmount: 15000,
    ctaLabel: 'Get This Card',
  },
  {
    id: 'indianoil',
    title: 'Indian Oil',
    subtitle: 'Best Card for Fuel',
    image: 'https://example.com/io.png',
    features: ['Upto 5% Fuel Points'],
    detailsUrl: 'https://example.com/io',
    minAmount: 30000,
    ctaLabel: 'Choose Indian Oil',
  },
  {
    id: 'moneyback',
    title: 'Moneyback+',
    subtitle: 'Cashback',
    image: 'https://example.com/mb.png',
    features: ['Upto 4X Reward Points'],
    detailsUrl: 'https://example.com/mb',
    minAmount: 30000,
    ctaLabel: 'Choose Moneyback',
  },
];

const setCards = (page) => dispatchModelEvent(page, FIELD, 'custom:setProperty', { properties: { cards: CARDS } });

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('is decorated, hides the input and renders no cards before data is set', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-track')).toBeAttached();
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(0);
    await expect(wrapper.locator('input')).toBeHidden();
  });

  test('renders cards when a rule sets properties.cards', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(3);
    const first = wrapper.locator('.card-choice-card').first();
    await expect(first).toContainText('Freedom');
    await expect(first).toContainText('Best Card for Rewards & Offers');
    await expect(first).toContainText('₹15,000/-');
    await expect(first).toContainText('Min. FD Amount');
    await expect(first.locator('.card-choice-feature')).toHaveCount(3);
    await expect(first.getByRole('link', { name: /All Features & Benefits/ })).toHaveAttribute('href', 'https://example.com/freedom');
    await expect(first.locator('img')).toHaveAttribute('src', 'https://example.com/freedom.png');
    await expect(wrapper.getByRole('button', { name: 'Choose Indian Oil' })).toHaveAttribute('aria-pressed', 'false');
    const overflow = await wrapper.locator('.card-choice-track').evaluate((e) => getComputedStyle(e).overflowX);
    expect(['auto', 'scroll']).toContain(overflow);
    await expect(wrapper.locator('.card-choice-dot').first()).toBeAttached();
  });

  test('re-renders when cards change', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(3);
    await dispatchModelEvent(page, FIELD, 'custom:setProperty', { properties: { cards: CARDS.slice(0, 1) } });
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(1);
  });

  test('renders cards already set in the form definition', async ({ page, formServer }) => {
    const def = JSON.parse(JSON.stringify(formDef));
    def.items[0].properties = { cards: CARDS };
    await renderForm(page, formServer, def);
    await expect(field(page, FIELD).locator('.card-choice-card')).toHaveCount(3);
  });

  test('reflects a model value set externally', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(3);
    await setModel(page, FIELD, 'value', 'indianoil');
    await expect(wrapper.getByRole('button', { name: 'Choose Indian Oil' })).toHaveAttribute('aria-pressed', 'true');
    await expect(wrapper.getByRole('button', { name: 'Get This Card' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking a call-to-action selects the card and sets the model value once', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(3);
    const changes = await trackChanges(page, FIELD);
    await wrapper.getByRole('button', { name: 'Get This Card' }).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual('freedom');
    await expect(wrapper.getByRole('button', { name: 'Get This Card' })).toHaveAttribute('aria-pressed', 'true');
    await wrapper.getByRole('button', { name: 'Choose Moneyback' }).click();
    await expect.poll(() => getModel(page, FIELD)).toEqual('moneyback');
    await expect(wrapper.getByRole('button', { name: 'Get This Card' })).toHaveAttribute('aria-pressed', 'false');
    await expect(wrapper.locator('[aria-pressed="true"]')).toHaveCount(1);
    expect(await changes()).toBe(2);
  });

  test('arrow buttons scroll the track', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await setCards(page);
    const wrapper = field(page, FIELD);
    const track = wrapper.locator('.card-choice-track');
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(3);
    await wrapper.getByRole('button', { name: 'Next' }).click();
    await expect.poll(() => track.evaluate((e) => e.scrollLeft)).toBeGreaterThan(200);
    await wrapper.getByRole('button', { name: 'Previous' }).click();
    await expect.poll(() => track.evaluate((e) => e.scrollLeft)).toBe(0);
  });

  test('call-to-action is keyboard operable', async ({ page }) => {
    await setCards(page);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(3);
    await wrapper.getByRole('button', { name: 'Get This Card' }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => getModel(page, FIELD)).toEqual('freedom');
  });
});
