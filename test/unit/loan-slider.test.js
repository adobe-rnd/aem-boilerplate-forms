/* eslint-env mocha */
import assert from 'assert';
import decorate, {
  formatCompact, getTickValues, parseAmount,
} from '../../blocks/form/components/loan-slider/loan-slider.js';

describe('loan-slider', () => {
  it('formats compact Indian amounts', () => {
    assert.deepStrictEqual([50000, 200000, 1250000, 10000000].map(formatCompact), ['50K', '2L', '12.5L', '1Cr']);
  });

  it('generates equal splits including both bounds', () => {
    assert.deepStrictEqual(getTickValues(0, 100, 4), [0, 25, 50, 75, 100]);
  });

  it('parses formatted text', () => {
    assert.strictEqual(parseAmount('₹5,00,000'), 500000);
    assert.ok(Number.isNaN(parseAmount('abc')));
  });

  describe('widget', () => {
    let fieldDiv;
    let input;
    let changes;
    beforeEach(() => {
      document.body.innerHTML = '<form><div class="field-wrapper" data-id="ls"><label for="i">Loan</label><input id="i" type="number"></div></form>';
      fieldDiv = document.querySelector('.field-wrapper');
      input = fieldDiv.querySelector('input');
      changes = 0;
      document.querySelector('form').addEventListener('change', () => { changes += 1; });
      decorate(fieldDiv, { id: 'ls', minimum: 50000, maximum: 1250000, properties: { splits: 12 } }, null, 'f');
    });

    it('renders ticks and syncs slider and text box both ways', () => {
      const slider = fieldDiv.querySelector('.loan-slider-range');
      const text = fieldDiv.querySelector('.loan-slider-input');
      assert.strictEqual(fieldDiv.querySelectorAll('.loan-slider-tick').length, 13);
      assert.strictEqual(text.value, '50,000');

      slider.value = 600000;
      slider.dispatchEvent(new Event('input'));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      assert.strictEqual(text.value, '6,00,000');
      assert.strictEqual(input.value, '600000');
      assert.strictEqual(changes, 1);

      text.value = '5,00,000';
      text.dispatchEvent(new Event('change', { bubbles: true }));
      assert.strictEqual(slider.value, '500000');
      assert.strictEqual(input.value, '500000');
      assert.strictEqual(changes, 2);
    });

    it('clamps text box values to the range', () => {
      const text = fieldDiv.querySelector('.loan-slider-input');
      text.value = '99,99,999';
      text.dispatchEvent(new Event('change', { bubbles: true }));
      assert.strictEqual(input.value, '1250000');
      assert.strictEqual(text.value, '12,50,000');
    });
  });
});
