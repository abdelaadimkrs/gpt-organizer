'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = [
  { id: 'red',    hex: '#ef4444', label: 'Important'  },
  { id: 'orange', hex: '#f97316', label: 'Review'     },
  { id: 'yellow', hex: '#eab308', label: 'Note'       },
  { id: 'green',  hex: '#22c55e', label: 'Solution'   },
  { id: 'blue',   hex: '#3b82f6', label: 'Reference'  },
  { id: 'purple', hex: '#a855f7', label: 'Idea'       },
];

// Message selectors — tries multiple in order (ChatGPT updates its DOM often)
const MSG_SELECTORS = [
  'article[data-testid^="conversation-turn-"]',
  '[data-message-id]',
  'article',
];

// ============================================================
// STATE
// ============================================================
let messages      = [];   // array of DOM elements for current conversation
let currentIndex  = -1;   // which message is currently in view
let labels        = {};   // { messageKey: { colorId, colorHex, note } }
let convId        = null; // current conversation ID from URL
let observer      = null; // MutationObserver watching for new messages
let panelOpen     = false;
let navFilter     = 'all'; // 'all' | 'user' | 'assistant'

// ============================================================
// INJECT STYLES
// ============================================================
const style = document.createElement('style');
style.textContent = `
  /* ── NAV BUTTONS ── */
  #gpt-nav {
    position: fixed;
    bottom: 100px;
    right: 18px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .gpt-nav-btn {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #1e1e1e;
    border: 1px solid #333;
    color: #e0e0e0;
    font-size: 16px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    transition: background 0.15s, transform 0.1s;
    user-select: none;
  }
  .gpt-nav-btn:hover { background: #2a2a2a; transform: scale(1.08); }
  .gpt-nav-btn:active { transform: scale(0.96); }
  .gpt-nav-btn.disabled { opacity: 0.3; cursor: default; pointer-events: none; }

  /* ── NAV FILTER TOGGLE ── */
  #gpt-nav-filter {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  .gpt-nf-btn {
    width: 28px; height: 22px;
    border-radius: 6px;
    background: none;
    border: none;
    color: #555;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, color 0.12s;
    font-family: inherit;
    letter-spacing: 0.3px;
  }
  .gpt-nf-btn:hover { background: #2a2a2a; color: #aaa; }
  .gpt-nf-btn.active { background: #1f6feb; color: #fff; }

  /* ── PANEL TOGGLE TAB ── */
  #gpt-panel-toggle {
    position: fixed;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    z-index: 9999;
    background: #1f6feb;
    color: #fff;
    border: none;
    border-radius: 8px 0 0 8px;
    padding: 10px 7px;
    cursor: pointer;
    font-size: 13px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    letter-spacing: 1px;
    font-weight: 600;
    box-shadow: -2px 0 12px rgba(0,0,0,0.3);
    transition: background 0.15s, right 0.3s;
  }
  #gpt-panel-toggle:hover { background: #388bfd; }

  /* ── FLOATING PANEL ── */
  #gpt-panel {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 300px;
    background: #0d1117;
    border-left: 1px solid #21262d;
    z-index: 9998;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    box-shadow: -8px 0 32px rgba(0,0,0,0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  #gpt-panel.open {
    transform: translateX(0);
  }

  /* Panel header */
  #gpt-panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 14px 10px;
    border-bottom: 1px solid #21262d;
    flex-shrink: 0;
  }
  #gpt-panel-title {
    font-size: 13px; font-weight: 700; color: #e6edf3;
    display: flex; align-items: center; gap: 7px;
  }
  #gpt-panel-close {
    background: none; border: none; color: #484f58;
    font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
  }
  #gpt-panel-close:hover { background: #21262d; color: #e6edf3; }

  /* Panel search */
  #gpt-panel-search {
    margin: 8px 12px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #e6edf3;
    font-size: 12px;
    font-family: inherit;
    padding: 6px 10px;
    outline: none;
    width: calc(100% - 24px);
    flex-shrink: 0;
  }
  #gpt-panel-search:focus { border-color: #1f6feb; }
  #gpt-panel-search::placeholder { color: #484f58; }

  /* Panel filter row */
  #gpt-panel-filters {
    display: flex; gap: 5px; padding: 0 12px 8px; flex-wrap: wrap; flex-shrink: 0;
  }
  .gpt-filter-chip {
    padding: 3px 9px; border-radius: 999px;
    background: #161b22; border: 1px solid #30363d;
    color: #7d8590; font-size: 11px; cursor: pointer;
    font-family: inherit;
  }
  .gpt-filter-chip:hover { border-color: #7d8590; color: #e6edf3; }
  .gpt-filter-chip.active { border-color: #1f6feb; color: #388bfd; background: #0d1f3c; }

  /* Panel message list */
  #gpt-msg-list {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column;
  }
  #gpt-msg-list::-webkit-scrollbar { width: 3px; }
  #gpt-msg-list::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }

  /* Message row */
  .gpt-msg-row {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 9px 12px;
    border-bottom: 1px solid #161b22;
    cursor: pointer;
    transition: background 0.1s;
    position: relative;
  }
  .gpt-msg-row:hover { background: #161b22; }
  .gpt-msg-row.active { background: #0d1f3c; border-left: 2px solid #1f6feb; }

  /* Color dot */
  .gpt-color-dot {
    width: 8px; height: 8px; border-radius: 50%;
    flex-shrink: 0; margin-top: 4px;
    background: transparent;
    border: 1.5px solid #30363d;
    cursor: pointer;
    transition: transform 0.1s;
  }
  .gpt-color-dot:hover { transform: scale(1.4); }
  .gpt-color-dot.labeled { border-color: transparent; }

  /* Message content */
  .gpt-msg-content { flex: 1; min-width: 0; }
  .gpt-msg-role {
    font-size: 10px; font-weight: 700; color: #484f58;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .gpt-msg-role.user { color: #1f6feb; }
  .gpt-msg-preview {
    font-size: 12px; color: #7d8590;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 200px;
  }
  .gpt-msg-row:hover .gpt-msg-preview { color: #e6edf3; }
  .gpt-msg-index {
    font-size: 10px; color: #30363d; flex-shrink: 0; margin-top: 2px;
  }

  /* Color picker popover */
  .gpt-color-picker {
    position: absolute; left: 28px; top: 4px; z-index: 10001;
    background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; padding: 8px;
    display: flex; flex-direction: column; gap: 5px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    min-width: 130px;
  }
  .gpt-picker-row {
    display: flex; align-items: center; gap: 7px;
    padding: 4px 6px; border-radius: 5px; cursor: pointer;
    font-size: 11px; color: #7d8590;
  }
  .gpt-picker-row:hover { background: #21262d; color: #e6edf3; }
  .gpt-picker-swatch {
    width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
  }
  .gpt-picker-clear {
    font-size: 11px; color: #484f58; text-align: center;
    padding: 3px; cursor: pointer; border-top: 1px solid #21262d; margin-top: 2px;
  }
  .gpt-picker-clear:hover { color: #e6edf3; }

  /* Label badge on actual messages in page */
  .gpt-label-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 600;
    margin-bottom: 6px; opacity: 0.9;
    color: #fff;
  }

  /* Panel empty state */
  #gpt-panel-empty {
    display: none; flex-direction: column; align-items: center;
    justify-content: center; gap: 8px; padding: 40px 20px;
    flex: 1; text-align: center;
  }
  #gpt-panel-empty.visible { display: flex; }
  .gpt-empty-icon { font-size: 28px; opacity: 0.3; }
  .gpt-empty-text { font-size: 12px; color: #484f58; }

  /* Panel footer */
  #gpt-panel-footer {
    padding: 8px 12px; border-top: 1px solid #21262d;
    font-size: 11px; color: #484f58; flex-shrink: 0;
    display: flex; justify-content: space-between; align-items: center;
  }
`;
document.head.appendChild(style);

