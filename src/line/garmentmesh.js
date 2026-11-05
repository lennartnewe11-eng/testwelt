// 3D-Darstellung des T-Shirts in jedem Fertigungszustand und Nahtbahnen je Station.
// Koordinaten wie im Schnitt: x quer, z längs (Schulterlinie z = 0, Vorderteil z > 0).
import * as THREE from 'three';
import { fabricTexture } from '../render/textures.js';
import { setInBody, seamPath, makePath } from '../physics/garments.js';
import { DIM } from './garment.js';

const Y = 0.0006;  // Lagenabstand für die Darstellung

function clipX(P, keepPositive) {
  // Sutherland–Hodgman an der Geraden x = 0
  const out = [], inside = (p) => (keepPositive ? p[0] >= 0 : p[0] <= 0);
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = a[0] / (a[0] - b[0]); out.push([0, a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}

function shapeFrom(P, holes = []) {
  const s = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  return s;
}

// flaches Teil (Stoffdicke sichtbar), UV im Schnittmaßstab
function flatPiece(P, mat, holes = [], depth = 0.0012) {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(P, holes), { depth, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true;
  return m;
}
// gewendetes, aufgebauschtes Teil (Volumen durch Fase)
function puffyPiece(P, mat, holes = [], t = 0.012) {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(P, holes), { depth: t * 0.3, bevelEnabled: true, bevelThickness: t * 0.45, bevelSize: Math.min(0.01, t * 0.7), bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true;
  return m;
}

function seamLine(points, color, y, width = 0.0012) {
  if (points.length < 2) return new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.1);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 2), width, 4, false), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  m.castShadow = true;
  return m;
}
// Steppstich als Strichlinie (sichtbare Einzelstiche)
function stitchLine(points, color, y, stitch = 0.003) {
  const path = makePath(points), g = new THREE.Group();
  if (path.length < stitch) return g;
  const geo = new THREE.BoxGeometry(stitch * 0.7, 0.0008, 0.0009), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const inst = new THREE.InstancedMesh(geo, mat, Math.floor(path.length / stitch));
  const dummy = new THREE.Object3D();
  let k = 0;
  for (let s = stitch / 2; s < path.length && k < inst.count; s += stitch, k++) {
    const P = path.points, cum = path.cum;
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    const x = P[i - 1][0] + f * (P[i][0] - P[i - 1][0]), z = P[i - 1][1] + f * (P[i][1] - P[i - 1][1]);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, -Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]), 0);
    dummy.updateMatrix(); inst.setMatrixAt(k, dummy.matrix);
  }
  inst.count = k;
  const g2 = new THREE.Group(); g2.add(inst);
  return g2;
}

function offsetPolyline(P, d) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    return [p[0] - (tz / L) * d, p[1] + (tx / L) * d];
  });
}

