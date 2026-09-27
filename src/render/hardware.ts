// #/hardware and #/hardware/<part id>
import { firstNumber } from '../model.ts';
import type { Part } from '../types.ts';
import { BEAM_LABEL, SCHEMATIC_H, SCHEMATIC_SVG, SCHEMATIC_W } from './schematic.ts';
import { type Ctx, cite, esc, gh, subsystemName, trackAttr } from './util.ts';

export interface HardwareFilters { group: string; owner: string; flightOpen: boolean }

export const hardwareFilters = (q: URLSearchParams): HardwareFilters =>
  ({ group: q.get('group') ?? '', owner: q.get('owner') ?? '', flightOpen: q.get('flight') === '1' });

const owners = (p: Part) => String(p.owner_display ?? '').split('·').map((s) => s.trim()).filter(Boolean);

export function laneLabel(ctx: Ctx, availability: string | undefined): string {
  if (availability === 'flight') return 'Flight track';
  return ctx.data.site.hardware.lanes.find((l) => l.availability === availability)?.label ?? 'Not classified';
}

function groupOf(ctx: Ctx, p: Part) {
  return ctx.data.site.hardware.groups.find((g) => p.id.startsWith(g.letter));
}

function matches(ctx: Ctx, p: Part, f: HardwareFilters): boolean {
  if (f.group && groupOf(ctx, p)?.letter !== f.group) return false;
  if (f.owner && !owners(p).includes(f.owner)) return false;
  return true;
}

/** "660 nm beam · 60 mrad", read from the register. */
export function beamLabel(ctx: Ctx): string {
  const v = (id: string) => {
    const r = ctx.data.register.find((x) => x.id === id);
    return r ? (firstNumber(r.value) ?? r.value) : '?';
  };
  return `${v('TX-01')} nm beam · ${v('TX-06')} mrad`;
}

export function hardwareHash(id: string | null, f: HardwareFilters): string {
  const q = new URLSearchParams();
  if (f.group) q.set('group', f.group);
  if (f.owner) q.set('owner', f.owner);
  if (f.flightOpen) q.set('flight', '1');
  const s = q.toString();
  return `#/hardware${id ? `/${encodeURIComponent(id)}` : ''}${s ? `?${s}` : ''}`;
}

function hotspot(p: Part, selected: string, dim: boolean): string {
  const x = p.hotspot!.x!;
  const y = p.hotspot!.y!;
  return `<button class="hs hs-${esc(p.availability)} ${p.id === selected ? 'sel' : ''} ${dim ? 'dim' : ''}" style="left:${x - 16}px;top:${y - 16}px" data-hw-part="${esc(p.id)}" data-x="${x}" data-y="${y}" aria-label="${esc(`${p.id} ${p.name}`)}" title="${esc(`${p.id} ${p.name}`)}">${esc(p.id)}</button>`;
}

function benchButton(p: Part, selected: string, dim: boolean): string {
  return `<button class="hs-bench hs-${esc(p.availability)} ${p.id === selected ? 'sel' : ''} ${dim ? 'dim' : ''}" data-hw-part="${esc(p.id)}" aria-label="${esc(`${p.id} ${p.name}`)}"><b>${esc(p.id)}</b> ${esc(p.short ?? p.name)}</button>`;
}

function card(p: Part, selected: string): string {
  return `<button class="hw-card ${p.id === selected ? 'sel' : ''}" data-hw-part="${esc(p.id)}"${trackAttr(p.track)}>
    <div class="small muted"><span class="id">${esc(p.id)}</span> · ${esc(p.owner_display ?? '')}${p.flag ? ` <span class="flag">${esc(p.flag)}</span>` : ''}</div>
    <div class="hw-card-name">${esc(p.name)}</div>
    ${p.short ? `<div class="small muted">${esc(p.short)}</div>` : ''}
  </button>`;
}

function touchLink(ctx: Ctx, id: string): string {
  const isRow = ctx.data.register.some((r) => r.id === id);
  const href = isRow ? `#/register?id=${encodeURIComponent(id)}` : `#/interfaces?id=${encodeURIComponent(id)}`;
  const row = ctx.data.register.find((r) => r.id === id);
  const i = ctx.data.interfaces.find((x) => x.id === id);
  return `<a class="chip" href="${href}" title="${esc(row?.name ?? i?.what ?? '')}">${esc(id)}</a>`;
}

