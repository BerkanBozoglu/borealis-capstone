// Build step: data/*.yaml → src/generated/data.json (+ history.json from git).
// Runs the data checks first and fails the build on any error.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadFromDir, PLAN_FILE, PLAN_SEED, STATUS_DIR } from './lib/load.ts';
import { planYaml, statusFileText } from './lib/plan.ts';
import { buildSiteData } from './lib/derive.ts';
import { errorsOf, warningsOf } from './lib/checks.ts';
import { registerHistory } from './lib/history.ts';
import { todayIso } from './lib/today.ts';
import { buildDocs } from './lib/docs.ts';
import { searchDocs } from './lib/search-docs.ts';
import { buildEngine } from '../src/search.ts';
import { publicHistory, publicSiteData } from './lib/public.ts';
import { loadPrivacy, scanText } from './lib/privacy.ts';

/** Is the file committed in git (false outside a git checkout)? */
function tracked(file: string): boolean {
  try { execFileSync('git', ['ls-files', '--error-unmatch', file], { stdio: 'ignore' }); return true; } catch { return false; }
}

let raw = loadFromDir('.');
let data = buildSiteData(raw, todayIso());
const errors = errorsOf(data.derived.findings);
for (const w of warningsOf(data.derived.findings)) console.log(`warning [${w.code}] ${w.message}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR   [${e.code}] ${e.message}`);
  console.error(`\nbuild-data: ${errors.length} error(s) — fix data/*.yaml (run npm run lint)`);
  process.exit(1);
}

// Weekly plan files the build writes (never over a past week's status file):
// the plan converted from seed/plan.json while data/plan.yaml is a placeholder,
// and this week's status file, all todo, if it does not exist yet.
if (!raw.lines.plan && raw.plan.weeks.length) {
  writeFileSync(PLAN_FILE, planYaml(raw.plan, raw.people));
  console.log(`build-data: wrote ${PLAN_FILE} from ${PLAN_SEED} (${raw.plan.weeks.length} weeks)`);
}
const thisWeek = data.derived.weekly.status_file_for_today;
if (thisWeek && !existsSync(thisWeek)) {
  const w = raw.plan.weeks.find((x) => thisWeek.endsWith(`/${x.mon}.yaml`))!;
  const text = statusFileText(w, raw.people);
  mkdirSync(STATUS_DIR, { recursive: true });
  writeFileSync(thisWeek, text);
  console.log(`build-data: created ${thisWeek} (week ${w.n}, everyone todo)`);
  raw = loadFromDir('.');
  data = buildSiteData(raw, todayIso());
  // Until someone commits it, "Update my status" opens GitHub's new-file page with this text.
  if (!tracked(thisWeek)) data.derived.weekly.weeks.find((x) => x.file === thisWeek)!.new_file_text = text;
}

const subsystemOf = new Map(raw.register.map((r) => [r.id, r.subsystem]));
const cfg = loadPrivacy('.');
const history = publicHistory(data, registerHistory('.', 300, (id) => subsystemOf.get(id)), cfg);
const pub = publicSiteData(data);

mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/data.json', JSON.stringify(pub));
writeFileSync('src/generated/history.json', JSON.stringify(history));

const docs = buildDocs(pub.site.search.docs, data.site.doc_superseded, (id) => `#/register?id=${encodeURIComponent(id)}`);
writeFileSync('src/generated/docs.json', JSON.stringify(docs));
const index = JSON.stringify(buildEngine(searchDocs(pub, docs)));
writeFileSync('src/generated/search-index.json', index);

// privacy: no surnames, staff names, GitHub usernames or emails in anything shipped
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
