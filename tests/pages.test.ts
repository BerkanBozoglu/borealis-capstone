import { describe, expect, it } from 'vitest';
import { renderSubsystem } from '../src/render/subsystem.ts';
import { renderMap } from '../src/render/map.ts';
import { renderSandbox } from '../src/render/sandbox.ts';
import { renderInbox, renderRegister, renderInterfaces } from '../src/render/tables.ts';
import { parseSandbox, runModel } from '../src/sandbox.ts';
import type { Ctx } from '../src/render/util.ts';
import { buildSiteData } from '../scripts/lib/derive.ts';
import { TODAY, clone, loadRawData, loadSite } from './helpers.ts';

const ctxFor = (data = loadSite(), query = '', showFlight = true): Ctx => ({
  data, history: [], showFlight, now: new Date(`${TODAY}T12:00:00`), issues: null, lastSeen: null,
  query: new URLSearchParams(query), baseUrl: 'https://example.test/',
});
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('subsystem pages', () => {
  const data = loadSite();
  it('there are nine subsystems', () => expect(data.subsystems.map((s) => s.id).sort()).toEqual(
    ['firmware', 'flight', 'ground', 'optics', 'power', 'receiver', 'safety', 'tracking', 'transmitter']));

  for (const s of data.subsystems) {
    it(`${s.id}: parameter rows = register rows, parts = parts.yaml rows`, () => {
      const html = renderSubsystem(ctxFor(data), s.id);
      expect(count(html, /<tr id="row-[^"]+" data-row="/g)).toBe(data.register.filter((r) => r.subsystem === s.id).length);
      expect(count(html, /data-part="/g)).toBe(data.parts.filter((p) => p.subsystem === s.id).length);
      // every intro sentence and gotcha is on the page with its citation
      for (const t of s.intro) expect(html).toContain(t.cite.replace(/&/g, '&amp;'));
      expect(count(html, /data-gotcha="/g)).toBe(s.gotchas.length);
    });
  }

  it('every register row appears on exactly one subsystem page', () => {
    const total = data.subsystems.reduce((n, s) => n + count(renderSubsystem(ctxFor(data), s.id), /<tr id="row-/g), 0);
    expect(total).toBe(data.register.length);
  });

  it('superseded doc text is marked, not presented as current', () => {
    const html = renderSubsystem(ctxFor(data), 'transmitter');
    expect(html).toMatch(/850 nm diode at ≤200 mW[^<]*<span class="cite"[^>]*>[^<]*<\/span> <span class="sup"[^>]*>superseded by/);
  });
});

describe('map', () => {
  it('links every subsystem block to its page', () => {
    const data = loadSite();
    const html = renderMap(ctxFor(data));
    for (const s of data.subsystems) expect(html).toContain(`class="block status-${data.derived.subsystems[s.id].status}" href="#/s/${s.id}"`);
  });

  it('a register edit flows to the map tile, register, inbox and subsystem page', () => {
    const raw = clone(loadRawData());
    const tx02 = raw.register.find((r) => r.id === 'TX-02')!;
    tx02.value = '200';
    tx02.changed = '2026-09-26';
    const data = buildSiteData(raw, '2026-09-26');
    const c = ctxFor(data);
    expect(renderMap(c)).toContain('+14.2 dB');                              // C1 margin tile
    expect(renderRegister(c)).toMatch(/data-row="TX-02"[\s\S]*?>200</);      // register row
    expect(renderInbox(c, 'bilal')).toContain('RX-04');                       // owner's inbox
    expect(renderSubsystem(c, 'receiver')).toMatch(/data-row="RX-04"[^>]*is-stale/);
  });
});

describe('sandbox', () => {
  it('#/sandbox?TX-02=1&TX-01=660&TX-06=20&SYS-02=5 applies the values and shows C1 margin ≈ +4.8 dB', () => {
    const data = loadSite();
    const q = 'TX-02=1&TX-01=660&TX-06=20&SYS-02=5';
    const st = parseSandbox(data, new URLSearchParams(q));
    expect(st.values).toMatchObject({ 'TX-02': 1, 'TX-01': 660, 'TX-06': 20, 'SYS-02': 5 });
    expect(Math.round(runModel(data, st.values).c1.margin_db * 10) / 10).toBe(4.8);
    expect(renderSandbox(ctxFor(data, q))).toContain('+4.8 dB');
  });

  it('interfaces page sorts missing → draft → agreed', () => {
    const html = renderInterfaces(ctxFor());
    const ids = [...html.matchAll(/data-iface="(I-\d+)"/g)].map((m) => m[1]);
    expect(ids.slice(0, 5)).toEqual(['I-04', 'I-06', 'I-07', 'I-11', 'I-12']);
  });
});
