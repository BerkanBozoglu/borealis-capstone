// WebGL scene for #/model. Geometry only: every fact shown in the inspector comes from
// data/model3d.yaml and parts.yaml. Each builder is keyed by a model3d.yaml object id;
// an object in the YAML with no builder here is listed but not drawn (and the test fails).
// Units are metres. The receiver sits at x = 0, the transmitter at x = TX0, beam along +x.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Builder = (g: THREE.Group) => void;
interface Def { build: Builder; ex: [number, number, number]; cutZ?: number }

// ---------------- materials and helpers ----------------
const C = { black: 0x23272f, steel: 0x8f97a3, alu: 0xa9b0ba, white: 0xe4e7ec, mirror: 0xd9e2f0, team: 0x6f95e0, pcb: 0x2a6b45, nuc: 0xdde2e8, chip: 0x15181d, red: 0xb3262e, gold: 0xc8a24a, glass: 0x9fc0ff };
interface MOpt { r?: number; m?: number; t?: boolean; op?: number; ds?: boolean; map?: THREE.Texture; em?: number; ei?: number; dw?: boolean }
function M(color: number, o: MOpt = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.55, metalness: o.m ?? 0, transparent: !!o.t, opacity: o.op ?? 1,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide, map: o.map ?? null, emissive: o.em ?? 0, emissiveIntensity: o.ei ?? 0, depthWrite: o.dw !== false,
  });
}
const V = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }
function cyl(r: number, len: number, m: THREE.Material, axis: 'x' | 'y' | 'z', x = 0, y = 0, z = 0, open = false, seg = 40) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open);
  if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2);
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o;
}
function rod(a: number[], b: number[], r: number, m: THREE.Material) {
  const A = V(a), B = V(b), d = B.clone().sub(A);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 14), m);
  o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
function sph(r: number, m: THREE.Material, x: number, y: number, z: number) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); o.position.set(x, y, z); return o; }
function torusX(R: number, r: number, m: THREE.Material, x: number, y: number, z: number) { const g = new THREE.TorusGeometry(R, r, 10, 48); g.rotateY(Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; }
function cable(pts: number[][], color = 0x101318) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(V)), 60, 0.0035, 8, false), M(color, { r: 0.8 })); }
function hull2(pts: [number, number][]): [number, number][] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function belt(c1: number[], r1: number, c2: number[], r2: number, map: (p: [number, number]) => number[]) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push([c1[0] + Math.cos(a) * r1, c1[1] + Math.sin(a) * r1], [c2[0] + Math.cos(a) * r2, c2[1] + Math.sin(a) * r2]); }
  const h = hull2(pts).map(map);
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(h.map(V), true), 160, 0.0018, 6, true), M(0x111111));
}
function canvasTexture(draw: (x: CanvasRenderingContext2D, c: HTMLCanvasElement) => void, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, c);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function label(text: string, size: number, color: string) {
  const fs = 64; const probe = document.createElement('canvas').getContext('2d')!; probe.font = `600 ${fs}px IBM Plex Mono, monospace`;
  const w = Math.ceil(probe.measureText(text).width) + 40, h = fs + 30;
  const t = canvasTexture((x) => { x.font = `600 ${fs}px IBM Plex Mono, monospace`; x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(text, 20, h / 2); }, w, h);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set((size * w) / h, size, 1); return s;
}

// ---------------- geometry (world coordinates) ----------------
const ZA = 0.18, YA = 1.21, FXA = -0.25, FYA = 1.34;     // telescope axis and focus
const YB = 1.33, LXB = -0.1, FXB = LXB + 0.1524;           // Fresnel axis, lens plane, focus (f = 152.4 mm)
const TX0 = -4.2, TY = 1.2864;                              // transmitter position, laser axis height

