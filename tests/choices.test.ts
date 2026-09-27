import { describe, expect, it } from 'vitest';
import { buildSiteData } from '../scripts/lib/derive.ts';
import { renderHardware } from '../src/render/hardware.ts';
import { renderMap } from '../src/render/map.ts';
import { renderInbox } from '../src/render/tables.ts';
import { renderSubsystem } from '../src/render/subsystem.ts';
import { renderBom } from '../src/render/bom.ts';
import { statement, type Ctx } from '../src/render/util.ts';
import { partView } from '../src/choices.ts';
import { BOM_COLUMNS, bomCsv, buildBom } from '../src/bom.ts';
import { search } from '../src/search.ts';
import { TODAY, buildSearch, clone, loadRawData, loadSite } from './helpers.ts';

const ctxFor = (data = loadSite(), query = '', opts: Partial<Ctx> = {}): Ctx => ({
  data, history: [], showFlight: false, now: new Date(`${TODAY}T12:00:00`), issues: null, lastSeen: null,
  query: new URLSearchParams(query), baseUrl: 'https://example.test/', ...opts,
});
const findings = (raw = loadRawData(), today = TODAY) => buildSiteData(raw, today).derived.findings;

describe('choices.yaml', () => {
  const data = loadSite();
  it('has the five seeded choices', () => {
    expect(data.choices.map((c) => [c.id, c.stage])).toEqual([
      ['mcu', 'proposed'], ['diode', 'exploring'], ['filter', 'waiting'], ['ota', 'exploring'], ['meter', 'exploring']]);
  });
  it('mcu matches the seed', () => {
    const mcu = data.choices[0];
    expect(mcu.parts).toEqual(['A7', 'B5', 'E1']);
    expect(mcu.options.map((o) => `${o.name}:${o.status}`)).toEqual([
      'NUCLEO-H753ZI:leading', 'WeAct MiniSTM32H743:later', 'NUCLEO-H7A3ZI-Q:fallback', 'NUCLEO-H723ZG:fallback', 'NUCLEO-H743ZI2:obsolete']);
    expect(mcu.blockers).toEqual(['I-06', 'I-07', 'I-12']);
    expect(mcu.decided).toBeNull();
  });
});

describe('choice lint', () => {
  const codes = (raw = loadRawData(), today = TODAY) => findings(raw, today).map((f) => `${f.level}:${f.code}`);
  it("today's data: re-check price for WeAct and the spare role needs a 02 row; no errors", () => {
    const f = findings();
    expect(f.filter((x) => x.level === 'error')).toEqual([]);
    expect(f.some((x) => x.code === 'price-recheck' && x.message.includes('WeAct'))).toBe(true);
    expect(f.some((x) => x.code === 'role-not-in-02' && x.message.includes('Spare'))).toBe(true);
  });
  it('decided without option and log_ref is an error; a log_ref must match a 05 entry', () => {
    const raw = clone(loadRawData());
    raw.choices[0].stage = 'decided';
    expect(codes(raw)).toContain('error:decided-without-log');
    raw.choices[0].decided = { date: '2026-10-01', option: 'NUCLEO-H753ZI', log_ref: '2026-10-01 · embedded' };
    expect(codes(raw)).toContain('error:decided-without-log'); // not in decisions.yaml yet
    raw.decisions.push({ date: '2026-10-01', area: 'embedded', decision: 'NUCLEO-H753ZI', reason: '', evidence: '', changes: '', owner: 'Batu', subsystems: ['firmware'], cite: '05 §2' });
    expect(codes(raw)).not.toContain('error:decided-without-log');
  });
  it('an obsolete option must be status obsolete or rejected', () => {
    const raw = clone(loadRawData());
    raw.choices[0].options[4].status = 'fallback';
    expect(codes(raw)).toContain('error:obsolete-option');
  });
  it('two leading options in one choice is an error', () => {
    const raw = clone(loadRawData());
    raw.choices[0].options[2].status = 'leading';
    expect(codes(raw)).toContain('error:two-leaders');
  });
  it('price checked over 60 days ago warns', () => {
    const f = findings(loadRawData(), '2026-12-15');
    expect(f.some((x) => x.code === 'price-recheck' && x.message.includes('NUCLEO-H753ZI'))).toBe(true);
  });
  it('a passed decide-by date warns while undecided', () => {
    expect(codes(loadRawData(), '2026-11-28')).toContain('warning:choice-overdue');
  });
  it('a part naming an obsolete option warns', () => {
    expect(codes()).not.toContain('warning:obsolete-in-register'); // 02 never names NUCLEO-H743ZI2
    const raw = clone(loadRawData());
    raw.parts.find((p) => p.id === 'B5')!.candidates = 'NUCLEO-H743ZI2';
    expect(findings(raw).some((x) => x.code === 'obsolete-in-register' && x.ids.includes('B5'))).toBe(true);
  });
  it('a DECIDED statement needs a source', () => {
    const raw = clone(loadRawData());
    raw.choices[0].facts.push({ status: 'DECIDED', text: 'no source here' });
    expect(codes(raw)).toContain('error:decided-without-source');
  });
});

