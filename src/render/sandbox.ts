import type { ModelOutputs } from '../model.ts';
import { baselinePreset, parseSandbox, runModel, sandboxHash, whoHasToLook, type SandboxState } from '../sandbox.ts';
import {
  type Ctx, cite, eng, esc, gh, mark, modeled, num, personLink, personName, rowLink, tagChip,
} from './util.ts';

function ownerOf(ctx: Ctx, id: string) {
  const r = ctx.data.register.find((x) => x.id === id);
  return r ? personName(ctx.data, r.owner) : '';
}

function control(ctx: Ctx, st: SandboxState, i: number): string {
  const { data } = ctx;
  const c = data.model.controls[i];
  const row = data.register.find((r) => r.id === c.param)!;
  const v = st.values[c.param];
  const scoped = st.scope && row.subsystem === st.scope;
  const dim = st.scope && !scoped;
  const changed = st.changed.includes(c.param);
  let input = '';
  if (c.kind === 'pills') {
    const opts = c.options ?? [];
    const custom = !opts.includes(v) ? `<button class="pill active" data-sb-param="${esc(c.param)}" data-sb-value="${v}">${esc(v)} (URL)</button>` : '';
    input = `<div class="pills">${opts.map((o) => `<button class="pill ${o === v ? 'active' : ''} ${o === st.committed[c.param] ? 'committed' : ''}" data-sb-param="${esc(c.param)}" data-sb-value="${o}" title="${o === st.committed[c.param] ? 'committed value' : ''}">${esc(o)}</button>`).join('')}${custom}</div>`;
  } else {
    input = `<div class="slider"><input type="range" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${v}" data-sb-param="${esc(c.param)}" aria-label="${esc(c.label)}">
      <output class="num" data-sb-out="${esc(c.param)}">${esc(v)}</output></div>`;
  }
  return `<div class="ctl ${scoped ? 'scoped' : ''} ${dim ? 'dim' : ''} ${changed ? 'changed' : ''}">
    <div class="ctl-head"><b>${esc(c.label)}</b> <span class="unit">${esc(row.unit)}</span></div>
    <div class="small muted">${rowLink(data, c.param)} · ${esc(personName(data, row.owner))} · committed <span class="num">${esc(st.committed[c.param])}</span> ${tagChip(row.tag)}</div>
    ${input}
  </div>`;
}

function gauge(ctx: Ctx, label: string, v: number, before: number | null): string {
  const { min_db, max_db } = ctx.data.model.gauge;
  const ok = Number(ctx.data.model.constants.marginOk_db.value);
  const pos = (x: number) => ((Math.max(min_db, Math.min(max_db, x)) - min_db) / (max_db - min_db)) * 100;
  const cls = v < 0 ? 'bad' : v < ok ? 'warn' : 'ok';
  return `<div class="gauge-wrap"><div class="gauge-head"><b>${esc(label)}</b> ${modeled()} <span class="gauge-val ${cls} num">${num(v, 1, true)} dB</span></div>
    <svg class="gauge" viewBox="0 0 100 16" preserveAspectRatio="none" role="img" aria-label="${esc(label)} ${num(v, 1, true)} dB">
      <rect x="0" y="4" width="${pos(0)}" height="8" class="g-bad"/>
      <rect x="${pos(0)}" y="4" width="${pos(ok) - pos(0)}" height="8" class="g-warn"/>
      <rect x="${pos(ok)}" y="4" width="${100 - pos(ok)}" height="8" class="g-ok"/>
      <line x1="${pos(0)}" x2="${pos(0)}" y1="0" y2="16" class="g-zero"/>
      ${before !== null ? `<line x1="${pos(before)}" x2="${pos(before)}" y1="1" y2="15" class="g-before"/>` : ''}
      <rect x="${pos(v) - 0.8}" y="0" width="1.6" height="16" class="g-needle g-${cls}-needle"/>
    </svg>
    <div class="gauge-scale small muted num"><span>${num(min_db, 0)}</span><span>0</span><span>+${max_db}</span></div>
    ${before !== null ? `<div class="small muted">committed <span class="num">${num(before, 1, true)} dB</span> (grey tick)</div>` : ''}</div>`;
}

