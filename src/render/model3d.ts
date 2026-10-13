// #/model and #/model/<object id> — the 3D hardware model.
// This file renders only HTML (testable in node). The WebGL scene is src/hw3d/scene.ts,
// loaded on demand by main.ts so the rest of the site never downloads three.js.
// Facts come from data/model3d.yaml; live status comes from parts.yaml and register.yaml.
import { firstNumber } from '../model.ts';
import type { Model3dObject } from '../types.ts';
import { touchLink, laneLabel } from './hardware.ts';
import { type Ctx, cite, esc, gh } from './util.ts';

const TAG_LABEL: Record<string, string> = { source: 'source', derived: 'derived', estimate: 'estimate' };

/** Register value as a number (e.g. "60 (±1.72°)" → 60), or a fallback. */
export function registerNumber(ctx: Ctx, id: string, fallback: number): number {
  const r = ctx.data.register.find((x) => x.id === id);
  const n = r ? firstNumber(r.value) : null;
  return n ?? fallback;
}

/** Beam angles the scene draws, read live from the register. */
export function beamAngles(ctx: Ctx): { narrow: number; wide: number } {
  return { narrow: registerNumber(ctx, 'TX-06', 60), wide: registerNumber(ctx, 'TX-07', 100) };
}

/** Parts each 3D object stands for (part + also). */
export const objectParts = (o: Model3dObject): string[] => [...(o.part ? [o.part] : []), ...(o.also ?? [])];

/** First 3D object that shows a part (for "See it in 3D" links), or null. */
export function objectForPart(ctx: Ctx, partId: string): Model3dObject | null {
  const objs = ctx.data.model3d?.objects ?? [];
  return objs.find((o) => o.part === partId) ?? objs.find((o) => (o.also ?? []).includes(partId) || o.alt_of === partId) ?? null;
}

