import {
  test, expect, renderForm, loadFormJson, field, getModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';

// A rule on the next field sets the card data on the component.
const loadCards = async (page) => {
  const input = page.locator('[data-id="next-field"] input');
  await input.fill('go');
  await input.blur();
};

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('is loaded and renders an empty carousel before data arrives', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-track')).toBeVisible();
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(0);
  });

  test('renders cards from data set by a rule and applies authored label', async ({ page }) => {
    await loadCards(page);
    const wrapper = field(page, FIELD);
    const cards = wrapper.locator('.card-choice-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.first().locator('.card-choice-title')).toHaveText('Freedom');
    await expect(cards.first().locator('.card-choice-features li')).toHaveCount(2);
    await expect(cards.first().locator('.card-choice-amount-value')).toHaveText('₹ 15,000/-');
    await expect(cards.nth(1).locator('.card-choice-select')).toHaveText('Pick It');
    await expect(wrapper.locator('.card-choice-category')).toHaveCount(2);
    await wrapper.locator('.card-choice-category', { hasText: 'Business Cards' }).click();
    await expect(cards).toHaveCount(1);
  });

  test('scrolls horizontally with the next button', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await loadCards(page);
    const track = field(page, FIELD).locator('.card-choice-track');
    await expect(track.locator('.card-choice-card')).toHaveCount(4);
    expect(await track.evaluate((t) => t.scrollWidth > t.clientWidth)).toBe(true);
    await field(page, FIELD).locator('.card-choice-next').click();
    await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
  });

  test('selecting a card stores its details in the model once', async ({ page }) => {
    await loadCards(page);
    const changes = await trackChanges(page, FIELD);
    const card = field(page, FIELD).locator('.card-choice-card').nth(1);
    await card.locator('.card-choice-select').click();
    await expect(card).toHaveClass(/selected/);
    await expect.poll(async () => JSON.parse(await getModel(page, FIELD)).id).toBe('oil');
    expect(JSON.parse(await getModel(page, FIELD)).minAmount).toBe('₹ 30,000/-');
    expect(await changes()).toBe(1);
  });

  test('model value updates the highlighted card', async ({ page }) => {
    await loadCards(page);
    await page.evaluate(() => {
      window.myForm.getElement('field-under-test').value = JSON.stringify({ id: 'money' });
    });
    await expect(field(page, FIELD).locator('.card-choice-card').nth(2)).toHaveClass(/selected/);
  });
});
