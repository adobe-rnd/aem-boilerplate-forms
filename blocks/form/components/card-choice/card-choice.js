import { subscribe } from '../../rules/index.js';

const ICON_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2.5 3.5h11v9h-11z M2.5 6.5h11" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const CHEVRON_RIGHT = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const CHEVRON_LEFT = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

function formatRupees(amount) {
  const num = Number(amount);
  if (amount === undefined || amount === null || amount === '' || Number.isNaN(num)) return '';
  return `₹${num.toLocaleString('en-IN')}/-`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch (e) {
    return '';
  }
}

function createCard(card) {
  const li = el('li', 'card-choice-card');
  li.dataset.cardId = String(card.id);
  li.append(el('h3', 'card-choice-title', card.title || ''));
  if (card.subtitle) li.append(el('p', 'card-choice-subtitle', card.subtitle));

  if (card.image) {
    const imgWrap = el('div', 'card-choice-image');
    const img = document.createElement('img');
    img.src = safeUrl(card.image);
    img.alt = card.title || '';
    img.loading = 'lazy';
    imgWrap.append(img);
    li.append(imgWrap);
  }

  if (Array.isArray(card.features) && card.features.length) {
    const ul = el('ul', 'card-choice-features');
    card.features.forEach((feature) => {
      const item = el('li', 'card-choice-feature');
      const icon = el('span', 'card-choice-feature-icon');
      icon.innerHTML = ICON_SVG;
      item.append(icon, el('span', 'card-choice-feature-text', feature));
      ul.append(item);
    });
    li.append(ul);
  }

  const href = card.detailsUrl ? safeUrl(card.detailsUrl) : '';
  if (href) {
    const link = el('a', 'card-choice-details');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(document.createTextNode('All Features & Benefits'));
    const chevron = el('span', 'card-choice-chevron');
    chevron.innerHTML = CHEVRON_RIGHT;
    link.append(chevron);
    li.append(link);
  }

  if (card.minAmount !== undefined && card.minAmount !== null && card.minAmount !== '') {
    const row = el('div', 'card-choice-amount');
    row.append(
      el('span', 'card-choice-amount-label', 'Min. FD Amount'),
      el('span', 'card-choice-amount-value', formatRupees(card.minAmount)),
    );
    li.append(row);
  }

  const cta = el('button', 'card-choice-cta', card.ctaLabel || 'Get This Card');
  cta.type = 'button';
  cta.setAttribute('aria-pressed', 'false');
  li.append(cta);
  return li;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) {
    input.hidden = true;
    input.style.display = 'none';
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
  }
  fieldDiv.classList.add('card-choice-wrapper');

  const root = el('div', 'card-choice');
  const viewport = el('div', 'card-choice-viewport');
  const track = el('ul', 'card-choice-track');
  track.setAttribute('role', 'list');
  const dots = el('div', 'card-choice-dots');

  const prev = el('button', 'card-choice-arrow card-choice-prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous');
  prev.innerHTML = CHEVRON_LEFT;
  const next = el('button', 'card-choice-arrow card-choice-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next');
  next.innerHTML = CHEVRON_RIGHT;

  viewport.append(track, prev, next);
  root.append(viewport, dots);
  const anchor = fieldDiv.querySelector('.field-description');
  if (anchor) fieldDiv.insertBefore(root, anchor);
  else fieldDiv.append(root);

  let model = null;
  let renderedCards = null;

  const pageSize = () => Math.max(track.clientWidth, 1);

  const updateNav = () => {
    const max = track.scrollWidth - track.clientWidth;
    const pages = dots.children.length;
    if (pages) {
      const idx = max > 0 ? Math.round((track.scrollLeft / max) * (pages - 1)) : 0;
      [...dots.children].forEach((d, i) => d.classList.toggle('active', i === idx));
    }
  };

  const buildDots = () => {
    dots.textContent = '';
    if (track.children.length === 0) return;
    const pages = Math.max(1, Math.ceil(track.scrollWidth / pageSize()));
    for (let i = 0; i < pages; i += 1) {
      const dot = el('button', 'card-choice-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => {
        track.scrollTo({ left: i * pageSize(), behavior: 'smooth' });
      });
      dots.append(dot);
    }
  };

  const syncSelection = () => {
    const value = model ? model.value : input?.value;
    const selected = value === undefined || value === null || value === '' ? null : String(value);
    track.querySelectorAll('.card-choice-card').forEach((card) => {
      const isSelected = selected !== null && card.dataset.cardId === selected;
      card.classList.toggle('selected', isSelected);
      card.querySelector('.card-choice-cta').setAttribute('aria-pressed', String(isSelected));
    });
  };

  const render = (cards) => {
    track.textContent = '';
    if (Array.isArray(cards)) {
      cards.forEach((card) => {
        if (card && typeof card === 'object') track.append(createCard(card));
      });
    }
    renderedCards = cards;
    buildDots();
    syncSelection();
    updateNav();
  };

  const refreshCards = () => {
    const cards = model?.properties?.cards;
    if (cards !== renderedCards && JSON.stringify(cards) !== JSON.stringify(renderedCards)) {
      render(cards);
    }
  };

  prev.addEventListener('click', () => {
    track.scrollBy({ left: -pageSize(), behavior: 'smooth' });
  });
  next.addEventListener('click', () => {
    track.scrollBy({ left: pageSize(), behavior: 'smooth' });
  });
  track.addEventListener('scroll', updateNav, { passive: true });

  track.addEventListener('click', (event) => {
    const cta = event.target.closest('.card-choice-cta');
    if (!cta || !model) return;
    const { cardId } = cta.closest('.card-choice-card').dataset;
    model.value = cardId;
    syncSelection();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (track.children.length) {
        buildDots();
        updateNav();
      }
    }).observe(track);
  }

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      refreshCards();
      syncSelection();
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        const name = change?.propertyName;
        if (name === 'value') {
          syncSelection();
        } else if (name === 'properties' || name?.startsWith('properties.')) {
          refreshCards();
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
