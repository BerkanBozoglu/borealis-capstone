// Builds the list of searchable documents from site data + doc sections.
import type { DocPage, SiteData } from '../../src/types.ts';
import { compact, type SearchDoc } from '../../src/search.ts';
import { activeOption, partView, statementStatus, statementText } from '../../src/choices.ts';

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
      model_line: partView(data.choices, p).model_line,
      aliases: aliases.join(' | '),
      body: [p.short, p.what_it_does, p.role, p.candidates, p.downstream, p.gotchas, ...(p.need_to_know ?? []).map(statementText),
        ...p.fields.map((f) => `${f.name}: ${f.value}`)].filter(Boolean).join(' · '),
      owner: p.owner_display ?? '',
      status: `${p.availability ?? p.status}${partView(data.choices, p).proposed ? ' · proposed' : ''}`,
      source: p.doc_ref ?? p.cite,
      link: `#/hardware/${p.id}`,
      compact: compactField(p.id, aliases, p.name, p.model_line),
      track: p.track,
    });
  }
  // open choices, their options and the documents they list
  for (const c of data.choices) {
    const lead = activeOption(c);
    const names = c.options.flatMap((o) => [o.name, o.mpn ?? '']).filter(Boolean);
    const link = c.options.length ? `#/hardware/choice/${c.id}` : `#/hardware/${c.parts[0]}`;
    out.push({
      ...blank,
      id: `choice:${c.id}`, kind: 'choice', ref: c.id, title: c.title,
      model_line: lead ? `${lead.name}${c.decided ? '' : ' (proposed)'}` : '',
      aliases: [...names, ...c.parts].join(' | '),
      body: [c.summary, ...(c.roles ?? []).map((r) => `${r.name}: ${r.need}`), ...c.facts.map((f) => `${statementStatus(f) ?? ''} ${statementText(f)}`)].join(' · '),
      owner: name(data, c.owner),
      status: c.stage === 'proposed' || !c.decided ? `${c.stage}${c.stage === 'proposed' ? '' : ' · open'}` : 'decided',
      source: 'choices.yaml', link,
      compact: compactField(c.id, names, c.title),
    });
    for (const o of c.options) {
      out.push({
        ...blank,
        id: `option:${c.id}:${compact(o.name)}`, kind: 'option', ref: o.name, title: `${o.chip ?? ''} · option in "${c.title}"`,
        model_line: [o.manufacturer, o.mpn].filter(Boolean).join(' '),
        aliases: [o.mpn ?? '', o.chip ?? ''].filter(Boolean).join(' | '),
        body: [o.notes, o.supplier && `supplier ${o.supplier}`, typeof o.unit_price === 'number' && `${o.currency} ${o.unit_price} (${o.price_source}${o.price_checked ? `, ${o.price_checked}` : ''})`].filter(Boolean).join(' · '),
        owner: name(data, c.owner),
        status: `${o.status}${c.decided ? '' : ' · proposed'}`,
        source: o.price_source ?? 'choices.yaml', link: `#/hardware/choice/${c.id}`,
        compact: compactField(o.name, o.mpn ?? ''),
      });
    }
    for (const d of c.docs ?? []) {
      out.push({
        ...blank,
        id: `ref:${d.id}`, kind: 'ref', ref: d.id, title: d.title, body: `Listed for the ${c.title} choice.`,
        source: 'choices.yaml', link, compact: compactField(d.id),
      });
    }
  }
  // procurement rules (Getting parts card)
  {
    const k = data.constraints;
    out.push({
      ...blank,
      id: 'rule:procurement', kind: 'rule', ref: 'Getting parts', title: `How to order parts · ${k.procurement_source}`,
      aliases: 'order parts | ordering | purchase | procurement | buy parts | bom | bill of materials | digi-key | mouser',
      body: k.procurement_rules.map(statementText).join(' · '),
      source: k.procurement_source, link: '#/hardware', compact: compactField('procurement', 'bom'),
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
