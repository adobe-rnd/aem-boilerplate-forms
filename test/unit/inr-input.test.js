/* eslint-env mocha */
import assert from 'assert';
import { amountToWords, sanitizeAmount } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input', () => {
  describe('amountToWords', () => {
    it('should return empty for empty or invalid input', () => {
      assert.strictEqual(amountToWords(''), '');
      assert.strictEqual(amountToWords('.'), '');
      assert.strictEqual(amountToWords('abc'), '');
    });
    it('should handle rupees with Indian units', () => {
      assert.strictEqual(amountToWords('1'), 'Rupees One Only');
      assert.strictEqual(amountToWords('1000'), 'Rupees One Thousand Only');
      assert.strictEqual(amountToWords('123456'), 'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only');
      assert.strictEqual(amountToWords('10000000'), 'Rupees One Crore Only');
      assert.strictEqual(amountToWords('1000000000'), 'Rupees One Hundred Crore Only');
    });
    it('should handle paise', () => {
      assert.strictEqual(amountToWords('0.5'), 'Fifty Paise Only');
      assert.strictEqual(amountToWords('12.05'), 'Rupees Twelve and Five Paise Only');
      assert.strictEqual(amountToWords('0'), 'Zero Rupees Only');
    });
  });

  describe('sanitizeAmount', () => {
    it('should strip invalid characters and limit decimals', () => {
      assert.strictEqual(sanitizeAmount('₹1,2a3.456.7'), '123.45');
      assert.strictEqual(sanitizeAmount('12.'), '12.');
    });
  });
});
