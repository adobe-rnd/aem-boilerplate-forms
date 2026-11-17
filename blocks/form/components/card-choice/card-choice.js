import { subscribe } from '../../rules/index.js';

const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 6.5h12" stroke="currentColor" stroke-width="1.2"/></svg>';
const CHEVRON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_LEFT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function formatAmount(amount) {
  const n = Number(amount);
  if (amount === undefined || amount === null || amount === '' || Number.isNaN(n)) return '';
  return `₹${n.toLocaleString('en-IN')}/-`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCard(card) {
  const item = el('li', 'card-choice-card');
  item.dataset.cardId = card.id;
  item.append(el('h3', 'card-choice-title', card.title));
  if (card.subtitle) item.append(el('p', 'card-choice-subtitle', card.subtitle));
  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.title || '';
    img.loading = 'lazy';
    item.append(img);
  }
  const features = el('ul', 'card-choice-features');
  (card.features || []).forEach((text) => {
    const li = el('li', 'card-choice-feature');
    const icon = el('span', 'card-choice-feature-icon');
    icon.innerHTML = ICON;
    li.append(icon, el('span', 'card-choice-feature-text', text));
    features.append(li);
  });
  item.append(features);
  if (card.detailsUrl) {
    const link = el('a', 'card-choice-link');
    link.href = card.detailsUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(document.createTextNode('All Features & Benefits'));
    const chev = el('span', 'card-choice-link-icon');
    chev.innerHTML = CHEVRON;
    link.append(chev);
    item.append(link);
  }
  if (card.minAmount !== undefined && card.minAmount !== null) {
    const row = el('div', 'card-choice-amount');
    const label = el('span', 'card-choice-amount-label', 'Min. FD Amount');
    const value = el('span', 'card-choice-amount-value', formatAmount(card.minAmount));
    row.append(label, value);
    item.append(row);
  }
  const cta = el('button', 'card-choice-cta', card.ctaLabel || 'Select');
  cta.type = 'button';
  cta.setAttribute('aria-pressed', 'false');
  item.append(cta);
  return item;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) {
    input.hidden = true;
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
  }
  fieldDiv.classList.add('card-choice-wrapper');

  const root = el('div', 'card-choice');
  const track = el('ul', 'card-choice-track');
  track.setAttribute('role', 'list');
  const prev = el('button', 'card-choice-nav card-choice-prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous');
  prev.innerHTML = ARROW_LEFT;
  const next = el('button', 'card-choice-nav card-choice-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next');
  next.innerHTML = ARROW_LEFT;
  const dots = el('div', 'card-choice-dots');
  root.append(track, prev, next, dots);
  (input || fieldDiv).after(root);

  let model = null;
  let cards = [];
  let selected = '';
  let renderedKey = 'null';

  const pageWidth = () => track.clientWidth || 1;
  const scrollByPage = (dir) => {
    const [first, second] = track.querySelectorAll('.card-choice-card');
    const step = first && second
      ? second.getBoundingClientRect().left - first.getBoundingClientRect().left
      : pageWidth();
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const updateNav = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.hidden = track.scrollLeft <= 1;
    next.hidden = max <= 1 || track.scrollLeft >= max - 1;
    const pages = dots.children.length;
    if (pages) {
      const idx = max > 0 ? Math.round((track.scrollLeft / max) * (pages - 1)) : 0;
      [...dots.children].forEach((d, i) => d.classList.toggle('active', i === idx));
    }
  };

  const renderDots = () => {
    dots.replaceChildren();
    const pages = Math.max(1, Math.ceil(track.scrollWidth / pageWidth() - 0.01));
    if (cards.length === 0) return;
    for (let i = 0; i < pages; i += 1) {
      const dot = el('span', 'card-choice-dot');
      dots.append(dot);
    }
  };

  const applySelection = () => {
    track.querySelectorAll('.card-choice-card').forEach((item) => {
      const on = selected !== '' && item.dataset.cardId === selected;
      item.classList.toggle('selected', on);
      item.querySelector('.card-choice-cta').setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };

  const select = (id) => {
    selected = id;
    applySelection();
    if (model && model.value !== id) model.value = id;
  };

  const render = (list) => {
    renderedKey = JSON.stringify(list ?? null);
    cards = Array.isArray(list) ? list.filter((c) => c && c.id !== undefined) : [];
    const items = cards.map((c) => {
      const item = createCard({ ...c, id: String(c.id) });
      item.querySelector('.card-choice-cta').addEventListener('click', () => select(String(c.id)));
      return item;
    });
    track.replaceChildren(...items);
    applySelection();
    renderDots();
    updateNav();
  };

  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  track.addEventListener('scroll', updateNav, { passive: true });
  window.addEventListener('resize', () => { renderDots(); updateNav(); });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      selected = model.value !== undefined && model.value !== null ? String(model.value) : '';
      render(model.properties?.cards);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        const name = change?.propertyName;
        if (name === 'properties.cards' || name === 'properties') {
          const curCards = name === 'properties' ? change.currentValue?.cards : change.currentValue;
          const key = JSON.stringify(curCards ?? null);
          if (key !== renderedKey) render(curCards);
        } else if (change?.propertyName === 'value') {
          const v = change.currentValue;
          selected = v !== undefined && v !== null ? String(v) : '';
          applySelection();
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
