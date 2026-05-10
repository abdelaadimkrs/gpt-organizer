# ChatGPT Bulk Delete & Folders — Full Project Plan

---

## Extension Identity

| Field | Value |
|---|---|
| **Name** | ChatGPT Bulk Delete & Folders |
| **Tagline** | Bulk delete, organize into folders, and export your ChatGPT conversations |
| **Category** | Productivity |
| **Target** | chatgpt.com |
| **Monetization** | Buy Me a Coffee (free extension, donation button) |
| **Price** | 100% Free |
| **GitHub Repo** | github.com/[yourname]/chatgpt-bulk-delete-folders |
| **Privacy Policy** | [yourname].github.io/chatgpt-bulk-delete-folders/privacy-policy.html |

---

## How It Works (Technical)

The extension uses ChatGPT's **internal REST API** — the same API the ChatGPT web app uses.
The user is already logged in, so no extra login is needed. The extension reads the session
cookie automatically.

### Key API Endpoints

```
GET    https://chatgpt.com/backend-api/conversations?limit=100&offset=0
DELETE https://chatgpt.com/backend-api/conversation/{conversation_id}
PATCH  https://chatgpt.com/backend-api/conversation/{conversation_id}   → rename / archive
GET    https://chatgpt.com/backend-api/conversation/{conversation_id}   → full content for export
```

### Architecture

```
manifest.json     → MV3, permissions: storage, cookies, scripting
background.js     → service worker, API calls, storage management
popup.html/js     → main UI (conversation list, bulk actions, folders)
content.js        → inject sidebar panel directly into chatgpt.com
styles.css        → shared styles
icons/            → 16, 48, 128px icons
privacy-policy.html → hosted via GitHub Pages
```

### Permissions Needed

| Permission | Reason |
|---|---|
| `storage` | Save folders, tags, labels locally |
| `cookies` | Read ChatGPT session token for API calls |
| `scripting` | Inject sidebar panel into chatgpt.com |
| `host_permissions: chatgpt.com` | Make API calls to ChatGPT backend |

---

## Full Feature List

### 1. Bulk Select & Delete
- [ ] Checkbox on every conversation in the list
- [ ] "Select All" button — selects all conversations at once
- [ ] "Select None" / "Invert Selection"
- [ ] Select by **date range** — e.g. "everything before January 2024"
- [ ] Select by **keyword** in title — e.g. "select all named Python"
- [ ] Select **empty conversations** — no messages
- [ ] Select **short conversations** — under 3 messages
- [ ] Select by **model** — GPT-4o, GPT-4, GPT-3.5, o1
- [ ] **Bulk delete** selected conversations
- [ ] **Undo** — 10 second grace period before permanent deletion
- [ ] Progress bar during bulk delete
- [ ] "Delete All" nuclear option with confirmation dialog

### 2. Folders & Organization
- [ ] Create unlimited folders
- [ ] Create subfolders (nested)
- [ ] Drag and drop conversations into folders
- [ ] Rename folders
- [ ] Delete folders (with option to keep or delete conversations inside)
- [ ] Default folder "Uncategorized" for new conversations
- [ ] Folder conversation count badge
- [ ] Collapse / expand folders
- [ ] Pin important conversations to the top
- [ ] Star / favorite conversations
- [ ] Color labels — Red, Blue, Green, Yellow, Purple
- [ ] Custom tags — "work", "personal", "code", "ideas"
- [ ] Filter view by folder, label, or tag

### 3. Search & Filter
- [ ] Search conversations by **title** instantly (as you type)
- [ ] Filter by **date** — today, this week, this month, custom range
- [ ] Filter by **model** used (GPT-4o, GPT-3.5, o1, etc.)
- [ ] Filter by **label / tag**
- [ ] Sort by: Newest, Oldest, A→Z, Most messages
- [ ] Clear all filters with one click

### 4. Export
- [ ] Export single conversation to **Markdown** (.md)
- [ ] Export single conversation to **Plain Text** (.txt)
- [ ] Export single conversation to **JSON** (.json)
- [ ] Export single conversation to **PDF** (print-to-PDF)
- [ ] **Bulk export** selected conversations as a ZIP file
- [ ] Export all conversations at once
- [ ] Include metadata in export: date, model used, message count

