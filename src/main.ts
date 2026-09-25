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

// ---------- routing ----------
interface Route { path: string[]; query: URLSearchParams }
function route(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = h.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
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
  document.querySelectorAll<HTMLAnchorElement>('nav a[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === page);
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
    default: html = `<section class="card"><h1>Not found</h1><p><a href="#/">Back to the map</a></p></section>`;
  }
  main().innerHTML = html;
  currentSubsystem = nextSubsystem;

  const focusRow = r.query.get('row') ?? r.query.get('i');
  if (focusRow) {
    const el = document.getElementById(`row-${focusRow}`) ?? document.getElementById(`iface-${focusRow}`);
    if (el) { el.classList.add('flash'); el.scrollIntoView({ block: 'center' }); }
  } else if (page !== 'sandbox' && page !== 'register') {
    window.scrollTo(0, 0);
  }
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
  if (t.matches('select[data-inbox-person]')) {
    if (t.value) { store.set('borealis:me', t.value); location.hash = `#/inbox/${t.value}`; }
  }
});

document.addEventListener('focusin', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.matches('[data-select-all]')) t.select();
});

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
render();
void loadIssues();
