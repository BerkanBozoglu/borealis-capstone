// Weekly plan pages: #/week[/<n>], #/person/<id>, #/plan. Everything comes from
// data/plan.yaml, data/status/<monday>.yaml and derived.weekly.
import type { Person, PlanWeek, WeekCellDerived, WeekDerived, WorkStatus } from '../types.ts';
import {
  currentWeekIndex, daysText, fmtDay, localIso, nextPlanMilestone, sortedWeeks, teachText, weekPost, weekRange, DISCORD_LIMIT,
} from '../weekly.ts';
import { type Ctx, esc, gh } from './util.ts';

// ---------- status pill: filled circle = done, square = carried, diamond = blocked, empty circle = todo ----------
const PILL: Record<WorkStatus, string> = {
  done: '<circle cx="7" cy="7" r="5.5"/>',
  carried: '<rect x="1.8" y="1.8" width="10.4" height="10.4" rx="1"/>',
  blocked: '<path d="M7 .6 13.4 7 7 13.4 .6 7z"/>',
  todo: '<circle cx="7" cy="7" r="4.8" fill="none" stroke-width="1.6"/>',
};
export function statusPill(s: WorkStatus): string {
  return `<span class="wpill wpill-${s}" data-status="${s}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">${PILL[s]}</svg>${s}</span>`;
}

interface Week { w: PlanWeek; d: WeekDerived; i: number }
function weeksOf(ctx: Ctx): Week[] {
  const plan = sortedWeeks(ctx.data.plan);
  return plan.map((w, i) => ({ w, d: ctx.data.derived.weekly.weeks[i], i }));
}
const todayOf = (ctx: Ctx) => localIso(ctx.now);
const currentIdx = (ctx: Ctx, weeks: Week[]) => currentWeekIndex(weeks.map((x) => x.w), todayOf(ctx));

/** A person id or alias (e.g. berkan) → the person. */
export function findPerson(ctx: Ctx, id: string | null | undefined): Person | undefined {
  const k = String(id ?? '').toLowerCase();
  return ctx.data.people.find((p) => p.id === k || (p.aliases ?? []).includes(k));
}

function deliverableLink(ctx: Ctx, link: string): string {
  if (!link) return '';
  const href = /^https?:\/\//i.test(link) ? link : gh(ctx.data).blob(link.replace(/^\.?\//, ''));
  return `<a class="wk-link" href="${esc(href)}" target="_blank" rel="noopener" title="${esc(link)}">${esc(link.replace(/^https?:\/\/(www\.)?/i, ''))}</a>`;
}

function milestoneText(w: PlanWeek, d: WeekDerived): string[] {
  const names = [...(w.milestone ? [w.milestone] : []), ...d.milestones.filter((m) => !w.milestone.includes(m))];
  return names;
}

function tabs(ctx: Ctx, active: 'week' | 'plan' | 'person', person?: string): string {
  const people = ctx.data.people.map((p) =>
    `<a href="#/person/${esc(p.id)}" class="${active === 'person' && person === p.id ? 'on' : ''}">${esc(p.name)}</a>`).join('');
  return `<nav class="wk-tabs" aria-label="Weekly plan">
    <a href="#/week" class="${active === 'week' ? 'on' : ''}">This week</a>
    <a href="#/plan" class="${active === 'plan' ? 'on' : ''}">Whole plan</a>
    <span class="wk-tabs-people"><span class="muted small">Person:</span>${people}</span>
  </nav>`;
}

function placeholderNote(ctx: Ctx): string {
  if (!ctx.data.plan.placeholder) return '';
  return `<div class="wk-banner wk-banner-info">The plan text below is a placeholder: <code>seed/plan.json</code> is not in the repository yet.
    Upload it to the <code>seed/</code> folder on GitHub and the next build turns it into <code>data/plan.yaml</code>.</div>`;
}

function emptyPlan(ctx: Ctx, active: 'week' | 'plan' | 'person'): string {
  return `${tabs(ctx, active)}<section class="card"><h1>Weekly plan</h1><p class="muted">No weeks in <code>data/plan.yaml</code> yet.</p></section>`;
}

