// Derived state: computed at build time, never typed by hand (07 §2 D4).
import { createHash } from 'node:crypto';
import type {
  Derived, Finding, Inbox, InterfaceDerived, RawData, RegisterRow, RowDerived, SiteData,
  SubsystemDerived, Tag,
} from '../../src/types.ts';
import { TAGS } from '../../src/types.ts';
import { committedValues } from '../../src/model.ts';
import { runChecks } from './checks.ts';

export const sha1 = (s: string) => createHash('sha1').update(s, 'utf8').digest('hex');
/** Stored spec_hash is the first 10 hex chars of sha1(what). */
export const specHash = (what: string) => sha1(what.trim()).slice(0, 10);

/** upstream(row) = rows whose feeds_into includes row.id */
export function upstreamMap(register: RegisterRow[]): Map<string, string[]> {
  const up = new Map<string, string[]>(register.map((r) => [r.id, []]));
  for (const r of register) {
    for (const d of r.feeds_into) {
      if (!up.has(d)) up.set(d, []);
      up.get(d)!.push(r.id);
    }
  }
  return up;
}

/** stale(row) = ∃ r ∈ upstream(row) with r.changed > row.checked */
export function computeRows(raw: Pick<RawData, 'register' | 'lines'>): Record<string, RowDerived> {
  const byId = new Map(raw.register.map((r) => [r.id, r]));
  const up = upstreamMap(raw.register);
  const out: Record<string, RowDerived> = {};
  for (const row of raw.register) {
    const upstream = up.get(row.id) ?? [];
    const reasons = upstream
      .map((id) => byId.get(id))
      .filter((r): r is RegisterRow => !!r && String(r.changed) > String(row.checked))
      .map((r) => ({ from: r.id, changed: r.changed, checked: row.checked }));
    out[row.id] = {
      stale: reasons.length > 0,
      reasons,
      upstream,
      line: raw.lines?.register?.[row.id] ?? null,
    };
  }
  return out;
}

export function computeInterfaces(raw: Pick<RawData, 'interfaces' | 'lines'>): Record<string, InterfaceDerived> {
  const out: Record<string, InterfaceDerived> = {};
  for (const i of raw.interfaces) {
    const computed = specHash(i.what ?? '');
    const downgraded = i.status === 'agreed' && String(i.spec_hash ?? '').trim() !== computed;
    out[i.id] = {
      status: downgraded ? 'draft' : i.status,
      computed_hash: computed,
      downgraded,
      to_list: Array.isArray(i.to) ? i.to : [i.to],
      line: raw.lines?.interfaces?.[i.id] ?? null,
    };
  }
  return out;
}

export function touches(ifaceId: string, subsystem: string, ifaces: Record<string, InterfaceDerived>, from: string): boolean {
  return from === subsystem || ifaces[ifaceId].to_list.includes(subsystem);
}

export function computeSubsystems(
  raw: RawData,
  rows: Record<string, RowDerived>,
  ifaces: Record<string, InterfaceDerived>,
  findings: Finding[],
): Record<string, SubsystemDerived> {
  const out: Record<string, SubsystemDerived> = {};
  for (const s of raw.subsystems) {
    const myRows = raw.register.filter((r) => r.subsystem === s.id);
    const rowIds = new Set(myRows.map((r) => r.id));
    const myIfaces = raw.interfaces.filter((i) => touches(i.id, s.id, ifaces, i.from));
    // broken (red): a lint error, or one of the health checks listed in
    // site.yaml broken_checks, on one of this subsystem's rows.
    // re-check (amber): any other warning on its rows, a stale row, or an
    // interface touching it that is not agreed.
    const brokenCodes = new Set(raw.site.broken_checks ?? []);
    const broken: string[] = [];
    const recheck: string[] = [];
    for (const f of findings) {
      const hit = f.ids.filter((id) => rowIds.has(id));
      if (!hit.length) continue;
      (f.level === 'error' || brokenCodes.has(f.code) ? broken : recheck).push(`${hit.join(', ')}: ${f.message}`);
    }
    for (const i of myIfaces) {
      const st = ifaces[i.id].status;
      if (st !== 'agreed') recheck.push(`${i.id} interface is ${st}`);
    }
    const stale = myRows.filter((r) => rows[r.id]?.stale).map((r) => r.id);
    if (stale.length) recheck.push(`${stale.length} stale row${stale.length === 1 ? '' : 's'}: ${stale.join(', ')}`);
    const confidence: Partial<Record<Tag, number>> = {};
    for (const t of TAGS) {
      const n = myRows.filter((r) => r.tag === t).length;
      if (n) confidence[t] = n;
    }
    out[s.id] = {
      status: broken.length ? 'broken' : recheck.length ? 'recheck' : 'ok',
      broken_reasons: broken,
      recheck_reasons: recheck,
      confidence,
      rows: myRows.map((r) => r.id),
      parts: raw.parts.filter((p) => p.subsystem === s.id).map((p) => p.id),
      interfaces: myIfaces.map((i) => i.id),
      stale,
    };
  }
  return out;
}

export function computeInbox(
  raw: RawData,
  rows: Record<string, RowDerived>,
  ifaces: Record<string, InterfaceDerived>,
): Record<string, Inbox> {
  const out: Record<string, Inbox> = {};
  for (const p of raw.people) {
    out[p.id] = {
      stale_rows: raw.register.filter((r) => r.owner === p.id && rows[r.id]?.stale).map((r) => r.id),
      interfaces: raw.interfaces.filter((i) => i.owners.includes(p.id) && ifaces[i.id].status !== 'agreed').map((i) => i.id),
    };
  }
  return out;
}

/** The whole pipeline: raw data → site data with derived state and findings. */
export function buildSiteData(raw: RawData, today: string, builtAt = new Date().toISOString()): SiteData {
  const rows = computeRows(raw);
  const interfaces = computeInterfaces(raw);
  const committed = committedValues(raw.register, raw.model?.inputs ?? {});
  const findings = runChecks(raw, { rows, interfaces, committed, today });
  const derived: Derived = {
    rows,
    interfaces,
    committed,
    findings,
    subsystems: computeSubsystems(raw, rows, interfaces, findings),
    inbox: computeInbox(raw, rows, interfaces),
  };
  const { evidence_files: _unused, ...rest } = raw;
  void _unused;
  return { ...rest, derived, built_at: builtAt, today };
}
