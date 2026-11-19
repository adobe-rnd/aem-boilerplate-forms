import { subscribe } from '../../rules/index.js';

const CARDS_PROPERTY = 'cards';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function parseCards(data) {
  let cards = data;
  if (typeof cards === 'string') {
    try {
      cards = JSON.parse(cards);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(cards) ? cards.filter((card) => card && typeof card === 'object') : [];
}

function cardKey(card, index) {
  return String(card.id ?? card.name ?? index);
}

function parseSelected(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function formatAmount(amount) {
  if (typeof amount === 'number') return `₹ ${amount.toLocaleString('en-IN')}/-`;
  return amount;
}

function createFeature(feature) {
  const item = el('li', 'card-choice-feature');
  const text = typeof feature === 'object' ? feature.text : feature;
  const icon = typeof feature === 'object' ? feature.icon : null;
  if (icon) {
    const img = el('img', 'card-choice-feature-icon');
    img.src = icon;
    img.alt = '';
    item.append(img);
  } else {
    item.append(el('span', 'card-choice-feature-icon card-choice-feature-icon-default'));
  }
  item.append(el('span', 'card-choice-feature-text', text));
  return item;
}

function createCard(card, index, selected, enabled, onSelect) {
  const article = el('article', 'card-choice-card');
  article.dataset.cardKey = cardKey(card, index);
  article.append(el('h3', 'card-choice-title', card.name));
  if (card.tagline) article.append(el('p', 'card-choice-tagline', card.tagline));
  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.name || '';
    img.loading = 'lazy';
    article.append(img);
  }
  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-features');
    card.features.forEach((feature) => list.append(createFeature(feature)));
    article.append(list);
  }
  if (card.link?.url || card.link?.label) {
    const link = el('a', 'card-choice-link', card.link.label || 'All Features & Benefits');
    link.href = card.link.url || '#';
    article.append(link);
  }
  if (card.minAmount !== undefined && card.minAmount !== null) {
    const amount = el('div', 'card-choice-amount');
    amount.append(
      el('span', 'card-choice-amount-label', card.minAmountLabel || 'Min. FD Amount'),
      el('span', 'card-choice-amount-value', formatAmount(card.minAmount)),
    );
    article.append(amount);
  }
  const button = el('button', 'card-choice-select', card.ctaLabel || 'Get This Card');
  button.type = 'button';
  button.disabled = !enabled;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => onSelect(card));
  article.append(button);
  if (selected) article.classList.add('selected');
  return article;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  input.type = 'hidden';
  fieldDiv.classList.add('card-choice-wrapper');

  const widget = el('div', 'card-choice-widget');
  const prev = el('button', 'card-choice-nav card-choice-prev');
  const next = el('button', 'card-choice-nav card-choice-next');
  [[prev, 'Previous cards', '‹'], [next, 'Next cards', '›']].forEach(([btn, label, glyph]) => {
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.textContent = glyph;
  });
  const track = el('div', 'card-choice-track');
  track.tabIndex = 0;
  track.setAttribute('role', 'group');
  track.setAttribute('aria-label', 'Cards');
  const dots = el('div', 'card-choice-dots');
  widget.append(prev, track, next, dots);
  input.after(widget);

  let model = null;
  let cards = parseCards(fieldJson?.properties?.[CARDS_PROPERTY]);
  let enabled = fieldJson?.enabled !== false && fieldJson?.readOnly !== true;

  const pageCount = () => Math.max(
    1,
    Math.ceil(track.scrollWidth / Math.max(track.clientWidth, 1) - 0.05),
  );

  const updateNav = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    prev.hidden = track.scrollLeft <= 1;
    next.hidden = maxScroll <= 1 || track.scrollLeft >= maxScroll - 1;
    const pages = pageCount();
    const atEnd = maxScroll > 0 && track.scrollLeft >= maxScroll - 1;
    const page = atEnd
      ? pages - 1
      : Math.min(pages - 1, Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
    dots.hidden = pages <= 1;
    if (dots.children.length !== pages) {
      dots.replaceChildren(...Array.from({ length: pages }, () => el('span', 'card-choice-dot')));
    }
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('active', i === page));
  };

  const scrollByPage = (direction) => {
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' });
  };
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  track.addEventListener('scroll', updateNav, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') scrollByPage(1);
    if (e.key === 'ArrowLeft') scrollByPage(-1);
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateNav).observe(track);

  const currentKey = () => {
    const selected = parseSelected(input.value);
    if (!selected) return null;
    const idx = cards.findIndex((card, i) => cardKey(card, i) === cardKey(selected, -1)
      || (selected.id === undefined && selected.name === card.name));
    return idx >= 0 ? cardKey(cards[idx], idx) : null;
  };

  const markSelected = () => {
    const key = currentKey();
    track.querySelectorAll('.card-choice-card').forEach((node) => {
      const isSelected = node.dataset.cardKey === key;
      node.classList.toggle('selected', isSelected);
      node.querySelector('.card-choice-select')?.setAttribute('aria-pressed', String(isSelected));
    });
  };

  const select = (card) => {
    const value = JSON.stringify(card);
    if (input.value === value) return;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    markSelected();
  };

  const render = () => {
    track.replaceChildren(...cards.map((card, i) => createCard(card, i, false, enabled, select)));
    widget.classList.toggle('empty', cards.length === 0);
    markSelected();
    updateNav();
  };

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      cards = parseCards(model.properties?.[CARDS_PROPERTY]);
      enabled = model.enabled !== false && model.readOnly !== true;
      if (model.value && !input.value) input.value = model.value;
      render();
    } else if (eventType === 'change') {
      let rerender = false;
      payload?.changes?.forEach(({ propertyName, currentValue }) => {
        if (propertyName === `properties.${CARDS_PROPERTY}`) {
          cards = parseCards(currentValue);
          rerender = true;
        } else if (propertyName === 'properties') {
          cards = parseCards(currentValue?.[CARDS_PROPERTY]);
          rerender = true;
        } else if (propertyName === 'enabled' || propertyName === 'readOnly') {
          enabled = model.enabled !== false && model.readOnly !== true;
          rerender = true;
        } else if (propertyName === 'value') {
          const newValue = currentValue ?? '';
          if (input.value !== newValue) input.value = newValue;
          markSelected();
        }
      });
      if (rerender) render();
    }
  }, { listenChanges: true });

  render();
  return fieldDiv;
}
