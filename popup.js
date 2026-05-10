'use strict';

// ============================================================
// STATE
// ============================================================
let allConversations = [];   // raw from API
let filtered         = [];   // after search + filters applied
let selected         = new Set();
let undoData         = null; // { ids, conversations } for undo
let undoTimer        = null;
let progressInterval = null;

// ============================================================
// DOM REFS
// ============================================================
const $ = id => document.getElementById(id);

const loadingOverlay  = $('loadingOverlay');
const loadingText     = $('loadingText');
const errorState      = $('errorState');
const errorIcon       = $('errorIcon');
const errorTitle      = $('errorTitle');
const errorDesc       = $('errorDesc');
const mainUI          = $('mainUI');
const headerCount     = $('headerCount');
const searchInput     = $('searchInput');
const searchClear     = $('searchClear');
const filterDate      = $('filterDate');
const filterModel     = $('filterModel');
const sortBy          = $('sortBy');
const filterClear     = $('filterClear');
const actionBar       = $('actionBar');
const actionLabel     = $('actionLabel');
const btnSelectAll    = $('btnSelectAll');
const btnSelectNone   = $('btnSelectNone');
const btnExport       = $('btnExport');
const exportMenu      = $('exportMenu');
const btnDeleteSelected = $('btnDeleteSelected');
const progressWrap    = $('progressWrap');
const progressLabel   = $('progressLabel');
const progressFill    = $('progressFill');
const masterCheckbox  = $('masterCheckbox');
const btnSmartSelect  = $('btnSmartSelect');
const btnDeleteAll    = $('btnDeleteAll');
const smartPanel      = $('smartPanel');
const convList        = $('convList');
const emptyState      = $('emptyState');
const footerCount     = $('footerCount');
const toastArea       = $('toastArea');
const modalBackdrop   = $('modalBackdrop');
const modalTitle      = $('modalTitle');
const modalBody       = $('modalBody');
const modalInput      = $('modalInput');
const modalCancel     = $('modalCancel');
const modalConfirm    = $('modalConfirm');

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  showLoading('Loading your conversations…');
  try {
    const res = await send({ action: 'CHECK_AUTH' });
    if (!res.loggedIn) {
      showError('🔒', 'Not logged in', 'Please open chatgpt.com, log in, then click the extension again.');
      return;
    }
    const data = await send({ action: 'GET_CONVERSATIONS' });
    allConversations = data.items || [];
    applyFilters();
    showMain();
  } catch (err) {
    showError('⚠️', 'Something went wrong', err.message === 'NOT_LOGGED_IN'
      ? 'Please open chatgpt.com and log in first.'
      : 'Could not load conversations. Try refreshing chatgpt.com.');
  }
}

// ============================================================
// SEND MESSAGE TO BACKGROUND
// ============================================================
function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, res => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (res?.error) return reject(new Error(res.error));
      resolve(res);
    });
  });
}

// ============================================================
// UI STATE HELPERS
// ============================================================
function showLoading(text = 'Loading…') {
  loadingText.textContent = text;
  loadingOverlay.classList.add('visible');
  errorState.classList.remove('visible');
  mainUI.classList.remove('visible');
}

function showError(icon, title, desc) {
  loadingOverlay.classList.remove('visible');
  errorIcon.textContent  = icon;
  errorTitle.textContent = title;
  errorDesc.textContent  = desc;
  errorState.classList.add('visible');
  mainUI.classList.remove('visible');
}

function showMain() {
  loadingOverlay.classList.remove('visible');
  errorState.classList.remove('visible');
  mainUI.classList.add('visible');
}

// ============================================================
// FILTER & SORT
// ============================================================
function applyFilters() {
  const q     = searchInput.value.trim().toLowerCase();
  const date  = filterDate.value;
  const model = filterModel.value;
  const sort  = sortBy.value;
  const now   = Date.now();
  const DAY   = 86400000;

  filtered = allConversations.filter(c => {
    // Search
    if (q && !c.title?.toLowerCase().includes(q)) return false;

    // Date filter
    if (date) {
      const ts = (c.update_time || c.create_time || 0) * 1000;
      const age = now - ts;
      if (date === 'today'  && age > DAY)        return false;
      if (date === 'week'   && age > 7  * DAY)   return false;
      if (date === 'month'  && age > 30 * DAY)   return false;
      if (date === 'older'  && age < 30 * DAY)   return false;
    }

    // Model filter
    if (model && !(c.default_model_slug || '').includes(model)) return false;

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    const ta = (a.update_time || a.create_time || 0);
    const tb = (b.update_time || b.create_time || 0);
    const titleA = (a.title || '').toLowerCase();
    const titleB = (b.title || '').toLowerCase();
    if (sort === 'newest') return tb - ta;
    if (sort === 'oldest') return ta - tb;
    if (sort === 'az')     return titleA.localeCompare(titleB);
    if (sort === 'za')     return titleB.localeCompare(titleA);
    return 0;
  });

  renderList();
  updateCounts();
}