// ============================================================
// INJECT HTML
// ============================================================
function injectUI() {
  if (document.getElementById('gpt-nav')) return;

  // Nav buttons + filter toggle
  const nav = document.createElement('div');
  nav.id = 'gpt-nav';
  nav.innerHTML = `
    <button class="gpt-nav-btn disabled" id="gpt-nav-up" title="Previous message">↑</button>
    <div id="gpt-nav-filter" title="Jump between: All / Your questions / ChatGPT responses">
      <button class="gpt-nf-btn active" data-nf="all"       title="All messages">All</button>
      <button class="gpt-nf-btn"        data-nf="user"      title="Your questions only">Me</button>
      <button class="gpt-nf-btn"        data-nf="assistant" title="ChatGPT responses only">AI</button>
    </div>
    <button class="gpt-nav-btn disabled" id="gpt-nav-down" title="Next message">↓</button>
  `;
  document.body.appendChild(nav);

  // Panel toggle tab
  const toggle = document.createElement('button');
  toggle.id = 'gpt-panel-toggle';
  toggle.textContent = 'Messages';
  toggle.title = 'Toggle message navigator';
  document.body.appendChild(toggle);

  // Floating panel
  const panel = document.createElement('div');
  panel.id = 'gpt-panel';
  panel.innerHTML = `
    <div id="gpt-panel-header">
      <div id="gpt-panel-title">💬 Message Navigator</div>
      <button id="gpt-panel-close" title="Close">✕</button>
    </div>
    <input id="gpt-panel-search" type="text" placeholder="Search messages…" spellcheck="false"/>
    <div id="gpt-panel-filters">
      <button class="gpt-filter-chip active" data-filter="all">All</button>
      <button class="gpt-filter-chip" data-filter="user">Mine</button>
      <button class="gpt-filter-chip" data-filter="assistant">ChatGPT</button>
      <button class="gpt-filter-chip" data-filter="labeled">Labeled</button>
    </div>
    <div id="gpt-msg-list">
      <div id="gpt-panel-empty">
        <div class="gpt-empty-icon">💬</div>
        <div class="gpt-empty-text">Open a conversation to see messages here.</div>
      </div>
    </div>
    <div id="gpt-panel-footer">
      <span id="gpt-msg-count">0 messages</span>
      <span>ChatGPT Navigator</span>
    </div>
  `;
  document.body.appendChild(panel);

  bindEvents();
}

