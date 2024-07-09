import { createModal } from '../../modal/modal.js';

const handleMutation = (modal, mutations) => {
  mutations.forEach((mutation) => {
    const { type, target, attributeName } = mutation;
    if (type === 'attributes' && attributeName === 'data-visible') {
      if (target.dataset.visible === 'true') {
        modal.showModal();
      }
    }
  });
};

const attachMutationObserver = (modal) => {
  const panel = modal.block?.querySelector('fieldset');
  const config = { attributes: true, subtree: false };
  const observer = new MutationObserver((mutations) => {
    handleMutation(modal, mutations);
  });
  observer.observe(panel, config);
};

export default async function decorate(panel) {
  const modal = await createModal(panel);
  attachMutationObserver(modal);
  return modal.block;
}