// ============================================================
// RENDER LIST
// ============================================================
function renderList() {
  // Remove old rows (keep empty state)
  convList.querySelectorAll('.conv-item').forEach(el => el.remove());

  if (filtered.length === 0) {
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  const frag = document.createDocumentFragment();

  filtered.forEach(c => {
    const item = document.createElement('div');
    item.className = 'conv-item' + (selected.has(c.id) ? ' selected' : '');
    item.dataset.id = c.id;

    const date  = c.update_time
      ? new Date(c.update_time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';
    const model = shortModel(c.default_model_slug || '');

    item.innerHTML = `
      <input type="checkbox" class="conv-check" data-id="${c.id}" ${selected.has(c.id) ? 'checked' : ''}/>
      <div class="conv-title" title="${escHtml(c.title || 'Untitled')}">${escHtml(c.title || 'Untitled')}</div>
      <div class="conv-meta">
        ${model ? `<span class="conv-model">${model}</span>` : ''}
        <span class="conv-date">${date}</span>
      </div>
    `;

    // Checkbox click
    item.querySelector('.conv-check').addEventListener('change', e => {
      e.stopPropagation();
      toggleSelect(c.id, e.target.checked);
    });

    // Row click — open conversation
    item.querySelector('.conv-title').addEventListener('click', e => {
      e.stopPropagation();
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: `https://chatgpt.com/c/${c.id}` });
      });
    });

    frag.appendChild(item);
  });

  convList.appendChild(frag);
  syncMasterCheckbox();
}

