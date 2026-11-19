import assert from 'assert';
import { amountToWords } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input amountToWords', () => {
  it('should return empty for empty or invalid input', () => {
    assert.strictEqual(amountToWords(''), '');
    assert.strictEqual(amountToWords('abc'), '');
    assert.strictEqual(amountToWords('.'), '');
  });

  it('should handle zero', () => {
    assert.strictEqual(amountToWords('0'), 'Zero Rupees Only');
  });

  it('should use Thousand, Lakh and Crore', () => {
    assert.strictEqual(amountToWords('1000'), 'Rupees One Thousand Only');
    assert.strictEqual(amountToWords('123456'), 'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only');
    assert.strictEqual(amountToWords('10000000'), 'Rupees One Crore Only');
    assert.strictEqual(amountToWords('1000000000'), 'Rupees One Hundred Crore Only');
  });

  it('should support paise', () => {
    assert.strictEqual(amountToWords('1.5'), 'Rupees One and Fifty Paise Only');
    assert.strictEqual(amountToWords('0.05'), 'Five Paise Only');
    assert.strictEqual(amountToWords('1,00,000.99'), 'Rupees One Lakh and Ninety Nine Paise Only');
  });
});
