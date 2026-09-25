// Interfaces, register and inbox pages.
import { INTERFACE_STATUSES, TAGS, type RegisterRow } from '../types.ts';
import { recheckBox } from './subsystem.ts';
import {
  type Ctx, editLink, esc, gh, historyFor, ifaceEnds, ifaceMark, mark, personLink, personName, rowLink,
  staleReason, subsystemName, tagChip, trackAttr, valueText, visible, daysUntil,
} from './util.ts';

// ---------------- interfaces ----------------
export function renderInterfaces(ctx: Ctx): string {
  const { data } = ctx;
  const order = (id: string) => INTERFACE_STATUSES.indexOf(data.derived.interfaces[id].status);
  const list = [...data.interfaces].sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id));
  const counts = INTERFACE_STATUSES.map((s) => `${ifaceMark(s)} <b class="num">${data.interfaces.filter((i) => data.derived.interfaces[i.id].status === s).length}</b>`).join(' &nbsp; ');
  const focus = ctx.query.get('i');
  const rows = list.map((i) => {
    const d = data.derived.interfaces[i.id];
    return `<tr id="iface-${esc(i.id)}" data-iface="${esc(i.id)}" class="${focus === i.id ? 'flash' : ''}">
      <td class="id">${esc(i.id)}</td><td>${ifaceEnds(data, i.id)}</td><td>${esc(i.what)}</td>
      <td>${i.owners.map((o) => personLink(data, o)).join(', ')}</td>
      <td>${ifaceMark(d.status)}${d.downgraded ? '<div class="small warn">spec text changed after agreement — back to draft</div>' : ''}</td>
      <td>${esc(i.gap) || '<span class="muted">—</span>'}</td><td>${esc(i.blocks) || '<span class="muted">—</span>'}</td>
      <td class="small"><code title="paste this as spec_hash when setting status: agreed">${esc(d.computed_hash)}</code></td>
      <td class="actions">${editLink(data, 'data/interfaces.yaml', d.line)}</td></tr>`;
  }).join('');
  return `<section class="card"><h1>Interfaces</h1>
    <p>${counts}</p>
    <p class="small muted">The upstream owner drafts the one-line spec; the downstream owner edits it until they can build against it, adds their name, sets <code>status: agreed</code> and pastes the spec hash shown here into <code>spec_hash</code>. If the spec text changes later, status drops back to draft automatically.</p>
    <table class="tbl"><thead><tr><th>ID</th><th>From → to</th><th>What</th><th>Owners</th><th>Status</th><th>Gap</th><th>Blocks</th><th>Spec hash</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

// ---------------- register ----------------
export interface RegisterFilters { status: string; subsystem: string; tag: string; owner: string; q: string }

export function registerFilters(q: URLSearchParams): RegisterFilters {
  return { status: q.get('status') ?? '', subsystem: q.get('subsystem') ?? '', tag: q.get('tag') ?? '', owner: q.get('owner') ?? '', q: q.get('q') ?? '' };
}

export function filterRegister(ctx: Ctx, f: RegisterFilters): RegisterRow[] {
  const { data } = ctx;
  const recent = data.site.recent_days;
  const needle = f.q.trim().toLowerCase();
  return visible(ctx, data.register).filter((r) => {
    const d = data.derived.rows[r.id];
    if (f.status === 'stale' && !d.stale) return false;
    if (f.status === 'recent' && -daysUntil(ctx.now, r.changed) > recent) return false;
    if (f.status === 'ok' && d.stale) return false;
    if (f.subsystem && r.subsystem !== f.subsystem) return false;
    if (f.tag && r.tag !== f.tag) return false;
    if (f.owner && r.owner !== f.owner) return false;
    if (needle) {
      const hay = [r.id, r.name, String(r.value), r.unit, r.note, r.source, personName(data, r.owner)].join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function renderRegisterTable(ctx: Ctx, f: RegisterFilters): string {
  const { data } = ctx;
  const rows = filterRegister(ctx, f);
  const body = rows.map((r) => {
    const d = data.derived.rows[r.id];
    return `<tr data-row="${esc(r.id)}"${trackAttr(r.track)} class="${d.stale ? 'is-stale' : ''}">
      <td>${rowLink(data, r.id)}</td><td>${esc(r.name)}${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}</td>
      <td><a href="#/s/${esc(r.subsystem)}">${esc(subsystemName(data, r.subsystem))}</a></td>
      <td>${valueText(r.value, r.unit)}</td><td>${tagChip(r.tag)}</td><td>${personLink(data, r.owner)}</td>
      <td>${d.stale ? `${mark('recheck', 'stale')}<div class="small">${staleReason(data, r.id)}</div>` : mark('ok', 'current')}</td>
      <td class="num small">${esc(r.changed)}<br><span class="muted">${esc(r.checked)}</span></td>
      <td class="small muted">${esc(r.source)}</td>
      <td class="actions">${editLink(data, 'data/register.yaml', d.line)}<details class="hist"><summary class="btn btn-small">History</summary>${historyFor(ctx, r.id)}</details></td></tr>`;
  }).join('');
  return `<p class="small muted"><span class="num">${rows.length}</span> of ${visible(ctx, data.register).length} rows</p>
    <table class="tbl"><thead><tr><th>ID</th><th>Parameter</th><th>Subsystem</th><th>Value</th><th>Tag</th><th>Owner</th><th>Stale?</th><th>Changed<br>checked</th><th>Source</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
}

