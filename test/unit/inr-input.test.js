/* eslint-env mocha */
import assert from 'assert';
import { amountToWords } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input amountToWords', () => {
  it('should convert rupees using Thousand, Lakh and Crore', () => {
    assert.strictEqual(amountToWords('1234'), 'Rupees One Thousand Two Hundred Thirty Four Only');
    assert.strictEqual(amountToWords('100000'), 'Rupees One Lakh Only');
    assert.strictEqual(
      amountToWords('123456789'),
      'Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only',
    );
    assert.strictEqual(amountToWords('1000000000'), 'Rupees One Hundred Crore Only');
  });

  it('should support rupees and paise', () => {
    assert.strictEqual(amountToWords('10.5'), 'Rupees Ten and Fifty Paise Only');
    assert.strictEqual(amountToWords('0.05'), 'Five Paise Only');
    assert.strictEqual(amountToWords('1.239'), 'Rupees One and Twenty Three Paise Only');
  });

  it('should handle zero, empty and invalid values', () => {
    assert.strictEqual(amountToWords('0'), 'Rupees Zero Only');
    assert.strictEqual(amountToWords(''), '');
    assert.strictEqual(amountToWords(undefined), '');
    assert.strictEqual(amountToWords('-5'), '');
    assert.strictEqual(amountToWords('1e5'), '');
  });
});