const DEFS: Record<string, Def> = {
  rxA_tripod: { ex: [0, 0, 0], build: (g) => {
    const m = M(C.steel, { m: 0.6, r: 0.35 }), mb = M(C.black);
    g.add(cyl(0.06, 0.04, mb, 'y', 0, 0.95, 0));
    for (const d of [90, 210, 330]) { const a = (d * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      g.add(rod([0.05 * c, 0.93, 0.05 * s], [0.45 * c, 0.01, 0.45 * s], 0.015, m), sph(0.018, mb, 0.45 * c, 0.012, 0.45 * s), rod([0.13 * c, 0.45, 0.13 * s], [0.256 * c, 0.45, 0.256 * s], 0.006, m)); }
    g.add(cyl(0.14, 0.008, mb, 'y', 0, 0.45, 0));
  } },
  rxA_mount: { ex: [0, 0, -0.28], build: (g) => {
    const m = M(0x30353f, { m: 0.3, r: 0.45 }), ma = M(C.alu, { m: 0.7, r: 0.3 });
    g.add(cyl(0.065, 0.07, m, 'y', 0, 1.005, 0), cyl(0.068, 0.006, ma, 'y', 0, 1.043, 0), box(0.09, 0.26, 0.07, m, 0, 1.13, -0.025),
      cyl(0.045, 0.03, m, 'z', 0, YA, 0.025), box(0.13, 0.05, 0.02, ma, 0, YA, 0.05), cyl(0.011, 0.02, M(C.black), 'z', 0.075, YA, 0.05));
  } },
  rxA_dovetail: { ex: [0, 0, 0.12], build: (g) => {
    const mb = M(C.black, { m: 0.4 });
    g.add(box(0.22, 0.044, 0.012, M(C.alu, { m: 0.7, r: 0.3 }), 0, YA, 0.066));
    for (const x of [-0.08, 0.08]) g.add(torusX(0.086, 0.006, mb, x, YA, ZA), box(0.025, 0.03, 0.03, mb, x, YA, 0.087));
  } },
  rxA_tube: { ex: [0, 0, 0.3], cutZ: ZA, build: (g) => {
    g.add(cyl(0.08, 0.615, M(C.white, { ds: true, r: 0.4 }), 'x', 0, YA, ZA, true, 64), torusX(0.08, 0.004, M(C.black), -0.3075, YA, ZA));
  } },
  rxA_primary: { ex: [0.42, 0, 0.3], build: (g) => {
    g.add(cyl(0.065, 0.018, M(C.mirror, { m: 1, r: 0.08 }), 'x', 0.27, YA, ZA), cyl(0.081, 0.025, M(C.black), 'x', 0.293, YA, ZA));
    for (const a of [0, 2.094, 4.189]) g.add(cyl(0.005, 0.02, M(C.alu, { m: 0.7 }), 'x', 0.31, YA + Math.cos(a) * 0.05, ZA + Math.sin(a) * 0.05));
  } },
  rxA_secondary: { ex: [-0.42, 0, 0.3], build: (g) => {
    const gm = new THREE.CylinderGeometry(0.01725, 0.01725, 0.005, 40); gm.scale(Math.SQRT2, 1, 1); gm.rotateZ(-Math.PI / 4);
    const mm = new THREE.Mesh(gm, M(C.mirror, { m: 1, r: 0.08 })); mm.position.set(FXA, YA, ZA); g.add(mm);
    const mb = M(C.black);
    g.add(cyl(0.011, 0.04, mb, 'x', FXA - 0.032, YA, ZA), box(0.012, 0.158, 0.0012, mb, FXA - 0.045, YA, ZA), box(0.012, 0.0012, 0.158, mb, FXA - 0.045, YA, ZA));
  } },
  rxA_focuser: { ex: [0, 0.1, 0.3], cutZ: ZA, build: (g) => {
    const mb = M(C.black, { m: 0.3 });
    g.add(box(0.075, 0.025, 0.065, mb, FXA, 1.3025, ZA), cyl(0.0159, 0.06, M(C.alu, { m: 0.7, r: 0.3, ds: true }), 'y', FXA, 1.33, ZA, true));
    for (const s of [-1, 1]) g.add(cyl(0.012, 0.016, mb, 'z', FXA + 0.02, 1.302, ZA + s * 0.045));
  } },
  rxA_guide: { ex: [0, 0.3, 0.3], build: (g) => {
    const mb = M(C.black, { m: 0.2, r: 0.4 });
    g.add(cyl(0.02725, 0.2, M(0xd8dbe1), 'x', 0.06, 1.3525, ZA), cyl(0.03, 0.045, mb, 'x', -0.055, 1.3525, ZA), cyl(0.024, 0.02, mb, 'x', 0.17, 1.3525, ZA),
      cyl(0.024, 0.002, M(C.glass, { t: true, op: 0.5, m: 0.2 }), 'x', -0.078, 1.3525, ZA));
    for (const x of [-0.02, 0.12]) g.add(box(0.02, 0.035, 0.02, mb, x, 1.3075, ZA));
  } },
  rxA_cam: { ex: [0.16, 0.3, 0.3], build: (g) => { g.add(cyl(0.031, 0.028, M(C.red, { m: 0.5, r: 0.35 }), 'x', 0.198, 1.3525, ZA), cyl(0.012, 0.012, M(C.black), 'x', 0.218, 1.3525, ZA)); } },

  rxB_tripod: { ex: [0, 0, 0], build: (g) => {
    const m = M(C.black, { m: 0.3, r: 0.4 });
    g.add(cyl(0.05, 0.02, m, 'y', 0, 1.14, 0), cyl(0.02, 0.25, M(C.alu, { m: 0.6, r: 0.35 }), 'y', 0, 1.0, 0));
    for (const d of [90, 210, 330]) { const a = (d * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); g.add(rod([0.045 * c, 1.12, 0.045 * s], [0.5 * c, 0.01, 0.5 * s], 0.015, m), sph(0.017, M(0x16191f), 0.5 * c, 0.012, 0.5 * s)); }
  } },
  rxB_pan: { ex: [0, -0.05, 0.22], build: (g) => {
    const mt = M(C.team, { r: 0.6 }), mb = M(C.black, { m: 0.4 }), ma = M(C.alu, { m: 0.7, r: 0.3 });
    g.add(box(0.2, 0.012, 0.2, mt, 0, 1.156, 0), cyl(0.06, 0.012, ma, 'y', 0, 1.168, 0), cyl(0.064, 0.01, mt, 'y', 0, 1.18, 0),
      box(0.042, 0.04, 0.042, mb, 0, 1.13, 0.075), box(0.0423, 0.006, 0.0423, ma, 0, 1.153, 0.075), cyl(0.0025, 0.02, ma, 'y', 0, 1.16, 0.075), cyl(0.006, 0.01, ma, 'y', 0, 1.168, 0.075),
      belt([0, 0], 0.0605, [0, 0.075], 0.0065, (p) => [p[0], 1.168, p[1]]));
  } },
  rxB_drivers: { ex: [0.12, -0.04, 0.24], build: (g) => {
    g.add(box(0.06, 0.0016, 0.04, M(C.pcb), -0.06, 1.163, -0.06));
    for (const x of [-0.072, -0.048]) g.add(box(0.0152, 0.0016, 0.0203, M(0x3a2a7a), x, 1.166, -0.06), box(0.012, 0.008, 0.012, M(C.alu, { m: 0.8 }), x, 1.172, -0.06));
  } },
  rxB_fork: { ex: [0, 0.08, 0], build: (g) => {
    const mt = M(C.team, { r: 0.6 });
    g.add(box(0.08, 0.01, 0.272, mt, 0, 1.19, 0), box(0.08, 0.19, 0.006, mt, 0, 1.28, 0.133), box(0.08, 0.19, 0.006, mt, 0, 1.28, -0.133), cyl(0.004, 0.29, M(C.alu, { m: 0.7 }), 'z', 0, YB, 0));
  } },
  rxB_tilt: { ex: [0, 0.08, 0.18], build: (g) => {
    const ma = M(C.alu, { m: 0.7 });
    g.add(box(0.042, 0.042, 0.04, M(C.black, { m: 0.4 }), 0, 1.255, 0.158), box(0.042, 0.042, 0.004, ma, 0, 1.255, 0.1385), cyl(0.0025, 0.012, ma, 'z', 0, 1.255, 0.13), cyl(0.03, 0.006, ma, 'z', 0, YB, 0.142),
      belt([0, YB], 0.031, [0, 1.255], 0.0065, (p) => [p[0], p[1], 0.142]));
  } },
  rxB_box: { ex: [0, 0.26, 0], cutZ: 0, build: (g) => {
    const m = M(0x2a3040, { ds: true, r: 0.8 }), L = 0.185, cx = LXB + L / 2;
    g.add(box(L, 0.005, 0.23, m, cx, YB + 0.115, 0), box(L, 0.005, 0.23, m, cx, YB - 0.115, 0), box(L, 0.23, 0.005, m, cx, YB, 0.115), box(L, 0.23, 0.005, m, cx, YB, -0.115), box(0.005, 0.23, 0.23, m, LXB + L, YB, 0));
  } },
  rxB_lens: { ex: [-0.35, 0.26, 0], build: (g) => {
    const tex = canvasTexture((x) => { x.fillStyle = 'rgba(170,200,255,0.10)'; x.fillRect(0, 0, 512, 512); x.strokeStyle = 'rgba(200,220,255,0.45)'; x.lineWidth = 1.2; for (let r = 6; r < 240; r += 6) { x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.stroke(); } }, 512, 512);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), M(0xffffff, { map: tex, t: true, op: 0.9, ds: true, r: 0.2, dw: false })); p.rotation.y = Math.PI / 2; p.position.set(LXB, YB, 0); g.add(p);
    const mf = M(C.black);
    g.add(box(0.008, 0.012, 0.232, mf, LXB, YB + 0.116, 0), box(0.008, 0.012, 0.232, mf, LXB, YB - 0.116, 0), box(0.008, 0.232, 0.012, mf, LXB, YB, 0.116), box(0.008, 0.232, 0.012, mf, LXB, YB, -0.116));
  } },
  rxB_cam: { ex: [-0.1, 0.42, 0], build: (g) => { g.add(box(0.03, 0.02, 0.04, M(C.team, { r: 0.6 }), -0.08, YB + 0.127, 0), box(0.004, 0.038, 0.038, M(C.pcb), -0.09, YB + 0.157, 0), cyl(0.007, 0.02, M(C.black), 'x', -0.102, YB + 0.157, 0)); } },

  rx_table: { ex: [0.1, 0, 0.15], build: (g) => {
    g.add(box(0.6, 0.02, 0.4, M(0x3a3f4a, { r: 0.7 }), 0.95, 0.7, 0.6));
    for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(rod([0.95 + s[0] * 0.27, 0.69, 0.6 + s[1] * 0.17], [0.95 + s[0] * 0.27, 0, 0.6 + s[1] * 0.17], 0.01, M(C.alu, { m: 0.6 })));
  } },
  rx_laptop: { ex: [0.18, 0.12, 0.25], build: (g) => {
    const mb = M(0x2c313b, { m: 0.4, r: 0.4 });
    g.add(box(0.32, 0.018, 0.22, mb, 1.03, 0.719, 0.6));
    const tex = canvasTexture((x) => {
      x.fillStyle = '#0e1424'; x.fillRect(0, 0, 640, 420); x.fillStyle = '#182033'; x.fillRect(0, 0, 640, 34);
      x.font = '600 17px monospace'; x.fillStyle = '#FF5C63'; x.fillText('BOREALIS GROUND · MOCK-UP', 14, 23);
      const cols = ['#2b3a5a', '#3a4e72', '#55709b', '#7a93b8', '#9fb3cf', '#c8d3e2'];
      for (let j = 0; j < 10; j++) for (let i = 0; i < 13; i++) { x.fillStyle = j > 6 || (j === 6 && i > 4) ? '#2a2f3a' : cols[(i + j * 2 + ((i * j) % 3)) % 6]; x.fillRect(16 + i * 28, 50 + j * 28, 27, 27); }
      x.font = '15px monospace'; x.fillStyle = '#93A0BC';
      ['STATE   TRACK', 'GOODPUT --.- kbps', 'PRE-FEC BER  --', 'POST-FEC     --', 'PKT LOSS     --', 'TRACK ERR -- mrad', 'REACQ     -- s'].forEach((l, k) => x.fillText(l, 400, 70 + k * 30));
    }, 640, 420);
    const sg = new THREE.Group(); sg.position.set(1.03, 0.728, 0.49); sg.rotation.x = -0.28;
    sg.add(box(0.32, 0.21, 0.006, mb, 0, 0.105, 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), new THREE.MeshBasicMaterial({ map: tex })); face.position.set(0, 0.105, 0.0035); sg.add(face);
    g.add(sg);
  } },
  rx_case: { ex: [0.05, 0.12, 0.25], cutZ: 0.62, build: (g) => { g.add(box(0.17, 0.04, 0.1, M(0x353b47, { ds: true, r: 0.6 }), 0.76, 0.73, 0.62)); } },
  rx_nucleo: { ex: [0.05, 0.24, 0.25], build: (g) => {
    g.add(box(0.133, 0.0016, 0.07, M(C.nuc, { r: 0.6 }), 0.76, 0.718, 0.62), box(0.02, 0.003, 0.02, M(C.chip), 0.77, 0.7204, 0.62), box(0.03, 0.003, 0.022, M(C.chip), 0.71, 0.7204, 0.62),
      box(0.11, 0.008, 0.005, M(C.black), 0.765, 0.723, 0.592), box(0.11, 0.008, 0.005, M(C.black), 0.765, 0.723, 0.648), box(0.012, 0.006, 0.01, M(C.alu, { m: 0.8 }), 0.698, 0.722, 0.6));
  } },
  rx_power: { ex: [0.15, 0, -0.2], build: (g) => { g.add(box(0.25, 0.17, 0.16, M(0x30343c, { r: 0.6 }), 0.6, 0.085, -0.45), box(0.2, 0.03, 0.003, M(0xf5b642, { em: 0x6a4a10, ei: 0.4 }), 0.6, 0.13, -0.369)); } },

  tx_tripod: { ex: [0, 0, 0], build: (g) => {
    const m = M(C.black, { m: 0.3, r: 0.4 });
    g.add(cyl(0.05, 0.02, m, 'y', TX0, 1.17, 0), cyl(0.02, 0.27, M(C.alu, { m: 0.6 }), 'y', TX0, 1.03, 0), box(0.12, 0.01, 0.08, M(0x30353f), TX0, 0.85, 0.06));
    for (const d of [30, 150, 270]) { const a = (d * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); g.add(rod([TX0 + 0.045 * c, 1.15, 0.045 * s], [TX0 + 0.5 * c, 0.01, 0.5 * s], 0.015, m), sph(0.017, M(0x16191f), TX0 + 0.5 * c, 0.012, 0.5 * s)); }
  } },
  tx_cart: { ex: [0, -0.05, 0], build: (g) => {
    const ma = M(C.alu, { m: 0.6, r: 0.35 }), mb = M(C.black);
    g.add(box(0.9, 0.03, 0.6, M(0x3a3f4a, { r: 0.6 }), TX0, 0.215, 0));
    for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.1, 0.04, mb, 'z', TX0 + s[0] * 0.33, 0.1, s[1] * 0.26), box(0.04, 0.06, 0.03, ma, TX0 + s[0] * 0.33, 0.17, s[1] * 0.26));
    g.add(box(0.04, 0.935, 0.04, ma, TX0, 0.7025, 0), cyl(0.05, 0.02, mb, 'y', TX0, 1.17, 0),
      rod([TX0 - 0.25, 0.23, 0.2], [TX0, 0.75, 0.02], 0.008, ma), rod([TX0 - 0.25, 0.23, -0.2], [TX0, 0.75, -0.02], 0.008, ma),
      rod([TX0 - 0.44, 0.23, 0.25], [TX0 - 0.5, 0.95, 0.25], 0.012, ma), rod([TX0 - 0.44, 0.23, -0.25], [TX0 - 0.5, 0.95, -0.25], 0.012, ma), rod([TX0 - 0.5, 0.95, 0.25], [TX0 - 0.5, 0.95, -0.25], 0.014, mb));
  } },
  tx_head: { ex: [0, 0.06, 0], build: (g) => { const m = M(0x30353f, { m: 0.4, r: 0.4 }); g.add(cyl(0.028, 0.03, m, 'y', TX0, 1.195, 0), sph(0.022, M(C.alu, { m: 0.8, r: 0.25 }), TX0, 1.225, 0), box(0.06, 0.012, 0.06, m, TX0, 1.25, 0), cyl(0.006, 0.03, m, 'z', TX0 + 0.035, 1.215, 0.03)); } },
  tx_plate: { ex: [0, 0.12, 0], build: (g) => { g.add(box(0.26, 0.008, 0.12, M(C.team, { r: 0.6 }), TX0 - 0.02, 1.26, 0)); } },
  tx_vblock: { ex: [0, 0.18, 0], build: (g) => { g.add(box(0.04, 0.016, 0.024, M(C.team, { r: 0.6 }), TX0 + 0.01, 1.272, 0), box(0.006, 0.008, 0.024, M(C.alu, { m: 0.7 }), TX0 + 0.01, 1.296, 0)); } },
  tx_laser: { ex: [0, 0.25, 0], build: (g) => {
    g.add(cyl(0.00635, 0.0508, M(0x2b2f37, { m: 0.6, r: 0.3 }), 'x', TX0 + 0.01, TY, 0), cyl(0.0045, 0.002, M(0xff5c63, { em: 0xff2030, ei: 0.9 }), 'x', TX0 + 0.0364, TY, 0),
      cable([[TX0 - 0.015, TY, 0], [TX0 - 0.05, TY - 0.01, 0.02], [TX0 - 0.09, 1.275, 0.04]]));
  } },
  tx_nd: { ex: [0.14, 0.25, 0], build: (g) => { const mt = M(C.team, { r: 0.6 }); g.add(box(0.006, 0.04, 0.04, mt, TX0 + 0.06, TY, 0), cyl(0.0125, 0.003, M(0x3a3d44, { t: true, op: 0.75, m: 0.3, r: 0.1 }), 'x', TX0 + 0.0635, TY, 0), box(0.006, 0.024, 0.02, mt, TX0 + 0.06, 1.272, 0)); } },
  tx_diff: { ex: [0.2, 0.25, 0], build: (g) => { const mt = M(C.team, { r: 0.6 }); g.add(box(0.006, 0.04, 0.04, mt, TX0 + 0.075, TY, 0), cyl(0.0127, 0.002, M(0xf2f4f8, { t: true, op: 0.7, r: 0.9 }), 'x', TX0 + 0.0785, TY, 0), box(0.006, 0.024, 0.02, mt, TX0 + 0.075, 1.272, 0)); } },
  tx_shutter: { ex: [0.26, 0.25, 0], build: (g) => {
    g.add(box(0.006, 0.034, 0.03, M(C.team, { r: 0.6 }), TX0 + 0.095, 1.281, -0.03));
    const hg = new THREE.Group(); hg.position.set(TX0 + 0.1, TY + 0.02, 0); hg.rotation.z = -1.2; hg.add(box(0.002, 0.034, 0.034, M(C.black), 0, 0.017, 0)); g.add(hg);
  } },
  tx_sight: { ex: [0, 0.22, -0.15], build: (g) => { const mb = M(C.black, { m: 0.3 }); g.add(cyl(0.006, 0.09, mb, 'x', TX0 - 0.02, TY, -0.035), box(0.006, 0.022, 0.006, mb, TX0 - 0.05, 1.275, -0.035), box(0.006, 0.022, 0.006, mb, TX0 + 0.01, 1.275, -0.035)); } },
  tx_led: { ex: [0, 0.22, 0.14], build: (g) => { g.add(box(0.006, 0.014, 0.006, M(C.black), TX0 + 0.03, 1.271, 0.035), sph(0.0028, M(0xf5b642, { em: 0xf5b642, ei: 0.8 }), TX0 + 0.03, 1.281, 0.035)); } },
  tx_key: { ex: [-0.16, 0.2, 0], build: (g) => { g.add(box(0.045, 0.035, 0.045, M(0x30353f), TX0 - 0.115, 1.2815, 0.025), cyl(0.007, 0.008, M(C.alu, { m: 0.8 }), 'y', TX0 - 0.115, 1.302, 0.025), box(0.003, 0.012, 0.008, M(C.gold, { m: 0.9 }), TX0 - 0.115, 1.311, 0.025)); } },

  bench_sensor: { ex: [0.1, 0.1, 0], build: (g) => { g.add(cyl(0.01525, 0.0127, M(C.black, { m: 0.3 }), 'x', TX0 + 0.16, TY, 0), cyl(0.00475, 0.001, M(0x3b5a9a, { m: 0.4 }), 'x', TX0 + 0.1534, TY, 0), rod([TX0 + 0.16, TY - 0.015, 0], [TX0 + 0.16, 1.264, 0], 0.004, M(C.alu, { m: 0.7 }))); } },
  bench_console: { ex: [0.1, 0, 0.1], build: (g) => { g.add(box(0.0635, 0.0325, 0.095, M(0x2c313b), TX0 + 0.42, 0.0163, 0.32), box(0.045, 0.002, 0.03, M(0x9dbbff, { em: 0x2856c9, ei: 0.5 }), TX0 + 0.42, 0.0335, 0.33), cable([[TX0 + 0.168, TY, 0.01], [TX0 + 0.3, 1.0, 0.15], [TX0 + 0.42, 0.2, 0.3], [TX0 + 0.42, 0.03, 0.27]])); } },
};