// ---------------- #/week ----------------
function strip(ctx: Ctx, weeks: Week[], sel: number, cur: number): string {
  const pips = weeks.map(({ w, d, i }) => {
    const ms = milestoneText(w, d);
    const cls = ['pip', `load-${w.load}`, d.is_break ? 'is-break' : '', d.milestones.length ? 'has-ms' : '', i === cur ? 'current' : '', i === sel ? 'sel' : ''].filter(Boolean).join(' ');
    const title = `Week ${w.n} · ${weekRange(w.mon)} · ${w.phase}${w.load !== 'full' ? ` · ${w.load} week` : ''}${ms.length ? ` · ${ms.join(' · ')}` : ''}${i === cur ? ' · this week' : ''}`;
    return `<li><a class="${cls}" href="#/week/${w.n}" title="${esc(title)}" aria-label="${esc(title)}"${i === sel ? ' aria-current="true"' : ''}>${w.n}</a></li>`;
  }).join('');
  return `<ol class="wk-strip">${pips}</ol>
    <div class="wk-legend small muted"><span><i class="pip-k is-break"></i>exam / break</span><span><i class="pip-k load-light"></i>light week</span><span><i class="pip-k has-ms"></i>fixed milestone</span><span><i class="pip-k current"></i>this week</span></div>`;
}

export function weekPostFor(ctx: Ctx, week: Week, ref: string) {
  const { w, d } = week;
  const m = nextPlanMilestone(ctx.data.plan.milestones, ref);
  return weekPost({
    n: w.n, mon: w.mon, milestone: m ? daysText(m) : null, brief: w.brief,
    lines: ctx.data.people.map((p) => ({ name: p.name, deliver: w.cells[p.id]?.deliver ?? '', carried: !!d.cells[p.id]?.carried_from })),
    url: `${ctx.baseUrl}#/week/${w.n}`,
  });
}

function statusButton(ctx: Ctx, d: WeekDerived, c: WeekCellDerived, today: string): string {
  if (!d.has_file) {
    return d.mon > today
      ? `<span class="btn btn-small disabled" aria-disabled="true">Update my status</span> <span class="muted small">opens ${esc(fmtDay(d.mon))}</span>`
      : '<span class="muted small">No status file for this week</span>';
  }
  if (d.new_file_text) {
    const url = `${gh(ctx.data).repo}/new/${ctx.data.site.repo.branch}?${new URLSearchParams({ filename: d.file, value: d.new_file_text })}`;
    return `<a class="btn btn-small" href="${esc(url)}" target="_blank" rel="noopener" title="This week's status file is not in the repository yet: this opens GitHub's new-file page with it filled in. Change your block, then Commit." data-wk-update>Update my status</a> <span class="muted small">creates this week's file</span>`;
  }
  const where = c.line ? `your block starts at line ${c.line}` : 'add your block';
  return `<a class="btn btn-small" href="${esc(gh(ctx.data).edit(d.file))}" target="_blank" rel="noopener" title="Opens ${esc(d.file)} in GitHub's web editor; ${esc(where)}" data-wk-update>Update my status</a> <span class="muted small">${esc(c.line ? `line ${c.line}` : '')}</span>`;
}

