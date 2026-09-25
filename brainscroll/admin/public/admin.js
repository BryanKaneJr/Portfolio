// BrainScroll Content Admin v1: plain browser JS, no build step.
// The server (admin/server.ts) owns reading, validating and writing content/.

const state = {
  data: null, // /api/content snapshot
  issues: [], // latest full validation
  view: 'levels', // levels | concepts | sources | issues
  skill: null, // skillId being browsed
  file: null, // selected level file
  draft: null, // editable deep copy of the selected level
  dirty: false,
  tab: 'edit', // edit | preview | json | issues
  preview: {}, // questionId -> chosen option id
};

// ── tiny DOM helper ──────────────────────────────────────────────
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const $ = (sel) => document.querySelector(sel);
const clone = (v) => JSON.parse(JSON.stringify(v));
const short = (id) => (id ?? '').split('.').slice(-1)[0];
function toast(msg, err = false) {
  const t = h('div', { class: `toast${err ? ' err' : ''}` }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), err ? 7000 : 2500);
}

// ── API ──────────────────────────────────────────────────────────
async function api(path, init) {
  const r = await fetch(path, init);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}
async function load() {
  const [c, v, ins] = await Promise.all([api('/api/content'), api('/api/validate'), api('/api/insights')]);
  state.data = c.body;
  state.issues = v.body.issues ?? [];
  state.insights = ins.body ?? { available: false };
  state.skill ??= state.data.skills[0]?.id ?? null;
  if (state.file && !state.dirty) selectLevel(state.file, true);
  render();
}
async function revalidate() {
  const v = await api('/api/validate');
  state.issues = v.body.issues ?? [];
  render();
  const e = state.issues.filter((i) => i.severity === 'error').length;
  toast(`Validation: ${e} errors, ${state.issues.length - e} warnings`, e > 0);
}

// ── derived data ─────────────────────────────────────────────────
const levelsOf = (skillId) => state.data.levels.filter((l) => l.data?.skillId === skillId).sort((a, b) => a.data.number - b.data.number);
const conceptById = () => new Map(state.data.concepts.map((c) => [c.id, c]));
const sourceById = () => new Map(state.data.sources.map((s) => [s.id, s]));
const budget = () => state.data.meta.textBudget;
function issuesFor(levelId, file) {
  const m = /^level\.[a-z0-9_]+\.([a-z0-9_]+)\.(\d{3})$/.exec(levelId ?? '');
  const scope = m ? `${m[1]}.${m[2]}` : null;
  return state.issues.filter(
    (i) => i.where === levelId || i.where === file || (scope && (i.where.startsWith(`card.${scope}.`) || i.where.startsWith(`question.${scope}.`))),
  );
}
function allCardsById() {
  const map = new Map();
  for (const l of state.data.levels) for (const c of l.data?.cards ?? []) map.set(c.id, { card: c, level: l.data });
  if (state.draft) for (const c of state.draft.cards) map.set(c.id, { card: c, level: state.draft });
  return map;
}

