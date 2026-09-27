// Build step: data/*.yaml → src/generated/data.json (+ history.json from git).
// Runs the data checks first and fails the build on any error.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadFromDir } from './lib/load.ts';
import { buildSiteData } from './lib/derive.ts';
import { errorsOf, warningsOf } from './lib/checks.ts';
import { registerHistory } from './lib/history.ts';
import { todayIso } from './lib/today.ts';
import { buildDocs } from './lib/docs.ts';
import { searchDocs } from './lib/search-docs.ts';
import { buildEngine } from '../src/search.ts';
import { publicHistory, publicSiteData } from './lib/public.ts';
import { loadPrivacy, scanText } from './lib/privacy.ts';

const raw = loadFromDir('.');
const data = buildSiteData(raw, todayIso());
const errors = errorsOf(data.derived.findings);
for (const w of warningsOf(data.derived.findings)) console.log(`warning [${w.code}] ${w.message}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR   [${e.code}] ${e.message}`);
  console.error(`\nbuild-data: ${errors.length} error(s) — fix data/*.yaml (run npm run lint)`);
  process.exit(1);
}

const subsystemOf = new Map(raw.register.map((r) => [r.id, r.subsystem]));
const history = publicHistory(data, registerHistory('.', 300, (id) => subsystemOf.get(id)));
const pub = publicSiteData(data);

mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/data.json', JSON.stringify(pub));
writeFileSync('src/generated/history.json', JSON.stringify(history));

const docs = buildDocs(pub.site.search.docs, data.site.doc_superseded, (id) => `#/register?id=${encodeURIComponent(id)}`);
writeFileSync('src/generated/docs.json', JSON.stringify(docs));
const index = JSON.stringify(buildEngine(searchDocs(pub, docs)));
writeFileSync('src/generated/search-index.json', index);

// privacy: no surnames, staff names, GitHub usernames or emails in anything shipped
const cfg = loadPrivacy('.');
const hits = [
  ...scanText(JSON.stringify(pub), 'data.json', cfg), ...scanText(JSON.stringify(history), 'history.json', cfg),
  ...scanText(JSON.stringify(docs), 'docs.json', cfg), ...scanText(index, 'search-index.json', cfg),
];
if (hits.length) {
  for (const h of hits) console.error(`ERROR   [privacy] ${h.kind} in ${h.where}: ${h.sample}`);
  process.exit(1);
}
console.log(`build-data: ${docs.length} docs, ${docs.reduce((n, d) => n + d.sections.length, 0)} doc sections, search index ${(index.length / 1024).toFixed(0)} KB`);
console.log(`build-data: ${data.register.length} rows, ${data.parts.length} parts, ${data.interfaces.length} interfaces, ${history.length} register commits`);