function card(ctx: Ctx, p: Person, w: PlanWeek, d: WeekDerived, today: string): string {
  const cell = w.cells[p.id] ?? { deliver: '', learn: '', ask: '' };
  const c = d.cells[p.id];
  const carried = c.carried_from
    ? `<div class="wk-carried"><b>Carried from week ${c.carried_from}</b>${c.carried_twice ? ' <span class="wk-flag">Re-plan with ' + esc(leadName(ctx)) + '</span>' : ''}
        <div class="small">${esc(c.carried_deliver) || '<span class="muted">(no deliver text)</span>'}</div></div>`
    : '';
  return `<article class="card wk-card wk-st-${c.status}" id="wk-p-${esc(p.id)}" data-person="${esc(p.id)}">
    <div class="wk-card-head"><div><a class="wk-name" href="#/person/${esc(p.id)}">${esc(p.name)}</a><div class="muted small">${esc(p.role)}</div></div>${statusPill(c.status)}</div>
    ${carried}
    <div class="wk-label">Deliver by the team meeting</div>
    <p class="wk-text">${esc(cell.deliver) || '<span class="muted">—</span>'}</p>
    <div class="wk-label">Learn / figure out</div>
    <p class="wk-text">${esc(cell.learn) || '<span class="muted">—</span>'}</p>
    ${c.link ? `<div class="wk-meta"><span class="wk-label">Link</span> ${deliverableLink(ctx, c.link)}</div>` : ''}
    ${c.note ? `<div class="wk-meta"><span class="wk-label">Note</span> ${esc(c.note)}</div>` : ''}
    ${cell.ask ? `<details class="wk-ask"><summary class="small">One-on-one question</summary><p class="small">${esc(cell.ask)}</p></details>` : ''}
    <div class="wk-card-foot">${statusButton(ctx, d, c, today)}</div>
  </article>`;
}

/** The person who re-plans (site.yaml weekly.lead, else the first person). */
function leadName(ctx: Ctx): string {
  const id = ctx.data.site.weekly?.lead;
  return ctx.data.people.find((p) => p.id === id)?.name ?? ctx.data.people[0]?.name ?? 'the lead';
}

export function renderWeek(ctx: Ctx, arg: string | null): string {
  const weeks = weeksOf(ctx);
  if (!weeks.length) return emptyPlan(ctx, 'week');
  const today = todayOf(ctx);
  const cur = currentIdx(ctx, weeks);
  const found = arg ? weeks.findIndex((x) => String(x.w.n) === arg) : cur;
  if (found < 0) return `${tabs(ctx, 'week')}<section class="card"><h1>No week ${esc(arg)}</h1><p><a href="#/week">Back to this week</a></p></section>`;
  const week = weeks[found];
  const { w, d } = week;
  const ref = found === cur && today >= w.mon ? today : w.mon;
  const m = nextPlanMilestone(ctx.data.plan.milestones, ref);
  const ms = milestoneText(w, d);
  const post = weekPostFor(ctx, week, ref);
  const prev = weeks[found - 1];
  const next = weeks[found + 1];
  const stale = d.stale
    ? `<div class="wk-banner wk-banner-warn" role="status">Week ${d.stale.week} not updated: ${d.stale.names.map(esc).join(', ')}</div>`
    : '';
  const chips = [
    `<span class="wk-chip wk-chip-phase">${esc(w.phase)}</span>`,
    ...ms.map((x) => `<span class="wk-chip wk-chip-ms">${esc(x)}</span>`),
    w.load !== 'full' ? `<span class="wk-chip wk-chip-load">${esc(w.load)} week</span>` : '',
    m ? `<span class="wk-chip wk-chip-count">${m.days > 0 ? `<b class="num">${m.days}</b> day${m.days === 1 ? '' : 's'} to ${esc(m.name)}` : esc(daysText(m))}</span>` : '',
    w.meeting ? `<span class="wk-chip">Team meeting ${esc(fmtDay(w.meeting))}</span>` : '',
  ].join('');
  const lineHint = d.line ? `; week ${w.n} starts at line ${d.line}` : '';
  const cards = ctx.data.people.map((p) => card(ctx, p, w, d, today)).join('');
  return `${tabs(ctx, 'week')}${placeholderNote(ctx)}
  <section class="card wk-strip-card">${strip(ctx, weeks, found, cur)}
    <div class="wk-nav">
      ${prev ? `<a class="btn" href="#/week/${prev.w.n}">← Prev</a>` : '<span class="btn disabled">← Prev</span>'}
      <a class="btn${found === cur ? ' disabled' : ''}" href="#/week">This week</a>
      ${next ? `<a class="btn" href="#/week/${next.w.n}">Next →</a>` : '<span class="btn disabled">Next →</span>'}
    </div>
  </section>
  ${stale}
  <section class="card wk-head" data-week="${w.n}">
    <div class="wk-head-main">
      <h1>Week <span class="num">${w.n}</span>${found === cur ? ' <span class="wk-now">this week</span>' : ''}</h1>
      <div class="wk-dates num">${esc(weekRange(w.mon))} <span class="muted">${esc(w.mon.slice(0, 4))}</span></div>
      <div class="wk-chips">${chips}</div>
    </div>
    <div class="wk-actions">
      <a class="btn" href="${esc(gh(ctx.data).edit('data/plan.yaml'))}" target="_blank" rel="noopener" title="Opens data/plan.yaml in GitHub's web editor${esc(lineHint)}">Edit this week</a>${d.line ? ` <span class="muted small">line ${d.line}</span>` : ''}
      <div class="wk-copy">
        <button class="btn btn-primary" type="button" data-wk-copy>Copy week post</button>
        <span class="small ${post.text.length > DISCORD_LIMIT ? 'bad' : 'muted'}" id="wk-count"><span class="num">${post.text.length}</span> / ${DISCORD_LIMIT} characters${post.shortened ? ' · shortened to first sentences' : ''}</span>
        <span class="small ok" id="wk-copied" hidden>Copied. Paste it into Discord.</span>
      </div>
      <textarea id="wk-post" class="wk-post" readonly hidden aria-label="Week post text">${esc(post.text)}</textarea>
    </div>
  </section>
  <section class="wk-team">
    <div class="card"><div class="wk-label">This week</div><p>${esc(w.brief) || '<span class="muted">—</span>'}</p></div>
    <div class="card"><div class="wk-label">Teach-back</div><p>${esc(teachText(w.teach)) || '<span class="muted">—</span>'}</p></div>
  </section>
  <ol class="wk-howto small" aria-label="How to update your status">
    <li>Press <b>Update my status</b> on your card and set <code>status:</code> to <code>done</code>, <code>carried</code> or <code>blocked</code>.</li>
    <li>Paste a <b>link</b> to the deliverable: a repo file, a Drive file or a screenshot. Links, never uploads.</li>
    <li>Optional one-line <code>note:</code>, then <b>Commit changes</b> as <code>&lt;name&gt;: &lt;status&gt; · &lt;short note&gt;</code>.</li>
  </ol>
  <section class="wk-cards">${cards}</section>`;
}