// ── selection & editing ──────────────────────────────────────────
function selectLevel(file, keepTab = false) {
  if (state.dirty && file !== state.file && !confirm('Discard unsaved changes?')) return;
  const l = state.data.levels.find((x) => x.file === file);
  state.file = file;
  state.draft = l ? clone(l.data) : null;
  state.dirty = false;
  state.preview = {};
  if (!keepTab) state.tab = 'edit';
  state.view = 'levels';
  render();
}
function touch(rerender = false) {
  state.dirty = true;
  if (rerender) render();
  else renderSaveBar();
}
function field(obj, key, { kind = 'input', max, type = 'text', rerender = false, rows } = {}) {
  const counter = max ? h('div', { class: 'count' }) : null;
  const upd = () => {
    if (!counter) return;
    const v = String(obj[key] ?? '');
    // House rule: no em dashes in authored text (docs/content-guide.md "Editorial rules").
    const dash = v.includes('\u2014');
    counter.textContent = `${v.length}/${max}${dash ? ' · em dash: rewrite the sentence' : ''}`;
    counter.classList.toggle('over', v.length > max || dash);
  };
  const el = h(kind, {
    type: kind === 'input' ? type : undefined,
    rows,
    value: obj[key] ?? '',
    oninput: (e) => {
      const v = e.target.value;
      if (type === 'number') obj[key] = v === '' ? undefined : Number(v);
      else if (v === '' && kind !== 'select') delete obj[key];
      else obj[key] = v;
      upd();
      touch(rerender);
    },
  });
  upd();
  return counter ? h('div', {}, el, counter) : el;
}
function select(obj, key, options, { rerender = false } = {}) {
  return h(
    'select',
    { onchange: (e) => { obj[key] = e.target.value; touch(rerender); } },
    options.map((o) => h('option', { value: o, selected: obj[key] === o ? 'selected' : undefined }, o)),
  );
}
/** Optional Dr. Scroll aside on a learning card: a calm pose and one short line (docs/mascot.md). */
function mascotFields(c) {
  const NONE = '(none)';
  const poses = state.data.meta.mascotPoses;
  const pick = h('select', {
    onchange: (e) => {
      if (e.target.value === NONE) delete c.mascot;
      else c.mascot = { pose: e.target.value, line: c.mascot?.line ?? '' };
      touch(true);
    },
  }, [NONE, ...poses].map((p) => h('option', { value: p, selected: (c.mascot?.pose ?? NONE) === p ? 'selected' : undefined }, p)));
  return grid(['Dr. Scroll', pick], ...(c.mascot ? [['Says', field(c.mascot, 'line', { max: state.data.meta.mascotLineMax })]] : []));
}
function listField(obj, key, { max, sep = ',' } = {}) {
  // Comma- or line-separated list of strings.
  const join = sep === '\n' ? '\n' : ', ';
  const el = h(sep === '\n' ? 'textarea' : 'input', {
    value: (obj[key] ?? []).join(join),
    oninput: (e) => {
      obj[key] = e.target.value.split(sep).map((s) => s.trim()).filter(Boolean);
      touch();
    },
  });
  return max ? h('div', {}, el, h('div', { class: 'count' }, `one per ${sep === '\n' ? 'line' : 'comma'} · max ${max} chars each`)) : el;
}
const grid = (...pairs) => h('div', { class: 'grid' }, pairs.flatMap(([label, el]) => [h('label', {}, label), el]));
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; touch(true); };

function nextId(prefix, existing) {
  let n = 0;
  for (const id of existing) { const m = new RegExp(`^${prefix.replace(/\./g, '\\.')}(\\d+)$`).exec(id); if (m) n = Math.max(n, Number(m[1])); }
  return `${prefix}${n + 1}`;
}
function levelScope(l) { const m = /^level\.[a-z0-9_]+\.([a-z0-9_]+)\.(\d{3})$/.exec(l.id); return `${m[1]}.${m[2]}`; }
const QUESTION_CARD = new Set(['mcq', 'recall']);

function addCard(type) {
  const l = state.draft;
  const id = nextId(`card.${levelScope(l)}.c`, l.cards.map((c) => c.id));
  const blank = {
    text: { type: 'text', role: 'explain', headline: 'New card', body: '' },
    fact: { type: 'fact', fact: 'New fact' },
    timeline: { type: 'timeline', headline: 'Timeline', events: [{ when: 'When', label: 'What happened' }, { when: 'When', label: 'What happened' }] },
    comparison: { type: 'comparison', headline: 'Comparison', items: [{ label: 'A', points: ['Point'] }, { label: 'B', points: ['Point'] }] },
    image: { type: 'image', assetId: 'asset.' },
  }[type];
  // Learning cards go before the first question.
  const at = l.cards.findIndex((c) => QUESTION_CARD.has(c.type) || c.type === 'checkpoint');
  l.cards.splice(at < 0 ? l.cards.length : at, 0, { id, ...blank });
  touch(true);
}
function addQuestion() {
  const l = state.draft;
  const qid = nextId(`question.${levelScope(l)}.q`, l.questions.map((q) => q.id));
  const cid = nextId(`card.${levelScope(l)}.c`, l.cards.map((c) => c.id));
  const teach = l.concepts.find((c) => c.role === 'teach')?.conceptId ?? l.concepts[0]?.conceptId;
  l.questions.push({
    id: qid, kind: 'mcq', purpose: 'recall', conceptIds: teach ? [teach] : [], sourceCardIds: [], prompt: 'New question?',
    options: [{ id: 'a', label: 'Right answer', correct: true }, { id: 'b', label: 'Distractor', correct: false }, { id: 'c', label: 'Distractor', correct: false }],
    explanation: 'Why the answer is right.', difficulty: 0.3,
  });
  const at = l.cards.findIndex((c) => c.type === 'checkpoint');
  l.cards.splice(at < 0 ? l.cards.length : at, 0, { id: cid, type: 'mcq', questionId: qid });
  touch(true);
}
function removeQuestion(q) {
  if (!confirm(`Delete ${short(q.id)} and its card?`)) return;
  const l = state.draft;
  l.questions = l.questions.filter((x) => x !== q);
  l.cards = l.cards.filter((c) => c.questionId !== q.id);
  touch(true);
}

