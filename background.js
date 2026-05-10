const BASE        = 'https://chatgpt.com/backend-api';
const BATCH_SIZE  = 10;
const BATCH_DELAY = 300; // ms between batches — avoids rate limiting

// ============================================================
// AUTH
// ============================================================

async function getToken() {
  const res = await fetch('https://chatgpt.com/api/auth/session');
  if (!res.ok) throw new Error('NOT_LOGGED_IN');
  const data = await res.json();
  if (!data.accessToken) throw new Error('NOT_LOGGED_IN');
  return data.accessToken;
}

// ============================================================
// FETCH CONVERSATIONS
// ============================================================

async function fetchPage(token, offset, limit) {
  const res = await fetch(
    `${BASE}/conversations?offset=${offset}&limit=${limit}&order=updated`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 401) throw new Error('NOT_LOGGED_IN');
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok)            throw new Error('API_ERROR');
  return res.json();
}

async function fetchAllConversations(token) {
  const all   = [];
  let offset  = 0;
  const limit = 100;

  while (true) {
    const data = await fetchPage(token, offset, limit);
    const items = data.items || [];
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }

  return all;
}

// ============================================================
// FETCH SINGLE CONVERSATION CONTENT (for export)
// ============================================================

async function fetchConversationContent(token, id) {
  const res = await fetch(`${BASE}/conversation/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('FETCH_CONTENT_FAILED');
  return res.json();
}

// ============================================================
// DELETE
// ============================================================

async function deleteConversation(token, id) {
  const res = await fetch(`${BASE}/conversation/${id}`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_visible: false })
  });
  if (!res.ok) throw new Error('DELETE_FAILED');
}

async function bulkDelete(token, ids, portName) {
  let done = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(id => deleteConversation(token, id)));

    done += batch.length;

    // Send progress update to popup via storage so popup can poll it
    await chrome.storage.session.set({
      bulkProgress: { done, total: ids.length }
    });

    if (i + BATCH_SIZE < ids.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  await chrome.storage.session.remove('bulkProgress');
  return done;
}

// ============================================================
// ARCHIVE
// ============================================================

async function archiveConversation(token, id) {
  const res = await fetch(`${BASE}/conversation/${id}`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_archived: true })
  });
  if (!res.ok) throw new Error('ARCHIVE_FAILED');
}

// ============================================================
// RENAME
// ============================================================

async function renameConversation(token, id, title) {
  const res = await fetch(`${BASE}/conversation/${id}`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });
  if (!res.ok) throw new Error('RENAME_FAILED');
}

// ============================================================
// EXPORT HELPERS
// ============================================================

function extractMessages(content) {
  const messages = [];
  const mapping  = content.mapping || {};

  // Walk the message tree in order
  const roots = Object.values(mapping).filter(n => !n.parent);
  function walk(node) {
    if (!node) return;
    const msg = node.message;
    if (msg && msg.content && msg.content.parts) {
      const role = msg.author?.role;
      const text = msg.content.parts.join('');
      if (text.trim() && (role === 'user' || role === 'assistant')) {
        messages.push({ role, text });
      }
    }
    (node.children || []).forEach(childId => walk(mapping[childId]));
  }
  roots.forEach(walk);
  return messages;
}

function toMarkdown(title, messages, meta) {
  const lines = [
    `# ${title}`,
    ``,
    `- **Date:** ${meta.date}`,
    `- **Model:** ${meta.model || 'Unknown'}`,
    `- **Messages:** ${messages.length}`,
    ``,
    `---`,
    ``
  ];
  messages.forEach(m => {
    const label = m.role === 'user' ? '**You**' : '**ChatGPT**';
    lines.push(`${label}\n\n${m.text}\n\n---\n`);
  });
  return lines.join('\n');
}

function toPlainText(title, messages, meta) {
  const lines = [
    title,
    `Date: ${meta.date}`,
    `Model: ${meta.model || 'Unknown'}`,
    `Messages: ${messages.length}`,
    ``,
    `========================================`,
    ``
  ];
  messages.forEach(m => {
    const label = m.role === 'user' ? 'You' : 'ChatGPT';
    lines.push(`${label}:\n${m.text}\n`);
    lines.push(`----------------------------------------\n`);
  });
  return lines.join('\n');
}

function toJSON(title, messages, meta, rawContent) {
  return JSON.stringify({
    title,
    date:     meta.date,
    model:    meta.model,
    messages: messages.map(m => ({ role: m.role, content: m.text })),
    raw:      rawContent
  }, null, 2);
}

// ============================================================
// MESSAGE HANDLER
// ============================================================

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  handle(req).then(sendResponse).catch(err => {
    sendResponse({ error: err.message || 'UNKNOWN_ERROR' });
  });
  return true; // keep channel open for async response
});

async function handle(req) {
  switch (req.action) {

    case 'GET_CONVERSATIONS': {
      const token = await getToken();
      const items = await fetchAllConversations(token);
      return { items };
    }

    case 'BULK_DELETE': {
      const { ids } = req;
      if (!ids || ids.length === 0) return { deleted: 0 };
      const token   = await getToken();
      const deleted = await bulkDelete(token, ids);
      return { deleted };
    }

    case 'ARCHIVE': {
      const token = await getToken();
      await archiveConversation(token, req.id);
      return { ok: true };
    }

    case 'RENAME': {
      const token = await getToken();
      await renameConversation(token, req.id, req.title);
      return { ok: true };
    }

    case 'GET_CONTENT': {
      const token   = await getToken();
      const content = await fetchConversationContent(token, req.id);
      return { content };
    }

    case 'EXPORT_ONE': {
      const token    = await getToken();
      const content  = await fetchConversationContent(token, req.id);
      const messages = extractMessages(content);
      const meta = {
        date:  new Date(content.create_time * 1000).toLocaleDateString(),
        model: content.default_model_slug || ''
      };
      const title = content.title || 'Untitled';

      let text;
      if      (req.format === 'md')   text = toMarkdown(title, messages, meta);
      else if (req.format === 'txt')  text = toPlainText(title, messages, meta);
      else                            text = toJSON(title, messages, meta, content);

      return { text, title, format: req.format };
    }

    case 'EXPORT_BULK': {
      const token   = await getToken();
      const results = [];

      for (let i = 0; i < req.ids.length; i++) {
        const id      = req.ids[i];
        const content = await fetchConversationContent(token, id);
        const msgs    = extractMessages(content);
        const meta    = {
          date:  new Date(content.create_time * 1000).toLocaleDateString(),
          model: content.default_model_slug || ''
        };
        const title = content.title || `conversation-${i + 1}`;
        const text  = req.format === 'txt'
          ? toPlainText(title, msgs, meta)
          : toMarkdown(title, msgs, meta);

        results.push({ title, text, format: req.format });

        await chrome.storage.session.set({
          exportProgress: { done: i + 1, total: req.ids.length }
        });
      }

      await chrome.storage.session.remove('exportProgress');
      return { results };
    }

    case 'CHECK_AUTH': {
      try {
        await getToken();
        return { loggedIn: true };
      } catch {
        return { loggedIn: false };
      }
    }

    default:
      throw new Error('UNKNOWN_ACTION');
  }
}
