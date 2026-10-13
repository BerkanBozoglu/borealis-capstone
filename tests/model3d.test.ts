import { describe, expect, it } from 'vitest';
import { renderInspector, renderModel3d, beamAngles, objectForPart } from '../src/render/model3d.ts';
import { renderHardware } from '../src/render/hardware.ts';
import type { Ctx } from '../src/render/util.ts';
import { TODAY, clone, loadRawData, loadSite } from './helpers.ts';
import { buildSiteData } from '../scripts/lib/derive.ts';
import { GEOMETRY_IDS } from '../src/hw3d/scene.ts';

const ctxFor = (data = loadSite()): Ctx => ({
  data, history: [], showFlight: false, now: new Date(`${TODAY}T12:00:00`), issues: null, lastSeen: null,
  query: new URLSearchParams(''), baseUrl: 'https://example.test/',
});

describe('3D model data (model3d.yaml)', () => {
  const data = loadSite();
  const objs = data.model3d.objects;

  it('every object in the YAML has geometry, and every geometry has facts', () => {
    const geo = new Set(GEOMETRY_IDS);
    for (const o of objs) expect(geo.has(o.id), `${o.id} has no builder in src/hw3d/scene.ts`).toBe(true);
    const ids = new Set(objs.map((o) => o.id));
    for (const g of GEOMETRY_IDS) expect(ids.has(g), `${g} is drawn but has no entry in data/model3d.yaml`).toBe(true);
  });
  it('every part / alt_of / also reference is a parts.yaml id', () => {
    const parts = new Set(data.parts.map((p) => p.id));
    for (const o of objs) for (const id of [o.part, o.alt_of, ...(o.also ?? [])].filter(Boolean)) expect(parts.has(id!), `${o.id} → ${id}`).toBe(true);
  });
  it('every dims row is [label, value, tag] and every source key resolves', () => {
    for (const o of objs) {
      for (const d of o.dims) { expect(d.length, o.id).toBe(3); expect(['source', 'derived', 'estimate']).toContain(d[2]); }
      for (const k of o.sources) expect(data.model3d.sources[k], `${o.id} source ${k}`).toBeTruthy();
    }
  });
  it('every core station part on the Hardware page is drawn in 3D', () => {
    const covered = new Set(objs.flatMap((o) => [o.part, ...(o.also ?? [])].filter(Boolean)));
    const station = data.parts.filter((p) => p.track === 'core' && p.hotspot?.view === 'station').map((p) => p.id);
    expect(station.filter((id) => !covered.has(id))).toEqual([]);
  });
  it('a dangling part reference fails the build', () => {
    const raw = clone(loadRawData());
    raw.model3d.objects[0].part = 'Z9';
    const d = buildSiteData(raw, TODAY, '2026-09-25T00:00:00Z');
    expect(d.derived.findings.some((f) => f.level === 'error' && f.message.includes('Z9'))).toBe(true);
  });
});

describe('3D model page', () => {
  it('renders the shell with every object in the list', () => {
    const ctx = ctxFor();
    const html = renderModel3d(ctx, null);
    for (const o of ctx.data.model3d.objects) expect(html).toContain(`data-m3-pick="${o.id}"`);
    expect(html).toContain('id="m3-view"');
  });
  it('the inspector shows LIVE part status from parts.yaml', () => {
    const raw = clone(loadRawData());
    const a1 = raw.parts.find((p) => p.id === 'A1')!;
    a1.chosen_part = 'Lasermate LTG6501A5-T';
    a1.availability = 'candidate';
    const ctx = ctxFor(buildSiteData(raw, TODAY, '2026-09-25T00:00:00Z'));
    const html = renderInspector(ctx, 'tx_laser');
    expect(html).toContain('Lasermate LTG6501A5-T');
    expect(html).toContain('achip-candidate');
    expect(html).toContain('href="#/hardware/A2"'); // also: [A2, A4]
  });
  it('alternatives without a parts row say so', () => {
    expect(renderInspector(ctxFor(), 'rxB_lens')).toContain('No row in parts.yaml yet');
  });
  it('the beam angle is read from the register', () => {
    const raw = clone(loadRawData());
    raw.register.find((r) => r.id === 'TX-07')!.value = '100 (±2.86°)';
    expect(beamAngles(ctxFor(buildSiteData(raw, TODAY, '2026-09-25T00:00:00Z'))).wide).toBe(100);
  });
  it('the Hardware page links parts to the 3D model', () => {
    const ctx = ctxFor();
    expect(objectForPart(ctx, 'C1')?.id).toBe('rxA_tube');
    expect(renderHardware(ctx, 'B1')).toContain('href="#/model/det_pd"');
  });
});
