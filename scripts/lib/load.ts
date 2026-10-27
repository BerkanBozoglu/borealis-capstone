// Reads data/*.yaml into RawData. Works from a directory or from any git
// revision (used by diff-register to compare with the previous commit).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import type { Plan, RawData } from '../../src/types.ts';
import { planFromSeed, planLines, statusLines } from './plan.ts';

export const DATA_FILES = [
  'site', 'people', 'subsystems', 'register', 'parts', 'open_items', 'decisions',
  'interfaces', 'milestones', 'approvals', 'presets', 'model', 'constraints', 'synonyms', 'glossary', 'software', 'choices', 'model3d',
] as const;

type Reader = (file: string) => string | null;

export const PLAN_FILE = 'data/plan.yaml';
export const PLAN_SEED = 'seed/plan.json';
export const STATUS_DIR = 'data/status';

/** YAML 1.1 tools may turn 2026-09-24 into a Date; keep every date a string. */
function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]));
  }
  return v;
}

/** Line of each "- id: X" (or "- n: X") entry, for GitHub line links. */
export function idLines(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^-\s+(?:id|n):\s*["']?([^"'\s#]+)/);
    if (m) out[m[1]] = i + 1;
  });
  return out;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/**
 * data/plan.yaml (optional: older revisions have none). While it is still the
 * placeholder and seed/plan.json exists, the seed is converted in memory;
 * build-data then writes the result back to data/plan.yaml.
 */
function loadPlan(read: Reader, data: RawData): { plan: Plan; fromSeed: boolean } {
  const text = read(PLAN_FILE);
  let plan: Plan = { milestones: [], weeks: [] };
  if (text !== null) {
    try {
      plan = (normalize(parse(text)) ?? {}) as Plan;
    } catch (e) {
      throw new Error(`${PLAN_FILE}: ${(e as Error).message}`);
    }
  }
  const seed = text === null || plan.placeholder ? read(PLAN_SEED) : null;
  if (seed !== null) {
    try {
      return { plan: planFromSeed(normalize(JSON.parse(seed)), data.people ?? [], plan), fromSeed: true };
    } catch (e) {
      throw new Error(`${PLAN_SEED}: ${(e as Error).message}`);
    }
  }
  plan.milestones = plan.milestones ?? [];
  plan.weeks = (plan.weeks ?? []).map((w) => ({
    ...w, mon: String(w.mon ?? ''), meeting: String(w.meeting ?? ''), phase: String(w.phase ?? ''),
    milestone: String(w.milestone ?? ''), brief: String(w.brief ?? ''), teach: w.teach ?? '', cells: w.cells ?? {},
  }));
  for (const w of plan.weeks) {
    for (const [id, c] of Object.entries(w.cells)) {
      w.cells[id] = { deliver: String(c?.deliver ?? ''), learn: String(c?.learn ?? ''), ask: String(c?.ask ?? '') };
    }
  }
  return { plan, fromSeed: false };
}

export function loadRaw(read: Reader, evidenceFiles: string[] = [], statusFiles: string[] = []): RawData {
  const raw: Record<string, unknown> = {};
  const lines: Record<string, Record<string, number>> = {};
  for (const name of DATA_FILES) {
    const text = read(`data/${name}.yaml`);
    if (text === null) throw new Error(`missing data/${name}.yaml`);
    try {
      raw[name] = normalize(parse(text));
    } catch (e) {
      throw new Error(`data/${name}.yaml: ${(e as Error).message}`);
    }
    if (name === 'register' || name === 'parts' || name === 'interfaces' || name === 'open_items') {
      lines[name] = idLines(text);
    }
  }
  // Defaults so optional list fields are always arrays.
  const data = raw as unknown as RawData;
  for (const r of data.register ?? []) {
    r.feeds_into = r.feeds_into ?? [];
    r.note = r.note ?? '';
    r.source = r.source ?? '';
    r.id = String(r.id);
  }
  for (const i of data.interfaces ?? []) { i.gap = i.gap ?? ''; i.blocks = i.blocks ?? ''; i.spec_hash = String(i.spec_hash ?? ''); }
  for (const p of data.parts ?? []) { p.fields = p.fields ?? []; p.id = String(p.id); }
  if (data.site?.repo) data.site.repo.slug = `${data.site.repo.owner}/${data.site.repo.name}`;
  const { plan, fromSeed } = loadPlan(read, data);
  data.plan = plan;
  if (!fromSeed) lines.plan = planLines(read(PLAN_FILE) ?? '');
  data.status = {};
  for (const f of statusFiles) {
    const name = f.replace(/\.ya?ml$/, '');
    const text = read(`${STATUS_DIR}/${f}`) ?? '';
    try {
      data.status[name] = (normalize(parse(text)) ?? {}) as Record<string, unknown>;
    } catch (e) {
      throw new Error(`${STATUS_DIR}/${f}: ${(e as Error).message}`);
    }
    lines[`status/${name}`] = statusLines(text);
  }
  data.lines = lines;
  data.evidence_files = evidenceFiles;
  return data;
}

export function loadFromDir(root = '.'): RawData {
  const read: Reader = (f) => {
    const p = join(root, f);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };
  const evidence = listFiles(join(root, 'evidence')).map((p) => relative(root, p).replace(/\\/g, '/'));
  const status = existsSync(join(root, STATUS_DIR)) ? readdirSync(join(root, STATUS_DIR)).filter((f) => /\.ya?ml$/.test(f)).sort() : [];
  return loadRaw(read, evidence, status);
}

export function loadFromGit(rev: string, root = '.'): RawData | null {
  const read: Reader = (f) => {
    try {
      return execFileSync('git', ['show', `${rev}:${f}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return null;
    }
  };
  if (read('data/register.yaml') === null) return null;
  try {
    return loadRaw(read);
  } catch {
    return null;
  }
}
