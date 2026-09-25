// Row-level history of data/register.yaml from git log: for each commit, which
// rows were added, removed or changed, and which fields went from what to what.
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import type { Commit, RegisterRow, RowChange } from '../../src/types.ts';

const FILE = 'data/register.yaml';
const FIELDS: (keyof RegisterRow)[] = [
  'name', 'subsystem', 'value', 'unit', 'tag', 'owner', 'feeds_into', 'source', 'track', 'changed', 'checked', 'note', 'conditions',
];

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function rowsAt(rev: string, cwd: string): Map<string, RegisterRow> | null {
  const text = git(['show', `${rev}:${FILE}`], cwd);
  if (text === null) return null;
  try {
    const list = (parse(text) ?? []) as RegisterRow[];
    return new Map(list.map((r) => [String(r.id), r]));
  } catch {
    return null;
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function diffRows(before: Map<string, RegisterRow> | null, after: Map<string, RegisterRow> | null): RowChange[] {
  const out: RowChange[] = [];
  const b = before ?? new Map();
  const a = after ?? new Map();
  for (const [id, row] of a) {
    const old = b.get(id);
    if (!old) { out.push({ id, kind: 'added', fields: [] }); continue; }
    const fields = FIELDS.filter((f) => !same(old[f], row[f])).map((f) => ({ field: f, old: old[f] ?? null, new: row[f] ?? null }));
    if (fields.length) out.push({ id, kind: 'changed', fields });
  }
  for (const id of b.keys()) if (!a.has(id)) out.push({ id, kind: 'removed', fields: [] });
  return out;
}

/** Commits touching data/register.yaml, newest first. */
export function registerHistory(cwd = '.', limit = 300, subsystemOf: (id: string) => string | undefined = () => undefined): Commit[] {
  const log = git(['log', `-n${limit}`, '--format=%H%x1f%an%x1f%aI%x1f%s', '--', FILE], cwd);
  if (!log) return [];
  const commits: Commit[] = [];
  for (const line of log.trim().split('\n').filter(Boolean)) {
    const [sha, author, date, subject] = line.split('\x1f');
    const after = rowsAt(sha, cwd);
    const before = rowsAt(`${sha}^`, cwd);
    const changes = diffRows(before, after);
    const subsystems = new Set<string>();
    for (const c of changes) {
      const s = subsystemOf(c.id) ?? after?.get(c.id)?.subsystem ?? before?.get(c.id)?.subsystem;
      if (s) subsystems.add(s);
    }
    commits.push({ sha, author, date, subject, changes, subsystems: [...subsystems] });
  }
  return commits;
}
