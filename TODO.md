# ChatGPT Bulk Delete & Folders — Task List

---

## Phase 0 — Setup

### GitHub
- [ ] Create GitHub account (if not already done)
- [ ] Create new public repository: `chatgpt-bulk-delete-folders`
- [ ] Add description: "Bulk delete, organize into folders, search, and export your ChatGPT conversations. Free Chrome extension."
- [ ] Enable GitHub Pages: Settings → Pages → Branch: main → / (root)
- [ ] Create `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] Create `.github/ISSUE_TEMPLATE/feature_request.md`
- [ ] Write `README.md` (use template from PLAN.md)
- [ ] Write `CHANGELOG.md` with v1.0.0 entry

### Chrome Developer Account
- [ ] Make sure $5 developer fee is already paid (done from NPK)
- [ ] Log in to Chrome Web Store Developer Dashboard

### Project Folder
- [ ] Create folder: `chatgpt-bulk-delete-folders/`
- [ ] Create subfolders: `icons/`
- [ ] Create all empty files: `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `styles.css`, `privacy-policy.html`

### Buy Me a Coffee
- [ ] Create account at buymeacoffee.com
- [ ] Set page name (e.g. `chatgptmanager`)
- [ ] Add profile photo and description
- [ ] Copy your page URL — you will need it in the popup

---

## Phase 1 — Icons & Branding

- [ ] Design icon concept: dark background + folder + checkmark
- [ ] Generate `icon128.png` (128×128px)
- [ ] Generate `icon48.png` (48×48px)
- [ ] Generate `icon16.png` (16×16px)
- [ ] Check icon looks good at 16px size (toolbar size)
- [ ] Check icon looks good in both light and dark Chrome themes

---

## Phase 2 — manifest.json

- [ ] Set `manifest_version: 3`
- [ ] Set `name: "ChatGPT Bulk Delete & Folders"`
- [ ] Set `version: "1.0.0"`
- [ ] Set `description` (short, under 132 chars)
- [ ] Add permissions: `["storage", "cookies", "scripting"]`
- [ ] Add `host_permissions: ["https://chatgpt.com/*"]`
- [ ] Add `background.service_worker: "background.js"`
- [ ] Add `action.default_popup: "popup.html"`
- [ ] Add `action.default_title: "ChatGPT Bulk Delete & Folders"`
- [ ] Add all 3 icon sizes (16, 48, 128)
- [ ] Add `minimum_chrome_version: "114"`
- [ ] Add `content_scripts` to inject `content.js` on `chatgpt.com/*`

---

## Phase 3 — styles.css (Shared Styles)

- [ ] CSS reset (`* { box-sizing: border-box; margin: 0; padding: 0; }`)
- [ ] Color variables (dark bg, green accent, text colors)
- [ ] Button styles (primary, secondary, danger)
- [ ] Input / search bar styles
- [ ] Checkbox styles (custom, large, easy to click)
- [ ] Progress bar styles
- [ ] Toast / notification styles
- [ ] Spinner / loading styles
- [ ] Empty state styles
- [ ] Scrollbar styles (thin, dark)
- [ ] Dark mode support (auto from `prefers-color-scheme`)

---

## Phase 4 — background.js (Service Worker)

- [ ] Read ChatGPT session token from cookies
- [ ] `fetchConversations(offset, limit)` — GET all conversations paginated
- [ ] `fetchAllConversations()` — loop through all pages until done
- [ ] `deleteConversation(id)` — DELETE single conversation
- [ ] `bulkDelete(ids)` — delete in batches of 10 with 200ms delay between batches
- [ ] `archiveConversation(id)` — PATCH conversation to archived
- [ ] `renameConversation(id, newTitle)` — PATCH conversation title
- [ ] `fetchConversationContent(id)` — GET full message content for export
- [ ] Handle API errors (rate limit, not logged in, network fail)
- [ ] Expose all functions via `chrome.runtime.onMessage` listener

---

## Phase 5 — popup.html (UI Structure)

- [ ] Set `width: 420px`, `min-height: 560px`
- [ ] Set `direction: ltr`, dark background
- [ ] Header: extension name + version + green dot indicator
- [ ] Search bar at the top
- [ ] Filter row: date dropdown, model dropdown, sort dropdown
- [ ] Action bar: Select All, Delete Selected, Export Selected (shown when items selected)
- [ ] Conversation list (scrollable, takes most of the space)
- [ ] Each conversation row: checkbox + title + date + model badge
- [ ] Footer: conversation count + Buy Me a Coffee button
- [ ] Loading state overlay (spinner + "Loading conversations…")
- [ ] Empty state (message when no results)
- [ ] Toast notification area (bottom right)
- [ ] Confirmation dialog (modal overlay)
- [ ] Link `styles.css` and `popup.js`

