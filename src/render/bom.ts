// #/bom — the BOM in the Capstone Manual's column order, with CSV export.
import { BOM_COLUMNS, buildBom, type Bom } from '../bom.ts';
import { money } from './choices.ts';
import { type Ctx, cite, esc } from './util.ts';

export function bomFor(ctx: Ctx): Bom {
  const d = ctx.now;
  const z = (n: number) => String(n).padStart(2, '0');
  return buildBom(ctx.data, { showFlight: ctx.showFlight, subsystem: ctx.query.get('subsystem') ?? undefined, date: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` });
}

export function renderBom(ctx: Ctx): string {
  const bom = bomFor(ctx);
  const h = bom.header;
  const cell = (v: unknown, missing: boolean) => missing ? '<td class="missing" title="required, not filled in">—</td>' : `<td>${esc(v ?? '')}</td>`;
  const rows = bom.lines.map((l) => `<tr data-bom-line="${esc(l.ref)}" class="${l.proposed ? 'proposed' : ''}">
    <td class="num">${l.item}</td><td class="id">${esc(l.ref)}</td><td>${esc(l.description)}</td><td>${esc(l.value)}</td>
    ${cell(l.qty, l.missing.includes('qty'))}<td>${esc(l.unit)}</td>
    ${cell(l.manufacturer, l.missing.includes('manufacturer'))}${cell(l.mpn, l.missing.includes('mpn'))}
    ${cell(l.supplier, l.missing.includes('supplier'))}<td>${esc(l.supplier_pn ?? '')}</td>
    ${l.missing.includes('unit_cost') ? '<td class="missing">—</td>' : `<td class="num">${esc(money(l.unit_cost, l.currency))}</td>`}
    <td class="num">${esc(money(l.ext_cost, l.currency))}</td>
    <td class="small">${l.proposed ? '<span class="prov prov-PROPOSED">PROPOSED</span> ' : ''}${esc(l.comments)}</td></tr>`).join('');
  const blanks = bom.lines.filter((l) => l.missing.length).length;
  const subs = ctx.data.subsystems.map((s) => `<option value="${esc(s.id)}" ${ctx.query.get('subsystem') === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const hdr = (k: string, v: string) => `<div><span class="muted">${k}</span> ${v ? esc(v) : '<span class="missing-inline">not set (data/site.yaml)</span>'}</div>`;
  return `<section class="card"><div class="section-head"><div><h1>Bill of materials</h1>
    <p class="small muted">Capstone Manual column order. Parts in an undecided choice use its leading option, marked PROPOSED. Blanks are never guessed: they export blank and show amber here. Currencies are never converted. ${cite(ctx.data.constraints.procurement_source)}</p></div>
    <div class="tools"><label class="small">Subsystem <select data-bom-subsystem><option value="">All</option>${subs}</select></label><button class="btn btn-primary" data-bom-export>Export BOM (CSV)</button></div></div>
    <div class="bom-header small">${hdr('Team', h.team)}${hdr('Project', h.project)}${hdr('Subsystem', h.subsystem)}${hdr('Designed by', h.designed_by)}${hdr('Revision', h.revision)}${hdr('Date', h.date)}</div>
    <p class="small">${bom.lines.length} lines · <span class="warn">${blanks} with required fields missing</span>${ctx.showFlight ? ' · flight parts included' : ' · flight parts excluded (toggle "show flight track" to include)'}</p>
    <div class="scroll"><table class="tbl bom"><thead><tr>${BOM_COLUMNS.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="bom-totals">${Object.entries(bom.totals).map(([cur, t]) => `<div>Total ${esc(cur)} <b class="num">${esc(money(t, cur))}</b> <span class="small muted">priced lines only, before tax and shipping</span></div>`).join('') || '<div class="muted">No priced lines yet.</div>'}
    ${bom.mixed ? '<div class="warn">Mixed currencies: USD and CAD are totalled separately, never converted.</div>' : ''}</div>
  </section>`;
}
