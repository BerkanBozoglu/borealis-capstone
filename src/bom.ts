// Bill of materials in the Capstone Manual's column order. Pure: builds the
// lines and the CSV; the page renders them and the browser downloads the CSV.
// Never converts currencies and never fills a blank with a guess.
import { activeOption, choiceForPart } from './choices.ts';
import type { Choice, ChoiceOption, Part, SiteData } from './types.ts';

export const BOM_COLUMNS = [
  'Item #', 'Design reference', 'Description', 'Value', 'Quantity', 'Unit', 'Manufacturer',
  'Manufacturer P/N', 'Supplier', 'Supplier P/N', 'Unit cost', 'Extended cost', 'Comments',
] as const;

/** Fields a line needs before the BOM can be signed; blanks are flagged. */
export const REQUIRED = ['qty', 'manufacturer', 'mpn', 'supplier', 'unit_cost'] as const;

export interface BomLine {
  item: number; ref: string; description: string; value: string; qty: number | null; unit: string;
  manufacturer: string | null; mpn: string | null; supplier: string | null; supplier_pn: string | null;
  unit_cost: number | null; ext_cost: number | null; currency: string | null; comments: string;
  missing: (typeof REQUIRED)[number][]; proposed: boolean; subsystem: string; track: string;
}

export interface Bom {
  header: { team: string; project: string; subsystem: string; designed_by: string; revision: string; date: string };
  lines: BomLine[];
  totals: Record<string, number>;
  mixed: boolean;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function optionLine(c: Choice, o: ChoiceOption, parts: Part[], spare: boolean): Omit<BomLine, 'item'> {
  const refs = [...parts.map((p) => p.id), ...(spare ? ['spare'] : [])];
  const qty = o.qty ?? null;
  const unit = o.unit_price ?? null;
  const proposed = !c.decided;
  const base = {
    ref: refs.join(', '), description: `${c.title}: ${o.name}${o.chip ? ` (${o.chip})` : ''}`, value: '',
    qty: qty || null, unit: o.currency ?? '', manufacturer: o.manufacturer ?? null, mpn: o.mpn ?? null,
    supplier: o.supplier ?? null, supplier_pn: o.supplier_pn ?? null, unit_cost: unit,
    ext_cost: typeof unit === 'number' && qty ? round2(unit * qty) : null, currency: o.currency ?? null,
    comments: [proposed ? `PROPOSED: not decided (see choice ${c.id})` : `Decided: ${c.decided!.log_ref}`, o.price_source ? `price: ${o.price_source}${o.price_checked ? ` ${o.price_checked}` : ''}` : ''].filter(Boolean).join('; '),
    proposed, subsystem: parts[0]?.subsystem ?? '', track: parts.every((p) => p.track === 'flight') ? 'flight' : 'core',
  };
  return { ...base, missing: REQUIRED.filter((k) => base[k] === null || base[k] === '') };
}

function partLine(p: Part, c: Choice | undefined): Omit<BomLine, 'item'> {
  const unit = p.unit_cost ?? null;
  const qty = p.qty ?? null;
  const notes: string[] = [];
  if (c && !c.decided) notes.push(`OPEN: no option picked yet (see choice ${c.id})`);
  if (p.ece_stock === 'yes') notes.push('ECE stock');
  if (p.flag) notes.push(p.flag);
  const base = {
    ref: p.id, description: `${p.name}${p.model_line ? ` (${p.model_line})` : ''}`, value: '',
    qty, unit: p.currency ?? '', manufacturer: p.manufacturer ?? null, mpn: p.mpn ?? null,
    supplier: p.supplier ?? null, supplier_pn: p.supplier_pn ?? null, unit_cost: unit,
    ext_cost: typeof unit === 'number' && qty ? round2(unit * qty) : null, currency: p.currency ?? null,
    comments: notes.join('; '), proposed: false, subsystem: p.subsystem, track: p.track,
  };
  return { ...base, missing: REQUIRED.filter((k) => base[k] === null || base[k] === '') };
}

export function buildBom(data: SiteData, opts: { showFlight: boolean; subsystem?: string; date: string }): Bom {
  const include = (p: Part) => (p.track === 'flight' ? opts.showFlight : p.bom_include !== false)
    && (!opts.subsystem || p.subsystem === opts.subsystem);
  const parts = data.parts.filter(include);
  const lines: Omit<BomLine, 'item'>[] = [];
  const doneChoices = new Set<string>();
  for (const p of parts) {
    const c = choiceForPart(data.choices, p.id);
    const o = c ? activeOption(c) : undefined;
    if (c && o) {
      // one line per option (with the option's qty), not one per part
      if (doneChoices.has(c.id)) continue;
      doneChoices.add(c.id);
      const covered = parts.filter((x) => c.parts.includes(x.id) && x.track === 'core');
      const spare = (c.roles ?? []).some((r) => r.part_ref === null);
      if (covered.length) lines.push(optionLine(c, o, covered, spare));
      if (opts.showFlight) {
        const flightParts = parts.filter((x) => c.parts.includes(x.id) && x.track === 'flight');
        for (const later of c.options.filter((x) => x.status === 'later')) {
          if (flightParts.length) lines.push(optionLine(c, later, flightParts, false));
        }
      }
      continue;
    }
    lines.push(partLine(p, c));
  }
  const totals: Record<string, number> = {};
  for (const l of lines) if (l.ext_cost !== null && l.currency) totals[l.currency] = round2((totals[l.currency] ?? 0) + l.ext_cost);
  const b = data.site.bom;
  return {
    header: {
      team: b.team_name, project: b.project,
      subsystem: opts.subsystem ? (data.subsystems.find((s) => s.id === opts.subsystem)?.name ?? opts.subsystem) : 'All',
      designed_by: b.designed_by, revision: b.revision, date: opts.date,
    },
    lines: lines.map((l, i) => ({ ...l, item: i + 1 })),
    totals,
    mixed: Object.keys(totals).length > 1,
  };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function bomCsv(bom: Bom): string {
  const h = bom.header;
  const rows: unknown[][] = [
    ['Team', h.team], ['Project', h.project], ['Subsystem', h.subsystem],
    ['Designed by', h.designed_by], ['Revision', h.revision], ['Date', h.date], [],
    [...BOM_COLUMNS],
    ...bom.lines.map((l) => [l.item, l.ref, l.description, l.value, l.qty, l.unit, l.manufacturer, l.mpn, l.supplier,
      l.supplier_pn, l.unit_cost === null ? '' : l.unit_cost.toFixed(2), l.ext_cost === null ? '' : l.ext_cost.toFixed(2), l.comments]),
    [],
    ...Object.entries(bom.totals).map(([cur, t]) => ['', '', `Total ${cur} (priced lines only, before tax and shipping)`, '', '', cur, '', '', '', '', '', t.toFixed(2), '']),
    ...(bom.mixed ? [['', '', 'Mixed currencies: totals are not converted', '', '', '', '', '', '', '', '', '', '']] : []),
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