---

## Phase 6 — popup.js (Main Logic)

### Startup
- [ ] On popup open: show loading spinner
- [ ] Call background to fetch all conversations
- [ ] Render conversation list
- [ ] Show total count in footer
- [ ] Hide loading spinner

### Not Logged In / Wrong Page
- [ ] Detect if user is not on chatgpt.com → show "Please open chatgpt.com first"
- [ ] Detect if session token missing → show "Please log in to ChatGPT first"

### Conversation List
- [ ] Render each conversation: checkbox, title, date, model badge
- [ ] Clicking a row title opens that conversation in the current tab
- [ ] Checkbox toggles selection
- [ ] Selected rows are highlighted
- [ ] Show "X selected" count in action bar when items are selected
- [ ] Action bar appears only when at least 1 item is selected

### Select Actions
- [ ] "Select All" — checks all visible conversations
- [ ] "Select None" — unchecks all
- [ ] "Invert" — flips all checkboxes
- [ ] Select by date range — date picker dialog
- [ ] Select by keyword — text input dialog
- [ ] Select by model — dropdown
- [ ] Select empty conversations (0 messages)
- [ ] Select short conversations (< 3 messages)

### Search & Filter
- [ ] Search input filters list in real time as user types
- [ ] Date filter: Today / This week / This month / Custom range
- [ ] Model filter: All / GPT-4o / GPT-4 / GPT-3.5 / o1
- [ ] Sort: Newest / Oldest / A→Z / Z→A
- [ ] Clear filters button resets everything
- [ ] "No results" empty state when nothing matches

### Bulk Delete
- [ ] "Delete Selected" button → show confirmation dialog
- [ ] Confirmation: "Delete X conversations? This cannot be undone." + Cancel / Confirm
- [ ] On confirm: show progress bar ("Deleting… 3/47")
- [ ] Delete in batches of 10 with 200ms delay
- [ ] On complete: show toast "Deleted 47 conversations. Undo (8s)"
- [ ] Undo button in toast: restore conversations before they are permanently deleted
- [ ] Countdown (8s) visible in toast
- [ ] Remove deleted conversations from the list immediately

### Delete All
- [ ] "Delete All" option in a dropdown menu
- [ ] Require confirmation: type "DELETE" in an input field
- [ ] Show progress bar
- [ ] Same undo flow as bulk delete

### Error Handling
- [ ] API rate limit → show "ChatGPT is rate limiting. Pausing 5 seconds…"
- [ ] Network error → show "Connection lost. Check your internet."
- [ ] Unknown error → show "Something went wrong. Try refreshing."
- [ ] All errors appear as red toasts, not blocking dialogs

### Footer
- [ ] Show total conversation count: "247 conversations"
- [ ] Buy Me a Coffee button with link to your page
- [ ] Small text: "100% free · Open source"

---

## Phase 7 — Export Feature

- [ ] "Export Selected" button in action bar
- [ ] Dropdown: Markdown / Plain Text / JSON / Bulk ZIP
- [ ] For each selected conversation: call background to fetch full content
- [ ] Show progress: "Fetching conversation 3 of 12…"
- [ ] **Markdown export**: format as `# Title\n\n**User:** ...\n\n**ChatGPT:** ...`
- [ ] **Plain Text export**: simple `User: ... \n ChatGPT: ...`
- [ ] **JSON export**: full raw data with metadata (date, model, message count)
- [ ] **Bulk ZIP**: generate all files, compress with JSZip library, download
- [ ] Include metadata in all formats: date created, model used, message count
- [ ] Filename format: `chatgpt-[title]-[date].md`

---

## Phase 8 — Folders Feature

- [ ] Folders panel: collapsible left sidebar inside popup
- [ ] "All Conversations" default view (no folder)
- [ ] "Uncategorized" folder for conversations not in any folder
- [ ] "Create Folder" button → input dialog → save to `chrome.storage.local`
- [ ] Folder list: name + conversation count badge
- [ ] Click folder → filter list to show only its conversations
- [ ] Right-click folder → rename / delete options
- [ ] Delete folder: ask "Keep conversations in All Conversations?" or "Delete them too?"
- [ ] Drag conversation row → drop onto folder name → assign to folder
- [ ] Folder data saved in `chrome.storage.local` as `{ folderId: [conversationIds] }`
- [ ] Folders collapse/expand with arrow toggle
- [ ] Subfolder support: indent level 1 (max 2 levels deep)

