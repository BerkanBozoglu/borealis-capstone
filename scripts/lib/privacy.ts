// Privacy check: fails the build if any team member's surname, any staff
// name, any GitHub username or any email address appears in what the site ships.
// The blocked words live in data/privacy.yaml as SHA-256 hashes only, so the
// check itself doesn't publish the names it protects.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export interface PrivacyConfig { blocked_sha256: string[]; allow: string[] }

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

export function loadPrivacy(root = '.'): PrivacyConfig {
  return parse(readFileSync(join(root, 'data/privacy.yaml'), 'utf8')) as PrivacyConfig;
}

/** Words in a text: runs of letters/digits, also split at camelCase boundaries. */
function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const run of text.match(/[\p{L}\p{N}]+/gu) ?? []) {
    out.add(run.toLowerCase());
    for (const part of run.split(/(?<=\p{Ll})(?=\p{Lu})/u)) out.add(part.toLowerCase());
  }
  return out;
}

export interface PrivacyHit { where: string; kind: 'name' | 'email'; sample: string }

export function scanText(text: string, where: string, cfg: PrivacyConfig): PrivacyHit[] {
  let t = text;
  for (const a of cfg.allow ?? []) t = t.split(a).join(' ');
  const hits: PrivacyHit[] = [];
  const blocked = new Set(cfg.blocked_sha256);
  for (const w of words(t)) if (blocked.has(sha256(w))) hits.push({ where, kind: 'name', sample: `${w.slice(0, 2)}… (blocked word)` });
  for (const m of t.match(EMAIL) ?? []) hits.push({ where, kind: 'email', sample: m.replace(/^(.{2}).*@/, '$1…@') });
  return hits;
}

export function scanDir(dir: string, cfg: PrivacyConfig): PrivacyHit[] {
  if (!existsSync(dir)) return [];
  const hits: PrivacyHit[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) hits.push(...scanDir(p, cfg));
    else if (/\.(html|js|json|css|txt|csv|svg)$/.test(name)) hits.push(...scanText(readFileSync(p, 'utf8'), p, cfg));
  }
  return hits;
}
