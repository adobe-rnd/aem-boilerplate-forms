import { subscribe } from '../../rules/index.js';

const DEFAULTS = {
  ctaText: 'Get This Card',
  featuresLinkText: 'All Features & Benefits',
  minAmountLabel: 'Min. FD Amount',
};

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

function cardId(card, index) {
  return String(card.id ?? card.name ?? card.title ?? index);
}

function formatAmount(amount) {
  if (typeof amount === 'number') return `₹ ${amount.toLocaleString('en-IN')}/-`;
  return amount;
}

function safeUrl(url) {
  return /^(https?:\/\/|\/|#)/i.test(url || '') ? url : '#';
}

function buildCard(card, index, labels) {
  const id = cardId(card, index);
  const article = el('article', 'card-choice-card');
  article.dataset.cardId = id;
  article.setAttribute('role', 'listitem');

  article.append(el('h3', 'card-choice-title', card.title || card.name));
  if (card.subtitle) article.append(el('p', 'card-choice-subtitle', card.subtitle));

  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.title || '';
    img.loading = 'lazy';
    const figure = el('div', 'card-choice-image-wrapper');
    figure.append(img);
    article.append(figure);
  }

  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-features');
    card.features.forEach((f) => {
      const feature = typeof f === 'string' ? { text: f } : f;
      const li = el('li');
      if (feature.icon) {
        const icon = el('img', 'card-choice-feature-icon');
        icon.src = feature.icon;
        icon.alt = '';
        li.append(icon);
      } else {
        li.append(el('span', 'card-choice-feature-bullet'));
      }
      li.append(el('span', 'card-choice-feature-text', feature.text));
      list.append(li);
    });
    article.append(list);
  }

  const linkText = card.featuresLinkText || (card.featuresUrl && labels.featuresLinkText);
  if (card.featuresUrl || card.featuresLinkText) {
    const link = el('a', 'card-choice-link', linkText || labels.featuresLinkText);
    link.href = safeUrl(card.featuresUrl);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    article.append(link);
  }

  if (card.minAmount !== undefined && card.minAmount !== null) {
    const row = el('div', 'card-choice-amount');
    row.append(
      el('span', 'card-choice-amount-label', card.minAmountLabel || labels.minAmountLabel),
      el('span', 'card-choice-amount-value', formatAmount(card.minAmount)),
    );
    article.append(row);
  }

  const button = el('button', 'card-choice-select', card.ctaText || labels.ctaText);
  button.type = 'button';
  button.dataset.cardId = id;
  article.append(button);
  return article;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.style.display = 'none';
  fieldDiv.classList.add('card-choice-field');

  const labels = {
    ctaText: fieldJson?.properties?.ctaText || DEFAULTS.ctaText,
    featuresLinkText: fieldJson?.properties?.featuresLinkText || DEFAULTS.featuresLinkText,
    minAmountLabel: fieldJson?.properties?.minAmountLabel || DEFAULTS.minAmountLabel,
  };

  const widget = el('div', 'card-choice');
  const viewport = el('div', 'card-choice-viewport');
  viewport.setAttribute('role', 'list');
  viewport.tabIndex = 0;
  const prev = el('button', 'card-choice-nav card-choice-prev');
  const next = el('button', 'card-choice-nav card-choice-next');
  [[prev, 'Previous cards', '‹'], [next, 'Next cards', '›']].forEach(([b, label, glyph]) => {
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.textContent = glyph;
  });
  const dots = el('div', 'card-choice-dots');
  widget.append(prev, viewport, next, dots);
  (input || fieldDiv).after(widget);
  const helpText = fieldDiv.querySelector('.field-description');
  if (helpText) fieldDiv.append(helpText);

  let model = null;
  let cards = [];
  let pages = 0;

  const pageWidth = () => viewport.clientWidth || 1;

  const updateNav = () => {
    const max = viewport.scrollWidth - viewport.clientWidth;
    prev.disabled = viewport.scrollLeft <= 1;
    next.disabled = viewport.scrollLeft >= max - 1;
    const current = Math.round(viewport.scrollLeft / pageWidth());
    dots.querySelectorAll('.card-choice-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  };

  const renderDots = () => {
    pages = Math.max(1, Math.ceil(viewport.scrollWidth / pageWidth() - 0.05));
    dots.replaceChildren();
    if (pages < 2) return;
    for (let i = 0; i < pages; i += 1) {
      const dot = el('button', 'card-choice-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => viewport.scrollTo({ left: i * pageWidth(), behavior: 'smooth' }));
      dots.append(dot);
    }
  };

  const markSelected = (id) => {
    viewport.querySelectorAll('.card-choice-card').forEach((c) => {
      const selected = id !== undefined && id !== '' && c.dataset.cardId === String(id);
      c.classList.toggle('selected', selected);
      c.querySelector('.card-choice-select').setAttribute('aria-pressed', String(selected));
    });
  };

  const render = () => {
    viewport.replaceChildren(...cards.map((c, i) => buildCard(c, i, labels)));
    markSelected(model?.value);
    renderDots();
    updateNav();
  };

  const loadCards = (raw) => {
    cards = parseCards(raw);
    render();
    if (model?.value && !cards.some((c, i) => cardId(c, i) === String(model.value))) {
      model.value = '';
      model.properties = { ...model.properties, selectedCard: null };
    }
  };

  const select = (id) => {
    if (!model || model.enabled === false || model.readOnly) return;
    const index = cards.findIndex((c, i) => cardId(c, i) === id);
    if (index < 0 || String(model.value) === id) return;
    markSelected(id);
    // value carries the card id; the full details are exposed as properties.selectedCard
    model.properties = { ...model.properties, selectedCard: cards[index] };
    model.value = id;
  };

  viewport.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-choice-select');
    if (btn) select(btn.dataset.cardId);
  });
  const scrollByPage = (dir) => viewport.scrollBy({ left: dir * pageWidth(), behavior: 'smooth' });
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  viewport.addEventListener('scroll', () => window.requestAnimationFrame(updateNav), { passive: true });
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') scrollByPage(1);
    if (e.key === 'ArrowLeft') scrollByPage(-1);
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { renderDots(); updateNav(); }).observe(viewport);
  }

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      loadCards(fieldModel.properties?.cards ?? fieldJson?.properties?.cards);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change.propertyName === 'properties') {
          const incoming = change.currentValue?.cards;
          if (incoming !== change.prevValue?.cards) loadCards(incoming);
        } else if (change.propertyName === 'value') {
          markSelected(change.currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