function livePart(ctx: Ctx, o: Model3dObject): string {
  const { data } = ctx;
  const ids = objectParts(o);
  if (!ids.length && o.alt_of) {
    const base = data.parts.find((p) => p.id === o.alt_of);
    return `<div class="box box-warn"><b>Phase 1 alternative to <a href="#/hardware/${esc(o.alt_of)}">${esc(o.alt_of)}</a>${base ? ` ${esc(base.name)}` : ''}</b>
      <div>No row in parts.yaml yet, so its status, owner and cost are not tracked. Add a row to give it a live status here.</div>
      <div><a href="${esc(gh(data).edit('data/parts.yaml'))}" target="_blank" rel="noopener">Add a parts.yaml row</a></div></div>`;
  }
  if (!ids.length) return '';
  return ids.map((id, i) => {
    const p = data.parts.find((x) => x.id === id);
    if (!p) return '';
    const touches = (p.touches ?? []).map((t) => {
      const stale = data.derived.rows[t]?.stale;
      return stale ? touchLink(ctx, t).replace('class="chip"', 'class="chip chip-stale" title="stale: something upstream changed"') : touchLink(ctx, t);
    }).join('');
    return `<div class="m3-part${i ? ' m3-part-also' : ''}">
      <div class="small"><a class="chip" href="#/hardware/${esc(p.id)}">${esc(p.id)}</a> <b>${esc(p.name)}</b> ${i ? '<span class="muted">(inside this object)</span>' : ''}</div>
      <div class="small muted">${p.availability ? `<span class="achip achip-${esc(p.availability)}">${esc(laneLabel(ctx, p.availability))}</span> · ` : ''}status ${esc(p.status)} · owner ${esc(p.owner_display ?? '—')} · chosen ${esc(p.chosen_part || 'TBD')}</div>
      ${i === 0 && p.blocked_reason ? `<div class="box box-bad"><b>Why we can't use it as-is</b><div>${esc(p.blocked_reason)}</div></div>` : ''}
      ${i === 0 && touches ? `<div class="chips"><span class="small muted">Changing it touches</span>${touches}</div>` : ''}
    </div>`;
  }).join('');
}

function beamRows(ctx: Ctx): string {
  const row = (id: string) => {
    const r = ctx.data.register.find((x) => x.id === id);
    return r ? `<dt><a href="#/register?id=${esc(id)}">${esc(id)}</a> ${esc(r.name)}</dt><dd>${esc(r.value)} ${esc(r.unit)} <span class="tag tag-${esc(r.tag)}">${esc(r.tag)}</span></dd>` : '';
  };
  return `<h3 class="caps">Live from the register</h3><dl class="m3-kv">${['TX-01', 'TX-02', 'TX-06', 'TX-07'].map(row).join('')}</dl>`;
}

export function renderInspector(ctx: Ctx, id: string | null): string {
  const m3 = ctx.data.model3d;
  const o = id ? m3?.objects.find((x) => x.id === id) : undefined;
  if (!o) {
    return `<div class="small muted caps">Inspector</div><h2>Click any part</h2>
      <p>Each piece opens with what it does, its real dimensions and where each number came from, plus the <b>live</b> status of its row in parts.yaml: lane, owner, chosen part, and the register rows and interfaces it touches.</p>
      <p class="small muted">Tags: <span class="m3-tag m3-tag-source">source</span> datasheet or retailer · <span class="m3-tag m3-tag-derived">derived</span> calculated · <span class="m3-tag m3-tag-estimate">estimate</span> sized by eye for the model. Turn on <b>Colour by status</b> to paint every part by its parts.yaml lane.</p>`;
  }
  const dims = o.dims.map(([l, v, t]) => `<dt>${esc(l)}</dt><dd>${esc(v)} <span class="m3-tag m3-tag-${esc(t)}">${esc(TAG_LABEL[t] ?? t)}</span></dd>`).join('');
  const srcs = o.sources.map((k) => m3!.sources[k]).filter(Boolean)
    .map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</li>`).join('');
  return `<div class="small muted caps">${esc(o.group)} · <span class="id">${esc(o.id)}</span></div>
    <h2>${esc(o.name)}</h2>
    ${livePart(ctx, o)}
    <p>${esc(o.what)}</p>
    <dl class="m3-kv">${dims}</dl>
    ${o.kind === 'light' ? beamRows(ctx) : ''}
    ${o.budget ? `<div class="small"><span class="muted">Budget</span> ${esc(o.budget)} ${cite('Phase 1 §14')}</div>` : ''}
    ${o.note ? `<div class="box box-warn">${esc(o.note)}</div>` : ''}
    ${srcs ? `<ol class="small m3-srcs">${srcs}</ol>` : ''}
    <div class="actions-row wrap">
      <a class="btn" href="${esc(gh(ctx.data).edit('data/model3d.yaml'))}" target="_blank" rel="noopener">Edit these facts</a>
      ${o.part ? `<a class="btn" href="#/hardware/${esc(o.part)}">${esc(o.part)} on the Hardware page</a>` : ''}
    </div>`;
}

export function renderModel3d(ctx: Ctx, selectedId: string | null): string {
  const objs = ctx.data.model3d?.objects ?? [];
  const groups = [...new Set(objs.map((o) => o.group))];
  const list = groups.map((g) => `<h3 class="caps">${esc(g)}</h3>${objs.filter((o) => o.group === g).map((o) =>
    `<button type="button" class="m3-item${o.id === selectedId ? ' sel' : ''}" data-m3-pick="${esc(o.id)}" data-m3-config="${esc(o.config.join(' '))}">
      <span>${esc(o.name)}</span><span class="id small muted">${esc(objectParts(o).join(' · ') || (o.alt_of ? `alt ${o.alt_of}` : ''))}</span></button>`).join('')}`).join('');
  return `<section class="card m3-top">
    <a href="#/hardware" class="small">← Hardware</a>
    <div class="section-head"><div><h1>3D model</h1><p class="muted">Both stations to scale, from data/model3d.yaml. Live status from parts.yaml; beam angle from ${esc('TX-06')} / ${esc('TX-07')}.</p></div></div>
    <div class="m3-bar">
      <div class="m3-grp"><span class="caps small muted">Receiver</span><div class="seg" data-m3-seg="rx"><button type="button" data-v="A" class="on">Telescope + GoTo</button><button type="button" data-v="B">Fresnel + pan-tilt</button></div></div>
      <div class="m3-grp"><span class="caps small muted">Transmitter</span><div class="seg" data-m3-seg="tx"><button type="button" data-v="C1" class="on">C1 tripod</button><button type="button" data-v="C2">C2 cart</button><button type="button" data-v="C3">C3 indoor</button></div></div>
      <div class="m3-grp"><span class="caps small muted">Explode</span><input type="range" id="m3-explode" min="0" max="1" step="0.01" value="0" aria-label="Explode the assembly"></div>
      <div class="m3-grp">
        <button type="button" class="pill" data-m3-tog="xray" aria-pressed="false">X-ray</button>
        <button type="button" class="pill" data-m3-tog="cut" aria-pressed="false">Cut open</button>
        <button type="button" class="pill" data-m3-tog="status" aria-pressed="false">Colour by status</button>
        <button type="button" class="pill" data-m3-tog="bench" aria-pressed="false">Power meter</button>
        <button type="button" class="pill active" data-m3-tog="beam" aria-pressed="true">Beam</button>
      </div>
    </div>
  </section>
  <div class="m3-grid">
    <div class="m3-view card" id="m3-view">
      <div class="m3-views">
        <button type="button" data-m3-view="all">Whole link</button><button type="button" data-m3-view="rx">Receiver</button><button type="button" data-m3-view="det">Detector close-up</button><button type="button" data-m3-view="tx">Transmitter</button><button type="button" data-m3-view="txc">Laser close-up</button>
      </div>
      <div class="m3-tip" id="m3-tip" hidden></div>
      <div class="m3-hint small">Drag to rotate · scroll or pinch to zoom · right-drag or two fingers to pan · click a part</div>
      <div class="m3-legend small" id="m3-legend" hidden>
        <span><i class="lane-available"></i>can use now</span><span><i class="lane-candidate"></i>want to use</span><span><i class="lane-choosing"></i>still choosing</span><span><i class="lane-blocked"></i>can't use as-is</span><span><i class="lane-alt"></i>no parts.yaml row</span>
      </div>
      <p class="m3-loading muted" id="m3-loading">Loading the 3D view…</p>
    </div>
    <aside class="card m3-side">
      <div id="m3-inspector">${renderInspector(ctx, selectedId)}</div>
      <div class="m3-list">${list}</div>
    </aside>
  </div>`;
}
