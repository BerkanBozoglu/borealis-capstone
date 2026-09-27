// docs/*.md → HTML pages with heading anchors, plus one section per ## / ###
// heading for search. Paragraphs that state a Rev D.2 value the register has
// since changed get the same "superseded by <ID>" marker the rest of the site uses.
import { readFileSync, existsSync } from 'node:fs';
import { Marked, type Tokens } from 'marked';
import type { DocPage, DocSection } from '../../src/types.ts';

export interface SupersededPhrase { match: string; ids: string[] }
export interface SupersedeRules { phrases: SupersededPhrase[]; skip_headings: string[] }

export function slug(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

const plain = (md: string) => md
  .replace(/`([^`]*)`/g, '$1').replace(/\*\*|__|\*|_/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/^\s*[-*]\s+/gm, '').replace(/\|/g, ' ').replace(/^[-: ]+$/gm, '').replace(/\s+/g, ' ').trim();

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Append a marker to each <p>, <li> and table row that states a superseded value. */
function markSuperseded(html: string, rules: SupersedeRules, rowHref: (id: string) => string): string {
  const { phrases } = rules;
  if (!phrases.length) return html;
  // Sections about the flight track keep 850 nm etc. as current: skip them.
  const skip = rules.skip_headings.map((r) => new RegExp(r));
  const textOfHeading = (chunk: string) => (chunk.match(/^<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/)?.[1] ?? '').replace(/<[^>]+>/g, '');
  let skipping = false;
  let level = 9;
  return html.split(/(?=<h[1-6] id=)/).map((chunk) => {
    const hl = Number(chunk.match(/^<h([1-6])/)?.[1] ?? 0);
    if (hl) {
      const h = textOfHeading(chunk);
      if (skipping && hl <= level) skipping = false;
      if (!skipping && skip.some((r) => r.test(h))) { skipping = true; level = hl; }
    }
    return skipping ? chunk : markChunk(chunk, phrases, rowHref);
  }).join('');
}

function markChunk(html: string, phrases: SupersededPhrase[], rowHref: (id: string) => string): string {
  const marker = (text: string) => {
    const ids = [...new Set(phrases.filter((p) => text.includes(p.match)).flatMap((p) => p.ids))];
    if (!ids.length) return '';
    return ` <span class="sup" title="The register has changed this since the Rev D.2 docs; the register wins">superseded by ${ids.map((id) => `<a class="id" href="${rowHref(id)}">${id}</a>`).join(', ')}</span>`;
  };
  const textOf = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return html
    .replace(/<(p|li)>([\s\S]*?)<\/\1>/g, (m, tag, inner) => {
      if (/<(ul|ol|p)[ >]/.test(inner)) return m; // nested block: its children get their own marker
      const mk = marker(textOf(inner));
      return mk ? `<${tag}>${inner}${mk}</${tag}>` : m;
    })
    .replace(/<tr>([\s\S]*?)<\/tr>/g, (m, inner) => {
      const mk = marker(textOf(inner));
      return mk ? `<tr>${inner.replace(/<\/td>\s*$/, `${mk}</td>`)}</tr>` : m;
    });
}

export function buildDoc(file: string, md: string, rules: SupersedeRules, rowHref: (id: string) => string): DocPage {
  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(md);
  const used = new Map<string, number>();
  const sections: DocSection[] = [];
  let title = file;
  let current: { section: DocSection; raw: string[] } | null = null;
  const flush = () => {
    if (current) current.section.text = plain(current.raw.join('\n')).slice(0, 300);
  };
  const ids: string[] = [];
  for (const t of tokens) {
    if (t.type === 'heading') {
      const h = t as Tokens.Heading;
      const text = plain(h.text);
      let anchor = slug(text);
      const n = used.get(anchor) ?? 0;
      used.set(anchor, n + 1);
      if (n) anchor = `${anchor}-${n + 1}`;
      ids.push(anchor);
      if (h.depth === 1) { title = text; continue; }
      if (h.depth === 2 || h.depth === 3) {
        flush();
        current = { section: { file, heading: text, anchor, level: h.depth, text: '' }, raw: [] };
        sections.push(current.section);
        continue;
      }
    }
    if (current) current.raw.push(t.raw);
  }
  flush();

  let k = 0;
  const html = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens: inline, depth }) {
        const anchor = ids[k++] ?? `h-${k}`;
        return `<h${depth} id="doc-${anchor}"><a class="anchor" href="#/docs/${file}#${anchor}">${this.parser.parseInline(inline)}</a></h${depth}>\n`;
      },
      html({ text }) { return esc(text); }, // docs are data: never pass raw HTML through
    },
  }).parse(md) as string;

  return { file, title, html: markSuperseded(html, rules, rowHref), sections };
}

export function buildDocs(files: string[], rules: SupersedeRules, rowHref: (id: string) => string, root = '.'): DocPage[] {
  return files
    .filter((f) => existsSync(`${root}/docs/${f}.md`))
    .map((f) => buildDoc(f, readFileSync(`${root}/docs/${f}.md`, 'utf8'), rules, rowHref));
}
