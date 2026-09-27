// One-off: merge scripts/seed/hardware-seed.yaml into data/parts.yaml by id,
// overwriting only the fields in the seed and keeping comments. Every
// flight-track part gets availability: flight. Idempotent.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, parseDocument, isMap, isSeq, YAMLMap } from 'yaml';

const seed = parse(readFileSync('scripts/seed/hardware-seed.yaml', 'utf8')) as Record<string, unknown>[];
const doc = parseDocument(readFileSync('data/parts.yaml', 'utf8'));
const items = doc.contents;
if (!isSeq(items)) throw new Error('parts.yaml is not a list');
const byId = new Map<string, YAMLMap>();
for (const it of items.items) if (isMap(it)) byId.set(String(it.get('id')), it);

for (const s of seed) {
  const node = byId.get(String(s.id));
  if (!node) throw new Error(`seed part ${s.id} not in parts.yaml`);
  for (const [k, v] of Object.entries(s)) {
    if (k === 'id') continue;
    const n = doc.createNode(v);
    if ((k === 'touches' || k === 'aliases' || k === 'hotspot') && (isSeq(n) || isMap(n))) n.flow = true;
    node.set(k, n);
  }
}
for (const node of byId.values()) {
  if (node.get('track') === 'flight') node.set('availability', 'flight');
  // cost, lead time and datasheet are never invented: explicit nulls to fill in
  if (node.has('availability')) {
    for (const k of ['est_cost_cad', 'lead_time', 'datasheet_url']) if (!node.has(k)) node.set(k, null);
  }
}
writeFileSync('data/parts.yaml', doc.toString({ lineWidth: 0 }));
console.log(`merged ${seed.length} seed entries`);
