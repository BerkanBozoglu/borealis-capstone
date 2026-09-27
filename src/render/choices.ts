// Open choices: the strip on the Hardware page and the decision panel.
import { activeOption, choiceForPart, daysTo, isOpenChoice, sortedOptions, stageFilled, STAGE_BAR } from '../choices.ts';
import type { Choice, ChoiceOption } from '../types.ts';
import { type Ctx, cite, esc, gh, ifaceMark, personName, statement } from './util.ts';

const STAGE_LABEL: Record<string, string> = { waiting: 'Waiting', exploring: 'Exploring', shortlisted: 'Shortlisted', proposed: 'Proposed', decided: 'Decided' };

export function stageBar(stage: string): string {
  const n = stageFilled(stage);
  return `<div class="stagebar stage-${esc(stage)}" role="img" aria-label="stage ${esc(stage)}">${STAGE_BAR.map((s, i) => `<span class="${i < n ? 'on' : ''}" title="${STAGE_LABEL[s]}"></span>`).join('')}</div>`;
}
export const stageChip = (stage: string) => `<span class="stagechip stagechip-${esc(stage)}">${esc(STAGE_LABEL[stage] ?? stage)}</span>`;

export function money(v: number | null | undefined, cur: string | null | undefined): string {
  if (typeof v !== 'number') return '';
  const pre = cur === 'USD' ? 'US$' : cur === 'CAD' ? 'CA$' : '';
  return `${pre}${v.toFixed(2)}${pre ? '' : ` ${cur ?? ''}`}`.trim();
}

function decideBy(c: Choice): string {
  return `${esc(c.decide_by.text)}${c.decide_by.date ? ` <span class="num">(${esc(c.decide_by.date)})</span>` : ''}`;
}

export function choiceCard(ctx: Ctx, c: Choice, selected: string | null): string {
  const lead = activeOption(c);
  const target = c.options.length ? `#/hardware/choice/${encodeURIComponent(c.id)}` : `#/hardware/${encodeURIComponent(c.parts[0])}`;
  const owner = `${esc(personName(ctx.data, c.owner))}${c.owner_status === 'proposed' ? ' (proposed)' : ''}`;
  return `<a class="choice-card ${selected === c.id ? 'sel' : ''}" href="${target}" data-choice="${esc(c.id)}">
    <div class="small"><span class="id">${c.parts.map(esc).join(' · ')}</span> ${stageChip(c.stage)}</div>
    <div class="choice-title">${esc(c.title)}</div>
    <div class="small muted">${lead ? `${c.decided ? 'Chosen' : 'Leading'}: ${esc(lead.name)}${c.decided ? '' : ' (proposed)'}` : esc(c.summary)}</div>
    ${stageBar(c.stage)}
    <div class="small muted">${owner} · by ${decideBy(c)}</div>
  </a>`;
}

export function choicesStrip(ctx: Ctx, selected: string | null): string {
  const list = ctx.data.choices;
  if (!list.length) return '';
  return `<section class="choices-strip"><div class="caps small muted">Open choices · narrowed down, not picked yet</div>
    <div class="choice-cards">${list.map((c) => choiceCard(ctx, c, selected)).join('')}</div></section>`;
}

function optionRow(o: ChoiceOption, considered: boolean): string {
  const price = typeof o.unit_price === 'number'
    ? `${money(o.unit_price, o.currency)} <span class="small muted">· ${esc(o.price_source ?? 'no source')} · ${o.price_checked ? `checked ${esc(o.price_checked)}` : '<span class="warn">no check date</span>'}</span>`
    : '<span class="muted small">no price</span>';
  return `<li class="opt opt-${esc(o.status)} ${considered ? 'considered' : ''}" data-option="${esc(o.name)}">
    <div><b class="${o.status === 'obsolete' ? 'struck' : ''}">${esc(o.name)}</b> <span class="optstatus optstatus-${esc(o.status)}">${esc(o.status)}</span>${o.qty ? ` <span class="small">× ${o.qty}</span>` : ''}</div>
    ${o.chip ? `<div class="small muted">${esc(o.chip)}${o.manufacturer ? ` · ${esc(o.manufacturer)}` : ''}${o.supplier ? ` · ${esc(o.supplier)}` : ''}</div>` : ''}
    <div class="small">${price}</div>
    ${o.notes ? `<div class="small muted">${esc(o.notes)}</div>` : ''}
  </li>`;
}

