// Derived state: computed at build time, never typed by hand (07 §2 D4).
import { createHash } from 'node:crypto';
import type {
  Derived, Finding, HardwareDerived, Inbox, InterfaceDerived, RawData, RegisterRow, RowDerived, SiteData,
  SubsystemDerived, Tag, WeekCellDerived, WeekDerived, WeeklyDerived, WorkStatus,
} from '../../src/types.ts';
import { TAGS, WORK_STATUSES } from '../../src/types.ts';
import { addDays, sortedWeeks } from '../../src/weekly.ts';
import { committedValues } from '../../src/model.ts';
import { runChecks } from './checks.ts';
import { applyDecisions, scheduleClashes } from '../../src/choices.ts';

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

/** Lane counts and budget for the hardware page. */
export function computeHardware(raw: RawData): HardwareDerived {
  const lanes: Record<string, number> = {};
  for (const p of raw.parts) if (p.availability) lanes[p.availability] = (lanes[p.availability] ?? 0) + 1;
  // parts still to acquire: core, classified, not already available
  const toBuy = raw.parts.filter((p) => p.track === 'core' && p.availability && p.availability !== 'available');
  const priced = toBuy.filter((p) => typeof p.est_cost_cad === 'number');
  return {
    budget_cad: Number(raw.constraints?.budget_cad ?? 0),
    priced: priced.length,
    to_price: toBuy.length,
    priced_total_cad: priced.reduce((a, p) => a + (p.est_cost_cad as number), 0),
    lanes,
  };
}

/** A status file entry as written → status (case-insensitive; unknown values count as todo and fail the checks). */
export function statusOf(v: unknown): WorkStatus {
  const s = String((v as { status?: unknown } | null)?.status ?? 'todo').trim().toLowerCase();
  return (WORK_STATUSES as readonly string[]).includes(s) ? (s as WorkStatus) : 'todo';
}
const field = (v: unknown, k: 'link' | 'note') => {
  const x = (v as Record<string, unknown> | null)?.[k];
  return x === null || x === undefined ? '' : String(x).trim();
};

/**
 * Weekly plan state (never typed):
 * - carried: last week's status was not done and last week was not an off week;
 * - carried twice: carried this week and last week;
 * - stale: last week still has todo after its meeting date (or its Sunday).
 * Weeks that have not started yet (Monday after today) carry nothing, and a
 * week without a status file has no recorded status, so it carries nothing.
 */
export function computeWeekly(raw: Pick<RawData, 'plan' | 'status' | 'people' | 'lines'>, today: string): WeeklyDerived {
  const weeks = sortedWeeks(raw.plan);
  const people = raw.people.map((p) => p.id);
  const names = new Map(raw.people.map((p) => [p.id, p.name]));
  const milestones = raw.plan.milestones ?? [];
  const out: WeekDerived[] = [];
  weeks.forEach((w, i) => {
    const file = `data/status/${w.mon}.yaml`;
    const st = raw.status[w.mon];
    const prev = i > 0 ? weeks[i - 1] : null;
    const prevSt = prev ? raw.status[prev.mon] : undefined;
    const prevOut = i > 0 ? out[i - 1] : null;
    const started = w.mon <= today;
    const prevCounts = !!(prev && prevSt && prev.load !== 'off' && started);
    const cells: Record<string, WeekCellDerived> = {};
    for (const p of people) {
      const entry = st?.[p];
      const carried = prevCounts && statusOf(prevSt![p]) !== 'done';
      cells[p] = {
        status: st ? statusOf(entry) : 'todo',
        link: field(entry, 'link'),
        note: field(entry, 'note'),
        line: raw.lines?.[`status/${w.mon}`]?.[p] ?? null,
        carried_from: carried ? prev!.n : null,
        carried_deliver: carried ? prev!.cells?.[p]?.deliver ?? '' : '',
        carried_twice: carried && !!prevOut?.cells[p]?.carried_from,
      };
    }
    let stale: WeekDerived['stale'] = null;
    if (prev && prevSt && prev.load !== 'off') {
      const deadline = prev.meeting || addDays(prev.mon, 6);
      const todo = people.filter((p) => statusOf(prevSt[p]) === 'todo');
      if (today > deadline && todo.length) stale = { week: prev.n, names: todo.map((p) => names.get(p) ?? p) };
    }
    const sun = addDays(w.mon, 6);
    out.push({
      n: w.n, mon: w.mon, sun, file, has_file: !!st,
      line: raw.lines?.plan?.[String(w.n)] ?? null,
      is_break: w.load === 'off' || /exam|break/i.test(w.phase),
      milestones: milestones.filter((m) => m.date >= w.mon && m.date <= sun).map((m) => m.name),
      cells,
      stale,
    });
  });
  const cur = [...weeks].reverse().find((w) => w.mon <= today && today <= addDays(w.mon, 6));
  return { weeks: out, status_file_for_today: cur ? `data/status/${cur.mon}.yaml` : null };
}

/** The whole pipeline: raw data → site data with derived state and findings. */
export function buildSiteData(rawIn: RawData, today: string, builtAt = new Date().toISOString()): SiteData {
  // decided choices copy their chosen option into the parts they decide
  const raw: RawData = { ...rawIn, choices: rawIn.choices ?? [], parts: applyDecisions(rawIn.parts, rawIn.choices ?? []) };
  const rows = computeRows(raw);
  const interfaces = computeInterfaces(raw);
  const committed = committedValues(raw.register, raw.model?.inputs ?? {});
  const findings = runChecks(raw, { rows, interfaces, committed, today });
  const derived: Derived = {
    rows,
    weekly: computeWeekly(raw, today),
    interfaces,
    committed,
    findings,
    subsystems: computeSubsystems(raw, rows, interfaces, findings),
    inbox: computeInbox(raw, rows, interfaces),
    hardware: computeHardware(raw),
    schedule_clashes: scheduleClashes(raw),
  };
  const { evidence_files: _unused, ...rest } = raw;
  void _unused;
  return { ...rest, derived, built_at: builtAt, today };
}