// ---------------- #/person/<id> ----------------
export function renderPerson(ctx: Ctx, id: string | null): string {
  const weeks = weeksOf(ctx);
  const p = findPerson(ctx, id);
  if (!p) return `${tabs(ctx, 'person')}<section class="card"><h1>Who?</h1><p>Pick a person: ${ctx.data.people.map((x) => `<a href="#/person/${esc(x.id)}">${esc(x.name)}</a>`).join(' · ')}</p></section>`;
  if (!weeks.length) return emptyPlan(ctx, 'person');
  const today = todayOf(ctx);
  const cur = currentIdx(ctx, weeks);
  const counts: Record<WorkStatus, number> = { done: 0, carried: 0, blocked: 0, todo: 0 };
  const rows = weeks.map(({ w, d, i }) => {
    const cell = w.cells[p.id] ?? { deliver: '', learn: '', ask: '' };
    const c = d.cells[p.id];
    if (d.has_file) counts[c.status]++;
    const st = d.has_file ? statusPill(c.status) : `<span class="muted small">${d.mon > today ? 'not started' : 'no record'}</span>`;
    const ms = milestoneText(w, d);
    return `<div class="wk-row${i === cur ? ' current' : ''}${d.is_break ? ' is-break' : ''}" id="row-wk-${w.n}" data-week="${w.n}">
      <div class="wk-row-week"><a href="#/week/${w.n}"><b>Week <span class="num">${w.n}</span></b></a><div class="small muted num">${esc(weekRange(w.mon))}</div>${i === cur ? '<span class="wk-now">this week</span>' : ''}</div>
      <div class="wk-row-ms small">${ms.length ? ms.map((x) => `<span class="wk-chip wk-chip-ms">${esc(x)}</span>`).join(' ') : `<span class="muted">${esc(w.phase)}</span>`}</div>
      <div class="wk-row-deliver">${esc(cell.deliver) || '<span class="muted">—</span>'}${c.carried_from ? `<div class="small warn">Carried from week ${c.carried_from}${c.carried_twice ? ` · re-plan with ${esc(leadName(ctx))}` : ''}</div>` : ''}</div>
      <div class="wk-row-status">${st}</div>
      <div class="wk-row-link small">${deliverableLink(ctx, c.link) || '<span class="muted">—</span>'}${c.note ? `<div class="muted">${esc(c.note)}</div>` : ''}</div>
    </div>`;
  }).join('');
  const summary = (Object.keys(counts) as WorkStatus[]).map((s) => `${statusPill(s)} <b class="num">${counts[s]}</b>`).join(' &nbsp; ');
  return `${tabs(ctx, 'person', p.id)}${placeholderNote(ctx)}
  <section class="card">
    <h1>${esc(p.name)} <span class="muted small">${esc(p.role)}</span></h1>
    <p class="small">${summary} <span class="muted">· weeks with a status file</span> &nbsp; <a href="#/person/${esc(p.id)}?row=wk-${weeks[cur].w.n}">Jump to this week</a></p>
    <p class="small muted">Every week of the plan with its status and link: the record of what ${esc(p.name)} delivered.</p>
    <div class="wk-hist" role="table" aria-label="${esc(p.name)}: every week">
      <div class="wk-row wk-row-headings" role="row"><div>Week</div><div>Milestone</div><div>Deliver</div><div>Status</div><div>Link</div></div>
      ${rows}
    </div>
  </section>`;
}