export function renderDecisionPanel(ctx: Ctx, c: Choice | undefined): string {
  const { data } = ctx;
  if (!c) return '<p class="muted">Unknown choice.</p>';
  const lead = activeOption(c);
  const inLog = !!c.decided;
  const roles = (c.roles ?? []).map((r) => `<li><b>${esc(r.name)}</b> × ${r.qty} ${r.part_ref
    ? `<a class="chip" href="#/hardware/${esc(r.part_ref)}">${esc(r.part_ref)}</a>`
    : '<span class="notin02">not in 02: needs a row</span>'}<div class="small muted">${esc(r.need)}</div></li>`).join('');
  const options = sortedOptions(c);
  const opts = c.decided
    ? `${lead ? `<ul class="plain">${optionRow(lead, false)}</ul>` : ''}<details class="considered-list"><summary class="small">Considered (${options.length - 1})</summary><ul class="plain">${options.filter((o) => o !== lead).map((o) => optionRow(o, true)).join('')}</ul></details>`
    : `<ul class="plain">${options.map((o) => optionRow(o, false)).join('')}</ul>`;
  const total = lead && typeof lead.unit_price === 'number' && lead.qty
    ? `<p class="small">${lead.qty} × ${money(lead.unit_price, lead.currency)} = <b>${money(lead.unit_price * lead.qty, lead.currency)}</b> before tax and shipping${c.decided ? '' : ' (proposed)'}</p>` : '';
  const blockers = c.blockers.map((b) => {
    const i = data.interfaces.find((x) => x.id === b);
    if (!i) return `<li><a href="#/register?id=${esc(b)}">${esc(b)}</a></li>`;
    return `<li>${ifaceMark(data.derived.interfaces[b].status)} <a class="id" href="#/interfaces?id=${esc(b)}">${esc(b)}</a> ${esc(i.what)} <span class="small muted">· ${i.owners.map((o) => esc(personName(data, o))).join(', ')}</span></li>`;
  }).join('');
  const issueUrl = gh(data).newIssue({ title: `Decision: ${c.title}`, body: c.decision_entry_draft ?? '', labels: 'decision' });
  return `<div class="decision" data-decision-panel="${esc(c.id)}">
    <div class="small muted"><span class="id">${c.parts.map(esc).join(' · ')}</span> ${stageChip(c.stage)} ${inLog ? `<span class="prov prov-DECIDED">in 05 · ${esc(c.decided!.log_ref)}</span>` : '<span class="prov prov-PROPOSED">Proposed · not in 05 yet</span>'}</div>
    <h2>${esc(c.title)}</h2>
    <div class="small muted">Owner ${esc(personName(data, c.owner))}${c.owner_status === 'proposed' ? ' (proposed)' : ''} · decide by ${decideBy(c)}${c.stage === 'waiting' && c.waiting_on ? ` · waiting on ${esc(c.waiting_on)}` : ''}</div>
    ${stageBar(c.stage)}
    <p>${esc(c.summary)}</p>
    ${roles ? `<h3 class="caps">Boards we need</h3><ul class="plain roles">${roles}</ul>` : ''}
    ${c.options.length ? `<h3 class="caps">Shortlist</h3>${opts}${total}` : ''}
    ${c.facts.length ? `<h3 class="caps">What's settled, and how sure we are</h3><ul class="plain facts-list">${c.facts.map((f) => `<li class="small">${statement(f)}</li>`).join('')}</ul>` : ''}
    ${blockers ? `<h3 class="caps">Blocking the final pick</h3><ul class="plain small">${blockers}</ul>` : ''}
    ${c.docs?.length ? `<h3 class="caps">Docs</h3><ul class="plain small">${c.docs.map((d) => `<li><span class="id">${esc(d.id)}</span> ${esc(d.title)}</li>`).join('')}</ul>` : ''}
    <div class="actions-row wrap">
      ${c.decision_entry_draft ? `<details class="draft"><summary class="btn">Draft the decision-log entry</summary><pre class="small">${esc(c.decision_entry_draft)}</pre><a class="btn btn-small" href="${esc(issueUrl)}" target="_blank" rel="noopener">Open as a GitHub issue (label decision)</a></details>` : ''}
      ${c.comparison_link ? `<a class="btn" href="${esc(c.comparison_link.url)}" target="_blank" rel="noopener" title="${esc(c.comparison_link.note)}">Full comparison + sources</a>` : ''}
    </div>
    ${c.comparison_link ? `<div class="small muted">${esc(c.comparison_link.note)}</div>` : ''}
    <div class="small">${cite('choices.yaml')} <a href="${esc(gh(data).edit('data/choices.yaml'))}" target="_blank" rel="noopener">Edit on GitHub</a></div>
  </div>`;
}

/** Box on a part's detail panel when the part is in an open choice. */
export function partChoiceBox(ctx: Ctx, partId: string): string {
  const c = choiceForPart(ctx.data.choices, partId);
  if (!c) return '';
  const href = c.options.length ? `#/hardware/choice/${esc(c.id)}` : `#/hardware/${esc(c.parts[0])}`;
  return `<a class="box box-choice" href="${href}"><b>${c.decided ? 'Decided choice' : 'Open choice'} · ${esc(STAGE_LABEL[c.stage] ?? c.stage)}</b><div>${esc(c.title)} — owner ${esc(personName(ctx.data, c.owner))}, decide by ${esc(c.decide_by.text)}</div></a>`;
}

/** List of choices touching a set of parts (subsystem pages, inbox). */
export function choiceList(ctx: Ctx, list: Choice[]): string {
  if (!list.length) return '<p class="muted small">None.</p>';
  return `<ul class="plain">${list.map((c) => {
    const d = daysTo(ctx.now, c.decide_by.date);
    return `<li>${stageChip(c.stage)} <a href="${c.options.length ? `#/hardware/choice/${esc(c.id)}` : `#/hardware/${esc(c.parts[0])}`}">${esc(c.title)}</a> <span class="small muted">· parts ${c.parts.map(esc).join(', ')} · ${esc(personName(ctx.data, c.owner))} · by ${esc(c.decide_by.text)}${d !== null ? ` (${d} days)` : ''}${isOpenChoice(c) ? '' : ' · decided'}</span></li>`;
  }).join('')}</ul>`;
}
