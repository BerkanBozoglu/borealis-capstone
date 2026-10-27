import './style.css';
import dataJson from './generated/data.json';
import historyJson from './generated/history.json';
import type { Commit, SiteData } from './types.ts';
import { type Ctx, type GhIssue, esc, gh } from './render/util.ts';
import { renderCountdown, renderMap } from './render/map.ts';
import { renderSubsystem } from './render/subsystem.ts';
import { renderSandbox, renderSandboxOutputs } from './render/sandbox.ts';
import { renderInbox, renderInterfaces, renderRegister, renderRegisterTable, registerFilters } from './render/tables.ts';
import { parseSandbox, presetValues, sandboxHash } from './sandbox.ts';
import { renderHardware, hardwareFilters, hardwareHash } from './render/hardware.ts';
import { renderDocs } from './render/docs.ts';
import { beamAngles, renderInspector, renderModel3d } from './render/model3d.ts';
import type { Viewer, ViewState } from './hw3d/scene.ts';
import { renderBom, bomFor } from './render/bom.ts';
import { bomCsv } from './bom.ts';
import { initSearch, openSearch, isOpen } from './searchui.ts';
import { renderPerson, renderPlan, renderWeek } from './render/weekly.ts';
import type { DocPage } from './types.ts';

const data = dataJson as unknown as SiteData;
const commits = historyJson as unknown as Commit[];

// ---------- storage (every access guarded: private windows can throw) ----------
const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

let showFlight = store.get('borealis:showFlight') === '1';
let issues: GhIssue[] | null = null;
let currentSubsystem: string | null = null;
let viewer: Viewer | null = null;
let viewerToken = 0;

// ---------- routing ----------
interface Route { path: string[]; query: URLSearchParams; anchor: string }
function route(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [pa, q = ''] = h.split('?');
  const [p, anchor = ''] = pa.split('#'); // #/docs/<file>#<anchor>
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q), anchor };
}

let docs: DocPage[] | null = null;
function loadDocs() {
  void import('./generated/docs.json').then((m) => { docs = m.default as unknown as DocPage[]; if (route().path[0] === 'docs') render(); });
}

function baseUrl(): string {
  return location.origin + location.pathname;
}

function ctxFor(r: Route, lastSeen: string | null = null): Ctx {
  return { data, history: commits, showFlight, now: new Date(), issues, lastSeen, query: r.query, baseUrl: baseUrl() };
}

function markSeen(id: string | null) {
  if (id) store.set(`borealis:seen:${id}`, new Date().toISOString());
}

// ---------- rendering ----------
const main = () => document.getElementById('app')!;

function renderHeader(r: Route) {
  const c = ctxFor(r);
  document.title = data.site.title;
  document.getElementById('site-title')!.textContent = data.site.title;
  document.getElementById('countdown')!.innerHTML = renderCountdown(c);
  const page = r.path[0] ?? '';
  const navPage = page === 'person' || page === 'plan' ? 'week' : page;
  document.querySelectorAll<HTMLAnchorElement>('nav a[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === navPage);
  });
  const toggle = document.getElementById('flight-toggle') as HTMLInputElement;
  toggle.checked = showFlight;
  const inbox = document.querySelector<HTMLAnchorElement>('nav a[data-nav="inbox"]')!;
  const me = store.get('borealis:me');
  inbox.href = me ? `#/inbox/${me}` : '#/inbox';
}

