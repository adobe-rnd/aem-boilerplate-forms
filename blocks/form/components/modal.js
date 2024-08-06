import { createModal } from '../../modal/modal.js';
import { subscribe } from '../rules/index.js';

export default async function decorate(panel) {
  const modal = await createModal(panel);
  subscribe(panel, async (fieldDiv, formModel) => {
    modal.setFormModel(formModel);
    if (formModel.getElement(fieldDiv.id).visible === true) {
      modal.showModal();
    }
  });
  return modal.block;
}
