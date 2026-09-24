// BrainScroll Asset Factory UI. Plain browser JS, no build step.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let state = null;
const selected = new Set();
const seen = new Set();
let reviewFilter = 'review';
let hoveredKey = null;
let libraryStamp = '';

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

let toastTimer;
function toast(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = error ? 'error' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), error ? 6000 : 2500);
}

async function act(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    await refresh();
    return r;
  } catch (err) {
    toast(err.message, true);
  }
}

const badge = (s) => `<span class="badge s-${s}">${s.replace('_', ' ')}</span>`;
const setHTML = (el, html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };

// ---------- polling ----------
let pollTimer;
async function refresh() {
  clearTimeout(pollTimer);
  try {
    state = await api('GET', '/api/state');
    render();
  } catch (err) {
    console.error(err);
  }
  const busy = state && (state.queue.some((q) => q.status === 'PENDING' || q.status === 'GENERATING') || state.metadataPending > 0);
  pollTimer = setTimeout(refresh, busy ? 1500 : 5000);
}

function render() {
  const c = state.config;
  const keyChip = c.mock
    ? '<span class="chip warn">Mock mode</span>'
    : c.hasKey ? '<span class="chip ok">API key set</span>' : '<span class="chip bad">OPENAI_API_KEY missing</span>';
  setHTML($('#status-chips'), `${keyChip}<span class="chip">${esc(c.styleVersion)}</span><span class="chip">${esc(c.imageModel)}</span><span class="chip">concurrency ${c.concurrency}</span>`);

  const { total, done, failed } = state.run;
  $('#progress').hidden = total === 0;
  $('#progress span').style.width = total ? `${(100 * done) / total}%` : '0';
  $('#progress em').textContent = `${done} / ${total} processed${failed ? `, ${failed} failed` : ''}`;

  for (const q of state.queue) {
    if (!seen.has(q.key)) {
      seen.add(q.key);
      if (q.status === 'PROPOSED') selected.add(q.key);
    }
  }
  const toReview = state.queue.filter((q) => q.status === 'GENERATED').length;
  $('#review-count').textContent = toReview || '';
  $('#library-count').textContent = state.libraryCount || '';

  if (!$('#queue tbody').contains(document.activeElement)) renderQueue();
  renderReview();
  const stamp = `${state.libraryCount}:${state.metadataPending}`;
  if (stamp !== libraryStamp && !$('#tab-library').hidden) loadLibrary();
  libraryStamp = stamp;
}

// ---------- batch / queue ----------
const EDITABLE = ['PROPOSED', 'EXISTING', 'TOO_ABSTRACT', 'FAILED', 'REJECTED', 'PENDING', 'GENERATED'];
const SELECTABLE = ['PROPOSED', 'PENDING', 'FAILED', 'REJECTED'];

function renderQueue() {
  const filter = $('#queue-filter').value;
  const rows = state.queue.filter((q) => !filter || q.status === filter);
  $('#queue-empty').hidden = rows.length > 0;
  setHTML($('#queue tbody'), rows.map((q) => {
    const edit = EDITABLE.includes(q.status);
    const field = (name, value, cls = '') => edit
      ? `<input class="cell ${cls}" data-field="${name}" value="${esc(value)}" />`
      : `<span class="${cls}">${esc(value)}</span>`;
    let actions = '';
    if (q.status === 'EXISTING') actions = `<button data-act="view" data-id="${esc(q.existing_id)}">View</button><button data-act="override">Override</button>`;
    if (q.status === 'TOO_ABSTRACT') actions = '<button data-act="override">Override</button>';
    if (q.status === 'FAILED') actions = '<button data-act="regenerate">Retry</button>';
    if (q.status === 'GENERATED') actions = '<button data-act="details">Review</button>';
    return `<tr data-key="${q.key}">
      <td>${SELECTABLE.includes(q.status) ? `<input type="checkbox" class="sel" ${selected.has(q.key) ? 'checked' : ''} />` : ''}</td>
      <td class="inputs">${esc(q.inputs.join(', '))}${q.style_test ? ' <span class="chip small">style test</span>' : ''}${q.contexts.length ? `<div class="hint">${esc(q.contexts.join(', '))}</div>` : ''}</td>
      <td>${field('label', q.label)}</td>
      <td>${field('id', q.id, 'mono')}</td>
      <td>${field('subject', q.subject, 'wide')}</td>
      <td>${badge(q.status)}${q.reason || q.error ? `<div class="hint">${esc(q.error || q.reason)}</div>` : ''}</td>
      <td class="actions">${actions}${q.status !== 'GENERATING' ? '<button data-act="remove" class="ghost" title="Remove from list">&times;</button>' : ''}</td>
    </tr>`;
  }).join(''));
}

