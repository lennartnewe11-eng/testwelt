// Detaillierte prozedurale 3D-Modelle für Zelle und Produktionsstraße (Maße in m).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------- Werkstoffe
let M = null;
export function mats() {
  if (M) return M;
  const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  M = {
    alu: std(0xc3c9cf, 0.35, 0.75),
    aluDark: std(0x8d969e, 0.4, 0.7),
    steel: std(0xb7bdc4, 0.25, 0.9),
    chrome: std(0xe9edf0, 0.12, 1.0),
    blackSteel: std(0x2a2d30, 0.45, 0.6),
    paintWhite: std(0xe9ebe8, 0.45, 0.05),        // Nähmaschinen-Gehäuse
    paintGrey: std(0xc9ccc8, 0.5, 0.05),          // Schaltschrank RAL 7035
    paintDark: std(0x3a3f43, 0.55, 0.1),
    machineGreen: std(0x5f7a6e, 0.45, 0.1),
    robotOrange: std(0xe86f1c, 0.4, 0.15),
    robotGrey: std(0x4a4e52, 0.45, 0.2),
    safetyYellow: std(0xe0b000, 0.5, 0.1),
    rubber: std(0x1d1f21, 0.85, 0),
    belt: std(0x2b2e31, 0.8, 0),
    plastic: std(0x26292c, 0.55, 0),
    hpl: std(0x474d4b, 0.6, 0),
    wood: std(0xc4a27a, 0.65, 0),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdfeef3, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, transmission: 0, depthWrite: false }),
    screen: std(0x0d2a33, 0.3, 0, { emissive: 0x0c4a5a, emissiveIntensity: 0.6 }),
    ledGreen: std(0x0f3d1d, 0.4, 0, { emissive: 0x22c55e, emissiveIntensity: 0 }),
    ledAmber: std(0x3d2c0f, 0.4, 0, { emissive: 0xf59e0b, emissiveIntensity: 0 }),
    ledRed: std(0x3d0f0f, 0.4, 0, { emissive: 0xef4444, emissiveIntensity: 0 }),
    lamp: std(0xffffff, 0.3, 0, { emissive: 0xfff6e0, emissiveIntensity: 0.8 }),
    copper: std(0xb87333, 0.35, 0.8),
    kapton: std(0xc8822a, 0.5, 0.1),
    film: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }),
    carton: std(0xb08a5a, 0.85, 0),
  };
  return M;
}

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const cyl = (r, h, mat, x = 0, y = 0, z = 0, seg = 24, axis = 'y') => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
};
const group = (...c) => { const g = new THREE.Group(); c.forEach((o) => o && g.add(o)); return g; };

// ---------------------------------------------------------------- Aluprofil 40×40 mit Nuten
let profGeo = null;
function profileGeometry() {
  if (profGeo) return profGeo;
  const s = 0.02, n = 0.004, d = 0.006; // halbe Kante, halbe Nutbreite, Nuttiefe
  const sh = new THREE.Shape();
  sh.moveTo(-s, -s);
  const side = (ax, ay, bx, by, nx, ny) => {
    const mx = (ax + bx) / 2, my = (ay + by) / 2, tx = (bx - ax) / (2 * s), ty = (by - ay) / (2 * s);
    sh.lineTo(mx - tx * n, my - ty * n); sh.lineTo(mx - tx * n - nx * d, my - ty * n - ny * d);
    sh.lineTo(mx + tx * n - nx * d, my + ty * n - ny * d); sh.lineTo(mx + tx * n, my + ty * n); sh.lineTo(bx, by);
  };
  side(-s, -s, s, -s, 0, -1); side(s, -s, s, s, 1, 0); side(s, s, -s, s, 0, 1); side(-s, s, -s, -s, -1, 0);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.0042, 0, Math.PI * 2, true); sh.holes.push(hole);
  profGeo = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
  profGeo.translate(0, 0, -0.5);
  return profGeo;
}
// Profil der Länge L entlang Achse ('x' | 'y' | 'z'), Mitte bei (x, y, z)
export function profile(L, axis, x, y, z, mat = mats().alu) {
  const m = new THREE.Mesh(profileGeometry(), mat);
  m.scale.z = L;
  if (axis === 'x') m.rotation.y = Math.PI / 2; else if (axis === 'y') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- Beschriftung
export function label(title, sub = '', color = '#0b6e69') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(20,26,25,0.86)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 18); g.fill();
  g.fillStyle = color; g.fillRect(4, 4, 14, 152);
  g.fillStyle = '#ffffff'; g.font = '600 46px "Barlow Semi Condensed", Arial, sans-serif'; g.fillText(title, 36, 66);
  g.fillStyle = '#b9c4c0'; g.font = '400 32px "IBM Plex Mono", monospace'; g.fillText(sub, 36, 122);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sp.scale.set(0.96, 0.3, 1);
  sp.userData.update = (t2, s2) => {
    g.clearRect(0, 0, 512, 160);
    g.fillStyle = 'rgba(20,26,25,0.86)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 18); g.fill();
    g.fillStyle = color; g.fillRect(4, 4, 14, 152);
    g.fillStyle = '#ffffff'; g.font = '600 46px "Barlow Semi Condensed", Arial, sans-serif'; g.fillText(t2, 36, 66);
    g.fillStyle = '#b9c4c0'; g.font = '400 32px "IBM Plex Mono", monospace'; g.fillText(s2, 36, 122);
    tex.needsUpdate = true;
  };
  return sp;
}

// ---------------------------------------------------------------- Signalsäule
export function signalTower() {
  const m = mats();
  const g = group(cyl(0.012, 0.18, m.blackSteel, 0, 0.09, 0));
  const leds = { green: m.ledGreen.clone(), amber: m.ledAmber.clone(), red: m.ledRed.clone() };
  [['red', 0.27], ['amber', 0.225], ['green', 0.18]].forEach(([k, y]) => g.add(cyl(0.022, 0.042, leds[k], 0, y, 0, 20)));
  g.add(cyl(0.024, 0.01, m.plastic, 0, 0.297, 0, 20));
  g.userData.set = (state) => { leds.green.emissiveIntensity = state === 'busy' ? 1.6 : 0.05; leds.amber.emissiveIntensity = state === 'wait' ? 1.6 : 0.05; leds.red.emissiveIntensity = state === 'fault' ? 2.0 : 0.05; };
  return g;
}