function render() {
  const r = route();
  const [page, arg] = r.path;
  // leaving a subsystem page stamps "last looked"
  const nextSubsystem = page === 's' ? arg : null;
  if (currentSubsystem && currentSubsystem !== nextSubsystem) markSeen(currentSubsystem);

  const sub = page === 's' ? data.subsystems.find((s) => s.id === arg) : undefined;
  document.body.classList.toggle('hide-flight', !showFlight && sub?.track !== 'flight');
  renderHeader(r);

  if (viewer) { viewer.dispose(); viewer = null; }
  viewerToken++;
  let html = '';
  switch (page) {
    case undefined: html = renderMap(ctxFor(r)); break;
    case 's': html = renderSubsystem(ctxFor(r, store.get(`borealis:seen:${arg}`)), arg ?? ''); break;
    case 'sandbox': html = renderSandbox(ctxFor(r)); break;
    case 'interfaces': html = renderInterfaces(ctxFor(r)); break;
    case 'register': html = renderRegister(ctxFor(r)); break;
    case 'inbox': {
      const person = arg ?? store.get('borealis:me');
      if (arg) store.set('borealis:me', arg);
      html = renderInbox(ctxFor(r), person);
      break;
    }
    case 'hardware': html = arg === 'choice' ? renderHardware(ctxFor(r), null, r.path[2] ?? null) : renderHardware(ctxFor(r), arg ?? null); break;
    case 'bom': html = renderBom(ctxFor(r)); break;
    case 'model': html = renderModel3d(ctxFor(r), arg ?? null); break;
    case 'docs':
      if (!docs) { loadDocs(); html = '<section class="card"><p class="muted">Loading docs…</p></section>'; }
      else html = renderDocs(docs, arg);
      break;
    case 'week': html = renderWeek(ctxFor(r), arg ?? null); break;
    case 'person': html = renderPerson(ctxFor(r), arg ?? null); break;
    case 'plan': html = renderPlan(ctxFor(r)); break;
    case 'search': html = renderMap(ctxFor(r)); break;
    default: html = `<section class="card"><h1>Not found</h1><p><a href="#/">Back to the map</a></p></section>`;
  }
  main().innerHTML = html;
  currentSubsystem = nextSubsystem;

  if (page === 'search' && !isOpen()) openSearch(r.query.get('q') ?? '');
  if (page === 'model') mountModel(r, arg ?? null);

  const focusRow = r.query.get('row') ?? r.query.get('i') ?? r.query.get('id');
  const focus = focusRow
    ? document.getElementById(`row-${focusRow}`) ?? document.getElementById(`iface-${focusRow}`)
    : r.query.get('item') ? document.getElementById(`item-${r.query.get('item')}`)
      : r.query.get('decision') ? document.getElementById(`decision-${r.query.get('decision')}`)
        : r.anchor ? document.getElementById(`doc-${r.anchor}`) : null;
  if (focus) {
    if (!r.anchor) focus.classList.add('flash');
    focus.scrollIntoView({ block: r.anchor ? 'start' : 'center' });
  } else if (page !== 'sandbox' && page !== 'register' && page !== 'hardware' && page !== 'bom' && page !== 'model') {
    window.scrollTo(0, 0);
  }
}

