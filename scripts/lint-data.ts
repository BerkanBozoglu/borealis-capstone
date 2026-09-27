// Validates data/*.yaml. Errors exit non-zero (the build fails); warnings are
// printed and shown in the site's health panel.
import { loadFromDir } from './lib/load.ts';
import { buildSiteData } from './lib/derive.ts';
import { errorsOf, warningsOf } from './lib/checks.ts';
import { todayIso } from './lib/today.ts';
import { publicHistory, publicSiteData } from './lib/public.ts';
import { loadPrivacy, scanText } from './lib/privacy.ts';
import { registerHistory } from './lib/history.ts';
import { buildDocs } from './lib/docs.ts';
import { searchDocs } from './lib/search-docs.ts';
import { buildEngine } from '../src/search.ts';

const data = buildSiteData(loadFromDir('.'), todayIso());
const errors = errorsOf(data.derived.findings);
const warnings = warningsOf(data.derived.findings);

// privacy: build the shipped outputs in memory and scan them
if (!errors.length) {
  const cfg = loadPrivacy('.');
  const pub = publicSiteData(data);
  const docs = buildDocs(pub.site.search.docs, pub.site.doc_superseded, (id) => `#/register?id=${id}`);
  const shipped: [string, string][] = [
    ['data.json', JSON.stringify(pub)],
    ['history.json', JSON.stringify(publicHistory(data, registerHistory('.', 300), cfg))],
    ['docs.json', JSON.stringify(docs)],
    ['search-index.json', JSON.stringify(buildEngine(searchDocs(pub, docs)))],
  ];
  for (const [where, text] of shipped) {
    for (const h of scanText(text, where, cfg)) errors.push({ level: 'error', code: 'privacy', message: `${h.kind} in ${where}: ${h.sample}`, ids: [] });
  }
}

for (const w of warnings) console.log(`warning [${w.code}] ${w.message}`);
for (const e of errors) console.error(`ERROR   [${e.code}] ${e.message}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length) process.exit(1);
