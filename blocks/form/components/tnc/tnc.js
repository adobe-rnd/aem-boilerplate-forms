// import { subscribe } from '../../rules/index.js';

const textIntersectionClass = 'tnc__intersection';
const textDecorationClass = 'tnc__text-decoration';

class TermsAndConditions {
  constructor(fieldDiv, fieldJson) {
    this.fieldDiv = fieldDiv;
    this.fieldJson = fieldJson;
    this.formModel = null;
    this.decorate();
  }

  setFormModel(model) {
    this.formModel = model;
  }

  getfieldDiv() {
    return this.fieldDiv;
  }

  decorate() {
    const textWrapper = this.fieldDiv.querySelector('.plain-text-wrapper');
    textWrapper.classList.add(textDecorationClass);
    const intersection = document.createElement('div');
    intersection.classList.add(textIntersectionClass);
    textWrapper.appendChild(intersection);
    this.handleScroll();
  }

  handleScroll() {
    const intersection = this.fieldDiv.querySelector(textIntersectionClass);
    if (intersection) {
      console.log(intersection);
      // const self = this;
      // const io = new IntersectionObserver(onIntersection, {
      //     threshold: [1],
      // })
      // function onIntersection ([{isIntersecting}]) {
      //     const isEnabled = self.getModel()?.enabled && !self.getModel()?.readOnly;
      //     if (isIntersecting) {
      //         if (isEnabled) {
      //             self.children.filter(c =>
      //                c.getModel()._jsonModel.fieldType === 'checkbox').forEach(cb => {
      //                   cb.getModel().enabled = true;
      //             })}
      //         io.unobserve(intersection);
      //     }
      // }
      // io.observe(intersection)
    }
  }
}
export default async function decorate(tncDiv, fieldJson) {
  const tnc = new TermsAndConditions(tncDiv, fieldJson);
  // subscribe(tncDiv, async (fieldDiv, formModel) => {
  //     tnc.setFormModel(formModel);
  // })
  return tnc.getfieldDiv();
}
