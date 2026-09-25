import { icon } from '../icons.ts';
import { modelIds } from '../sandbox.ts';
import { PART_STATUSES, type Part, type RegisterRow } from '../types.ts';
import {
  type Ctx, cite, confidenceBar, editLink, esc, gh, historyFor, ifaceEnds, ifaceMark, mark, personLink,
  personName, rowLink, STATUS_LABEL, staleReason, superseded, tagChip, trackAttr, valueText, subsystemName,
} from './util.ts';

/** Latest time a row changed: last commit touching it, else its changed date. */
export function rowChangedAt(ctx: Ctx, row: RegisterRow): string {
  const c = ctx.history.find((h) => h.changes.some((x) => x.id === row.id));
  const d = `${row.changed}T00:00:00Z`;
  return c && c.date > d ? c.date : d;
}

export function changedSinceSeen(ctx: Ctx, row: RegisterRow): boolean {
  if (!ctx.lastSeen) return false;
  return Date.parse(rowChangedAt(ctx, row)) > Date.parse(ctx.lastSeen);
}

function ladder(p: Part): string {
  // five steps for core parts (07 §4); flight parts add flight-qualified
  const steps = p.track === 'flight' ? PART_STATUSES : PART_STATUSES.slice(0, 5);
  const at = PART_STATUSES.indexOf(p.status);
  return `<ol class="steps" title="${esc(p.status)}">${steps.map((s, i) =>
    `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><span>${esc(s)}</span></li>`).join('')}</ol>`;
}

function todayIso(now: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${z(now.getMonth() + 1)}-${z(now.getDate())}`;
}

export function recheckBox(ctx: Ctx, rows: RegisterRow[], label = 'Re-check'): string {
  const { data } = ctx;
  const today = todayIso(ctx.now);
  const list = rows.length
    ? rows.map((r) => `<li>${esc(r.id)} (line ${data.derived.rows[r.id].line ?? '?'}): set <code>checked: ${today}</code></li>`).join('')
    : '<li>For every row you re-checked: set <code>checked: ' + today + '</code></li>';
  const example = rows[0]?.id ?? 'ID';
  return `<details class="recheck"><summary class="btn">${esc(label)}</summary>
    <div class="recheck-body small">
      <p>Re-checking means you looked at the change upstream and your row still holds (the value may not change).</p>
      <ol><li>Open <code>data/register.yaml</code> in GitHub's editor: <a class="btn btn-small" href="${esc(gh(data).edit('data/register.yaml'))}" target="_blank" rel="noopener">Open editor</a></li>
      ${list}
      <li>If the value changed too, also set <code>changed: ${today}</code>.</li>
      <li>Commit to main with one line: <code>${esc(example)}: re-checked, no change · &lt;reason&gt; · &lt;your name&gt;</code></li></ol>
    </div></details>`;
}

function params(ctx: Ctx, rows: RegisterRow[]): string {
  const { data } = ctx;
  const body = rows.map((r) => {
    const d = data.derived.rows[r.id];
    const since = changedSinceSeen(ctx, r);
    return `<tr id="row-${esc(r.id)}" data-row="${esc(r.id)}"${trackAttr(r.track)} class="${since ? 'changed-since' : ''} ${d.stale ? 'is-stale' : ''}">
      <td>${rowLink(data, r.id)}${since ? ' <span class="badge">changed</span>' : ''}</td>
      <td>${esc(r.name)}${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}${r.conditions ? `<div class="small">conditions: ${esc(Object.entries(r.conditions).map(([k, v]) => `${k} ${v}`).join(', '))}</div>` : ''}</td>
      <td>${valueText(r.value, r.unit)}</td>
      <td>${tagChip(r.tag)}</td>
      <td>${d.stale ? `${mark('recheck', 'stale')}<div class="small">${staleReason(data, r.id)}</div>` : `${mark('ok', 'current')}<div class="small muted">checked <span class="num">${esc(r.checked)}</span></div>`}</td>
      <td>${personLink(data, r.owner)}</td>
      <td class="actions">${editLink(data, 'data/register.yaml', d.line)}
        <details class="hist"><summary class="btn btn-small">History</summary>${historyFor(ctx, r.id)}</details></td>
    </tr>`;
  }).join('');
  return `<table class="tbl"><thead><tr><th>ID</th><th>Parameter</th><th>Value</th><th>Tag</th><th>Stale?</th><th>Owner</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
}