export class GarmentKit {
  constructor(G, color = '#e9c46a') {
    this.G = G;
    const base = new THREE.Color(color);
    const tex = fabricTexture('knit', color, 256); tex.repeat.set(6, 6);
    const back = '#' + base.clone().offsetHSL(0, -0.05, -0.08).getHexString();
    const texB = fabricTexture('knit', back, 256); texB.repeat.set(6, 6);
    this.matFace = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });   // rechte Seite
    this.matBack = new THREE.MeshStandardMaterial({ map: texB, roughness: 0.95, side: THREE.DoubleSide }); // linke Seite
    const ribTex = fabricTexture('twill', color, 128); ribTex.repeat.set(20, 2);
    this.matRib = new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.85, side: THREE.DoubleSide });
    this.thread = new THREE.Color(color).offsetHSL(0, 0, -0.18).getHex();
    this.cover = 0xf4f1ea;
    this._paths();
  }

  _paths() {
    const G = this.G, { shX, neckW, bw, len, ua } = DIM;
    const body = setInBody();
    this.bodyOutline = body.outline; this.neckHole = body.holes[0];
    const P = {};
    P.schulter1 = makePath([[shX - 0.004, 0], [neckW + 0.004, 0]]);
    P.schulter2 = makePath([[-neckW + 0.004, 0], [-shX - 0.004, 0]]);
    // Hals: entlang der Halskante, 6 mm in den Ausschnitt, Start an der offenen linken Schulter
    const neck = [...G.front.neck.slice().reverse(), ...G.back.neck.slice(1).map(([x, z]) => [x, z])];
    const nk = neck.slice().sort(() => 0);
    P.hals = makePath(offsetPolyline(nk, -0.006));
    P.aermelL = seamPath(body.outline, body.chains.armloch_links, 0.01);
    P.aermelR = makePath(P.aermelL.points.map(([x, z]) => [-x, z]));
    // Säume: Ärmel links, Ärmel rechts, Vorderteil, Rückenteil (hintereinander)
    P.saumParts = [
      [[-0.128 - 0.078, -0.095], [-0.128 - 0.078, 0.095]].map(([x, z]) => [x, z]),
      [[0.128 + 0.078, 0.095], [0.128 + 0.078, -0.095]],
      [[bw - 0.005, len - 0.012], [-bw + 0.005, len - 0.012]],
      [[-bw + 0.005, -len + 0.012], [bw - 0.005, -len + 0.012]],
    ];
    P.saumA = makePath(P.saumParts.slice(0, 2).flat());   // Ärmelsäume
    P.saumK = makePath(P.saumParts.slice(2).flat());      // Saum Vorder- und Rückenteil
    // Seitennaht im gefalteten Zustand: Saum → Seite → Achsel → Ärmelunterkante → Ärmelsaum
    const side = [];
    for (let z = -len + 0.004; z <= -ua - 0.02; z += 0.01) side.push([-bw + 0.01, z]);
    const c = [-bw + 0.01 - 0.02, -ua - 0.02];
    for (let a = 0; a <= Math.PI / 2; a += Math.PI / 16) side.push([c[0] + 0.02 * Math.cos(a), c[1] + 0.02 * Math.sin(a) - 0.0]);
    const sl0 = [-0.128, -0.11 + 0.01], sl1 = [-0.128 - 0.09 + 0.004, -0.095 + 0.01];
    for (let k = 1; k <= 10; k++) side.push([sl0[0] + (sl1[0] - sl0[0]) * (k / 10), sl0[1] + (sl1[1] - sl0[1]) * (k / 10)]);
    P.seiteL = makePath(side);
    P.seiteR = makePath(side.map(([x, z]) => [-x, z]));
    this.paths = P;
  }

  // Ärmelgruppe: rechter (+x) oder linker Ärmel, aufgeklappt neben dem Armloch
  _sleeve(right, mat, half = null) {
    const G = this.G, g = new THREE.Group();
    const out = right ? G.sleeveL.outline : G.sleeveR.outline;
    const P = half === null ? out : clipX(out, half === 'pos');
    if (P.length < 3) return g;
    g.add(flatPiece(P, mat));
    g.rotation.y = right ? Math.PI / 2 : -Math.PI / 2;
    g.position.set(right ? 0.128 : -0.128, Y * 2, 0);
    return g;
  }

  // Pflegeetikett am Seitenrand des Rückenteils (links, 6 cm über dem Saum)
  _label() {
    const g = new THREE.Group();
    const lab = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.0008, 0.032), new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.5 }));
    lab.position.set(-DIM.bw + 0.009, 0, -DIM.len + 0.07); g.add(lab);
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0009, 0.0015), new THREE.MeshStandardMaterial({ color: 0x3a3f43 })); l.position.set(-DIM.bw + 0.011, 0, -DIM.len + 0.06 + k * 0.007); g.add(l); }
    g.add(stitchLine([[-DIM.bw + 0.003, -DIM.len + 0.058], [-DIM.bw + 0.003, -DIM.len + 0.082]], this.thread, 0.0005, 0.002));
    return g;
  }

  _hems(stage, y, filter = null) {
    const g = new THREE.Group(), parts = this.paths.saumParts;
    const use = stage >= 7 ? [0, 1, 2, 3] : stage >= 6 ? [0, 1] : [];
    for (const i of use) for (const d of [-0.003, 0.003]) {
      let pts = offsetPolyline(parts[i], d);
      if (filter) pts = pts.filter(filter);
      g.add(stitchLine(pts, this.cover, y));
    }
    return g;
  }

  // Zustand (Index in STAGES) → Gruppe; liefert { root, front (klappbar), grip }
  // 0–12 auf dem Klappträger (Schulterlinie = Scharnier), 13–15 auf dem Formbrett.
  build(stage) {
    const root = new THREE.Group(), G = this.G;
    const face = this.matFace, backM = this.matBack;
    if (stage < 0) return { root };
    if (stage <= 8) {
      // aufgeklappter Körper (Vorderteil z > 0, Rückenteil z < 0), linke Seite oben
      const bodyG = new THREE.Group();
      const fr = flatPiece(G.front.outline, backM), bk = flatPiece(G.back.outline, backM);
      if (stage === 0) { fr.position.z = 0.006; bk.position.z = -0.006; } // noch getrennt, in Nählage
      bk.position.y = 0.0001; bodyG.add(fr, bk);
      root.add(bodyG);
      const y = 0.0016;
      if (stage >= 1) root.add(stitchLine(this.paths.schulter1.points, this.thread, y));
      if (stage >= 3) root.add(stitchLine(this.paths.schulter2.points, this.thread, y));
      if (stage >= 2) {
        // Bündchen als Band entlang der Halskante (6 mm Naht, 12 mm sichtbar)
        const inner = offsetPolyline(this.paths.hals.points, -0.012);
        const band = [...this.paths.hals.points, ...inner.reverse()];
        const rm = flatPiece(band, this.matRib, [], 0.002); rm.position.y = 0.0006; root.add(rm);
        root.add(stitchLine(this.paths.hals.points, this.thread, y + 0.002));
      }
      // Ärmel: vor dem Einsetzen neben dem Körper auf dem Träger
      if (stage < 4) { const s1 = flatPiece(G.sleeveL.outline, face); s1.rotation.y = Math.PI / 2; s1.position.set(0.26, 0, 0.16); root.add(s1); }
      if (stage < 5) { const s2 = flatPiece(G.sleeveR.outline, face); s2.rotation.y = Math.PI / 2; s2.position.set(0.26, 0.0013, -0.12); root.add(s2); }
      if (stage >= 4) { root.add(this._sleeve(false, backM)); root.add(stitchLine(this.paths.aermelL.points, this.thread, y + 0.001)); }
      if (stage >= 5) { root.add(this._sleeve(true, backM)); root.add(stitchLine(this.paths.aermelR.points, this.thread, y + 0.001)); }
      root.add(this._hems(stage, y + 0.0015));
      if (stage >= 8) { const l = this._label(); l.position.y = y; root.add(l); }
      return { root, grip: new THREE.Vector3(0, 0, 0) };
    }
    if (stage <= 12) {
      // geklappt: Vorderseite (Vorderteil, vordere Ärmelhälften, vorderes Bündchen) liegt auf dem Rücken.
      const backSide = new THREE.Group(), frontSide = new THREE.Group();
      backSide.add(flatPiece(G.back.outline, backM));
      backSide.add(this._sleeve(false, backM, 'neg'));
      backSide.add(this._sleeve(true, backM, 'pos'));
      frontSide.add(flatPiece(G.front.outline, backM));
      frontSide.add(this._sleeve(false, backM, 'pos'));
      frontSide.add(this._sleeve(true, backM, 'neg'));
      const y = 0.0016;
      backSide.add(this._hems(stage, y, ([, z]) => z <= 0.0005));
      frontSide.add(this._hems(stage, y, ([, z]) => z >= -0.0005));
      const l = this._label(); l.position.y = y; backSide.add(l);
      // Bündchen: hinterer und vorderer Teil des Bandes
      const inner = offsetPolyline(this.paths.hals.points, -0.012);
      const band = [...this.paths.hals.points, ...inner.slice().reverse()];
      const backBand = band.filter(([, z]) => z <= 0.0005), frontBand = band.filter(([, z]) => z >= -0.0005);
      if (backBand.length > 3) { const r = flatPiece(backBand, this.matRib, [], 0.002); r.position.y = 0.0006; backSide.add(r); }
      if (frontBand.length > 3) { const r = flatPiece(frontBand, this.matRib, [], 0.002); r.position.y = 0.0006; frontSide.add(r); }
      const pivot = new THREE.Group(); pivot.add(frontSide); root.add(backSide, pivot);
      // Klappen nach oben über die Schulterlinie (negative Drehung um x hebt z > 0 an)
      pivot.rotation.x = -Math.PI; pivot.position.y = 0.004;
      if (stage >= 10) root.add(stitchLine(this.paths.seiteL.points, this.thread, 0.006));
      if (stage >= 11) root.add(stitchLine(this.paths.seiteR.points, this.thread, 0.006));
      if (stage >= 12) {
        const ok = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.002, 16), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.4 }));
        ok.position.set(0.06, 0.007, -0.22); root.add(ok);
      }
      return { root, front: pivot, grip: new THREE.Vector3(0, 0, -0.12) };
    }
    if (stage === 13) {
      // gewendet auf dem Formbrett: rechte Seite außen, leicht aufgebauscht; Bündchen als Wulst
      const g = new THREE.Group();
      g.add(puffyPiece(G.back.outline, face, [], 0.014));
      for (const right of [false, true]) {
        const s2 = new THREE.Group();
        s2.add(puffyPiece(clipX(right ? G.sleeveL.outline : G.sleeveR.outline, right), face, [], 0.01));
        s2.rotation.y = right ? Math.PI / 2 : -Math.PI / 2; s2.position.set(right ? 0.128 : -0.128, 0.002, 0); g.add(s2);
      }
      const neck = [...G.back.neck].map(([x, z]) => new THREE.Vector3(x, 0.02, z));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neck), 24, 0.006, 8, false), this.matRib));
      const fneck = G.front.neck.map(([x, z]) => new THREE.Vector3(x, 0.021, -z));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fneck), 24, 0.006, 8, false), this.matRib));
      const [hl, hr, , hb] = this.paths.saumParts;
      for (const d of [-0.003, 0.003]) {
        for (const seg of [hl, hr]) g.add(stitchLine(offsetPolyline(seg, d).filter(([, z]) => z <= 0.0005), this.cover, 0.021));
        g.add(stitchLine(offsetPolyline(hb, d), this.cover, 0.021));
      }
      root.add(g);
      return { root, grip: new THREE.Vector3(0, 0, -0.12) };
    }
    if (stage === 14) {
      // gedämpft und gefaltet (Ärmel und Seiten eingeschlagen, einmal gelegt)
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.022, 0.2), face); p.position.set(0, 0.011, -0.1); p.castShadow = true; root.add(p);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.005, 8, 24, Math.PI), this.matRib); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.023, -0.19); root.add(ring);
      return { root, grip: new THREE.Vector3(0, 0, -0.1) };
    }
    // verpackt: Polybeutel mit Etikett
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.022, 0.2), face); p.position.set(0, 0.011, -0.1); root.add(p);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.028, 0.25), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.15, depthWrite: false })); bag.position.set(0, 0.014, -0.1); root.add(bag);
    const lab = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.001, 0.035), new THREE.MeshStandardMaterial({ color: 0xffffff })); lab.position.set(0.04, 0.029, -0.16); root.add(lab);
    return { root, grip: new THREE.Vector3(0, 0, -0.1) };
  }
}
