// Compares data at a base revision (default HEAD^) with the working tree and
// reports what changed and which rows became stale. Used by
// .github/workflows/notify.yml; also handy locally:
//
//   npm run diff-register -- --base HEAD~3 --out diff.json
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadFromDir, loadFromGit } from './lib/load.ts';
import { buildSiteData } from './lib/derive.ts';
import { diffRows } from './lib/history.ts';
import { todayIso } from './lib/today.ts';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const base = arg('base', 'HEAD^');
const outFile = arg('out', '');
const siteUrl = arg('site', process.env.SITE_URL ?? '');

const git = (args: string[]) => {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; }
};

const today = todayIso();
const after = buildSiteData(loadFromDir('.'), today);
const beforeRaw = loadFromGit(base);
const before = beforeRaw ? buildSiteData(beforeRaw, today) : null;

const changes = diffRows(
  before ? new Map(before.register.map((r) => [r.id, r])) : null,
  new Map(after.register.map((r) => [r.id, r])),
);

const person = (id: string) => after.people.find((p) => p.id === id);
// With no data at the base revision (first import) nothing "became" stale.
const newlyStale = !before ? [] : after.register
  .filter((r) => after.derived.rows[r.id].stale && !(before?.derived.rows[r.id]?.stale))
  .map((r) => ({
    id: r.id,
    name: r.name,
    subsystem: r.subsystem,
    owner: r.owner,
    owner_name: person(r.owner)?.name ?? r.owner,
    github: person(r.owner)?.github ?? '',
    reasons: after.derived.rows[r.id].reasons,
    line: after.derived.rows[r.id].line,
  }));

const ifaceChanges = after.interfaces
  .map((i) => {
    const old = before?.interfaces.find((x) => x.id === i.id);
    const now = after.derived.interfaces[i.id].status;
    const was = old ? before!.derived.interfaces[i.id].status : null;
    return old && (old.what !== i.what || was !== now) ? { id: i.id, was, now, what: i.what } : null;
  })
  .filter(Boolean);

const show = (v: unknown) => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v ?? '—'));
const lines: string[] = [];
const author = git(['log', '-1', '--format=%an']);
const subject = git(['log', '-1', '--format=%s']);
lines.push(`**${author}** changed the register: ${subject}`);
if (!before) lines.push(`Initial import: ${changes.length} rows (no data at ${base}); no re-check issues opened.`);
for (const c of before ? changes : []) {
  if (c.kind !== 'changed') { lines.push(`- ${c.id}: ${c.kind}`); continue; }
  const v = c.fields.filter((f) => !['changed', 'checked'].includes(f.field));
  if (!v.length) { lines.push(`- ${c.id}: re-checked`); continue; }
  lines.push(`- ${c.id}: ${v.map((f) => `${f.field === 'value' ? '' : `${f.field} `}${show(f.old)} → ${show(f.new)}`).join('; ')}`);
}
for (const i of ifaceChanges) lines.push(`- interface ${i!.id}: ${i!.was} → ${i!.now}`);
if (newlyStale.length) {
  lines.push('', `Now stale (${newlyStale.length}):`);
  for (const s of newlyStale) lines.push(`- ${s.id} ${s.name} — ${s.owner_name} (because ${s.reasons.map((r) => r.from).join(', ')} changed)`);
}
if (siteUrl) lines.push('', siteUrl);
const message = lines.join('\n');

const result = { base, author, subject, changes, interfaces: ifaceChanges, newly_stale: newlyStale, message };
if (outFile) writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(message);