$('#queue').addEventListener('change', async (e) => {
  const tr = e.target.closest('tr[data-key]');
  if (!tr) return;
  const key = tr.dataset.key;
  if (e.target.classList.contains('sel')) {
    e.target.checked ? selected.add(key) : selected.delete(key);
  } else if (e.target.dataset.field) {
    e.target.blur();
    await act(() => api('PATCH', `/api/items/${key}`, { [e.target.dataset.field]: e.target.value }), 'Saved');
  }
});

$('#queue').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset.field) e.target.dispatchEvent(new Event('change', { bubbles: true }));
});

$('#queue').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const key = btn.closest('tr').dataset.key;
  const a = btn.dataset.act;
  if (a === 'override') await act(() => api('POST', `/api/items/${key}/override`), 'Moved to proposed');
  if (a === 'regenerate') await act(() => api('POST', `/api/items/${key}/regenerate`), 'Queued');
  if (a === 'remove') { selected.delete(key); await act(() => api('DELETE', `/api/items/${key}`)); }
  if (a === 'view') openEntry(btn.dataset.id);
  if (a === 'details') openItem(key);
});

$('#check-all').addEventListener('change', (e) => {
  for (const q of state.queue) if (SELECTABLE.includes(q.status)) e.target.checked ? selected.add(q.key) : selected.delete(q.key);
  delete $('#queue tbody').dataset.html;
  renderQueue();
});
$('#queue-filter').addEventListener('change', renderQueue);

$('#concepts').addEventListener('input', () => {
  $('#line-count').textContent = $('#concepts').value.split('\n').filter((l) => l.trim()).length;
});

$('#check-btn').addEventListener('click', async () => {
  const btn = $('#check-btn');
  btn.disabled = true;
  btn.textContent = 'Checking...';
  const r = await act(() => api('POST', '/api/preprocess', { text: $('#concepts').value, category: $('#category').value }));
  btn.disabled = false;
  btn.textContent = 'Check Concepts';
  if (!r) return;
  $('#check-result').textContent = `${r.total} unique: ${r.added} new, ${r.existing} already in library, ${r.abstract} too abstract, ${r.merged} merged as duplicates.`;
  if (r.warning) toast(r.warning, true);
  $('#concepts').value = '';
  $('#line-count').textContent = '0';
});

$('#gen-selected').addEventListener('click', () => {
  const keys = [...selected];
  if (!keys.length) return toast('Select at least one proposed concept.', true);
  act(() => api('POST', '/api/generate', { keys }), (r) => `${r.queued} queued`).then(() => selected.clear());
});
$('#gen-pending').addEventListener('click', () => act(() => api('POST', '/api/generate', {}), (r) => `${r.queued} queued`));
$('#gen-style').addEventListener('click', runStyleTest);

$('#remove-checked').addEventListener('click', async () => {
  for (const key of [...selected]) {
    await api('DELETE', `/api/items/${key}`).catch(() => {});
    selected.delete(key);
  }
  refresh();
});

$('#clear-finished').addEventListener('click', async () => {
  const done = state.queue.filter((q) => ['APPROVED', 'REJECTED', 'EXISTING', 'TOO_ABSTRACT'].includes(q.status));
  for (const q of done) await api('DELETE', `/api/items/${q.key}`).catch(() => {});
  refresh();
});

// ---------- review ----------
const REVIEW_FILTERS = {
  review: (q) => q.status === 'GENERATED',
  style: (q) => q.style_test,
  active: (q) => q.status === 'PENDING' || q.status === 'GENERATING',
  FAILED: (q) => q.status === 'FAILED',
  APPROVED: (q) => q.status === 'APPROVED',
  REJECTED: (q) => q.status === 'REJECTED',
  all: (q) => !['PROPOSED', 'EXISTING', 'TOO_ABSTRACT'].includes(q.status),
};

