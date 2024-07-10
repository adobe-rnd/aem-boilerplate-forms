import { createModal } from '../../modal/modal.js';
import { subscribe } from '../util.js';

export default async function decorate(panel) {
  const modal = await createModal(panel);
  subscribe(panel, (fieldDiv, fieldModel) => {
    if (fieldModel?.visible === true) {
      modal.showModal();
    }
  });
  return modal.block;
}
