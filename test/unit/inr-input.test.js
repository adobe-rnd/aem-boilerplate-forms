import { expect } from 'chai';
import { amountToWords, formatIndian, sanitizeAmount } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input', () => {
  describe('amountToWords', () => {
    it('should convert rupees using lakh and crore', () => {
      expect(amountToWords('123456')).to.equal('Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only');
      expect(amountToWords('10000000')).to.equal('Rupees One Crore Only');
      expect(amountToWords('1000000000')).to.equal('Rupees One Hundred Crore Only');
    });
    it('should support paise', () => {
      expect(amountToWords('1.5')).to.equal('Rupees One and Fifty Paise Only');
      expect(amountToWords('0.05')).to.equal('Five Paise Only');
    });
    it('should return empty for empty, zero or invalid input', () => {
      expect(amountToWords('')).to.equal('');
      expect(amountToWords('0')).to.equal('');
      expect(amountToWords('abc')).to.equal('');
    });
  });

  describe('input helpers', () => {
    it('should group digits the Indian way', () => {
      expect(formatIndian('1234567.5')).to.equal('12,34,567.5');
      expect(formatIndian('999')).to.equal('999');
    });
    it('should keep digits, one dot and two decimals', () => {
      expect(sanitizeAmount('₹1,2a3.4.567')).to.equal('123.45');
    });
  });
});
