// Shared render helpers. Renderers are pure: (ctx) → HTML string, so pages can
// be tested in node without a DOM.
import type { Commit, InterfaceStatus, SiteData, SubsystemStatus, Tag, Track } from '../types.ts';

export interface GhIssue {
  number: number; title: string; state: 'open' | 'closed'; html_url: string;
  labels: { name: string }[]; assignees: { login: string }[];
}

export interface Ctx {
  data: SiteData;
  history: Commit[];
  showFlight: boolean;
  now: Date;
  /** live GitHub issues; null = not loaded or the fetch failed */
  issues: GhIssue[] | null;
  /** ISO timestamp this subsystem page was last looked at, from localStorage */
  lastSeen: string | null;
  query: URLSearchParams;
  /** absolute URL of the site root, for share links */
  baseUrl: string;
}

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Minimal inline formatting for data text: `code` and *emphasis*. */
export const inline = (s: string): string =>
  esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*([^*]+)\*/g, '<em>$1</em>');

export const MINUS = '−';
export function num(x: number, digits = 1, signed = false): string {
  if (!Number.isFinite(x)) return '—';
  const s = Math.abs(x).toFixed(digits);
  const zero = Number(s) === 0;
  if (x < 0 && !zero) return MINUS + s;
  return (signed && !zero ? '+' : '') + s;
}

/** Engineering format for volts/amps: 0.0159 V → "15.9 mV". */
export function eng(x: number, unit: string): string {
  const a = Math.abs(x);
  const [f, p] = a >= 1 ? [1, ''] : a >= 1e-3 ? [1e3, 'm'] : a >= 1e-6 ? [1e6, 'µ'] : a >= 1e-9 ? [1e9, 'n'] : [1e12, 'p'];
  const v = x * f;
  return `${num(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)} ${p}${unit}`;
}

export const trackAttr = (t: Track | undefined) => (t === 'flight' ? ' data-track="flight"' : '');

// ---------- status marks: circle = ok, square = re-check, diamond = broken ----------
const SHAPE: Record<SubsystemStatus, string> = {
  ok: '<circle cx="7" cy="7" r="5.5"/>',
  recheck: '<rect x="1.8" y="1.8" width="10.4" height="10.4" rx="1"/>',
  broken: '<path d="M7 .6 13.4 7 7 13.4 .6 7z"/>',
};
export const STATUS_LABEL: Record<SubsystemStatus, string> = { ok: 'ok', recheck: 're-check', broken: 'broken' };

export function mark(status: SubsystemStatus, label = STATUS_LABEL[status]): string {
  return `<span class="mark mark-${status}" title="${esc(label)}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">${SHAPE[status]}</svg><span class="mark-label">${esc(label)}</span></span>`;
}
export const IFACE_MARK: Record<InterfaceStatus, SubsystemStatus> = { agreed: 'ok', draft: 'recheck', missing: 'broken' };
export const ifaceMark = (s: InterfaceStatus) => mark(IFACE_MARK[s], s);

export const tagChip = (t: Tag | string) => `<span class="tag tag-${esc(t)}" title="confidence tag">${esc(t)}</span>`;
export const cite = (c: string) => `<span class="cite" title="source">${esc(c)}</span>`;
export const modeled = () => tagChip('MODELED');

// ---------- links ----------
export function gh(data: SiteData) {
  const { owner, name, branch } = data.site.repo;
  const repo = `https://github.com/${owner}/${name}`;
  return {
    repo,
    edit: (file: string) => `${repo}/edit/${branch}/${file}`,
    blob: (file: string, line?: number | null) => `${repo}/blob/${branch}/${file}${line ? `#L${line}` : ''}`,
    commit: (sha: string) => `${repo}/commit/${sha}`,
    issue: (n: number) => `${repo}/issues/${n}`,
    issues: `${repo}/issues`,
    newIssue: (q: Record<string, string>) => `${repo}/issues/new?${new URLSearchParams(q).toString()}`,
    api: `https://api.github.com/repos/${owner}/${name}`,
  };
}

export function editLink(data: SiteData, file: string, line?: number | null, label = 'Edit on GitHub'): string {
  const where = line ? ` (line ${line})` : '';
  return `<a class="btn btn-small" href="${esc(gh(data).edit(file))}" target="_blank" rel="noopener" title="Opens ${esc(file)} in GitHub's web editor${esc(where)}">${esc(label)}</a>`
    + (line ? ` <a class="muted small" href="${esc(gh(data).blob(file, line))}" target="_blank" rel="noopener">L${line}</a>` : '');
}

