/* eslint-env mocha */
import assert from 'assert';
import { amountToWords, sanitizeAmount } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input', () => {
  describe('amountToWords', () => {
    it('should use Thousand, Lakh and Crore', () => {
      assert.strictEqual(amountToWords('1234567'), 'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees Only');
      assert.strictEqual(amountToWords('250000000'), 'Twenty Five Crore Rupees Only');
      assert.strictEqual(amountToWords('1000000000'), 'One Hundred Crore Rupees Only');
    });

    it('should support rupees and paise', () => {
      assert.strictEqual(amountToWords('1.5'), 'One Rupee and Fifty Paise Only');
      assert.strictEqual(amountToWords('.05'), 'Five Paise Only');
      assert.strictEqual(amountToWords('0'), 'Zero Rupees Only');
    });

    it('should return empty for empty or invalid input', () => {
      assert.strictEqual(amountToWords(''), '');
      assert.strictEqual(amountToWords('abc'), '');
    });
  });

  describe('sanitizeAmount', () => {
    it('should keep digits, one dot and two decimals', () => {
      assert.strictEqual(sanitizeAmount('₹1,2a3.4.567'), '123.45');
    });
  });
});
