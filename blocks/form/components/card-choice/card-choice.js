import { subscribe } from '../../rules/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseCards(raw) {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  if (data && !Array.isArray(data) && Array.isArray(data.cards)) {
    data = data.cards;
  }
  return Array.isArray(data) ? data.filter((card) => card && typeof card === 'object') : [];
}

function parseSelection(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function cardKey(card) {
  return String(card?.id ?? card?.title ?? '');
}

function isSame(a, b) {
  return !!a && !!b && cardKey(a) === cardKey(b);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
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

function formatAmount(amount) {
  if (typeof amount === 'number') {
    return `₹ ${amount.toLocaleString('en-IN')}/-`;
  }
  return amount;
}

function createFeatures(features) {
  const list = el('ul', 'card-choice-features');
  (features || []).forEach((feature) => {
    const text = typeof feature === 'string' ? feature : feature?.text;
    if (!text) return;
    const item = el('li', 'card-choice-feature');
    item.append(el('span', 'card-choice-feature-icon'), el('span', 'card-choice-feature-text', text));
    list.append(item);
  });
  return list;
}

function createLink(card) {
  const link = card.featuresLink || {};
  const label = link.label || card.featuresLabel || 'All Features & Benefits';
  const url = link.url || card.featuresUrl;
  const anchor = el('a', 'card-choice-link');
  if (url) {
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  anchor.append(el('span', '', label), createChevron());
  return anchor;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  const props = fieldJson?.properties || {};
  const labels = {
    minAmount: props.minAmountLabel || 'Min. FD Amount',
    cta: props.ctaLabel || 'Get This Card',
  };
  const state = {
    model: null,
    cards: parseCards(props.cards),
    selected: parseSelection(fieldJson?.value),
    category: null,
    serialized: null,
  };

  fieldDiv.classList.add('card-choice-wrapper');
  if (input) input.style.display = 'none';

  const widget = el('div', 'card-choice');
  const header = el('div', 'card-choice-header');
  const heading = el('div', 'card-choice-heading');
  if (props.subtitle) heading.append(el('p', 'card-choice-subtitle', props.subtitle));
  const filters = el('div', 'card-choice-filters');
  filters.setAttribute('role', 'tablist');
  header.append(heading, filters);

  const viewport = el('div', 'card-choice-viewport');
  const track = el('div', 'card-choice-track');
  track.setAttribute('role', 'list');
  track.tabIndex = 0;
  const prev = el('button', 'card-choice-nav card-choice-prev');
  const next = el('button', 'card-choice-nav card-choice-next');
  [prev, next].forEach((btn) => { btn.type = 'button'; btn.append(createChevron()); });
  prev.setAttribute('aria-label', 'Previous cards');
  next.setAttribute('aria-label', 'Next cards');
  viewport.append(track, prev, next);
  const dots = el('div', 'card-choice-dots');
  widget.append(header, viewport, dots);

  const label = fieldDiv.querySelector('label');
  if (label) label.after(widget); else fieldDiv.prepend(widget);

  const visibleCards = () => state.cards
    .filter((card) => !state.category || card.category === state.category);

  const updateSelectionView = () => {
    track.querySelectorAll('.card-choice-card').forEach((node) => {
      const selected = node.card && isSame(node.card, state.selected);
      node.classList.toggle('selected', !!selected);
      node.setAttribute('aria-selected', selected ? 'true' : 'false');
      const btn = node.querySelector('.card-choice-select');
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  };

  const updateCarouselState = () => {
    const { scrollLeft, scrollWidth, clientWidth } = track;
    const maxScroll = Math.max(scrollWidth - clientWidth, 0);
    prev.hidden = scrollLeft <= 1;
    next.hidden = scrollLeft >= maxScroll - 1;
    const pages = clientWidth ? Math.max(Math.ceil(scrollWidth / clientWidth - 0.05), 1) : 1;
    if (dots.children.length !== pages) {
      dots.replaceChildren(...Array.from({ length: pages }, (_, i) => {
        const dot = el('button', 'card-choice-dot');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to page ${i + 1}`);
        dot.addEventListener('click', () => track.scrollTo({ left: i * clientWidth, behavior: 'smooth' }));
        return dot;
      }));
    }
    dots.hidden = pages <= 1;
    const active = maxScroll ? Math.round((scrollLeft / maxScroll) * (pages - 1)) : 0;
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('active', i === active));
  };

  const select = (card) => {
    if (isSame(card, state.selected)) return;
    state.selected = card;
    updateSelectionView();
    if (input) {
      input.value = JSON.stringify(card);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const createCard = (card) => {
    const node = el('div', 'card-choice-card');
    node.setAttribute('role', 'listitem');
    node.card = card;
    node.append(el('h3', 'card-choice-title', card.title || card.name));
    if (card.subtitle || card.tagline) {
      node.append(el('p', 'card-choice-tagline', card.subtitle || card.tagline));
    }
    if (card.image) {
      const media = el('div', 'card-choice-media');
      const img = document.createElement('img');
      img.src = card.image;
      img.alt = card.imageAlt || card.title || '';
      img.loading = 'lazy';
      media.append(img);
      node.append(media);
    }
    node.append(createFeatures(card.features), createLink(card));
    if (card.minAmount !== undefined && card.minAmount !== null) {
      const amount = el('div', 'card-choice-amount');
      amount.append(
        el('span', 'card-choice-amount-label', card.minAmountLabel || labels.minAmount),
        el('span', 'card-choice-amount-value', formatAmount(card.minAmount)),
      );
      node.append(amount);
    }
    const btn = el('button', 'card-choice-select', card.ctaLabel || labels.cta);
    btn.type = 'button';
    btn.addEventListener('click', () => select(card));
    node.append(btn);
    return node;
  };

  const renderCards = () => {
    track.replaceChildren(...visibleCards().map(createCard));
    track.scrollLeft = 0;
    updateSelectionView();
    updateCarouselState();
  };

  const renderFilters = () => {
    const categories = [...new Set(state.cards.map((c) => c.category).filter(Boolean))];
    filters.hidden = categories.length < 2;
    if (!categories.includes(state.category)) {
      state.category = categories.length > 1 ? categories[0] : null;
    }
    filters.replaceChildren(...(categories.length > 1 ? categories : []).map((category) => {
      const btn = el('button', 'card-choice-filter', category);
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(category === state.category));
      btn.classList.toggle('active', category === state.category);
      btn.addEventListener('click', () => {
        state.category = category;
        renderFilters();
        renderCards();
      });
      return btn;
    }));
  };

  const setCards = (raw) => {
    const cards = parseCards(raw);
    const serialized = JSON.stringify(cards);
    if (serialized === state.serialized) return;
    state.serialized = serialized;
    state.cards = cards;
    renderFilters();
    renderCards();
  };

  const scrollByPage = (direction) => {
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' });
  };
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  track.addEventListener('scroll', () => window.requestAnimationFrame(updateCarouselState), { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') scrollByPage(1);
    if (e.key === 'ArrowLeft') scrollByPage(-1);
  });
  window.addEventListener('resize', updateCarouselState);

  const syncValue = (value) => {
    const selection = parseSelection(value);
    if (isSame(selection, state.selected) || (!selection && !state.selected)) return;
    state.selected = selection;
    if (input) input.value = value ? JSON.stringify(selection) : '';
    updateSelectionView();
  };

  setCards(state.cards);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      state.model = fieldModel;
      if (fieldModel.properties?.cards) setCards(fieldModel.properties.cards);
      if (fieldModel.value) syncValue(fieldModel.value);
      fieldModel.subscribe((e) => setCards(e?.payload), 'setCards');
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        const { propertyName, currentValue } = change;
        if (propertyName === 'properties.cards') {
          setCards(currentValue);
        } else if (propertyName === 'properties' && currentValue?.cards) {
          setCards(currentValue.cards);
        } else if (propertyName === 'value') {
          syncValue(currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
