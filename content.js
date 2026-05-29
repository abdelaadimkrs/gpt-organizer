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
let labels        = {};   // { pairKey: { colorId, colorHex, note } }
let convId        = null; // current conversation ID from URL
let observer      = null; // MutationObserver watching for new messages
let ioObserver    = null; // IntersectionObserver tracking visible messages
let labelLayer    = null; // fixed overlay that holds all label buttons (never touches articles)
let msgPairs      = [];   // [{ uIdx, aIdx, key, anchorIdx }] — one entry per exchange
let msgToPairKey  = {};   // messageIndex → pairKey reverse lookup
let panelOpen     = false;
let navFilter     = 'all'; // 'all' | 'user' | 'assistant'

// Conversation-level labels & bulk selection
let convLabels    = {};   // { convId: { colorId, colorHex } }
let selectedConvs = new Set();
let accessToken   = null;
let notesOpen     = false;
let folders       = [];   // ['Work', 'Personal', …]
let convFolders   = {};   // { convId: 'folderName' }
let activeFolder  = null; // null = show all

// ============================================================
// INJECT STYLES
// ============================================================
const style = document.createElement('style');
style.textContent = `
  /* ── NAV BUTTONS ── */
  #gpt-nav {
    position: fixed;
    bottom: 100px;
    right: 58px;
    z-index: 9999;
    transition: right 0.25s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .gpt-nav-btn {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #2d2d2d;
    border: 1px solid #555;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.6);
    transition: background 0.15s, transform 0.1s;
    user-select: none;
  }
  .gpt-nav-btn:hover { background: #3a3a3a; transform: scale(1.08); }
  .gpt-nav-btn:active { transform: scale(0.96); }
  .gpt-nav-btn.disabled { opacity: 0.25; cursor: default; pointer-events: none; }

  /* ── NAV FILTER TOGGLE ── */
  #gpt-nav-filter {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: #2d2d2d;
    border: 1px solid #555;
    border-radius: 10px;
    padding: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.6);
  }
  .gpt-nf-btn {
    width: 28px; height: 22px;
    border-radius: 6px;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, color 0.12s;
    font-family: inherit;
    letter-spacing: 0.3px;
  }
  .gpt-nf-btn:hover { background: #3a3a3a; color: #ffffff; }
  .gpt-nf-btn.active { background: #1f6feb; color: #ffffff; }

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
    font-weight: 700;
    box-shadow: -2px 0 12px rgba(0,0,0,0.4);
    transition: background 0.15s, right 0.3s;
  }
  #gpt-panel-toggle:hover { background: #388bfd; }

  /* ── FLOATING PANEL ── */
  #gpt-panel {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 300px;
    background: #111318;
    border-left: 1px solid #2d3139;
    z-index: 9998;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    box-shadow: -8px 0 32px rgba(0,0,0,0.6);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  #gpt-panel.open {
    transform: translateX(0);
  }

  /* Panel header */
  #gpt-panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 14px 10px;
    border-bottom: 1px solid #2d3139;
    flex-shrink: 0;
    background: #161b22;
  }
  #gpt-panel-title {
    font-size: 13px; font-weight: 700; color: #f0f6fc;
    display: flex; align-items: center; gap: 7px;
  }
  #gpt-panel-close {
    background: none; border: none; color: #8b949e;
    font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
  }
  #gpt-panel-close:hover { background: #2d3139; color: #f0f6fc; }

  /* Panel search */
  #gpt-panel-search {
    margin: 8px 12px;
    background: #1c2128;
    border: 1px solid #3d444d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 12px;
    font-family: inherit;
    padding: 6px 10px;
    outline: none;
    width: calc(100% - 24px);
    flex-shrink: 0;
  }
  #gpt-panel-search:focus { border-color: #388bfd; }
  #gpt-panel-search::placeholder { color: #6e7681; }

  /* Panel filter row */
  #gpt-panel-filters {
    display: flex; gap: 5px; padding: 0 12px 8px; flex-wrap: wrap; flex-shrink: 0;
  }
  .gpt-filter-chip {
    padding: 4px 10px; border-radius: 999px;
    background: #1c2128; border: 1px solid #3d444d;
    color: #8b949e; font-size: 11px; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: all 0.12s;
  }
  .gpt-filter-chip:hover { border-color: #8b949e; color: #f0f6fc; }
  .gpt-filter-chip.active { border-color: #388bfd; color: #ffffff; background: #1a3a6e; }

  /* Panel message list */
  #gpt-msg-list {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column;
  }
  #gpt-msg-list::-webkit-scrollbar { width: 3px; }
  #gpt-msg-list::-webkit-scrollbar-thumb { background: #3d444d; border-radius: 3px; }

  /* Message row */
  .gpt-msg-row {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #1c2128;
    cursor: pointer;
    transition: background 0.1s;
    position: relative;
  }
  .gpt-msg-row:hover { background: #1c2128; }
  .gpt-msg-row.active { background: #132743; border-left: 3px solid #388bfd; padding-left: 9px; }

  /* Color dot */
  .gpt-color-dot {
    width: 10px; height: 10px; border-radius: 50%;
    flex-shrink: 0; margin-top: 3px;
    background: transparent;
    border: 2px solid #3d444d;
    cursor: pointer;
    transition: transform 0.1s;
  }
  .gpt-color-dot:hover { transform: scale(1.4); }
  .gpt-color-dot.labeled { border-color: transparent; }

  /* Message content */
  .gpt-msg-content { flex: 1; min-width: 0; }
  .gpt-msg-role {
    font-size: 10px; font-weight: 700; color: #6e7681;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .gpt-msg-role.user { color: #388bfd; }
  .gpt-msg-preview {
    font-size: 12px; color: #8b949e;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 200px;
  }
  .gpt-msg-row:hover .gpt-msg-preview { color: #f0f6fc; }
  .gpt-msg-index {
    font-size: 10px; color: #6e7681; flex-shrink: 0; margin-top: 2px; font-weight: 600;
  }

  /* Color picker popover */
  .gpt-color-picker {
    position: absolute; left: 28px; top: 4px; z-index: 10001;
    background: #1c2128; border: 1px solid #3d444d;
    border-radius: 8px; padding: 8px;
    display: flex; flex-direction: column; gap: 5px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.7);
    min-width: 130px;
  }
  .gpt-picker-row {
    display: flex; align-items: center; gap: 7px;
    padding: 4px 6px; border-radius: 5px; cursor: pointer;
    font-size: 11px; color: #8b949e;
  }
  .gpt-picker-row:hover { background: #2d3139; color: #f0f6fc; }
  .gpt-picker-swatch {
    width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
  }
  .gpt-picker-clear {
    font-size: 11px; color: #6e7681; text-align: center;
    padding: 3px; cursor: pointer; border-top: 1px solid #2d3139; margin-top: 2px;
  }
  .gpt-picker-clear:hover { color: #f0f6fc; }

  /* ── LABEL LAYER — fixed overlay, never touches ChatGPT's article DOM ── */
  #gpt-label-layer {
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 9500;
  }

  /* Label button lives inside the overlay, always visible */
  .gpt-label-btn {
    position: absolute;
    pointer-events: auto;
    width: 28px; height: 28px;
    border-radius: 8px;
    background: rgba(45,45,45,0.92);
    border: 1px solid #555;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #aaaaaa;
    opacity: 0.65;
    transition: opacity 0.15s, transform 0.1s, color 0.15s, background 0.15s;
    padding: 0;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
  }
  .gpt-label-btn:hover { opacity: 1; transform: scale(1.12); background: rgba(60,60,60,0.98); color: #ffffff; }
  .gpt-label-btn.is-labeled { opacity: 1; background: rgba(35,35,35,0.95); }

  /* ── INLINE COLOR PICKER (fixed to body, positioned via JS) ── */
  .gpt-inline-picker {
    position: fixed;
    display: flex; gap: 6px; align-items: center;
    background: #1c2128; border: 1px solid #3d444d;
    border-radius: 999px; padding: 7px 12px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.8);
    z-index: 999999; white-space: nowrap;
  }
  .gpt-inline-dot {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid transparent; cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
    flex-shrink: 0;
  }
  .gpt-inline-dot:hover { transform: scale(1.35); border-color: rgba(255,255,255,0.7); }
  .gpt-inline-clear {
    width: 20px; height: 20px; border-radius: 50%;
    background: #3d444d; border: none; cursor: pointer;
    color: #c9d1d9; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .gpt-inline-clear:hover { background: #555; color: #fff; }

  /* Pair row title line */
  .gpt-pair-header {
    display: flex; align-items: center; gap: 4px; margin-bottom: 3px;
  }
  .gpt-pair-title {
    font-size: 12px; font-weight: 600; color: #e6edf3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex: 1; min-width: 0;
  }
  .gpt-edit-title-btn {
    background: none; border: none; cursor: pointer;
    color: #6e7681; font-size: 12px; padding: 1px 4px;
    border-radius: 3px; flex-shrink: 0; line-height: 1;
  }
  .gpt-edit-title-btn:hover { background: #2d3139; color: #f0f6fc; }
  .gpt-title-input {
    flex: 1; min-width: 0;
    background: #1c2128; border: 1px solid #388bfd;
    border-radius: 4px; color: #f0f6fc; font-size: 12px;
    padding: 2px 6px; font-family: inherit; outline: none;
  }
  .gpt-ai-preview {
    font-size: 11px; color: #6e7681;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 1px;
  }
  .gpt-msg-row:hover .gpt-ai-preview { color: #8b949e; }

  /* Panel empty state */
  #gpt-panel-empty {
    display: none; flex-direction: column; align-items: center;
    justify-content: center; gap: 8px; padding: 40px 20px;
    flex: 1; text-align: center;
  }
  #gpt-panel-empty.visible { display: flex; }
  .gpt-empty-icon { font-size: 28px; opacity: 0.4; }
  .gpt-empty-text { font-size: 12px; color: #6e7681; }

  /* ── CUSTOM MODAL ── */
  .gpt-modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(4px);
    z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    animation: gptFadeIn 0.18s ease;
  }
  @keyframes gptFadeIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes gptFadeOut { from { opacity:1 } to { opacity:0 } }
  @keyframes gptModalIn {
    from { opacity:0; transform: scale(0.9) translateY(-12px); }
    to   { opacity:1; transform: scale(1)   translateY(0);     }
  }
  .gpt-modal {
    background: #161b22;
    border: 1px solid #3d444d;
    border-radius: 16px;
    padding: 28px 28px 24px;
    width: 360px;
    max-width: calc(100vw - 48px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.8);
    animation: gptModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .gpt-modal-icon {
    font-size: 32px; line-height: 1; margin-bottom: 14px; display: block;
  }
  .gpt-modal-title {
    font-size: 16px; font-weight: 700; color: #f0f6fc;
    margin-bottom: 8px; line-height: 1.3;
  }
  .gpt-modal-msg {
    font-size: 13px; color: #8b949e; line-height: 1.65; margin-bottom: 24px;
  }
  .gpt-modal-msg strong { color: #c9d1d9; }
  .gpt-modal-actions {
    display: flex; justify-content: flex-end; gap: 10px;
  }
  .gpt-modal-btn {
    padding: 8px 20px; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    border: 1px solid transparent; font-family: inherit;
    transition: background 0.12s, transform 0.08s;
    outline: none;
  }
  .gpt-modal-btn:active { transform: scale(0.97); }
  .gpt-modal-cancel  { background: #2d3139; border-color: #3d444d; color: #c9d1d9; }
  .gpt-modal-cancel:hover  { background: #3d444d; color: #f0f6fc; }
  .gpt-modal-danger  { background: #b91c1c; border-color: #dc2626; color: #fff; }
  .gpt-modal-danger:hover  { background: #dc2626; }
  .gpt-modal-primary { background: #1f6feb; border-color: #388bfd; color: #fff; }
  .gpt-modal-primary:hover { background: #388bfd; }

  /* Panel footer */
  #gpt-panel-footer {
    padding: 8px 12px; border-top: 1px solid #2d3139;
    font-size: 11px; color: #6e7681; flex-shrink: 0;
    display: flex; justify-content: space-between; align-items: center;
    background: #161b22;
  }
  #gpt-export-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 6px;
    background: #1c2128; border: 1px solid #3d444d;
    color: #8b949e; font-size: 11px; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  #gpt-export-btn:hover { background: #1f6feb; border-color: #388bfd; color: #fff; }
  #gpt-export-format {
    display: flex; gap: 4px;
  }
  .gpt-fmt-btn {
    padding: 3px 8px; border-radius: 5px;
    background: #1c2128; border: 1px solid #3d444d;
    color: #8b949e; font-size: 10px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .gpt-fmt-btn:hover  { background: #2d3139; color: #f0f6fc; }
  .gpt-fmt-btn.active { background: #1a3a6e; border-color: #388bfd; color: #388bfd; }

  /* ── NOTES PANEL ── */
  #gpt-notes-btn {
    margin-top: 4px;
  }
  #gpt-notes-btn.active {
    background: #1a3a6e !important;
    border-color: #388bfd !important;
    color: #388bfd !important;
  }
  #gpt-notes-panel {
    position: fixed;
    right: 102px;
    bottom: 80px;
    width: 300px;
    height: 360px;
    background: #111318;
    border: 1px solid #2d3139;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.7);
    z-index: 9990;
    display: none;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
    animation: gptModalIn 0.18s cubic-bezier(0.34,1.3,0.64,1);
  }
  #gpt-notes-panel.open { display: flex; }
  #gpt-notes-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px 8px;
    border-bottom: 1px solid #2d3139;
    background: #161b22;
    flex-shrink: 0;
    cursor: move;
    user-select: none;
  }
  #gpt-notes-title {
    font-size: 12px; font-weight: 700; color: #f0f6fc;
    display: flex; align-items: center; gap: 6px;
  }
  #gpt-notes-close {
    background: none; border: none; color: #8b949e;
    font-size: 14px; cursor: pointer; padding: 2px 5px; border-radius: 4px;
    line-height: 1;
  }
  #gpt-notes-close:hover { background: #2d3139; color: #f0f6fc; }
  #gpt-notes-scope {
    font-size: 10px; color: #6e7681; font-weight: 400;
    padding: 4px 12px; background: #0d1117; flex-shrink: 0;
    border-bottom: 1px solid #2d3139;
  }
  #gpt-notes-scope span { color: #388bfd; }
  #gpt-notes-textarea {
    flex: 1; resize: none; outline: none;
    background: #111318; border: none;
    color: #c9d1d9; font-size: 13px; line-height: 1.6;
    padding: 12px 14px; font-family: inherit;
  }
  #gpt-notes-textarea::placeholder { color: #3d444d; }
  #gpt-notes-footer {
    padding: 5px 12px;
    border-top: 1px solid #2d3139;
    font-size: 10px; color: #6e7681;
    background: #161b22; flex-shrink: 0;
    display: flex; justify-content: space-between; align-items: center;
  }
  #gpt-notes-saved { color: #22c55e; opacity: 0; transition: opacity 0.3s; }
  #gpt-notes-saved.visible { opacity: 1; }

  /* ── SIDEBAR CONVERSATION LABELS & BULK SELECTION ── */
  #history li { position: relative !important; }

  /* Label color applied directly to <a> via JS (box-shadow inset bar + bg tint) */

  /* Checkbox wrapper — hidden by default, shown on hover or in selection mode */
  .gpt-conv-cb-wrap {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 32px;
    display: flex; align-items: center; justify-content: center;
    z-index: 5; opacity: 0; pointer-events: none;
    transition: opacity 0.15s;
  }
  #history li.gpt-has-cb:hover .gpt-conv-cb-wrap { opacity: 1; pointer-events: auto; }
  .gpt-selection-mode .gpt-conv-cb-wrap           { opacity: 1; pointer-events: auto; }

  .gpt-conv-cb {
    width: 15px; height: 15px; cursor: pointer;
    accent-color: #388bfd; border-radius: 4px; flex-shrink: 0;
  }

  /* Shift conversation titles right to make room when checkbox is visible */
  #history li.gpt-has-cb:hover a[href^="/c/"],
  .gpt-selection-mode a[href^="/c/"] { padding-left: 28px !important; }

  /* ── BULK ACTION BAR — sticky inside the sidebar nav ── */
  #gpt-conv-bulk-bar {
    position: sticky;
    bottom: 0;
    display: none;
    align-items: stretch;
    gap: 5px;
    padding: 8px;
    background: #161b22;
    border-top: 2px solid #388bfd;
    z-index: 50;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.7);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    flex-shrink: 0;
  }
  .gpt-bulk-btn {
    flex: 1; height: 38px; border-radius: 8px;
    background: #2d3139; border: 1px solid #3d444d;
    color: #c9d1d9; font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    min-width: 0;
  }
  .gpt-bulk-btn svg { width: 18px; height: 18px; }
  .gpt-bulk-btn:hover { background: #3d444d; border-color: #6e7681; color: #f0f6fc; }
  #gpt-conv-selectall-btn:hover { background: #1f6feb !important; border-color: #388bfd !important; color: #fff !important; }
  #gpt-conv-label-btn:hover     { background: #1f6feb !important; border-color: #388bfd !important; color: #fff !important; }
  #gpt-conv-archive-btn:hover    { background: #d97706 !important; border-color: #f59e0b !important; color: #fff !important; }
  #gpt-conv-folder-btn:hover     { background: #6d28d9 !important; border-color: #7c3aed !important; color: #fff !important; }
  #gpt-conv-exportzip-btn:hover  { background: #15803d !important; border-color: #22c55e !important; color: #fff !important; }
  #gpt-conv-delete-btn:hover     { background: #b91c1c !important; border-color: #ef4444 !important; color: #fff !important; }

  /* ── FOLDER BAR (top of sidebar) ── */
  #gpt-folder-bar {
    display: flex; flex-wrap: wrap; gap: 4px;
    padding: 7px 10px;
    border-bottom: 1px solid #2d3139;
    background: #0d1117;
    flex-shrink: 0;
    position: sticky; top: 0; z-index: 10;
  }
  .gpt-folder-chip {
    padding: 3px 9px; border-radius: 999px;
    background: #1c2128; border: 1px solid #3d444d;
    color: #8b949e; font-size: 10px; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: all 0.12s; white-space: nowrap;
  }
  .gpt-folder-chip:hover  { border-color: #8b949e; color: #f0f6fc; }
  .gpt-folder-chip.active { background: #1a3a6e; border-color: #388bfd; color: #388bfd; }
  #gpt-folder-new-btn {
    padding: 3px 8px; border-radius: 999px;
    background: none; border: 1px dashed #3d444d;
    color: #6e7681; font-size: 10px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: all 0.12s;
  }
  #gpt-folder-new-btn:hover { border-color: #8b949e; color: #f0f6fc; }

  /* Folder picker dropdown */
  .gpt-folder-picker {
    position: fixed; background: #1c2128;
    border: 1px solid #3d444d; border-radius: 10px;
    padding: 6px; z-index: 10003;
    box-shadow: 0 8px 24px rgba(0,0,0,0.7); min-width: 180px;
  }
  .gpt-folder-picker-row {
    display: flex; align-items: center; gap: 7px;
    width: 100%; padding: 6px 8px; border-radius: 6px;
    background: none; border: none; color: #c9d1d9;
    font-size: 12px; cursor: pointer; font-family: inherit;
    text-align: left; transition: background 0.1s;
  }
  .gpt-folder-picker-row:hover { background: #2d3139; }
  .gpt-folder-picker-sep { border-top: 1px solid #2d3139; margin: 4px 0; }
  .gpt-folder-picker-muted { color: #6e7681; }
  .gpt-folder-picker-muted:hover { color: #f0f6fc; }
  .gpt-folder-new-row { padding: 4px 2px 2px; }
  .gpt-folder-new-input {
    width: 100%; background: #0d1117; border: 1px solid #3d444d;
    border-radius: 5px; color: #f0f6fc; font-size: 11px;
    padding: 5px 8px; outline: none; font-family: inherit;
    box-sizing: border-box;
  }
  .gpt-folder-new-input:focus { border-color: #388bfd; }

  /* Folder badge on conversation anchor */
  .gpt-conv-folder-badge {
    display: inline-block; font-size: 9px;
    padding: 1px 5px; border-radius: 999px;
    background: #1c2128; border: 1px solid #3d444d;
    color: #8b949e; margin-left: 4px;
    vertical-align: middle; pointer-events: none; white-space: nowrap;
  }
  .gpt-bulk-active { background: #1a3a6e !important; border-color: #388bfd !important; color: #388bfd !important; }
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
    <button class="gpt-nav-btn" id="gpt-notes-btn" title="Toggle notes">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    </button>
    <button class="gpt-nav-btn" id="gpt-export-nav-btn" title="Export conversation (MD / TXT)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>
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
      <div style="display:flex;align-items:center;gap:6px;">
        <div id="gpt-export-format">
          <button class="gpt-fmt-btn active" data-fmt="md"  title="Markdown">MD</button>
          <button class="gpt-fmt-btn"        data-fmt="txt" title="Plain text">TXT</button>
        </div>
        <button id="gpt-export-btn" title="Export conversation">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Notes panel
  const notesPanel = document.createElement('div');
  notesPanel.id = 'gpt-notes-panel';
  notesPanel.innerHTML = `
    <div id="gpt-notes-header">
      <div id="gpt-notes-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Notes
      </div>
      <button id="gpt-notes-close" title="Close">✕</button>
    </div>
    <div id="gpt-notes-scope">Saving to: <span id="gpt-notes-scope-label">global</span></div>
    <textarea id="gpt-notes-textarea" placeholder="Write your notes here…" spellcheck="true"></textarea>
    <div id="gpt-notes-footer">
      <span id="gpt-notes-charcount">0 chars</span>
      <span id="gpt-notes-saved">✓ Saved</span>
    </div>
  `;
  document.body.appendChild(notesPanel);

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

  // Notes
  document.getElementById('gpt-notes-btn').addEventListener('click', toggleNotesPanel);
  document.getElementById('gpt-notes-close').addEventListener('click', toggleNotesPanel);
  makeNotesPanelDraggable();

  // Export
  document.getElementById('gpt-export-nav-btn').addEventListener('click', exportConversation);
  document.getElementById('gpt-export-btn').addEventListener('click', exportConversation);
  document.getElementById('gpt-export-format').addEventListener('click', e => {
    const btn = e.target.closest('.gpt-fmt-btn');
    if (!btn) return;
    document.querySelectorAll('.gpt-fmt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

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
  const panel      = document.getElementById('gpt-panel');
  const toggle     = document.getElementById('gpt-panel-toggle');
  const nav        = document.getElementById('gpt-nav');
  const notesPanel = document.getElementById('gpt-notes-panel');
  panel.classList.toggle('open', panelOpen);
  toggle.style.right = panelOpen ? '300px' : '0';
  if (nav)        nav.style.display      = panelOpen ? 'none' : 'flex';
  if (notesPanel) notesPanel.style.right = panelOpen ? '402px' : '102px';
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
  // 1. Direct attribute on the element itself
  const direct = el.getAttribute('data-message-author-role');
  if (direct) return direct;

  // 2. Child element with role attribute (most reliable in current ChatGPT DOM)
  const child = el.querySelector('[data-message-author-role]');
  if (child) return child.getAttribute('data-message-author-role');

  // 3. Look for user avatar / indicator text
  if (el.querySelector('img[alt="You"]'))    return 'user';
  if (el.querySelector('img[alt*="User"]'))  return 'user';

  // 4. Even/odd turn number — turn 2 = first user message in ChatGPT
  const testId = el.getAttribute('data-testid') || '';
  const num    = parseInt(testId.replace('conversation-turn-', ''), 10);
  if (!isNaN(num)) return num % 2 === 0 ? 'user' : 'assistant';

  return 'assistant';
}

function getPreview(el) {
  // Clone so we can strip ChatGPT's UI buttons ("Show more", "Show less", etc.)
  const clone = el.cloneNode(true);
  clone.querySelectorAll('button, [role="button"]').forEach(n => n.remove());
  const text = clone.textContent?.trim().replace(/\s+/g, ' ') || '';
  return text.slice(0, 120);
}

function getMsgKey(index) {
  return `${convId}_msg_${index}`;
}

// Group consecutive user+assistant messages into exchange pairs.
// Each pair gets ONE label button and ONE shared label color.
function buildPairs() {
  msgPairs     = [];
  msgToPairKey = {};
  let i = 0;
  while (i < messages.length) {
    const role = getRole(messages[i]);
    if (role === 'user') {
      const uIdx = i;
      const hasAssistant = i + 1 < messages.length && getRole(messages[i + 1]) === 'assistant';
      const aIdx = hasAssistant ? i + 1 : null;
      // Button anchors to the assistant response; falls back to user message
      const anchorIdx = aIdx !== null ? aIdx : uIdx;
      const key = getMsgKey(uIdx);
      msgPairs.push({ uIdx, aIdx, anchorIdx, key });
      msgToPairKey[uIdx] = key;
      if (aIdx !== null) msgToPairKey[aIdx] = key;
      i = aIdx !== null ? aIdx + 1 : uIdx + 1;
    } else {
      // Standalone assistant (e.g. opening message)
      const key = getMsgKey(i);
      msgPairs.push({ uIdx: null, aIdx: i, anchorIdx: i, key });
      msgToPairKey[i] = key;
      i++;
    }
  }
}

// ============================================================
// SCAN & REBUILD MESSAGE LIST
// ============================================================
function scanMessages() {
  messages = getMessages();
  buildPairs();
  if (currentIndex === -1) snapToVisible();
  updateNavButtons();
  if (panelOpen) renderPanel();
  applyLabelStyling();
  tryInjectLabelButtons();
  startIntersectionObserver();
}

// Find which message is closest to the top of the visible viewport
function snapToVisible() {
  if (messages.length === 0) return;
  let bestIdx = -1;
  let bestDist = Infinity;
  messages.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) return; // off-screen
    // Prefer messages whose top edge is nearest to the top quarter of the viewport
    const dist = Math.abs(r.top - window.innerHeight * 0.25);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  });
  if (bestIdx !== -1) currentIndex = bestIdx;
}

// ============================================================
// NAVIGATE
// ============================================================

// Returns only the messages matching the current navFilter
function filteredMessages() {
  if (navFilter === 'all') return messages;
  return messages.filter(el => getRole(el) === navFilter);
}

function scrollAllAncestors(el, toBottom) {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight + 5) {
      node.scrollTo({
        top: toBottom ? node.scrollHeight - node.clientHeight : 0,
        behavior: 'smooth',
      });
    }
    node = node.parentElement;
  }
}

function navigateTo(index) {
  if (index < 0 || index >= messages.length) return;
  currentIndex = index;

  const pool    = filteredMessages();
  const poolIds = pool.map(el => messages.indexOf(el));
  const isFirst = index === poolIds[0];
  const isLast  = index === poolIds[poolIds.length - 1];

  if (isFirst) {
    scrollAllAncestors(messages[index], false);
  } else if (isLast) {
    scrollAllAncestors(messages[index], true);
  } else {
    messages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  updateNavButtons();
  highlightActiveRow();
}

function navigatePrev() {
  snapToVisible();
  const pool = filteredMessages();
  if (pool.length === 0) return;
  const before = pool.filter(el => messages.indexOf(el) < currentIndex);
  const target = before.length > 0 ? before[before.length - 1] : pool[0];
  navigateTo(messages.indexOf(target));
}

function navigateNext() {
  snapToVisible();
  const pool = filteredMessages();
  if (pool.length === 0) return;
  const after = pool.filter(el => messages.indexOf(el) > currentIndex);
  const target = after.length > 0 ? after[0] : pool[pool.length - 1];
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
  down.classList.toggle('disabled', !hasNext);
}

// ============================================================
// RENDER PANEL — one row per exchange pair
// ============================================================
function renderPanel() {
  const list   = document.getElementById('gpt-msg-list');
  const empty  = document.getElementById('gpt-panel-empty');
  const count  = document.getElementById('gpt-msg-count');
  const search = (document.getElementById('gpt-panel-search')?.value || '').toLowerCase();
  const filter = document.querySelector('.gpt-filter-chip.active')?.dataset.filter || 'all';

  list.querySelectorAll('.gpt-msg-row').forEach(r => r.remove());

  const pairs = msgPairs
    .map((pair, n) => {
      const { uIdx, aIdx, key } = pair;
      const label    = labels[key];
      const userPrev = uIdx !== null && messages[uIdx] ? getPreview(messages[uIdx]) : '';
      const aiPrev   = aIdx !== null && messages[aIdx] ? getPreview(messages[aIdx]) : '';
      const title    = label?.title || userPrev || aiPrev || `Exchange #${n + 1}`;
      return { ...pair, n, label, userPrev, aiPrev, title };
    })
    .filter(p => {
      if (filter === 'labeled' && !p.label) return false;
      if (search) {
        const hay = (p.title + ' ' + p.userPrev + ' ' + p.aiPrev).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

  if (pairs.length === 0) {
    empty.classList.add('visible');
    count.textContent = '0 exchanges';
    return;
  }

  empty.classList.remove('visible');
  count.textContent = `${msgPairs.length} exchange${msgPairs.length !== 1 ? 's' : ''}`;

  const frag = document.createDocumentFragment();

  pairs.forEach(({ uIdx, aIdx, anchorIdx, key, n, label, aiPrev, title }) => {
    const navIdx  = uIdx ?? aIdx;
    const isActive = (uIdx === currentIndex || aIdx === currentIndex);
    const dotStyle = label
      ? `background:${label.colorHex}; border-color:transparent`
      : `background:transparent; border-color:#30363d`;

    const row = document.createElement('div');
    row.className = 'gpt-msg-row' + (isActive ? ' active' : '');
    row.dataset.pairKey = key;
    row.dataset.uIdx = uIdx ?? '';
    row.dataset.aIdx = aIdx ?? '';

    row.innerHTML = `
      <div class="gpt-color-dot" data-key="${key}" style="${dotStyle}"></div>
      <div class="gpt-msg-content">
        <div class="gpt-pair-header">
          <span class="gpt-pair-title">${escHtml(title)}</span>
          ${label ? `<button class="gpt-edit-title-btn" title="Edit title">✎</button>` : ''}
        </div>
        ${aIdx !== null ? `<div class="gpt-ai-preview">↳ ${escHtml(aiPrev.slice(0, 70) || '…')}</div>` : ''}
        ${label ? `<div style="margin-top:4px;display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:999px;font-size:10px;font-weight:600;color:#fff;background:${label.colorHex}">${label.colorId}</div>` : ''}
      </div>
      <div class="gpt-msg-index">#${n + 1}</div>
    `;

    row.addEventListener('click', e => {
      if (e.target.closest('.gpt-color-dot,.gpt-color-picker,.gpt-edit-title-btn')) return;
      if (navIdx !== null) { navigateTo(navIdx); highlightActiveRow(); }
    });

    row.querySelector('.gpt-color-dot').addEventListener('click', e => {
      e.stopPropagation();
      openColorPicker(row, key, navIdx ?? 0);
    });

    row.querySelector('.gpt-edit-title-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      editPairTitle(row, key, label?.title || '');
    });

    frag.appendChild(row);
  });

  list.appendChild(frag);
}

function highlightActiveRow() {
  document.querySelectorAll('.gpt-msg-row[data-pair-key]').forEach(r => {
    const u = r.dataset.uIdx !== '' ? parseInt(r.dataset.uIdx) : null;
    const a = r.dataset.aIdx !== '' ? parseInt(r.dataset.aIdx) : null;
    r.classList.toggle('active', u === currentIndex || a === currentIndex);
  });
}

function editPairTitle(row, key, current) {
  const titleEl = row.querySelector('.gpt-pair-title');
  if (!titleEl) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'gpt-title-input';
  input.value = current;
  input.placeholder = 'Enter a title…';
  titleEl.replaceWith(input);
  input.focus();
  input.select();
  const save = () => {
    const label = labels[key];
    if (!label) return;
    label.title = input.value.trim();
    setLabel(key, label).then(() => renderPanel());
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { input.blur(); }
    if (e.key === 'Escape') { renderPanel(); }
    e.stopPropagation();
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
      // Preserve any existing custom title when changing color
      setLabel(key, { ...(labels[key] || {}), colorId: c.label, colorHex: c.hex });
      picker.remove();
      renderPanel();
      applyLabelStyling();
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
    applyLabelStyling();
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
// LABEL STYLING — tint BOTH messages in each pair with the pair's label color
// ============================================================
function applyLabelStyling() {
  // Reset all messages first
  messages.forEach(el => {
    el.style.removeProperty('box-shadow');
    el.style.removeProperty('background');
  });

  // Apply pair label to both messages in the pair
  msgPairs.forEach(({ uIdx, aIdx, key }) => {
    const label = labels[key];
    [uIdx, aIdx].forEach(idx => {
      if (idx === null || idx >= messages.length) return;
      const el = messages[idx];
      if (label) {
        el.style.boxShadow = `inset 4px 0 0 ${label.colorHex}`;
        el.style.background = `${label.colorHex}12`;
      }
    });

    // Update the single overlay button for this pair
    if (labelLayer) {
      const btn = labelLayer.querySelector(`[data-pair-key="${key}"]`);
      if (btn) {
        btn.classList.toggle('is-labeled', !!label);
        updateLabelBtnColor(btn, label);
      }
    }
  });
}

function updateLabelBtnColor(btn, label) {
  if (label) {
    btn.style.color = label.colorHex;
    btn.title = `${label.colorId} — click to change`;
  } else {
    btn.style.color = '';
    btn.title = 'Label this exchange';
  }
}

// ============================================================
// LABEL OVERLAY — fixed layer above the page, no article mutation
// ============================================================
function ensureLabelLayer() {
  if (document.getElementById('gpt-label-layer')) {
    labelLayer = document.getElementById('gpt-label-layer');
    return;
  }
  labelLayer = document.createElement('div');
  labelLayer.id = 'gpt-label-layer';
  document.body.appendChild(labelLayer);
}

function tryInjectLabelButtons() {
  ensureLabelLayer();

  // Remove stale buttons whose pair no longer exists
  const liveKeys = new Set(msgPairs.map(p => p.key));
  labelLayer.querySelectorAll('.gpt-label-btn').forEach(btn => {
    if (!liveKeys.has(btn.dataset.pairKey)) btn.remove();
  });

  msgPairs.forEach(({ uIdx, aIdx, anchorIdx, key }) => {
    if (labelLayer.querySelector(`[data-pair-key="${key}"]`)) return;

    const label = labels[key];
    const btn   = document.createElement('button');
    btn.className = 'gpt-label-btn' + (label ? ' is-labeled' : '');
    btn.dataset.pairKey = key;
    // Filled label/tag icon — clear at any size
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.84zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z"/>
    </svg>`;
    updateLabelBtnColor(btn, label);

    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      openInlineColorPicker(btn, key, anchorIdx);
    });

    labelLayer.appendChild(btn);
  });

  positionLabelButtons();
}

function positionLabelButtons() {
  if (!labelLayer) return;

  // Find a single reliable left reference from the first assistant message
  // that has a .markdown element with a valid position (> 100px = past the sidebar).
  // All buttons share this x position so none drift into the sidebar.
  let refLeft = null;
  for (const el of messages) {
    if (getRole(el) !== 'assistant') continue;
    const md = el.querySelector('.markdown') || el.querySelector('[class*="prose"]');
    if (!md) continue;
    const r = md.getBoundingClientRect();
    if (r.width > 0 && r.left > 100) { refLeft = r.left; break; }
  }
  if (refLeft === null) return;
  const leftPos = Math.max(4, refLeft - 40);

  msgPairs.forEach(({ uIdx, anchorIdx, key }) => {
    const btn = labelLayer.querySelector(`[data-pair-key="${key}"]`);
    if (!btn) return;
    const topIdx = (uIdx !== null && uIdx < messages.length) ? uIdx : anchorIdx;
    if (topIdx >= messages.length) return;
    const topRect = messages[topIdx].getBoundingClientRect();
    if (topRect.width === 0) return;
    btn.style.top  = `${topRect.top + 6}px`;
    btn.style.left = `${leftPos}px`;
  });
}

function openInlineColorPicker(anchorEl, key, msgIndex) {
  document.querySelectorAll('.gpt-inline-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'gpt-inline-picker';

  COLORS.forEach(c => {
    const dot = document.createElement('button');
    dot.className = 'gpt-inline-dot';
    dot.style.background = c.hex;
    dot.title = c.label;
    dot.addEventListener('click', e => {
      e.stopPropagation();
      setLabel(key, { colorId: c.label, colorHex: c.hex }).then(() => {
        picker.remove();
        applyLabelStyling();
        renderPanel();
      });
    });
    picker.appendChild(dot);
  });

  const clear = document.createElement('button');
  clear.className = 'gpt-inline-clear';
  clear.textContent = '✕';
  clear.title = 'Remove label';
  clear.addEventListener('click', e => {
    e.stopPropagation();
    removeLabel(key).then(() => {
      picker.remove();
      applyLabelStyling();
      renderPanel();
    });
  });
  picker.appendChild(clear);

  // Append to body with fixed positioning so it's never clipped
  document.body.appendChild(picker);
  const r = anchorEl.getBoundingClientRect();
  // Show below when too close to top (header ~60px + picker ~40px + buffer)
  if (r.top > 130) {
    picker.style.bottom = `${window.innerHeight - r.top + 6}px`;
    picker.style.removeProperty('top');
  } else {
    picker.style.top = `${r.bottom + 6}px`;
    picker.style.removeProperty('bottom');
  }
  picker.style.left = `${Math.max(8, r.left)}px`;

  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 0);
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
  msgPairs     = [];
  msgToPairKey = {};
  if (labelLayer) labelLayer.innerHTML = ''; // clear stale buttons
  if (convId) await loadLabels();
  if (notesOpen) loadNote();
  setTimeout(scanMessages, 800);
}

// ============================================================
// MUTATION OBSERVER — watch for new messages + re-inject UI if removed
// ============================================================
let _scanDebounce = null;

function startObserver() {
  if (observer) observer.disconnect();

  observer = new MutationObserver(() => {
    // Re-inject UI elements if React removed them
    if (!document.getElementById('gpt-nav')) injectUI();
    if (!document.getElementById('gpt-conv-bulk-bar')) injectConvBulkBar();
    if (!document.getElementById('gpt-folder-bar')) injectFolderBar();

    // Debounce the heavier scan to avoid hammering on rapid React re-renders
    clearTimeout(_scanDebounce);
    _scanDebounce = setTimeout(() => {
      const newCount = getMessages().length;
      if (newCount !== messages.length) scanMessages();
      // Re-inject conv checkboxes/labels if sidebar changed
      scanConversations();
    }, 200);
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
  if (ioObserver) ioObserver.disconnect();
  ioObserver = new IntersectionObserver(entries => {
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
  messages.forEach(el => ioObserver.observe(el));
}

// ============================================================
// ESCAPE HTML
// ============================================================
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ============================================================
// CUSTOM MODAL (replaces browser confirm / alert)
// ============================================================
function showModal({ title, message, icon = '💬', confirmText = 'OK', cancelText = null, danger = false }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'gpt-modal-backdrop';

    const confirmClass = danger ? 'gpt-modal-danger' : 'gpt-modal-primary';
    backdrop.innerHTML = `
      <div class="gpt-modal" role="dialog" aria-modal="true">
        <span class="gpt-modal-icon">${icon}</span>
        <div class="gpt-modal-title">${escHtml(title)}</div>
        <div class="gpt-modal-msg">${message}</div>
        <div class="gpt-modal-actions">
          ${cancelText ? `<button class="gpt-modal-btn gpt-modal-cancel" data-action="cancel">${escHtml(cancelText)}</button>` : ''}
          <button class="gpt-modal-btn ${confirmClass}" data-action="confirm">${escHtml(confirmText)}</button>
        </div>
      </div>`;

    const close = result => {
      backdrop.style.animation = 'gptFadeOut 0.15s ease forwards';
      setTimeout(() => backdrop.remove(), 150);
      resolve(result);
    };

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close(false);
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'confirm') close(true);
      if (action === 'cancel')  close(false);
    });

    const onKey = e => {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
      if (e.key === 'Enter')  { close(true);  document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
    setTimeout(() => backdrop.querySelector('[data-action="confirm"]')?.focus(), 60);
  });
}

// ============================================================
// FOLDERS
// ============================================================
async function loadFolders() {
  const data = await chrome.storage.local.get(['gpt_folders', 'gpt_conv_folders']);
  folders     = data.gpt_folders      || [];
  convFolders = data.gpt_conv_folders || {};
}

async function saveFolders() {
  await chrome.storage.local.set({ gpt_folders: folders, gpt_conv_folders: convFolders });
}

function injectFolderBar() {
  if (document.getElementById('gpt-folder-bar')) return;
  const nav = document.querySelector('nav[aria-label="Chat history"]');
  if (!nav) return;
  const bar = document.createElement('div');
  bar.id = 'gpt-folder-bar';
  nav.prepend(bar);
  renderFolderChips();
}

function renderFolderChips() {
  const bar = document.getElementById('gpt-folder-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.className = 'gpt-folder-chip' + (activeFolder === null ? ' active' : '');
  allChip.textContent = 'All';
  allChip.addEventListener('click', () => { activeFolder = null; renderFolderChips(); applyFolderFilter(); });
  bar.appendChild(allChip);

  folders.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'gpt-folder-chip' + (activeFolder === name ? ' active' : '');
    chip.textContent = `📁 ${name}`;
    chip.title = name;
    chip.addEventListener('click', () => { activeFolder = name; renderFolderChips(); applyFolderFilter(); });

    // Right-click to rename / delete folder
    chip.addEventListener('contextmenu', e => {
      e.preventDefault();
      openFolderManageMenu(chip, name);
    });
    bar.appendChild(chip);
  });

  const newBtn = document.createElement('button');
  newBtn.id = 'gpt-folder-new-btn';
  newBtn.textContent = '+ New';
  newBtn.title = 'Create new folder';
  newBtn.addEventListener('click', e => { e.stopPropagation(); openNewFolderDialog(newBtn); });
  bar.appendChild(newBtn);
}

function applyFolderFilter() {
  getConvAnchors().forEach(a => {
    const id = getConvIdFromAnchor(a);
    const li = a.closest('li');
    if (!li) return;
    if (activeFolder === null) {
      li.style.removeProperty('display');
    } else {
      li.style.display = convFolders[id] === activeFolder ? '' : 'none';
    }
  });
}

function injectFolderBadges() {
  getConvAnchors().forEach(a => {
    const id = getConvIdFromAnchor(a);
    if (!id) return;
    const folder = convFolders[id];
    let badge = a.querySelector('.gpt-conv-folder-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'gpt-conv-folder-badge';
      a.appendChild(badge);
    }
    badge.textContent = folder ? `📁 ${folder}` : '';
    badge.style.display = folder ? '' : 'none';
  });
}

function openFolderPicker(anchor) {
  document.querySelectorAll('.gpt-folder-picker').forEach(p => p.remove());
  const picker = document.createElement('div');
  picker.className = 'gpt-folder-picker';

  if (folders.length > 0) {
    folders.forEach(name => {
      const btn = document.createElement('button');
      btn.className = 'gpt-folder-picker-row';
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> ${escHtml(name)}`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        selectedConvs.forEach(id => { convFolders[id] = name; });
        saveFolders().then(() => { injectFolderBadges(); applyFolderFilter(); picker.remove(); });
      });
      picker.appendChild(btn);
    });

    const sep = document.createElement('div');
    sep.className = 'gpt-folder-picker-sep';
    picker.appendChild(sep);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'gpt-folder-picker-row gpt-folder-picker-muted';
    removeBtn.innerHTML = `<span>✕</span> Remove from folder`;
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      selectedConvs.forEach(id => { delete convFolders[id]; });
      saveFolders().then(() => { injectFolderBadges(); applyFolderFilter(); picker.remove(); });
    });
    picker.appendChild(removeBtn);

    const sep2 = document.createElement('div');
    sep2.className = 'gpt-folder-picker-sep';
    picker.appendChild(sep2);
  }

  // New folder input
  const label = document.createElement('div');
  label.style.cssText = 'font-size:10px;color:#6e7681;padding:2px 6px 5px;font-weight:600;font-family:inherit;';
  label.textContent = folders.length ? 'Or create new:' : 'New folder name:';
  picker.appendChild(label);

  const newRow = document.createElement('div');
  newRow.className = 'gpt-folder-new-row';
  newRow.innerHTML = `<input class="gpt-folder-new-input" placeholder="Folder name…" maxlength="30"/>`;
  const input = newRow.querySelector('input');
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const name = input.value.trim();
      if (name && !folders.includes(name)) folders.push(name);
      if (name) selectedConvs.forEach(id => { convFolders[id] = name; });
      saveFolders().then(() => { injectFolderBadges(); renderFolderChips(); applyFolderFilter(); });
      picker.remove();
    }
    if (e.key === 'Escape') picker.remove();
  });
  picker.appendChild(newRow);

  document.body.appendChild(picker);
  positionPickerAbove(picker, anchor);
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
    input.focus();
  }, 0);
}

