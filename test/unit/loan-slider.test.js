/* eslint-env mocha */
import assert from 'assert';
import decorate, {
  getSplitValues, snapToSplit, parseAmount, formatInr, formatShort,
} from '../../blocks/form/components/loan-slider/loan-slider.js';

describe('loan-slider', () => {
  it('generates equal splits between min and max', () => {
    assert.deepStrictEqual(getSplitValues(0, 100, 4), [0, 25, 50, 75, 100]);
  });

  it('snaps to the nearest split', () => {
    assert.strictEqual(snapToSplit(30, 0, 100, 4), 25);
    assert.strictEqual(snapToSplit(90, 0, 100, 4), 100);
  });

  it('formats and parses INR amounts', () => {
    assert.strictEqual(formatInr(500000), '₹5,00,000');
    assert.strictEqual(formatShort(50000), '50K');
    assert.strictEqual(formatShort(1250000), '12.5L');
    assert.strictEqual(parseAmount('₹5,00,000'), 500000);
    assert.ok(Number.isNaN(parseAmount('abc')));
  });

  describe('decorate', () => {
    const setup = async () => {
      const div = document.createElement('div');
      div.innerHTML = '<input type="number">';
      document.body.append(div);
      await decorate(div, { minimum: 0, maximum: 100, properties: { splits: 4 } });
      return div;
    };

    it('syncs textbox to slider and vice versa', async () => {
      const div = await setup();
      const slider = div.querySelector('input[type="range"]');
      const text = div.querySelector('.loan-slider-textbox');
      assert.strictEqual(div.querySelectorAll('.loan-slider-tick').length, 3);

      slider.value = 60;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      assert.strictEqual(slider.value, '50');
      assert.strictEqual(text.value, '₹50');

      text.value = '₹80';
      text.dispatchEvent(new Event('input'));
      assert.strictEqual(slider.value, '80');
      text.dispatchEvent(new Event('blur'));
      assert.strictEqual(text.value, '₹80');

      text.value = '999';
      text.dispatchEvent(new Event('blur'));
      assert.strictEqual(slider.value, '100');
      div.remove();
    });
  });
});
