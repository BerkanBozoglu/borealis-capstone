import { describe, expect, it } from 'vitest';
import { buildSiteData } from '../scripts/lib/derive.ts';
import { renderHardware } from '../src/render/hardware.ts';
import type { Ctx } from '../src/render/util.ts';
import { TODAY, clone, loadRawData, loadSite } from './helpers.ts';

const ctxFor = (data = loadSite(), query = ''): Ctx => ({
  data, history: [], showFlight: false, now: new Date(`${TODAY}T12:00:00`), issues: null, lastSeen: null,
  query: new URLSearchParams(query), baseUrl: 'https://example.test/',
});

describe('parts.yaml hardware fields', () => {
  const data = loadSite();
  const core = data.parts.filter((p) => p.track === 'core' && p.availability);

  it('23 core parts carry availability: available 1 / candidate 8 / choosing 10 / blocked 4', () => {
    expect(core.length).toBe(23);
    const count = (a: string) => core.filter((p) => p.availability === a).length;
    expect([count('available'), count('candidate'), count('choosing'), count('blocked')]).toEqual([1, 8, 10, 4]);
  });
  it('every flight-track part is availability: flight', () => {
    for (const p of data.parts.filter((x) => x.track === 'flight')) expect(p.availability, p.id).toBe('flight');
  });
  it('every blocked part has blocked_reason', () => {
    for (const p of core.filter((x) => x.availability === 'blocked')) expect(p.blocked_reason, p.id).toBeTruthy();
  });
  it('every touches id exists', () => {
    const ids = new Set([...data.register.map((r) => r.id), ...data.interfaces.map((i) => i.id)]);
    for (const p of data.parts) for (const t of p.touches ?? []) expect(ids.has(t), `${p.id} → ${t}`).toBe(true);
  });
  it('cost, lead time and datasheet are never invented: all null today', () => {
    for (const p of core) {
      expect(p.est_cost_cad ?? null, p.id).toBeNull();
      expect(p.lead_time ?? null, p.id).toBeNull();
      expect(p.datasheet_url ?? null, p.id).toBeNull();
    }
    expect(data.derived.hardware).toMatchObject({ priced: 0, to_price: 22, budget_cad: 700 });
  });
});

describe('hardware lint rules', () => {
  const codes = (raw = loadRawData()) => buildSiteData(raw, TODAY).derived.findings;
  it("C1 says 'buy new or borrow', so no used-market warning fires", () => {
    expect(codes().some((f) => f.code === 'used-market')).toBe(false);
  });
  it("setting C1.source to 'buy used' fires it", () => {
    const raw = clone(loadRawData());
    raw.parts.find((p) => p.id === 'C1')!.source = 'buy used';
    expect(codes(raw).some((f) => f.code === 'used-market' && f.ids.includes('C1'))).toBe(true);
  });
  it('a blocked part without blocked_reason is an error', () => {
    const raw = clone(loadRawData());
    delete raw.parts.find((p) => p.id === 'C3')!.blocked_reason;
    expect(codes(raw).some((f) => f.level === 'error' && f.code === 'blocked-without-reason')).toBe(true);
  });
  it('an unknown touches id is an error', () => {
    const raw = clone(loadRawData());
    raw.parts.find((p) => p.id === 'B1')!.touches!.push('NOPE-9');
    expect(codes(raw).some((f) => f.level === 'error' && f.message.includes('NOPE-9'))).toBe(true);
  });
  it('over budget warns once priced parts exceed budget_cad', () => {
    const raw = clone(loadRawData());
    raw.parts.find((p) => p.id === 'C1')!.est_cost_cad = 900;
    const site = buildSiteData(raw, TODAY);
    expect(site.derived.findings.some((f) => f.code === 'over-budget')).toBe(true);
    expect(site.derived.hardware).toMatchObject({ priced: 1, priced_total_cad: 900 });
  });
  it('the Class 2 check flags a core part still specified at 850 nm without a note', () => {
    expect(codes().filter((f) => f.code === 'class2-unchecked').map((f) => f.ids[0])).toEqual(['H1']);
  });
});