function openNewFolderDialog(anchor) {
  document.querySelectorAll('.gpt-folder-picker').forEach(p => p.remove());
  const picker = document.createElement('div');
  picker.className = 'gpt-folder-picker';
  picker.innerHTML = `
    <div style="font-size:10px;color:#6e7681;padding:2px 6px 6px;font-weight:600;font-family:inherit;">New Folder</div>
    <div class="gpt-folder-new-row"><input class="gpt-folder-new-input" placeholder="Folder name…" maxlength="30"/></div>
  `;
  const input = picker.querySelector('input');
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const name = input.value.trim();
      if (name && !folders.includes(name)) {
        folders.push(name);
        saveFolders().then(() => renderFolderChips());
      }
      picker.remove();
    }
    if (e.key === 'Escape') picker.remove();
  });
  document.body.appendChild(picker);
  const r = anchor.getBoundingClientRect();
  picker.style.top  = `${r.bottom + 6}px`;
  picker.style.left = `${r.left}px`;
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
    input.focus();
  }, 0);
}

function openFolderManageMenu(anchor, name) {
  document.querySelectorAll('.gpt-folder-picker').forEach(p => p.remove());
  const picker = document.createElement('div');
  picker.className = 'gpt-folder-picker';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:10px;color:#6e7681;padding:2px 6px 6px;font-weight:600;font-family:inherit;';
  title.textContent = `📁 ${name}`;
  picker.appendChild(title);

  const renameRow = document.createElement('div');
  renameRow.className = 'gpt-folder-new-row';
  renameRow.innerHTML = `<input class="gpt-folder-new-input" value="${escHtml(name)}" maxlength="30"/>`;
  const input = renameRow.querySelector('input');
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const newName = input.value.trim();
      if (newName && newName !== name) {
        const idx = folders.indexOf(name);
        if (idx !== -1) folders[idx] = newName;
        Object.keys(convFolders).forEach(id => { if (convFolders[id] === name) convFolders[id] = newName; });
        if (activeFolder === name) activeFolder = newName;
        saveFolders().then(() => { injectFolderBadges(); renderFolderChips(); applyFolderFilter(); });
      }
      picker.remove();
    }
    if (e.key === 'Escape') picker.remove();
  });
  picker.appendChild(renameRow);

  const sep = document.createElement('div');
  sep.className = 'gpt-folder-picker-sep';
  picker.appendChild(sep);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'gpt-folder-picker-row gpt-folder-picker-muted';
  deleteBtn.innerHTML = `<span>🗑</span> Delete folder`;
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    folders = folders.filter(f => f !== name);
    Object.keys(convFolders).forEach(id => { if (convFolders[id] === name) delete convFolders[id]; });
    if (activeFolder === name) activeFolder = null;
    saveFolders().then(() => { injectFolderBadges(); renderFolderChips(); applyFolderFilter(); });
    picker.remove();
  });
  picker.appendChild(deleteBtn);

  document.body.appendChild(picker);
  const r = anchor.getBoundingClientRect();
  picker.style.top  = `${r.bottom + 4}px`;
  picker.style.left = `${r.left}px`;
  setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 0);
}

