import { createModal } from '../../modal/modal.js';
import { subscribe } from '../rules/index.js';

export default async function decorate(panel) {
  const modal = await createModal(panel);
  subscribe(panel, (fieldDiv, fieldModel, formModel) => {
    const { visible } = formModel.getElement(fieldDiv.dataset.id);
    if (visible === true) {
      modal.showModal();
    }
  }, (fieldDiv, formModel) => {
    if (formModel) {
      formModel.getElement(fieldDiv.dataset.id).visible = false;
    }
  });
  return modal.block;
}
