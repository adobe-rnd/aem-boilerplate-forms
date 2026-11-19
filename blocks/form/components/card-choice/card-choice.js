import { subscribe } from '../../rules/index.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
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
  return Array.isArray(data) ? data.filter((c) => c && typeof c === 'object') : [];
}

function parseSelected(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function cardKey(card, index) {
  return String(card.id ?? card.name ?? card.title ?? index);
}

function renderCard(card, index) {
  const item = el('li', 'card-choice-card');
  item.dataset.cardKey = cardKey(card, index);
  item.append(el('h3', 'card-choice-title', card.title || card.name));
  if (card.subtitle) item.append(el('p', 'card-choice-subtitle', card.subtitle));

  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.title || '';
    img.loading = 'lazy';
    item.append(img);
  }

  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-features');
    card.features.forEach((feature) => {
      const text = typeof feature === 'string' ? feature : feature?.text;
      if (!text) return;
      const li = el('li', 'card-choice-feature');
      const icon = feature?.icon;
      if (icon) {
        const iconImg = el('img', 'card-choice-feature-icon');
        iconImg.src = icon;
        iconImg.alt = '';
        li.append(iconImg);
      } else {
        li.append(el('span', 'card-choice-feature-icon card-choice-feature-bullet'));
      }
      li.append(el('span', 'card-choice-feature-text', text));
      list.append(li);
    });
    item.append(list);
  }

  if (card.featuresLabel || card.featuresLink) {
    const link = el('a', 'card-choice-link', card.featuresLabel || 'All Features & Benefits');
    link.href = card.featuresLink || '#';
    if (card.featuresLink) link.target = '_blank';
    link.rel = 'noopener';
    item.append(link);
  }

  if (card.minAmount !== undefined && card.minAmount !== null && card.minAmount !== '') {
    const amount = el('div', 'card-choice-amount');
    amount.append(el('span', 'card-choice-amount-label', card.minAmountLabel || 'Min. FD Amount'));
    amount.append(el('span', 'card-choice-amount-value', card.minAmount));
    item.append(amount);
  }

  const button = el('button', 'card-choice-select', card.ctaLabel || 'Get This Card');
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  item.append(button);
  return item;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.style.display = 'none';

  const carousel = el('div', 'card-choice-carousel');
  const prev = el('button', 'card-choice-nav card-choice-prev', '‹');
  const next = el('button', 'card-choice-nav card-choice-next', '›');
  prev.type = 'button';
  next.type = 'button';
  prev.setAttribute('aria-label', 'Previous cards');
  next.setAttribute('aria-label', 'Next cards');
  const track = el('ul', 'card-choice-track');
  track.tabIndex = 0;
  const dots = el('div', 'card-choice-dots');
  carousel.append(prev, track, next);
  const description = fieldDiv.querySelector('.field-description');
  fieldDiv.append(carousel, dots);
  if (description) fieldDiv.append(description);

  let model = null;
  let cards = [];
  let selectedKey = null;

  const isDisabled = () => model?.enabled === false || model?.readOnly === true
    || fieldJson?.enabled === false || fieldJson?.readOnly === true;

  const pageCount = () => Math.max(
    1,
    Math.ceil(track.scrollWidth / Math.max(track.clientWidth, 1)),
  );
  const currentPage = () => {
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 0) return 0;
    return Math.round((track.scrollLeft / max) * (pageCount() - 1));
  };

  const updateNav = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
    const pages = pageCount();
    const page = currentPage();
    dots.hidden = pages <= 1;
    dots.querySelectorAll('.card-choice-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === page);
    });
  };

  const renderDots = () => {
    dots.replaceChildren();
    const pages = pageCount();
    for (let i = 0; i < pages; i += 1) {
      const dot = el('button', 'card-choice-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => {
        const max = track.scrollWidth - track.clientWidth;
        track.scrollTo({ left: pages > 1 ? (max * i) / (pages - 1) : 0, behavior: 'smooth' });
      });
      dots.append(dot);
    }
    updateNav();
  };

  const scrollByPage = (dir) => {
    track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: 'smooth' });
  };
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  track.addEventListener('scroll', updateNav, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') scrollByPage(1);
    if (e.key === 'ArrowLeft') scrollByPage(-1);
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(renderDots).observe(track);
  }

  const paintSelection = () => {
    track.querySelectorAll('.card-choice-card').forEach((item) => {
      const on = item.dataset.cardKey === selectedKey;
      item.classList.toggle('selected', on);
      const btn = item.querySelector('.card-choice-select');
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Selected' : (cards.find((c, i) => cardKey(c, i) === item.dataset.cardKey)?.ctaLabel || 'Get This Card');
    });
  };

  const syncSelectionFromValue = (value) => {
    const selected = parseSelected(value);
    const idx = selected ? cards.findIndex((c, i) => cardKey(c, i) === cardKey(selected, -1)) : -1;
    selectedKey = idx >= 0 ? cardKey(cards[idx], idx) : null;
    paintSelection();
  };

  const select = (card, index) => {
    if (isDisabled()) return;
    const serialized = JSON.stringify(card);
    selectedKey = cardKey(card, index);
    paintSelection();
    if (input) input.value = serialized;
    if (model && model.value !== serialized) {
      model.value = serialized;
    } else if (!model && input) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const renderCards = (data) => {
    cards = data;
    track.replaceChildren();
    cards.forEach((card, index) => {
      const item = renderCard(card, index);
      item.querySelector('.card-choice-select').addEventListener('click', () => select(card, index));
      track.append(item);
    });
    track.scrollLeft = 0;
    fieldDiv.classList.toggle('card-choice-empty', cards.length === 0);
    syncSelectionFromValue(model?.value ?? input?.value);
    renderDots();
  };

  renderCards(parseCards(fieldJson?.properties?.cards));

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      const initial = parseCards(model.properties?.cards);
      if (initial.length) renderCards(initial);
      else syncSelectionFromValue(model.value);
      model.subscribe((evt) => {
        renderCards(parseCards(evt?.payload ?? evt?.detail));
      }, 'setCards');
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'properties') {
          const incoming = parseCards(change.currentValue?.cards);
          if (JSON.stringify(incoming) !== JSON.stringify(cards)) renderCards(incoming);
        } else if (change?.propertyName === 'value') {
          syncSelectionFromValue(change.currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