function positionPickerAbove(picker, anchor) {
  document.body.appendChild(picker);
  const r = anchor.getBoundingClientRect();
  const ph = picker.offsetHeight || 200;
  if (r.top > ph + 10) {
    picker.style.bottom = `${window.innerHeight - r.top + 6}px`;
    picker.style.removeProperty('top');
  } else {
    picker.style.top = `${r.bottom + 6}px`;
    picker.style.removeProperty('bottom');
  }
  picker.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - 200))}px`;
}

// ============================================================
// CONVERSATION LABELS & BULK SELECTION
// ============================================================
async function loadConvLabels() {
  const data = await chrome.storage.local.get('gpt_conv_labels');
  convLabels = data['gpt_conv_labels'] || {};
}

async function saveConvLabels() {
  await chrome.storage.local.set({ 'gpt_conv_labels': convLabels });
}

function getConvAnchors() {
  return [...document.querySelectorAll('#history a[href^="/c/"]')];
}

function getConvIdFromAnchor(a) {
  const m = (a.getAttribute('href') || '').match(/\/c\/([a-zA-Z0-9-]+)/);
  return m ? m[1] : null;
}

function scanConversations() {
  injectConvItems();
  applyConvLabelColors();
  injectFolderBadges();
  applyFolderFilter();
  updateBulkBar();
}

function injectConvItems() {
  getConvAnchors().forEach(a => {
    const id = getConvIdFromAnchor(a);
    if (!id) return;
    const li = a.closest('li');
    if (!li) return;

    li.classList.add('gpt-has-cb');

    // Checkbox wrapper
    if (!li.querySelector('.gpt-conv-cb-wrap')) {
      const wrap = document.createElement('label');
      wrap.className = 'gpt-conv-cb-wrap';
      const cb = document.createElement('input');
      cb.type      = 'checkbox';
      cb.className = 'gpt-conv-cb';
      cb.dataset.convId = id;
      cb.checked   = selectedConvs.has(id);
      wrap.appendChild(cb);
      wrap.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', () => {
        if (cb.checked) selectedConvs.add(id);
        else            selectedConvs.delete(id);
        updateSelectionMode();
        updateBulkBar();
      });
      li.appendChild(wrap);
    } else {
      // Keep checkbox state in sync after re-render
      const cb = li.querySelector('.gpt-conv-cb');
      if (cb) cb.checked = selectedConvs.has(id);
    }
  });
}

function updateSelectionMode() {
  const nav = document.querySelector('nav[aria-label="Chat history"]');
  if (nav) nav.classList.toggle('gpt-selection-mode', selectedConvs.size > 0);
}

function applyConvLabelColors() {
  getConvAnchors().forEach(a => {
    const id    = getConvIdFromAnchor(a);
    const label = id ? convLabels[id] : null;
    if (label) {
      a.style.boxShadow  = `inset 4px 0 0 ${label.colorHex}`;
      a.style.background = `${label.colorHex}22`;
    } else {
      a.style.removeProperty('box-shadow');
      a.style.removeProperty('background');
    }
  });
}

function injectConvBulkBar() {
  if (document.getElementById('gpt-conv-bulk-bar')) return;
  // The bar lives INSIDE the sidebar nav so position:sticky works within its scroll container
  const nav = document.querySelector('nav[aria-label="Chat history"]');
  if (!nav) return; // not ready yet — MutationObserver will retry

  const bar = document.createElement('div');
  bar.id = 'gpt-conv-bulk-bar';
  bar.innerHTML = `
    <button class="gpt-bulk-btn" id="gpt-conv-selectall-btn" title="Select all conversations">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><polyline points="4.5 6.5 6 8 8.5 5"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/><polyline points="15.5 6.5 17 8 19.5 5"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><polyline points="4.5 17.5 6 19 8.5 16"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><polyline points="15.5 17.5 17 19 19.5 16"/>
      </svg>
    </button>
    <button class="gpt-bulk-btn" id="gpt-conv-label-btn" title="Label selected conversations">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.84zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z"/>
      </svg>
    </button>
    <button class="gpt-bulk-btn" id="gpt-conv-folder-btn" title="Move to folder">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
    <button class="gpt-bulk-btn" id="gpt-conv-archive-btn" title="Archive selected conversations">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="21 8 21 21 3 21 3 8"/>
        <rect x="1" y="3" width="22" height="5" rx="1"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    </button>
    <button class="gpt-bulk-btn" id="gpt-conv-exportzip-btn" title="Export selected as ZIP">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>
    <button class="gpt-bulk-btn" id="gpt-conv-delete-btn" title="Delete selected conversations">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
      </svg>
    </button>
    <button class="gpt-bulk-btn" id="gpt-conv-deselect-btn" title="Clear selection">✕</button>
  `;
  nav.appendChild(bar);

  bar.querySelector('#gpt-conv-selectall-btn').addEventListener('click', () => {
    const all = getConvAnchors();
    const allSelected = all.every(a => selectedConvs.has(getConvIdFromAnchor(a)));
    if (allSelected) {
      // All already selected → deselect all
      selectedConvs.clear();
      document.querySelectorAll('.gpt-conv-cb').forEach(cb => { cb.checked = false; });
    } else {
      all.forEach(a => { const id = getConvIdFromAnchor(a); if (id) selectedConvs.add(id); });
      document.querySelectorAll('.gpt-conv-cb').forEach(cb => { cb.checked = true; });
    }
    updateSelectionMode();
    updateBulkBar();
  });

  bar.querySelector('#gpt-conv-label-btn').addEventListener('click', e => {
    e.stopPropagation();
    openBulkConvColorPicker(e.currentTarget);
  });
  bar.querySelector('#gpt-conv-folder-btn').addEventListener('click', e => {
    e.stopPropagation();
    openFolderPicker(e.currentTarget);
  });
  bar.querySelector('#gpt-conv-archive-btn').addEventListener('click', bulkArchiveConvs);
  bar.querySelector('#gpt-conv-exportzip-btn').addEventListener('click', bulkExportConvs);
  bar.querySelector('#gpt-conv-deselect-btn').addEventListener('click', () => {
    selectedConvs.clear();
    document.querySelectorAll('.gpt-conv-cb').forEach(cb => { cb.checked = false; });
    updateSelectionMode();
    updateBulkBar();
  });
  bar.querySelector('#gpt-conv-delete-btn').addEventListener('click', bulkDeleteConvs);
}

function updateBulkBar() {
  if (!document.getElementById('gpt-conv-bulk-bar')) injectConvBulkBar();
  const bar = document.getElementById('gpt-conv-bulk-bar');
  if (!bar) return;
  const n     = selectedConvs.size;
  const total = getConvAnchors().length;
  bar.style.display = n > 0 ? 'flex' : 'none';
  // Highlight select-all button when every conversation is selected
  bar.querySelector('#gpt-conv-selectall-btn')
     ?.classList.toggle('gpt-bulk-active', total > 0 && n === total);
}

function openBulkConvColorPicker(anchor) {
  document.querySelectorAll('.gpt-inline-picker').forEach(p => p.remove());
  const picker = document.createElement('div');
  picker.className = 'gpt-inline-picker';

  COLORS.forEach(c => {
    const dot = document.createElement('button');
    dot.className = 'gpt-inline-dot';
    dot.style.background = c.hex;
    dot.title = c.label;
    dot.addEventListener('click', e => {
      e.stopPropagation();
      selectedConvs.forEach(id => { convLabels[id] = { colorId: c.label, colorHex: c.hex }; });
      saveConvLabels().then(() => { applyConvLabelColors(); picker.remove(); });
    });
    picker.appendChild(dot);
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'gpt-inline-clear';
  clearBtn.textContent = '✕';
  clearBtn.title = 'Remove labels';
  clearBtn.addEventListener('click', e => {
    e.stopPropagation();
    selectedConvs.forEach(id => { delete convLabels[id]; });
    saveConvLabels().then(() => { applyConvLabelColors(); picker.remove(); });
  });
  picker.appendChild(clearBtn);

  document.body.appendChild(picker);
  const r = anchor.getBoundingClientRect();
  picker.style.bottom = `${window.innerHeight - r.top + 6}px`;
  picker.style.left   = `${r.left}px`;
  setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 0);
}

async function getAccessToken() {
  if (accessToken) return accessToken;
  try {
    const r = await fetch('/api/auth/session', { credentials: 'include' });
    if (r.ok) {
      const d = await r.json();
      accessToken = d?.accessToken || d?.access_token || null;
    }
  } catch {}
  return accessToken; // may be null — callers must handle gracefully
}

async function bulkArchiveConvs() {
  const n = selectedConvs.size;
  if (n === 0) return;

  const confirmed = await showModal({
    icon: '📦',
    title: `Archive ${n} conversation${n > 1 ? 's' : ''}?`,
    message: `<strong>${n} conversation${n > 1 ? 's' : ''}</strong> will be moved to your archive and hidden from the sidebar.`,
    confirmText: 'Archive',
    cancelText: 'Cancel',
    danger: false,
  });
  if (!confirmed) return;

  const token = await getAccessToken();
  const ids   = [...selectedConvs];
  let anyFailed = false;

  for (const id of ids) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(`/backend-api/conversation/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_archived: true }),
        credentials: 'include',
      });

      if (resp.ok) {
        selectedConvs.delete(id);
        delete convLabels[id];
        document.querySelector(`#history a[href="/c/${id}"]`)?.closest('li')?.remove();
      } else {
        anyFailed = true;
      }
    } catch { anyFailed = true; }
  }

  if (anyFailed) {
    await showModal({
      icon: '⚠️',
      title: 'Some archives failed',
      message: 'One or more conversations could not be archived. Try refreshing the page.',
      confirmText: 'OK',
    });
  }

  await saveConvLabels();
  updateSelectionMode();
  updateBulkBar();
}

