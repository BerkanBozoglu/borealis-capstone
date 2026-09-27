// One-off (prompt 09 + follow-ups, 2026-09-27): H5 onto the hardware view,
// new part A7, B5/E1 updates, BOM fields on every part. Idempotent; keeps comments.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument, isMap, isSeq, YAMLMap } from 'yaml';

const doc = parseDocument(readFileSync('data/parts.yaml', 'utf8'));
const items = doc.contents;
if (!isSeq(items)) throw new Error('parts.yaml is not a list');
const byId = () => new Map(items.items.filter(isMap).map((m) => [String((m as YAMLMap).get('id')), m as YAMLMap]));
const set = (node: YAMLMap, k: string, v: unknown, flow = false) => {
  const n = doc.createNode(v);
  if (flow && (isSeq(n) || isMap(n))) n.flow = true;
  node.set(k, n);
};

// ---- A7: new part, after A6 ----
if (!byId().has('A7')) {
  const a7 = doc.createNode({
    id: 'A7',
    name: 'Transmitter microcontroller board',
    subsystem: 'firmware',
    track: 'core',
    cite: 'new · not in 02 yet',
    role: 'Packs the stored test image into packets and switches the laser driver on and off 100,000 times a second, with hardware timing.',
    status: 'candidate',
    chosen_part: 'TBD',
    candidates: '',
    downstream: '',
    gotchas: '',
    fields: [],
    in_02: false,
    availability: 'candidate',
    flag: 'NOT IN 02',
    owner_display: 'Batu (proposed)',
    short: 'Board choice: see open choice mcu',
    what_it_does: 'Packs the stored test image into packets and switches the laser driver on and off 100,000 times a second, with hardware timing.',
    touches: ['SYS-01', 'I-01', 'I-12'],
    source: 'buy new',
    aliases: ['tx board', 'transmitter board', 'tx mcu', 'transmitter microcontroller'],
    hotspot: { view: 'station', x: 40, y: 234 },
    doc_ref: 'new · not in 02 yet',
    est_cost_cad: null, lead_time: null, datasheet_url: null,
  }) as YAMLMap;
  for (const k of ['touches', 'aliases', 'hotspot']) { const n = a7.get(k, true); if (isSeq(n) || isMap(n)) n.flow = true; }
  const list = items.items as unknown[];
  const idx = list.findIndex((m) => isMap(m) && (m as YAMLMap).get('id') === 'A6');
  list.splice(idx + 1, 0, a7);
}

const m = byId();

// ---- H5: ND filter set onto the hardware view ----
const h5 = m.get('H5')!;
set(h5, 'availability', 'choosing');
set(h5, 'flag', 'MUST BUY');
set(h5, 'owner_display', 'Berky');
set(h5, 'short', 'Department has no ND filters');
set(h5, 'model_line', 'Absorptive ND filter set, OD 1–3 (02 H5)');
set(h5, 'what_it_does', 'Test-bench ND filters for dimming the beam during bench and corridor tests.');
set(h5, 'need_to_know', [
  'Department has no ND filters (coordinator).',
  'The 90 dB fiber attenuator part is flight-only.',
]);
set(h5, 'touches', ['TX-09'], true);
set(h5, 'source', 'buy new');
set(h5, 'aliases', ['nd filter set', 'nd filters', 'od 1-3', 'fiber attenuator'], true);
set(h5, 'hotspot', { view: 'bench' }, true);
set(h5, 'doc_ref', '02 H5');
for (const k of ['est_cost_cad', 'lead_time', 'datasheet_url']) if (!h5.has(k)) set(h5, k, null);

// ---- B5 / E1 ----
const b5 = m.get('B5')!;
set(b5, 'name', 'Receiver microcontroller board');
set(b5, 'owner_display', 'Bilal (02) · Batu (proposed)');
set(b5, 'short', 'Leading: NUCLEO-H753ZI (proposed)');
b5.delete('model_line'); // shown from the mcu choice's leading option, labelled (proposed)
set(b5, 'need_to_know', [
  'Hardware-timed capture, no bit-banging (04 §6)',
  'Packet format to the laptop is interface I-07, still missing',
  "02 lists \"STM32H743 (WeAct or Nucleo)\"; the Nucleo board for that chip (NUCLEO-H743ZI2) is obsolete, so the register entry must be replaced",
]);
const e1 = m.get('E1')!;
set(e1, 'model_line', 'WeAct MiniSTM32H743 (proposed, deferred)');

// ---- BOM fields on every part ----
for (const [id, node] of m) {
  const flight = node.get('track') === 'flight';
  const notBought = id === 'F' || node.get('source') === 'department';
  const defaults: Record<string, unknown> = {
    manufacturer: null, mpn: null, supplier: null, supplier_pn: null, unit_cost: null, currency: null, qty: null,
    ece_stock: 'unknown', bom_include: !(flight || notBought),
  };
  for (const [k, v] of Object.entries(defaults)) if (!node.has(k)) set(node, k, v);
}
writeFileSync('data/parts.yaml', doc.toString({ lineWidth: 0 }));
console.log('parts.yaml updated');
