import { subscribe } from '../../rules/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null && text !== '') node.textContent = text;
  return node;
}

function safeUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
  } catch (e) {
    return '';
  }
}

function parseCards(raw) {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter((card) => card && typeof card === 'object')
    .map((card, index) => ({
      ...card,
      cardId: card.id !== undefined && card.id !== null ? String(card.id) : `card-${index}`,
      source: card,
    }));
}

function parseValue(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function createChevron() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M9 5l7 7-7 7');
  svg.append(path);
  return svg;
}

function createFeature(feature) {
  const item = el('li', 'card-choice-feature');
  const text = typeof feature === 'string' ? feature : feature?.text;
  const icon = typeof feature === 'object' ? safeUrl(feature?.icon) : '';
  if (icon) {
    const img = el('img', 'card-choice-feature-icon');
    img.src = icon;
    img.alt = '';
    img.loading = 'lazy';
    item.append(img);
  } else {
    item.append(el('span', 'card-choice-feature-icon default'));
  }
  item.append(el('span', 'card-choice-feature-text', text));
  return item;
}

function createCard(card, labels, onSelect) {
  const item = el('li', 'card-choice-card');
  item.dataset.cardId = card.cardId;
  if (card.category) item.dataset.category = card.category;

  item.append(el('h3', 'card-choice-title', card.title));
  if (card.subtitle) item.append(el('p', 'card-choice-subtitle', card.subtitle));

  const imageSrc = safeUrl(card.image);
  if (imageSrc) {
    const img = el('img', 'card-choice-image');
    img.src = imageSrc;
    img.alt = card.imageAlt || card.title || '';
    img.loading = 'lazy';
    item.append(img);
  }

  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-features');
    card.features.forEach((feature) => list.append(createFeature(feature)));
    item.append(list);
  }

  const linkHref = safeUrl(card.linkUrl);
  if (card.linkText) {
    const link = el(linkHref ? 'a' : 'span', 'card-choice-link', card.linkText);
    if (linkHref) {
      link.href = linkHref;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.append(createChevron());
    item.append(link);
  }

  if (card.minAmount !== undefined && card.minAmount !== null && card.minAmount !== '') {
    const amount = el('div', 'card-choice-amount');
    amount.append(
      el('span', 'card-choice-amount-label', card.minAmountLabel || ''),
      el('span', 'card-choice-amount-value', card.minAmount),
    );
    item.append(amount);
  }

  const button = el('button', 'card-choice-select', labels.select);
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => onSelect(card));
  item.append(button);
  return item;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  const labels = {
    select: fieldJson?.properties?.selectLabel || 'Get This Card',
    selected: fieldJson?.properties?.selectedLabel || 'Selected',
  };
  let model = null;
  let cards = [];
  let selectedId = null;
  let activeCategory = null;

  if (input) input.style.display = 'none';

  const widget = el('div', 'card-choice-widget');
  const tabs = el('div', 'card-choice-tabs');
  tabs.setAttribute('role', 'tablist');
  const viewport = el('div', 'card-choice-viewport');
  const track = el('ul', 'card-choice-track');
  track.tabIndex = 0;
  const prev = el('button', 'card-choice-nav prev');
  const next = el('button', 'card-choice-nav next');
  [prev, next].forEach((btn, i) => {
    btn.type = 'button';
    btn.setAttribute('aria-label', i === 0 ? 'Previous cards' : 'Next cards');
    btn.append(createChevron());
  });
  const dots = el('div', 'card-choice-dots');
  viewport.append(track, prev, next);
  widget.append(tabs, viewport, dots);
  const helpText = fieldDiv.querySelector('.field-description');
  if (helpText) fieldDiv.insertBefore(widget, helpText);
  else fieldDiv.append(widget);

  const pageSize = () => Math.max(track.clientWidth, 1);
  const pageCount = () => Math.max(1, Math.ceil((track.scrollWidth - 1) / pageSize()));

  const updateCarousel = () => {
    const pages = pageCount();
    const current = Math.min(pages - 1, Math.round(track.scrollLeft / pageSize()));
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    prev.hidden = track.scrollLeft <= 2;
    next.hidden = atEnd;
    if (dots.children.length !== pages) {
      dots.replaceChildren(...Array.from({ length: pages }, (_, i) => {
        const dot = el('button', 'card-choice-dot');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to page ${i + 1}`);
        dot.addEventListener('click', () => track.scrollTo({ left: i * pageSize(), behavior: 'smooth' }));
        return dot;
      }));
    }
    dots.hidden = pages <= 1;
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('active', i === current));
  };

  const updateSelection = () => {
    track.querySelectorAll('.card-choice-card').forEach((item) => {
      const isSelected = item.dataset.cardId === selectedId;
      item.classList.toggle('selected', isSelected);
      const button = item.querySelector('.card-choice-select');
      button.setAttribute('aria-pressed', String(isSelected));
      button.textContent = isSelected ? labels.selected : labels.select;
    });
  };

  const applyCategory = () => {
    track.querySelectorAll('.card-choice-card').forEach((item) => {
      item.hidden = Boolean(activeCategory) && item.dataset.category !== activeCategory;
    });
    tabs.querySelectorAll('.card-choice-tab').forEach((tab) => {
      const isActive = tab.dataset.category === activeCategory;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
    track.scrollLeft = 0;
    updateCarousel();
  };

  const select = (card) => {
    selectedId = card.cardId;
    updateSelection();
    if (model) {
      model.value = JSON.stringify(card.source);
    }
  };

  const syncFromValue = (value) => {
    const selected = parseValue(value);
    const match = selected && cards.find((card) => (
      (selected.id !== undefined && String(selected.id) === card.cardId)
      || (selected.title !== undefined && selected.title === card.title)));
    selectedId = match ? match.cardId : null;
    updateSelection();
  };

  const render = (rawCards) => {
    cards = parseCards(rawCards);
    const categories = [...new Set(cards.map((card) => card.category).filter(Boolean))];
    if (!categories.includes(activeCategory)) [activeCategory] = categories;
    tabs.replaceChildren(...(categories.length > 1 ? categories.map((category) => {
      const tab = el('button', 'card-choice-tab', category);
      tab.type = 'button';
      tab.dataset.category = category;
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', () => {
        activeCategory = category;
        applyCategory();
      });
      return tab;
    }) : []));
    if (categories.length <= 1) activeCategory = null;
    tabs.hidden = categories.length <= 1;
    track.replaceChildren(...cards.map((card) => createCard(card, labels, select)));
    syncFromValue(model?.value);
    applyCategory();
  };

  prev.addEventListener('click', () => track.scrollBy({ left: -pageSize(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: pageSize(), behavior: 'smooth' }));
  track.addEventListener('scroll', updateCarousel, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next.click();
    else if (e.key === 'ArrowLeft') prev.click();
  });
  if (window.ResizeObserver) new ResizeObserver(updateCarousel).observe(track);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      render(fieldModel.properties?.cards);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'properties.cards') {
          render(change.currentValue);
        } else if (change?.propertyName === 'value') {
          syncFromValue(change.currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