async function bulkDeleteConvs() {
  const n = selectedConvs.size;
  if (n === 0) return;

  const confirmed = await showModal({
    icon: '🗑️',
    title: `Delete ${n} conversation${n > 1 ? 's' : ''}?`,
    message: `You are about to permanently delete <strong>${n} conversation${n > 1 ? 's' : ''}</strong>. This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true,
  });
  if (!confirmed) return;

  // Token is optional — ChatGPT accepts same-origin requests via session cookies alone
  const token = await getAccessToken();
  const ids   = [...selectedConvs];
  let anyFailed = false;

  for (const id of ids) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(`/backend-api/conversation/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_visible: false }),
        credentials: 'include',
      });

      if (resp.ok) {
        selectedConvs.delete(id);
        delete convLabels[id];
        document.querySelector(`#history a[href="/c/${id}"]`)?.closest('li')?.remove();
      } else {
        anyFailed = true;
      }
    } catch { anyFailed = true; }
  }

  if (anyFailed) {
    await showModal({
      icon: '⚠️',
      title: 'Some deletions failed',
      message: 'One or more conversations could not be deleted. Try refreshing the page and try again.',
      confirmText: 'OK',
    });
  }

  await saveConvLabels();
  updateSelectionMode();
  updateBulkBar();
}

