/* eslint-env mocha */
import assert from 'assert';
import decorate, { formatCompact, formatAmount, parseAmount } from '../../blocks/form/components/loan-slider/loan-slider.js';

const setup = (json = {}) => {
  const div = document.createElement('div');
  div.dataset.id = 'loan-1';
  div.innerHTML = '<label for="loan-1" class="field-label">Loan Amount (INR)</label><input type="number" id="loan-1">';
  document.body.append(div);
  decorate(div, { minimum: 50000, maximum: 1250000, properties: { splits: 12 }, ...json }, null, 'form-1');
  return div;
};

describe('loan-slider', () => {
  it('formats amounts in the Indian system', () => {
    assert.strictEqual(formatAmount(500000), '₹5,00,000');
    assert.strictEqual(formatCompact(50000), '50K');
    assert.strictEqual(formatCompact(1250000), '12.5L');
    assert.strictEqual(parseAmount('₹5,00,000'), 500000);
    assert.strictEqual(parseAmount('abc'), null);
  });

  it('renders equal splits and starts at the minimum', () => {
    const div = setup();
    assert.strictEqual(div.querySelectorAll('.loan-slider-tick').length, 13);
    assert.strictEqual(div.querySelector('.loan-slider-value').value, '₹50,000');
    assert.strictEqual(div.querySelector('.loan-slider-range').step, '100000');
  });

  it('updates the text box and commits when the slider moves', () => {
    const div = setup();
    const slider = div.querySelector('.loan-slider-range');
    let changed = 0;
    div.addEventListener('change', () => { changed += 1; });
    slider.value = 550000;
    slider.dispatchEvent(new Event('input'));
    assert.strictEqual(div.querySelector('.loan-slider-value').value, '₹5,50,000');
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    assert.strictEqual(div.querySelector('input[type="hidden"]').value, '550000');
    assert.strictEqual(changed, 2);
  });

  it('updates the slider from the text box and clamps to max', () => {
    const div = setup();
    const textBox = div.querySelector('.loan-slider-value');
    textBox.value = '350000';
    textBox.dispatchEvent(new Event('input'));
    assert.strictEqual(div.querySelector('.loan-slider-range').value, '350000');
    textBox.value = '99999999';
    textBox.dispatchEvent(new Event('change'));
    assert.strictEqual(textBox.value, '₹12,50,000');
    assert.strictEqual(div.querySelector('input[type="hidden"]').value, '1250000');
  });
});
