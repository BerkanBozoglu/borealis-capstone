import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildSiteData } from '../scripts/lib/derive.ts';
import { errorsOf } from '../scripts/lib/checks.ts';
import { planFromSeed, planYaml, statusFileText } from '../scripts/lib/plan.ts';
import { renderPerson, renderPlan, renderWeek } from '../src/render/weekly.ts';
import { renderMap } from '../src/render/map.ts';
import { currentWeekIndex, firstSentence, weekPost, DISCORD_LIMIT } from '../src/weekly.ts';
import type { Ctx } from '../src/render/util.ts';
import type { RawData } from '../src/types.ts';
import { clone, loadRawData } from './helpers.ts';

const NOW = '2026-10-27'; // Tuesday of week 3 (Monday 2026-10-26)
const ctxFor = (data: ReturnType<typeof buildSiteData>, now = NOW, query = ''): Ctx => ({
  data, history: [], showFlight: true, now: new Date(`${now}T12:00:00`), issues: null, lastSeen: null,
  query: new URLSearchParams(query), baseUrl: 'https://example.test/',
});
const entry = (status: string, link = '', note = '') => ({ status, link, note });
/** raw data with only the given status files */
function withStatus(files: Record<string, Record<string, unknown>>, edit?: (r: RawData) => void): RawData {
  const raw = clone(loadRawData());
  raw.status = files;
  raw.lines = { ...raw.lines };
  for (const k of Object.keys(raw.lines)) if (k.startsWith('status/')) delete raw.lines[k];
  edit?.(raw);
  return raw;
}
const allTodo = (raw: RawData) => Object.fromEntries(raw.people.map((p) => [p.id, entry('todo')]));
const cards = (html: string) => [...html.matchAll(/<article class="card wk-card wk-st-(\w+)" id="wk-p-(\w+)"/g)].map((m) => [m[2], m[1]]);

describe('weekly plan data', () => {
  const raw = loadRawData();
  it('the plan has 25 weeks, every week a cell for each of the six people, and passes the checks', () => {
    expect(raw.plan.weeks).toHaveLength(25);
    expect(raw.people.map((p) => p.id)).toEqual(['berky', 'bilal', 'batu', 'sbaz', 'matei', 'arnav']);
    for (const w of raw.plan.weeks) expect(Object.keys(w.cells).sort()).toEqual(raw.people.map((p) => p.id).sort());
    const errors = errorsOf(buildSiteData(raw, NOW).derived.findings);
    expect(errors).toEqual([]);
  });
  it('the current week is the latest week whose Monday is on or before today', () => {
    const weeks = raw.plan.weeks;
    expect(weeks[currentWeekIndex(weeks, '2026-10-26')].n).toBe(3);
    expect(weeks[currentWeekIndex(weeks, '2026-11-01')].n).toBe(3);
    expect(weeks[currentWeekIndex(weeks, '2026-11-02')].n).toBe(4);
    expect(weeks[currentWeekIndex(weeks, '2026-01-01')].n).toBe(1);
  });
});

