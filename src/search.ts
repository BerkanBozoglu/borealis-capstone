// Site-wide search. The index is built at build time (scripts/lib/search-docs.ts)
// and loaded in the browser; the same options and query logic run in tests.
import MiniSearch, { type Options, type Query, type SearchResult } from 'minisearch';

export type SearchKind = 'part' | 'param' | 'iface' | 'item' | 'person' | 'doc' | 'decision' | 'term';

export interface SearchDoc {
  id: string;          // unique key, e.g. "part:B1"
  kind: SearchKind;
  ref: string;         // shown id: B1, TX-02, I-06, #7, 01 §7.2
  title: string;
  model_line: string;
  aliases: string;     // aliases joined with " | "
  body: string;
  owner: string;
  status: string;
  source: string;
  link: string;
  compact: string;     // ref, aliases and name/model tokens with non-alphanumerics removed
  track: string;
}

/** Display order of result groups. */
export const GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: 'part', label: 'Parts' },
  { kind: 'param', label: 'Shared numbers' },
  { kind: 'iface', label: 'Interfaces' },
  { kind: 'item', label: 'Open items' },
  { kind: 'person', label: 'People' },
  { kind: 'doc', label: 'Doc sections' },
  { kind: 'decision', label: 'Decisions' },
  { kind: 'term', label: 'Glossary' },
];

export const compact = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const FIELDS = ['ref', 'title', 'model_line', 'aliases', 'body', 'owner', 'compact'];
const STORE: (keyof SearchDoc)[] = ['kind', 'ref', 'title', 'model_line', 'aliases', 'body', 'owner', 'status', 'source', 'link', 'track'];
export const BOOST = { ref: 5, model_line: 4, aliases: 4, title: 3, compact: 5, body: 1, owner: 1 };

export const OPTIONS: Options<SearchDoc> = {
  idField: 'id',
  fields: FIELDS,
  storeFields: STORE as string[],
  processTerm: (t) => { const n = norm(t); return n || null; },
  searchOptions: { boost: BOOST, prefix: true, fuzzy: 0.2 },
};

export function buildEngine(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>(OPTIONS);
  ms.addAll(docs);
  return ms;
}

export function loadEngine(json: string | object): MiniSearch<SearchDoc> {
  return MiniSearch.loadJSON<SearchDoc>(typeof json === 'string' ? json : JSON.stringify(json), OPTIONS);
}

export interface SearchConfig { synonyms: Record<string, string[]>; stopWords: string[] }

export interface Hit {
  doc: SearchDoc;
  score: number;
  terms: string[];
  fields: string[];
  via: string | null; // synonym phrase that pulled it in
}

export interface SearchOutcome {
  hits: Hit[];
  /** "Showing results for …" when fuzzy matching changed a word */
  correctedQuery: string | null;
  words: string[];
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

const words = (q: string, stop: Set<string>) =>
  norm(q).split(/[^a-z0-9]+/).filter((w) => w && !stop.has(w));

export function search(ms: MiniSearch<SearchDoc>, cfg: SearchConfig, q: string, limit = 16): SearchOutcome {
  const stop = new Set(cfg.stopWords.map(norm));
  const ws = words(q, stop);
  if (!ws.length) return { hits: [], correctedQuery: null, words: [] };
  const phrase = ws.join(' ');
  const padded = ` ${phrase} `;

  // synonym expansion: a key found in the query adds each alternative as a sub-query
  const expansions: { alt: string; key: string }[] = [];
  for (const [key, alts] of Object.entries(cfg.synonyms)) {
    const k = words(key, new Set()).join(' ');
    if (k && padded.includes(` ${k} `)) for (const alt of alts) expansions.push({ alt, key });
  }

  const sub = (text: string): Query[] => [
    { queries: [text], combineWith: 'AND' } as Query,
    { queries: [compact(text)], fields: ['compact'], combineWith: 'OR' } as Query,
  ];
  const tree = (combine: 'AND' | 'OR'): Query => ({
    combineWith: 'OR',
    queries: [
      { queries: [phrase], combineWith: combine } as Query,
      { queries: [compact(phrase)], fields: ['compact'] } as Query,
      ...expansions.flatMap((e) => sub(e.alt)),
    ],
  });

  let results: SearchResult[] = ms.search(tree('AND'));
  if (!results.length) results = ms.search(tree('OR'));

  // which docs only matched through a synonym
  const viaMap = new Map<string, string>();
  if (expansions.length) {
    const direct = new Set(ms.search({ combineWith: 'OR', queries: [{ queries: [phrase], combineWith: 'AND' } as Query, { queries: [compact(phrase)], fields: ['compact'] } as Query] }).map((r) => String(r.id)));
    for (const e of expansions) {
      for (const r of ms.search({ combineWith: 'OR', queries: sub(e.alt) })) {
        const id = String(r.id);
        if (!direct.has(id) && !viaMap.has(id)) viaMap.set(id, e.key);
      }
    }
  }

  const hits: Hit[] = results.slice(0, limit).map((r) => ({
    doc: { id: String(r.id), ...(r as unknown as Omit<SearchDoc, 'id'>) } as SearchDoc,
    score: r.score,
    terms: r.terms,
    fields: [...new Set(Object.values(r.match).flat())],
    via: viaMap.get(String(r.id)) ?? null,
  }));

  // typo feedback: a word that no top hit matches directly (exactly or as a prefix)
  let corrected: string | null = null;
  const top = results.slice(0, 5);
  const fixed = ws.map((w) => {
    if (w.length < 4) return w;
    const matched = top.flatMap((r) => r.terms);
    if (matched.some((t) => t.startsWith(w))) return w;
    const best = matched.map((t) => ({ t, d: lev(w, t.slice(0, Math.max(w.length, 1) + 1)) }))
      .concat(matched.map((t) => ({ t, d: lev(w, t) })))
      .sort((a, b) => a.d - b.d)[0];
    return best && best.d <= 2 ? best.t : w;
  });
  if (fixed.some((f, i) => f !== ws[i])) corrected = fixed.join(' ');

  return { hits, correctedQuery: corrected, words: ws };
}

/** One short line on why a hit matched. */
export function whyMatched(h: Hit): string {
  const fieldName: Record<string, string> = { ref: 'id', model_line: 'model', aliases: 'also known as', compact: 'id / name / alias', title: 'name', body: 'text', owner: 'owner' };
  const f = h.fields.map((x) => fieldName[x] ?? x);
  const t = h.terms.slice(0, 3).map((x) => `"${x}"`).join(', ');
  return `${h.via ? `via synonym "${h.via}" · ` : ''}matches ${t}${f.length ? ` in ${[...new Set(f)].join(', ')}` : ''}`;
}
