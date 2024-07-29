import { createModal } from '../../modal/modal.js';
import { subscribe } from '../rules/index.js';

export default async function decorate(panel) {
  const modal = await createModal(panel);
  subscribe(panel, (fieldDiv, fieldModel, formModel) => {
    if (formModel?.getElement(fieldDiv?.dataset?.id).visible === true) {
      modal.showModal();
    }
  }, (fieldDiv, formModel) => {
    console.log('updateFormModelCallback invoked');
    if (formModel) {
      formModel.getElement(fieldDiv.dataset.id).visible = false;
    }
  });
  return modal.block;
}