describe('#/week', () => {
  it('opens on the current week with six owner cards and the edit, copy and update buttons', () => {
    const raw = withStatus({});
    raw.status['2026-10-26'] = allTodo(raw);
    const html = renderWeek(ctxFor(buildSiteData(raw, NOW)), null);
    expect(html).toContain('data-week="3"');
    expect(cards(html)).toHaveLength(6);
    expect(html).toContain('Edit this week');
    expect(html).toContain('data-wk-copy');
    expect(html.match(/edit\/main\/data\/status\/2026-10-26\.yaml/g)).toHaveLength(6);
    expect(html.match(/<li><a class="pip/g)).toHaveLength(25);
  });
  it('a status change shows on that person\'s card, and the next week shows it carried', () => {
    const raw = withStatus({});
    raw.status['2026-10-26'] = { ...allTodo(raw), bilal: entry('done', 'https://drive.google.com/x', 'TIA board v1') };
    const now = buildSiteData(raw, NOW);
    expect(cards(renderWeek(ctxFor(now), '3'))).toContainEqual(['bilal', 'done']);
    expect(renderWeek(ctxFor(now), '3')).toContain('TIA board v1');
    // next week: everyone but Bilal carried from week 3
    raw.status['2026-11-02'] = allTodo(raw);
    const next = buildSiteData(raw, '2026-11-03');
    const html = renderWeek(ctxFor(next, '2026-11-03'), null);
    expect(html).toContain('data-week="4"');
    const d = next.derived.weekly.weeks[3];
    expect(d.cells.bilal.carried_from).toBeNull();
    for (const p of ['berky', 'batu', 'sbaz', 'matei', 'arnav']) expect(d.cells[p].carried_from).toBe(3);
    expect(html.match(/Carried from week 3/g)).toHaveLength(5);
  });
  it('carried twice raises "Re-plan with <lead>"; an off week carries nothing', () => {
    const raw = withStatus({});
    raw.status['2026-10-19'] = { ...allTodo(raw), batu: entry('blocked') };
    raw.status['2026-10-26'] = { ...allTodo(raw), batu: entry('carried') };
    raw.status['2026-11-02'] = allTodo(raw);
    const data = buildSiteData(raw, '2026-11-03');
    expect(data.derived.weekly.weeks[3].cells.batu.carried_twice).toBe(true);
    expect(renderWeek(ctxFor(data, '2026-11-03'), '4')).toContain('Re-plan with Berky');
    // weeks 11 and 12 are off: week 12 and 13 carry nothing from them
    raw.status['2026-12-21'] = allTodo(raw);
    raw.status['2026-12-28'] = allTodo(raw);
    raw.status['2027-01-04'] = allTodo(raw);
    const later = buildSiteData(raw, '2027-01-05');
    expect(later.derived.weekly.weeks[11].cells.batu.carried_from).toBeNull();
    expect(later.derived.weekly.weeks[12].cells.batu.carried_from).toBeNull();
  });
  it('a week without a status file carries nothing (tracking started mid-plan)', () => {
    const raw = withStatus({});
    raw.status['2026-10-26'] = allTodo(raw);
    const data = buildSiteData(raw, NOW);
    expect(Object.values(data.derived.weekly.weeks[2].cells).every((c) => c.carried_from === null)).toBe(true);
  });
  it('stale banner: last week still todo after its meeting date, else after its Sunday', () => {
    const raw = withStatus({});
    raw.status['2026-10-19'] = { ...allTodo(raw), berky: entry('done'), bilal: entry('done'), sbaz: entry('done'), matei: entry('done'), arnav: entry('blocked') };
    raw.status['2026-10-26'] = allTodo(raw);
    expect(renderWeek(ctxFor(buildSiteData(raw, NOW)), '3')).toContain('Week 2 not updated: Batu');
    // meeting moved to this Wednesday: no banner until it has passed
    raw.plan.weeks[1].meeting = '2026-10-28';
    expect(buildSiteData(raw, NOW).derived.weekly.weeks[2].stale).toBeNull();
    expect(buildSiteData(raw, '2026-10-29').derived.weekly.weeks[2].stale?.names).toEqual(['Batu']);
  });
  it('a status file the build created but nobody committed yet opens GitHub\'s new-file page, pre-filled', () => {
    const raw = withStatus({});
    raw.status['2026-10-26'] = allTodo(raw);
    const data = buildSiteData(raw, NOW);
    data.derived.weekly.weeks[2].new_file_text = statusFileText({ n: 3, mon: '2026-10-26' }, raw.people);
    const html = renderWeek(ctxFor(data), null);
    expect(html.match(/\/new\/main\?filename=data%2Fstatus%2F2026-10-26\.yaml&amp;value=/g)).toHaveLength(6);
  });
  it('future weeks: the update button waits for the week to open', () => {
    const html = renderWeek(ctxFor(buildSiteData(withStatus({}), NOW)), '10');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('data-wk-update');
  });
});

describe('week post', () => {
  const long = 'Bring the TIA board up on the bench and capture the step response at three bias points. '.repeat(6);
  it('stays under 2000 characters by cutting deliver text to its first sentence, and keeps the link', () => {
    const lines = ['Berky', 'Bilal', 'Batu', 'Sbaz', 'Matei', 'Arnav'].map((name, i) => ({ name, deliver: long, carried: i === 1 }));
    const p = weekPost({ n: 3, mon: '2026-10-26', milestone: '31 days to Design approval', brief: 'Team brief.', lines, url: 'https://example.test/#/week/3' });
    expect(p.shortened).toBe(true);
    expect(p.text.length).toBeLessThanOrEqual(DISCORD_LIMIT);
    expect(p.text.split('\n')[0]).toBe('**Week 3 · 26 Oct – 1 Nov · 31 days to Design approval**');
    expect(p.text).toContain(`**Bilal:** ${firstSentence(long)} (carried from last week)`);
    expect(p.text.endsWith('Full details and status: <https://example.test/#/week/3>')).toBe(true);
  });
  it('is cut evenly when even first sentences are too long', () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, deliver: 'x'.repeat(900), carried: false }));
    const p = weekPost({ n: 1, mon: '2026-10-12', milestone: null, brief: 'y'.repeat(900), lines, url: 'https://e.test/#/week/1' });
    expect(p.text.length).toBeLessThanOrEqual(DISCORD_LIMIT);
    expect(p.text).toContain('<https://e.test/#/week/1>');
  });
  it('the week page carries the post text and its character count', () => {
    const html = renderWeek(ctxFor(buildSiteData(withStatus({}), NOW)), null);
    const text = html.match(/<textarea id="wk-post"[^>]*>([\s\S]*?)<\/textarea>/)![1];
    expect(text).toContain('**Week 3 · 26 Oct – 1 Nov');
    expect(text).toContain('https://example.test/#/week/3');
    expect(html).toContain('/ 2000 characters');
  });
});