// ---------------- #/plan ----------------
export function renderPlan(ctx: Ctx): string {
  const weeks = weeksOf(ctx);
  if (!weeks.length) return emptyPlan(ctx, 'plan');
  const cur = currentIdx(ctx, weeks);
  const p = findPerson(ctx, ctx.query.get('person'));
  const options = [`<option value="">Everyone</option>`, ...ctx.data.people.map((x) => `<option value="${esc(x.id)}"${p?.id === x.id ? ' selected' : ''}>${esc(x.name)}</option>`)].join('');
  const head = p
    ? '<th>Deliver</th><th>Learn / figure out</th><th>One-on-one question</th><th>Status</th>'
    : ctx.data.people.map((x) => `<th><a href="#/person/${esc(x.id)}">${esc(x.name)}</a></th>`).join('');
  const rows = weeks.map(({ w, d, i }) => {
    const ms = milestoneText(w, d);
    const lead = `<td class="num"><a href="#/week/${w.n}">${w.n}</a></td><td class="num small wk-nowrap">${esc(weekRange(w.mon))}</td>
      <td class="small">${esc(w.phase)}${w.load !== 'full' ? ` <span class="muted">· ${esc(w.load)}</span>` : ''}</td><td class="small">${ms.map(esc).join('<br>')}</td>`;
    const cells = p
      ? (() => {
        const c = w.cells[p.id] ?? { deliver: '', learn: '', ask: '' };
        return `<td>${esc(c.deliver)}</td><td class="small">${esc(c.learn)}</td><td class="small muted">${esc(c.ask)}</td><td>${d.has_file ? statusPill(d.cells[p.id].status) : ''}</td>`;
      })()
      : ctx.data.people.map((x) => `<td class="small">${esc(w.cells[x.id]?.deliver ?? '')}</td>`).join('');
    return `<tr id="row-wk-${w.n}" class="${i === cur ? 'current' : ''}${d.is_break ? ' is-break' : ''}">${lead}${cells}</tr>`;
  }).join('');
  return `${tabs(ctx, 'plan')}${placeholderNote(ctx)}
  <section class="card">
    <div class="wk-plan-head"><h1>Whole plan</h1>
      <label class="small">Show <select data-plan-person>${options}</select></label>
      <a class="btn btn-small" href="${esc(gh(ctx.data).edit('data/plan.yaml'))}" target="_blank" rel="noopener" title="Opens data/plan.yaml in GitHub's web editor">Edit the plan</a>
    </div>
    <div class="wk-scroll"><table class="tbl wk-plan">
      <thead><tr><th>Wk</th><th>Dates</th><th>Phase</th><th>Milestone</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}
