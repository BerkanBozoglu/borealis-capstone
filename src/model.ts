// The physics model. Pure functions, no DOM. Inputs are keyed as in
// data/model.yaml; constants come from data/model.yaml too. Every output is
// MODELED; responsivity is ASSUMED.

export interface ModelInputs {
  pmW: number; nm: number; mrad: number; c2mrad: number; range_m: number; c2range_m: number;
  apMM: number; kbps: number; sens50_dbm: number; rf_kohm: number;
  atmRxLoss_db: number; diffuserLoss_db: number; fl_mm: number;
}

export interface ModelConstants {
  txOpticsLoss_db: number; detectorSide_mm: number; resp850_aw: number; respOther_aw: number;
  tiaSaturation_v: number; indoorRef_m: number;
}

export interface Chain {
  ptx_dbm: number; spot_m: number; capture_db: number;
  prx_dbm: number; prx_avg_dbm: number; sens_dbm: number; margin_db: number;
  pointing_half_deg: number; i_a: number; v_tia: number;
}

export interface ModelOutputs {
  responsivity: number;
  c1: Chain;
  c2: Chain;
  /** narrow beam at the indoor reference range with no attenuation */
  near: Chain;
  near_saturated: boolean;
  c1_saturated: boolean;
  att50_db: number;
  fov_mrad: number;
}

export const log10 = Math.log10;

export function responsivity(nm: number, c: Pick<ModelConstants, 'resp850_aw' | 'respOther_aw'>): number {
  return nm === 850 ? c.resp850_aw : c.respOther_aw;
}

export const ptxDbm = (pmW: number) => 10 * log10(pmW);
export const spotM = (mrad: number, range_m: number) => (mrad / 1000) * range_m;
export const captureDb = (apMM: number, spot_m: number) => 20 * log10(apMM / 1000 / spot_m);
export const sensDbm = (sens50_dbm: number, kbps: number, resp: number) =>
  sens50_dbm + 5 * log10(kbps / 50) + 10 * log10(0.5 / resp);
export const pointingHalfDeg = (mrad: number) => ((mrad / 2) * 180) / Math.PI / 1000;
export const att50Db = (range_m: number, ref_m: number) => 20 * log10(range_m / ref_m);
export const fovMrad = (detectorSide_mm: number, fl_mm: number) => (detectorSide_mm / fl_mm) * 1000;

export function chain(
  p: { pmW: number; mrad: number; range_m: number; apMM: number; kbps: number; sens50_dbm: number; rf_kohm: number; atmRxLoss_db: number; extraLoss_db?: number },
  resp: number,
  c: Pick<ModelConstants, 'txOpticsLoss_db'>,
): Chain {
  const ptx_dbm = ptxDbm(p.pmW);
  const spot_m = spotM(p.mrad, p.range_m);
  const capture_db = captureDb(p.apMM, spot_m);
  const prx_dbm = ptx_dbm - c.txOpticsLoss_db + capture_db - p.atmRxLoss_db - (p.extraLoss_db ?? 0);
  const sens_dbm = sensDbm(p.sens50_dbm, p.kbps, resp);
  const i_a = (10 ** (prx_dbm / 10) / 1000) * resp;
  return {
    ptx_dbm, spot_m, capture_db, prx_dbm,
    prx_avg_dbm: prx_dbm - 10 * log10(2), // Manchester 50% duty: average is 3 dB below on-state (01 §4)
    sens_dbm,
    margin_db: prx_dbm - sens_dbm,
    pointing_half_deg: pointingHalfDeg(p.mrad),
    i_a,
    v_tia: i_a * p.rf_kohm * 1000,
  };
}

export function evaluate(x: ModelInputs, c: ModelConstants): ModelOutputs {
  const resp = responsivity(x.nm, c);
  const base = { pmW: x.pmW, apMM: x.apMM, kbps: x.kbps, sens50_dbm: x.sens50_dbm, rf_kohm: x.rf_kohm, atmRxLoss_db: x.atmRxLoss_db };
  const c1 = chain({ ...base, mrad: x.mrad, range_m: x.range_m }, resp, c);
  const c2 = chain({ ...base, mrad: x.c2mrad, range_m: x.c2range_m, extraLoss_db: x.diffuserLoss_db }, resp, c);
  const near = chain({ ...base, mrad: x.mrad, range_m: c.indoorRef_m }, resp, c);
  return {
    responsivity: resp,
    c1, c2, near,
    near_saturated: near.v_tia > c.tiaSaturation_v,
    c1_saturated: c1.v_tia > c.tiaSaturation_v,
    att50_db: att50Db(x.range_m, c.indoorRef_m),
    fov_mrad: fovMrad(c.detectorSide_mm, x.fl_mm),
  };
}

// ---------- reading numbers out of register values ----------

/** First number in a register value: "<=1 (was <=200)" → 1, "≈ -9" → -9, ">=1000" → 1000. */
export function firstNumber(v: number | string): number | null {
  if (typeof v === 'number') return v;
  const m = String(v).replace(/−/g, '-').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/i);
  return m ? Number(m[0]) : null;
}

/** Upper end of a leading range "650-750" → 750; otherwise firstNumber. */
export function upperOfRange(v: number | string): number | null {
  if (typeof v === 'number') return v;
  const m = String(v).match(/^\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[2]) : firstNumber(v);
}

/** Passband "850/40" → [830, 870] nm, or null if the value is not in that form. */
export function passband(v: number | string): [number, number] | null {
  const m = String(v).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const centre = Number(m[1]);
  const width = Number(m[2]);
  return [centre - width / 2, centre + width / 2];
}

/** Model constants as plain numbers from data/model.yaml's constants block. */
export function constantsFrom(cfg: Record<string, { value: number }>): ModelConstants {
  const need = ['txOpticsLoss_db', 'detectorSide_mm', 'resp850_aw', 'respOther_aw', 'tiaSaturation_v', 'indoorRef_m'] as const;
  const out = {} as ModelConstants;
  for (const k of need) {
    if (!cfg[k]) throw new Error(`data/model.yaml: missing constant ${k}`);
    out[k] = Number(cfg[k].value);
  }
  return out;
}

/**
 * Build model inputs from a values map keyed by register id.
 * inputMap: model key → register id (data/model.yaml "inputs").
 */
export function inputsFrom(values: Record<string, number>, inputMap: Record<string, string>): ModelInputs {
  const out = {} as Record<string, number>;
  for (const [key, id] of Object.entries(inputMap)) {
    const v = values[id];
    if (v === undefined || Number.isNaN(v)) throw new Error(`model input ${key} (${id}) has no numeric value`);
    out[key] = v;
  }
  return out as unknown as ModelInputs;
}

/** Numeric value of each model input row, read from register values. */
export function committedValues(
  register: { id: string; value: number | string }[],
  inputMap: Record<string, string>,
): Record<string, number> {
  const byId = new Map(register.map((r) => [r.id, r]));
  const out: Record<string, number> = {};
  for (const [key, id] of Object.entries(inputMap)) {
    const row = byId.get(id);
    if (!row) continue;
    const n = key === 'fl_mm' ? upperOfRange(row.value) : firstNumber(row.value);
    if (n !== null) out[id] = n;
  }
  return out;
}
