import { expect } from 'chai';
import {
  snap, parseAmount, formatINR, shortINR,
} from '../../blocks/form/components/loan-slider/loan-slider.js';

describe('loan-slider helpers', () => {
  it('formats amounts in Indian grouping', () => {
    expect(formatINR(500000)).to.equal('₹5,00,000');
    expect(shortINR(50000)).to.equal('50K');
    expect(shortINR(1250000)).to.equal('12.5L');
  });
  it('parses typed text', () => {
    expect(parseAmount('₹5,00,000')).to.equal(500000);
    expect(parseAmount('abc')).to.equal(null);
  });
  it('clamps and snaps to splits', () => {
    expect(snap(10, 50000, 1250000, 100000)).to.equal(50000);
    expect(snap(2e7, 50000, 1250000, 100000)).to.equal(1250000);
    expect(snap(520000, 50000, 1250000, 100000)).to.equal(550000);
  });
});
