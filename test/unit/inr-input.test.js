import assert from 'assert';
import { amountToWords, sanitizeAmount } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input amountToWords', () => {
  it('returns empty for empty or invalid input', () => {
    assert.strictEqual(amountToWords(''), '');
    assert.strictEqual(amountToWords('.'), '');
    assert.strictEqual(amountToWords(undefined), '');
  });
  it('handles zero, singular rupee and paise only', () => {
    assert.strictEqual(amountToWords('0'), 'Zero Rupees Only');
    assert.strictEqual(amountToWords('1'), 'One Rupee Only');
    assert.strictEqual(amountToWords('0.5'), 'Fifty Paise Only');
    assert.strictEqual(amountToWords('0.05'), 'Five Paise Only');
  });
  it('uses Thousand, Lakh and Crore', () => {
    assert.strictEqual(amountToWords('100000'), 'One Lakh Rupees Only');
    assert.strictEqual(amountToWords('12345678.25'), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees and Twenty Five Paise Only');
    assert.strictEqual(amountToWords('1000000000'), 'One Hundred Crore Rupees Only');
  });
  it('sanitizes input', () => {
    assert.strictEqual(sanitizeAmount('1,2a3.456.7'), '123.45');
  });
});
