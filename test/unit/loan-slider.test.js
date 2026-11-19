/* eslint-env mocha */
import assert from 'assert';
import decorate, {
  formatAmount, formatCompact, generateSplits, parseAmount,
} from '../../blocks/form/components/loan-slider/loan-slider.js';

function build(value = '') {
  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'field-wrapper';
  fieldDiv.innerHTML = `<input type="number" value="${value}">`;
  const fieldJson = {
    minimum: 50000,
    maximum: 1250000,
    properties: { splits: 6, stepValue: 1000 },
  };
  return { fieldDiv, fieldJson };
}

describe('Loan slider', () => {
  describe('helpers', () => {
    it('should generate equal splits from min to max', () => {
      assert.deepStrictEqual(generateSplits(0, 100, 4), [0, 25, 50, 75, 100]);
    });

    it('should format amounts in Indian grouping and compact labels', () => {
      assert.strictEqual(formatAmount(500000), '5,00,000');
      assert.strictEqual(formatCompact(50000), '50K');
      assert.strictEqual(formatCompact(1250000), '12.5L');
      assert.strictEqual(formatCompact(20000000), '2Cr');
    });

    it('should parse formatted text and reject garbage', () => {
      assert.strictEqual(parseAmount('₹5,00,000'), 500000);
      assert.ok(Number.isNaN(parseAmount('abc')));
    });
  });

  describe('widget', () => {
    it('should render a tick label per split boundary', async () => {
      const { fieldDiv, fieldJson } = build();
      await decorate(fieldDiv, fieldJson, null, 'f1');
      assert.strictEqual(fieldDiv.querySelectorAll('.loan-slider-tick').length, 7);
    });

    it('should update the slider and source input when the textbox changes', async () => {
      const { fieldDiv, fieldJson } = build();
      await decorate(fieldDiv, fieldJson, null, 'f1');
      const text = fieldDiv.querySelector('.loan-slider-text');
      const slider = fieldDiv.querySelector('.loan-slider-range');
      const source = fieldDiv.querySelector('.loan-slider-source');
      text.value = '5,00,000';
      text.dispatchEvent(new Event('blur'));
      assert.strictEqual(slider.value, '500000');
      assert.strictEqual(source.value, '500000');
      assert.strictEqual(text.value, '5,00,000');
    });

    it('should clamp textbox values to the min and max', async () => {
      const { fieldDiv, fieldJson } = build();
      await decorate(fieldDiv, fieldJson, null, 'f1');
      const text = fieldDiv.querySelector('.loan-slider-text');
      text.value = '99999999';
      text.dispatchEvent(new Event('blur'));
      assert.strictEqual(fieldDiv.querySelector('.loan-slider-range').value, '1250000');
      assert.strictEqual(text.value, '12,50,000');
    });

    it('should update the textbox and source input when the slider moves', async () => {
      const { fieldDiv, fieldJson } = build();
      await decorate(fieldDiv, fieldJson, null, 'f1');
      const slider = fieldDiv.querySelector('.loan-slider-range');
      slider.value = '200000';
      slider.dispatchEvent(new Event('input'));
      assert.strictEqual(fieldDiv.querySelector('.loan-slider-text').value, '2,00,000');
      assert.strictEqual(fieldDiv.querySelector('.loan-slider-source').value, '200000');
    });

    it('should not leak change events from the visible controls', async () => {
      const { fieldDiv, fieldJson } = build();
      await decorate(fieldDiv, fieldJson, null, 'f1');
      const targets = [];
      fieldDiv.addEventListener('change', (e) => targets.push(e.target));
      const text = fieldDiv.querySelector('.loan-slider-text');
      text.dispatchEvent(new Event('change', { bubbles: true }));
      assert.deepStrictEqual(targets, []);
    });
  });
});