### 5. Statistics Dashboard
- [ ] Total conversations count
- [ ] Conversations created per day / week / month (bar chart)
- [ ] Most active day of the week
- [ ] Most active hour of the day
- [ ] Breakdown by model (GPT-4o vs GPT-3.5 vs o1)
- [ ] Longest conversation (most messages)
- [ ] Oldest conversation date
- [ ] Average conversations per week
- [ ] Usage streak (consecutive days used)

### 6. Auto-Cleanup
- [ ] Auto-delete conversations older than **X days**
- [ ] Auto-archive conversations after **X days** of inactivity
- [ ] Scheduled weekly cleanup — runs every Sunday automatically
- [ ] Auto-tag conversations based on keywords in the title
- [ ] Notify user before auto-delete runs

### 7. Backup & Restore
- [ ] Export full conversation list to **JSON backup**
- [ ] Import / restore from JSON backup file
- [ ] Auto-backup runs daily and saves locally in browser storage
- [ ] Protects against OpenAI data loss bugs

### 8. UX & Shortcuts
- [ ] Sidebar panel injected directly into chatgpt.com page
- [ ] Works as popup AND as Chrome Side Panel
- [ ] Keyboard shortcuts:
  - `Ctrl + A` → Select all
  - `Delete` → Delete selected
  - `Ctrl + Z` → Undo last delete
  - `Ctrl + F` → Focus search bar
  - `Ctrl + E` → Export selected
- [ ] Dark mode (auto-synced with ChatGPT theme)
- [ ] Real-time sync — changes reflect immediately in ChatGPT sidebar
- [ ] Works with infinite scroll (loads all conversations automatically)

### 9. Monetization
- [ ] "☕ Buy Me a Coffee" button visible in popup footer
- [ ] Non-intrusive message: *"100% free — if it saved you time, a coffee means a lot"*
- [ ] No paywalls, no premium tiers, no subscriptions

---

## Development Roadmap

### v1.0 — Launch
- Bulk select + bulk delete
- Select all / by date / by keyword
- Progress bar + undo
- Search by title + basic filters
- Buy Me a Coffee button
- **Time: 2 days**

### v1.1 — Export
- Export to Markdown, TXT, JSON
- Bulk export as ZIP
- **Time: 1 day**

### v1.2 — Folders & Labels
- Folders + subfolders
- Drag into folders
- Color labels + tags + pin
- **Time: 2 days**

### v1.3 — Statistics
- Dashboard with charts
- Usage streak + model breakdown
- **Time: 1 day**

### v2.0 — Auto-Cleanup & Backup
- Auto-delete / auto-archive
- Daily backup + restore
- **Time: 2 days**

---

## Store Listing

### Short Description (132 chars max)
```
Bulk delete, organize into folders, search, and export your ChatGPT conversations. 100% free. No data collected.
```

### Full Description
```
ChatGPT Bulk Delete & Folders — The complete ChatGPT conversation manager.

ChatGPT gives you no way to bulk delete, no folders, no export. This extension fixes all of that — for free.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ BULK DELETE
Select all conversations or filter by date, keyword, or model — then delete in one click.
Includes a progress bar and 10-second undo so you never lose something by mistake.

📁 FOLDERS & ORGANIZATION
Create unlimited folders and subfolders. Drag conversations in.
Add color labels and custom tags. Pin important conversations to the top.

🔍 SEARCH & FILTER
Search your entire conversation history instantly as you type.
Filter by date range, model (GPT-4o, GPT-3.5, o1), or label. Sort any way you want.

📤 EXPORT
Export any conversation instantly to Markdown, TXT, or JSON.
Bulk export selected conversations as a ZIP file.
No waiting 7 days for an email like ChatGPT's built-in export.

📊 STATISTICS
See how many conversations you have, your most active days,
which models you use most, and your longest usage streak.

⚙️ AUTO-CLEANUP
Automatically delete or archive conversations older than X days.
Set it once, forget it forever.

💾 BACKUP & RESTORE
Export a full backup of your conversation list to JSON.
Protects you from OpenAI data loss bugs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 PRIVACY FIRST
- No data collected, no servers, no tracking
- Everything runs locally in your browser
- Open source on GitHub

☕ 100% FREE — always
No subscriptions. No paywalls. No ads.
If it saves you time, consider buying me a coffee — it helps a lot.
```

---

## Competitors Analysis