function grid(ctx: Ctx, o: ModelOutputs, b: ModelOutputs): string {
  const sat = Number(ctx.data.model.constants.tiaSaturation_v.value);
  const cell = (label: string, now: string, then: string, extra = '') =>
    `<div class="cell"><div class="small muted">${label}</div><div class="num big">${now}</div><div class="small muted">committed <span class="num">${then}</span></div>${extra}</div>`;
  return `<div class="grid">
    ${cell('C1 received, on-state', `${num(o.c1.prx_dbm)} dBm`, `${num(b.c1.prx_dbm)} dBm`)}
    ${cell('C1 received, average (Manchester, −3 dB)', `${num(o.c1.prx_avg_dbm)} dBm`, `${num(b.c1.prx_avg_dbm)} dBm`)}
    ${cell('C1 sensitivity at this rate and λ', `${num(o.c1.sens_dbm)} dBm`, `${num(b.c1.sens_dbm)} dBm`)}
    ${cell('C1 spot size', `${num(o.c1.spot_m)} m`, `${num(b.c1.spot_m)} m`)}
    ${cell('C1 capture', `${num(o.c1.capture_db)} dB`, `${num(b.c1.capture_db)} dB`)}
    ${cell('Pointing tolerance (narrow)', `±${num(o.c1.pointing_half_deg, 2)}°`, `±${num(b.c1.pointing_half_deg, 2)}°`)}
    ${cell('Pointing tolerance (C2 wide)', `±${num(o.c2.pointing_half_deg, 2)}°`, `±${num(b.c2.pointing_half_deg, 2)}°`)}
    ${cell('C2 received, on-state', `${num(o.c2.prx_dbm)} dBm`, `${num(b.c2.prx_dbm)} dBm`)}
    ${cell('TIA output at C1 range', eng(o.c1.v_tia, 'V'), eng(b.c1.v_tia, 'V'), o.c1_saturated ? `<div>${mark('broken', `saturated (> ${sat} V)`)}</div>` : '')}
    ${cell(`TIA output at ${ctx.data.model.constants.indoorRef_m.value} m, no attenuation`, eng(o.near.v_tia, 'V'), eng(b.near.v_tia, 'V'), o.near_saturated ? `<div>${mark('broken', `saturated (> ${sat} V)`)}</div>` : `<div>${mark('ok', 'below saturation')}</div>`)}
    ${cell(`Indoor attenuation at ${ctx.data.model.constants.indoorRef_m.value} m`, `${num(o.att50_db)} dB`, `${num(b.att50_db)} dB`)}
    ${cell('Receiver FOV', `${num(o.fov_mrad)} mrad`, `${num(b.fov_mrad)} mrad`)}
    ${cell(`Responsivity ${tagChip('ASSUMED')}`, `${o.responsivity} A/W`, `${b.responsivity} A/W`)}
  </div><p class="small muted">Every output here is ${modeled()}. Responsivity is ${tagChip('ASSUMED')} ${cite(ctx.data.model.constants.respOther_aw.cite)}. TX optics loss ${num(Number(ctx.data.model.constants.txOpticsLoss_db.value))} dB ${cite(ctx.data.model.constants.txOpticsLoss_db.cite)}.</p>`;
}

export function proposalUrl(ctx: Ctx, st: SandboxState): string {
  const { data } = ctx;
  const o = runModel(data, st.values);
  const b = runModel(data, st.committed);
  const who = whoHasToLook(data, st.changed);
  const share = ctx.baseUrl + sandboxHash(data, st.values, null);
  const handle = (p: string) => data.people.find((x) => x.id === p)?.github;
  const nameAt = (p: string) => (handle(p) ? `@${handle(p)}` : personName(data, p));
  const lines = [
    'Proposal from the dashboard sandbox. All outputs are MODELED.', '',
    `Share link: ${share}`, '',
    '| Input | Committed | Proposed | Owner |', '|---|---|---|---|',
    ...st.changed.map((id) => `| ${id} ${data.register.find((r) => r.id === id)?.name ?? ''} | ${st.committed[id]} | ${st.values[id]} | ${ownerOf(ctx, id)} |`), '',
    '| Output (MODELED) | Committed | Proposed |', '|---|---|---|',
    `| C1 margin | ${num(b.c1.margin_db, 1, true)} dB | ${num(o.c1.margin_db, 1, true)} dB |`,
    `| C2 margin | ${num(b.c2.margin_db, 1, true)} dB | ${num(o.c2.margin_db, 1, true)} dB |`,
    `| C1 received (on-state) | ${num(b.c1.prx_dbm)} dBm | ${num(o.c1.prx_dbm)} dBm |`,
    `| Pointing tolerance | ±${num(b.c1.pointing_half_deg, 2)}° | ±${num(o.c1.pointing_half_deg, 2)}° |`,
    `| TIA at 50 m, no attenuation | ${eng(b.near.v_tia, 'V')} | ${eng(o.near.v_tia, 'V')} |`, '',
    `Decide (owners of changed inputs): ${who.decide.map((w) => `${nameAt(w.person)} (${w.ids.join(', ')})`).join('; ') || '—'}`,
    `Re-check if accepted (owners of rows these feed): ${who.recheck.map((w) => `${nameAt(w.person)} (${w.ids.join(', ')})`).join('; ') || '—'}`,
  ];
  const assignees = who.decide.map((w) => handle(w.person)).filter(Boolean).join(',');
  const q: Record<string, string> = {
    title: `Proposal: ${st.changed.map((id) => `${id} ${st.committed[id]} → ${st.values[id]}`).join(', ') || 'no change'}`,
    body: lines.join('\n'),
    labels: 'proposal',
  };
  if (assignees) q.assignees = assignees;
  return gh(data).newIssue(q);
}