describe('#/person and #/plan', () => {
  it('#/person/bilal shows all 25 weeks with status and link, current week highlighted', () => {
    const raw = withStatus({});
    raw.status['2026-10-19'] = { ...allTodo(raw), bilal: entry('done', 'evidence/README.md') };
    raw.status['2026-10-26'] = allTodo(raw);
    const html = renderPerson(ctxFor(buildSiteData(raw, NOW)), 'bilal');
    expect(html.match(/id="row-wk-\d+"/g)).toHaveLength(25);
    expect(html).toMatch(/class="wk-row current"[^>]*id="row-wk-3"/);
    expect(html).toContain('blob/main/evidence/README.md');
    expect(html).toContain('data-status="done"');
  });
  it('an alias opens the same person (berkan → Berky)', () => {
    expect(renderPerson(ctxFor(buildSiteData(withStatus({}), NOW)), 'berkan')).toContain('<h1>Berky');
  });
  it('#/plan lists every week; the person picker narrows it to one person', () => {
    const data = buildSiteData(withStatus({}), NOW);
    expect(renderPlan(ctxFor(data)).match(/<tr id="row-wk-/g)).toHaveLength(25);
    expect(renderPlan(ctxFor(data, NOW, 'person=matei'))).toContain('<option value="matei" selected>');
  });
});

describe('weekly build checks', () => {
  const codes = (raw: RawData) => errorsOf(buildSiteData(raw, NOW).derived.findings).map((f) => `${f.code}: ${f.message}`);
  it('unknown person id in a status file or a plan cell', () => {
    expect(codes(withStatus({ '2026-10-26': { berkn: entry('done') } })).join('\n')).toContain('unknown person id "berkn"');
    expect(codes(withStatus({}, (r) => { r.plan.weeks[0].cells.zed = { deliver: '', learn: '', ask: '' }; })).join('\n')).toContain('unknown person id "zed"');
  });
  it('a status outside the enum (case is forgiven)', () => {
    expect(codes(withStatus({ '2026-10-26': { bilal: entry('finished') } })).join('\n')).toContain('status "finished" is not one of todo | done | carried | blocked');
    expect(codes(withStatus({ '2026-10-26': { bilal: entry('Done') } }))).toEqual([]);
  });
  it('a week missing a cell for a person', () => {
    expect(codes(withStatus({}, (r) => { delete r.plan.weeks[4].cells.arnav; })).join('\n')).toContain('week 5: no cell for "arnav"');
  });
  it('a status file whose date is not a Monday in plan.yaml', () => {
    expect(codes(withStatus({ '2026-10-27': {} })).join('\n')).toContain('"2026-10-27" is not the Monday of a week');
    expect(codes(withStatus({ '2027-06-07': {} })).join('\n')).toContain('"2027-06-07" is not the Monday of a week');
  });
  it('duplicate week numbers', () => {
    expect(codes(withStatus({}, (r) => { r.plan.weeks[5].n = 5; })).join('\n')).toContain('week number 5 appears twice');
  });
});

describe('seed conversion and generated files', () => {
  const people = loadRawData().people;
  const seed = {
    people: [{ id: 'berkan', name: 'Berkan', role: 'lead' }, { id: 'bilal', name: 'Bilal', role: 'rx' }],
    weeks: [{ n: 1, mon: '2026-10-12', phase: 'P2', milestone: '', brief: 'Brief: with a colon # and hash', teach: { q: 'Why 660 nm?', by: 'Berkan' }, load: 'full',
      cells: { berkan: { d: 'Deliver A.', l: 'Learn A.', q: 'Ask A?' }, bilal: { d: 'yes', l: '', q: '' } } }],
  };
  it('maps berkan → berky and d/l/q → deliver/learn/ask, text verbatim, keeping meeting dates', () => {
    const plan = planFromSeed(seed, people, { milestones: [], weeks: [{ n: 1, mon: '2026-10-12', meeting: '2026-10-15' } as never] });
    expect(plan.weeks[0].cells.berky).toEqual({ deliver: 'Deliver A.', learn: 'Learn A.', ask: 'Ask A?' });
    expect(plan.weeks[0].meeting).toBe('2026-10-15');
    expect(plan.weeks[0].teach).toEqual({ question: 'Why 660 nm?', presenter: 'Berkan' });
    // the written YAML reads back to the same plan
    const back = parse(planYaml(plan, people));
    expect(back.weeks[0].brief).toBe('Brief: with a colon # and hash');
    expect(back.weeks[0].cells.bilal.deliver).toBe('yes');
    expect(back.weeks[0].cells.berky.ask).toBe('Ask A?');
    expect(back.milestones).toHaveLength(7);
  });
  it('a new status file is all todo, one block per person', () => {
    const f = parse(statusFileText({ n: 3, mon: '2026-10-26' }, people));
    expect(Object.keys(f)).toEqual(people.map((p) => p.id));
    expect(Object.values(f).every((e) => (e as { status: string }).status === 'todo')).toBe(true);
  });
});

describe('existing pages', () => {
  it('the map page does not depend on the weekly plan', () => {
    const a = clone(loadRawData());
    const b = clone(a);
    b.plan = { milestones: [], weeks: [] };
    b.status = {};
    const html = (r: RawData) => renderMap(ctxFor(buildSiteData(r, NOW, 'x'))).replace(/built [^<]*/g, '');
    expect(html(a)).toBe(html(b));
  });
});