export function renderPartDetail(ctx: Ctx, p: Part | undefined): string {
  const { data } = ctx;
  if (!p) return '<p class="muted">Select a part on the schematic or in the lanes.</p>';
  const line = data.lines.parts?.[p.id];
  const edit = gh(data).edit('data/parts.yaml');
  const add = (label: string) => `<a class="add" href="${esc(edit)}" target="_blank" rel="noopener" title="Add ${label} in data/parts.yaml${line ? ` (line ${line})` : ''}">[add]</a>`;
  const val = (v: string | number | null | undefined, label: string, fmt?: (x: string | number) => string) =>
    v === null || v === undefined || v === '' ? add(label) : esc(fmt ? fmt(v) : v);
  const avail = p.availability ?? '';
  const group = groupOf(ctx, p);
  return `<div class="hw-detail-inner" data-detail="${esc(p.id)}">
    <div class="small muted"><span class="id">${esc(p.id)}</span> · ${cite(p.doc_ref ?? p.cite)} <span class="achip achip-${esc(avail)}">${esc(laneLabel(ctx, p.availability))}</span>${p.flag ? ` <span class="flag">${esc(p.flag)}</span>` : ''}</div>
    <h2>${esc(p.name)}</h2>
    ${p.model_line ? `<div class="mono small">${esc(p.model_line)}</div>` : ''}
    <div class="small muted">Owner ${esc(p.owner_display ?? '—')}${group ? ` · ${esc(group.label)}` : ''} · status ${esc(p.status)}</div>
    ${p.what_it_does ? `<p>${esc(p.what_it_does)}</p>` : `<p>${esc(p.role)}</p>`}
    ${p.blocked_reason ? `<div class="box box-bad"><b>Why we can't use it as-is</b><div>${esc(p.blocked_reason)}</div></div>` : ''}
    ${p.class2_note ? `<div class="box box-warn"><b>Class 2 change (Sep 24)</b><div>${esc(p.class2_note)}</div></div>` : ''}
    ${p.need_to_know?.length ? `<h3 class="caps">Need to know</h3><ul class="ntk">${p.need_to_know.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${p.touches?.length ? `<h3 class="caps">Changing it touches</h3><div class="chips">${p.touches.map((t) => touchLink(ctx, t)).join('')}</div>` : ''}
    <div class="facts">
      <div><div class="small muted">Source</div>${val(p.source, 'source')}</div>
      <div><div class="small muted">Est. cost</div>${val(p.est_cost_cad, 'est_cost_cad', (x) => `$${x} CAD`)}</div>
      <div><div class="small muted">Lead time</div>${val(p.lead_time, 'lead_time')}</div>
      <div><div class="small muted">Datasheet</div>${p.datasheet_url ? `<a href="${esc(p.datasheet_url)}" target="_blank" rel="noopener">open</a>` : add('datasheet_url')}</div>
    </div>
    <div class="actions-row wrap">
      <a class="btn" href="${esc(edit)}" target="_blank" rel="noopener" title="data/parts.yaml${line ? ` line ${line}` : ''}">Edit on GitHub</a>
      <a class="btn" href="#/s/${esc(p.subsystem)}">${esc(subsystemName(data, p.subsystem))} page</a>
      <a class="btn" href="${esc(data.site.project_assistant_url)}" target="_blank" rel="noopener">Ask the project assistant</a>
    </div>
  </div>`;
}

export function renderHardware(ctx: Ctx, selectedId: string | null): string {
  const { data } = ctx;
  const f = hardwareFilters(ctx.query);
  const hw = data.derived.hardware;
  const core = data.parts.filter((p) => p.track === 'core' && p.availability && p.availability !== 'flight');
  const flight = data.parts.filter((p) => p.availability === 'flight');
  const unclassified = data.parts.filter((p) => !p.availability);
  const firstBlocked = core.find((p) => p.availability === 'blocked');
  const selected = data.parts.find((p) => p.id === selectedId) ?? firstBlocked;
  const sel = selected?.id ?? '';
  const c = data.constraints;

  const tiles = data.site.hardware.lanes.map((l) =>
    `<div class="tile"><div class="tile-label">${esc(l.label)}</div><div class="tile-value num lane-${esc(l.availability)}">${hw.lanes[l.availability] ?? 0}</div></div>`).join('');
  const pct = hw.budget_cad ? Math.min(100, (hw.priced_total_cad / hw.budget_cad) * 100) : 0;
  const budget = `<div class="tile"><div class="tile-label">Budget ~$${esc(hw.budget_cad)} CAD ${cite(c.source)}</div>
    <div class="tile-value num ${hw.priced_total_cad > hw.budget_cad ? 'bad' : ''}">$${esc(hw.priced_total_cad)}</div>
    <div class="budget-bar" role="img" aria-label="priced total ${hw.priced_total_cad} of ${hw.budget_cad} CAD"><span style="width:${pct}%"></span></div>
    <div class="small muted">${hw.priced} of ${hw.to_price} priced</div></div>`;

  const groupPills = [{ letter: '', label: 'All parts' }, ...data.site.hardware.groups].map((g) =>
    `<a class="pill ${f.group === g.letter ? 'active' : ''}" href="${esc(hardwareHash(selectedId, { ...f, group: g.letter }))}">${esc(g.label)}</a>`).join('');
  const ownerList = [...new Set(core.flatMap(owners))];
  const ownerChips = ownerList.map((o) =>
    `<a class="pill pill-small ${f.owner === o ? 'active' : ''}" href="${esc(hardwareHash(selectedId, { ...f, owner: f.owner === o ? '' : o }))}">${esc(o)}</a>`).join('');

  const station = core.filter((p) => p.hotspot?.view === 'station');
  const bench = core.filter((p) => p.hotspot?.view === 'bench');
  const svg = SCHEMATIC_SVG.replace(BEAM_LABEL, esc(beamLabel(ctx)));

  const lanes = data.site.hardware.lanes.map((l) => {
    const list = core.filter((p) => p.availability === l.availability);
    const shown = list.filter((p) => matches(ctx, p, f));
    return `<div class="lane lane-col-${esc(l.availability)}"><h3>${esc(l.label)} <span class="muted num">${list.length}</span></h3>${shown.map((p) => card(p, sel)).join('') || '<p class="muted small">none match</p>'}</div>`;
  }).join('');

  const rules = [
    ...c.procurement_rules.map((r) => `<li>${esc(r)}</li>`),
    `<li>Department has: ${esc(c.department_has.join(', '))}. Lacks: ${esc(c.department_lacks.join('; '))}.</li>`,
    `<li>Class 2 baseline: ${esc(c.class2.wavelength_nm)} nm, ≤${esc(c.class2.max_power_mw)} mW. ${esc(c.class2.note)}.</li>`,
  ].join('');

  return `<section class="card hw-top">
    <a href="#/" class="small">← Map</a>
    <div class="section-head"><div><h1>Hardware</h1><p class="muted">Every physical part, where it sits, and whether we can actually use it.</p></div>
      <button class="btn search-btn" data-open-search>Search parts, numbers, docs… <kbd>/</kbd></button></div>
    <div class="tiles tiles-5">${tiles}${budget}</div>
    <ul class="small rules-list">${rules}</ul><div class="small muted">${cite(c.source)}</div>
    <div class="filters-row"><div class="pills">${groupPills}</div><div class="pills"><span class="small muted">Owner</span>${ownerChips}</div></div>
  </section>
  <div class="hw-grid">
    <div class="hw-left">
      <section class="card schematic-card">
        <div class="schematic-scroll"><div class="schematic" style="width:${SCHEMATIC_W}px;height:${SCHEMATIC_H}px">${svg}
          ${station.map((p) => hotspot(p, sel, !matches(ctx, p, f))).join('')}</div></div>
        <div class="bench-row"><span class="caps small muted">Test bench</span>${bench.map((p) => benchButton(p, sel, !matches(ctx, p, f))).join('')}</div>
        <div class="legend small"><span><i class="ring ring-available"></i>can use now</span><span><i class="ring ring-candidate"></i>want to use</span><span><i class="ring ring-choosing"></i>still choosing</span><span><i class="ring ring-blocked"></i>can't use as-is</span></div>
      </section>
      <section class="lanes">${lanes}</section>
      ${unclassified.length ? `<p class="small muted">Not on this view yet (no availability in parts.yaml): ${unclassified.map((p) => `<a href="#/s/${esc(p.subsystem)}">${esc(p.id)}</a> ${esc(p.name)}`).join(' · ')}</p>` : ''}
      <section class="card flight-card" data-track="flight">
        <div class="section-head"><div><b>Flight track</b> · ${flight.length} parts · ${esc(data.site.hardware.flight_note)}</div>
          <a class="btn btn-small" href="${esc(hardwareHash(selectedId, { ...f, flightOpen: !f.flightOpen }))}">${f.flightOpen ? 'Hide' : 'Show'}</a></div>
        ${f.flightOpen ? `<div class="flight-list">${flight.map((p) => card(p, sel)).join('')}</div>` : ''}
      </section>
    </div>
    <aside class="card hw-detail" id="hw-detail">${renderPartDetail(ctx, selected)}</aside>
  </div>`;
}

