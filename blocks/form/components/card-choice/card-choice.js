import { subscribe } from '../../rules/index.js';

function parseJson(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function toCards(raw) {
  const parsed = parseJson(raw);
  return Array.isArray(parsed) ? parsed.filter((c) => c && typeof c === 'object') : [];
}

function cardKey(card, index) {
  return String(card.id ?? card.title ?? index);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function featureText(feature) {
  return typeof feature === 'string' ? feature : feature?.text;
}

function buildCard(card, key, onSelect) {
  const item = el('li', 'card-choice-card');
  item.dataset.cardId = key;
  item.append(el('h3', 'card-choice-title', card.title));
  if (card.subtitle) item.append(el('p', 'card-choice-subtitle', card.subtitle));
  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.title || '';
    img.loading = 'lazy';
    item.append(img);
  }
  const features = Array.isArray(card.features) ? card.features : [];
  if (features.length) {
    const list = el('ul', 'card-choice-features');
    features.forEach((f) => {
      const text = featureText(f);
      if (!text) return;
      const li = el('li', 'card-choice-feature');
      if (f.icon) {
        const icon = el('img', 'card-choice-feature-icon');
        icon.src = f.icon;
        icon.alt = '';
        li.append(icon);
      }
      li.append(el('span', null, text));
      list.append(li);
    });
    item.append(list);
  }
  if (card.linkText) {
    const link = el('a', 'card-choice-link', card.linkText);
    link.href = card.linkUrl || '#';
    item.append(link);
  }
  if (card.minAmount !== undefined && card.minAmount !== null) {
    const amount = el('div', 'card-choice-amount');
    amount.append(
      el('span', 'card-choice-amount-label', card.minAmountLabel || 'Min. FD Amount'),
      el('span', 'card-choice-amount-value', card.minAmount),
    );
    item.append(amount);
  }
  const button = el('button', 'card-choice-select', card.ctaLabel || 'Get This Card');
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => onSelect(card, key));
  item.append(button);
  return item;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  input.type = 'hidden';
  fieldDiv.classList.add('card-choice-wrapper');

  const widget = el('div', 'card-choice-widget');
  const viewport = el('ul', 'card-choice-track');
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', 'Cards');
  const prev = el('button', 'card-choice-nav card-choice-prev', '‹');
  const next = el('button', 'card-choice-nav card-choice-next', '›');
  [[prev, 'Previous cards'], [next, 'Next cards']].forEach(([b, label]) => {
    b.type = 'button';
    b.setAttribute('aria-label', label);
  });
  const dots = el('div', 'card-choice-dots');
  widget.append(viewport, prev, next, dots);
  input.after(widget);

  let model = null;
  let cards = [];

  const scrollByPage = (dir) => {
    viewport.scrollBy({ left: dir * viewport.clientWidth, behavior: 'smooth' });
  };
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));

  const updateNav = () => {
    const max = viewport.scrollWidth - viewport.clientWidth;
    prev.hidden = viewport.scrollLeft <= 1;
    next.hidden = viewport.scrollLeft >= max - 1;
    dots.hidden = max <= 1;
    const pages = Math.max(1, Math.ceil(viewport.scrollWidth / (viewport.clientWidth || 1)));
    const page = max > 0 ? Math.round((viewport.scrollLeft / max) * (pages - 1)) : 0;
    [...dots.children].forEach((d, i) => d.classList.toggle('active', i === page));
  };
  let raf = 0;
  viewport.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateNav);
  }, { passive: true });
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') scrollByPage(1);
    if (e.key === 'ArrowLeft') scrollByPage(-1);
  });

  const selectedKey = () => {
    const sel = parseJson(model?.value);
    return sel && typeof sel === 'object' ? cardKey(sel, -1) : null;
  };

  const markSelected = () => {
    const key = selectedKey();
    viewport.querySelectorAll('.card-choice-card').forEach((item) => {
      const on = item.dataset.cardId === key;
      item.classList.toggle('selected', on);
      item.querySelector('.card-choice-select').setAttribute('aria-pressed', String(on));
    });
  };

  const select = (card) => {
    if (!model || model.enabled === false || model.readOnly) return;
    const value = JSON.stringify(card);
    if (model.value !== value) model.value = value;
  };

  const render = () => {
    viewport.replaceChildren(
      ...cards.map((card, i) => buildCard(card, cardKey(card, i), select)),
    );
    dots.replaceChildren(...[0, 1].map(() => el('span', 'card-choice-dot')));
    markSelected();
    requestAnimationFrame(() => {
      const pages = Math.max(1, Math.ceil(viewport.scrollWidth / (viewport.clientWidth || 1)));
      dots.replaceChildren(...Array.from({ length: pages }, () => el('span', 'card-choice-dot')));
      updateNav();
    });
  };

  const setCards = (raw) => {
    cards = toCards(raw);
    render();
  };

  subscribe(fieldDiv, formId, (_fd, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      setCards(model.properties?.cards ?? fieldJson?.properties?.cards);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change.propertyName === 'properties.cards') {
          setCards(change.currentValue);
        } else if (change.propertyName === 'properties') {
          const newCards = change.currentValue?.cards;
          if (JSON.stringify(newCards) !== JSON.stringify(change.prevValue?.cards)) {
            setCards(newCards);
          }
        } else if (change.propertyName === 'value') {
          markSelected();
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