describe('hardware page', () => {
  const data = loadSite();
  it('renders all 18 station hotspots at their stored coordinates', () => {
    const html = renderHardware(ctxFor(data), null);
    const station = data.parts.filter((p) => p.hotspot?.view === 'station');
    expect(station.length).toBe(18);
    for (const p of station) {
      const { x, y } = p.hotspot as { x: number; y: number };
      expect(html, p.id).toContain(`style="left:${x - 16}px;top:${y - 16}px" data-hw-part="${p.id}"`);
    }
    expect((html.match(/class="hs hs-/g) ?? []).length).toBe(18);
  });
  it('defaults to the first blocked part and shows its blocked box', () => {
    const html = renderHardware(ctxFor(data), null);
    expect(html).toContain('data-detail="A1"');
    expect(html).toContain("Why we can't use it as-is");
  });
  it('selecting H2 shows "Can use now"', () => {
    const html = renderHardware(ctxFor(data), 'H2');
    expect(html).toMatch(/data-detail="H2"[\s\S]*?achip-available">Can use now/);
    expect(html).not.toMatch(/data-detail="H2"[\s\S]*Why we can't use it as-is/);
  });
  it('the beam label reads from TX-01 and TX-06', () => {
    expect(renderHardware(ctxFor(data), null)).toContain('>660 nm beam · 60 mrad</text>');
    const raw = clone(loadRawData());
    raw.register.find((r) => r.id === 'TX-01')!.value = '850 (Class 3B upgrade)';
    raw.register.find((r) => r.id === 'TX-06')!.value = 20;
    expect(renderHardware(ctxFor(buildSiteData(raw, TODAY)), null)).toContain('>850 nm beam · 20 mrad</text>');
  });
  it('null cost shows [add] linking to the editor', () => {
    expect(renderHardware(ctxFor(data), 'B1')).toMatch(/class="add" href="https:\/\/github.com\/[^"]+\/edit\/main\/data\/parts.yaml"[^>]*>\[add\]/);
  });
  it('filters dim hotspots outside the group', () => {
    const html = renderHardware(ctxFor(data, 'group=B'), 'B1');
    expect(html).toMatch(/class="hs hs-blocked\s+dim"[^>]*data-hw-part="A1"/);
    expect(html).toMatch(/class="hs hs-candidate sel\s*"[^>]*data-hw-part="B1"/);
  });
});

describe('software section', () => {
  const data = loadSite();
  const html = renderHardware(ctxFor(data), null);
  it('renders both columns with every module', () => {
    expect(html).toContain('Runs on the laptop');
    expect(html).toContain('Runs on the boards');
    for (const m of [...data.software.laptop.modules, ...data.software.boards.modules]) expect(html).toContain(`data-sw-module="${m.name}"`);
  });
  it('modules link to what they talk to', () => {
    const block = (name: string) => html.split(`data-sw-module="${name}"`)[1].split('</li>')[0];
    expect(block('Guide processor')).toContain('href="#/hardware/C6"');
    expect(block('Mount controller + state machine')).toMatch(/#\/hardware\/C4[\s\S]*#\/interfaces\?id=I-09/);
    expect(block('Decoder service')).toMatch(/#\/hardware\/B5[\s\S]*#\/interfaces\?id=I-07/);
    expect(block('Transmitter command')).toContain('#/interfaces?id=I-12');
  });
  it('owners: Arnav on the laptop, Batu on the boards; front-end choice is exploring', () => {
    expect(data.software.laptop.owner).toBe('arnav');
    expect(data.software.boards.owner).toBe('batu');
    expect(html).toMatch(/stage-exploring">exploring<\/span> <b>Ground software front end: PyQt or web/);
  });
  it('F is not in the lanes or the "not on this view" list, and lane totals are unchanged', () => {
    expect(html).not.toContain('data-hw-part="F"');
    expect(html).not.toMatch(/Not on this view yet[^<]*<a href="#\/s\/ground">F</);
    expect(data.parts.filter((p) => p.track === 'core' && p.availability).length).toBe(23);
  });
});

describe('people', () => {
  it('everyone has a GitHub handle and Arnav owns the ground-software rows and interfaces', () => {
    const data = loadSite();
    for (const p of data.people) expect(p.github, p.id).toBeTruthy();
    expect(data.people.find((p) => p.id === 'arnav')!.github).toBe('arnav-singh-ahlawat');
    for (const id of ['GS-01', 'GS-02']) expect(data.register.find((r) => r.id === id)!.owner).toBe('arnav');
    for (const id of ['I-07', 'I-08', 'I-09', 'I-12']) expect(data.interfaces.find((i) => i.id === id)!.owners).toContain('arnav');
    expect(data.people.some((p) => p.id === 'open')).toBe(false);
  });
});