export const rowSubsystem = (data: SiteData, id: string) => data.register.find((r) => r.id === id)?.subsystem;
export function rowLink(data: SiteData, id: string): string {
  const s = rowSubsystem(data, id);
  if (s) return `<a class="id" href="#/s/${esc(s)}?row=${encodeURIComponent(id)}">${esc(id)}</a>`;
  if (data.interfaces.some((i) => i.id === id)) return `<a class="id" href="#/interfaces?i=${encodeURIComponent(id)}">${esc(id)}</a>`;
  return `<span class="id">${esc(id)}</span>`;
}

export function superseded(data: SiteData, ids: string[] | undefined): string {
  if (!ids?.length) return '';
  return ` <span class="sup" title="The register has changed this since the Rev D.2 docs; the register wins">superseded by ${ids.map((id) => rowLink(data, id)).join(', ')}</span>`;
}

export const personName = (data: SiteData, id: string) => data.people.find((p) => p.id === id)?.name ?? id;
export const personLink = (data: SiteData, id: string) =>
  `<a href="#/inbox/${esc(id)}" class="person">${esc(personName(data, id))}</a>`;
export const subsystemName = (data: SiteData, id: string) => data.subsystems.find((s) => s.id === id)?.name ?? id;
export const subsystemLink = (data: SiteData, id: string) => `<a href="#/s/${esc(id)}">${esc(subsystemName(data, id))}</a>`;

export function ifaceEnds(data: SiteData, id: string): string {
  const i = data.interfaces.find((x) => x.id === id)!;
  const to = data.derived.interfaces[id].to_list;
  return `${subsystemLink(data, i.from)} → ${to.map((t) => subsystemLink(data, t)).join(', ')}`;
}

export function valueText(v: number | string, unit: string): string {
  const u = unit && unit !== '-' ? ` <span class="unit">${esc(unit)}</span>` : '';
  return `<span class="num">${esc(typeof v === 'number' ? String(v).replace('-', MINUS) : v)}</span>${u}`;
}

// ---------- confidence bar ----------
export const TAG_ORDER: Tag[] = ['MEASURED', 'VERIFIED', 'DECIDED', 'MODELED', 'TARGET', 'ASSUMED', 'TBD'];
export function confidenceBar(counts: Partial<Record<Tag, number>>, withLegend = true): string {
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  if (!total) return '<div class="muted small">no rows</div>';
  const segs = TAG_ORDER.filter((t) => counts[t]).map((t) =>
    `<span class="seg tagbg-${t}" style="flex:${counts[t]}" title="${t}: ${counts[t]}"></span>`).join('');
  const legend = withLegend
    ? `<div class="legend">${TAG_ORDER.filter((t) => counts[t]).map((t) => `<span><i class="sw tagbg-${t}"></i>${t} ${counts[t]}</span>`).join('')}</div>`
    : '';
  return `<div class="conf" role="img" aria-label="rows by confidence tag">${segs}</div>${legend}`;
}

export function historyFor(ctx: Ctx, id: string): string {
  const commits = ctx.history.filter((c) => c.changes.some((x) => x.id === id));
  if (!commits.length) return '<div class="muted small">No commits touch this row yet.</div>';
  const items = commits.map((c) => {
    const ch = c.changes.find((x) => x.id === id)!;
    const what = ch.kind === 'changed'
      ? ch.fields.map((f) => `<code>${esc(f.field)}</code>: ${esc(show(f.old))} → ${esc(show(f.new))}`).join('; ')
      : ch.kind;
    return `<li><span class="num">${esc(c.date.slice(0, 10))}</span> <a href="${esc(gh(ctx.data).commit(c.sha))}" target="_blank" rel="noopener">${esc(c.sha.slice(0, 7))}</a> ${esc(c.author)} — ${esc(c.subject)}<div class="small">${what}</div></li>`;
  }).join('');
  return `<ul class="history">${items}</ul>`;
}
const show = (v: unknown) => (Array.isArray(v) ? `[${v.join(', ')}]` : v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Stale reason text for a row. */
export function staleReason(data: SiteData, id: string): string {
  const d = data.derived.rows[id];
  if (!d?.stale) return '';
  return d.reasons.map((r) => `${rowLink(data, r.from)} changed <span class="num">${esc(r.changed)}</span>, after this row was checked <span class="num">${esc(r.checked)}</span>`).join('<br>');
}

export const visible = <T extends { track?: Track }>(ctx: Ctx, list: T[]) =>
  ctx.showFlight ? list : list.filter((x) => x.track !== 'flight');

export function daysUntil(now: Date, iso: string): number {
  const d = Date.parse(`${iso}T00:00:00`);
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((d - n) / 86_400_000);
}
