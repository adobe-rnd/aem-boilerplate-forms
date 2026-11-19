/* eslint-env mocha */
import assert from 'assert';
import decorate, { formatCompact } from '../../blocks/form/components/loan-slider/loan-slider.js';

const setup = (json = {}) => {
  const fieldDiv = document.createElement('div');
  fieldDiv.dataset.id = 'loan-1';
  fieldDiv.innerHTML = '<label for="loan-1">Loan Amount</label><input id="loan-1" type="number" min="50000" max="1250000">';
  decorate(fieldDiv, { minimum: 50000, maximum: 1250000, ...json }, null, 'form-1');
  const input = fieldDiv.querySelector('input[type="number"]');
  return {
    fieldDiv,
    input,
    range: fieldDiv.querySelector('.loan-slider-range'),
    text: fieldDiv.querySelector('.loan-slider-text'),
    changes: (() => {
      const calls = [];
      input.addEventListener('change', () => calls.push(input.value));
      return calls;
    })(),
  };
};

describe('Loan slider', () => {
  it('formats compact labels', () => {
    assert.strictEqual(formatCompact(50000), '50K');
    assert.strictEqual(formatCompact(200000), '2L');
    assert.strictEqual(formatCompact(1250000), '12.5L');
    assert.strictEqual(formatCompact(20000000), '2Cr');
  });

  it('generates equal splits between min and max', () => {
    const { fieldDiv } = setup({ properties: { splits: 12 } });
    assert.strictEqual(fieldDiv.querySelectorAll('.loan-slider-tick').length, 13);
    assert.strictEqual(fieldDiv.querySelector('.loan-slider-label').textContent, '50K');
    assert.strictEqual(fieldDiv.querySelector('.loan-slider-label:last-child').textContent, '12.5L');
  });

  it('updates the text box when the slider moves and commits on release', () => {
    const { range, text, input, changes } = setup();
    range.value = 500000;
    range.dispatchEvent(new Event('input'));
    assert.strictEqual(text.value, '5,00,000');
    assert.strictEqual(changes.length, 0);
    range.dispatchEvent(new Event('change'));
    assert.deepStrictEqual(changes, ['500000']);
    assert.strictEqual(input.value, '500000');
  });

  it('updates the slider when the text box changes and clamps to range', () => {
    const { range, text, changes } = setup();
    text.value = '7,50,000';
    text.dispatchEvent(new Event('input'));
    assert.strictEqual(range.value, '750000');
    text.dispatchEvent(new Event('change'));
    assert.strictEqual(changes.at(-1), '750000');

    text.value = '99999999';
    text.dispatchEvent(new Event('change'));
    assert.strictEqual(range.value, '1250000');
    assert.strictEqual(text.value, '12,50,000');

    text.value = 'abc';
    text.dispatchEvent(new Event('change'));
    assert.strictEqual(text.value, '12,50,000');
  });
});