// ---------------------------------------------------------------- Schutzzaun
let meshTex = null;
function fenceTexture() {
  if (meshTex) return meshTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(40,44,46,0.95)'; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 61, 61);
  meshTex = new THREE.CanvasTexture(cv); meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
  return meshTex;
}
export function fence(L, h = 1.4, along = 'x') {
  const m = mats();
  const g = new THREE.Group();
  const posts = Math.max(2, Math.ceil(L / 1.2) + 1);
  for (let k = 0; k < posts; k++) {
    const u = -L / 2 + (k * L) / (posts - 1);
    g.add(box(0.04, h, 0.04, m.safetyYellow, along === 'x' ? u : 0, h / 2, along === 'x' ? 0 : u));
  }
  const tex = fenceTexture().clone(); tex.needsUpdate = true; tex.repeat.set(L / 0.05, (h - 0.15) / 0.05);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(L, h - 0.15), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: 0x2b2f31, metalness: 0.5, roughness: 0.5 }));
  panel.position.y = (h - 0.15) / 2 + 0.1; if (along === 'z') panel.rotation.y = Math.PI / 2;
  g.add(panel);
  g.add(box(along === 'x' ? L : 0.03, 0.03, along === 'x' ? 0.03 : L, m.safetyYellow, 0, h - 0.02, 0));
  return g;
}

// ---------------------------------------------------------------- Schaltschrank mit Bedienpanel
export function cabinet(w = 0.6, h = 1.8, d = 0.4) {
  const m = mats();
  const g = group(rbox(w, h, d, 0.01, m.paintGrey, 0, h / 2, 0));
  g.add(box(w - 0.04, h - 0.1, 0.004, m.paintGrey, 0, h / 2, d / 2 + 0.002));
  g.add(box(0.012, 0.12, 0.02, m.blackSteel, w / 2 - 0.05, h / 2, d / 2 + 0.012));
  g.add(box(0.16, 0.11, 0.01, m.screen, -0.08, h * 0.72, d / 2 + 0.01));
  g.add(cyl(0.018, 0.02, m.ledRed, 0.12, h * 0.72, d / 2 + 0.012, 16, 'z'));
  // Lüftungsgitter
  for (let k = 0; k < 6; k++) g.add(box(w * 0.5, 0.006, 0.004, m.paintDark, 0, 0.2 + k * 0.025, d / 2 + 0.005));
  return g;
}

// ---------------------------------------------------------------- Industrie-Nähmaschine
// type: 'steppstich' (Flachbett, Doppelsteppstich), 'overlock', 'cover'
export function sewingMachine(type = 'steppstich', threadColor = 0xe8e2d6) {
  const m = mats();
  const g = new THREE.Group();
  const anim = {};
  const body = type === 'overlock' ? m.paintWhite : m.paintWhite;
  if (type === 'overlock' || type === 'cover') {
    // kompakte Bauform: Grundkörper, Greiferabdeckung, Nadelkopf, Fadenspannung oben
    g.add(rbox(0.30, 0.10, 0.22, 0.02, body, 0.02, 0.05, 0));
    g.add(rbox(0.12, 0.17, 0.16, 0.02, body, 0.13, 0.16, 0));
    g.add(rbox(0.22, 0.07, 0.12, 0.02, body, 0.05, 0.27, -0.01));
    g.add(rbox(0.07, 0.10, 0.10, 0.015, body, -0.06, 0.21, 0));             // Nadelkopf
    g.add(box(0.11, 0.004, 0.08, m.steel, -0.06, 0.102, 0.02));               // Stichplatte
    g.add(box(0.06, 0.012, 0.004, m.paintDark, -0.06, 0.06, 0.112));          // Greiferklappe Spalt
    g.add(cyl(0.05, 0.02, m.paintDark, 0.19, 0.17, 0, 32, 'x'));              // Handrad
    for (let k = 0; k < (type === 'cover' ? 5 : 4); k++) {                      // Spannungsscheiben
      g.add(cyl(0.012, 0.006, m.chrome, -0.02 + k * 0.03, 0.315, 0.05, 16, 'z'));
      g.add(cyl(0.003, 0.02, m.blackSteel, -0.02 + k * 0.03, 0.315, 0.04, 8, 'z'));
    }
  } else {
    // Flachbett-Doppelsteppstich: Arm, Ständer, Kopf
    g.add(rbox(0.48, 0.05, 0.18, 0.012, body, 0.12, 0.025, 0));                 // Bett
    g.add(rbox(0.09, 0.26, 0.15, 0.02, body, 0.31, 0.16, 0));                   // Ständer
    g.add(rbox(0.36, 0.07, 0.11, 0.02, body, 0.14, 0.29, 0));                   // Arm
    g.add(rbox(0.09, 0.16, 0.12, 0.02, body, -0.02, 0.22, 0));                  // Kopf
    g.add(box(0.075, 0.13, 0.004, m.steel, -0.02, 0.22, 0.062));                // Kopfdeckel
    g.add(box(0.12, 0.003, 0.09, m.steel, 0, 0.051, 0.0));                      // Stichplatte
    g.add(box(0.06, 0.002, 0.07, m.chrome, 0.08, 0.051, 0.0));                  // Schieber (Greiferabdeckung)
    g.add(cyl(0.065, 0.025, m.paintDark, 0.37, 0.24, 0, 36, 'x'));              // Handrad
    g.add(rbox(0.035, 0.09, 0.08, 0.01, m.paintDark, 0.33, 0.29, -0.07));       // Stichsteller
    // Fadenhebel, Spannung, Fadenführung
    anim.takeup = box(0.008, 0.05, 0.006, m.chrome, -0.035, 0.27, 0.066); g.add(anim.takeup);
    g.add(cyl(0.013, 0.008, m.chrome, 0.02, 0.27, 0.06, 16, 'z'));
    g.add(cyl(0.004, 0.03, m.blackSteel, 0.02, 0.27, 0.05, 8, 'z'));
    // LED-Nählicht unter dem Kopf
    g.add(box(0.03, 0.006, 0.02, m.lamp, -0.035, 0.137, 0.04));
  }
  // Nadelstange, Nadel, Nähfuß (gemeinsam für alle Bauarten, Nadel bei x = 0, Fuß auf y ≈ Bett)
  const bedTop = type === 'steppstich' ? 0.052 : 0.104;
  const nb = new THREE.Group();
  nb.add(cyl(0.0045, 0.10, m.chrome, 0, 0.05, 0, 12));
  nb.add(cyl(0.006, 0.012, m.blackSteel, 0, 0.0, 0, 12));
  const needle = cyl(0.0009, 0.035, m.chrome, 0, -0.022, 0, 8); nb.add(needle);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.00045, 0.00045, 0.12, 4), new THREE.MeshStandardMaterial({ color: threadColor, roughness: 0.8 }));
  thread.position.set(0.0012, 0.03, 0); nb.add(thread);
  if (type === 'cover') { nb.add(cyl(0.0009, 0.035, m.chrome, 0.003, -0.022, 0, 8)); nb.add(cyl(0.0009, 0.035, m.chrome, -0.003, -0.022, 0, 8)); }
  nb.position.set(type === 'steppstich' ? -0.035 : -0.06, bedTop + 0.045, 0.02);
  g.add(nb); anim.needleBar = nb; anim.needleY0 = nb.position.y;
  const foot = group(cyl(0.004, 0.09, m.chrome, 0.006, 0.045, -0.006, 10), box(0.016, 0.004, 0.03, m.steel, 0.004, 0.002, 0.0), box(0.012, 0.006, 0.004, m.steel, 0.004, 0.004, 0.014));
  foot.position.set(nb.position.x, bedTop + 0.001, 0.02);
  g.add(foot); anim.foot = foot;
  // Handrad zum Drehen
  anim.wheel = g.children.find((c) => c.geometry && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.radiusTop >= 0.05) || null;
  anim.needleX = nb.position.x; anim.bedTop = bedTop;
  g.userData.anim = anim;
  g.userData.needle = new THREE.Vector3(nb.position.x, bedTop, 0.02);
  g.userData.update = (t, sewing, rpm = 3000) => {
    const ph = sewing ? t * (rpm / 60) * Math.min(1, 25 / (rpm / 60)) : 0.25; // sichtbar verlangsamt
    const y = Math.cos(ph * 2 * Math.PI);
    anim.needleBar.position.y = anim.needleY0 + 0.012 * y;
    if (anim.wheel) anim.wheel.rotation.x = -ph * 2 * Math.PI;
    if (anim.takeup) anim.takeup.position.y = 0.27 + 0.012 * Math.sin(ph * 2 * Math.PI);
  };
  return g;
}

