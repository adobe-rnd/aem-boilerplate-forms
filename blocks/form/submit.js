import { DEFAULT_THANK_YOU_MESSAGE } from './constant.js';

// eslint-disable-next-line no-unused-vars
export function submitSuccess(e, form) {
  const { payload } = e;
  const redirectUrl = payload?.body?.redirectUrl;
  const thankYouMessage = payload?.body?.thankYouMessage;
  if (redirectUrl) {
    window.location.assign(encodeURI(redirectUrl));
  } else {
    let thankYouMsgEl = form.parentNode.querySelector('.form-message.success-message');
    if (!thankYouMsgEl) {
      thankYouMsgEl = document.createElement('div');
      thankYouMsgEl.className = 'form-message success-message';
    }
    thankYouMsgEl.innerHTML = thankYouMessage || DEFAULT_THANK_YOU_MESSAGE;
    form.parentNode.insertBefore(thankYouMsgEl, form);
    if (thankYouMsgEl.scrollIntoView) {
      thankYouMsgEl.scrollIntoView({ behavior: 'smooth' });
    }
    form.reset();
  }
  form.setAttribute('data-submitting', 'false');
  form.querySelector('button[type="submit"]').disabled = false;
}

// eslint-disable-next-line no-unused-vars
export function submitFailure(e, form) {
  let errorMessage = form.querySelector('.form-message.error-message');
  if (!errorMessage) {
    errorMessage = document.createElement('div');
    errorMessage.className = 'form-message error-message';
  }
  errorMessage.innerHTML = 'Some error occured while submitting the form'; // TODO: translation
  form.prepend(errorMessage);
  errorMessage.scrollIntoView({ behavior: 'smooth' });
  form.setAttribute('data-submitting', 'false');
  form.querySelector('button[type="submit"]').disabled = false;
}