// ============================================================
// BIND EVENTS
// ============================================================
function bindEvents() {
  // Nav buttons
  document.getElementById('gpt-nav-up').addEventListener('click',   () => navigatePrev());
  document.getElementById('gpt-nav-down').addEventListener('click', () => navigateNext());

  // Nav filter toggle
  document.getElementById('gpt-nav-filter').addEventListener('click', e => {
    const btn = e.target.closest('.gpt-nf-btn');
    if (!btn) return;
    document.querySelectorAll('.gpt-nf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    navFilter    = btn.dataset.nf;
    currentIndex = -1;
    updateNavButtons();
  });

  // Panel toggle
  document.getElementById('gpt-panel-toggle').addEventListener('click', togglePanel);
  document.getElementById('gpt-panel-close').addEventListener('click', togglePanel);

  // Search
  document.getElementById('gpt-panel-search').addEventListener('input', renderPanel);

  // Filters
  document.getElementById('gpt-panel-filters').addEventListener('click', e => {
    const chip = e.target.closest('.gpt-filter-chip');
    if (!chip) return;
    document.querySelectorAll('.gpt-filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderPanel();
  });
}

// ============================================================
// TOGGLE PANEL
// ============================================================
function togglePanel() {
  panelOpen = !panelOpen;
  const panel  = document.getElementById('gpt-panel');
  const toggle = document.getElementById('gpt-panel-toggle');
  panel.classList.toggle('open', panelOpen);
  toggle.style.right = panelOpen ? '300px' : '0';
  if (panelOpen) renderPanel();
}

// ============================================================
// GET MESSAGES FROM DOM
// ============================================================
function getMessages() {
  let found = [];
  for (const sel of MSG_SELECTORS) {
    found = [...document.querySelectorAll(sel)];
    if (found.length > 0) break;
  }
  return found;
}

function getRole(el) {
  const testId = el.getAttribute('data-testid') || '';
  // Even turns = user, odd = assistant (ChatGPT convention)
  const num = parseInt(testId.replace('conversation-turn-', ''), 10);
  if (!isNaN(num)) return num % 2 === 0 ? 'user' : 'assistant';
  // Fallback: look for role indicators in the DOM
  if (el.querySelector('[data-message-author-role="user"]'))      return 'user';
  if (el.querySelector('[data-message-author-role="assistant"]')) return 'assistant';
  if (el.querySelector('img[alt*="User"]'))                       return 'user';
  return 'assistant';
}

function getPreview(el) {
  const text = el.textContent?.trim() || '';
  return text.slice(0, 80).replace(/\s+/g, ' ');
}

function getMsgKey(index) {
  return `${convId}_msg_${index}`;
}

// ============================================================
// SCAN & REBUILD MESSAGE LIST
// ============================================================
function scanMessages() {
  messages = getMessages();
  updateNavButtons();
  if (panelOpen) renderPanel();
  injectLabelBadges();
}

// ============================================================
// NAVIGATE
// ============================================================

// Returns only the messages matching the current navFilter
function filteredMessages() {
  if (navFilter === 'all') return messages;
  return messages.filter(el => getRole(el) === navFilter);
}

function navigateTo(index) {
  if (index < 0 || index >= messages.length) return;
  currentIndex = index;
  messages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateNavButtons();
  highlightActiveRow();
}

function navigatePrev() {
  const pool = filteredMessages();
  if (pool.length === 0) return;
  // Find last pool message before currentIndex
  const before = pool.filter(el => messages.indexOf(el) < currentIndex);
  const target  = before.length > 0 ? before[before.length - 1] : pool[0];
  navigateTo(messages.indexOf(target));
}

function navigateNext() {
  const pool = filteredMessages();
  if (pool.length === 0) return;
  // Find first pool message after currentIndex
  const after  = pool.filter(el => messages.indexOf(el) > currentIndex);
  const target  = after.length > 0 ? after[0] : pool[pool.length - 1];
  navigateTo(messages.indexOf(target));
}

function updateNavButtons() {
  const up   = document.getElementById('gpt-nav-up');
  const down = document.getElementById('gpt-nav-down');
  if (!up || !down) return;
  const pool   = filteredMessages();
  const idxs   = pool.map(el => messages.indexOf(el));
  const hasPrev = idxs.some(i => i < currentIndex);
  const hasNext = idxs.some(i => i > currentIndex);
  up.classList.toggle('disabled',   !hasPrev);
  down.classList.toggle('disabled', !hasNext && pool.length === 0);
}

// ============================================================
// RENDER PANEL
// ============================================================
function renderPanel() {
  const list    = document.getElementById('gpt-msg-list');
  const empty   = document.getElementById('gpt-panel-empty');
  const count   = document.getElementById('gpt-msg-count');
  const search  = (document.getElementById('gpt-panel-search')?.value || '').toLowerCase();
  const filter  = document.querySelector('.gpt-filter-chip.active')?.dataset.filter || 'all';

  // Remove old rows
  list.querySelectorAll('.gpt-msg-row').forEach(r => r.remove());

  const rows = messages
    .map((el, i) => ({ el, i, role: getRole(el), preview: getPreview(el), key: getMsgKey(i) }))
    .filter(m => {
      if (filter === 'user'      && m.role !== 'user')      return false;
      if (filter === 'assistant' && m.role !== 'assistant') return false;
      if (filter === 'labeled'   && !labels[m.key])         return false;
      if (search && !m.preview.toLowerCase().includes(search)) return false;
      return true;
    });

  if (rows.length === 0) {
    empty.classList.add('visible');
    count.textContent = '0 messages';
    return;
  }

  empty.classList.remove('visible');
  count.textContent = `${messages.length} message${messages.length !== 1 ? 's' : ''}`;

  const frag = document.createDocumentFragment();

  rows.forEach(({ el, i, role, preview, key }) => {
    const label = labels[key];
    const row = document.createElement('div');
    row.className = 'gpt-msg-row' + (i === currentIndex ? ' active' : '');
    row.dataset.index = i;

    row.innerHTML = `
      <div class="gpt-color-dot labeled" data-key="${key}" style="background:${label ? label.colorHex : 'transparent'}; border-color:${label ? 'transparent' : '#30363d'}"></div>
      <div class="gpt-msg-content">
        <div class="gpt-msg-role ${role}">${role === 'user' ? 'You' : 'ChatGPT'}</div>
        <div class="gpt-msg-preview">${escHtml(preview)}</div>
        ${label ? `<div style="margin-top:3px;display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;color:#fff;background:${label.colorHex}">${label.colorId}</div>` : ''}
      </div>
      <div class="gpt-msg-index">#${i + 1}</div>
    `;

    // Click row → jump to message
    row.addEventListener('click', e => {
      if (e.target.closest('.gpt-color-dot') || e.target.closest('.gpt-color-picker')) return;
      navigateTo(i);
      highlightActiveRow();
    });

    // Click dot → open color picker
    row.querySelector('.gpt-color-dot').addEventListener('click', e => {
      e.stopPropagation();
      openColorPicker(row, key, i);
    });

    frag.appendChild(row);
  });

  list.appendChild(frag);
}

function highlightActiveRow() {
  document.querySelectorAll('.gpt-msg-row').forEach(r => {
    r.classList.toggle('active', parseInt(r.dataset.index) === currentIndex);
  });
}

// ============================================================
// COLOR PICKER
// ============================================================
function openColorPicker(row, key, msgIndex) {
  // Close any open picker
  document.querySelectorAll('.gpt-color-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'gpt-color-picker';

  COLORS.forEach(c => {
    const opt = document.createElement('div');
    opt.className = 'gpt-picker-row';
    opt.innerHTML = `<div class="gpt-picker-swatch" style="background:${c.hex}"></div>${c.label}`;
    opt.addEventListener('click', e => {
      e.stopPropagation();
      setLabel(key, { colorId: c.label, colorHex: c.hex });
      picker.remove();
      renderPanel();
      injectLabelBadges();
    });
    picker.appendChild(opt);
  });

  // Clear option
  const clear = document.createElement('div');
  clear.className = 'gpt-picker-clear';
  clear.textContent = '✕ Remove label';
  clear.addEventListener('click', e => {
    e.stopPropagation();
    removeLabel(key);
    picker.remove();
    renderPanel();
    injectLabelBadges();
  });
  picker.appendChild(clear);

  row.style.position = 'relative';
  row.appendChild(picker);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 0);
}

// ============================================================
// LABELS STORAGE
// ============================================================
async function loadLabels() {
  if (!convId) return;
  const key  = `labels_${convId}`;
  const data = await chrome.storage.local.get(key);
  labels = data[key] || {};
}

async function setLabel(msgKey, labelData) {
  labels[msgKey] = labelData;
  await chrome.storage.local.set({ [`labels_${convId}`]: labels });
}

async function removeLabel(msgKey) {
  delete labels[msgKey];
  await chrome.storage.local.set({ [`labels_${convId}`]: labels });
}

// ============================================================
// INJECT LABEL BADGES INTO PAGE MESSAGES
// ============================================================
function injectLabelBadges() {
  messages.forEach((el, i) => {
    const key   = getMsgKey(i);
    const label = labels[key];

    // Remove old badge
    el.querySelector('.gpt-label-badge')?.remove();

    if (label) {
      const badge = document.createElement('div');
      badge.className = 'gpt-label-badge';
      badge.style.background = label.colorHex;
      badge.textContent = label.colorId;
      // Inject at the top of the message element
      el.insertBefore(badge, el.firstChild);
    }
  });
}

// ============================================================
// DETECT CONVERSATION CHANGE
// ============================================================
function getConvId() {
  const match = location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

async function onConversationChange() {
  const newId = getConvId();
  if (newId === convId) return;
  convId       = newId;
  currentIndex = -1;
  labels       = {};
  if (convId) await loadLabels();
  setTimeout(scanMessages, 800); // wait for DOM to render
}

// ============================================================
// MUTATION OBSERVER — watch for new messages
// ============================================================
function startObserver() {
  if (observer) observer.disconnect();

  observer = new MutationObserver(() => {
    const newCount = getMessages().length;
    if (newCount !== messages.length) scanMessages();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// URL CHANGE DETECTION (SPA navigation)
// ============================================================
let lastPath = location.pathname;

setInterval(async () => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    await onConversationChange();
  }
}, 500);

// ============================================================
// INTERSECTION OBSERVER — track which message is in viewport
// ============================================================
function startIntersectionObserver() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = messages.indexOf(entry.target);
        if (idx !== -1 && idx !== currentIndex) {
          currentIndex = idx;
          updateNavButtons();
          highlightActiveRow();
        }
      }
    });
  }, { threshold: 0.5 });

  messages.forEach(el => io.observe(el));
}

// ============================================================
// ESCAPE HTML
// ============================================================
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ============================================================
// BOOT
// ============================================================
async function boot() {
  injectUI();
  await onConversationChange();
  startObserver();

  // Re-scan after page fully loads
  window.addEventListener('load', () => {
    setTimeout(scanMessages, 1000);
  });
}

// Wait for body to be ready
if (document.body) {
  boot();
} else {
  document.addEventListener('DOMContentLoaded', boot);
}