// Nähtisch mit Gestell, Motor, Steuerung, Fadenständer und Konen
export function sewingTable(w = 1.1, d = 0.55, h = 0.76, cones = 2, threadColor = 0xe8e2d6) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(w, 0.03, d, 0.006, m.hpl, 0, h - 0.015, 0));
  g.add(box(w, 0.032, 0.006, m.plastic, 0, h - 0.015, d / 2));                  // Kantenumleimer
  for (const sx of [-1, 1]) {
    g.add(profile(h - 0.03, 'y', sx * (w / 2 - 0.08), (h - 0.03) / 2, -d / 2 + 0.06, m.aluDark));
    g.add(profile(h - 0.03, 'y', sx * (w / 2 - 0.08), (h - 0.03) / 2, d / 2 - 0.06, m.aluDark));
    g.add(profile(d - 0.12, 'z', sx * (w / 2 - 0.08), 0.1, 0, m.aluDark));
    for (const sz of [-1, 1]) g.add(cyl(0.022, 0.015, m.rubber, sx * (w / 2 - 0.08), 0.008, sz * (d / 2 - 0.06), 16));
  }
  g.add(profile(w - 0.16, 'x', 0, 0.1, 0, m.aluDark));
  // Servomotor und Steuerkasten unter der Platte
  g.add(rbox(0.13, 0.11, 0.12, 0.01, m.paintDark, 0.25, h - 0.09, 0.05));
  g.add(cyl(0.02, 0.03, m.blackSteel, 0.18, h - 0.09, 0.05, 16, 'x'));
  g.add(rbox(0.2, 0.08, 0.14, 0.01, m.paintGrey, -0.25, h - 0.08, 0.08));
  g.add(box(0.06, 0.035, 0.005, m.screen, -0.25, h - 0.08, 0.152));
  // Fadenständer
  const sx = -w / 2 + 0.1, sz = -d / 2 + 0.08;
  g.add(cyl(0.006, 0.55, m.chrome, sx, h + 0.275, sz, 10));
  g.add(cyl(0.004, 0.18, m.chrome, sx, h + 0.54, sz, 8, 'x'));
  const tm = new THREE.MeshStandardMaterial({ color: threadColor, roughness: 0.85 });
  for (let k = 0; k < cones; k++) {
    const cx = sx - 0.06 + k * 0.05;
    g.add(cyl(0.02, 0.006, m.plastic, cx, h + 0.003, sz, 16));
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.028, 0.11, 18), tm); cone.position.set(cx, h + 0.06, sz); cone.castShadow = true; g.add(cone);
    g.add(cyl(0.0035, 0.01, m.chrome, cx, h + 0.54, sz, 8));
  }
  // Pedal / Kniehebel
  g.add(rbox(0.22, 0.03, 0.12, 0.01, m.plastic, 0, 0.05, d / 2 - 0.1));
  return g;
}