// Detector stack: drawn once per receiver (telescope: along +y into the focuser; Fresnel: along +x at the back of the box).
function detBuilders(rx: 'A' | 'B'): Record<string, Def> {
  const A = rx === 'A';
  const ex = (k: number): [number, number, number] => (A ? [0, 0.16 + k * 0.03, 0.3] : [0.12 + k * 0.03, 0.26, 0]);
  const X = A ? FXA : 0, Z = A ? ZA : 0, F = A ? FYA : FXB;
  // place along the optical axis: s = distance past the focus
  const at = (s: number): [number, number, number] => (A ? [X, F + s, Z] : [F + s, YB, Z]);
  const ax: 'x' | 'y' = A ? 'y' : 'x';
  const bx = (along: number, w: number, d: number, m: THREE.Material, s: number, dw = 0, dd = 0) => {
    const [x, y, z] = at(s); return A ? box(w, along, d, m, x + dw, y, z + dd) : box(along, w, d, m, x, y + dw, z + dd);
  };
  return {
    det_filter: { ex: ex(0), build: (g) => { g.add(cyl(0.0125, 0.005, M(C.black, { m: 0.3 }), ax, ...at(-0.013), true), cyl(0.0105, 0.0035, M(0xd23a4c, { t: true, op: 0.6, m: 0.3, r: 0.15 }), ax, ...at(-0.013))); } },
    det_stop: { ex: ex(1), build: (g) => { const rg = new THREE.RingGeometry(0.0016, 0.0125, 40); if (A) rg.rotateX(-Math.PI / 2); else rg.rotateY(Math.PI / 2); const q = new THREE.Mesh(rg, M(C.chip, { ds: true })); q.position.set(...at(-0.0004)); g.add(q); } },
    det_pd: { ex: ex(2), build: (g) => {
      g.add(bx(0.0032, 0.0054, 0.0043, M(0x1d2026, { r: 0.25 }), 0.0017), bx(0.0003, 0.00265, 0.00265, M(0x3b5a9a, { m: 0.4, r: 0.2 }), 0.00005));
      for (const d of [-0.0012, 0.0012]) { const a = at(0.0033), b = at(0.012); g.add(rod(A ? [a[0] + d, a[1], a[2]] : [a[0], a[1] + d, a[2]], A ? [b[0] + d, b[1], b[2]] : [b[0], b[1] + d, b[2]], 0.00025, M(C.alu, { m: 0.8 }))); }
    } },
    det_carrier: { ex: ex(3), build: (g) => { g.add(cyl(0.014, 0.0016, M(C.pcb), ax, ...at(0.013))); } },
    det_housing: { ex: ex(5), cutZ: Z, build: (g) => { const mt = M(C.team, { ds: true, r: 0.6 });
      if (A) g.add(cyl(0.0155, 0.042, mt, 'y', X, 1.339, Z, true), cyl(0.022, 0.018, mt, 'y', X, 1.369, Z, true), cyl(0.022, 0.003, mt, 'y', X, 1.3775, Z));
      else g.add(cyl(0.02, 0.05, mt, 'x', F + 0.008, YB, Z, true), cyl(0.02, 0.003, mt, 'x', F + 0.034, YB, Z));
    } },
    det_board: { ex: ex(7), build: (g) => {
      const s = A ? 0.05 : 0.0476;
      g.add(bx(0.0016, 0.06, 0.045, M(C.pcb), s), bx(0.008, 0.012, 0.006, M(C.black), s + 0.005, 0.024, -0.012));
      for (let i = 0; i < 6; i++) g.add(bx(0.001, 0.002, 0.001, M(0xb48a52), s + 0.0013, -0.02 + i * 0.006, -0.014));
      if (A) for (const q of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.0015, 0.012, M(C.alu, { m: 0.7 }), 'y', X + q[0] * 0.025, 1.383, Z + q[1] * 0.018));
    } },
    det_tia: { ex: ex(8), build: (g) => { g.add(bx(0.0012, 0.003, 0.003, M(C.chip), (A ? 0.05 : 0.0476) + 0.0014, -0.008, 0)); } },
    det_comp: { ex: ex(8.5), build: (g) => { g.add(bx(0.0012, 0.003, 0.003, M(C.chip), (A ? 0.05 : 0.0476) + 0.0014, 0.012, 0.006)); } },
  };
}

