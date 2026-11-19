import { expect } from 'chai';
import { amountToWords } from '../../blocks/form/components/inr-input/inr-input.js';

describe('inr-input amountToWords', () => {
  it('should convert rupees using Thousand, Lakh and Crore', () => {
    expect(amountToWords('1')).to.equal('One Rupee Only');
    expect(amountToWords('1250')).to.equal('One Thousand Two Hundred Fifty Rupees Only');
    expect(amountToWords('123456')).to.equal('One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees Only');
    expect(amountToWords('12345678')).to.equal('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only');
    expect(amountToWords('10000000')).to.equal('One Crore Rupees Only');
  });

  it('should support paise', () => {
    expect(amountToWords('100.50')).to.equal('One Hundred Rupees and Fifty Paise Only');
    expect(amountToWords('0.05')).to.equal('Five Paise Only');
    expect(amountToWords('1.999')).to.equal('Two Rupees Only');
  });

  it('should handle zero, empty and invalid values', () => {
    expect(amountToWords('0')).to.equal('Zero Rupees Only');
    expect(amountToWords('')).to.equal('');
    expect(amountToWords('-5')).to.equal('');
    expect(amountToWords('abc')).to.equal('');
    expect(amountToWords(undefined)).to.equal('');
  });
});