// ---------------------------------------------------------------- 6-Achs-Industrieroboter
// Kinematik (vereinfacht): Basis-Drehung, Schulter- und Ellbogen-Nicken (2-Glieder-IK),
// Handgelenk hält das Werkzeug senkrecht nach unten und dreht um die Hochachse.
export function robot6(scale = 1) {
  const m = mats();
  const L1 = 0.62 * scale, L2 = 0.58 * scale, h0 = 0.42 * scale, wrist = 0.14 * scale;
  const root = new THREE.Group();
  root.add(cyl(0.2 * scale, 0.08 * scale, m.robotGrey, 0, 0.04 * scale, 0, 32));                 // Fuß
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; root.add(cyl(0.012 * scale, 0.02 * scale, m.chrome, Math.cos(a) * 0.17 * scale, 0.085 * scale, Math.sin(a) * 0.17 * scale, 8)); }
  const j1 = new THREE.Group(); j1.position.y = 0.08 * scale; root.add(j1);
  j1.add(cyl(0.16 * scale, 0.22 * scale, m.robotOrange, 0, 0.11 * scale, 0, 32));
  j1.add(rbox(0.26 * scale, 0.2 * scale, 0.22 * scale, 0.04 * scale, m.robotOrange, 0.04 * scale, 0.28 * scale, 0));
  j1.add(cyl(0.06 * scale, 0.1 * scale, m.robotGrey, -0.12 * scale, 0.22 * scale, 0, 20, 'z'));     // Motor A1
  const j2 = new THREE.Group(); j2.position.set(0.08 * scale, h0 - 0.08 * scale, 0); j1.add(j2);
  j2.add(cyl(0.11 * scale, 0.26 * scale, m.robotGrey, 0, 0, 0, 28, 'z'));
  const arm1 = rbox(0.14 * scale, L1, 0.16 * scale, 0.05 * scale, m.robotOrange, 0, L1 / 2, 0); j2.add(arm1);
  j2.add(cyl(0.055 * scale, 0.09 * scale, m.robotGrey, 0, 0.12 * scale, -0.13 * scale, 18, 'z'));   // Motor A2
  const j3 = new THREE.Group(); j3.position.y = L1; j2.add(j3);
  j3.add(cyl(0.09 * scale, 0.2 * scale, m.robotGrey, 0, 0, 0, 24, 'z'));
  j3.add(rbox(0.16 * scale, 0.16 * scale, 0.18 * scale, 0.04 * scale, m.robotOrange, -0.05 * scale, 0, 0));
  const arm2 = rbox(L2, 0.1 * scale, 0.11 * scale, 0.04 * scale, m.robotOrange, L2 / 2, 0, 0); j3.add(arm2);
  j3.add(cyl(0.045 * scale, 0.12 * scale, m.robotGrey, -0.14 * scale, 0, 0, 16, 'x'));               // Motoren A4–A6
  const j5 = new THREE.Group(); j5.position.x = L2; j3.add(j5);
  j5.add(cyl(0.05 * scale, 0.11 * scale, m.robotGrey, 0, 0, 0, 20, 'z'));
  const j6 = new THREE.Group(); j5.add(j6);
  j6.add(cyl(0.04 * scale, wrist * 0.6, m.robotOrange, 0, -wrist * 0.3, 0, 20));
  j6.add(cyl(0.032 * scale, 0.02 * scale, m.chrome, 0, -wrist * 0.65, 0, 20));                      // Flansch
  const tool = new THREE.Group(); tool.position.y = -wrist; j6.add(tool);
  // Energiezuführung (Kabelschlauch) als gebogene Röhre
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.1, 0.25, 0.1), new THREE.Vector3(-0.05, 0.6, 0.14), new THREE.Vector3(0.1, 0.9, 0.12)].map((v) => v.multiplyScalar(scale))), 16, 0.018 * scale, 8), m.plastic);
  j1.add(hose);
  root.userData = { j1, j2, j3, j5, j6, tool, L1, L2, h0, wrist, scale, base: new THREE.Vector3() };
  // Werkzeugspitze an Punkt p (im Roboter-Koordinatensystem), Werkzeug senkrecht, Drehung yaw
  root.userData.reach = (p, yaw = 0) => {
    const u = root.userData;
    const a1 = Math.atan2(-p.z, p.x);
    u.j1.rotation.y = a1;
    const r = Math.hypot(p.x, p.z) - 0.08 * scale;
    const y = p.y + u.wrist - (u.h0);
    const d = Math.min(u.L1 + u.L2 - 1e-4, Math.max(0.05, Math.hypot(r, y)));
    const c2 = (d * d - u.L1 * u.L1 - u.L2 * u.L2) / (2 * u.L1 * u.L2);
    const q2 = Math.acos(Math.max(-1, Math.min(1, c2)));                 // Ellbogen
    const q1 = Math.atan2(y, r) + Math.atan2(u.L2 * Math.sin(q2), u.L1 + u.L2 * Math.cos(q2));
    // Arm1 zeigt bei rotation.z = 0 nach oben (+y); Winkel zur Horizontalen = q1
    u.j2.rotation.z = q1 - Math.PI / 2;
    u.j3.rotation.z = Math.PI / 2 - q2;                                    // Arm2 relativ (bei 0: waagrecht nach vorn)
    // Handgelenk: Werkzeug senkrecht nach unten
    const abs = (q1 - Math.PI / 2) + (Math.PI / 2 - q2);
    u.j5.rotation.z = -abs - (q1 - Math.PI / 2) * 0 ;
    u.j5.rotation.z = -(u.j2.rotation.z + u.j3.rotation.z) - Math.PI / 2 + Math.PI / 2;
    u.j6.rotation.y = yaw - a1;
  };
  return root;
}

