// Weekly plan, build side: seed/plan.json → data/plan.yaml, and the weekly
// status file template. The plan file is written for people editing it on
// GitHub, so it is emitted by hand with comments rather than by a YAML dumper.
import { stringify } from 'yaml';
import type { Person, Plan, PlanCell, PlanMilestone, PlanWeek, TeachBack } from '../../src/types.ts';
import { addDays, weekRange } from '../../src/weekly.ts';

/** The fixed milestones the week strip marks (used until plan.yaml has its own list). */
export const DEFAULT_MILESTONES: PlanMilestone[] = [
  { date: '2026-11-27', name: 'Design approval' },
  { date: '2026-11-29', name: 'Phase 2 report' },
  { date: '2026-11-30', name: 'Phase 2 presentation', week_of: true },
  { date: '2027-01-22', name: 'Last BOM' },
  { date: '2027-02-15', name: 'Pre-demo', week_of: true },
  { date: '2027-03-22', name: 'Final demo', week_of: true },
  { date: '2027-04-02', name: 'Final report' },
];

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** A seed person id → people.yaml id (by id, alias or first name). Unknown ids are kept so the build names them. */
export function personIdMap(people: Person[]) {
  return (id: string, name = ''): string => {
    const k = id.trim().toLowerCase();
    const n = name.trim().toLowerCase();
    const p = people.find((x) => x.id === k || (x.aliases ?? []).includes(k))
      ?? people.find((x) => n && (x.name.toLowerCase() === n || (x.aliases ?? []).includes(n)));
    return p ? p.id : id;
  };
}

function teachFrom(t: unknown): string | TeachBack {
  if (!t || typeof t !== 'object') return str(t);
  const o = t as Record<string, unknown>;
  return {
    question: str(o.question ?? o.q ?? o.text ?? o.topic ?? ''),
    presenter: str(o.presenter ?? o.by ?? o.who ?? o.p ?? ''),
  };
}

/** seed/plan.json (people[], weeks[] with cells {id: {d, l, q}}) → Plan. Text is kept verbatim. */
export function planFromSeed(seed: unknown, people: Person[], keep?: Plan): Plan {
  const s = (seed ?? {}) as { people?: { id: string; name?: string }[]; weeks?: Record<string, unknown>[] };
  const map = personIdMap(people);
  const seedNames = new Map((s.people ?? []).map((p) => [String(p.id), p.name ?? '']));
  const meetings = new Map((keep?.weeks ?? []).map((w) => [w.mon, w.meeting ?? '']));
  const weeks: PlanWeek[] = (s.weeks ?? []).map((w) => {
    const cells: Record<string, PlanCell> = {};
    for (const [pid, c] of Object.entries((w.cells ?? {}) as Record<string, Record<string, unknown>>)) {
      cells[map(pid, seedNames.get(pid))] = {
        deliver: str(c?.d ?? c?.deliver), learn: str(c?.l ?? c?.learn), ask: str(c?.q ?? c?.ask),
      };
    }
    const mon = str(w.mon);
    return {
      n: Number(w.n), mon, meeting: str(w.meeting) || meetings.get(mon) || '',
      phase: str(w.phase), milestone: str(w.milestone), load: str(w.load || 'full') as PlanWeek['load'],
      brief: str(w.brief), teach: teachFrom(w.teach), cells,
    };
  });
  return { milestones: keep?.milestones?.length ? keep.milestones : DEFAULT_MILESTONES, weeks };
}

const q = (v: string) => stringify(v, { lineWidth: 0 }).trimEnd();
/** Long text as a folded block so it reads like a paragraph on GitHub. */
function text(key: string, v: string, indent: string): string {
  if (v.length < 70 || v.includes('\n') || /^\s|\s$/.test(v)) return `${indent}${key}: ${q(v)}`;
  return `${indent}${key}: >-\n${indent}  ${v}`;
}

/** Plan → data/plan.yaml text, with the editing guide as comments. */
export function planYaml(plan: Plan, people: Person[]): string {
  const order = people.map((p) => p.id);
  const out = [
    '# BOREALIS weekly plan: the editable plan behind #/week, #/person/<id> and #/plan.',
    '# Edit on GitHub (pencil icon), then commit as:  plan: <what changed> · <why>',
    '# Re-plan only after Phase 2, after the pre-demo, or when someone is carried twice.',
    '#',
    '# Each week: n, mon (that Monday, YYYY-MM-DD), meeting (team meeting date, optional),',
    '# phase, milestone, load (full | light | off), brief (team paragraph), teach (teach-back),',
    '# and one cell per person: deliver (by the team meeting), learn, ask (one-on-one question).',
    '# Status does not live here: each week has data/status/<monday>.yaml.',
    ...(plan.placeholder ? [
      '#',
      '# PLACEHOLDER: the real plan was not in the repo yet. Upload seed/plan.json and the next',
      '# build replaces this file with it (keeping any meeting dates set here).',
      'placeholder: true',
    ] : []),
    '',
    '# Fixed milestones marked on the week strip (dotted) and counted down in the week header.',
    'milestones:',
    ...plan.milestones.map((m) => `  - { date: ${m.date}, name: ${JSON.stringify(m.name)}${m.week_of ? ', week_of: true' : ''} }`),
    '',
    'weeks:',
  ];
  for (const w of plan.weeks) {
    out.push(
      `  - n: ${w.n}`,
      `    mon: ${w.mon}            # ${weekRange(w.mon)}`,
      `    meeting: ${q(w.meeting ?? '')}${w.meeting ? '' : '          # team meeting date, e.g. ' + addDays(w.mon, 3)}`,
      `    phase: ${q(w.phase)}`,
      `    milestone: ${q(w.milestone)}`,
      `    load: ${w.load}`,
      text('brief', w.brief, '    '),
    );
    if (typeof w.teach === 'string') out.push(text('teach', w.teach, '    '));
    else out.push('    teach:', text('question', w.teach.question, '      '), text('presenter', w.teach.presenter, '      '));
    out.push('    cells:');
    const ids = [...order.filter((id) => id in w.cells), ...Object.keys(w.cells).filter((id) => !order.includes(id))];
    for (const id of ids) {
      const c = w.cells[id];
      out.push(`      ${id}:`, text('deliver', c.deliver, '        '), text('learn', c.learn, '        '), text('ask', c.ask, '        '));
    }
    out.push('');
  }
  return out.join('\n');
}

/** A new week's status file: one block per person, all todo. */
export function statusFileText(week: Pick<PlanWeek, 'n' | 'mon'>, people: Person[]): string {
  return [
    `# Week ${week.n} · ${weekRange(week.mon)} · status. Update only your own block:`,
    '#   1. status: done | carried | blocked   (todo until you change it)',
    '#   2. link: a link to the deliverable (repo file, Drive file, screenshot). Links, never uploads.',
    '#   3. note: optional, one line. Then Commit changes as  <name>: <status> · <short note>',
    '',
    ...people.flatMap((p) => [`${p.id}:`, '  status: todo', '  link: ""', '  note: ""', '']),
  ].join('\n');
}

/** Line of each "- n: <week>" in plan.yaml. */
export function planLines(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*-\s+n:\s*(\d+)/);
    if (m) out[m[1]] = i + 1;
  });
  return out;
}

/** Line of each top-level "<person>:" key in a status file. */
export function statusLines(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^([A-Za-z0-9_-]+):/);
    if (m) out[m[1]] = i + 1;
  });
  return out;
}