| Extension | Users | Weakness | Our advantage |
|---|---|---|---|
| ChatGPT Toolbox | 18,000+ | Bulk delete costs $9.99/mo | We do it FREE |
| DeclutterGPT | Unknown | Delete only, no folders | We have folders + export |
| ChatGPT Bulk Delete | 17,000+ | No folders, no export | We have everything |
| GPT Navigator | Unknown | Basic only | Statistics + auto-cleanup |
| PinFold | Removed Sept 2025 | Gone from store | We capture their users |

---

## GitHub Setup (No Website Needed)

### Repository Structure
```
chatgpt-bulk-delete-folders/          ← GitHub repo root
├── README.md                         ← public face of the project
├── CHANGELOG.md                      ← version history
├── privacy-policy.html               ← hosted on GitHub Pages
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── .github/
    └── ISSUE_TEMPLATE/
        ├── bug_report.md
        └── feature_request.md
```

### README.md — Best Practices
The README is your homepage. Make it look professional:

```markdown
# ChatGPT Bulk Delete & Folders

> Bulk delete, organize into folders, search, and export your ChatGPT conversations.
> 100% free. No data collected. Open source.

![Chrome Web Store](badge-link)
![Users](badge-link)
![License: MIT](badge-link)

## Features
- ✅ Bulk delete with undo
- 📁 Unlimited folders & subfolders
- 🔍 Instant search & filter
- 📤 Export to Markdown, TXT, JSON, ZIP
- 📊 Statistics dashboard
- ⚙️ Auto-cleanup
- 💾 Backup & restore

## Install
[Install from Chrome Web Store](store-link)

## Privacy
No data collected. No servers. Everything runs locally.
Full privacy policy: [yourname].github.io/chatgpt-bulk-delete-folders/privacy-policy.html

## Support
Found a bug? Open an issue on GitHub.
Want a feature? Open a feature request.
Did it help you? ☕ [Buy me a coffee](buymeacoffee-link)
```

### GitHub Pages Setup (Privacy Policy)
1. Go to repo **Settings → Pages**
2. Source: **Deploy from branch → main → / (root)**
3. Privacy policy URL becomes:
   `https://[yourname].github.io/chatgpt-bulk-delete-folders/privacy-policy.html`
4. Use this URL in the Chrome Web Store listing

### GitHub Issues — Bug & Feature Templates
Create `.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
**Describe the bug:** ...
**Steps to reproduce:** ...
**Expected behavior:** ...
**Browser version:** ...
**Extension version:** ...
```

Create `.github/ISSUE_TEMPLATE/feature_request.md`:
```markdown
**What problem does this solve?** ...
**Describe the feature:** ...
**Why is it important to you?** ...
```

### CHANGELOG.md — Version History
Keep this updated with every release. Users and reviewers love it.
```markdown
# Changelog

## v1.1.0 — 2026-06-01
- Added export to Markdown and TXT
- Added bulk export as ZIP
- Fixed: progress bar not showing on slow connections

## v1.0.0 — 2026-05-15
- Initial release
- Bulk delete with undo
- Search and filter
- Buy Me a Coffee
```

### GitHub Releases
Every time you release a new version:
1. Go to **Releases → Create a new release**
2. Tag: `v1.0.0`
3. Title: `v1.0.0 — Initial Release`
4. Attach the `.zip` file of the extension
5. Users can download old versions if needed

---

## Best Practices — Extension UX

### Onboarding (First Launch)
- Show a welcome screen on first install explaining what the extension does
- 3 steps max: "1. Open ChatGPT → 2. Click the extension icon → 3. Select and delete"
- Don't ask for permissions you don't need yet — request when needed

### Error Handling — Always Show Clear Messages
| Situation | Message to show |
|---|---|
| Not on chatgpt.com | "Please open chatgpt.com first" |
| Not logged in | "Please log in to ChatGPT first" |
| API call fails | "Something went wrong. Try refreshing the page." |
| 0 conversations found | "No conversations found. Try adjusting your filters." |
| Delete in progress | "Deleting X conversations… please wait" |

### Loading States
- Always show a spinner or progress bar during API calls
- Never leave the UI frozen — show "Loading your conversations..."
- Show count: "Loaded 247 conversations"

### Confirmation Dialogs
- Always confirm before bulk delete: "Delete 47 conversations? This cannot be undone."
- Never delete immediately on first click
- For "Delete All": require typing "DELETE" to confirm (like GitHub repo deletion)