// ============================================================
// ZIP BUILDER (pure JS, store/no-compression)
// ============================================================
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function _crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = _crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _dosDateTime() {
  const d = new Date();
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const dt = _dosDateTime();

  for (const f of files) {
    const nameB = enc.encode(f.name);
    const dataB = enc.encode(f.content);
    const crc = _crc32(dataB);
    const size = dataB.length;

    const local = new Uint8Array(30 + nameB.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);          lv.setUint16(8, 0, true);
    lv.setUint16(10, dt.time, true);   lv.setUint16(12, dt.date, true);
    lv.setUint32(14, crc, true);       lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);      lv.setUint16(26, nameB.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameB, 30);

    const cdir = new Uint8Array(46 + nameB.length);
    const cv = new DataView(cdir.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);         cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);         cv.setUint16(12, dt.time, true);
    cv.setUint16(14, dt.date, true);   cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);      cv.setUint32(24, size, true);
    cv.setUint16(28, nameB.length, true); cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);         cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);         cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cdir.set(nameB, 46);

    parts.push(local, dataB);
    central.push(cdir);
    offset += local.length + dataB.length;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);          ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);    ev.setUint16(20, 0, true);

  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

async function fetchConvAsMarkdown(id) {
  const token = await getAccessToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`/backend-api/conversation/${id}`, { credentials: 'include', headers });
  if (!resp.ok) return null;
  const data = await resp.json();

  const title   = data.title || `Conversation ${id}`;
  const mapping = data.mapping || {};
  const chain   = [];
  let nodeId    = data.current_node;
  while (nodeId && mapping[nodeId]) {
    const node = mapping[nodeId];
    if (node.message?.content?.parts) chain.unshift(node.message);
    nodeId = node.parent;
  }

  const msgs = chain.filter(m => {
    const role = m.author?.role;
    const text = (m.content?.parts || []).join('').trim();
    return (role === 'user' || role === 'assistant') && text;
  });

  const date = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  let md = `# ${title}\n\n*Exported on ${date}*\n\n---\n\n`;
  for (const m of msgs) {
    const speaker = m.author.role === 'user' ? '**You:**' : '**ChatGPT:**';
    const text    = (m.content.parts || []).join('\n').trim();
    md += `${speaker}\n\n${text}\n\n---\n\n`;
  }
  return { title, md };
}