function thumb(q) {
  if (q.status === 'GENERATING' || (q.status === 'PENDING' && !q.image)) return `<div class="placeholder"><div class="spinner"></div>${q.status === 'PENDING' ? 'Waiting' : 'Generating'}</div>`;
  if (q.status === 'FAILED' && !q.image) return `<div class="placeholder fail">${esc(q.error || 'Failed')}</div>`;
  return q.image ? `<img src="/assets/${esc(q.image)}" alt="${esc(q.label)}" loading="lazy" />` : '<div class="placeholder">No image</div>';
}

function renderReview() {
  const items = state.queue.filter(REVIEW_FILTERS[reviewFilter]);
  $('#review-empty').hidden = items.length > 0;
  setHTML($('#review-grid'), items.map((q) => {
    const busy = q.status === 'PENDING' || q.status === 'GENERATING';
    const warn = q.image && q.transparent === false ? '<div class="warn-line">No transparency detected</div>' : '';
    let buttons = '';
    if (q.status === 'GENERATED') buttons = '<button data-act="approve" class="approve">Approve</button><button data-act="regenerate">Regenerate</button><button data-act="reject" class="reject">Reject</button>';
    else if (q.status === 'FAILED') buttons = '<button data-act="regenerate">Retry</button><button data-act="reject" class="reject">Reject</button>';
    else if (q.status === 'REJECTED' || q.status === 'APPROVED') buttons = '<button data-act="regenerate">Regenerate</button>';
    return `<div class="card ${busy ? 'busy' : ''}" data-key="${q.key}">
      <div class="thumb" data-act="details">${thumb(q)}</div>
      <div class="card-body">
        <div class="label">${esc(q.label)}</div>
        <div class="mono dim">${esc(q.id)}</div>
        <div>${badge(q.status)}${q.status === 'PENDING' && q.image ? ' <span class="hint">regenerating</span>' : ''}</div>
        ${warn}
      </div>
      <div class="card-actions">${buttons}</div>
    </div>`;
  }).join(''));
}

async function itemAction(key, a) {
  if (a === 'approve') return act(() => api('POST', `/api/items/${key}/approve`), 'Approved. Writing metadata.');
  if (a === 'regenerate') return act(() => api('POST', `/api/items/${key}/regenerate`), 'Regenerating');
  if (a === 'reject') return act(() => api('POST', `/api/items/${key}/reject`), 'Rejected');
}

$('#review-grid').addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  const card = e.target.closest('.card');
  if (!el || !card) return;
  if (el.dataset.act === 'details') openItem(card.dataset.key);
  else itemAction(card.dataset.key, el.dataset.act);
});
$('#review-grid').addEventListener('mouseover', (e) => (hoveredKey = e.target.closest('.card')?.dataset.key ?? null));
$('#review-grid').addEventListener('mouseleave', () => (hoveredKey = null));
document.addEventListener('keydown', (e) => {
  if ($('#modal').open || $('#tab-review').hidden || !hoveredKey || e.target.matches('input, textarea')) return;
  const a = { a: 'approve', r: 'regenerate', x: 'reject' }[e.key.toLowerCase()];
  const q = state.queue.find((i) => i.key === hoveredKey);
  if (!a || !q) return;
  const allowed = { approve: ['GENERATED'], reject: ['GENERATED', 'FAILED'], regenerate: ['GENERATED', 'FAILED', 'REJECTED', 'APPROVED'] }[a];
  if (allowed.includes(q.status)) itemAction(hoveredKey, a);
});

$('#review-filters').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  reviewFilter = b.dataset.f;
  $$('#review-filters button').forEach((x) => x.classList.toggle('active', x === b));
  renderReview();
});
$('#checker').addEventListener('change', (e) => document.body.classList.toggle('checker', e.target.checked));

