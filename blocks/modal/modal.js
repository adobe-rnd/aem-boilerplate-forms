import {
  buildBlock, decorateBlock, decorateIcons, loadBlock, loadCSS,
} from '../../scripts/aem.js';

async function decorate(panel) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/modal/modal.css`);
  const dialog = document.createElement('dialog');
  const dialogContent = document.createElement('div');
  dialogContent.classList.add('modal-content');
  dialogContent.append(panel);
  dialog.append(dialogContent);
  const closeButton = document.createElement('button');
  closeButton.classList.add('close-button');
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.type = 'button';
  closeButton.innerHTML = '<span class="icon icon-close"></span>';
  dialog.append(closeButton);
  decorateIcons(closeButton);
  // close dialog on clicks outside the dialog. https://stackoverflow.com/a/70593278/79461
  dialog.addEventListener('click', (event) => {
    const dialogDimensions = dialog.getBoundingClientRect();
    if (event.clientX < dialogDimensions.left || event.clientX > dialogDimensions.right
        || event.clientY < dialogDimensions.top || event.clientY > dialogDimensions.bottom) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
  });
  return dialog;
}

async function buildModalBlock(dialog) {
  const block = buildBlock('modal', '');
  const wrapper = document.createElement('div');
  wrapper.appendChild(block);
  decorateBlock(block);
  await loadBlock(block);
  block.append(dialog);
  return block;
}

// eslint-disable-next-line import/prefer-default-export
export async function createModal(panel) {
  let formModel = null;
  const dialog = await decorate(panel);
  dialog.querySelector('.close-button').addEventListener('click', () => {
    dialog.close();
    formModel.getElement(panel?.id).visible = false; // updating formModel to hide the modal
  });
  const block = await buildModalBlock(dialog);
  return {
    block,
    setFormModel: (model) => {
      formModel = model;
    },
    showModal: () => {
      panel?.closest('dialog')?.showModal();
      setTimeout(() => { dialog.querySelector('.modal-content').scrollTop = 0; }, 0);
      document.body.classList.add('modal-open');
    },
  };
}