// ---------------------------------------------------------------- Transfersystem (Doppelgurt)
export function conveyor(L, h = 0.85, width = 0.62) {
  const m = mats();
  const g = new THREE.Group();
  for (const sz of [-1, 1]) {
    g.add(profile(L, 'x', L / 2, h - 0.02, sz * width / 2, m.alu));                 // Laufprofil
    g.add(box(L, 0.006, 0.03, m.belt, L / 2, h + 0.003, sz * width / 2));          // Zahngurt
    g.add(profile(L, 'x', L / 2, 0.36, sz * width / 2, m.alu));                     // Rücklauf
    g.add(box(L, 0.006, 0.03, m.belt, L / 2, 0.383, sz * width / 2));
  }
  const legs = Math.ceil(L / 1.5) + 1;
  for (let k = 0; k < legs; k++) {
    const x = (k * L) / (legs - 1);
    for (const sz of [-1, 1]) { g.add(profile(h - 0.04, 'y', x, (h - 0.04) / 2, sz * (width / 2 + 0.05), m.aluDark)); g.add(cyl(0.025, 0.02, m.rubber, x, 0.01, sz * (width / 2 + 0.05), 16)); }
    g.add(profile(width + 0.1, 'z', x, h - 0.06, 0, m.aluDark));
    g.add(profile(width + 0.1, 'z', x, 0.32, 0, m.aluDark));
  }
  // Antriebe mit Getriebemotor je 6 m
  for (let x = 0; x < L; x += 6) g.add(rbox(0.12, 0.12, 0.16, 0.01, m.paintDark, x + 0.3, h - 0.09, width / 2 + 0.14));
  return g;
}

// Werkstückträger: Palette mit Zentrierbuchsen, RFID-Datenträger, Trägerblech
export function carrier(w = 0.66, d = 0.56) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(w, 0.025, d, 0.006, m.aluDark, 0, 0.0125, 0));
  g.add(box(w - 0.04, 0.003, d - 0.04, m.steel, 0, 0.027, 0));                    // Trägerblech
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.012, 0.03, m.chrome, sx * (w / 2 - 0.04), 0.015, sz * (d / 2 - 0.04), 12));
  g.add(box(0.05, 0.012, 0.03, m.safetyYellow, w / 2 - 0.05, 0.03, -d / 2 + 0.03));  // RFID-Tag
  // Nadelleisten (Kammleisten) an den Rändern
  for (const sz of [-1, 1]) g.add(box(w - 0.12, 0.008, 0.012, m.blackSteel, 0, 0.032, sz * (d / 2 - 0.05)));
  return g;
}

// ---------------------------------------------------------------- Legetisch mit Legemaschine
export function spreader(L = 3.2, W = 1.8, h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(L, 0.04, W, 0.01, m.paintGrey, L / 2, h - 0.02, 0));
  for (let x = 0.15; x < L; x += 1.0) for (const sz of [-1, 1]) g.add(profile(h - 0.04, 'y', x, (h - 0.04) / 2, sz * (W / 2 - 0.08), m.aluDark));
  for (const sz of [-1, 1]) g.add(box(L, 0.03, 0.05, m.steel, L / 2, h + 0.015, sz * (W / 2 + 0.03)));      // Laufschienen
  const car = new THREE.Group();                                                                               // Wagen
  for (const sz of [-1, 1]) {
    car.add(rbox(0.5, 0.55, 0.12, 0.02, m.machineGreen, 0, 0.3, sz * (W / 2 + 0.05)));
    car.add(cyl(0.04, 0.05, m.rubber, -0.15, 0.04, sz * (W / 2 + 0.03), 16, 'z'));
    car.add(cyl(0.04, 0.05, m.rubber, 0.15, 0.04, sz * (W / 2 + 0.03), 16, 'z'));
  }
  car.add(rbox(0.48, 0.08, W + 0.2, 0.02, m.machineGreen, 0, 0.58, 0));
  const roll = cyl(0.14, W - 0.1, new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.9 }), 0.05, 0.42, 0, 40, 'z');
  car.add(roll);
  car.add(cyl(0.025, W + 0.05, m.steel, 0.05, 0.42, 0, 16, 'z'));
  car.add(box(0.04, 0.02, W - 0.1, m.blackSteel, -0.2, 0.08, 0));                 // Abschneidmesser-Schiene
  car.add(rbox(0.16, 0.2, 0.06, 0.01, m.paintGrey, 0.12, 0.75, W / 2 + 0.1));    // Bedienpanel
  car.add(box(0.1, 0.07, 0.005, m.screen, 0.12, 0.77, W / 2 + 0.133));
  car.position.y = h;
  g.add(car);
  g.userData = { carriage: car, roll, L, W, h };
  return g;
}

// ---------------------------------------------------------------- CNC-Cutter (Saugtisch mit Bürstenband)
export function cutter(L = 3.0, W = 1.8, h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  // Bürstenblöcke (Saugtisch-Oberfläche)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c2 = cv.getContext('2d'); c2.fillStyle = '#2f3436'; c2.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 4) for (let j = 0; j < 64; j += 4) { c2.fillStyle = (i + j) % 8 ? '#3d4346' : '#272b2d'; c2.fillRect(i, j, 3, 3); }
  const bt = new THREE.CanvasTexture(cv); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(L * 6, W * 6);
  g.add(box(L, 0.08, W, new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95 }), L / 2, h - 0.04, 0));
  g.add(rbox(L + 0.1, 0.5, W + 0.1, 0.02, m.paintGrey, L / 2, h - 0.34, 0));
  g.add(rbox(0.6, 0.6, 0.5, 0.02, m.paintGrey, L + 0.4, 0.3, W / 2 - 0.2));      // Vakuumpumpe
  for (const sz of [-1, 1]) g.add(box(L, 0.05, 0.08, m.aluDark, L / 2, h + 0.05, sz * (W / 2 + 0.06)));
  const gantry = new THREE.Group();
  for (const sz of [-1, 1]) gantry.add(rbox(0.22, 0.3, 0.14, 0.02, m.paintWhite, 0, 0.2, sz * (W / 2 + 0.06)));
  gantry.add(rbox(0.18, 0.16, W + 0.25, 0.02, m.paintWhite, 0, 0.42, 0));
  gantry.add(box(0.05, 0.05, W, m.alu, 0.1, 0.42, 0));
  const head = new THREE.Group();
  head.add(rbox(0.2, 0.28, 0.2, 0.02, m.paintDark, 0.13, 0.32, 0));
  head.add(cyl(0.035, 0.12, m.steel, 0.13, 0.12, 0, 16));
  const knife = box(0.003, 0.08, 0.012, m.chrome, 0.13, 0.03, 0); head.add(knife);
  head.add(box(0.03, 0.03, 0.03, m.ledRed, 0.2, 0.2, 0.08));
  gantry.add(head);
  gantry.position.y = h;
  g.add(gantry);
  // Folienrolle (Abdeckfolie für das Vakuum)
  g.add(cyl(0.06, W, m.film, -0.15, h + 0.08, 0, 24, 'z'));
  g.add(cyl(0.02, W + 0.1, m.steel, -0.15, h + 0.08, 0, 12, 'z'));
  g.userData = { gantry, head, knife, L, W, h };
  return g;
}