// ---------- library ----------
let searchTimer;
async function loadLibrary() {
  const results = await api('GET', `/api/registry?q=${encodeURIComponent($('#search').value)}`).catch((e) => (toast(e.message, true), []));
  $('#library-empty').hidden = results.length > 0;
  setHTML($('#library-grid'), results.map((e) => `<div class="card lib" data-id="${esc(e.id)}">
      <div class="thumb"><img src="/assets/approved/${esc(e.filename)}?v=${esc(e.approved_at)}" alt="${esc(e.label)}" loading="lazy" /></div>
      <div class="card-body">
        <div class="label">${esc(e.label)}</div>
        <div class="mono dim">${esc(e.id)}</div>
        <div class="hint">${esc(e.specificity)}${e.subcategory ? `, ${esc(e.subcategory)}` : ''}</div>
        ${e.metadata_status === 'pending' ? '<div class="hint">Writing metadata...</div>' : ''}
        ${e.metadata_status === 'failed' ? '<div class="warn-line">Metadata failed</div>' : ''}
        ${!e.transparent ? '<div class="warn-line">No transparency</div>' : ''}
      </div>
    </div>`).join(''));
}
$('#search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadLibrary, 200); });
$('#library-grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openEntry(c.dataset.id); });

// ---------- modals ----------
const modal = $('#modal');
const form = $('#modal-form');
const list = (a) => (a || []).join(', ');
const info = (rows) => `<dl class="info">${rows.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;

function openItem(key) {
  const q = state.queue.find((i) => i.key === key);
  if (!q) return;
  const editable = EDITABLE.includes(q.status);
  const input = (name, label, value, area = false) => `<label>${label}${area ? `<textarea name="${name}" ${editable ? '' : 'disabled'}>${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}" ${editable ? '' : 'disabled'} />`}</label>`;
  form.innerHTML = `
    <div class="modal-head"><h2>${esc(q.label)}</h2>${badge(q.status)}<button value="close" class="ghost">&times;</button></div>
    <div class="modal-cols">
      <div><div class="thumb big">${thumb(q)}</div>
        ${q.history.length ? `<p class="hint">Earlier attempts</p><div class="history">${q.history.map((h) => `<img src="/assets/${esc(h)}" />`).join('')}</div>` : ''}
      </div>
      <div>
        ${input('label', 'Label', q.label)}
        ${input('id', 'Canonical ID', q.id)}
        ${input('canonical_concept', 'Canonical concept', q.canonical_concept)}
        ${input('subject', 'Subject (what to depict)', q.subject, true)}
        ${input('notes', 'Extra depiction notes', q.notes, true)}
        ${info([['Inputs', q.inputs.join(', ')], ['Contexts', q.contexts.join(', ')], ['Transparent', q.transparent === undefined ? '' : q.transparent ? 'yes' : 'NO'], ['Size', q.width ? `${q.width} x ${q.height}` : ''], ['Model', q.provider_model], ['Attempts', q.attempts], ['Error', q.error]])}
        ${q.prompt ? `<details><summary>Generation prompt</summary><pre>${esc(q.prompt)}</pre></details>` : ''}
      </div>
    </div>
    <div class="modal-actions">
      ${editable ? '<button value="save">Save</button>' : ''}
      <span class="spacer"></span>
      ${q.status === 'GENERATED' ? '<button value="approve" class="approve">Approve</button>' : ''}
      ${q.status !== 'GENERATING' && q.status !== 'PENDING' ? '<button value="regenerate">Regenerate</button>' : ''}
      ${q.status === 'GENERATED' || q.status === 'FAILED' ? '<button value="reject" class="reject">Reject</button>' : ''}
    </div>`;
  form.onsubmit = async (e) => {
    const action = e.submitter?.value;
    if (action === 'close') return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (editable) {
      const ok = await act(() => api('PATCH', `/api/items/${key}`, data), action === 'save' ? 'Saved' : '');
      if (!ok) return;
    }
    if (action !== 'save') await itemAction(key, action);
    modal.close();
  };
  modal.showModal();
}

async function openEntry(id) {
  let e;
  try { e = await api('GET', `/api/registry/${encodeURIComponent(id)}`); } catch (err) { return toast(err.message, true); }
  const text = (name, label, value) => `<label>${label}<input name="${name}" value="${esc(value)}" /></label>`;
  const area = (name, label, value, hint = '') => `<label>${label}${hint ? ` <span class="hint">${hint}</span>` : ''}<textarea name="${name}">${esc(value)}</textarea></label>`;
  form.innerHTML = `
    <div class="modal-head"><h2>${esc(e.label)}</h2><span class="chip">${esc(e.metadata_status)}</span><button value="close" class="ghost">&times;</button></div>
    <div class="modal-cols">
      <div>
        <div class="thumb big"><img src="/assets/approved/${esc(e.filename)}?v=${esc(e.approved_at)}" /></div>
        ${e.metadata_error ? `<div class="warn-line">${esc(e.metadata_error)}</div>` : ''}
        ${info([['File', e.filename], ['Transparent', e.transparent ? 'yes' : 'NO'], ['Size', `${e.width} x ${e.height}`], ['Style', e.style_version], ['Model', `${e.provider}/${e.provider_model}`], ['Orientation', e.orientation], ['Subjects', e.subject_count], ['Contexts', list(e.source_contexts)], ['Approved', e.approved_at]])}
        ${e.generation_prompt ? `<details><summary>Generation prompt</summary><pre>${esc(e.generation_prompt)}</pre></details>` : ''}
      </div>
      <div class="fields">
        <div class="two">${text('label', 'Label', e.label)}${text('id', 'Canonical ID', e.id)}</div>
        <div class="two">${text('canonical_concept', 'Canonical concept', e.canonical_concept)}${text('subcategory', 'Subcategory', e.subcategory)}</div>
        <div class="two">${text('category', 'Category', e.category)}
          <label>Specificity<select name="specificity">${['generic', 'specific', 'named'].map((s) => `<option ${s === e.specificity ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
        ${area('description', 'Description', e.description)}
        ${area('tags', 'Tags', list(e.tags), 'comma separated')}
        ${area('aliases', 'Aliases', list(e.aliases))}
        ${area('related_concepts', 'Related concepts', list(e.related_concepts))}
        ${area('concepts_supported', 'Concepts supported', list(e.concepts_supported), 'lessons that could use this image')}
        ${area('not_for', 'Not for', list(e.not_for), 'obvious semantic traps')}
        ${area('visual_features', 'Visual features', list(e.visual_features))}
        ${area('notes', 'Notes', e.notes)}
      </div>
    </div>
    <div class="modal-actions">
      <button value="metadata">Regenerate Metadata</button>
      <span class="spacer"></span>
      <button value="save" class="primary">Save</button>
    </div>`;
  form.onsubmit = async (ev) => {
    const action = ev.submitter?.value;
    if (action === 'close') return;
    ev.preventDefault();
    if (action === 'metadata') {
      ev.submitter.disabled = true;
      ev.submitter.textContent = 'Generating...';
      const r = await act(() => api('POST', `/api/registry/${encodeURIComponent(e.id)}/metadata`), 'Metadata regenerated');
      if (r) { await loadLibrary(); openEntry(r.id); }
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    if (data.category !== e.category && data.id === e.id) data.id = `${data.category}.${e.id.split('.').slice(1).join('.')}`;
    const r = await act(() => api('PUT', `/api/registry/${encodeURIComponent(e.id)}`, data), 'Saved');
    if (r) { modal.close(); loadLibrary(); }
  };
  modal.showModal();
}

// ---------- style ----------
async function loadStyle() {
  const s = await api('GET', '/api/style');
  $('#style-version').textContent = s.version;
  $('#style-text').value = s.style;
  $('#style-test-text').value = s.styleTest;
  $('#prompt-preview').textContent = s.preview;
}
async function saveStyle(extra = {}) {
  await api('PUT', '/api/style', { style: $('#style-text').value, styleTest: $('#style-test-text').value, ...extra });
  await loadStyle();
  return true;
}
async function runStyleTest() {
  const r = await act(() => api('POST', '/api/style-test'), (r) => `Style test: ${r.queued} queued`);
  if (r) switchTab('review', 'style');
}
$('#save-style').addEventListener('click', () => act(saveStyle, 'Style saved'));
$('#save-style-test').addEventListener('click', () => act(saveStyle, 'Concepts saved'));
$('#run-style-test').addEventListener('click', async () => { if (await act(saveStyle)) runStyleTest(); });

// ---------- tabs ----------
function switchTab(tab, filter) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('main > section').forEach((s) => (s.hidden = s.id !== `tab-${tab}`));
  if (tab === 'library') loadLibrary();
  if (tab === 'style') loadStyle();
  if (filter) $(`#review-filters [data-f="${filter}"]`).click();
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); });

refresh();
