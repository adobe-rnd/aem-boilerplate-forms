import { subscribe } from '../../rules/index.js';

function parseCards(data) {
  let cards = data;
  if (typeof cards === 'string') {
    try {
      cards = JSON.parse(cards);
    } catch (e) {
      cards = [];
    }
  }
  return Array.isArray(cards) ? cards.filter((c) => c && typeof c === 'object') : [];
}

function cardKey(card, index) {
  return String(card.id ?? card.name ?? card.title ?? index);
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function formatAmount(amount) {
  if (typeof amount === 'number') return `₹ ${amount.toLocaleString('en-IN')}/-`;
  return amount;
}

function renderCard(card, key) {
  const li = createEl('li', 'card-choice-card');
  li.dataset.cardKey = key;
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', 'false');

  li.append(createEl('h3', 'card-choice-title', card.name ?? card.title));
  if (card.tagline ?? card.subtitle) {
    li.append(createEl('p', 'card-choice-tagline', card.tagline ?? card.subtitle));
  }
  if (card.image) {
    const img = createEl('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.name || card.title || '';
    img.loading = 'lazy';
    li.append(img);
  }
  if (Array.isArray(card.features) && card.features.length) {
    const ul = createEl('ul', 'card-choice-features');
    card.features.forEach((f) => ul.append(createEl('li', '', typeof f === 'string' ? f : f?.text)));
    li.append(ul);
  }
  if (card.linkText) {
    const a = createEl('a', 'card-choice-link', card.linkText);
    a.href = card.linkUrl || '#';
    li.append(a);
  }
  if (card.minAmount !== undefined && card.minAmount !== null) {
    const amount = createEl('div', 'card-choice-amount');
    amount.append(
      createEl('span', 'card-choice-amount-label', card.minAmountLabel || 'Min. FD Amount'),
      createEl('span', 'card-choice-amount-value', formatAmount(card.minAmount)),
    );
    li.append(amount);
  }
  const button = createEl('button', 'card-choice-select', card.buttonLabel || 'Get This Card');
  button.type = 'button';
  li.append(button);
  return li;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.style.display = 'none';

  const widget = createEl('div', 'card-choice-widget');
  const viewport = createEl('div', 'card-choice-viewport');
  const track = createEl('ul', 'card-choice-track');
  track.setAttribute('role', 'listbox');
  track.tabIndex = 0;
  const prev = createEl('button', 'card-choice-nav card-choice-prev', '‹');
  const next = createEl('button', 'card-choice-nav card-choice-next', '›');
  prev.type = 'button';
  next.type = 'button';
  prev.setAttribute('aria-label', 'Previous cards');
  next.setAttribute('aria-label', 'Next cards');
  const dots = createEl('div', 'card-choice-dots');
  viewport.append(track);
  widget.append(viewport, prev, next, dots);
  if (input) input.after(widget);
  else fieldDiv.append(widget);

  let model = null;
  let cards = [];

  const pageSize = () => Math.max(1, viewport.clientWidth);

  const updateNav = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
    const pages = Math.max(1, Math.ceil(track.scrollWidth / pageSize() - 0.05));
    const current = Math.min(pages - 1, Math.round(track.scrollLeft / pageSize()));
    dots.querySelectorAll('.card-choice-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  };

  const renderDots = () => {
    dots.textContent = '';
    const pages = Math.max(1, Math.ceil(track.scrollWidth / pageSize() - 0.05));
    for (let i = 0; i < pages; i += 1) {
      const dot = createEl('button', 'card-choice-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => track.scrollTo({ left: i * pageSize(), behavior: 'smooth' }));
      dots.append(dot);
    }
    updateNav();
  };

  const markSelected = (selectedValue) => {
    let selected = null;
    if (selectedValue) {
      const parsed = typeof selectedValue === 'string' ? parseCards(`[${selectedValue}]`)[0] : selectedValue;
      if (parsed) {
        const idx = cards.findIndex((c, i) => cardKey(c, i) === cardKey(parsed, -1)
          || JSON.stringify(c) === JSON.stringify(parsed));
        if (idx >= 0) selected = cardKey(cards[idx], idx);
      }
    }
    track.querySelectorAll('.card-choice-card').forEach((li) => {
      const isSel = li.dataset.cardKey === selected;
      li.classList.toggle('selected', isSel);
      li.setAttribute('aria-selected', String(isSel));
      li.querySelector('.card-choice-select').textContent = isSel
        ? 'Selected' : (cards.find((c, i) => cardKey(c, i) === li.dataset.cardKey)?.buttonLabel || 'Get This Card');
    });
  };

  const select = (card) => {
    const value = JSON.stringify(card);
    if (model && model.value !== value) model.value = value;
    else if (!model && input) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    markSelected(value);
  };

  const render = (data) => {
    cards = parseCards(data);
    track.textContent = '';
    cards.forEach((card, i) => {
      const li = renderCard(card, cardKey(card, i));
      li.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        select(card);
      });
      track.append(li);
    });
    markSelected(model?.value);
    renderDots();
  };

  prev.addEventListener('click', () => track.scrollBy({ left: -pageSize(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: pageSize(), behavior: 'smooth' }));
  track.addEventListener('scroll', updateNav, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next.click();
    if (e.key === 'ArrowLeft') prev.click();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(renderDots).observe(viewport);

  render(fieldJson?.properties?.cards);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      render(model.properties?.cards ?? fieldJson?.properties?.cards);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'properties.cards') {
          render(change.currentValue);
        } else if (change?.propertyName === 'value') {
          markSelected(change.currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
