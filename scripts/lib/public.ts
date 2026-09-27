// What the browser gets. GitHub usernames are replaced by a key, the repo is
// reduced to its address, and git author names become team first names.
import type { Commit, SiteData } from '../../src/types.ts';
import { handleKey } from '../../src/privacy.ts';

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

export function publicHistory(data: Pick<SiteData, 'people'>, history: Commit[]): Commit[] {
  return history.map((c) => ({ ...c, author: authorName(data, c.author) }));
}
