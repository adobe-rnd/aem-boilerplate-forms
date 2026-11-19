/* eslint-env mocha */
import assert from 'assert';
import decorate, { formatCompact, parseAmount } from '../../blocks/form/components/loan-slider/loan-slider.js';

function setup(fieldJson = {}) {
  const fieldDiv = document.createElement('div');
  fieldDiv.dataset.id = 'loan-1';
  fieldDiv.innerHTML = '<label for="loan-1">Loan</label><input type="number" id="loan-1">';
  document.body.append(fieldDiv);
  const changes = [];
  fieldDiv.addEventListener('change', (e) => changes.push(e.target.value));
  decorate(fieldDiv, { minimum: 50000, maximum: 1250000, properties: { splits: 12 }, ...fieldJson }, document.body, 'form-1');
  return {
    fieldDiv,
    changes,
    text: fieldDiv.querySelector('.loan-slider-text'),
    slider: fieldDiv.querySelector('.loan-slider-range'),
    ticks: fieldDiv.querySelectorAll('.loan-slider-tick'),
  };
}

describe('Loan slider', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('formats compact Indian amounts', () => {
    assert.strictEqual(formatCompact(50000), '50K');
    assert.strictEqual(formatCompact(1250000), '12.5L');
    assert.strictEqual(formatCompact(20000000), '2Cr');
    assert.strictEqual(parseAmount('₹5,00,000'), 500000);
    assert.strictEqual(parseAmount('abc'), null);
  });

  it('generates equal splits and starts at the minimum', () => {
    const { ticks, text, slider } = setup();
    assert.strictEqual(ticks.length, 13);
    assert.strictEqual(text.value, '₹50,000');
    assert.strictEqual(slider.value, '50000');
  });

  it('updates the textbox and commits when the slider moves', () => {
    const { slider, text, changes } = setup();
    slider.value = 520000;
    slider.dispatchEvent(new Event('input'));
    assert.strictEqual(text.value, '₹5,50,000');
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepStrictEqual(changes, ['550000']);
  });

  it('updates the slider when the textbox changes and clamps to the range', () => {
    const { slider, text, changes } = setup();
    text.value = '5,00,000';
    text.dispatchEvent(new Event('input'));
    assert.strictEqual(slider.value, '500000');
    text.dispatchEvent(new Event('change', { bubbles: true }));
    assert.strictEqual(text.value, '₹5,00,000');
    text.value = '99999999';
    text.dispatchEvent(new Event('change', { bubbles: true }));
    assert.strictEqual(text.value, '₹12,50,000');
    assert.strictEqual(slider.value, '1250000');
    assert.deepStrictEqual(changes, ['500000', '1250000']);
  });
});
