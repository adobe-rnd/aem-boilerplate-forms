import { subscribe } from '../../rules/index.js';

const ALL = 'All';

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
  if (cards && !Array.isArray(cards) && Array.isArray(cards.cards)) {
    cards = cards.cards;
  }
  return Array.isArray(cards) ? cards.filter((c) => c && typeof c === 'object') : [];
}

function cardKey(card, index) {
  return String(card.id ?? card.name ?? index);
}

function parseSelection(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function createCard(card, key, opts) {
  const li = el('li', 'card-choice-card');
  li.dataset.cardId = key;
  li.append(el('h3', 'card-choice-card-title', card.name));
  if (card.description) li.append(el('p', 'card-choice-card-description', card.description));

  if (card.image) {
    const imgWrap = el('div', 'card-choice-card-image');
    const img = document.createElement('img');
    img.src = card.image;
    img.alt = card.imageAlt || card.name || '';
    img.loading = 'lazy';
    imgWrap.append(img);
    li.append(imgWrap);
  }

  if (Array.isArray(card.features) && card.features.length) {
    const ul = el('ul', 'card-choice-card-features');
    card.features.forEach((f) => {
      const item = el('li');
      const feature = typeof f === 'string' ? { text: f } : f || {};
      if (feature.icon) {
        const icon = document.createElement('img');
        icon.src = feature.icon;
        icon.alt = '';
        icon.className = 'card-choice-feature-icon';
        item.append(icon);
      }
      item.append(el('span', null, feature.text));
      ul.append(item);
    });
    li.append(ul);
  }

  if (card.linkText) {
    const link = el('a', 'card-choice-card-link', card.linkText);
    link.href = card.linkUrl || '#';
    li.append(link);
  }

  if (card.minAmount !== undefined && card.minAmount !== null && card.minAmount !== '') {
    const amount = el('div', 'card-choice-card-amount');
    amount.append(
      el('span', 'card-choice-amount-label', card.minAmountLabel || opts.minAmountLabel),
      el('span', 'card-choice-amount-value', card.minAmount),
    );
    li.append(amount);
  }

  const button = el('button', 'card-choice-card-select', card.ctaLabel || opts.ctaLabel);
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  li.append(button);
  return { li, button };
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  const props = fieldJson?.properties || {};
  const opts = {
    ctaLabel: props.ctaLabel || 'Get This Card',
    minAmountLabel: props.minAmountLabel || 'Min. FD Amount',
  };
  let model = null;
  let cards = [];
  let category = ALL;

  if (input) input.style.display = 'none';
  fieldDiv.classList.add('card-choice-wrapper');

  const header = el('div', 'card-choice-header');
  const titles = el('div', 'card-choice-titles');
  const heading = fieldDiv.querySelector('label');
  if (heading) {
    heading.classList.add('card-choice-heading');
    titles.append(heading);
  }
  if (props.subtitle) titles.append(el('p', 'card-choice-subtitle', props.subtitle));
  const filters = el('div', 'card-choice-filters');
  filters.setAttribute('role', 'group');
  header.append(titles, filters);

  const carousel = el('div', 'card-choice-carousel');
  const track = el('ul', 'card-choice-track');
  track.setAttribute('role', 'list');
  const prev = el('button', 'card-choice-nav card-choice-prev', '‹');
  const next = el('button', 'card-choice-nav card-choice-next', '›');
  prev.type = 'button';
  next.type = 'button';
  prev.setAttribute('aria-label', 'Previous cards');
  next.setAttribute('aria-label', 'Next cards');
  carousel.append(prev, track, next);
  const dots = el('div', 'card-choice-dots');

  const anchor = input || fieldDiv.firstChild;
  fieldDiv.insertBefore(header, anchor);
  fieldDiv.insertBefore(carousel, anchor);
  fieldDiv.insertBefore(dots, anchor);

  const step = () => Math.max(track.clientWidth, 1);
  const scrollByPage = (dir) => track.scrollBy({ left: dir * step(), behavior: 'smooth' });
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));

  function updateNav() {
    const max = track.scrollWidth - track.clientWidth;
    prev.hidden = track.scrollLeft <= 1;
    next.hidden = max <= 1 || track.scrollLeft >= max - 1;
    const pages = Math.max(1, Math.ceil(track.scrollWidth / step() - 0.05));
    const current = max <= 1 ? 0 : Math.round((track.scrollLeft / max) * (pages - 1));
    if (dots.children.length !== pages) {
      dots.replaceChildren(...Array.from({ length: pages }, (_, i) => {
        const dot = el('button', 'card-choice-dot');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to page ${i + 1}`);
        dot.addEventListener('click', () => track.scrollTo({
          left: pages > 1 ? (i / (pages - 1)) * (track.scrollWidth - track.clientWidth) : 0,
          behavior: 'smooth',
        }));
        return dot;
      }));
    }
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === current));
    dots.hidden = pages <= 1;
  }
  track.addEventListener('scroll', () => window.requestAnimationFrame(updateNav));
  window.addEventListener('resize', updateNav);

  function markSelected(value) {
    const selected = parseSelection(value);
    const selectedKey = selected ? cardKey(selected, -1) : null;
    track.querySelectorAll('.card-choice-card').forEach((li) => {
      const isSelected = selectedKey !== null && li.dataset.cardId === selectedKey;
      li.classList.toggle('selected', isSelected);
      li.querySelector('.card-choice-card-select').setAttribute('aria-pressed', String(isSelected));
    });
  }

  function select(card) {
    const value = JSON.stringify(card);
    if (model && model.value !== value) {
      model.value = value;
    }
    if (input && input.value !== value) input.value = value;
    markSelected(value);
  }

  function renderCards() {
    const visible = cards
      .map((card, i) => ({ card, key: cardKey(card, i) }))
      .filter(({ card }) => category === ALL || card.category === category);
    track.replaceChildren(...visible.map(({ card, key }) => {
      const { li, button } = createCard(card, key, opts);
      button.addEventListener('click', () => select(card));
      return li;
    }));
    markSelected(model ? model.value : input?.value);
    track.scrollLeft = 0;
    updateNav();
  }

  function renderFilters() {
    const categories = [...new Set(cards.map((c) => c.category).filter(Boolean))];
    if (category !== ALL && !categories.includes(category)) category = ALL;
    filters.hidden = categories.length < 2;
    filters.replaceChildren(...[ALL, ...categories].map((name) => {
      const pill = el('button', 'card-choice-filter', name === ALL ? ALL : name);
      pill.type = 'button';
      pill.setAttribute('aria-pressed', String(name === category));
      pill.classList.toggle('active', name === category);
      pill.addEventListener('click', () => {
        category = name;
        renderFilters();
        renderCards();
      });
      return pill;
    }));
  }

  function setCards(data) {
    cards = parseCards(data);
    renderFilters();
    renderCards();
  }

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      // A rule supplies the card array through this custom event
      fieldModel.subscribe((e) => setCards(e?.payload), 'setCards');
      const initial = fieldModel.properties?.cards ?? props.cards;
      if (initial) setCards(initial);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          markSelected(change.currentValue);
        } else if (change?.propertyName === 'properties' && change.currentValue?.cards
          && JSON.stringify(change.currentValue.cards) !== JSON.stringify(cards)) {
          setCards(change.currentValue.cards);
        }
      });
    }
  }, { listenChanges: true });

  updateNav();
  return fieldDiv;
}
