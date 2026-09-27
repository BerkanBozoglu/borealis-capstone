// #/docs/<file>: the project docs, rendered at build time with heading anchors.
import type { DocPage } from '../types.ts';
import { esc } from './util.ts';

export function renderDocs(docs: DocPage[], file: string | undefined): string {
  const doc = docs.find((d) => d.file === file) ?? docs[0];
  if (!doc) return '<section class="card"><h1>No docs</h1></section>';
  const nav = docs.map((d) => `<a class="pill ${d.file === doc.file ? 'active' : ''}" href="#/docs/${esc(d.file)}">${esc(d.title)}</a>`).join('');
  const toc = doc.sections.map((s) => `<li class="toc-${s.level}"><a href="#/docs/${esc(doc.file)}#${esc(s.anchor)}">${esc(s.heading)}</a></li>`).join('');
  return `<section class="card"><div class="pills">${nav}</div>
    <p class="small muted">These files describe the Rev D.2 baseline. The register is the truth for numbers; statements it has changed carry a "superseded by" marker.</p></section>
  <div class="doc-grid">
    <nav class="card doc-toc"><ul class="plain small">${toc}</ul></nav>
    <article class="card doc" data-doc="${esc(doc.file)}">${doc.html}</article>
  </div>`;
}
