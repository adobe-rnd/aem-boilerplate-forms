import { expect } from 'chai';
import decorate, { formatShort, getBounds } from '../../blocks/form/components/loan-slider/loan-slider.js';

function setup(fd) {
  const field = document.createElement('div');
  field.dataset.id = 'loan';
  field.innerHTML = '<label>Loan</label><input type="number" name="loan">';
  return decorate(field, fd, null, 'form1').then(() => field);
}

describe('Loan slider component', () => {
  it('formats amounts in Indian shorthand', () => {
    expect(formatShort(50000)).to.equal('50K');
    expect(formatShort(1250000)).to.equal('12.5L');
    expect(formatShort(20000000)).to.equal('2Cr');
  });

  it('falls back to default bounds', () => {
    expect(getBounds({})).to.deep.equal({ min: 0, max: 100, splits: 10 });
    expect(getBounds({ minimum: 10, maximum: 5, properties: { splits: 4 } }).max).to.equal(11);
  });

  it('generates equal splits between min and max', async () => {
    const field = await setup({ minimum: 0, maximum: 1000000, properties: { splits: 5 } });
    const ticks = [...field.querySelectorAll('.loan-slider-tick')].map((t) => t.dataset.value);
    expect(ticks).to.deep.equal(['200000', '400000', '600000', '800000']);
    expect(field.querySelector('.loan-slider-range').step).to.equal('200000');
  });

  it('syncs slider and text box both ways', async () => {
    const field = await setup({ minimum: 0, maximum: 1000, properties: { splits: 10 } });
    const input = field.querySelector('.loan-slider-input input');
    const slider = field.querySelector('.loan-slider-range');
    slider.value = '300';
    slider.dispatchEvent(new window.Event('input'));
    expect(input.value).to.equal('300');
    input.value = '700';
    input.dispatchEvent(new window.Event('input'));
    expect(slider.value).to.equal('700');
  });
});