// ---------------------------------------------------------------- Stationen der Ausrüstung
export function foldTable(w = 1.0, d = 0.8, h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(w, 0.06, d, 0.01, m.paintGrey, 0, h - 0.03, 0));
  const flap = new THREE.Group(); flap.position.set(0, h, 0);
  flap.add(box(w * 0.9, 0.012, d / 2 - 0.02, m.alu, 0, 0.006, -(d / 4)));
  for (let k = 0; k < 8; k++) flap.add(cyl(0.006, 0.004, m.blackSteel, -w * 0.4 + k * w * 0.11, 0.013, -d / 4, 10));
  g.add(flap);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(profile(h - 0.06, 'y', sx * (w / 2 - 0.05), (h - 0.06) / 2, sz * (d / 2 - 0.05), m.aluDark));
  g.add(cyl(0.03, w * 0.92, m.steel, 0, h + 0.01, 0, 16, 'x'));                    // Scharnierwelle
  g.add(rbox(0.12, 0.08, 0.1, 0.01, m.paintDark, w / 2 - 0.1, h - 0.1, 0));      // Schwenkantrieb
  g.userData = { flap };
  return g;
}

export function turner(h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(0.7, h - 0.05, 0.6, 0.02, m.paintGrey, 0, (h - 0.05) / 2, 0));
  g.add(cyl(0.11, 0.9, m.steel, 0, h + 0.45, 0, 32));                              // Wenderohr
  g.add(cyl(0.14, 0.05, m.paintDark, 0, h + 0.9, 0, 32));                          // Klemmring
  g.add(cyl(0.13, 0.04, m.safetyYellow, 0, h + 0.03, 0, 32));
  g.add(rbox(0.3, 0.4, 0.3, 0.02, m.paintDark, 0.36, h + 0.2, 0));               // Gebläse
  g.add(cyl(0.05, 0.4, m.plastic, 0.2, h + 0.62, 0, 16, 'x'));
  return g;
}

export function visionTunnel(len = 0.9, width = 0.9, h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  for (const sz of [-1, 1]) g.add(rbox(len, 0.7, 0.04, 0.01, m.paintDark, 0, h + 0.35, sz * width / 2));
  g.add(rbox(len, 0.04, width + 0.04, 0.01, m.paintDark, 0, h + 0.72, 0));
  g.add(box(len - 0.1, 0.01, width - 0.1, m.lamp, 0, h + 0.695, 0));             // LED-Flächenleuchte
  for (const x of [-0.25, 0.25]) { g.add(rbox(0.07, 0.1, 0.07, 0.01, m.blackSteel, x, h + 0.62, 0)); g.add(cyl(0.022, 0.03, m.chrome, x, h + 0.56, 0, 16)); }
  g.add(rbox(0.12, 0.18, 0.1, 0.01, m.paintDark, 0, h + 0.5, width / 2 - 0.1));  // Fadenkapp-Einheit (Laser)
  return g;
}

export function pressFolder(h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(1.0, h - 0.05, 0.8, 0.02, m.paintWhite, 0, (h - 0.05) / 2, 0));
  g.add(rbox(0.7, 0.04, 0.55, 0.01, m.paintGrey, 0, h + 0.02, 0));               // Bügelunterteil (Vakuum)
  const lid = new THREE.Group(); lid.position.set(0, h + 0.05, -0.3);
  lid.add(rbox(0.68, 0.05, 0.53, 0.01, m.steel, 0, 0.025, 0.28));
  lid.add(rbox(0.2, 0.08, 0.1, 0.01, m.paintDark, 0, 0.08, 0.28));
  g.add(lid);
  g.add(rbox(0.12, 0.6, 0.12, 0.02, m.paintWhite, 0, h + 0.3, -0.42));           // Säule mit Zylinder
  g.add(cyl(0.025, 0.25, m.chrome, 0, h + 0.55, -0.32, 16));
  g.add(cyl(0.004, 0.6, m.plastic, -0.4, h + 0.3, -0.38, 6));                     // Dampfschlauch
  g.add(rbox(0.2, 0.15, 0.06, 0.01, m.paintGrey, 0.4, h + 0.3, 0.42));           // Bedienteil
  g.add(box(0.12, 0.07, 0.005, m.screen, 0.4, h + 0.32, 0.453));
  g.userData = { lid };
  return g;
}

export function bagger(h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(0.9, h - 0.05, 0.7, 0.02, m.paintWhite, 0, (h - 0.05) / 2, 0));
  g.add(cyl(0.09, 0.6, m.film, -0.25, h + 0.35, -0.2, 28, 'z'));                  // Folienrolle
  g.add(cyl(0.03, 0.66, m.steel, -0.25, h + 0.35, -0.2, 12, 'z'));
  const bar = rbox(0.5, 0.04, 0.05, 0.01, m.copper, 0.15, h + 0.25, 0); g.add(bar); // Schweißbalken
  g.add(rbox(0.06, 0.4, 0.06, 0.01, m.paintWhite, 0.4, h + 0.2, 0));
  g.add(rbox(0.06, 0.4, 0.06, 0.01, m.paintWhite, -0.1, h + 0.2, 0.3));
  g.userData = { bar };
  return g;
}

