import { readFileSync } from 'node:fs';
import {
  test, expect, renderForm, loadFormJson, field, getModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('card-choice');
const FIELD = 'field-under-test';

const cards = JSON.parse(readFileSync(new URL('./cards.json', import.meta.url), 'utf8'));

// A rule on "next-field" sets the cards on the component, like an authored rule would.
const loadCards = async (page) => {
  await page.locator('#next-field').fill('go');
  await page.locator('#next-field').blur();
};

test.describe('card-choice custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await renderForm(page, formServer, formDef);
  });

  test('is loaded and renders no cards before data arrives', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.card-choice-widget')).toHaveClass(/empty/);
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(0);
  });

  test('renders all card details when a rule sets the cards property', async ({ page }) => {
    await loadCards(page);
    const first = field(page, FIELD).locator('.card-choice-card').first();
    await expect(field(page, FIELD).locator('.card-choice-card')).toHaveCount(6);
    await expect(first.locator('.card-choice-title')).toHaveText('Card 1');
    await expect(first.locator('.card-choice-tagline')).toHaveText('Best Card for Rewards & Offers');
    await expect(first.locator('.card-choice-image')).toHaveCount(1);
    await expect(first.locator('.card-choice-features li')).toHaveText(cards[0].features);
    await expect(first.locator('.card-choice-details')).toHaveAttribute('href', 'https://example.com');
    await expect(first.locator('.card-choice-min-label')).toHaveText('Min. FD Amount');
    await expect(first.locator('.card-choice-min-value')).toHaveText('Rs 15,000/-');
    await expect(first.locator('.card-choice-select')).toHaveText('Get This Card');
  });

  test('scrolls horizontally with the navigation buttons', async ({ page }) => {
    await loadCards(page);
    const wrapper = field(page, FIELD);
    const track = wrapper.locator('.card-choice-track');
    await expect(wrapper.locator('.card-choice-card')).toHaveCount(6);
    await expect(wrapper.locator('.card-choice-prev')).toBeHidden();
    await wrapper.locator('.card-choice-next').click();
    await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
    await expect(wrapper.locator('.card-choice-prev')).toBeVisible();
  });

  test('selecting a card stores its details in the model once', async ({ page }) => {
    await loadCards(page);
    const changes = await trackChanges(page, FIELD);
    const second = field(page, FIELD).locator('.card-choice-card').nth(1);
    await second.locator('.card-choice-select').click();
    await expect.poll(async () => JSON.parse(await getModel(page, FIELD))).toEqual(cards[1]);
    await expect(second).toHaveClass(/selected/);
    expect(await changes()).toBe(1);

    await field(page, FIELD).locator('.card-choice-card').nth(0).locator('.card-choice-select').click();
    await expect.poll(async () => JSON.parse(await getModel(page, FIELD)).name).toBe('Card 1');
    await expect(second).not.toHaveClass(/selected/);
  });
});
