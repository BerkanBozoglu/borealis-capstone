import { icon } from '../icons.ts';
import { baselinePreset, presetValues, runModel } from '../sandbox.ts';
import type { Finding, Interface } from '../types.ts';
import {
  type Ctx, cite, confidenceBar, esc, gh, ifaceMark, inline, mark, modeled, num, personName, rowLink,
  STATUS_LABEL, subsystemName, trackAttr, visible, daysUntil,
} from './util.ts';

export function nextMilestone(ctx: Ctx) {
  const upcoming = ctx.data.milestones.dates
    .map((m) => ({ ...m, days: daysUntil(ctx.now, m.date) }))
    .filter((m) => m.days >= (m.week_of ? -6 : 0))
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

export function renderCountdown(ctx: Ctx): string {
  const m = nextMilestone(ctx);
  if (!m) return '<span class="muted">No upcoming milestones</span>';
  const when = m.days > 0 ? `in <b class="num">${m.days}</b> day${m.days === 1 ? '' : 's'}` : m.days === 0 ? '<b>today</b>' : '<b>this week</b>';
  return `<span class="countdown" title="${esc(m.cite)}">${esc(m.name)} ${when} <span class="muted num">(${m.week_of ? 'week of ' : ''}${esc(m.date)})</span></span>`;
}

function block(ctx: Ctx, id: string): string {
  const { data } = ctx;
  const s = data.subsystems.find((x) => x.id === id);
  if (!s) return '';
  const d = data.derived.subsystems[id];
  const rows = visible(ctx, data.register.filter((r) => r.subsystem === id));
  const stale = rows.filter((r) => data.derived.rows[r.id].stale).length;
  const parts = visible(ctx, data.parts.filter((p) => p.subsystem === id)).length;
  return `<a class="block status-${d.status}" href="#/s/${esc(id)}" data-subsystem="${esc(id)}"${trackAttr(s.track)}>
    <div class="block-head">${icon(s.icon)}<div><div class="block-name">${esc(s.name)}</div><div class="muted small">${esc(personName(data, s.owner))}</div></div></div>
    <div class="block-status">${mark(d.status, STATUS_LABEL[d.status])}</div>
    <div class="small muted">${rows.length} rows · ${stale} stale · ${parts} parts</div>
    ${confidenceBar(d.confidence, false)}
  </a>`;
}

const between = (i: Interface, a: string, b: string, toList: string[]) =>
  (i.from === a && toList.includes(b)) || (i.from === b && toList.includes(a));

function ifaceChip(ctx: Ctx, id: string): string {
  const st = ctx.data.derived.interfaces[id].status;
  return `<a class="ichip ichip-${st}" href="#/interfaces?i=${esc(id)}" title="${esc(ctx.data.interfaces.find((i) => i.id === id)?.what ?? '')}">${ifaceMark(st)}<span class="id">${esc(id)}</span></a>`;
}

function tiles(ctx: Ctx): string {
  const { data } = ctx;
  const committed = runModel(data, presetValues(data, 'committed'));
  const base = baselinePreset(data);
  const baseOut = base ? runModel(data, presetValues(data, base.id)) : null;
  const rows = visible(ctx, data.register);
  const stale = rows.filter((r) => data.derived.rows[r.id].stale).length;
  const ifaces = data.interfaces;
  const agreed = ifaces.filter((i) => data.derived.interfaces[i.id].status === 'agreed').length;
  const measured = rows.filter((r) => r.tag === 'MEASURED').length;
  const openIssues = ctx.issues ? ctx.issues.filter((i) => i.state === 'open').length : null;
  const m = committed.c1.margin_db;
  const cls = m < 0 ? 'bad' : m < Number(data.model.constants.marginOk_db.value) ? 'warn' : 'ok';
  const marginRow = data.model.outputs.c1_margin;
  return `<section class="tiles">
    <a class="tile" href="#/sandbox">
      <div class="tile-label">C1 margin, committed ${modeled()}</div>
      <div class="tile-value ${cls} num">${num(m, 1, true)} dB</div>
      ${baseOut ? `<div class="small muted"><s class="num">${num(baseOut.c1.margin_db, 1, true)} dB</s> ${esc(base!.name)}</div>` : ''}
      <div class="small muted">register ${esc(marginRow)}</div>
    </a>
    <a class="tile" href="#/register?status=stale">
      <div class="tile-label">Stale rows</div>
      <div class="tile-value ${stale ? 'warn' : 'ok'} num">${stale}</div>
      <div class="small muted">of ${rows.length} register rows</div>
    </a>
    <a class="tile" href="#/interfaces">
      <div class="tile-label">Interfaces agreed</div>
      <div class="tile-value ${agreed === ifaces.length ? 'ok' : 'warn'} num">${agreed}/${ifaces.length}</div>
      <div class="small muted">${ifaces.filter((i) => data.derived.interfaces[i.id].status === 'missing').length} missing</div>
    </a>
    <a class="tile" href="#/register?tag=MEASURED">
      <div class="tile-label">Measured rows</div>
      <div class="tile-value num">${measured}</div>
      <div class="small muted">of ${rows.length}; the rest are models, targets and assumptions</div>
    </a>
    <a class="tile" href="${esc(gh(data).issues)}" target="_blank" rel="noopener">
      <div class="tile-label">Open issues</div>
      <div class="tile-value num">${openIssues ?? '—'}</div>
      <div class="small muted">${openIssues === null ? `GitHub not reachable; ${visible(ctx, data.open_items).length} open items in 05 §3` : 'on GitHub, live'}</div>
    </a>
  </section>`;
}

function ladder(ctx: Ctx): string {
  const { data } = ctx;
  const rungs = visible(ctx, data.milestones.rungs);
  const current = rungs.find((r) => r.status !== 'passed');
  const steps = rungs.map((r) => {
    const st = r.status === 'passed' ? 'ok' : r === current ? (r.blocked_by.length ? 'broken' : 'recheck') : null;
    return `<li class="rung ${r === current ? 'current' : ''} rung-${r.status}"${trackAttr(r.track)} title="${esc(r.cite)}">
      <span class="rung-n num">${r.n}</span><span>${esc(r.name)}</span>${st ? mark(st, r.status === 'passed' ? 'passed' : r.status.replace('_', ' ')) : `<span class="muted small">${esc(r.status.replace('_', ' '))}</span>`}
    </li>`;
  }).join('');
  let blockers = '';
  if (current) {
    const items = current.blocked_by.map((id) => {
      const row = data.register.find((r) => r.id === id);
      if (row) {
        const d = data.derived.rows[id];
        return `<li>${rowLink(data, id)} ${esc(row.name)}: <span class="num">${esc(row.value)}</span> ${esc(row.unit === '-' ? '' : row.unit)} ${d.stale ? mark('recheck', 'stale') : ''} <span class="muted">· ${esc(personName(data, row.owner))}</span></li>`;
      }
      const i = data.interfaces.find((x) => x.id === id);
      return i ? `<li>${ifaceChip(ctx, id)} ${esc(i.what)}</li>` : `<li>${esc(id)}</li>`;
    }).join('');
    blockers = `<div class="small"><b>Rung ${current.n} (${esc(current.name)})</b> ${current.blocked_by.length ? `is blocked by:<ul class="plain">${items}</ul>` : 'has no recorded blockers.'} ${cite(current.cite)}</div>`;
  }
  return `<section class="card"><h2>Test ladder <span class="muted small">never skip a rung</span></h2><ol class="ladder">${steps}</ol>${blockers}</section>`;
}

function flow(ctx: Ctx): string {
  const { data } = ctx;
  const path = data.site.map.data_path;
  const used = new Set<string>();
  let row = '';
  path.forEach((id, k) => {
    row += block(ctx, id);
    const next = path[k + 1];
    if (next) {
      const chips = data.interfaces.filter((i) => between(i, id, next, data.derived.interfaces[i.id].to_list));
      chips.forEach((i) => used.add(i.id));
      row += `<div class="link-col">${chips.map((i) => ifaceChip(ctx, i.id)).join('') || '<span class="muted small">no interface</span>'}<div class="arrow">→</div></div>`;
    }
  });
  const others = data.interfaces.filter((i) => !used.has(i.id));
  const support = data.site.map.support_row.map((id) => block(ctx, id)).join('');
  const flight = data.site.map.flight_row.map((id) => block(ctx, id)).join('');
  return `<section class="card">
    <h2>Data path</h2>
    <div class="flow">${row}</div>
    <h2>Support</h2>
    <div class="support">${support}</div>
    <div class="support" data-track="flight"><h2 class="w100">Extended track</h2>${flight}</div>
    <div class="other-ifaces small"><span class="muted">Other interfaces:</span> ${others.map((i) => `${ifaceChip(ctx, i.id)} <span class="muted">${esc(subsystemName(data, i.from))} → ${esc(data.derived.interfaces[i.id].to_list.map((t) => subsystemName(data, t)).join(', '))}</span>`).join(' · ')}</div>
  </section>`;
}

function recent(ctx: Ctx): string {
  const { data } = ctx;
  const commits = ctx.history.slice(0, data.site.recent_commits);
  if (!commits.length) return '<section class="card"><h2>Recent changes</h2><p class="muted">No history for data/register.yaml yet.</p></section>';
  const items = commits.map((c) => {
    const ids = c.changes.map((x) => x.id);
    const summary = ids.length > 6 ? `${ids.length} rows` : ids.join(', ');
    return `<li><button class="commit" data-commit="${esc(c.sha)}" data-subsystems="${esc(c.subsystems.join(' '))}" title="Highlight the subsystems this commit touches">
      <span class="num muted">${esc(c.date.slice(0, 10))}</span> <b>${esc(c.author)}</b> ${esc(c.subject)} <span class="muted small">(${esc(summary)})</span></button></li>`;
  }).join('');
  return `<section class="card"><h2>Recent changes <span class="muted small">data/register.yaml · click to highlight</span></h2><ul class="plain commits">${items}</ul></section>`;
}

export function renderFindings(ctx: Ctx, findings: Finding[]): string {
  if (!findings.length) return `<p class="ok">${mark('ok', 'all checks pass')}</p>`;
  const vis = findings.filter((f) => ctx.showFlight || !f.ids.every((id) => ctx.data.register.find((r) => r.id === id)?.track === 'flight') || !f.ids.length);
  return `<ul class="plain findings">${vis.map((f) => `<li class="finding-${f.level}">${mark(f.level === 'error' ? 'broken' : 'recheck', f.level)} ${esc(f.message)} ${f.ids.length ? `<span class="small">${f.ids.map((id) => rowLink(ctx.data, id)).join(' ')}</span>` : ''}</li>`).join('')}</ul>`;
}

function health(ctx: Ctx): string {
  const f = ctx.data.derived.findings;
  return `<section class="card"><h2>Health checks <span class="muted small">${f.filter((x) => x.level === 'error').length} errors · ${f.filter((x) => x.level === 'warning').length} warnings · built ${esc(ctx.data.built_at.slice(0, 16).replace('T', ' '))} UTC</span></h2>${renderFindings(ctx, f)}</section>`;
}

function workflow(ctx: Ctx): string {
  const rules = ctx.data.site.workflow_rules.map((r) => `<li><b>${esc(r.title)}</b> ${inline(r.text)}</li>`).join('');
  return `<section class="card"><h2>How changes happen here ${cite(ctx.data.site.workflow_cite)}</h2><ol class="rules">${rules}</ol></section>`;
}

export function renderMap(ctx: Ctx): string {
  return `${tiles(ctx)}${ladder(ctx)}${flow(ctx)}<div class="cols">${recent(ctx)}${health(ctx)}</div>${workflow(ctx)}`;
}