### Labels & Tags
- [ ] Right-click conversation → "Add label" → color picker (Red/Blue/Green/Yellow/Purple)
- [ ] Label shown as colored dot on conversation row
- [ ] Right-click conversation → "Add tag" → text input
- [ ] Tag shown as small badge on conversation row
- [ ] Filter by label: click label color in filter bar
- [ ] Filter by tag: type tag name in filter bar

### Pin & Favorite
- [ ] Right-click conversation → "Pin to top"
- [ ] Pinned conversations always appear at the top of the list with a 📌 icon
- [ ] Right-click conversation → "Favorite" → ⭐ icon appears
- [ ] Filter to show only favorites

---

## Phase 9 — Statistics Dashboard

- [ ] Add "Stats" tab or button in popup header
- [ ] Stats panel slides in from the right
- [ ] **Total conversations** — large number display
- [ ] **Bar chart**: conversations per day for last 30 days (canvas or SVG)
- [ ] **Most active day** of the week (Mon–Sun)
- [ ] **Most active hour** of the day (0–23)
- [ ] **Model breakdown** — pie or bar chart (GPT-4o vs GPT-3.5 vs o1)
- [ ] **Longest conversation** — title + message count
- [ ] **Oldest conversation** — date
- [ ] **Usage streak** — consecutive days with at least 1 conversation
- [ ] **Average per week** — conversations/week over last 30 days
- [ ] Back button to return to conversation list

---

## Phase 10 — Auto-Cleanup Feature

- [ ] "Settings" tab or gear icon in popup header
- [ ] Toggle: "Auto-delete conversations older than X days" + number input
- [ ] Toggle: "Auto-archive instead of delete"
- [ ] Toggle: "Run cleanup every Sunday"
- [ ] Save settings to `chrome.storage.local`
- [ ] Background service worker checks on browser startup
- [ ] Sends Chrome notification before cleanup: "Auto-cleanup will run in 1 hour. X conversations will be deleted."
- [ ] Notification has "Cancel" action button
- [ ] After cleanup: notification "Deleted X old conversations."

---

## Phase 11 — Onboarding (First Install)

- [ ] Detect first install with `chrome.runtime.onInstalled` (reason === 'install')
- [ ] Open a welcome tab or popup screen on first install
- [ ] Welcome screen: 3 steps with icons
  1. "Open chatgpt.com in any tab"
  2. "Click the extension icon in your toolbar"
  3. "Select conversations and delete, organize, or export"
- [ ] "Get Started" button closes the screen
- [ ] Never show again after first time

---

## Phase 12 — Review Prompt

- [ ] Track number of successful bulk deletes in `chrome.storage.local`
- [ ] After 3rd successful bulk delete: show once in footer
  *"Saved you some time? Mind leaving a quick review? It helps a lot ✨"*
  with link to Chrome Web Store review page
- [ ] Show this message ONCE only — never again after user sees it
- [ ] Never block any UI — just a small footer banner with an X to dismiss

---

## Phase 13 — Privacy Policy

- [ ] Write `privacy-policy.html` (dark theme, English)
- [ ] Explain `storage` permission: folders, labels, settings — local only
- [ ] Explain `cookies` permission: reads session token to make API calls — never stored elsewhere
- [ ] Explain `scripting` permission: injects sidebar — reads no page content
- [ ] Explain `host_permissions`: required to call ChatGPT API — no data stored
- [ ] State: no analytics, no tracking, no external servers, open source
- [ ] Push to GitHub
- [ ] Enable GitHub Pages
- [ ] Confirm URL works:
  `https://[yourname].github.io/chatgpt-bulk-delete-folders/privacy-policy.html`

---

## Phase 14 — Testing