async function bulkExportConvs() {
  const n = selectedConvs.size;
  if (n === 0) return;

  const confirmed = await showModal({
    icon: '📦',
    title: `Export ${n} conversation${n > 1 ? 's' : ''} as ZIP?`,
    message: `<strong>${n} conversation${n > 1 ? 's' : ''}</strong> will be fetched and bundled into a single <code>.zip</code> file of Markdown documents. This may take a moment.`,
    confirmText: 'Export ZIP',
    cancelText: 'Cancel',
    danger: false,
  });
  if (!confirmed) return;

  const files = [];
  const usedNames = new Set();
  for (const id of selectedConvs) {
    try {
      const result = await fetchConvAsMarkdown(id);
      if (!result) continue;
      let name = result.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || id;
      if (usedNames.has(name)) {
        let i = 2;
        while (usedNames.has(`${name}_${i}`)) i++;
        name = `${name}_${i}`;
      }
      usedNames.add(name);
      files.push({ name: `${name}.md`, content: result.md });
    } catch {}
  }

  if (files.length === 0) {
    await showModal({ icon: '⚠️', title: 'Export failed', message: 'Could not fetch any conversations. Try refreshing the page.', confirmText: 'OK' });
    return;
  }

  const zip  = buildZip(files);
  const blob = new Blob([zip], { type: 'application/zip' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `chatgpt_export_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// EXPORT CONVERSATION
// ============================================================
function getExportText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('button,[role="button"],svg,.sr-only').forEach(n => n.remove());
  return clone.textContent?.trim().replace(/\n{3,}/g, '\n\n') || '';
}

function exportConversation() {
  if (messages.length === 0) {
    showModal({ icon: '📄', title: 'Nothing to export', message: 'Open a conversation first, then try again.', confirmText: 'OK' });
    return;
  }

  const fmt   = document.querySelector('.gpt-fmt-btn.active')?.dataset.fmt || 'md';
  const title = document.title.replace(/\s*[-|].*$/, '').trim() || 'ChatGPT Conversation';
  const date  = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  const isMd  = fmt === 'md';

  let out = isMd
    ? `# ${title}\n\n*Exported on ${date}*\n\n---\n\n`
    : `${title}\nExported on ${date}\n${'='.repeat(40)}\n\n`;

  msgPairs.forEach(({ uIdx, aIdx, key }, n) => {
    const label = labels[key];

    if (label) {
      const tag = label.title ? `${label.colorId} — ${label.title}` : label.colorId;
      out += isMd ? `> 🏷️ **${tag}**\n\n` : `[${tag}]\n`;
    }

    if (uIdx !== null && messages[uIdx]) {
      const text = getExportText(messages[uIdx]);
      if (text) out += isMd ? `**You:**\n\n${text}\n\n` : `You:\n${text}\n\n`;
    }

    if (aIdx !== null && messages[aIdx]) {
      const text = getExportText(messages[aIdx]);
      if (text) out += isMd ? `**ChatGPT:**\n\n${text}\n\n` : `ChatGPT:\n${text}\n\n`;
    }

    out += isMd ? '---\n\n' : `${'-'.repeat(40)}\n\n`;
  });

  const ext      = isMd ? 'md' : 'txt';
  const filename = `${title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()}.${ext}`;
  const blob     = new Blob([out], { type: 'text/plain;charset=utf-8' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// NOTES
// ============================================================
function notesStorageKey() {
  return convId ? `note_conv_${convId}` : 'note_global';
}

async function loadNote() {
  const key  = notesStorageKey();
  const data = await chrome.storage.local.get(key);
  const text = data[key] || '';
  const ta   = document.getElementById('gpt-notes-textarea');
  const sc   = document.getElementById('gpt-notes-scope-label');
  const cc   = document.getElementById('gpt-notes-charcount');
  if (ta) { ta.value = text; }
  if (sc) { sc.textContent = convId ? `conversation` : 'global'; }
  if (cc) { cc.textContent = `${text.length} chars`; }
}

let _notesSaveTimer = null;
function scheduleNoteSave() {
  clearTimeout(_notesSaveTimer);
  _notesSaveTimer = setTimeout(async () => {
    const ta  = document.getElementById('gpt-notes-textarea');
    const cc  = document.getElementById('gpt-notes-charcount');
    const ind = document.getElementById('gpt-notes-saved');
    if (!ta) return;
    const text = ta.value;
    if (cc) cc.textContent = `${text.length} chars`;
    await chrome.storage.local.set({ [notesStorageKey()]: text });
    if (ind) {
      ind.classList.add('visible');
      setTimeout(() => ind.classList.remove('visible'), 1400);
    }
  }, 600);
}

function toggleNotesPanel() {
  notesOpen = !notesOpen;
  const panel = document.getElementById('gpt-notes-panel');
  const btn   = document.getElementById('gpt-notes-btn');
  if (!panel || !btn) return;
  panel.classList.toggle('open', notesOpen);
  btn.classList.toggle('active', notesOpen);
  if (notesOpen) {
    loadNote().then(() => {
      const ta = document.getElementById('gpt-notes-textarea');
      if (ta) {
        ta.focus();
        ta.removeEventListener('input', scheduleNoteSave);
        ta.addEventListener('input', scheduleNoteSave);
      }
    });
  }
}

function makeNotesPanelDraggable() {
  const panel  = document.getElementById('gpt-notes-panel');
  const header = document.getElementById('gpt-notes-header');
  if (!panel || !header) return;

  let startX, startY, startRight, startBottom;

  header.addEventListener('mousedown', e => {
    if (e.target.id === 'gpt-notes-close') return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    startX      = e.clientX;
    startY      = e.clientY;
    startRight  = window.innerWidth  - rect.right;
    startBottom = window.innerHeight - rect.bottom;

    const onMove = ev => {
      const dx = startX - ev.clientX;
      const dy = startY - ev.clientY;
      panel.style.right  = `${Math.max(0, startRight  + dx)}px`;
      panel.style.bottom = `${Math.max(0, startBottom + dy)}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ============================================================
// BOOT
// ============================================================
async function boot() {
  injectUI();
  startObserver();
  await loadConvLabels();
  await loadFolders();
  injectConvBulkBar();
  injectFolderBar();
  await onConversationChange();
  scanMessages();
  scanConversations();

  // document + capture catches scroll on ChatGPT's inner div (scroll doesn't bubble)
  let scrollTick = false;
  document.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => { positionLabelButtons(); scrollTick = false; });
  }, { passive: true, capture: true });

  // Re-scan once page is fully settled
  setTimeout(() => { scanMessages(); scanConversations(); }, 1500);
}

// Run as early as possible — don't wait for DOMContentLoaded
function tryBoot() {
  if (document.body) {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
}

tryBoot();