// ---------- 3D model (three.js is loaded only on this page) ----------
function mountModel(r: Route, selected: string | null) {
  const token = viewerToken;
  const box = document.getElementById('m3-view');
  if (!box) return;
  const ctx = ctxFor(r);
  const lane = (o: { part?: string | null; alt_of?: string }) =>
    o.part ? (data.parts.find((p) => p.id === o.part)?.availability ?? null) : o.alt_of ? 'alt' : null;
  const objects = (data.model3d?.objects ?? []).map((o) => ({ id: o.id, name: o.name, config: o.config, shell: !!o.shell, lane: lane(o) }));
  const tip = document.getElementById('m3-tip')!;
  const show = (id: string | null, focus: boolean) => {
    document.getElementById('m3-inspector')!.innerHTML = renderInspector(ctx, id);
    document.querySelector('.m3-side')?.scrollTo({ top: 0 });
    document.querySelectorAll<HTMLElement>('[data-m3-pick]').forEach((b) => b.classList.toggle('sel', b.dataset.m3Pick === id));
    window.history.replaceState(null, '', id ? `#/model/${encodeURIComponent(id)}` : '#/model');
    if (focus) viewer?.select(id);
  };
  void import('./hw3d/scene.ts').then((m) => {
    if (token !== viewerToken) return; // the user already left the page
    document.getElementById('m3-loading')?.remove();
    viewer = m.mountScene({
      container: box, objects, beam: beamAngles(ctx),
      onSelect: (id) => show(id, false),
      onHover: (id, name, x, y) => { tip.hidden = !id; if (id) { tip.textContent = name; tip.style.left = `${x}px`; tip.style.top = `${y}px`; } },
    });
    if (selected) { const o = data.model3d.objects.find((x) => x.id === selected); if (o) { pickConfigFor(o.config); viewer.select(selected); } }
  }).catch(() => { const l = document.getElementById('m3-loading'); if (l) l.textContent = 'The 3D view could not start (WebGL unavailable?). The parts list and inspector still work.'; });

  // toolbar
  const segOn = (name: string, v: string) => document.querySelectorAll<HTMLButtonElement>(`[data-m3-seg="${name}"] button`).forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  function pickConfigFor(cfg: string[]) {
    const s: Partial<ViewState> = {};
    if (cfg.includes('rxB') && !cfg.includes('rxA')) { s.rx = 'B'; segOn('rx', 'B'); }
    const tx = cfg.find((c) => c === 'C1' || c === 'C2' || c === 'C3') as ViewState['tx'] | undefined;
    if (tx && !cfg.includes('tx')) { s.tx = tx; segOn('tx', tx); }
    if (cfg.includes('bench')) { s.bench = true; document.querySelector('[data-m3-tog="bench"]')?.classList.add('active'); }
    viewer?.set(s);
  }
  document.querySelectorAll<HTMLElement>('[data-m3-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]'); if (!b) return;
    segOn(seg.dataset.m3Seg!, b.dataset.v!); viewer?.set({ [seg.dataset.m3Seg!]: b.dataset.v } as Partial<ViewState>);
  }));
  document.getElementById('m3-explode')?.addEventListener('input', (e) => viewer?.set({ explode: parseFloat((e.target as HTMLInputElement).value) }));
  document.querySelectorAll<HTMLButtonElement>('[data-m3-tog]').forEach((b) => b.addEventListener('click', () => {
    const on = !b.classList.contains('active'); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    viewer?.set({ [b.dataset.m3Tog!]: on } as Partial<ViewState>);
    if (b.dataset.m3Tog === 'status') document.getElementById('m3-legend')!.hidden = !on;
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-m3-view]').forEach((b) => b.addEventListener('click', () => viewer?.view(b.dataset.m3View!)));
  document.querySelectorAll<HTMLButtonElement>('[data-m3-pick]').forEach((b) => b.addEventListener('click', () => {
    const o = data.model3d.objects.find((x) => x.id === b.dataset.m3Pick); if (!o) return;
    pickConfigFor(o.config); show(o.id, true);
  }));
}

// ---------- sandbox ----------
function sandboxSet(param: string, value: number, full: boolean) {
  const r = route();
  const st = parseSandbox(data, r.query);
  st.values[param] = value;
  window.history.replaceState(null, '', sandboxHash(data, st.values, st.scope));
  if (full) { render(); return; }
  const next = route();
  const out = document.getElementById('sb-out');
  if (out) out.innerHTML = renderSandboxOutputs(ctxFor(next), parseSandbox(data, next.query));
  const o = document.querySelector(`[data-sb-out="${CSS.escape(param)}"]`);
  if (o) o.textContent = String(value);
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const commit = t.closest<HTMLElement>('[data-commit]');
  if (commit) {
    const on = !commit.classList.contains('selected');
    document.querySelectorAll('[data-commit].selected').forEach((x) => x.classList.remove('selected'));
    document.querySelectorAll('.block.hl').forEach((x) => x.classList.remove('hl'));
    if (on) {
      commit.classList.add('selected');
      for (const s of (commit.dataset.subsystems ?? '').split(' ').filter(Boolean)) {
        document.querySelector(`.block[data-subsystem="${CSS.escape(s)}"]`)?.classList.add('hl');
      }
    }
    return;
  }
  if (t.closest('[data-wk-copy]')) { void copyWeekPost(); return; }
  if (t.closest('[data-bom-export]')) {
    const bom = bomFor(ctxFor(route()));
    const blob = new Blob([bomCsv(bom)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `borealis-bom-${bom.header.date}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  const part = t.closest<HTMLElement>('[data-hw-part]');
  if (part) {
    const r = route();
    location.hash = hardwareHash(part.dataset.hwPart!, hardwareFilters(r.query));
    return;
  }
  const pill = t.closest<HTMLElement>('button[data-sb-param]');
  if (pill) { sandboxSet(pill.dataset.sbParam!, Number(pill.dataset.sbValue), true); return; }
  const preset = t.closest<HTMLElement>('[data-sb-preset]');
  if (preset) {
    const scope = route().query.get('scope');
    location.hash = sandboxHash(data, presetValues(data, preset.dataset.sbPreset!), scope);
  }
});

document.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.matches('input[type=range][data-sb-param]')) { sandboxSet(t.dataset.sbParam!, Number(t.value), false); return; }
  if (t.matches('[data-reg-filter]')) updateRegisterFilters();
});

document.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'flight-toggle') {
    showFlight = t.checked;
    store.set('borealis:showFlight', showFlight ? '1' : '0');
    render();
    return;
  }
  if (t.matches('input[type=range][data-sb-param]')) { sandboxSet(t.dataset.sbParam!, Number(t.value), true); return; }
  if (t.matches('select[data-reg-filter]')) { updateRegisterFilters(); return; }
  if (t.matches('select[data-plan-person]')) { location.hash = t.value ? `#/plan?person=${encodeURIComponent(t.value)}` : '#/plan'; return; }
  if (t.matches('select[data-bom-subsystem]')) { location.hash = t.value ? `#/bom?subsystem=${encodeURIComponent(t.value)}` : '#/bom'; return; }
  if (t.matches('select[data-inbox-person]')) {
    if (t.value) { store.set('borealis:me', t.value); location.hash = `#/inbox/${t.value}`; }
  }
});

document.addEventListener('focusin', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.matches('[data-select-all]')) t.select();
});

// ---------- weekly plan: copy the Discord post; on failure show it selected ----------
async function copyWeekPost() {
  const box = document.getElementById('wk-post') as HTMLTextAreaElement | null;
  if (!box) return;
  const done = document.getElementById('wk-copied');
  try {
    await navigator.clipboard.writeText(box.value);
    if (done) { done.textContent = 'Copied. Paste it into Discord.'; done.className = 'small ok'; done.hidden = false; }
  } catch {
    box.hidden = false;
    box.focus();
    box.select();
    if (done) { done.textContent = 'Copy blocked by the browser: the text is selected below, press Ctrl/⌘+C.'; done.className = 'small warn'; done.hidden = false; }
  }
}

function updateRegisterFilters() {
  const q = new URLSearchParams();
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-reg-filter]').forEach((el) => {
    if (el.value) q.set(el.dataset.regFilter!, el.value);
  });
  const s = q.toString();
  window.history.replaceState(null, '', `#/register${s ? `?${s}` : ''}`);
  const table = document.getElementById('reg-table');
  if (table) table.innerHTML = renderRegisterTable(ctxFor(route()), registerFilters(q));
}