### Undo
- After any delete, show a toast: "Deleted 12 conversations. Undo (8s)"
- Countdown visible so user knows how long they have
- Undo restores conversations via the PATCH API endpoint

### Empty States
- When no conversations match filters: show a friendly illustration + message
- "No conversations match your search. Try different keywords."
- Not just a blank white screen

### Accessibility
- All buttons have `aria-label`
- Keyboard navigable (Tab through all actions)
- Contrast ratio meets WCAG AA standard
- Tooltips on icon-only buttons

---

## Best Practices — Chrome Web Store Listing

### Screenshots (1280×800)
Create 5 screenshots showing:
1. The sidebar panel open on chatgpt.com with checkboxes on conversations
2. Bulk delete in progress with the progress bar
3. Folders view — conversations organized into folders
4. Export options — choosing Markdown / ZIP
5. Statistics dashboard with charts

### Icon
- Must look good at 16px (tiny, in the toolbar)
- Use a folder + checkmark or folder + lightning bolt
- Dark background works best in both light and dark Chrome themes
- Test at all 3 sizes: 16, 48, 128

### Reviews Strategy (Organic, No Spam)
- After a user successfully deletes 10+ conversations, show once:
  *"Glad it worked! Mind leaving a review? It helps a lot ☕"* with a direct link
- Show it only ONCE, never again — never be annoying
- Respond to every review on the store, even negative ones — shows you care

### Update Cadence
- Push at least one update per month — the store ranks active extensions higher
- Even a small fix or UI improvement counts
- Always update the version number in manifest.json

---

## Best Practices — Code Quality

### manifest.json
- Request minimum permissions — only what you actually use
- Add `"minimum_chrome_version": "114"` to avoid old browser issues
- Use `"default_locale": "en"` for internationalization readiness

### Error Boundaries
- Wrap all API calls in try/catch
- Never let the extension crash silently
- Log errors to console with clear messages for debugging

### Rate Limiting
- Don't delete 500 conversations in 500 simultaneous API calls
- Delete in batches of 10, with 200ms delay between batches
- Prevents ChatGPT from rate-limiting or blocking the requests

### Storage
- Use `chrome.storage.local` for all data (folders, labels, settings)
- Never store sensitive data (session token stays in cookies, never copied)
- Clean up storage when user uninstalls (use `chrome.runtime.onInstalled`)

### Version Naming
- Follow semver: `MAJOR.MINOR.PATCH`
- `1.0.0` → launch
- `1.0.1` → bug fix
- `1.1.0` → new feature
- `2.0.0` → major redesign

---

## Best Practices — Monetization (Buy Me a Coffee)

### Placement
- Bottom of the popup — always visible but never in the way
- Small, subtle, not a banner
- Use the official Buy Me a Coffee yellow button for recognition

### Message Tone
- ✅ "This tool is 100% free. If it saved you time, a coffee means a lot ☕"
- ✅ "Built and maintained by one person. Support keeps it alive."
- ❌ "Please donate or I'll stop maintaining this"
- ❌ Guilt-tripping language

### Timing
- Show the button from day 1
- After a successful bulk delete: show once "That just saved you X minutes ☕"
- Never block any feature behind a donation

---

## Logo / Icon Design

| Property | Value |
|---|---|
| Background | Deep dark (#0d1117) or dark blue (#0a1628) |
| Icon shape | Folder with a checkmark or lightning bolt inside |
| Accent color | Green (#2ecc71) or blue (#4285f4) |
| Style | Flat, minimal, no gradients at small sizes |
| Tool | Use Figma, Canva, or generate with PowerShell |

---

## Privacy Policy (Hosted on GitHub Pages)

Key points to cover:
- `chrome.storage.local` — stores folders, labels, settings only. Never transmitted.
- `cookies` — reads ChatGPT session token only to make API calls. Never stored or transmitted elsewhere.
- No analytics, no tracking, no external servers
- No browsing history or page content accessed
- Open source — users can read the code themselves

URL after GitHub Pages setup:
```
https://[yourname].github.io/chatgpt-bulk-delete-folders/privacy-policy.html
```

---

## Buy Me a Coffee Setup

1. Go to buymeacoffee.com → Create account
2. Page name: `chatgptmanager` (or your own name)
3. Profile: add extension icon + short description
4. Widget button in popup links directly to your page
5. Goal example: "☕ 10 coffees = 1 month of maintenance"
