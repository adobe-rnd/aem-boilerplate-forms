import { expect } from 'chai';
import { describeAmount } from '../../blocks/form/components/live-amount-input/live-amount-input.js';

describe('Live amount input conversion', () => {
  it('should convert the reference amount without rounding paise', () => {
    expect(describeAmount('12,345.67')).to.deep.equal({
      words: 'Rupees Twelve Thousand Three Hundred Forty Five and Sixty Seven Paise Only',
      error: '',
    });
    expect(describeAmount('1.01').words).to.equal('Rupees One and One Paise Only');
    expect(describeAmount('1.10').words).to.equal('Rupees One and Ten Paise Only');
  });

  it('should use Indian scales for both supported grouping styles', () => {
    const words = 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only';
    ['12345678.90', '1,23,45,678.90', '12,345,678.90'].forEach((value) => {
      expect(describeAmount(value)).to.deep.equal({ words, error: '' });
    });
    expect(describeAmount('999999999.99').words).to.equal('Rupees Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine and Ninety Nine Paise Only');
  });

  it('should handle zero, partial decimals and empty values', () => {
    expect(describeAmount('0').words).to.equal('Rupees Zero Only');
    expect(describeAmount('0.00').words).to.equal('Rupees Zero Only');
    expect(describeAmount('12.').words).to.equal('Rupees Twelve Only');
    expect(describeAmount('.5').words).to.equal('Rupees Zero and Fifty Paise Only');
    ['', null, undefined].forEach((value) => {
      expect(describeAmount(value)).to.deep.equal({ words: '', error: '' });
    });
  });

  it('should explicitly reject invalid, negative, oversized and overprecision amounts', () => {
    ['abc', '.', '-1', '1.234', '1e3', 'Infinity', '1000000000', '1,00', '1,,000', '0,123', '1,234.5.6', ' 12 '].forEach((value) => {
      const { words, error } = describeAmount(value);
      expect(words, value).to.equal('');
      expect(error, value).not.to.equal('');
    });
  });
});