export function renderSandboxOutputs(ctx: Ctx, st: SandboxState): string {
  const { data } = ctx;
  const o = runModel(data, st.values);
  const b = runModel(data, st.committed);
  const who = whoHasToLook(data, st.changed);
  const share = ctx.baseUrl + sandboxHash(data, st.values, st.scope);
  const changedList = st.changed.length
    ? `<ul class="plain">${st.changed.map((id) => `<li>${rowLink(data, id)} ${esc(data.register.find((r) => r.id === id)?.name ?? '')}: <span class="num">${esc(st.committed[id])} → <b>${esc(st.values[id])}</b></span> <span class="muted small">${esc(ownerOf(ctx, id))}</span></li>`).join('')}</ul>`
    : '<p class="muted">Nothing changed: this is the committed register.</p>';
  const lookers = (list: { person: string; ids: string[] }[], verb: string) => list.length
    ? `<ul class="plain">${list.map((w) => `<li>${personLink(data, w.person)} ${verb} ${w.ids.map((id) => rowLink(data, id)).join(', ')}</li>`).join('')}</ul>`
    : '<p class="muted small">nobody</p>';
  return `<div class="gauges">${gauge(ctx, 'C1 margin', o.c1.margin_db, st.changed.length ? b.c1.margin_db : null)}${gauge(ctx, 'C2 margin', o.c2.margin_db, st.changed.length ? b.c2.margin_db : null)}</div>
  <h3>Everything downstream</h3>${grid(ctx, o, b)}
  <div class="cols"><div><h3>Changed from committed</h3>${changedList}</div>
  <div><h3>Who has to look</h3><div class="small muted">Decide (owners of changed inputs)</div>${lookers(who.decide, 'decides')}
    <div class="small muted">Re-check (owners of rows those inputs feed)</div>${lookers(who.recheck, 're-checks')}</div></div>
  <h3>Share</h3><div class="share"><input class="mono" readonly value="${esc(share)}" aria-label="share URL" data-select-all></div>
  <div class="actions-row">
    <a class="btn btn-primary ${st.changed.length ? '' : 'disabled'}" ${st.changed.length ? `href="${esc(proposalUrl(ctx, st))}" target="_blank" rel="noopener"` : 'aria-disabled="true"'}>Propose on GitHub</a>
    <a class="btn" href="#/sandbox${st.scope ? `?scope=${esc(st.scope)}` : ''}">Reset</a>
  </div>`;
}

export function renderSandbox(ctx: Ctx): string {
  const { data } = ctx;
  const st = parseSandbox(data, ctx.query);
  const presets = [
    ...data.presets.filter((p) => p.baseline),
    { id: 'committed', name: 'Committed now', cite: 'register.yaml', note: 'Values in data/register.yaml right now.' },
    ...data.presets.filter((p) => !p.baseline),
  ];
  const presetBtns = presets.map((p) => `<button class="btn btn-small" data-sb-preset="${esc(p.id)}" title="${esc(p.note)} (${esc(p.cite)})">${esc(p.name)}</button>`).join('');
  const scopeNote = st.scope ? `<p class="small">Scoped to <a href="#/s/${esc(st.scope)}">${esc(data.subsystems.find((s) => s.id === st.scope)?.name ?? st.scope)}</a>: its inputs are highlighted. <a href="${esc(sandboxHash(data, st.values, null))}">Show all</a></p>` : '';
  const base = baselinePreset(data);
  return `<section class="card"><h1>What-if sandbox</h1>
    <p class="small muted">Try a change and see what it affects before anyone commits it. The state lives in the URL, so the link is shareable. Nothing here changes the register. ${base ? `Baseline preset: ${esc(base.name)} ${cite(base.cite)}.` : ''}</p>${scopeNote}</section>
  <div class="sandbox">
    <section class="card sb-in"><h2>Inputs</h2><div class="presets">${presetBtns}</div>${data.model.controls.map((_, i) => control(ctx, st, i)).join('')}</section>
    <section class="card sb-out" id="sb-out">${renderSandboxOutputs(ctx, st)}</section>
  </div>`;
}
