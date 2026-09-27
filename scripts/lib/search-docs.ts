// Builds the list of searchable documents from site data + doc sections.
import type { DocPage, SiteData } from '../../src/types.ts';
import { compact, type SearchDoc } from '../../src/search.ts';

const name = (data: SiteData, id: string) => data.people.find((p) => p.id === id)?.name ?? id;

function compactField(...parts: (string | string[] | undefined)[]): string {
  const out = new Set<string>();
  for (const p of parts) {
    for (const s of Array.isArray(p) ? p : [p ?? '']) {
      if (!s) continue;
      out.add(compact(s));                                          // whole phrase: "max m10s" → maxm10s
      for (const tok of s.split(/\s+/)) if (tok) out.add(compact(tok)); // tokens: "AZ-GTi" → azgti
    }
  }
  out.delete('');
  return [...out].join(' ');
}

export function searchDocs(data: SiteData, docs: DocPage[]): SearchDoc[] {
  const out: SearchDoc[] = [];
  const blank = { model_line: '', aliases: '', owner: '', status: '', source: '', track: 'core' };

  for (const p of data.parts) {
    const aliases = p.aliases ?? [];
    out.push({
      ...blank,
      id: `part:${p.id}`, kind: 'part', ref: p.id, title: p.name,
      model_line: p.model_line ?? '',
      aliases: aliases.join(' | '),
      body: [p.short, p.what_it_does, p.role, p.candidates, p.downstream, p.gotchas, ...(p.need_to_know ?? []),
        ...p.fields.map((f) => `${f.name}: ${f.value}`)].filter(Boolean).join(' · '),
      owner: p.owner_display ?? '',
      status: p.availability ?? p.status,
      source: p.doc_ref ?? p.cite,
      link: `#/hardware/${p.id}`,
      compact: compactField(p.id, aliases, p.name, p.model_line),
      track: p.track,
    });
  }
  for (const r of data.register) {
    out.push({
      ...blank,
      id: `param:${r.id}`, kind: 'param', ref: r.id, title: r.name,
      body: `${r.value} ${r.unit === '-' ? '' : r.unit} · ${r.tag} · ${r.note}`,
      owner: name(data, r.owner),
      status: data.derived.rows[r.id]?.stale ? 'stale' : r.tag,
      source: r.source,
      link: `#/register?id=${encodeURIComponent(r.id)}`,
      compact: compactField(r.id, r.name),
      track: r.track,
    });
  }
  for (const i of data.interfaces) {
    const to = data.derived.interfaces[i.id].to_list;
    out.push({
      ...blank,
      id: `iface:${i.id}`, kind: 'iface', ref: i.id,
      title: `${i.from} → ${to.join(', ')}`,
      body: [i.what, i.gap, i.blocks && `blocks ${i.blocks}`].filter(Boolean).join(' · '),
      owner: i.owners.map((o) => name(data, o)).join(', '),
      status: data.derived.interfaces[i.id].status,
      source: 'interfaces.yaml',
      link: `#/interfaces?id=${encodeURIComponent(i.id)}`,
      compact: compactField(i.id),
    });
  }
  for (const o of data.open_items) {
    out.push({
      ...blank,
      id: `item:${o.n}`, kind: 'item', ref: `#${o.n}`, title: o.item,
      body: [o.why, o.closing_action, `due ${o.due}`].join(' · '),
      owner: o.owners.map((x) => name(data, x)).join(', '),
      status: `due ${o.due}`, source: o.cite,
      link: `#/s/${o.subsystem}?item=${o.n}`,
      compact: compactField(`item${o.n}`), track: o.track,
    });
  }
  data.decisions.forEach((d, k) => {
    out.push({
      ...blank,
      id: `decision:${k}`, kind: 'decision', ref: d.date, title: d.decision,
      body: [d.area, d.reason, d.evidence, d.changes].filter(Boolean).join(' · '),
      owner: d.owner, status: d.area, source: d.cite,
      link: `#/s/${d.subsystems[0] ?? 'transmitter'}?decision=${k}`,
      compact: '',
    });
  });
  for (const p of data.people) {
    out.push({
      ...blank,
      id: `person:${p.id}`, kind: 'person', ref: p.name, title: p.role,
      body: `owns ${p.subsystems.join(', ')} · ${data.register.filter((r) => r.owner === p.id).map((r) => r.id).join(' ')}`,
      owner: p.name, status: '', source: 'people.yaml',
      link: `#/inbox/${p.id}`, compact: compactField(p.id, p.name, p.github),
    });
  }
  const glossaryDoc = docs.find((d) => d.sections.some((s) => /glossary/i.test(s.heading)));
  const glossarySection = glossaryDoc?.sections.find((s) => /glossary/i.test(s.heading));
  for (const g of data.glossary) {
    out.push({
      ...blank,
      id: `term:${compact(g.term)}`, kind: 'term', ref: g.term, title: g.definition,
      aliases: (g.aliases ?? []).join(' | '),
      body: g.definition, source: g.source,
      link: glossarySection ? `#/docs/${glossaryDoc!.file}#${glossarySection.anchor}` : '#/',
      compact: compactField(g.term, g.aliases),
    });
  }
  for (const d of docs) {
    const short = d.file.slice(0, 2);
    for (const s of d.sections) {
      out.push({
        ...blank,
        id: `doc:${d.file}#${s.anchor}`, kind: 'doc', ref: `${short} ${s.heading.split(' ')[0].replace(/[.:]$/, '')}`,
        title: s.heading, body: s.text, source: d.title,
        link: `#/docs/${d.file}#${s.anchor}`, compact: '',
        track: /flight|e-track|balloon|apd/i.test(s.heading) ? 'flight' : 'core',
      });
    }
  }
  return out;
}