describe('deciding a choice is one edit', () => {
  const decide = () => {
    const raw = clone(loadRawData());
    const mcu = raw.choices[0];
    mcu.stage = 'decided';
    mcu.options[0].status = 'chosen';
    mcu.decided = { date: '2026-10-01', option: 'NUCLEO-H753ZI', log_ref: '2026-10-01 · embedded' };
    raw.decisions.push({ date: '2026-10-01', area: 'embedded', decision: 'NUCLEO-H753ZI', reason: '', evidence: '', changes: '', owner: 'Batu', subsystems: ['firmware'], cite: '05 §2' });
    return buildSiteData(raw, TODAY);
  };
  it('copies the chosen option into every part it decides', () => {
    const data = decide();
    for (const id of ['A7', 'B5', 'E1']) {
      expect(data.parts.find((p) => p.id === id), id).toMatchObject({ manufacturer: 'STMicroelectronics', mpn: 'NUCLEO-H753ZI', supplier: 'Digi-Key', unit_cost: 28.15, currency: 'USD' });
    }
  });
  it('before deciding, nothing is copied: B5 shows the leading option labelled (proposed)', () => {
    const data = loadSite();
    const b5 = data.parts.find((p) => p.id === 'B5')!;
    expect(b5.mpn).toBeNull();
    expect(partView(data.choices, b5)).toMatchObject({ proposed: true, mpn: 'NUCLEO-H753ZI' });
    expect(partView(data.choices, b5).model_line).toMatch(/NUCLEO-H753ZI.*\(proposed\)$/);
    expect(partView(data.choices, data.parts.find((p) => p.id === 'E1')!).model_line).toBe('WeAct MiniSTM32H743 (proposed, deferred)');
  });
  it('the other options render collapsed as considered', () => {
    const html = renderHardware(ctxFor(decide()), null, 'mcu');
    expect(html).toContain('Considered (4)');
    expect(html).toContain('in 05 · 2026-10-01 · embedded');
  });
});