function parts(ctx: Ctx, list: Part[]): string {
  const { data } = ctx;
  if (!list.length) return '<p class="muted">No parts in 02 map to this subsystem.</p>';
  const body = list.map((p) => {
    const tbd = p.fields.filter((f) => /^TBD/i.test(String(f.value)));
    return `<tr data-part="${esc(p.id)}"${trackAttr(p.track)}>
      <td class="id">${esc(p.id)}</td>
      <td><b>${esc(p.name)}</b> ${cite(p.cite)}<div class="small">${esc(p.role)}${superseded(data, p.superseded_by)}</div>
        ${p.gotchas ? `<div class="small muted">Gotchas: ${esc(p.gotchas)}</div>` : ''}
        ${p.downstream ? `<div class="small muted">Matters downstream: ${esc(p.downstream)}</div>` : ''}</td>
      <td>${p.chosen_part && p.chosen_part !== 'TBD' ? esc(p.chosen_part) : '<span class="tbd">TBD</span>'}</td>
      <td>${ladder(p)}</td>
      <td class="small">${tbd.length ? tbd.map((f) => `${esc(f.name)}: <span class="tbd">${esc(f.value)}</span>`).join('<br>') : '<span class="muted">none</span>'}</td>
      <td class="actions">${editLink(data, 'data/parts.yaml', data.lines.parts?.[p.id])}</td>
    </tr>`;
  }).join('');
  return `<table class="tbl"><thead><tr><th>ID</th><th>Part</th><th>Chosen</th><th>Status</th><th>TBD fields</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
}

function interfaces(ctx: Ctx, ids: string[]): string {
  const { data } = ctx;
  if (!ids.length) return '<p class="muted">No interfaces touch this subsystem.</p>';
  return `<ul class="plain">${ids.map((id) => {
    const i = data.interfaces.find((x) => x.id === id)!;
    const st = data.derived.interfaces[id].status;
    return `<li data-iface="${esc(id)}">${ifaceMark(st)} <a class="id" href="#/interfaces?i=${esc(id)}">${esc(id)}</a> ${ifaceEnds(data, id)}: ${esc(i.what)}
      <span class="muted small">· ${i.owners.map((o) => esc(personName(data, o))).join(', ')}${i.gap ? ` · gap: ${esc(i.gap)}` : ''}${i.blocks ? ` · blocks: ${esc(i.blocks)}` : ''}</span></li>`;
  }).join('')}</ul>`;
}

function openItems(ctx: Ctx, id: string): string {
  const { data } = ctx;
  const items = data.open_items.filter((o) => o.subsystem === id);
  if (!items.length) return '<p class="muted">No open items from 05 §3 map here.</p>';
  return `<table class="tbl"><thead><tr><th>#</th><th>Item</th><th>Why it matters</th><th>Closing action</th><th>Owner</th><th>Due</th><th>Issue</th></tr></thead><tbody>${items.map((o) => {
    const live = o.issue && ctx.issues ? ctx.issues.find((i) => i.number === o.issue) : null;
    const issue = o.issue
      ? `<a href="${esc(gh(data).issue(o.issue))}" target="_blank" rel="noopener">#${o.issue}</a>${live ? ` <span class="small">${esc(live.state)}</span>` : ''}`
      : '<span class="muted small">none</span>';
    return `<tr data-open-item="${o.n}"${trackAttr(o.track)}><td class="num">${o.n}</td><td>${esc(o.item)} ${cite(o.cite)}${superseded(data, o.superseded_by)}</td><td>${esc(o.why)}</td><td>${esc(o.closing_action)}</td>
      <td>${o.owners.map((x) => personLink(data, x)).join(', ')}</td><td>${esc(o.due)}</td><td>${issue}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function decisions(ctx: Ctx, id: string): string {
  const { data } = ctx;
  const list = data.decisions.filter((d) => d.subsystems.includes(id));
  if (!list.length) return '<p class="muted">No decisions in 05 §2 map here.</p>';
  return `<ul class="plain decisions">${list.map((d) => `<li data-decision><span class="num muted">${esc(d.date)}</span> · ${esc(d.area)} · <b>${esc(d.decision)}</b>${superseded(data, d.superseded_by)}
    <div class="small muted">${[['reason', d.reason], ['evidence', d.evidence], ['changes', d.changes], ['owner', d.owner]].filter(([, v]) => v).map(([k, v]) => `${k}: ${esc(v)}`).join(' · ')} ${cite(d.cite)}</div></li>`).join('')}</ul>`;
}

function approvals(ctx: Ctx, id: string): string {
  const list = ctx.data.approvals.filter((a) => a.subsystem === id);
  if (!list.length) return '';
  const label = { not_sent: 'not sent', sent: 'sent — not obtained', received: 'received' } as const;
  const shape = { not_sent: 'broken', sent: 'recheck', received: 'ok' } as const;
  return `<section class="card"><h2>Approvals <span class="muted small">never shown as obtained unless received</span></h2><ul class="plain">${list.map((a) =>
    `<li${trackAttr(a.track)}>${mark(shape[a.status], label[a.status])} <b>${esc(a.name)}</b> <span class="muted">(${esc(a.authority)})</span>${a.date ? ` <span class="num">${esc(a.date)}</span>` : ''} ${cite(a.cite)}<div class="small muted">${esc(a.note)}</div></li>`).join('')}</ul></section>`;
}

function links(ctx: Ctx, rows: RegisterRow[]): string {
  const { data } = ctx;
  const mine = new Set(rows.map((r) => r.id));
  const dependsOn = new Map<string, string[]>();
  const feedsInto = new Map<string, string[]>();
  for (const r of rows) {
    for (const u of data.derived.rows[r.id].upstream) if (!mine.has(u)) dependsOn.set(u, [...(dependsOn.get(u) ?? []), r.id]);
    for (const d of r.feeds_into) if (!mine.has(d)) feedsInto.set(d, [...(feedsInto.get(d) ?? []), r.id]);
  }
  const li = (m: Map<string, string[]>, verb: string) => m.size
    ? `<ul class="plain">${[...m.entries()].map(([id, via]) => {
      const row = data.register.find((r) => r.id === id);
      return `<li${trackAttr(row?.track)}>${rowLink(data, id)} ${esc(row?.name ?? '')} <span class="muted small">(${esc(subsystemName(data, row?.subsystem ?? ''))} · ${esc(personName(data, row?.owner ?? ''))}) ${verb} ${via.map(esc).join(', ')}</span></li>`;
    }).join('')}</ul>`
    : '<p class="muted">none</p>';
  return `<div class="cols"><div><h3>Depends on</h3>${li(dependsOn, 'feeds')}</div><div><h3>Feeds into</h3>${li(feedsInto, 'fed by')}</div></div>`;
}

export function renderSubsystem(ctx: Ctx, id: string): string {
  const { data } = ctx;
  const s = data.subsystems.find((x) => x.id === id);
  if (!s) return `<section class="card"><h1>Unknown subsystem "${esc(id)}"</h1><p><a href="#/">Back to the map</a></p></section>`;
  const d = data.derived.subsystems[id];
  const rows = data.register.filter((r) => r.subsystem === id);
  const partList = data.parts.filter((p) => p.subsystem === id);
  const stale = rows.filter((r) => data.derived.rows[r.id].stale);
  const inputs = modelIds(data).filter((mid) => rows.some((r) => r.id === mid));
  const sinceCount = rows.filter((r) => changedSinceSeen(ctx, r)).length;

  return `<article class="subsystem" data-subsystem-page="${esc(id)}">
  <section class="card head">
    <div class="head-row">${icon(s.icon, 44)}<div>
      <h1>${esc(s.name)}</h1>
      <div>Owner ${personLink(data, s.owner)} · ${mark(d.status, STATUS_LABEL[d.status])} · <span class="muted small">track ${esc(s.track)}</span></div>
      <div class="refs small">${s.doc_refs.map((r) => cite(r)).join(' ')} <span class="muted">register ids ${s.register_prefixes.map((p) => `${esc(p)}-*`).join(', ')}</span></div>
    </div></div>
    ${d.broken_reasons.length || d.recheck_reasons.length ? `<ul class="plain small reasons">${d.broken_reasons.map((r) => `<li>${mark('broken', 'broken')} ${esc(r)}</li>`).join('')}${d.recheck_reasons.map((r) => `<li>${mark('recheck', 're-check')} ${esc(r)}</li>`).join('')}</ul>` : ''}
    <div class="small ${sinceCount ? 'warn' : 'muted'}">${ctx.lastSeen
      ? `${sinceCount} row${sinceCount === 1 ? '' : 's'} changed since you last looked (${esc(ctx.lastSeen.slice(0, 16).replace('T', ' '))})`
      : 'First visit on this browser: rows changed after today will be highlighted next time.'}</div>
  </section>

  <section class="card">
    <h2>Start here</h2>
    <div class="intro">${s.intro.map((t) => `<p>${esc(t.text)} ${cite(t.cite)}${superseded(data, t.superseded_by)}</p>`).join('')}</div>
    <h3>Gotchas ${cite('01 §13')}</h3>
    <div class="gotchas">${s.gotchas.map((g) => `<span class="gotcha" data-gotcha="${g.n}"><b class="num">${g.n}</b> ${esc(g.text)}${superseded(data, g.superseded_by)}</span>`).join('')}</div>
  </section>

  <section class="card">
    <h2>Confidence <span class="muted small">${rows.length} register rows by tag</span></h2>
    ${confidenceBar(d.confidence)}
  </section>

  <section class="card">
    <div class="section-head"><h2>Parameters <span class="muted small">${rows.length} rows · ${stale.length} stale</span></h2>
      <div class="tools">${recheckBox(ctx, stale)}
      ${inputs.length ? `<a class="btn" href="#/sandbox?scope=${esc(id)}">Try a what-if</a>` : '<span class="muted small">no sandbox inputs here</span>'}</div></div>
    ${params(ctx, rows)}
  </section>

  <section class="card"><h2>Parts <span class="muted small">${partList.length} from 02</span></h2>${parts(ctx, partList)}</section>
  <section class="card"><h2>Interfaces</h2>${interfaces(ctx, d.interfaces)}</section>
  ${approvals(ctx, id)}
  <section class="card"><h2>Open items ${cite('05 §3')}</h2>${openItems(ctx, id)}</section>
  <section class="card"><h2>Decisions that shaped it ${cite('05 §2')}</h2>${decisions(ctx, id)}</section>
  <section class="card"><h2>Connections</h2>${links(ctx, rows)}</section>
</article>`;
}