async function save() {
  const [, skillDir, num] = /^skills\/([^/]+)\/levels\/(\d{3})\.json$/.exec(state.file) ?? [];
  const r = await api(`/api/levels/${skillDir}/${num}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-brainscroll-admin': '1' },
    body: JSON.stringify(state.draft),
  });
  if (r.status !== 200) {
    toast(r.body.error ?? `save failed (${r.status})`, true);
    if (r.body.issues?.length) { state.tab = 'issues'; state.saveIssues = r.body.issues; render(); }
    return;
  }
  state.dirty = false;
  state.saveIssues = null;
  const e = r.body.issues.filter((i) => i.severity === 'error').length;
  toast(`Saved ${short(state.draft.id)} · ${e} errors, ${r.body.issues.length - e} warnings for this level`, e > 0);
  await load();
}

// ── rendering ────────────────────────────────────────────────────
function render() {
  if (!state.data) return;
  renderNav();
  renderSidebar();
  const main = $('#main');
  main.replaceChildren();
  if (state.view === 'concepts') main.append(renderConcepts());
  else if (state.view === 'sources') main.append(renderSources());
  else if (state.view === 'issues') main.append(renderAllIssues());
  else if (state.view === 'health') main.append(renderHealth());
  else if (state.draft) main.append(renderLevel());
  else main.append(h('p', { class: 'muted' }, 'Pick a level on the left.'));
}
function renderNav() {
  const nav = $('#nav');
  nav.replaceChildren(
    ...[['levels', 'Curriculum'], ['concepts', 'Concepts'], ['sources', 'Sources'], ['issues', 'All issues'], ['health', 'Learner health']].map(([v, label]) =>
      h('button', { class: state.view === v ? 'active' : '', onclick: () => { state.view = v; render(); } }, label)),
    h('select', { onchange: (e) => { state.skill = e.target.value; render(); } },
      state.data.skills.map((s) => h('option', { value: s.id, selected: s.id === state.skill ? 'selected' : undefined }, s.name))),
  );
  const e = state.issues.filter((i) => i.severity === 'error').length;
  $('#totals').textContent = `${state.data.levels.length} levels · ${state.data.concepts.length} concepts · ${state.data.sources.length} sources · ${e} errors · ${state.issues.length - e} warnings`;
}
function renderSidebar() {
  const side = $('#sidebar');
  side.replaceChildren();
  const levels = levelsOf(state.skill);
  const syl = state.data.syllabi.find((s) => s.skillId === state.skill);
  const chapters = syl?.chapters ?? [{ number: 1, title: 'Levels', levels: [1, 9999] }];
  for (const ch of chapters) {
    side.append(h('div', { class: 'chapter' }, `${ch.number}. ${ch.title}`));
    for (const l of levels.filter((x) => x.data.number >= ch.levels[0] && x.data.number <= ch.levels[1])) {
      const iss = issuesFor(l.data.id, l.file);
      const e = iss.filter((i) => i.severity === 'error').length;
      const w = iss.filter((i) => i.severity === 'warning' && !/not yet verified|cites unverified/.test(i.message)).length;
      side.append(h('div', { class: `lvl${l.file === state.file ? ' sel' : ''}`, onclick: () => selectLevel(l.file), title: l.file },
        h('span', { class: 'muted' }, String(l.data.number).padStart(3, '0')),
        h('span', { class: 't' }, l.data.title),
        e ? h('span', { class: 'badge e' }, e) : null,
        w ? h('span', { class: 'badge w', title: 'warnings other than verification' }, w) : null,
        learnerBadge(l.data.id),
        h('span', { class: `badge ${l.data.status}` }, l.data.status)));
    }
  }
}
function renderSaveBar() {
  const bar = $('#savebar');
  if (!bar) return;
  bar.replaceChildren(...[
    h('button', { class: 'primary', disabled: !state.dirty, onclick: save }, state.dirty ? 'Save level' : 'Saved'),
    h('button', { disabled: !state.dirty, onclick: () => { state.dirty = false; selectLevel(state.file, true); } }, 'Revert'),
    state.dirty ? h('span', { class: 'muted' }, 'Unsaved changes') : null,
  ].filter(Boolean));
}
function renderLevel() {
  const l = state.draft;
  const iss = state.saveIssues ?? issuesFor(l.id, state.file);
  const e = iss.filter((i) => i.severity === 'error').length;
  const wrap = h('div', {},
    h('div', { class: 'bar' },
      h('h2', { style: 'margin:0' }, `${String(l.number).padStart(3, '0')} · ${l.title}`),
      h('span', { class: `badge ${l.status}` }, l.status),
      h('span', { class: 'muted' }, `${l.type} · revision ${l.revision} · ${state.file}`)),
    h('div', { class: 'bar', id: 'savebar' }),
    h('div', { class: 'tabs' }, ...[['edit', 'Edit'], ['preview', 'Preview'], ['json', 'JSON'], ['issues', `Issues (${e} / ${iss.length})`], ['learners', `Learners${learnerCount(l.id) ? ` (${learnerCount(l.id)})` : ''}`]].map(([t, label]) =>
      h('button', { class: state.tab === t ? 'active' : '', onclick: () => { state.tab = t; render(); } }, label))));
  const body = { edit: renderEdit, preview: renderPreview, json: renderJson, issues: () => renderIssueList(iss), learners: renderLearners }[state.tab]();
  wrap.append(body);
  queueMicrotask(renderSaveBar);
  return wrap;
}

function renderEdit() {
  const l = state.draft;
  const B = budget();
  const st = state.data.meta.structure[l.type];
  const out = h('div', {});
  out.append(h('div', { class: 'box' }, h('h3', {}, 'Level'), grid(
    ['Title', field(l, 'title', { max: 60 })],
    ['Objective', field(l, 'objective', { kind: 'textarea', max: 200 })],
    ['Summary', field(l, 'summary', { kind: 'textarea', max: 200 })],
    ['Status', h('div', {}, select(l, 'status', state.data.meta.statuses),
      h('div', { class: 'count' }, 'Saving as in_review or published is refused while this level has validation errors (unverified claims, missing revision bump, …).'))],
    ['Revision', h('div', {}, field(l, 'revision', { type: 'number' }), h('div', { class: 'count' }, 'Bump when changing a published level; published revisions are immutable.'))],
    ['Structure', h('span', { class: 'muted' }, `${st.label}: ${st.questions.standard ?? 'n/a'} questions · ${st.learningCards.min}–${st.learningCards.max} learning cards · ${st.learningWords.min}–${st.learningWords.max} words`)],
    ['Sources', listField(l, 'sourceIds')],
    ['Prerequisites', listField(l, 'prerequisites')],
  )));

  // Concepts
  const cmap = conceptById();
  const conceptIds = [...cmap.keys()].sort();
  out.append(h('div', { class: 'box' }, h('h3', {}, 'Concepts', h('button', { onclick: () => { l.concepts.push({ conceptId: conceptIds[0], role: 'recall', weight: 0.5 }); touch(true); } }, '+ concept')),
    ...l.concepts.map((c, i) => h('div', { class: 'row' },
      h('select', { onchange: (e) => { c.conceptId = e.target.value; touch(); } }, conceptIds.map((id) => h('option', { value: id, selected: id === c.conceptId ? 'selected' : undefined }, `${short(id)}: ${cmap.get(id).title}`))),
      h('span', { class: 'narrow' }, select(c, 'role', ['teach', 'reinforce', 'recall', 'preview'])),
      h('span', { class: 'narrow', style: 'width:80px' }, field(c, 'weight', { type: 'number' })),
      h('button', { class: 'narrow danger', onclick: () => { l.concepts.splice(i, 1); touch(true); } }, '✕')))));

  // Cards
  const cardsBox = h('div', { class: 'box' }, h('h3', {}, 'Cards',
    h('select', { id: 'newcard' }, ['text', 'fact', 'timeline', 'comparison', 'image'].map((t) => h('option', { value: t }, t))),
    h('button', { onclick: () => addCard($('#newcard').value) }, '+ card')));
  l.cards.forEach((c, i) => {
    const head = h('h3', {}, `${short(c.id)} · ${c.type}${c.role ? ` / ${c.role}` : ''}`,
      h('button', { onclick: () => move(l.cards, i, -1) }, '↑'), h('button', { onclick: () => move(l.cards, i, 1) }, '↓'),
      QUESTION_CARD.has(c.type) ? null : h('button', { class: 'danger', onclick: () => { if (confirm(`Delete ${short(c.id)}?`)) { l.cards.splice(i, 1); touch(true); } } }, 'Delete'));
    let fields;
    if (c.type === 'text') fields = grid(['Role', select(c, 'role', ['hook', 'explain', 'connect'], { rerender: true })], ['Headline', field(c, 'headline', { max: B.headline })], ['Body', field(c, 'body', { kind: 'textarea', max: B.body })], ['Callout', field(c, 'callout', { max: 120 })]);
    else if (c.type === 'fact') fields = grid(['Fact', field(c, 'fact', { max: B.factFact })], ['Context', field(c, 'context', { kind: 'textarea', max: B.body })]);
    else if (c.type === 'image') fields = grid(['Asset', field(c, 'assetId')], ['Caption', field(c, 'caption', { max: 160 })]);
    else if (c.type === 'timeline') fields = h('div', {}, grid(['Headline', field(c, 'headline', { max: B.headline })]),
      ...c.events.map((ev, j) => h('div', { class: 'row' }, h('span', { class: 'narrow', style: 'width:180px' }, field(ev, 'when', { max: 40 })), field(ev, 'label', { max: 120 }), h('button', { class: 'narrow danger', onclick: () => { c.events.splice(j, 1); touch(true); } }, '✕'))),
      h('button', { onclick: () => { c.events.push({ when: '', label: '' }); touch(true); } }, '+ event'));
    else if (c.type === 'comparison') fields = h('div', {}, grid(['Headline', field(c, 'headline', { max: B.headline })]),
      ...c.items.map((it, j) => h('div', { class: 'row' }, h('span', { class: 'narrow', style: 'width:180px' }, field(it, 'label', { max: 40 })), listField(it, 'points', { sep: '\n', max: 100 }), h('button', { class: 'narrow danger', onclick: () => { c.items.splice(j, 1); touch(true); } }, '✕'))),
      c.items.length < 3 ? h('button', { onclick: () => { c.items.push({ label: '', points: [''] }); touch(true); } }, '+ item') : null);
    else if (c.type === 'checkpoint') fields = grid(['Headline', field(c, 'headline', { max: B.headline })], ['Learned', listField(c, 'learned', { sep: '\n', max: 120 })]);
    else fields = h('div', { class: 'row' }, h('span', {}, `Shows ${short(c.questionId)}.`), h('span', { class: 'narrow' }, select(c, 'type', ['mcq', 'recall'], { rerender: true })),
      h('span', { class: 'muted' }, 'recall = re-tests a concept from an earlier level'));
    cardsBox.append(h('div', { class: 'box' }, head, fields, QUESTION_CARD.has(c.type) ? null : mascotFields(c)));
  });
  out.append(cardsBox);

  // Questions
  const qBox = h('div', { class: 'box' }, h('h3', {}, `Questions (${l.questions.length}; canonical ${st.questions.standard ?? 'n/a'})`, h('button', { onclick: addQuestion }, '+ question')));
  for (const q of l.questions) {
    const opts = h('div', {}, ...q.options.map((o, j) => h('div', { class: 'row' },
      h('input', { class: 'narrow', type: 'radio', name: `correct-${q.id}`, checked: o.correct, title: 'correct answer', onchange: () => { q.options.forEach((x) => (x.correct = x === o)); touch(); } }),
      h('span', { class: 'narrow muted' }, o.id),
      field(o, 'label', { max: B.answerLabel }),
      field(o, 'rationale', { max: 200 }),
      h('button', { class: 'narrow danger', disabled: q.options.length <= 2, onclick: () => { q.options.splice(j, 1); q.options.forEach((x, k) => (x.id = 'abcd'[k])); touch(true); } }, '✕'))),
      q.options.length < 4 ? h('button', { onclick: () => { q.options.push({ id: 'abcd'[q.options.length], label: '', correct: false }); touch(true); } }, '+ option') : null);
    qBox.append(h('div', { class: 'box' }, h('h3', {}, short(q.id), h('button', { class: 'danger', onclick: () => removeQuestion(q) }, 'Delete')), grid(
      ['Purpose', select(q, 'purpose', state.data.meta.purposes)],
      ['Difficulty', field(q, 'difficulty', { type: 'number' })],
      ['Prompt', field(q, 'prompt', { kind: 'textarea', max: B.questionPrompt })],
      ['Options', h('div', {}, h('div', { class: 'count' }, 'correct · id · label · rationale (shown after answering)'), opts)],
      ['Explanation', field(q, 'explanation', { kind: 'textarea', max: B.explanation })],
      ['Concepts', listField(q, 'conceptIds')],
      ['Source cards', h('div', {}, listField(q, 'sourceCardIds'), h('div', { class: 'count' }, 'Shown as “Take another look” after a wrong first attempt. This level or earlier levels.'))],
    )));
  }
  out.append(qBox);
  return out;
}

function renderJson() {
  const ta = h('textarea', { style: 'min-height:70vh;font-family:ui-monospace,monospace;font-size:12px', value: JSON.stringify(state.draft, null, 2) });
  return h('div', {},
    h('p', { class: 'muted' }, 'Raw level JSON. Apply to load it into the editor, then Save.'),
    ta,
    h('div', { class: 'bar' }, h('button', { onclick: () => {
      try { state.draft = JSON.parse(ta.value); touch(true); toast('Applied'); } catch (e) { toast(`Invalid JSON: ${e.message}`, true); }
    } }, 'Apply JSON')));
}

function renderIssueList(iss) {
  if (!iss.length) return h('p', { class: 'muted' }, 'No issues.');
  const sorted = [...iss].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return h('ul', { class: 'issues' }, sorted.map((i) => h('li', {}, h('span', { class: `sev-${i.severity}` }, i.severity), ' ', h('code', {}, i.where), ': ', i.message)));
}
function renderAllIssues() {
  const onlyErr = state.issuesFilter === 'errors';
  const hideVerify = state.hideVerify !== false;
  let iss = state.issues;
  if (onlyErr) iss = iss.filter((i) => i.severity === 'error');
  if (hideVerify) iss = iss.filter((i) => !/not yet verified|cites unverified/.test(i.message));
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', { style: 'margin:0' }, 'All issues'),
      h('label', {}, h('input', { type: 'checkbox', class: 'narrow', style: 'width:auto', checked: onlyErr, onchange: (e) => { state.issuesFilter = e.target.checked ? 'errors' : 'all'; render(); } }), ' errors only'),
      h('label', {}, h('input', { type: 'checkbox', class: 'narrow', style: 'width:auto', checked: hideVerify, onchange: (e) => { state.hideVerify = e.target.checked; render(); } }), ' hide claim-verification warnings')),
    renderIssueList(iss));
}

// ── preview: roughly what the app shows ──────────────────────────
function renderCardPreview(c) {
  if (c.type === 'text') return h('div', { class: 'pcard' }, h('div', { class: 'role' }, c.role), h('h4', {}, c.headline), c.body ? h('p', {}, c.body) : null, c.callout ? h('p', { class: 'callout' }, c.callout) : null);
  if (c.type === 'fact') return h('div', { class: 'pcard' }, h('div', { class: 'role' }, 'Fact'), h('p', { class: 'fact' }, c.fact), c.context ? h('p', {}, c.context) : null);
  if (c.type === 'timeline') return h('div', { class: 'pcard' }, h('div', { class: 'role' }, 'Timeline'), h('h4', {}, c.headline), h('ol', {}, c.events.map((e) => h('li', {}, h('strong', {}, e.when), ': ', e.label))));
  if (c.type === 'comparison') return h('div', { class: 'pcard' }, h('div', { class: 'role' }, 'Compare'), h('h4', {}, c.headline), h('div', { class: 'cmp' }, c.items.map((it) => h('div', {}, h('strong', {}, it.label), h('ul', {}, it.points.map((p) => h('li', {}, p)))))));
  if (c.type === 'image') return h('div', { class: 'pcard' }, h('div', { class: 'role' }, 'Image'), h('p', {}, `[${c.assetId}]`), c.caption ? h('p', {}, c.caption) : null);
  if (c.type === 'checkpoint') return h('div', { class: 'pcard' }, h('div', { class: 'role' }, 'Level complete'), h('h4', {}, c.headline), h('ul', {}, c.learned.map((x) => h('li', {}, x))));
  return null;
}
function renderPreview() {
  const l = state.draft;
  const qs = new Map(l.questions.map((q) => [q.id, q]));
  const cards = allCardsById();
  const phone = h('div', { class: 'phone' });
  for (const c of l.cards) {
    if (!QUESTION_CARD.has(c.type)) { phone.append(renderCardPreview(c)); continue; }
    const q = qs.get(c.questionId);
    if (!q) { phone.append(h('div', { class: 'pcard' }, `Missing question ${c.questionId}`)); continue; }
    const chosen = state.preview[q.id];
    const pick = q.options.find((o) => o.id === chosen);
    phone.append(h('div', { class: 'pcard' },
      h('div', { class: 'role' }, c.type === 'recall' ? 'Recall' : q.purpose),
      h('h4', {}, q.prompt),
      q.options.map((o) => h('button', {
        class: `popt${chosen === o.id ? (o.correct ? ' right' : ' wrong') : ''}`,
        onclick: () => { state.preview[q.id] = o.id; render(); },
      }, o.label)),
      pick ? h('div', { class: 'pfeedback' }, pick.correct ? `✓ ${q.explanation}` : `✗ ${pick.rationale ?? 'Not quite.'} Try again. The answer isn't revealed.`) : null,
      pick && !pick.correct ? h('div', { class: 'plook' }, h('strong', {}, 'Take another look'),
        q.sourceCardIds.map((id) => { const hit = cards.get(id); return hit ? renderCardPreview(hit.card) : h('p', {}, `Missing card ${id}`); })) : null));
  }
  return h('div', {}, h('p', { class: 'muted' }, 'Approximate app rendering. Tap options to try the answer flow; wrong answers show the source cards.'), phone);
}