/** ids the scene can draw (tests compare this with data/model3d.yaml) */
export const GEOMETRY_IDS = [...Object.keys(DEFS), ...Object.keys(detBuilders('A')), 'tx_case', 'tx_nucleo', 'tx_batt', 'beam'];

// ---------------- the viewer ----------------
export interface ObjectInfo { id: string; name: string; config: string[]; shell: boolean; lane: string | null }
export interface ViewState { rx: 'A' | 'B'; tx: 'C1' | 'C2' | 'C3'; explode: number; xray: boolean; cut: boolean; bench: boolean; beam: boolean; status: boolean }
export interface Viewer { set(s: Partial<ViewState>): void; select(id: string | null, focus?: boolean): void; view(name: string): void; dispose(): void }
interface Placed { id: string; key: string; g: THREE.Group; ex: THREE.Vector3; cfg: string[]; shell: boolean; plane: THREE.Plane | null; lane: string | null }

const LANE_COLOR: Record<string, number> = { available: 0x4fd1a5, candidate: 0x9dbbff, choosing: 0x8e9cb8, blocked: 0xff7c86, flight: 0x8e9cb8, alt: 0xb597f5 };

export function mountScene(opts: {
  container: HTMLElement; objects: ObjectInfo[]; beam: { narrow: number; wide: number };
  onSelect: (id: string | null) => void; onHover: (id: string | null, name: string, x: number, y: number) => void;
}): Viewer {
  const { container } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a1120); scene.fog = new THREE.Fog(0x0a1120, 8, 20);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.09; controls.minDistance = 0.08; controls.maxDistance = 14; controls.maxPolarAngle = Math.PI * 0.495;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1b1f28, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(3, 6, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9db4ff, 0.9); fill.position.set(-5, 3, -3); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M(0x111827, { r: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const grid = new THREE.GridHelper(40, 80, 0x2a3550, 0x1a2234); grid.position.y = 0.001; scene.add(grid);

  const info = new Map(opts.objects.map((o) => [o.id, o]));
  const placed: Placed[] = [];
  const add = (id: string, key: string, def: Def) => {
    const o = info.get(id); if (!o) return;              // not in model3d.yaml: no facts, so not drawn
    const g = new THREE.Group(); def.build(g);
    g.traverse((m) => { if ((m as THREE.Mesh).isMesh) { const mesh = m as THREE.Mesh; const mat = (mesh.material as THREE.MeshStandardMaterial).clone(); mesh.material = mat;
      mesh.userData = { key, base: { op: mat.opacity, tr: mat.transparent, dw: mat.depthWrite, side: mat.side, color: mat.color?.getHex(), em: mat.emissive?.getHex(), ei: mat.emissiveIntensity } }; } });
    scene.add(g);
    placed.push({ id, key, g, ex: V(def.ex), cfg: o.config, shell: o.shell, plane: o.shell ? new THREE.Plane(new THREE.Vector3(0, 0, -1), def.cutZ ?? 0) : null, lane: o.lane });
  };
  for (const [id, def] of Object.entries(DEFS)) add(id, id, def);
  for (const rx of ['A', 'B'] as const) for (const [id, def] of Object.entries(detBuilders(rx))) {
    const o = info.get(id); if (!o) continue;
    info.set(`${id}@${rx}`, { ...o, config: [rx === 'A' ? 'rxA' : 'rxB'] }); add(`${id}@${rx}`, `${id}@${rx}`, def);
    placed[placed.length - 1].id = id;
  }

  // light paths inside the receivers, cables, labels
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff5c63, transparent: true, opacity: 0.85 });
  const line = (pts: number[][]) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(V)), lineMat);
  const raysA = new THREE.Group(), raysB = new THREE.Group();
  for (const o of [0.05, 0.025, -0.025, -0.05]) { const o2 = o * 0.2; raysA.add(line([[-0.42, YA + o, ZA], [0.261, YA + o, ZA], [FXA - o2, YA + o2, ZA], [FXA, FYA, ZA]])); }
  for (const o of [0.09, 0.045, -0.045, -0.09]) raysB.add(line([[-0.4, YB + o, 0], [LXB, YB + o, 0], [FXB, YB, 0]]));
  const cablesA = new THREE.Group(), cablesB = new THREE.Group(), cablesRx = new THREE.Group();
  cablesA.add(cable([[FXA + 0.03, 1.39, ZA], [FXA + 0.1, 1.25, 0.34], [0.2, 0.95, 0.5], [0.6, 0.76, 0.62], [0.68, 0.735, 0.62]]), cable([[0.235, 1.3525, ZA], [0.45, 1.1, 0.4], [0.8, 0.8, 0.5], [0.87, 0.725, 0.55]]));
  cablesB.add(cable([[0.1, YB - 0.02, 0], [0.2, 1.1, 0.25], [0.5, 0.85, 0.55], [0.68, 0.735, 0.62]]), cable([[-0.09, YB + 0.157, 0.02], [0.05, 1.3, 0.25], [0.4, 1.0, 0.45], [0.87, 0.725, 0.55]]), cable([[-0.06, 1.164, -0.08], [0.2, 0.9, 0.1], [0.6, 0.76, 0.55], [0.69, 0.735, 0.6]]));
  cablesRx.add(cable([[0.6, 0.17, -0.4], [0.9, 0.4, 0.2], [1.15, 0.72, 0.5]]));
  const txCableT = cable([[TX0 + 0.085, 0.875, 0.06], [TX0 + 0.05, 1.0, 0.05], [TX0 - 0.06, 1.2, 0.04], [TX0 - 0.09, 1.268, 0.035]]);
  const txCableC = cable([[TX0 + 0.135, 0.25, 0.14], [TX0 + 0.05, 0.5, 0.06], [TX0 + 0.02, 1.0, 0.02], [TX0 - 0.06, 1.2, 0.04], [TX0 - 0.09, 1.268, 0.035]]);
  scene.add(raysA, raysB, cablesA, cablesB, cablesRx, txCableT, txCableC);
  const lblTX = label('TRANSMITTER', 0.11, '#E6EAF2'); lblTX.position.set(TX0, 1.75, 0);
  const lblRX = label('RECEIVER', 0.11, '#E6EAF2'); lblRX.position.set(0, 1.75, 0.1);
  const lblD = label('distance compressed · really 150–300 m', 0.13, '#A9B5CC'); lblD.position.set(-2.1, 0.14, 0.8);
  scene.add(lblTX, lblRX, lblD);
  for (const dx of [-0.04, 0.04]) scene.add(rod([-2.1 + dx - 0.05, 0.004, 0.45], [-2.1 + dx + 0.05, 0.004, -0.45], 0.004, M(0xa9b5cc)));
  let lblMode: THREE.Sprite | null = null;

  // TX electronics sit on the tripod (C1) or on the cart deck (C2/C3): two copies, one visible
  const txElec = (cfg: string[], p: number[], suffix: string) => {
    const defs: Record<string, Def> = {
      tx_case: { ex: [0, 0, 0.22], cutZ: p[2], build: (g) => { g.add(box(0.17, 0.04, 0.1, M(0x353b47, { ds: true, r: 0.6 }), p[0], p[1], p[2])); } },
      tx_nucleo: { ex: [0, 0.12, 0.22], build: (g) => { g.add(box(0.133, 0.0016, 0.07, M(C.nuc, { r: 0.6 }), p[0], p[1] - 0.012, p[2]), box(0.02, 0.003, 0.02, M(C.chip), p[0] + 0.01, p[1] - 0.0096, p[2]), box(0.11, 0.008, 0.005, M(C.black), p[0] + 0.005, p[1] - 0.007, p[2] - 0.028), box(0.11, 0.008, 0.005, M(C.black), p[0] + 0.005, p[1] - 0.007, p[2] + 0.028)); } },
      tx_batt: { ex: [0, 0, -0.22], build: (g) => { g.add(box(0.15, 0.025, 0.07, M(0x2e3340, { r: 0.5 }), p[0], p[1] - 0.0075, p[2] - 0.1)); } },
    };
    for (const [id, def] of Object.entries(defs)) { const o = info.get(id); if (!o) continue; info.set(`${id}${suffix}`, { ...o, config: cfg }); add(`${id}${suffix}`, `${id}${suffix}`, def); placed[placed.length - 1].id = id; }
  };
  txElec(['C1'], [TX0, 0.875, 0.06], '_t');
  txElec(['C2', 'C3'], [TX0 + 0.22, 0.25, 0.14], '_c');

  const beamGroup = new THREE.Group(); scene.add(beamGroup);
  let beamMesh: THREE.Mesh | null = null;

  const st: ViewState = { rx: 'A', tx: 'C1', explode: 0, xray: false, cut: false, bench: false, beam: true, status: false };
  let sel: string | null = null;
  const active = (cfg: string[]) => cfg.some((t) => t === 'rx' || t === 'tx' || (t === 'rxA' && st.rx === 'A') || (t === 'rxB' && st.rx === 'B') || (t === 'bench' && st.bench) || t === st.tx);

  function buildBeam() {
    beamGroup.clear();
    if (!info.has('beam')) return;
    const A = new THREE.Vector3(TX0 + 0.0364 + (st.tx === 'C2' ? 0.045 : 0), TY, 0);
    const B = st.rx === 'A' ? new THREE.Vector3(-0.3075, YA, ZA) : new THREE.Vector3(LXB, YB, 0);
    const dir = B.clone().sub(A); const L = dir.length(); dir.normalize();
    const theta = (st.tx === 'C2' ? opts.beam.wide : opts.beam.narrow) / 1000;
    const g = new THREE.ConeGeometry(L * Math.tan(theta / 2), L, 64, 1, true); g.translate(0, -L / 2, 0);
    beamMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff3b46, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beamMesh.position.copy(A); beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); beamMesh.userData = { key: 'beam' };
    beamGroup.add(beamMesh, new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), new THREE.LineBasicMaterial({ color: 0xff5c63, transparent: true, opacity: 0.55 })));
  }
  function modeLabel() {
    if (lblMode) scene.remove(lblMode);
    const t = st.tx === 'C1' ? `C1 · stationary · ${opts.beam.narrow} mrad` : st.tx === 'C2' ? `C2 · moving cart · ${opts.beam.wide} mrad + diffuser` : `C3 · indoor 50–80 m · ${opts.beam.narrow} mrad + ND`;
    lblMode = label(t, 0.075, '#F5B642'); lblMode.position.set(TX0, 1.6, 0); scene.add(lblMode);
  }
  function apply() {
    for (const p of placed) {
      p.g.visible = active(p.cfg);
      p.g.position.copy(p.ex).multiplyScalar(st.explode);
      p.g.traverse((m) => {
        const mesh = m as THREE.Mesh; if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial; const b = mesh.userData.base;
        if (p.shell && st.xray) { mat.transparent = true; mat.opacity = 0.16; mat.depthWrite = false; } else { mat.transparent = b.tr; mat.opacity = b.op; mat.depthWrite = b.dw; }
        if (p.plane) { mat.clippingPlanes = st.cut ? [p.plane] : null; mat.side = st.cut || st.xray ? THREE.DoubleSide : b.side; }
        if (mat.type === 'MeshStandardMaterial' && b.color !== undefined) mat.color.setHex(st.status ? LANE_COLOR[p.lane ?? ''] ?? 0x4a5266 : b.color);
        if (mat.emissive) { mat.emissive.setHex(sel === p.id ? 0x5a1418 : b.em); mat.emissiveIntensity = sel === p.id ? 1 : b.ei; }
        mat.needsUpdate = true;
      });
    }
    const showRays = st.explode < 0.04 && (st.xray || st.cut);
    raysA.visible = st.rx === 'A' && showRays; raysB.visible = st.rx === 'B' && showRays;
    const tidy = st.explode < 0.04;
    cablesA.visible = st.rx === 'A' && tidy; cablesB.visible = st.rx === 'B' && tidy; cablesRx.visible = tidy;
    txCableT.visible = st.tx === 'C1' && tidy; txCableC.visible = st.tx !== 'C1' && tidy;
    buildBeam(); beamGroup.visible = st.beam; modeLabel();
  }

  // camera
  let tw: { t0: number; a: { t: THREE.Vector3; p: THREE.Vector3 }; b: { t: THREE.Vector3; p: THREE.Vector3 } } | null = null;
  const tween = (t: THREE.Vector3, p: THREE.Vector3) => { tw = { t0: performance.now(), a: { t: controls.target.clone(), p: camera.position.clone() }, b: { t, p } }; };
  function view(name: string) {
    const views: Record<string, number[][]> = {
      all: [[-2.1, 0.9, 0], [-0.6, 2.7, 5.6]],
      rx: st.rx === 'A' ? [[0.05, 1.0, 0.15], [1.35, 1.65, 1.75]] : [[0.05, 1.05, 0], [1.25, 1.6, 1.45]],
      det: st.rx === 'A' ? [[FXA, 1.355, ZA], [FXA + 0.17, 1.47, ZA + 0.33]] : [[FXB + 0.01, YB, 0], [FXB + 0.24, YB + 0.13, 0.27]],
      tx: [[TX0, 1.0, 0], [TX0 - 1.05, 1.75, 1.55]],
      txc: [[TX0 + 0.03, TY, 0], [TX0 + 0.27, 1.42, 0.33]],
    };
    const v = views[name] ?? views.all; let t = V(v[0]), p = V(v[1]);
    if (name === 'det' && st.explode > 0.02) {
      const bb = new THREE.Box3(); for (const q of placed) if (q.g.visible && q.id.startsWith('det_')) bb.expandByObject(q.g);
      const c = bb.getCenter(new THREE.Vector3()); p.add(c.clone().sub(t)); t = c; p = t.clone().add(p.clone().sub(t).multiplyScalar(1 + st.explode * 1.6));
    }
    const k = Math.min(2.6, Math.max(1, 1.3 / camera.aspect)); p = t.clone().add(p.sub(t).multiplyScalar(k));
    tween(t, p);
  }
  function focusOn(id: string) {
    const bb = new THREE.Box3(); for (const q of placed) if (q.g.visible && q.id === id) bb.expandByObject(q.g);
    if (bb.isEmpty()) return;
    const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3()).length();
    const dir = camera.position.clone().sub(controls.target).normalize();
    tween(c, c.clone().add(dir.multiplyScalar(Math.max(s * 2.2, 0.12))));
  }

  // picking
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function pick(ev: PointerEvent): string | null {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const objs: THREE.Object3D[] = []; for (const p of placed) if (p.g.visible) p.g.traverse((m) => { if ((m as THREE.Mesh).isMesh) objs.push(m); });
    if (st.beam && beamMesh) objs.push(beamMesh);
    const byKey = new Map(placed.map((p) => [p.key, p]));
    for (const h of ray.intersectObjects(objs, false)) {
      if (h.object.userData.key === 'beam') return 'beam';
      const p = byKey.get(h.object.userData.key); if (!p) continue;
      if (p.shell && (st.xray || (st.cut && p.plane && p.plane.distanceToPoint(h.point) < 0))) continue;
      return p.id;
    }
    return null;
  }
  let down: { x: number; y: number } | null = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', (e) => { if (!down) return; const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y); down = null; if (moved > 6) return; const id = pick(e); sel = id; apply(); opts.onSelect(id); });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) { opts.onHover(null, '', 0, 0); return; }
    const id = pick(e); const r = container.getBoundingClientRect();
    opts.onHover(id, id ? (info.get(id)?.name ?? '') : '', e.clientX - r.left, e.clientY - r.top); el.style.cursor = id ? 'pointer' : '';
  });
  el.addEventListener('pointerleave', () => opts.onHover(null, '', 0, 0));

  // loop
  const resize = () => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container);
  let raf = 0;
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const loop = (now: number) => {
    if (tw) { const k = Math.min(1, (now - tw.t0) / 650), e = ease(k); controls.target.lerpVectors(tw.a.t, tw.b.t, e); camera.position.lerpVectors(tw.a.p, tw.b.p, e); if (k >= 1) tw = null; }
    controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
  };
  camera.position.set(-0.6, 2.7, 5.6); controls.target.set(-2.1, 0.9, 0);
  resize(); apply(); raf = requestAnimationFrame(loop);

  return {
    set(s) { Object.assign(st, s); apply(); },
    select(id, focus = true) { sel = id; apply(); if (id && focus && id !== 'beam') focusOn(id); },
    view,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.geometry) mesh.geometry.dispose(); const mat = mesh.material as THREE.Material | undefined; if (mat && 'dispose' in mat) mat.dispose(); });
      renderer.dispose(); el.remove();
    },
  };
}
