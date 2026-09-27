// Search palette: "/" or Cmd/Ctrl+K anywhere, #/search?q=…, and the header box.
import type MiniSearch from 'minisearch';
import { GROUPS, groupHits, loadEngine, search, whyMatched, type Hit, type SearchDoc, type SearchOutcome } from './search.ts';
import type { SiteData } from './types.ts';
import { esc } from './render/util.ts';

let engine: MiniSearch<SearchDoc> | null = null;
let loading: Promise<void> | null = null;
let data: SiteData;
let hits: Hit[] = [];
let active = 0;
let lastQuery = '';

const STATUS_CLASS: Record<string, string> = {
  blocked: 'bad', missing: 'bad', stale: 'warn', draft: 'warn', choosing: 'warn', candidate: 'accent',
  available: 'ok', agreed: 'ok', flight: 'muted',
};
const kindLabel = (k: string) => GROUPS.find((g) => g.kind === k)?.label.replace(/s$/, '') ?? k;

function ensureEngine(): Promise<void> {
  if (engine) return Promise.resolve();
  loading ??= import('./generated/search-index.json').then((m) => { engine = loadEngine(m.default as object); });
  return loading;
}

function el(): HTMLElement {
  let root = document.getElementById('palette');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'palette';
  root.hidden = true;
  root.innerHTML = `<div class="pal-backdrop" data-pal-close></div>
    <div class="pal" role="dialog" aria-modal="true" aria-label="Search">
      <input id="pal-input" type="search" autocomplete="off" spellcheck="false" placeholder="Search parts, part numbers, shared numbers, interfaces, docs…" aria-label="Search">
      <div class="pal-body"><div class="pal-results" id="pal-results" role="listbox"></div><div class="pal-preview" id="pal-preview"></div></div>
      <div class="pal-foot small muted">↑ ↓ move · Enter open · Esc close</div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

export function initSearch(d: SiteData) {
  data = d;
  const root = el();
  const input = root.querySelector<HTMLInputElement>('#pal-input')!;
  input.addEventListener('input', () => run(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); openHit(hits[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  });
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-pal-close]')) { closeSearch(); return; }
    const chip = t.closest<HTMLElement>('[data-suggest]');
    if (chip) { input.value = chip.dataset.suggest!; run(input.value); input.focus(); return; }
    const item = t.closest<HTMLElement>('[data-hit]');
    if (item) openHit(hits[Number(item.dataset.hit)]);
  });
  root.addEventListener('mousemove', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-hit]');
    if (item && Number(item.dataset.hit) !== active) { active = Number(item.dataset.hit); paint(); }
  });
  document.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openSearch(); }
    else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openSearch(); }
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-open-search]')) { e.preventDefault(); openSearch(); }
  });
}

export function isOpen() { return !el().hidden; }

export function openSearch(q = '') {
  const root = el();
  root.hidden = false;
  document.body.classList.add('pal-open');
  const input = root.querySelector<HTMLInputElement>('#pal-input')!;
  input.value = q;
  input.focus();
  void ensureEngine().then(() => run(input.value));
  run(q);
}

export function closeSearch() {
  const root = el();
  root.hidden = true;
  document.body.classList.remove('pal-open');
  if (location.hash.startsWith('#/search')) location.hash = '#/';
}

function move(d: number) {
  if (!hits.length) return;
  active = (active + d + hits.length) % hits.length;
  paint();
  document.querySelector(`[data-hit="${active}"]`)?.scrollIntoView({ block: 'nearest' });
}

function openHit(h: Hit | undefined) {
  if (!h) return;
  closeSearch();
  location.hash = h.doc.link;
}

let outcome: SearchOutcome = { hits: [], correctedQuery: null, words: [] };

function run(q: string) {
  lastQuery = q;
  if (!engine) { outcome = { hits: [], correctedQuery: null, words: [] }; hits = []; paint(q.trim() ? 'loading' : undefined); return; }
  outcome = search(engine, { synonyms: data.synonyms, stopWords: data.site.search.stop_words }, q, 16);
  // display grouped, groups ordered by their best match
  hits = groupHits(outcome.hits).flatMap((g) => g.hits);
  active = 0;
  paint();
}

function paint(state?: 'loading') {
  const results = document.getElementById('pal-results')!;
  const preview = document.getElementById('pal-preview')!;
  const q = lastQuery.trim();
  if (!q) {
    results.innerHTML = `<div class="pal-empty"><div class="small muted">Try</div><div class="chips">${data.site.search.suggestions.map((s) => `<button class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    preview.innerHTML = '';
    return;
  }
  if (state === 'loading') { results.innerHTML = '<p class="muted small">Loading index…</p>'; preview.innerHTML = ''; return; }
  if (!hits.length) {
    results.innerHTML = `<div class="pal-empty"><p>Nothing in the dashboard matches '${esc(q)}'.</p>
      <p class="small muted">If the team calls something by another name, add it to that part's <code>aliases</code> in data/parts.yaml or to data/synonyms.yaml (<a href="https://github.com/${esc(data.site.repo.owner)}/${esc(data.site.repo.name)}/edit/${esc(data.site.repo.branch)}/data/synonyms.yaml" target="_blank" rel="noopener">Edit on GitHub</a>).</p>
      <p class="small"><a href="${esc(data.site.project_assistant_url)}" target="_blank" rel="noopener">Ask the project assistant</a></p></div>`;
    preview.innerHTML = '';
    return;
  }
  let html = outcome.correctedQuery ? `<div class="pal-typo small">Showing results for '${esc(outcome.correctedQuery)}'</div>` : '';
  let k = 0;
  for (const g of groupHits(hits)) {
    const list = g.hits;
    html += `<div class="pal-group caps small muted">${esc(g.label)}</div>`;
    for (const h of list) {
      const cls = STATUS_CLASS[h.doc.status.split(' ')[0]] ?? 'muted';
      html += `<div class="pal-hit ${k === active ? 'active' : ''}" data-hit="${k}" role="option" aria-selected="${k === active}">
        <div><span class="id ${cls}">${esc(h.doc.ref)}</span> ${esc(h.doc.title)}${h.doc.track === 'flight' ? ' <span class="badge-flight">flight track</span>' : ''}</div>
        <div class="small muted">${[h.doc.owner, h.doc.status].filter(Boolean).map(esc).join(' · ')}${/proposed/i.test(h.doc.status) ? '' : ''}</div>
        <div class="small why">${esc(whyMatched(h))}</div></div>`;
      k++;
    }
  }
  results.innerHTML = html;
  const h = hits[active];
  const akas = h.doc.aliases ? h.doc.aliases.split(' | ').slice(0, 4) : [];
  preview.innerHTML = `<div class="small muted caps">${esc(kindLabel(h.doc.kind))}</div>
    <h3><span class="id">${esc(h.doc.ref)}</span> ${esc(h.doc.title)}</h3>
    ${h.doc.model_line ? `<div class="mono small">${esc(h.doc.model_line)}</div>` : ''}
    <p class="small">${esc(h.doc.body.slice(0, 420))}${h.doc.body.length > 420 ? '…' : ''}</p>
    <dl class="small">${h.doc.owner ? `<dt>Owner</dt><dd>${esc(h.doc.owner)}</dd>` : ''}${h.doc.status ? `<dt>Status</dt><dd>${esc(h.doc.status)}</dd>` : ''}${h.doc.source ? `<dt>Source</dt><dd>${esc(h.doc.source)}</dd>` : ''}${akas.length ? `<dt>Also known as</dt><dd>${akas.map(esc).join(', ')}</dd>` : ''}</dl>
    <a class="btn btn-primary" href="${esc(h.doc.link)}" data-pal-open>Open</a>`;
  preview.querySelector('[data-pal-open]')?.addEventListener('click', () => { el().hidden = true; document.body.classList.remove('pal-open'); });
}
