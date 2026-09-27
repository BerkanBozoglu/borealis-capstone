import { describe, expect, it } from 'vitest';
import { search } from '../src/search.ts';
import { buildSearch } from './helpers.ts';

const { engine, cfg, json } = buildSearch();
const refs = (q: string) => search(engine, cfg, q).hits.map((h) => `${h.doc.kind}:${h.doc.ref}`);

describe('search', () => {
  it('BPW34 → B1 first', () => expect(refs('BPW34')[0]).toBe('part:B1'));
  it('receiver board → B4 first', () => expect(refs('receiver board')[0]).toBe('part:B4'));
  it('reciever → B4 in the top 3, with a typo notice', () => {
    const out = search(engine, cfg, 'reciever');
    expect(out.hits.slice(0, 3).map((h) => h.doc.ref)).toContain('B4');
    expect(out.correctedQuery).toBe('receiver');
  });
  it('azgti and AZ-GTi → C4 first', () => {
    expect(refs('azgti')[0]).toBe('part:C4');
    expect(refs('AZ-GTi')[0]).toBe('part:C4');
  });
  it('opa657 → B2 first', () => expect(refs('opa657')[0]).toBe('part:B2'));
  it('who owns TIA → B2 in the top 2', () => expect(refs('who owns TIA').slice(0, 2)).toContain('part:B2'));
  it('I-06 → interface I-06 first', () => expect(refs('I-06')[0]).toBe('iface:I-06'));
  it('scope → C1, C5 and H2 in the top 5', () => {
    const top = refs('scope').slice(0, 5);
    for (const id of ['part:C1', 'part:C5', 'part:H2']) expect(top).toContain(id);
  });
  it('max m10s → E3 first', () => expect(refs('max m10s')[0]).toBe('part:E3'));
  it('xyzzy → nothing', () => expect(refs('xyzzy')).toEqual([]));
  it('no typo notice for a correct word', () => expect(search(engine, cfg, 'receiver').correctedQuery).toBeNull());
  it('stop words alone return nothing', () => expect(refs('who is the')).toEqual([]));

  it('index is under 600 KB', () => expect(json.length).toBeLessThan(600 * 1024));
  it('a 3-word query takes under 30 ms', () => {
    search(engine, cfg, 'warm up query'); // first call warms caches
    const t = performance.now();
    search(engine, cfg, 'receiver board stability');
    expect(performance.now() - t).toBeLessThan(30);
  });
  it('indexes every doc section of 01, 02, 04 and 05', () => {
    const { docs } = buildSearch();
    expect(docs.map((d) => d.file.slice(0, 2))).toEqual(['01', '02', '04', '05']);
    expect(docs.reduce((n, d) => n + d.sections.length, 0)).toBeGreaterThan(90);
  });
});
