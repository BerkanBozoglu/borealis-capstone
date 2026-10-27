// Weekly plan helpers shared by the build and the browser: dates, the current
// week and the Discord post. Pure functions, no DOM.
import type { Plan, PlanMilestone, PlanWeek, TeachBack } from './types.ts';

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const addDays = (d: string, n: number) => iso(utc(d) + n * DAY);
export const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(utc(d)).getUTCDay() === 1;
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);
/** YYYY-MM-DD of a local date (the viewer's today). */
export const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDay(d: string): string {
  const x = new Date(utc(d));
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
}
/** "26 Oct – 1 Nov" */
export const weekRange = (mon: string) => `${fmtDay(mon)} – ${fmtDay(addDays(mon, 6))}`;

/** Weeks in date order. */
export const sortedWeeks = (plan: Plan): PlanWeek[] => [...(plan.weeks ?? [])].sort((a, b) => a.mon.localeCompare(b.mon));

/** Index of the current week: the latest week whose Monday is on or before today (week 1 before the plan starts). */
export function currentWeekIndex(weeks: { mon: string }[], today: string): number {
  let k = 0;
  weeks.forEach((w, i) => { if (w.mon <= today) k = i; });
  return k;
}

/** The next fixed milestone on or after `from` ("week of" milestones count for their whole week). */
export function nextPlanMilestone(milestones: PlanMilestone[], from: string): (PlanMilestone & { days: number }) | null {
  const up = milestones
    .map((m) => ({ ...m, days: daysBetween(from, m.date) }))
    .filter((m) => m.days >= (m.week_of ? -6 : 0))
    .sort((a, b) => a.date.localeCompare(b.date));
  return up[0] ?? null;
}

export function daysText(m: { days: number; name: string }): string {
  if (m.days > 0) return `${m.days} day${m.days === 1 ? '' : 's'} to ${m.name}`;
  return m.days === 0 ? `${m.name} today` : `${m.name} this week`;
}

export function teachText(t: string | TeachBack | undefined): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return [t.question, t.presenter ? `(${t.presenter})` : ''].filter(Boolean).join(' ');
}

/** First sentence of a text (up to the first . ! or ? followed by a space). */
export function firstSentence(s: string): string {
  const m = s.trim().match(/^.*?[.!?](?=\s|$)/s);
  return (m ? m[0] : s).trim();
}

export const DISCORD_LIMIT = 2000;

export interface PostLine { name: string; deliver: string; carried: boolean }
export interface PostInput { n: number; mon: string; milestone: string | null; brief: string; lines: PostLine[]; url: string }

/**
 * Discord-ready weekly post. If it is over 2000 characters, each deliver text
 * is cut to its first sentence; if still over, texts are trimmed evenly so the
 * header, names and link always survive.
 */
export function weekPost(p: PostInput): { text: string; shortened: boolean } {
  const head = `**Week ${p.n} · ${weekRange(p.mon)}${p.milestone ? ` · ${p.milestone}` : ''}**`;
  const foot = `Full details and status: <${p.url}>`;
  const build = (brief: string, deliver: (l: PostLine) => string) => [
    head, '', brief, '',
    ...p.lines.map((l) => `**${l.name}:** ${deliver(l)}${l.carried ? ' (carried from last week)' : ''}`),
    '', foot,
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  let text = build(flat(p.brief), (l) => flat(l.deliver));
  if (text.length <= DISCORD_LIMIT) return { text, shortened: false };
  text = build(flat(p.brief), (l) => firstSentence(flat(l.deliver)));
  for (let cap = 400; text.length > DISCORD_LIMIT && cap > 10; cap -= 10) {
    const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
    text = build(cut(flat(p.brief), cap * 2), (l) => cut(firstSentence(flat(l.deliver)), cap));
  }
  return { text, shortened: true };
}
