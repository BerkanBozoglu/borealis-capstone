// What the browser gets. GitHub usernames are replaced by a key, the repo is
// reduced to its address, and git author names become team first names.
import type { Commit, SiteData } from '../../src/types.ts';
import { handleKey } from '../../src/privacy.ts';
import { redact, type PrivacyConfig } from './privacy.ts';

export function publicSiteData(data: SiteData): SiteData {
  return {
    ...data,
    people: data.people.map(({ github, ...p }) => ({ ...p, ...(github ? { github_key: handleKey(github) } : {}) })),
    site: { ...data.site, repo: { slug: data.site.repo.slug, branch: data.site.repo.branch } },
  };
}

/** Git author → a team member's first name (by GitHub username or first name), else "team member". */
export function authorName(data: Pick<SiteData, 'people'>, author: string): string {
  const a = author.trim().toLowerCase();
  if (a === 'claude') return 'Claude';
  const p = data.people.find((x) => (x.github && x.github.toLowerCase() === a) || x.name.toLowerCase() === a.split(/\s+/)[0]);
  return p ? p.name : 'team member';
}

/** History with first-name authors; blocked names and emails in old values/subjects are blanked. */
export function publicHistory(data: Pick<SiteData, 'people'>, history: Commit[], cfg?: PrivacyConfig): Commit[] {
  const clean = (v: unknown): unknown => {
    if (!cfg) return v;
    if (typeof v === 'string') return redact(v, cfg);
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
    return v;
  };
  return history.map((c) => ({
    ...c, author: authorName(data, c.author), subject: clean(c.subject) as string,
    changes: c.changes.map((ch) => ({ ...ch, fields: ch.fields.map((f) => ({ ...f, old: clean(f.old), new: clean(f.new) })) })),
  }));
}