function shortModel(slug) {
  if (!slug) return '';
  if (slug.includes('gpt-4o'))  return '4o';
  if (slug.includes('gpt-4'))   return '4';
  if (slug.includes('gpt-3.5')) return '3.5';
  if (slug.includes('o1'))      return 'o1';
  return slug.split('-').slice(-1)[0];
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// SELECTION
// ============================================================
function toggleSelect(id, checked) {
  checked ? selected.add(id) : selected.delete(id);
  const item = convList.querySelector(`.conv-item[data-id="${id}"]`);
  if (item) item.classList.toggle('selected', checked);
  updateCounts();
  syncMasterCheckbox();
}

function selectAll() {
  filtered.forEach(c => selected.add(c.id));
  convList.querySelectorAll('.conv-check').forEach(cb => cb.checked = true);
  convList.querySelectorAll('.conv-item').forEach(el => el.classList.add('selected'));
  updateCounts();
  syncMasterCheckbox();
}

function selectNone() {
  selected.clear();
  convList.querySelectorAll('.conv-check').forEach(cb => cb.checked = false);
  convList.querySelectorAll('.conv-item').forEach(el => el.classList.remove('selected'));
  updateCounts();
  syncMasterCheckbox();
}

function invertSelection() {
  filtered.forEach(c => selected.has(c.id) ? selected.delete(c.id) : selected.add(c.id));
  convList.querySelectorAll('.conv-item').forEach(el => {
    const id = el.dataset.id;
    const checked = selected.has(id);
    el.classList.toggle('selected', checked);
    el.querySelector('.conv-check').checked = checked;
  });
  updateCounts();
  syncMasterCheckbox();
}

function smartSelect(mode) {
  selectNone();
  const now = Date.now();
  const DAY = 86400000;

  filtered.forEach(c => {
    let pick = false;
    if (mode === 'empty'    && (c.message_count || 0) === 0)             pick = true;
    if (mode === 'short'    && (c.message_count || 0) < 3)               pick = true;
    if (mode === 'before30' && now - (c.update_time || 0) * 1000 > 30 * DAY) pick = true;
    if (mode === 'before90' && now - (c.update_time || 0) * 1000 > 90 * DAY) pick = true;
    if (mode === 'invert')  pick = !selected.has(c.id);
    if (pick) selected.add(c.id);
  });

  renderList();
  updateCounts();
}

function syncMasterCheckbox() {
  const visibleIds = filtered.map(c => c.id);
  const allChecked = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  masterCheckbox.checked = allChecked;
  masterCheckbox.indeterminate = !allChecked && visibleIds.some(id => selected.has(id));
}

// ============================================================
// COUNTS & ACTION BAR
// ============================================================
function updateCounts() {
  const total = allConversations.length;
  const sel   = selected.size;

  headerCount.textContent = `${total} conversation${total !== 1 ? 's' : ''}`;
  footerCount.textContent = `${total} conversation${total !== 1 ? 's' : ''}`;

  if (sel > 0) {
    actionBar.classList.add('visible');
    actionLabel.textContent = `${sel} selected`;
  } else {
    actionBar.classList.remove('visible');
  }
}

// ============================================================
// BULK DELETE
// ============================================================
async function deleteSelected() {
  const ids = [...selected];
  if (ids.length === 0) return;

  const confirmed = await showModal(
    '🗑 Delete conversations',
    `Delete ${ids.length} conversation${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
    false,
    'Delete',
    true
  );
  if (!confirmed) return;

  // Save for undo
  undoData = {
    ids,
    conversations: allConversations.filter(c => ids.includes(c.id))
  };

  // Remove from UI immediately
  allConversations = allConversations.filter(c => !ids.includes(c.id));
  selected.clear();
  applyFilters();

  // Show progress
  showProgress(`Deleting 0 / ${ids.length}…`);
  startProgressPolling(ids.length, 'bulkProgress');

  try {
    const res = await send({ action: 'BULK_DELETE', ids });
    hideProgress();
    stopProgressPolling();
    showToast(`Deleted ${res.deleted} conversation${res.deleted !== 1 ? 's' : ''}.`, 'success', true);
  } catch (err) {
    hideProgress();
    stopProgressPolling();
    showToast(friendlyError(err.message), 'error');
    // Restore on failure
    allConversations = [...undoData.conversations, ...allConversations];
    undoData = null;
    applyFilters();
  }
}

async function deleteAll() {
  const confirmed = await showModal(
    '⚠️ Delete ALL conversations',
    `This will permanently delete all ${allConversations.length} conversations. Type DELETE to confirm.`,
    true,
    'Delete all',
    true
  );
  if (!confirmed) return;

  const ids = allConversations.map(c => c.id);
  undoData = { ids, conversations: [...allConversations] };

  allConversations = [];
  selected.clear();
  applyFilters();

  showProgress(`Deleting 0 / ${ids.length}…`);
  startProgressPolling(ids.length, 'bulkProgress');

  try {
    const res = await send({ action: 'BULK_DELETE', ids });
    hideProgress();
    stopProgressPolling();
    showToast(`Deleted all ${res.deleted} conversations.`, 'success', true);
  } catch (err) {
    hideProgress();
    stopProgressPolling();
    showToast(friendlyError(err.message), 'error');
    allConversations = [...undoData.conversations];
    undoData = null;
    applyFilters();
  }
}

// ============================================================
// UNDO
// ============================================================
function startUndo() {
  if (!undoData) return;
  // Restore conversations in UI (already deleted from ChatGPT — this is a UI restore only)
  allConversations = [...undoData.conversations, ...allConversations];
  undoData = null;
  applyFilters();
  showToast('Restored in your list. Note: conversations are deleted on ChatGPT\'s side.', 'info');
}

// ============================================================
// EXPORT
// ============================================================
async function exportSelected(format) {
  const ids = [...selected];
  if (ids.length === 0) return;

  if (format === 'zip' || ids.length > 1) {
    showProgress(`Fetching 0 / ${ids.length} conversations…`);
    startProgressPolling(ids.length, 'exportProgress');
    try {
      const res = await send({ action: 'EXPORT_BULK', ids, format: format === 'zip' ? 'md' : format });
      hideProgress();
      stopProgressPolling();
      res.results.forEach(r => downloadFile(r.title, r.text, r.format));
      showToast(`Exported ${res.results.length} conversations.`, 'success');
    } catch (err) {
      hideProgress();
      stopProgressPolling();
      showToast(friendlyError(err.message), 'error');
    }
  } else {
    showLoading('Fetching conversation…');
    try {
      const res = await send({ action: 'EXPORT_ONE', id: ids[0], format });
      showMain();
      downloadFile(res.title, res.text, res.format);
      showToast(`Exported as .${format}`, 'success');
    } catch (err) {
      showMain();
      showToast(friendlyError(err.message), 'error');
    }
  }
}

function downloadFile(title, text, format) {
  const ext  = format === 'json' ? 'json' : format === 'txt' ? 'txt' : 'md';
  const name = (title || 'conversation').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').slice(0, 60);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// PROGRESS BAR
// ============================================================
function showProgress(label) {
  progressLabel.textContent = label;
  progressFill.style.width  = '0%';
  progressWrap.classList.add('visible');
}

function hideProgress() {
  progressWrap.classList.remove('visible');
  progressFill.style.width = '0%';
  if (progressInterval) clearInterval(progressInterval);
}

function startProgressPolling(total, key) {
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(async () => {
    const data = await chrome.storage.session.get(key);
    const p = data[key];
    if (!p) return;
    const pct = Math.round((p.done / total) * 100);
    progressFill.style.width   = `${pct}%`;
    progressLabel.textContent  = key === 'bulkProgress'
      ? `Deleting ${p.done} / ${total}…`
      : `Fetching ${p.done} / ${total}…`;
  }, 200);
}

function stopProgressPolling() {
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'info', withUndo = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let html = `<span class="toast-msg">${msg}</span>`;
  if (withUndo && undoData) {
    let secs = 8;
    html += `<button class="toast-undo">Undo</button><span class="toast-timer">${secs}s</span>`;
  }
  toast.innerHTML = html;
  toastArea.appendChild(toast);

  if (withUndo && undoData) {
    let secs = 8;
    const timerEl = toast.querySelector('.toast-timer');
    const undoBtn = toast.querySelector('.toast-undo');

    undoBtn.addEventListener('click', () => {
      startUndo();
      toast.remove();
      if (undoTimer) clearInterval(undoTimer);
    });

    undoTimer = setInterval(() => {
      secs--;
      if (timerEl) timerEl.textContent = `${secs}s`;
      if (secs <= 0) {
        clearInterval(undoTimer);
        undoData = null;
        toast.remove();
      }
    }, 1000);
  } else {
    setTimeout(() => toast.remove(), 3500);
  }
}

// ============================================================
// MODAL
// ============================================================
function showModal(title, body, requireInput, confirmLabel = 'Confirm', isDanger = false) {
  return new Promise(resolve => {
    modalTitle.textContent   = title;
    modalBody.textContent    = body;
    modalConfirm.textContent = confirmLabel;
    modalConfirm.className   = `btn ${isDanger ? 'btn-danger' : 'btn-primary'}`;

    if (requireInput) {
      modalInput.style.display = 'block';
      modalInput.value         = '';
      modalInput.placeholder   = 'Type DELETE to confirm';
      modalConfirm.disabled    = true;
      modalInput.oninput = () => {
        modalConfirm.disabled = modalInput.value.trim() !== 'DELETE';
      };
    } else {
      modalInput.style.display = 'none';
      modalConfirm.disabled    = false;
    }

    modalBackdrop.classList.add('visible');

    const cleanup = result => {
      modalBackdrop.classList.remove('visible');
      modalInput.style.display = 'none';
      modalInput.oninput       = null;
      resolve(result);
    };

    modalConfirm.onclick = () => !modalConfirm.disabled && cleanup(true);
    modalCancel.onclick  = () => cleanup(false);
    modalBackdrop.onclick = e => e.target === modalBackdrop && cleanup(false);
  });
}

// ============================================================
// ERROR MESSAGES
// ============================================================
function friendlyError(code) {
  const map = {
    NOT_LOGGED_IN:  'Please log in to ChatGPT first.',
    RATE_LIMIT:     'ChatGPT is rate limiting requests. Wait a moment and try again.',
    DELETE_FAILED:  'Some conversations could not be deleted. Try again.',
    FETCH_CONTENT_FAILED: 'Could not fetch conversation content.',
    API_ERROR:      'ChatGPT API error. Try refreshing chatgpt.com.',
    NETWORK_ERROR:  'Connection lost. Check your internet.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Search
searchInput.addEventListener('input', () => {
  searchClear.classList.toggle('visible', searchInput.value.length > 0);
  applyFilters();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  applyFilters();
});

// Filters
filterDate.addEventListener('change',  applyFilters);
filterModel.addEventListener('change', applyFilters);
sortBy.addEventListener('change',      applyFilters);

filterClear.addEventListener('click', () => {
  searchInput.value = '';
  filterDate.value  = '';
  filterModel.value = '';
  sortBy.value      = 'newest';
  searchClear.classList.remove('visible');
  applyFilters();
});

// Master checkbox
masterCheckbox.addEventListener('change', () => {
  masterCheckbox.checked ? selectAll() : selectNone();
});

// Select all / none buttons
btnSelectAll.addEventListener('click',  selectAll);
btnSelectNone.addEventListener('click', selectNone);

// Smart select toggle
btnSmartSelect.addEventListener('click', () => {
  const open = smartPanel.style.display === 'flex';
  smartPanel.style.display = open ? 'none' : 'flex';
});

smartPanel.querySelectorAll('[data-smart]').forEach(btn => {
  btn.addEventListener('click', () => smartSelect(btn.dataset.smart));
});

// Delete selected
btnDeleteSelected.addEventListener('click', deleteSelected);

// Delete all
btnDeleteAll.addEventListener('click', deleteAll);

// Export menu toggle
btnExport.addEventListener('click', e => {
  e.stopPropagation();
  exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', () => { exportMenu.style.display = 'none'; });

exportMenu.querySelectorAll('.export-opt').forEach(opt => {
  opt.addEventListener('click', e => {
    e.stopPropagation();
    exportMenu.style.display = 'none';
    exportSelected(opt.dataset.fmt);
  });
});
