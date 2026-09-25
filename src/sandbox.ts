// Sandbox state: committed register values overridden by the URL hash.
// Pure; shared by the sandbox page, the map tile and tests.
import type { SiteData } from './types.ts';
import { constantsFrom, evaluate, inputsFrom, type ModelOutputs } from './model.ts';

export interface SandboxState {
  values: Record<string, number>;
  committed: Record<string, number>;
  /** register ids whose value differs from committed */
  changed: string[];
  scope: string | null;
}

export const modelIds = (data: SiteData) => Object.values(data.model.inputs);

export function parseSandbox(data: SiteData, query: URLSearchParams): SandboxState {
  const committed = { ...data.derived.committed };
  const values = { ...committed };
  for (const id of modelIds(data)) {
    const raw = query.get(id);
    if (raw === null || raw.trim() === '') continue;
    const n = Number(raw.replace('−', '-'));
    if (Number.isFinite(n)) values[id] = n;
  }
  return {
    values,
    committed,
    changed: modelIds(data).filter((id) => values[id] !== committed[id]),
    scope: query.get('scope'),
  };
}

/** Hash for a sandbox state: only values that differ from committed, plus scope. */
export function sandboxHash(data: SiteData, values: Record<string, number>, scope: string | null): string {
  const q = new URLSearchParams();
  for (const id of modelIds(data)) {
    if (values[id] !== undefined && values[id] !== data.derived.committed[id]) q.set(id, String(values[id]));
  }
  if (scope) q.set('scope', scope);
  const s = q.toString().replace(/%2F/g, '/');
  return `#/sandbox${s ? `?${s}` : ''}`;
}

export function runModel(data: SiteData, values: Record<string, number>): ModelOutputs {
  return evaluate(inputsFrom(values, data.model.inputs), constantsFrom(data.model.constants));
}

export function presetValues(data: SiteData, presetId: string): Record<string, number> {
  const base = { ...data.derived.committed };
  if (presetId === 'committed') return base;
  const p = data.presets.find((x) => x.id === presetId);
  return p ? { ...base, ...p.values } : base;
}

export const baselinePreset = (data: SiteData) => data.presets.find((p) => p.baseline);

export interface Looker { person: string; ids: string[] }
/** Owners of changed inputs decide; owners of rows those inputs feed re-check. */
export function whoHasToLook(data: SiteData, changed: string[]): { decide: Looker[]; recheck: Looker[] } {
  const byId = new Map(data.register.map((r) => [r.id, r]));
  const group = (ids: string[]) => {
    const m = new Map<string, string[]>();
    for (const id of ids) {
      const owner = byId.get(id)?.owner;
      if (!owner) continue;
      if (!m.has(owner)) m.set(owner, []);
      if (!m.get(owner)!.includes(id)) m.get(owner)!.push(id);
    }
    return [...m.entries()].map(([person, list]) => ({ person, ids: list }));
  };
  const downstream = [...new Set(changed.flatMap((id) => byId.get(id)?.feeds_into ?? []))].filter((id) => !changed.includes(id));
  return { decide: group(changed), recheck: group(downstream) };
}
