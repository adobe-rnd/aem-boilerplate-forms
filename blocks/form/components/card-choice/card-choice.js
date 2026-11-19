import { subscribe } from '../../rules/index.js';

function toCards(data) {
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

function parseValue(value) {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (e) {
    return null;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function featureText(feature) {
  return typeof feature === 'object' && feature !== null ? feature.text : feature;
}

function createCard(card, index, selectLabel) {
  const item = el('div', 'card-choice-card');
  item.setAttribute('role', 'listitem');
  item.dataset.index = index;

  item.append(el('h3', 'card-choice-title', card.name || card.title));
  if (card.tagline || card.subtitle) {
    item.append(el('p', 'card-choice-tagline', card.tagline || card.subtitle));
  }
  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.name || card.title || '';
    img.loading = 'lazy';
    item.append(img);
  }

  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-features');
    card.features.forEach((feature) => list.append(el('li', '', featureText(feature))));
    item.append(list);
  }

  if (card.detailsLabel || card.detailsUrl) {
    const link = el('a', 'card-choice-details', card.detailsLabel || 'All Features & Benefits');
    link.href = card.detailsUrl || '#';
    if (card.detailsUrl) link.target = '_blank';
    link.rel = 'noopener';
    item.append(link);
  }

  if (card.minAmount !== undefined && card.minAmount !== null && card.minAmount !== '') {
    const min = el('div', 'card-choice-min');
    min.append(el('span', 'card-choice-min-label', card.minAmountLabel || 'Min. FD Amount'));
    min.append(el('span', 'card-choice-min-value', card.minAmount));
    item.append(min);
  }

  const button = el('button', 'card-choice-select', card.buttonLabel || selectLabel);
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  item.append(button);
  return item;
}

function buildCarousel(fieldDiv) {
  const wrapper = el('div', 'card-choice-widget');
  const viewport = el('div', 'card-choice-viewport');
  const track = el('div', 'card-choice-track');
  track.setAttribute('role', 'list');
  track.tabIndex = 0;
  viewport.append(track);

  const prev = el('button', 'card-choice-nav card-choice-prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous cards');
  const next = el('button', 'card-choice-nav card-choice-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next cards');
  const dots = el('div', 'card-choice-dots');

  wrapper.append(viewport, prev, next, dots);
  const anchor = fieldDiv.querySelector('.field-description');
  if (anchor) fieldDiv.insertBefore(wrapper, anchor);
  else fieldDiv.append(wrapper);
  return {
    wrapper, track, prev, next, dots,
  };
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.style.display = 'none';
  const selectLabel = fieldJson?.properties?.selectLabel || 'Get This Card';
  const ui = buildCarousel(fieldDiv);
  let model = null;
  let cards = [];

  const pageSize = () => {
    const first = ui.track.firstElementChild;
    if (!first) return 1;
    return Math.max(1, Math.floor(ui.track.clientWidth / (first.offsetWidth || 1)));
  };

  const scrollStep = () => {
    const first = ui.track.firstElementChild;
    if (!first) return ui.track.clientWidth;
    const gap = parseFloat(getComputedStyle(ui.track).columnGap) || 0;
    return (first.offsetWidth + gap) * pageSize();
  };

  const updateNav = () => {
    const { scrollLeft, scrollWidth, clientWidth } = ui.track;
    // the track has a few px of padding, so snapped positions are not exactly 0
    ui.prev.hidden = scrollLeft <= 8;
    ui.next.hidden = scrollLeft + clientWidth >= scrollWidth - 8;
    const pages = Math.max(1, Math.ceil(cards.length / pageSize()));
    const max = scrollWidth - clientWidth;
    const current = max > 0 ? Math.round((scrollLeft / max) * (pages - 1)) : 0;
    ui.dots.querySelectorAll('.card-choice-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
    });
  };

  const renderDots = () => {
    ui.dots.replaceChildren();
    const pages = Math.ceil(cards.length / pageSize());
    ui.dots.hidden = pages <= 1;
    for (let i = 0; i < pages; i += 1) {
      const dot = el('button', 'card-choice-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => {
        ui.track.scrollTo({ left: i * scrollStep(), behavior: 'smooth' });
      });
      ui.dots.append(dot);
    }
  };

  const markSelected = () => {
    const selected = parseValue(model?.value);
    const selectedKey = selected ? JSON.stringify(selected) : null;
    ui.track.querySelectorAll('.card-choice-card').forEach((node) => {
      const isSelected = selectedKey !== null
        && JSON.stringify(cards[Number(node.dataset.index)]) === selectedKey;
      node.classList.toggle('selected', isSelected);
      node.querySelector('.card-choice-select').setAttribute('aria-pressed', String(isSelected));
    });
  };

  const render = () => {
    ui.track.replaceChildren(...cards.map((card, i) => createCard(card, i, selectLabel)));
    ui.wrapper.classList.toggle('empty', cards.length === 0);
    renderDots();
    markSelected();
    updateNav();
  };

  const setCards = (data) => {
    cards = toCards(data);
    render();
  };

  render();

  const select = (index) => {
    const value = JSON.stringify(cards[index]);
    if (model && model.value !== value) {
      model.value = value;
    }
    markSelected();
  };

  ui.track.addEventListener('click', (e) => {
    const button = e.target.closest('.card-choice-select');
    if (button && ui.track.contains(button)) {
      select(Number(button.closest('.card-choice-card').dataset.index));
    }
  });
  ui.prev.addEventListener('click', () => {
    ui.track.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  });
  ui.next.addEventListener('click', () => {
    ui.track.scrollBy({ left: scrollStep(), behavior: 'smooth' });
  });
  ui.track.addEventListener('scroll', updateNav, { passive: true });
  ui.track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') ui.track.scrollBy({ left: scrollStep(), behavior: 'smooth' });
    if (e.key === 'ArrowLeft') ui.track.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      renderDots();
      updateNav();
    }).observe(ui.track);
  }

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      if (fieldModel.properties?.cards) setCards(fieldModel.properties.cards);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          markSelected();
        } else if (change?.propertyName === 'properties.cards') {
          setCards(change.currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
