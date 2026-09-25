import { describe, expect, it } from 'vitest';
import { evaluate, firstNumber, upperOfRange, passband, type ModelInputs } from '../src/model.ts';
import { constants } from './helpers.ts';

// Rev D.2 baseline (01 §5.1): 200 mW, 850 nm, 60 mrad, 1 km, 130 mm, 50 kbps, −50 dBm, 120 kΩ
const BASE: ModelInputs = {
  pmW: 200, nm: 850, mrad: 60, c2mrad: 200, range_m: 1000, c2range_m: 300, apMM: 130, kbps: 50,
  sens50_dbm: -50, rf_kohm: 120, atmRxLoss_db: 4.5, diffuserLoss_db: 0, fl_mm: 750,
};
const C = constants();
const r1 = (x: number) => Math.round(x * 10) / 10;

describe('model: Rev D.2 baseline (01 §4, §5.1)', () => {
  const out = evaluate(BASE, C);
  it('capture −53.3 dB', () => expect(r1(out.c1.capture_db)).toBe(-53.3));
  it('received −35.8 dBm on-state, 3 dB lower average', () => {
    expect(r1(out.c1.prx_dbm)).toBe(-35.8);
    expect(out.c1.prx_dbm - out.c1.prx_avg_dbm).toBeCloseTo(3.0, 1);
  });
  it('margin +14.2 dB', () => expect(r1(out.c1.margin_db)).toBe(14.2));
  it('TIA 15.9 mV', () => expect(r1(out.c1.v_tia * 1000)).toBe(15.9));
  it('indoor attenuation 26.0 dB at 50 m', () => expect(r1(out.att50_db)).toBe(26.0));
  it('pointing ±1.72°', () => expect(Math.round(out.c1.pointing_half_deg * 100) / 100).toBe(1.72));
  it('responsivity 0.50 A/W at 850 nm (ASSUMED)', () => expect(out.responsivity).toBe(0.5));
  it('C2 at 300 m / 200 mrad has the same on-axis power as C1 (01 §5.2)', () => {
    expect(r1(out.c2.prx_dbm)).toBe(r1(out.c1.prx_dbm));
  });
  it('FOV 3.6 mrad at 750 mm (02 B1)', () => expect(r1(out.fov_mrad)).toBe(3.6));
});

describe('model: saturation at 50 m (01 §5.1, gotcha 7)', () => {
  it('850 nm / 200 mW at 50 m with no attenuation gives ≈6.4 V and flags saturation', () => {
    const out = evaluate(BASE, C);
    expect(r1(out.near.v_tia)).toBe(6.4);
    expect(out.near_saturated).toBe(true);
    expect(out.c1_saturated).toBe(false);
  });
});

describe('model: Class 2 change', () => {
  it('1 mW, 660 nm, everything else baseline: margin ≈ −9.8 dB', () => {
    const out = evaluate({ ...BASE, pmW: 1, nm: 660 }, C);
    expect(out.responsivity).toBe(0.4);
    expect(r1(out.c1.margin_db)).toBe(-9.8);
  });
  it('1 mW, 660 nm, 20 mrad, 5 kbps: margin ≈ +4.8 dB and pointing ±0.57°', () => {
    const out = evaluate({ ...BASE, pmW: 1, nm: 660, mrad: 20, kbps: 5 }, C);
    expect(r1(out.c1.margin_db)).toBe(4.8);
    expect(Math.round(out.c1.pointing_half_deg * 100) / 100).toBe(0.57);
  });
});

describe('reading register values', () => {
  it('firstNumber', () => {
    expect(firstNumber('<=1 (was <=200)')).toBe(1);
    expect(firstNumber('660 (was 850)')).toBe(660);
    expect(firstNumber('>=1000')).toBe(1000);
    expect(firstNumber('300 (200-500)')).toBe(300);
    expect(firstNumber('≈ -9 (was ~+14)')).toBe(-9);
    expect(firstNumber(-50)).toBe(-50);
    expect(firstNumber('TBD')).toBe(null);
  });
  it('upperOfRange uses the upper focal length', () => expect(upperOfRange('650-750')).toBe(750));
  it('passband 850/40 → 830–870', () => expect(passband('850/40 (must change)')).toEqual([830, 870]));
});
