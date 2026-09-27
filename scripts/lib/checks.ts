// Data checks. Errors fail the build; warnings show in the site's health panel.
import type { Finding, InterfaceDerived, RawData, RowDerived } from '../../src/types.ts';
import {
  APPROVAL_STATUSES, AVAILABILITIES, CONDITION_FIELDS, INTERFACE_STATUSES, PART_STATUSES, RUNG_STATUSES, TAGS, TRACKS,
} from '../../src/types.ts';
import { constantsFrom, evaluate, inputsFrom, passband, firstNumber } from '../../src/model.ts';

interface Ctx {
  rows: Record<string, RowDerived>;
  interfaces: Record<string, InterfaceDerived>;
  committed: Record<string, number>;
  today: string;
}

const NON_ASCII_QUOTES = /[‘’‚‛“”„‟′″«»‹›＂＇]/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

export function runChecks(raw: RawData, ctx: Ctx): Finding[] {
  const out: Finding[] = [];
  const err = (code: string, message: string, ids: string[] = []) => out.push({ level: 'error', code, message, ids });
  const warn = (code: string, message: string, ids: string[] = []) => out.push({ level: 'warning', code, message, ids });

  const people = new Set((raw.people ?? []).map((p) => p.id));
  const subsystems = new Set((raw.subsystems ?? []).map((s) => s.id));
  const rowIds = new Set((raw.register ?? []).map((r) => r.id));
  const ifaceIds = new Set((raw.interfaces ?? []).map((i) => i.id));
  const byId = new Map((raw.register ?? []).map((r) => [r.id, r]));

  // ---- duplicate ids ----
  const dupCheck = (what: string, ids: (string | number)[]) => {
    const seen = new Set<string>();
    for (const id of ids.map(String)) {
      if (seen.has(id)) err('duplicate-id', `duplicate id ${id} in ${what}`, [id]);
      seen.add(id);
    }
  };
  dupCheck('register.yaml', raw.register.map((r) => r.id));
  dupCheck('parts.yaml', raw.parts.map((p) => p.id));
  dupCheck('interfaces.yaml', raw.interfaces.map((i) => i.id));
  dupCheck('people.yaml', raw.people.map((p) => p.id));
  dupCheck('subsystems.yaml', raw.subsystems.map((s) => s.id));
  dupCheck('approvals.yaml', raw.approvals.map((a) => a.id));
  dupCheck('open_items.yaml', raw.open_items.map((o) => o.n));
  dupCheck('presets.yaml', raw.presets.map((p) => p.id));
  dupCheck('ids across register/parts/interfaces/approvals', [
    ...raw.register.map((r) => r.id), ...raw.parts.map((p) => p.id), ...raw.interfaces.map((i) => i.id), ...raw.approvals.map((a) => a.id),
  ]);

  // ---- non-ASCII quote characters in ids ----
  const allIds: string[] = [
    ...raw.register.flatMap((r) => [r.id, ...r.feeds_into]),
    ...raw.parts.map((p) => p.id), ...raw.interfaces.map((i) => i.id), ...raw.people.map((p) => p.id),
    ...raw.subsystems.map((s) => s.id), ...raw.approvals.map((a) => a.id),
    ...raw.milestones.rungs.flatMap((r) => r.blocked_by ?? []),
  ].map(String);
  for (const id of allIds) {
    if (NON_ASCII_QUOTES.test(id)) err('non-ascii-quote', `id ${JSON.stringify(id)} contains a non-ASCII quote character`, [id]);
  }

  const knownRef = (id: string) => rowIds.has(id);
  const checkOwner = (where: string, owner: string, ids: string[]) => {
    if (!people.has(owner)) err('unknown-owner', `${where}: unknown owner "${owner}" (not in people.yaml)`, ids);
  };
  const checkSubsystem = (where: string, s: string, ids: string[]) => {
    if (!subsystems.has(s)) err('unknown-subsystem', `${where}: unknown subsystem "${s}"`, ids);
  };
  const checkEnum = (where: string, field: string, v: string, allowed: readonly string[], ids: string[]) => {
    if (!allowed.includes(v)) err('bad-enum', `${where}: ${field} "${v}" is not one of ${allowed.join(' | ')}`, ids);
  };
  const checkSuperseded = (where: string, list: string[] | undefined) => {
    for (const id of list ?? []) if (!knownRef(id)) err('unknown-id', `${where}: superseded_by "${id}" is not a register id`, [id]);
  };

  // ---- register ----
  for (const r of raw.register) {
    const w = `register ${r.id}`;
    for (const d of r.feeds_into) {
      if (!rowIds.has(d)) err('unknown-feeds-into', `${w}: feeds_into "${d}" is not a register id`, [r.id]);
    }
    checkOwner(w, r.owner, [r.id]);
    checkSubsystem(w, r.subsystem, [r.id]);
    checkEnum(w, 'tag', r.tag, TAGS, [r.id]);
    checkEnum(w, 'track', r.track, TRACKS, [r.id]);
    if (!DATE.test(String(r.changed))) err('bad-date', `${w}: changed "${r.changed}" is not YYYY-MM-DD`, [r.id]);
    if (!DATE.test(String(r.checked))) err('bad-date', `${w}: checked "${r.checked}" is not YYYY-MM-DD`, [r.id]);

    if (r.tag === 'MEASURED') {
      const c = (r.conditions ?? {}) as Record<string, unknown>;
      const missing = CONDITION_FIELDS.filter((f) => c[f] === undefined || c[f] === null || c[f] === '');
      if (missing.length) {
        err('measured-without-conditions', `${w}: MEASURED but conditions are missing ${missing.join(', ')}`, [r.id]);
      } else {
        const ev = String(c.evidence);
        if (!ev.startsWith('evidence/')) err('measured-without-conditions', `${w}: evidence "${ev}" must be a path under evidence/`, [r.id]);
        else if (raw.evidence_files.length && !raw.evidence_files.includes(ev)) {
          err('measured-without-conditions', `${w}: evidence file ${ev} does not exist`, [r.id]);
        }
        for (const f of CONDITION_FIELDS.filter((f) => f !== 'evidence')) {
          if (typeof c[f] !== 'number') err('measured-without-conditions', `${w}: conditions.${f} must be a number`, [r.id]);
        }
      }
    } else if (r.conditions) {
      warn('conditions-not-measured', `${w}: has conditions but tag is ${r.tag} (conditions only apply to MEASURED)`, [r.id]);
    }

    if (r.feeds_into.length === 0 && !String(r.note ?? '').trim()) {
      warn('incomplete-row', `${w}: no feeds_into and no note (probably incomplete)`, [r.id]);
    }
    if (r.tag === 'TBD' && DATE.test(String(r.changed)) && daysBetween(r.changed, ctx.today) > raw.site.tbd_max_age_days) {
      warn('old-tbd', `${w}: tagged TBD since ${r.changed} (more than ${raw.site.tbd_max_age_days} days)`, [r.id]);
    }
  }

  // ---- core rows must not depend on flight rows (07 §2 D6; 01 §3.1 "flight-independent") ----
  // Any path from a flight row down to a core row contains a flight → core
  // edge, so each such edge is reported once, with the core rows it reaches.
  const downstreamOf = (start: string): string[] => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const id = queue.shift()!;
      for (const d of byId.get(id)?.feeds_into ?? []) {
        if (!seen.has(d)) { seen.add(d); queue.push(d); }
      }
    }
    return [...seen].filter((id) => byId.get(id)?.track === 'core');
  };
  for (const f of raw.register) {
    if (f.track !== 'flight') continue;
    for (const d of f.feeds_into) {
      const target = byId.get(d);
      if (target?.track !== 'core') continue;
      const reached = downstreamOf(d);
      err('core-depends-on-flight',
        `core row ${d} depends on flight row ${f.id} (${f.id} feeds_into ${d})` +
          (reached.length ? `; through it ${reached.length} more core row(s) do too: ${reached.join(', ')}` : ''),
        [d, f.id]);
    }
  }

  // ---- subsystems ----
  for (const s of raw.subsystems) {
    const w = `subsystem ${s.id}`;
    checkOwner(w, s.owner, []);
    checkEnum(w, 'track', s.track, TRACKS, []);
    if (!s.intro?.length) err('empty-intro', `${w}: intro is empty`);
    if (!s.gotchas?.length) err('empty-gotchas', `${w}: gotchas list is empty`);
    for (const [i, t] of (s.intro ?? []).entries()) {
      if (!String(t.text ?? '').trim()) err('empty-intro', `${w}: intro sentence ${i + 1} is empty`);
      if (!String(t.cite ?? '').trim()) err('missing-cite', `${w}: intro sentence ${i + 1} has no cite`);
      checkSuperseded(`${w} intro`, t.superseded_by);
    }
    for (const g of s.gotchas ?? []) {
      if (typeof g.n !== 'number' || !String(g.text ?? '').trim()) err('empty-gotchas', `${w}: gotcha needs n (01 §13 number) and text`);
      checkSuperseded(`${w} gotcha ${g.n}`, g.superseded_by);
    }
  }

  // ---- people ----
  for (const p of raw.people) {
    for (const s of p.subsystems ?? []) checkSubsystem(`person ${p.id}`, s, []);
    const owns = raw.register.filter((r) => r.owner === p.id).length;
    if (owns === 0) warn('person-no-rows', `${p.name} (${p.id}) owns no register rows`, [p.id]);
  }

  // ---- parts ----
  for (const p of raw.parts) {
    const w = `part ${p.id}`;
    checkSubsystem(w, p.subsystem, [p.id]);
    checkEnum(w, 'status', p.status, PART_STATUSES, [p.id]);
    checkEnum(w, 'track', p.track, TRACKS, [p.id]);
    if (!String(p.cite ?? '').trim()) err('missing-cite', `${w}: no cite`, [p.id]);
    checkSuperseded(w, p.superseded_by);
  }

  // ---- hardware view fields (parts.yaml) ----
  const partText = (p: RawData['parts'][number]) => [p.name, p.role, p.candidates, p.downstream, p.gotchas, ...p.fields.map((f) => `${f.name} ${f.value}`)].join(' ');
  for (const p of raw.parts) {
    const w = `part ${p.id}`;
    if (p.availability !== undefined) checkEnum(w, 'availability', p.availability, AVAILABILITIES, [p.id]);
    if (p.availability === 'blocked' && !String(p.blocked_reason ?? '').trim()) {
      err('blocked-without-reason', `${w}: availability is blocked but blocked_reason is empty`, [p.id]);
    }
    for (const t of p.touches ?? []) {
      if (!rowIds.has(t) && !ifaceIds.has(t)) err('unknown-id', `${w}: touches "${t}" is not a register or interface id`, [p.id]);
    }
    if (p.hotspot) {
      if (!['station', 'bench'].includes(p.hotspot.view)) err('bad-enum', `${w}: hotspot.view "${p.hotspot.view}" is not station | bench`, [p.id]);
      if (p.hotspot.view === 'station' && (typeof p.hotspot.x !== 'number' || typeof p.hotspot.y !== 'number')) {
        err('bad-hotspot', `${w}: a station hotspot needs numeric x and y`, [p.id]);
      }
    }
    if (p.est_cost_cad !== undefined && p.est_cost_cad !== null && typeof p.est_cost_cad !== 'number') {
      err('bad-cost', `${w}: est_cost_cad must be a number or null`, [p.id]);
    }
    if (p.datasheet_url && !/^https?:\/\//.test(p.datasheet_url)) err('bad-url', `${w}: datasheet_url must be an http(s) URL`, [p.id]);

    // procurement: no used-market purchases (constraints.yaml)
    const source = String(p.source ?? '').toLowerCase();
    const says = (t: string) => /\bused\b/i.test(t);
    if ((says([p.role, p.candidates].join(' ')) || says(source)) && !/\bnew\b|\bborrow/.test(source)) {
      warn('used-market', `${w}: Used-market purchase not allowed (constraints.yaml)`, [p.id]);
    }
    // Class 2: core part still specified at 850 nm (or 800–900 nm)
    if (p.track === 'core' && p.availability) {
      const text = `${p.model_line ?? ''} ${partText(p)}`;
      if (/\b850\s*(nm|\/)|800\s*[–-]\s*900\s*nm/i.test(text) && !p.class2_note && !p.blocked_reason) {
        warn('class2-unchecked', `${w}: Not checked against the Class 2 ${raw.constraints?.class2?.wavelength_nm ?? ''} nm baseline`, [p.id]);
      }
    }
    if (p.availability === 'candidate' && !String(p.model_line ?? '').trim()) {
      warn('candidate-no-model', `${w}: availability candidate but no model_line`, [p.id]);
    }
  }
  const budget = Number(raw.constraints?.budget_cad ?? 0);
  const priced = raw.parts.filter((p) => p.track === 'core' && p.availability && p.availability !== 'available' && typeof p.est_cost_cad === 'number');
  const total = priced.reduce((a, p) => a + (p.est_cost_cad as number), 0);
  if (budget && total > budget) {
    warn('over-budget', `Priced core parts total $${total} CAD, over the ~$${budget} CAD budget (constraints.yaml)`, priced.map((p) => p.id));
  }

  // ---- software.yaml ----
  const sw = raw.software;
  if (sw) {
    const partIds = new Set(raw.parts.map((p) => p.id));
    if (!partIds.has(sw.part)) err('unknown-id', `software.yaml: part "${sw.part}" is not in parts.yaml`);
    for (const o of [sw.owner, ...sw.fallback, sw.laptop.owner, sw.boards.owner, ...sw.choices.map((c) => c.owner)]) checkOwner('software.yaml', o, []);
    for (const m of [...sw.laptop.modules, ...sw.boards.modules]) {
      for (const t of m.talks_to ?? []) {
        if (!rowIds.has(t) && !ifaceIds.has(t) && !partIds.has(t)) err('unknown-id', `software.yaml ${m.name}: talks_to "${t}" is not a part, register or interface id`);
      }
    }
    for (const c of sw.choices) checkEnum(`software.yaml choice ${c.name}`, 'stage', c.stage, ['exploring', 'narrowing', 'decided'], []);
  }

  // ---- open items ----
  for (const o of raw.open_items) {
    const w = `open item #${o.n}`;
    for (const ow of o.owners ?? []) checkOwner(w, ow, []);
    checkSubsystem(w, o.subsystem, []);
    checkEnum(w, 'track', o.track, TRACKS, []);
    if (!String(o.cite ?? '').trim()) err('missing-cite', `${w}: no cite`);
    checkSuperseded(w, o.superseded_by);
  }

  // ---- decisions ----
  for (const d of raw.decisions) {
    const w = `decision ${d.date} ${d.area}`;
    if (!String(d.cite ?? '').trim()) err('missing-cite', `${w}: no cite`);
    for (const s of d.subsystems ?? []) checkSubsystem(w, s, []);
    if (!d.subsystems?.length) warn('decision-unmapped', `${w}: not mapped to any subsystem, so no page shows it`);
    checkSuperseded(w, d.superseded_by);
  }

  // ---- interfaces ----
  for (const i of raw.interfaces) {
    const w = `interface ${i.id}`;
    const ends = [i.from, ...(Array.isArray(i.to) ? i.to : [i.to])];
    for (const e of ends) {
      if (!subsystems.has(e)) err('interface-endpoint', `${w}: from/to "${e}" is not a subsystem`, [i.id]);
    }
    for (const o of i.owners ?? []) checkOwner(w, o, [i.id]);
    checkEnum(w, 'status', i.status, INTERFACE_STATUSES, [i.id]);
    const d = ctx.interfaces[i.id];
    if (d?.downgraded) {
      warn('interface-spec-changed',
        `${w}: status is agreed but spec_hash "${i.spec_hash}" does not match the spec (${d.computed_hash}); shown as draft until the downstream owner re-agrees`,
        [i.id]);
    }
  }

  // ---- approvals ----
  for (const a of raw.approvals) {
    const w = `approval ${a.id}`;
    if (!APPROVAL_STATUSES.includes(a.status)) err('approval-status', `${w}: status "${a.status}" is not one of ${APPROVAL_STATUSES.join(' | ')}`, [a.id]);
    checkSubsystem(w, a.subsystem, [a.id]);
  }

  // ---- milestones / rungs ----
  for (const r of raw.milestones.rungs) {
    const w = `rung ${r.n}`;
    checkEnum(w, 'status', r.status, RUNG_STATUSES, []);
    for (const b of r.blocked_by ?? []) {
      if (!rowIds.has(b) && !ifaceIds.has(b)) err('unknown-id', `${w}: blocked_by "${b}" is not a register or interface id`, [b]);
      if (ifaceIds.has(b) && ctx.interfaces[b]?.status === 'missing') {
        warn('rung-blocked-missing-interface', `interface ${b} is missing and blocks rung ${r.n} (${r.name})`, [b]);
      }
    }
  }
  for (const m of raw.milestones.dates) {
    if (!DATE.test(String(m.date))) err('bad-date', `milestone ${m.name}: date "${m.date}" is not YYYY-MM-DD`);
  }

  // ---- presets and model ----
  for (const p of raw.presets) {
    for (const k of Object.keys(p.values ?? {})) {
      if (!rowIds.has(k)) err('unknown-id', `preset ${p.id}: "${k}" is not a register id`, [k]);
    }
  }
  const m = raw.model;
  for (const [key, id] of Object.entries(m.inputs)) {
    if (!rowIds.has(id)) err('unknown-id', `model input ${key}: "${id}" is not a register id`, [id]);
    else if (ctx.committed[id] === undefined) err('model-input', `model input ${key}: register ${id} value "${byId.get(id)?.value}" has no number in it`, [id]);
  }
  for (const c of m.controls) if (!rowIds.has(c.param)) err('unknown-id', `sandbox control: "${c.param}" is not a register id`, [c.param]);
  for (const id of [...Object.values(m.outputs ?? {}), ...Object.values(m.checks ?? {})]) {
    if (!rowIds.has(id)) err('unknown-id', `model.yaml outputs/checks: "${id}" is not a register id`, [id]);
  }

  // ---- warnings computed with the committed values ----
  if (!out.some((f) => f.code === 'model-input' || f.level === 'error' && f.message.startsWith('model input'))) {
    try {
      const res = evaluate(inputsFrom(ctx.committed, m.inputs), constantsFrom(m.constants));
      if (res.c1.margin_db < 0) {
        warn('c1-margin-negative', `C1 margin is ${res.c1.margin_db.toFixed(1)} dB with committed values (MODELED); the link does not close on paper`, [m.outputs.c1_margin]);
      }
    } catch (e) {
      err('model-input', `model could not run with committed values: ${(e as Error).message}`);
    }
  }
  const filterRow = byId.get(m.checks.filter);
  const wlRow = byId.get(m.checks.wavelength);
  if (filterRow && wlRow) {
    const band = passband(filterRow.value);
    const wl = firstNumber(wlRow.value);
    if (band && wl !== null && (wl < band[0] || wl > band[1])) {
      warn('filter-passband', `${filterRow.id} passband ${band[0]}–${band[1]} nm does not contain the ${wlRow.id} wavelength ${wl} nm`, [filterRow.id, wlRow.id]);
    }
  }

  return out;
}

export const errorsOf = (f: Finding[]) => f.filter((x) => x.level === 'error');
export const warningsOf = (f: Finding[]) => f.filter((x) => x.level === 'warning');