export function pallet() {
  const m = mats();
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) g.add(box(1.2, 0.022, 0.1, m.wood, 0, 0.133, -0.36 + k * 0.18));
  for (const z of [-0.36, 0, 0.36]) for (const x of [-0.5, 0, 0.5]) g.add(box(0.14, 0.078, 0.1, m.wood, x, 0.078, z));
  for (let k = 0; k < 3; k++) g.add(box(1.2, 0.022, 0.1, m.wood, 0, 0.028, -0.36 + k * 0.36));
  return g;
}

export function fabricRollRack() {
  const m = mats();
  const g = new THREE.Group();
  for (const sx of [-1, 1]) { g.add(profile(1.6, 'y', sx * 0.95, 0.8, -0.3)); g.add(profile(1.6, 'y', sx * 0.95, 0.8, 0.3)); }
  const colors = [0xe9c46a, 0xdfe6ee, 0x4d6fa0, 0x8a8f99, 0xe9c46a, 0xf4d6d6];
  for (let r = 0; r < 3; r++) {
    for (const sx of [-1, 1]) g.add(profile(0.64, 'z', sx * 0.95, 0.3 + r * 0.55, 0));
    g.add(cyl(0.02, 2.0, m.steel, 0, 0.32 + r * 0.55, 0, 12, 'x'));
    for (let k = 0; k < 2; k++) g.add(cyl(0.16, 1.55, new THREE.MeshStandardMaterial({ color: colors[r * 2 + k], roughness: 0.9 }), 0, 0.48 + r * 0.55, (k - 0.5) * 0.34, 36, 'x'));
  }
  return g;
}

// ---------------------------------------------------------------- Klappträger mit Formbrett
// Zwei Hälften mit Nadelleisten, Scharnier quer zur Förderrichtung (x = 0). Die Hälfte x > 0
// (Vorderteil) klappt um +z-Achse auf die Hälfte x < 0. Formbrett für die Teile nach dem Wenden.
export function klappTraeger(w = 0.66, d = 0.56) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(w, 0.025, d, 0.006, m.aluDark, 0, 0.0125, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.012, 0.03, m.chrome, sx * (w / 2 - 0.04), 0.015, sz * (d / 2 - 0.04), 12));
  g.add(box(0.05, 0.012, 0.03, m.safetyYellow, -w / 2 + 0.05, 0.03, -d / 2 + 0.03));  // RFID-Tag
  const half = (sign, solid) => {
    const h = new THREE.Group();
    if (solid) h.add(box(w / 2 - 0.03, 0.003, d - 0.04, m.steel, sign * (w / 4 - 0.005), 0.0015, 0));
    else { // Klapphälfte als Rahmen, damit das Teil sichtbar und für die Nadel zugänglich bleibt
      for (const sz of [-1, 1]) h.add(box(w / 2 - 0.03, 0.004, 0.03, m.alu, sign * (w / 4 - 0.005), 0.002, sz * (d / 2 - 0.035)));
      h.add(box(0.03, 0.004, d - 0.04, m.alu, sign * (w / 2 - 0.035), 0.002, 0));
      h.add(box(0.02, 0.004, d - 0.04, m.alu, sign * 0.02, 0.002, 0));
    }
    for (const sz of [-1, 1]) h.add(box(w / 2 - 0.08, 0.007, 0.012, m.blackSteel, sign * (w / 4), 0.0045, sz * (d / 2 - 0.05))); // Nadelleisten
    h.add(box(0.012, 0.007, d - 0.16, m.blackSteel, sign * (w / 2 - 0.05), 0.0045, 0));
    return h;
  };
  const fixed = half(-1, true); fixed.position.y = 0.026; g.add(fixed);
  const fixedR = half(1, true); fixedR.position.y = 0.026; g.add(fixedR); // Auflage unter der Klapphälfte
  const flap = new THREE.Group(); flap.position.set(0, 0.03, 0); g.add(flap);
  const fh = half(1, false); fh.position.y = -0.0005; flap.add(fh);
  for (const z of [-0.2, 0, 0.2]) g.add(cyl(0.008, 0.06, m.chrome, 0, 0.03, z, 12, 'z'));   // Scharnier
  // Formbrett (nach dem Wenden): flaches Brett mit Schulterform
  const board = new THREE.Group();
  const sh = new THREE.Shape();
  const bw = 0.15, bl = 0.24;
  sh.moveTo(-bw, -bl); sh.lineTo(bw, -bl); sh.lineTo(bw, bl - 0.06); sh.quadraticCurveTo(bw, bl, bw - 0.06, bl); sh.lineTo(-bw + 0.06, bl); sh.quadraticCurveTo(-bw, bl, -bw, bl - 0.06); sh.closePath();
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.002, bevelSegments: 2 });
  bg.rotateX(-Math.PI / 2);
  const bm = new THREE.Mesh(bg, std2(0xdfe3e6, 0.4, 0.1)); bm.castShadow = bm.receiveShadow = true;
  board.add(bm); board.add(box(0.06, 0.02, 0.04, m.paintDark, 0, 0.0, 0.2));
  board.position.set(0, 0.03, 0); board.rotation.y = Math.PI / 2; board.visible = false; g.add(board);
  g.userData = { flap, board, top: 0.03 };
  return g;
}
const std2 = (color, r, mt) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: mt });

