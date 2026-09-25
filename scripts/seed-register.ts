// One-off seeding of data/register.yaml from seed/register.csv.
// Kept in the repo so the mapping is documented. Refuses to overwrite an
// existing register unless run with --force (the YAML is the truth now).
//
//   npx tsx scripts/seed-register.ts --force
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Document, isSeq, visit } from 'yaml';

const OUT = 'data/register.yaml';
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`${OUT} exists; the YAML is now the source of truth. Use --force to reseed.`);
  process.exit(1);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// CSV owner names -> people.yaml ids
const OWNER: Record<string, string> = {
  Berky: 'berky', Bilal: 'bilal', Batu: 'batu', Shabazz: 'shabazz', Matei: 'matei', 'R6 (open)': 'open',
};

// CSV subsystem column -> subsystems.yaml id. "System", "Link" and "Project"
// are not subsystems; they are mapped per row below (see README "Choices").
const SUBSYSTEM: Record<string, string> = {
  Transmitter: 'transmitter', Optics: 'optics', Receiver: 'receiver', Tracking: 'tracking',
  'Power & field': 'power', Safety: 'safety', 'Ground software': 'ground', Flight: 'flight',
  Link: 'optics', Project: 'safety',
};
const SYSTEM_ROWS: Record<string, string> = {
  'SYS-01': 'firmware', 'SYS-02': 'firmware', 'SYS-03': 'firmware',
  'SYS-04': 'optics', 'SYS-05': 'optics', 'SYS-06': 'optics',
};

function toValue(v: string): number | string {
  const t = v.trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
}

const [header, ...body] = parseCsv(readFileSync('seed/register.csv', 'utf8'));
const col = (name: string) => header.indexOf(name);

const rows = body.map((r) => {
  const get = (name: string) => (r[col(name)] ?? '').trim();
  const id = get('id');
  const flag = get('class2_flag');
  const last = get('last_changed');
  let changed = last;
  let checked = '2026-09-12';
  if (flag === 'CHANGED') { changed = '2026-09-24'; checked = '2026-09-24'; }
  else if (flag === 'RE-CHECK') { checked = '2026-09-12'; }
  else if (flag === 'OK') { checked = '2026-09-12'; changed = last; }
  else throw new Error(`${id}: unknown class2_flag ${flag}`);

  const csvSub = get('subsystem');
  const subsystem = csvSub === 'System' ? SYSTEM_ROWS[id] : SUBSYSTEM[csvSub];
  if (!subsystem) throw new Error(`${id}: no subsystem mapping for ${csvSub}`);
  const owner = OWNER[get('owner')];
  if (!owner) throw new Error(`${id}: unknown owner ${get('owner')}`);
  const feeds = get('feeds_into');
  const feeds_into = feeds === '-' || feeds === '' ? [] : feeds.split(',').map((s) => s.trim());

  return {
    id,
    name: get('parameter'),
    subsystem,
    value: toValue(get('value')),
    unit: get('unit'),
    tag: get('tag'),
    owner,
    feeds_into,
    source: get('source'),
    track: id.startsWith('FLT') ? 'flight' : 'core',
    changed,
    checked,
    note: get('note'),
  };
});

const doc = new Document(rows);
visit(doc, {
  Seq(_, node, path) {
    // feeds_into lists on one line: [A, B]
    if (path.length > 2 && isSeq(node)) node.flow = true;
  },
});
const headerComment = `# BOREALIS parameter register — the truth for numbers (07 §2 D10).
# Seeded from seed/register.csv (Sep 24 Class 2 change included).
# Edit a row: change value, set changed: and checked: to today, commit as
#   ID: old → new · reason · name
# A MEASURED row must carry conditions: range_m, power_dbm, attenuation_db,
# bandwidth_khz, temperature_c, evidence (path under evidence/), or the build fails.
`;
writeFileSync(OUT, headerComment + doc.toString({ lineWidth: 0 }).replace(/\n- id:/g, '\n\n- id:'));
console.log(`wrote ${rows.length} rows to ${OUT}`);