describe('hardware page with choices', () => {
  const data = loadSite();
  const html = renderHardware(ctxFor(data), null);
  it('shows five open choice cards', () => expect((html.match(/data-choice="/g) ?? []).length).toBe(5));
  it('A7 is on the schematic with a "not in 02" flag, and the TX board is drawn', () => {
    expect(html).toContain('style="left:24px;top:218px" data-hw-part="A7"');
    expect(html).toContain('<rect x="16" y="220" width="48" height="28" rx="3"/>');
    expect(renderHardware(ctxFor(data), 'A7')).toContain('<span class="notin02">not in 02</span>');
  });
  it('H5 is on the test bench, choosing, MUST BUY, with its notes', () => {
    const h5 = data.parts.find((p) => p.id === 'H5')!;
    expect(h5).toMatchObject({ availability: 'choosing', flag: 'MUST BUY' });
    expect(html).toMatch(/class="hs-bench hs-choosing[^"]*" data-hw-part="H5"/);
    const d = renderHardware(ctxFor(data), 'H5');
    expect(d).toContain('Department has no ND filters (coordinator).');
    expect(d).toContain('The 90 dB fiber attenuator part is flight-only.');
  });
  it('the mcu decision panel matches the seed', () => {
    const d = renderHardware(ctxFor(data), null, 'mcu');
    expect(d).toContain('Proposed · not in 05 yet');
    expect(d).toContain('not in 02: needs a row');
    expect(d).toContain('3 × US$28.15 = <b>US$84.45</b> before tax and shipping');
    expect(d).toMatch(/<b class="struck">NUCLEO-H743ZI2<\/b>/);
    for (const i of ['I-06', 'I-07', 'I-12']) expect(d).toContain(`#/interfaces?id=${i}`);
    for (const doc of ['DS12110', 'DS12117', 'RM0433']) expect(d).toContain(doc);
    expect(d).toContain('labels=decision');
    expect(d).toContain('title=Decision%3A+Microcontroller+boards');
    expect(d).toContain('prov-PROPOSED');
    expect(d).toContain('prov-OPEN');
  });
  it('the part panel links to its open choice', () => {
    expect(renderHardware(ctxFor(data), 'B5')).toMatch(/href="#\/hardware\/choice\/mcu"><b>Open choice · Proposed/);
  });
  it('shows the schedule clash with today\'s data, and the getting-parts rules', () => {
    expect(data.derived.schedule_clashes.map((c) => c.rung)).toEqual([1, 2]);
    expect(html).toContain('<b>Schedule clash</b>');
    expect(html).toContain('Getting parts · Capstone Manual 2026 pp. 22–25');
    expect((html.split('getting-parts')[1].match(/<li>/g) ?? []).length).toBe(data.constraints.procurement_rules.length);
  });
  it('the clash clears when the parts are marked ECE stock or borrowed (a data fix)', () => {
    const raw = clone(loadRawData());
    for (const p of raw.parts) { p.ece_stock = 'yes'; }
    expect(buildSiteData(raw, TODAY).derived.schedule_clashes).toEqual([]);
  });
});

describe('choices elsewhere', () => {
  const data = loadSite();
  it('home page tile: 5 open choices, 0 due within 30 days today', () => {
    expect(renderMap(ctxFor(data))).toMatch(/Open choices<\/div>\s*<div class="tile-value num">5<\/div>\s*<div class="small muted">0 due within 30 days/);
  });
  it('the test ladder marks the clashing rungs', () => {
    expect(renderMap(ctxFor(data))).toContain('schedule clash');
  });
  it("Batu's inbox lists the mcu choice once decide-by is within 30 days", () => {
    expect(renderInbox(ctxFor(data), 'batu')).not.toContain('Microcontroller boards</a>');
    expect(renderInbox(ctxFor(data, '', { now: new Date('2026-11-01T12:00:00') }), 'batu')).toContain('Microcontroller boards</a>');
  });
  it('subsystem pages list the choices touching their parts', () => {
    expect(renderSubsystem(ctxFor(data), 'receiver')).toContain('Microcontroller boards</a>');
    expect(renderSubsystem(ctxFor(data), 'optics')).toContain('Telescope: new or borrowed</a>');
  });
  it('a PROPOSED statement always renders with its chip', () => {
    expect(statement({ status: 'PROPOSED', text: 'x', source: 's' })).toMatch(/^<span class="prov prov-PROPOSED"/);
  });
});

describe('search: choices and options', () => {
  const { engine, cfg } = buildSearch();
  const q = (s: string) => search(engine, cfg, s);
  it('nucleo → the mcu choice first', () => expect(q('nucleo').hits[0].doc.id).toBe('choice:mcu'));
  it('h743zi2 → the obsolete option first', () => {
    const h = q('h743zi2').hits[0];
    expect(h.doc.ref).toBe('NUCLEO-H743ZI2');
    expect(h.doc.status).toMatch(/^obsolete/);
  });
  it('NUCLEO-H753ZI → the choice or the option first, no typo notice', () => {
    const out = q('NUCLEO-H753ZI');
    expect(['choice:mcu', 'option:mcu:nucleoh753zi']).toContain(out.hits[0].doc.id);
    expect(out.correctedQuery).toBeNull();
  });
  it('how do we order parts → the procurement rules first', () => expect(q('how do we order parts').hits[0].doc.id).toBe('rule:procurement'));
  it('proposed items say so beside their status', () => {
    expect(q('NUCLEO-H753ZI').hits.find((h) => h.doc.kind === 'option')!.doc.status).toBe('leading · proposed');
    expect(q('B5').hits.find((h) => h.doc.id === 'part:B5')!.doc.status).toContain('proposed');
  });
  it('datasheets are searchable', () => expect(q('DS12117').hits[0].doc.ref).toBe('DS12117'));
});

describe('BOM export', () => {
  const data = loadSite();
  const bom = buildBom(data, { showFlight: false, date: TODAY });
  it('one NUCLEO-H753ZI line: qty 3, US$28.15, extended US$84.45, commented as proposed', () => {
    const lines = bom.lines.filter((l) => l.mpn === 'NUCLEO-H753ZI');
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatchObject({ qty: 3, unit_cost: 28.15, ext_cost: 84.45, currency: 'USD', proposed: true });
    expect(lines[0].comments).toContain('PROPOSED: not decided (see choice mcu)');
    expect(bom.lines.some((l) => l.ref === 'A7' || l.ref === 'B5')).toBe(false); // covered by the option line
  });
  it('A1, C1, C3 and H1 export with blank P/N, flagged', () => {
    for (const id of ['A1', 'C1', 'C3', 'H1']) {
      const l = bom.lines.find((x) => x.ref === id)!;
      expect(l.mpn, id).toBeNull();
      expect(l.missing, id).toContain('mpn');
    }
  });
  it('no flight lines unless the flight toggle is on', () => {
    expect(bom.lines.some((l) => l.track === 'flight')).toBe(false);
    const withFlight = buildBom(data, { showFlight: true, date: TODAY });
    expect(withFlight.lines.some((l) => l.mpn === 'MiniSTM32H743')).toBe(true);
  });
  it('CSV follows the Capstone Manual column order, blanks stay blank, header block first', () => {
    const csv = bomCsv(bom).split('\r\n');
    expect(csv[0]).toBe('Team,');
    expect(csv[1]).toBe('Project,BOREALIS');
    expect(csv[7]).toBe(BOM_COLUMNS.join(','));
    const nucleo = csv.find((l) => l.includes('NUCLEO-H753ZI'))!;
    expect(nucleo).toMatch(/,3,USD,STMicroelectronics,NUCLEO-H753ZI,Digi-Key,,28\.15,84\.45,/);
    expect(csv.find((l) => l.includes('Total USD'))).toContain('84.45');
  });
  it('USD and CAD are totalled separately and flagged as mixed', () => {
    const raw = clone(loadRawData());
    Object.assign(raw.parts.find((p) => p.id === 'H3')!, { unit_cost: 50, currency: 'CAD', qty: 2 });
    const b = buildBom(buildSiteData(raw, TODAY), { showFlight: false, date: TODAY });
    expect(b.totals).toEqual({ USD: 84.45, CAD: 100 });
    expect(b.mixed).toBe(true);
  });
  it('the page flags missing required fields', () => {
    const html = renderBom(ctxFor(data));
    expect(html).toContain('class="missing"');
    expect(html).toContain('Export BOM (CSV)');
  });
});
