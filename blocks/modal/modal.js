import {
  buildBlock, decorateBlock, decorateIcons, loadBlock, loadCSS,
} from '../../scripts/aem.js';

// This is not a traditional block, so there is no decorate function. Instead, links to
// a */modals/* path  are automatically transformed into a modal. Other blocks can also use
// the createModal() and openModal() functions.

// eslint-disable-next-line import/prefer-default-export
export async function createModal(panel) {
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
  closeButton.addEventListener('click', () => {
    dialog.close();
    dialog.querySelector('fieldset').dataset.visible = 'false';
  });
  dialog.append(closeButton);

  // close dialog on clicks outside the dialog. https://stackoverflow.com/a/70593278/79461
  dialog.addEventListener('click', (event) => {
    const dialogDimensions = dialog.getBoundingClientRect();
    if (event.clientX < dialogDimensions.left || event.clientX > dialogDimensions.right
      || event.clientY < dialogDimensions.top || event.clientY > dialogDimensions.bottom) {
      dialog.close();
    }
  });

  const block = buildBlock('modal', '');
  const wrapper = document.createElement('div');
  wrapper.appendChild(block);
  decorateBlock(block);
  await loadBlock(block);
  decorateIcons(closeButton);

  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    // block.remove();
  });

  block.append(dialog);
  return {
    block,
    showModal: () => {
      panel?.closest('dialog')?.showModal();
      // Google Chrome restores the scroll position when the dialog is reopened,
      // so we need to reset it.
      setTimeout(() => { dialogContent.scrollTop = 0; }, 0);

      document.body.classList.add('modal-open');
    },
  };
}
