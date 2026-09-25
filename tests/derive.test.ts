import { describe, expect, it } from 'vitest';
import { buildSiteData, computeRows } from '../scripts/lib/derive.ts';
import { errorsOf } from '../scripts/lib/checks.ts';
import { TODAY, clone, loadRawData, loadSite } from './helpers.ts';

describe('stale is computed, never typed (07 §2 D4)', () => {
  it('changing TX-02 makes RX-04 stale without touching RX-04', () => {
    const raw = clone(loadRawData());
    const rx04 = raw.register.find((r) => r.id === 'RX-04')!;
    // start from a clean state: every row checked today, nothing changed since
    for (const r of raw.register) { r.changed = '2026-09-01'; r.checked = TODAY; }
    expect(computeRows(raw)['RX-04'].stale).toBe(false);

    // the owner of TX-02 commits a change the next day; RX-04 is untouched
    const tx02 = raw.register.find((r) => r.id === 'TX-02')!;
    tx02.value = 2;
    tx02.changed = '2026-09-26';
    tx02.checked = '2026-09-26';
    const rows = computeRows(raw);
    expect(rows['RX-04'].stale).toBe(true);
    expect(rows['RX-04'].reasons).toEqual([{ from: 'TX-02', changed: '2026-09-26', checked: TODAY }]);
    expect(rx04.checked).toBe(TODAY);

    // and it shows on the receiver page's status and in Bilal's inbox
    const site = buildSiteData(raw, '2026-09-26');
    expect(site.derived.subsystems.receiver.stale).toContain('RX-04');
    expect(site.derived.inbox.bilal.stale_rows).toContain('RX-04');

    // re-checking clears it
    rx04.checked = '2026-09-26';
    expect(computeRows(raw)['RX-04'].stale).toBe(false);
  });

  it('seed data: RE-CHECK rows downstream of the Sep 24 change compute as stale', () => {
    const { derived } = loadSite();
    for (const id of ['RX-04', 'RX-01', 'TX-03', 'TX-04', 'SAF-02', 'OPT-06', 'SYS-04', 'SYS-05']) {
      expect(derived.rows[id].stale, id).toBe(true);
    }
    expect(derived.rows['TX-02'].stale).toBe(false);
  });
});

describe('checks', () => {
  it('current data has no errors', () => {
    expect(errorsOf(loadSite().derived.findings)).toEqual([]);
  });

  it('a core row that depends on a flight row fails the build (07 §2 D6)', () => {
    const raw = clone(loadRawData());
    raw.register.find((r) => r.id === 'FLT-01')!.feeds_into.push('OPT-03'); // the original seed edge
    const errs = errorsOf(buildSiteData(raw, TODAY).derived.findings);
    expect(errs.some((e) => e.code === 'core-depends-on-flight' && e.ids.includes('OPT-03'))).toBe(true);
  });

  it('MEASURED without complete conditions fails the build (07 §2 D5)', () => {
    const raw = clone(loadRawData());
    const row = raw.register.find((r) => r.id === 'RX-02')!;
    row.tag = 'MEASURED';
    row.conditions = { range_m: 50, power_dbm: -50 };
    expect(errorsOf(buildSiteData(raw, TODAY).derived.findings).some((e) => e.code === 'measured-without-conditions')).toBe(true);
    row.conditions = { range_m: 50, power_dbm: -50, attenuation_db: 26, bandwidth_khz: 100, temperature_c: 21, evidence: 'evidence/README.md' };
    expect(errorsOf(buildSiteData(raw, TODAY).derived.findings)).toEqual([]);
  });

  it('empty intro or gotchas fails the build', () => {
    const raw = clone(loadRawData());
    raw.subsystems[0].intro = [];
    raw.subsystems[1].gotchas = [];
    const codes = errorsOf(buildSiteData(raw, TODAY).derived.findings).map((e) => e.code);
    expect(codes).toContain('empty-intro');
    expect(codes).toContain('empty-gotchas');
  });

  it('unknown ids, owners, subsystems, enums and non-ASCII quotes are errors', () => {
    const raw = clone(loadRawData());
    raw.register[0].feeds_into.push('NOPE-01');
    raw.register[1].owner = 'nobody';
    raw.register[2].subsystem = 'nowhere';
    raw.interfaces[0].to = 'mars';
    raw.approvals[0].status = 'obtained' as never;
    raw.register[3].id = 'SYS’04';
    const codes = errorsOf(buildSiteData(raw, TODAY).derived.findings).map((e) => e.code);
    for (const c of ['unknown-feeds-into', 'unknown-owner', 'unknown-subsystem', 'interface-endpoint', 'approval-status', 'non-ascii-quote']) {
      expect(codes, c).toContain(c);
    }
  });

  it('warnings with committed values: C1 margin < 0 and filter passband vs wavelength', () => {
    const codes = loadSite().derived.findings.map((f) => f.code);
    expect(codes).toContain('c1-margin-negative');
    expect(codes).toContain('filter-passband');
  });

  it('an agreed interface whose spec text changes drops back to draft', () => {
    const raw = clone(loadRawData());
    const i = raw.interfaces[0];
    const hash = buildSiteData(raw, TODAY).derived.interfaces[i.id].computed_hash;
    i.status = 'agreed';
    i.spec_hash = hash;
    expect(buildSiteData(raw, TODAY).derived.interfaces[i.id].status).toBe('agreed');
    i.what += ' 5 V logic.';
    const site = buildSiteData(raw, TODAY);
    expect(site.derived.interfaces[i.id].status).toBe('draft');
    expect(site.derived.findings.some((f) => f.code === 'interface-spec-changed')).toBe(true);
  });
});
