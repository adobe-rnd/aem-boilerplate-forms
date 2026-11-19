/* eslint-env mocha */
import assert from 'assert';
import { amountToWords } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input amountToWords', () => {
  it('returns empty for empty or invalid input', () => {
    assert.strictEqual(amountToWords(''), '');
    assert.strictEqual(amountToWords('.'), '');
    assert.strictEqual(amountToWords('abc'), '');
  });

  it('converts rupees using Thousand, Lakh and Crore', () => {
    assert.strictEqual(amountToWords('0'), 'Zero Rupees Only');
    assert.strictEqual(amountToWords('1'), 'One Rupee Only');
    assert.strictEqual(amountToWords('21000'), 'Twenty One Thousand Rupees Only');
    assert.strictEqual(
      amountToWords('123456'),
      'One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees Only',
    );
    assert.strictEqual(amountToWords('10000000'), 'One Crore Rupees Only');
    assert.strictEqual(amountToWords('1000000000'), 'One Hundred Crore Rupees Only');
  });

  it('converts paise', () => {
    assert.strictEqual(amountToWords('0.5'), 'Fifty Paise Only');
    assert.strictEqual(amountToWords('0.05'), 'Five Paise Only');
    assert.strictEqual(amountToWords('1.01'), 'One Rupee and One Paise Only');
    assert.strictEqual(
      amountToWords('100.25'),
      'One Hundred Rupees and Twenty Five Paise Only',
    );
    assert.strictEqual(amountToWords(12.5), 'Twelve Rupees and Fifty Paise Only');
  });
});