### Functional Tests
- [ ] Load extension in Chrome (Developer Mode → Load unpacked)
- [ ] Open chatgpt.com — extension icon shows as active
- [ ] Popup opens and loads conversations correctly
- [ ] Search works and filters list in real time
- [ ] Date filter works correctly
- [ ] Model filter works correctly
- [ ] Select All selects all conversations
- [ ] Bulk delete deletes the correct conversations
- [ ] Progress bar shows during delete
- [ ] Undo toast appears and works within 8 seconds
- [ ] Export to Markdown downloads correctly formatted file
- [ ] Export to TXT downloads correctly formatted file
- [ ] Export to JSON downloads valid JSON
- [ ] Bulk ZIP contains all selected conversations
- [ ] Folders create, rename, and delete correctly
- [ ] Drag and drop into folder works
- [ ] Labels appear on conversation rows
- [ ] Statistics dashboard shows correct numbers
- [ ] Auto-cleanup settings save and persist after closing popup
- [ ] Buy Me a Coffee button opens correct page

### Edge Case Tests
- [ ] Open popup when NOT on chatgpt.com → correct error message shown
- [ ] Open popup when not logged in → correct error message shown
- [ ] Select 0 conversations → delete button is disabled
- [ ] Delete 0 conversations → nothing happens
- [ ] Search returns 0 results → empty state shown
- [ ] User has 0 conversations total → empty state shown
- [ ] Network disconnected during delete → error toast shown, no crash
- [ ] Very long conversation title → truncated correctly, no overflow
- [ ] 500+ conversations → all load correctly, no performance issues

---

## Phase 15 — Store Screenshots (1280×800)

- [ ] Screenshot 1: Popup open on chatgpt.com, conversations with checkboxes, some selected
- [ ] Screenshot 2: Bulk delete progress bar running
- [ ] Screenshot 3: Folders panel open, conversations organized
- [ ] Screenshot 4: Export options dropdown open
- [ ] Screenshot 5: Statistics dashboard with charts
- [ ] Create HTML mockup for each screenshot (`_ss1.html` to `_ss5.html`)
- [ ] Capture with headless Brave: `--headless=old --screenshot --window-size=1280,800`

---

## Phase 16 — ZIP & Submit

- [ ] Final test of all features
- [ ] Bump version in `manifest.json` to `1.0.0`
- [ ] Update `CHANGELOG.md` with v1.0.0 release notes
- [ ] Create ZIP with only extension files (no screenshots, no HTML mockups)
  - `manifest.json`
  - `background.js`
  - `content.js`
  - `popup.html`
  - `popup.js`
  - `styles.css`
  - `icons/icon16.png`
  - `icons/icon48.png`
  - `icons/icon128.png`
- [ ] Upload ZIP to Chrome Web Store Developer Dashboard
- [ ] Fill store listing:
  - Name, short description, full description
  - Category: Productivity
  - Language: English
  - Privacy policy URL (GitHub Pages)
- [ ] Upload 5 screenshots in correct order
- [ ] Fill Confidentialité section (check none — no data collected)
  - Check all 3 certification boxes
  - Fill permission justifications
  - Fill "Objectif unique"
- [ ] Submit for review
- [ ] Push all code to GitHub
- [ ] Create v1.0.0 Release on GitHub

---

## Phase 17 — After Launch

- [ ] Monitor Chrome Web Store reviews daily
- [ ] Reply to every review within 24 hours
- [ ] Monitor GitHub Issues — respond within 48 hours
- [ ] Fix critical bugs within 24 hours and push v1.0.1
- [ ] After first 10 users: ask 1 trusted user for feedback
- [ ] After 100 users: check most common issues in reviews and fix them
- [ ] Plan v1.1 (Export) based on user feedback
- [ ] Share on Reddit (r/ChatGPT, r/productivity, r/chrome) — show it, don't spam
- [ ] Update `CHANGELOG.md` with every new version

---

## Summary

| Phase | Task | Status |
|---|---|---|
| 0 | Setup (GitHub, folders, Buy Me a Coffee) | ⬜ |
| 1 | Icons & branding | ⬜ |
| 2 | manifest.json | ⬜ |
| 3 | styles.css | ⬜ |
| 4 | background.js (API layer) | ⬜ |
| 5 | popup.html (UI structure) | ⬜ |
| 6 | popup.js (main logic) | ⬜ |
| 7 | Export feature | ⬜ |
| 8 | Folders + labels + tags | ⬜ |
| 9 | Statistics dashboard | ⬜ |
| 10 | Auto-cleanup | ⬜ |
| 11 | Onboarding | ⬜ |
| 12 | Review prompt | ⬜ |
| 13 | Privacy policy | ⬜ |
| 14 | Testing | ⬜ |
| 15 | Store screenshots | ⬜ |
| 16 | ZIP & submit | ⬜ |
| 17 | Post-launch | ⬜ |