export function renderRegister(ctx: Ctx): string {
  const { data } = ctx;
  const f = registerFilters(ctx.query);
  const sel = (name: keyof RegisterFilters, label: string, opts: [string, string][]) =>
    `<label>${label} <select data-reg-filter="${name}"><option value="">all</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${f[name] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  return `<section class="card"><h1>Register</h1>
    <p class="small muted">The register is the truth for numbers; 01_MASTER_CONTEXT is the narrative.</p>
    <div class="filters">
      ${sel('status', 'Status', [['stale', 'stale'], ['recent', `changed in last ${data.site.recent_days} days`], ['ok', 'ok (not stale)']])}
      ${sel('subsystem', 'Subsystem', data.subsystems.map((s) => [s.id, s.name]))}
      ${sel('tag', 'Tag', TAGS.map((t) => [t, t]))}
      ${sel('owner', 'Owner', data.people.map((p) => [p.id, p.name]))}
      <label>Search <input type="search" data-reg-filter="q" value="${esc(f.q)}" placeholder="id, name, value, note"></label>
    </div>
    <div id="reg-table">${renderRegisterTable(ctx, f)}</div></section>`;
}

// ---------------- inbox ----------------
export function renderInbox(ctx: Ctx, person: string | null): string {
  const { data } = ctx;
  const picker = `<label>Who are you? <select data-inbox-person><option value="">choose…</option>${data.people.map((p) => `<option value="${esc(p.id)}" ${p.id === person ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <span class="small muted">No login; your choice is remembered on this browser only.</span>`;
  const p = data.people.find((x) => x.id === person);
  if (!p) return `<section class="card"><h1>Inbox</h1>${picker}</section>`;
  const inbox = data.derived.inbox[p.id];
  const stale = visible(ctx, data.register.filter((r) => inbox.stale_rows.includes(r.id)));
  const ifaces = data.interfaces.filter((i) => inbox.interfaces.includes(i.id));
  const staleHtml = stale.length
    ? `<ul class="plain">${stale.map((r) => `<li${trackAttr(r.track)}>${mark('recheck', 'stale')} ${rowLink(data, r.id)} ${esc(r.name)} <div class="small">${staleReason(data, r.id)}</div></li>`).join('')}</ul>${recheckBox(ctx, stale)}`
    : `<p>${mark('ok', 'nothing stale')} Nothing you own is stale.</p>`;
  const ifaceHtml = ifaces.length
    ? `<ul class="plain">${ifaces.map((i) => `<li>${ifaceMark(data.derived.interfaces[i.id].status)} <a class="id" href="#/interfaces?i=${esc(i.id)}">${esc(i.id)}</a> ${ifaceEnds(data, i.id)}: ${esc(i.what)} ${i.blocks ? `<span class="small warn">blocks ${esc(i.blocks)}</span>` : ''}</li>`).join('')}</ul>`
    : `<p>${mark('ok', 'all agreed')} All your interfaces are agreed.</p>`;
  let issuesHtml: string;
  if (ctx.issues === null) {
    issuesHtml = `<p class="muted small">GitHub issues could not be loaded (offline, private repo or rate limit). <a href="${esc(gh(data).issues)}" target="_blank" rel="noopener">Open issues on GitHub</a></p>`;
  } else if (!p.github) {
    issuesHtml = `<p class="muted small">${esc(p.name)} has no GitHub handle in data/people.yaml, so assigned issues can't be matched.</p>`;
  } else {
    const mine = ctx.issues.filter((i) => i.state === 'open' && i.assignees.some((a) => a.login.toLowerCase() === p.github.toLowerCase())
      && i.labels.some((l) => l.name === 'proposal' || l.name === 're-check'));
    issuesHtml = mine.length
      ? `<ul class="plain">${mine.map((i) => `<li><a href="${esc(i.html_url)}" target="_blank" rel="noopener">#${i.number}</a> ${esc(i.title)} <span class="small muted">${i.labels.map((l) => esc(l.name)).join(', ')}</span></li>`).join('')}</ul>`
      : `<p>${mark('ok', 'none')} No open proposal or re-check issues assigned to @${esc(p.github)}.</p>`;
  }
  return `<section class="card"><h1>Inbox: ${esc(p.name)}</h1><div>${picker}</div><p class="small muted">${esc(p.role)}</p></section>
    <section class="card"><h2>Stale rows you own <span class="muted small">${stale.length}</span></h2>${staleHtml}</section>
    <section class="card"><h2>Your interfaces not yet agreed <span class="muted small">${ifaces.length}</span></h2>${ifaceHtml}</section>
    <section class="card"><h2>GitHub issues for you <span class="muted small">labels proposal, re-check</span></h2>${issuesHtml}</section>`;
}