// ── concepts & sources ───────────────────────────────────────────
function verificationIndex() {
  const idx = new Map();
  for (const r of state.data.verification) { const a = idx.get(r.factId) ?? []; a.push(r); idx.set(r.factId, a); }
  return idx;
}
function renderConcepts() {
  const q = (state.conceptQuery ?? '').toLowerCase();
  const vidx = verificationIndex();
  const teachers = new Map();
  for (const l of state.data.levels) for (const c of l.data?.concepts ?? []) { const a = teachers.get(c.conceptId) ?? []; a.push(`${String(l.data.number).padStart(3, '0')}:${c.role}`); teachers.set(c.conceptId, a); }
  const rows = state.data.concepts.filter((c) => !q || JSON.stringify(c).toLowerCase().includes(q));
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', { style: 'margin:0' }, `Concepts (${rows.length})`),
      h('input', { placeholder: 'Filter…', style: 'max-width:300px', value: state.conceptQuery ?? '', oninput: (e) => { state.conceptQuery = e.target.value; render(); $('#main input')?.focus(); } }),
      h('span', { class: 'muted' }, 'Read-only here. Claim status comes from content/verification.json (npm run verify:record).')),
    h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Concept'), h('th', {}, 'Claims'), h('th', {}, 'Used in'))),
      h('tbody', {}, rows.map((c) => h('tr', {},
        h('td', {}, h('strong', {}, c.title), h('div', { class: 'muted' }, c.id), h('div', {}, c.description)),
        h('td', {}, h('ul', {}, c.facts.map((f) => h('li', {}, f.text, ' ',
          ...(vidx.get(f.id) ?? []).map((r) => h('span', { class: `badge status-${r.status}`, title: r.notes ?? r.preCheck ?? '' }, `${short(r.sourceId)}: ${r.status}`)),
          h('div', { class: 'muted' }, `cards: ${(f.cardIds ?? []).map((x) => x.split('.').slice(-2).join('.')).join(', ') || 'none'}`))))),
        h('td', {}, (teachers.get(c.id) ?? []).join(', ') || h('span', { class: 'muted' }, 'unused')))))));
}
function renderSources() {
  const q = (state.sourceQuery ?? '').toLowerCase();
  const claims = new Map();
  for (const r of state.data.verification) { const a = claims.get(r.sourceId) ?? { total: 0, verified: 0 }; a.total++; if (r.status === 'verified') a.verified++; claims.set(r.sourceId, a); }
  const rows = state.data.sources.filter((s) => !q || JSON.stringify(s).toLowerCase().includes(q));
  return h('div', {},
    h('div', { class: 'bar' }, h('h2', { style: 'margin:0' }, `Sources (${rows.length})`),
      h('input', { placeholder: 'Filter…', style: 'max-width:300px', value: state.sourceQuery ?? '', oninput: (e) => { state.sourceQuery = e.target.value; render(); $('#main input')?.focus(); } })),
    h('table', {}, h('thead', {}, h('tr', {}, ['Source', 'Publisher', 'License', 'Verified', 'Claims verified', 'Notes'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((s) => { const c = claims.get(s.id) ?? { total: 0, verified: 0 }; return h('tr', {},
        h('td', {}, h('a', { href: s.url, target: '_blank', rel: 'noreferrer' }, s.title), h('div', { class: 'muted' }, s.id)),
        h('td', {}, s.publisher), h('td', {}, s.license),
        h('td', { class: s.verified ? 'status-verified' : 'status-unverified' }, s.verified ? 'yes' : 'no'),
        h('td', {}, `${c.verified}/${c.total}`),
        h('td', { class: 'muted' }, s.notes ?? '')); }))));
}

// ── learner insights (npm run insights:pull) ─────────────────────
const levelInsight = (id) => (state.insights?.available ? state.insights.levels[id] : null);
function learnerCount(id) {
  const li = levelInsight(id);
  if (!li) return 0;
  return li.flags.length + li.questions.reduce((n, q) => n + q.flags.length, 0) + li.reports.length;
}
function learnerBadge(id) {
  const n = learnerCount(id);
  return n ? h('span', { class: 'badge', style: 'color:var(--brand);border-color:var(--brand)', title: 'learner flags and open reports' }, `◆${n}`) : null;
}
const pct = (x) => (x === null || x === undefined ? 'n/a' : `${Math.round(Number(x) * 100)}%`);
function noInsights() {
  return h('div', { class: 'box' }, h('p', {}, 'No learner data loaded.'),
    h('p', { class: 'muted' }, 'Once the app is connected to Supabase, run `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run insights:pull`, then reload. Data is aggregate, read-only, and stays in admin/.data/ (gitignored).'));
}
function renderLearners() {
  if (!state.insights?.available) return noInsights();
  const l = state.draft;
  const li = levelInsight(l.id);
  const out = h('div', {}, h('p', { class: 'muted' }, `Pulled ${state.insights.pulledAt} from ${state.insights.source}. Flags need at least ${state.insights.minLearners} learners.`));
  if (!li) return out.append(h('p', {}, 'No learners have reached this level yet.')), out;
  const f = li.funnel;
  out.append(h('div', { class: 'box' }, h('h3', {}, 'Level'), f ? grid(
    ['Started / completed', `${f.started} / ${f.completed} (${pct(f.completion_rate)})`],
    ['Mean first-try share', pct(f.mean_first_try_share)],
    ['Exits by card', Object.entries(f.exits_by_card).map(([i, n]) => `card ${Number(i) + 1}: ${n}`).join(' · ') || 'none'],
  ) : h('p', { class: 'muted' }, 'No starts yet.'), ...li.flags.map((x) => h('p', { class: 'sev-warning' }, '◆ ', x))));
  const qById = new Map(l.questions.map((q) => [q.id, q]));
  for (const q of li.questions) {
    const def = qById.get(q.id);
    const st = q.stat;
    out.append(h('div', { class: 'box' }, h('h3', {}, short(q.id), h('span', { class: 'muted' }, def?.prompt ?? '')), st ? h('div', {},
      grid(['Learners', st.learners], ['First try', pct(st.first_try_rate)], ['Avg attempts', st.avg_attempts ?? 'n/a'], ['Review first try', `${pct(st.review_first_try_rate)} of ${st.review_attempts}`]),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Option'), h('th', {}, 'Picked first'))), h('tbody', {}, (def?.options ?? []).map((o) =>
        h('tr', {}, h('td', {}, o.correct ? '✓ ' : '', o.label), h('td', {}, `${st.first_picks[o.id] ?? 0} (${pct((st.first_picks[o.id] ?? 0) / Math.max(st.learners, 1))})`))))),
      ...q.flags.map((x) => h('p', { class: 'sev-warning' }, '◆ ', x))) : h('p', { class: 'muted' }, 'No attempts yet.')));
  }
  out.append(h('div', { class: 'box' }, h('h3', {}, `Open reports (${li.reports.length})`),
    li.reports.length ? h('ul', { class: 'issues' }, li.reports.map((r) => h('li', {}, h('strong', {}, r.category), ' · ', h('code', {}, short(r.object_id)), ' · ', r.message ?? h('span', { class: 'muted' }, 'no message'), h('span', { class: 'muted' }, ` · ${r.created_at.slice(0, 10)}`)))) : h('p', { class: 'muted' }, 'None.')));
  return out;
}
function renderHealth() {
  if (!state.insights?.available) return noInsights();
  const hdata = state.insights.health;
  const label = {
    active_learners: 'Active learners', learning_days: 'Learner-days with learning', levels_completed: 'Levels completed',
    first_try_rate_new_levels: 'First-try rate on new levels', review_first_try_rate: 'Delayed recall (review first try)', reviews_answered: 'Review items answered',
    days_at_daily_cap_share: 'Learning days that reached the daily cap', returned_next_day_share: 'Came back the next day', returned_within_7_days_share: 'Came back within 7 days',
    new_accounts_by_method: 'New accounts by sign-in method', open_reports: 'Open content reports', concept_strength_distribution: 'Concept strength (0–5 → learners×concepts)', window_days: 'Window (days)',
  };
  const fmt = (k, v) => (/share|rate/.test(k) ? pct(v) : typeof v === 'object' ? JSON.stringify(v) : String(v ?? 'n/a'));
  const flagged = Object.entries(state.insights.levels).filter(([id]) => learnerCount(id) > 0).sort((a, b) => learnerCount(b[0]) - learnerCount(a[0]));
  return h('div', {}, h('h2', {}, 'Learner health'),
    h('p', { class: 'muted' }, `Learning and product health, never time spent. Pulled ${state.insights.pulledAt}.`),
    h('table', {}, h('tbody', {}, Object.entries(hdata).map(([k, v]) => h('tr', {}, h('td', {}, label[k] ?? k), h('td', {}, fmt(k, v)))))),
    h('h3', {}, `Levels needing attention (${flagged.length})`),
    h('ul', { class: 'issues' }, flagged.map(([id]) => { const lf = state.data.levels.find((x) => x.data.id === id); return h('li', {},
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); if (lf) { selectLevel(lf.file); state.tab = 'learners'; render(); } } }, `${short(id)} ${lf?.data.title ?? ''}`), `: ${learnerCount(id)} flags/reports`); })));
}

// ── boot ─────────────────────────────────────────────────────────
$('#validate-all').addEventListener('click', revalidate);
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
load().catch((e) => { $('#main').textContent = `Failed to load: ${e.message}`; });
