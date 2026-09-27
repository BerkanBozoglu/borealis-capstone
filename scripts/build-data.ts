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
const history = registerHistory('.', 300, (id) => subsystemOf.get(id));

mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/data.json', JSON.stringify(data));
writeFileSync('src/generated/history.json', JSON.stringify(history));

const docs = buildDocs(data.site.search.docs, data.site.doc_superseded, (id) => `#/register?id=${encodeURIComponent(id)}`);
writeFileSync('src/generated/docs.json', JSON.stringify(docs));
const index = JSON.stringify(buildEngine(searchDocs(data, docs)));
writeFileSync('src/generated/search-index.json', index);
console.log(`build-data: ${docs.length} docs, ${docs.reduce((n, d) => n + d.sections.length, 0)} doc sections, search index ${(index.length / 1024).toFixed(0)} KB`);
console.log(`build-data: ${data.register.length} rows, ${data.parts.length} parts, ${data.interfaces.length} interfaces, ${history.length} register commits`);