window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => markSeen(currentSubsystem));

// ---------- live GitHub issues (unauthenticated; optional) ----------
async function loadIssues() {
  const key = 'borealis:issues';
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { at, list } = JSON.parse(cached);
      if (Date.now() - at < 5 * 60_000) { issues = list; render(); return; }
    }
  } catch { /* ignore */ }
  try {
    const res = await fetch(`${gh(data).api}/issues?state=all&per_page=100`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(String(res.status));
    const list = (await res.json()) as (GhIssue & { pull_request?: unknown })[];
    issues = list.filter((i) => !i.pull_request).map((i) => ({
      number: i.number, title: i.title, state: i.state, html_url: i.html_url,
      labels: (i.labels ?? []).map((l) => ({ name: typeof l === 'string' ? l : l.name })),
      assignees: (i.assignees ?? []).map((a) => ({ login: a.login })),
    }));
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), list: issues })); } catch { /* ignore */ }
    const page = route().path[0];
    // re-render pages that show issue data, but never mid-interaction on the sandbox
    if (page !== 'sandbox' && page !== 'register') render();
  } catch {
    issues = null;
  }
}

document.getElementById('repo-link')!.setAttribute('href', gh(data).repo);
document.getElementById('built')!.innerHTML = `built ${esc(data.built_at.slice(0, 16).replace('T', ' '))} UTC from <code>data/*.yaml</code>`;
initSearch(data);
render();
void loadIssues();
