import { describe, expect, it } from 'vitest';
import { loadPrivacy, scanText, sha256 } from '../scripts/lib/privacy.ts';
import { publicHistory, publicSiteData, authorName } from '../scripts/lib/public.ts';
import { buildDocs } from '../scripts/lib/docs.ts';
import { searchDocs } from '../scripts/lib/search-docs.ts';
import { buildEngine } from '../src/search.ts';
import { handleKey } from '../src/privacy.ts';
import { renderInbox } from '../src/render/tables.ts';
import { proposalUrl } from '../src/render/sandbox.ts';
import { parseSandbox } from '../src/sandbox.ts';
import { bomCsv, buildBom } from '../src/bom.ts';
import type { Ctx } from '../src/render/util.ts';
import { TODAY, loadSite } from './helpers.ts';

const cfg = loadPrivacy('.');
const data = loadSite();
const pub = publicSiteData(data);

describe('privacy check', () => {
  const test = { blocked_sha256: [sha256('testsurname')], allow: ['Owner/repo'] };
  it('catches a blocked word in any case and inside camelCase', () => {
    expect(scanText('by Jane Testsurname', 'x', test).length).toBe(1);
    expect(scanText('JaneTestsurname', 'x', test).length).toBe(1);
    expect(scanText('by Jane', 'x', test)).toEqual([]);
  });
  it('history text is redacted, since git history keeps old values', async () => {
    const { redact } = await import('../scripts/lib/privacy.ts');
    expect(redact('gated on registration with Testsurname as PI; mail a@b.org', test)).toBe('gated on registration with [name removed] as PI; mail [email removed]');
    const { registerHistory } = await import('../scripts/lib/history.ts');
    expect(scanText(JSON.stringify(publicHistory(data, registerHistory('.', 300), cfg)), 'history', cfg)).toEqual([]);
  });
  it('catches email addresses', () => expect(scanText('write to someone@example.org', 'x', test)[0].kind).toBe('email'));
  it('ignores allowed strings (the repository address)', () => expect(scanText('github.com/Owner/repo', 'x', { blocked_sha256: [sha256('owner')], allow: ['Owner/repo'] })).toEqual([]));
  it('everything the site ships passes', () => {
    const docs = buildDocs(pub.site.search.docs, pub.site.doc_superseded, (id) => id);
    const shipped = [JSON.stringify(pub), JSON.stringify(docs), JSON.stringify(buildEngine(searchDocs(pub, docs))),
      bomCsv(buildBom(pub, { showFlight: true, date: TODAY }))];
    for (const t of shipped) expect(scanText(t, 'out', cfg)).toEqual([]);
  });
  it('the docs copies themselves carry no blocked names or emails', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    for (const f of readdirSync('docs').filter((x) => x.endsWith('.md'))) {
      expect(scanText(readFileSync(`docs/${f}`, 'utf8'), f, cfg), f).toEqual([]);
    }
  });
});

describe('GitHub usernames never reach the front end', () => {
  it('shipped people carry a key, not the username', () => {
    for (const p of pub.people) {
      expect(p.github, p.id).toBeUndefined();
      expect(p.github_key, p.id).toBe(handleKey(data.people.find((x) => x.id === p.id)!.github!));
    }
    expect(pub.site.repo).toEqual({ slug: data.site.repo.slug, branch: 'main' });
  });
  it('team members appear by first name', () => {
    expect(pub.people.map((p) => p.name)).toEqual(['Berky', 'Bilal', 'Batu', 'Shabazz', 'Matei', 'Arnav']);
  });
  it('git authors become first names', () => {
    const owner = data.people.find((p) => p.id === 'berky')!.github!;
    expect(authorName(data, owner)).toBe('Berky');
    expect(authorName(data, 'Someone Else')).toBe('team member');
    expect(publicHistory(data, [{ sha: 'a', author: owner, date: '', subject: '', changes: [], subsystems: [] }])[0].author).toBe('Berky');
  });
  it('the inbox still matches assigned issues by key, and never prints the username', () => {
    const login = data.people.find((p) => p.id === 'bilal')!.github!;
    const ctx: Ctx = { data: pub, history: [], showFlight: false, now: new Date(`${TODAY}T12:00:00`), lastSeen: null, query: new URLSearchParams(), baseUrl: '',
      issues: [{ number: 7, title: 'Re-check RX-04', state: 'open', html_url: 'https://github.com/x/y/issues/7', labels: [{ name: 're-check' }], assignees: [{ login }] }] };
    const html = renderInbox(ctx, 'bilal');
    expect(html).toContain('#7</a> Re-check RX-04');
    expect(html).not.toContain(login);
  });
  it('the sandbox proposal names owners, with no usernames or assignees', () => {
    const ctx: Ctx = { data: pub, history: [], showFlight: false, now: new Date(), issues: null, lastSeen: null, query: new URLSearchParams(), baseUrl: 'https://x/' };
    const url = proposalUrl(ctx, parseSandbox(pub, new URLSearchParams('TX-02=5')));
    expect(url).not.toContain('assignees');
    for (const p of data.people) expect(decodeURIComponent(url)).not.toContain(`@${p.github}`);
    expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain('Berky (TX-02)');
  });
  it('the BOM header', () => {
    expect(buildBom(pub, { showFlight: false, date: TODAY }).header).toMatchObject({ team: 'Team BOREALIS', designed_by: 'Team BOREALIS', revision: 'A' });
  });
});