// Etikettierer: Etikettenband von der Rolle, Ultraschall-Schneiden, Falten, Heftriegel-Kopf
export function labelTacker(h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(0.8, h - 0.05, 0.6, 0.02, m.paintWhite, 0, (h - 0.05) / 2, 0));
  g.add(rbox(0.7, 0.03, 0.5, 0.01, m.paintGrey, 0, h, 0));
  g.add(cyl(0.07, 0.03, std2(0xf4f4f0, 0.6, 0), -0.25, h + 0.2, -0.15, 28, 'z'));     // Etikettenrolle
  g.add(cyl(0.015, 0.06, m.steel, -0.25, h + 0.2, -0.15, 12, 'z'));
  g.add(box(0.02, 0.18, 0.02, m.alu, -0.25, h + 0.09, -0.15));
  g.add(rbox(0.16, 0.1, 0.1, 0.01, m.paintDark, -0.08, h + 0.12, -0.15));            // Schneid-/Falteinheit
  g.add(box(0.002, 0.09, 0.02, std2(0xf4f4f0, 0.6, 0), -0.17, h + 0.16, -0.15));       // Band
  // Heftriegel-Kopf (kurzer Arm mit Nadel)
  g.add(rbox(0.1, 0.32, 0.12, 0.015, m.paintWhite, 0.25, h + 0.16, -0.12));
  g.add(rbox(0.3, 0.08, 0.1, 0.015, m.paintWhite, 0.12, h + 0.3, -0.12));
  const nb = group(cyl(0.004, 0.08, m.chrome, 0, 0, 0, 10), cyl(0.0008, 0.03, m.chrome, 0, -0.05, 0, 6));
  nb.position.set(0.0, h + 0.22, -0.12); g.add(nb);
  g.add(box(0.08, 0.003, 0.08, m.steel, 0.0, h + 0.017, -0.12));
  g.userData = { needle: nb, y0: h + 0.22 };
  return g;
}

// Klappstation: Schwenkantrieb, der in das Trägerscharnier greift, und Kamerabrücke
export function klappDrive(h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(rbox(0.3, h - 0.1, 0.3, 0.02, m.paintGrey, 0, (h - 0.1) / 2, 0));
  g.add(rbox(0.18, 0.14, 0.18, 0.02, m.paintDark, 0, h - 0.02, 0));
  g.add(cyl(0.03, 0.2, m.chrome, 0, h - 0.02, 0.18, 16, 'z'));                       // Mitnehmerwelle
  for (const sx of [-1, 1]) g.add(profile(1.0, 'y', sx * 0.45, h + 0.5 - 0.15, 0.62, m.alu));
  g.add(profile(0.94, 'x', 0, h + 0.85, 0.62, m.alu));
  for (const x of [-0.2, 0.2]) { g.add(rbox(0.07, 0.09, 0.07, 0.01, m.blackSteel, x, h + 0.78, 0.62)); g.add(cyl(0.02, 0.03, m.chrome, x, h + 0.72, 0.62, 14)); }
  g.add(box(0.8, 0.01, 0.06, m.lamp, 0, h + 0.82, 0.5));
  return g;
}

// Bündchenzuführung: Rippstrick-Rolle, Tänzer, Faltapparat und Abzugswalzen vor dem Nähfuß
export function ribFeeder(color = 0xe9c46a) {
  const m = mats();
  const g = new THREE.Group();
  const rib = std2(color, 0.85, 0);
  g.add(box(0.03, 0.42, 0.03, m.alu, 0, 0.21, 0));
  g.add(cyl(0.08, 0.05, rib, 0, 0.42, 0.05, 32, 'z'));                                 // Rolle
  g.add(cyl(0.012, 0.12, m.steel, 0, 0.42, 0.04, 12, 'z'));
  g.add(cyl(0.008, 0.08, m.chrome, 0.12, 0.3, 0.05, 10, 'z'));                         // Tänzerwalze
  g.add(box(0.14, 0.012, 0.012, m.alu, 0.06, 0.3, 0.02));
  g.add(rbox(0.07, 0.03, 0.05, 0.008, m.chrome, 0.22, 0.08, 0.05));                    // Faltapparat
  g.add(cyl(0.012, 0.04, m.rubber, 0.29, 0.06, 0.05, 14, 'z'));                       // Abzugswalzen
  g.add(cyl(0.012, 0.04, m.rubber, 0.29, 0.085, 0.05, 14, 'z'));
  g.add(rbox(0.06, 0.06, 0.06, 0.008, m.paintDark, 0.29, 0.12, 0.0));                 // Servo
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.002, 0.018), rib); band.position.set(0.15, 0.2, 0.05); band.rotation.z = -0.9; g.add(band);
  return g;
}

// Abwickler für die Stoffrolle (einlagiger Zuschnitt) mit Kantensteuerung
export function unwinder(W = 1.8, h = 0.85, color = 0xe9c46a) {
  const m = mats();
  const g = new THREE.Group();
  for (const sz of [-1, 1]) { g.add(rbox(0.12, h + 0.25, 0.1, 0.01, m.machineGreen, 0, (h + 0.25) / 2, sz * (W / 2 + 0.08))); }
  const roll = cyl(0.2, W - 0.1, std2(color, 0.9, 0), 0, h + 0.05, 0, 40, 'z'); g.add(roll);
  g.add(cyl(0.03, W + 0.25, m.steel, 0, h + 0.05, 0, 16, 'z'));
  g.add(cyl(0.03, W, m.chrome, 0.35, h + 0.12, 0, 16, 'z'));                         // Umlenkwalze
  g.add(rbox(0.1, 0.06, 0.1, 0.01, m.paintDark, 0.35, h + 0.2, -W / 2 + 0.1));       // Kantensensor
  g.add(rbox(0.25, 0.25, 0.2, 0.02, m.paintDark, 0, 0.3, W / 2 + 0.25));            // Antrieb
  g.userData = { roll };
  return g;
}

// Abnahmeband (Vakuum-Förderband) hinter dem Cutter
export function takeoffBelt(L = 4.5, W = 1.8, h = 0.85) {
  const m = mats();
  const g = new THREE.Group();
  g.add(box(L, 0.04, W, m.belt, L / 2, h - 0.02, 0));
  g.add(rbox(L + 0.06, 0.12, W + 0.06, 0.01, m.paintGrey, L / 2, h - 0.1, 0));
  for (const x of [0, L]) g.add(cyl(0.06, W, m.alu, x, h - 0.05, 0, 20, 'z'));
  for (let x = 0.2; x < L; x += 1.1) for (const sz of [-1, 1]) g.add(profile(h - 0.16, 'y', x, (h - 0.16) / 2, sz * (W / 2 - 0.08), m.aluDark));
  return g;
}
