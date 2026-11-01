// 3D-Ansicht der Produktionsstraße (digitaler Zwilling der ereignisdiskreten Simulation).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gridTexture } from '../render/textures.js';
import { mats, profile, label, signalTower, fence, cabinet, sewingMachine, sewingTable, robot6, conveyor, carrier, spreader, cutter, foldTable, turner, visionTunnel, pressFolder, bagger, pallet, fabricRollRack } from '../render/models.js';
import { GarmentKit } from './garmentmesh.js';
import { pathAt } from '../physics/garments.js';
import { STAGES } from './des.js';

const place = (o, x, y, z) => { o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
const H = 0.85;                 // Arbeitshöhe Transfersystem
const SPUR_Z = -0.82, ROBOT_Z = -1.55, MACH_Z = -2.45;

export class LineView {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'none';
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.03, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.49;
    this.follow = null;
    this.showLabels = true;
    this.visible = false;
    window.addEventListener('resize', () => this.resize());
  }

  setVisible(v) { this.visible = v; this.renderer.domElement.style.display = v ? 'block' : 'none'; if (v) this.resize(); }
  setTheme(dark) { const bg = dark ? 0x161a19 : 0xdfe3e1; this.scene.background = new THREE.Color(bg); this.scene.fog = new THREE.Fog(bg, 30, 90); }
  resize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  build(sim) {
    this.sim = sim;
    const sc = this.scene;
    while (sc.children.length) sc.remove(sc.children[0]);
    const m = mats();
    // Licht
    sc.add(new THREE.HemisphereLight(0xf2f5ff, 0x404442, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(10, 18, 8); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    const L = sim.mainLen;
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 10, bottom: -10, near: 1, far: 60 });
    sun.target.position.set((L - 14) / 2, 0, -1); sc.add(sun, sun.target);
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
    // Halle: Boden, Gangmarkierung, Stützen, Hallenleuchten
    const ft = gridTexture('#9ea4a1', '#8c928f'); ft.repeat.set(40, 12);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 24), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set((L - 14) / 2, 0, -1); floor.receiveShadow = true; sc.add(floor);
    const mark = new THREE.MeshBasicMaterial({ color: 0xd9a400 });
    for (const z of [1.15, 1.25]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(L + 16, 0.05), mark); s.rotation.x = -Math.PI / 2; s.position.set((L - 14) / 2, 0.002, z); sc.add(s); }
    for (let x = -14; x < L + 4; x += 6) {
      sc.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), m.paintGrey), x, 3, -4.2));
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.25), m.lamp); lamp.position.set(x + 3, 4.6, -1); sc.add(lamp);
    }

    // ---------------- Vorstufe: Stofflager, Legen, Schneiden, Abnehmen, Kommissionieren
    const rack = fabricRollRack(); rack.position.set(-13.2, 0, 0); rack.rotation.y = Math.PI / 2; sc.add(rack);
    this.spreader = spreader(3.2, 1.8, H); this.spreader.position.set(-11.6, 0, 0); sc.add(this.spreader);
    this.cutterM = cutter(3.0, 1.8, H); this.cutterM.position.set(-7.9, 0, 0); sc.add(this.cutterM);
    // Abnahmetisch
    const take = new THREE.Group();
    take.add(place(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 1.7), m.paintGrey), 0.9, H - 0.02, 0));
    for (const sx of [0.1, 1.7]) for (const sz of [-0.75, 0.75]) take.add(profile(H - 0.04, 'y', sx, (H - 0.04) / 2, sz, m.aluDark));
    take.position.set(-4.4, 0, 0); sc.add(take);
    // Stoffstapel (wachsen beim Legen, wandern zum Cutter und Abnahmetisch)
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.9 });
    const mk = sim.marker;
    this.spreadStack = new THREE.Mesh(new THREE.BoxGeometry(mk.length, 1, mk.width), fabricMat); this.spreadStack.castShadow = true; sc.add(this.spreadStack);
    this.cutStack = new THREE.Group(); sc.add(this.cutStack);
    const cs = new THREE.Mesh(new THREE.BoxGeometry(mk.length, 1, mk.width), fabricMat); cs.castShadow = true; this.cutStack.add(cs); this.cutStackBox = cs;
    this.takeStack = new THREE.Group(); sc.add(this.takeStack);
    const ts = new THREE.Mesh(new THREE.BoxGeometry(mk.length, 1, mk.width), fabricMat); ts.castShadow = true; this.takeStack.add(ts); this.takeStackBox = ts;
    // Schnittbild-Konturen (auf Cutter und Abnahmetisch)
    const contour = [];
    for (const p of mk.parts) { const pts = [...p.outline, p.outline[0]].map(([x, z]) => [x + p.x, z + p.z]); contour.push(pts); }
    this.cutPath = contour.flat();
    const lineGeo = (pts) => new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(z - mk.length / 2, 0, x - mk.width / 2)));
    const outlineMat = new THREE.LineBasicMaterial({ color: 0x5a4a20 });
    for (const pts of contour) { this.cutStack.add(new THREE.Line(lineGeo(pts), outlineMat)); this.takeStack.add(new THREE.Line(lineGeo(pts), new THREE.LineBasicMaterial({ color: 0x2b2f31 }))); }
    this.cutDone = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.cutPath.map(([x, z]) => new THREE.Vector3(z - mk.length / 2, 0.0005, x - mk.width / 2))), new THREE.LineBasicMaterial({ color: 0x111111 }));
    this.cutStack.add(this.cutDone);
    const cum = [0]; for (let k = 1; k < this.cutPath.length; k++) cum.push(cum[k - 1] + Math.hypot(this.cutPath[k][0] - this.cutPath[k - 1][0], this.cutPath[k][1] - this.cutPath[k - 1][1]));
    this.cutCum = cum;
    // Kommissionier-Roboter
    this.kitRobots = [];
    for (let k = 0; k < sim.cfg.kitRobots; k++) {
      const r = robot6(1); r.position.set(-1.75, 0, k % 2 ? -0.95 : 0.95); r.rotation.y = 0; sc.add(r);
      const grip = new THREE.Group(); grip.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), m.aluDark));
      for (let i = 0; i < 6; i++) grip.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), m.blackSteel), -0.08 + (i % 3) * 0.08, -0.02, i < 3 ? -0.05 : 0.05));
      r.userData.tool.add(grip);
      const piece = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.002, 0.25), fabricMat); piece.position.y = -0.04; piece.visible = false; r.userData.tool.add(piece);
      r.userData.piece = piece;
      this.kitRobots.push(r);
    }
    sc.add(this._labelAt('Zuschnitt', 'Legen · Schneiden', -10, 2.3, 0.9));
    this.labelKit = this._labelAt('Kommissionierung', '', -2.6, 2.2, 0.9); sc.add(this.labelKit);
    this.labelSpread = this._labelAt('Legemaschine', '', -11.6 + 1.6, 1.9, -1.3); sc.add(this.labelSpread);
    this.labelCut = this._labelAt('CNC-Cutter', '', -7.9 + 1.5, 1.9, -1.3); sc.add(this.labelCut);
    sc.add(fence(13.5, 1.4, 'x').translateX(-7.5).translateZ(-1.5));

    // ---------------- Transfersystem mit Hubstationen
    const conv = conveyor(L + 1.2, H); conv.position.x = -1.2; sc.add(conv);
    for (const x of [-1.25, L + 0.05]) {
      const lift = new THREE.Group();
      lift.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.1, H + 0.2, 0.75), m.paintGrey), x < 0 ? -0.06 : 0.06, (H + 0.2) / 2, 0));
      lift.position.x = x; sc.add(lift);
    }

    // ---------------- Stationen
    this.stationViews = sim.stations.map((st, i) => this._buildStation(st, i));

    // ---------------- Werkstückträger und Kleidungsstücke
    this.kit = new GarmentKit(sim.G, '#e9c46a');
    this.carrierViews = sim.carriers.map(() => {
      const g = carrier(); sc.add(g);
      return { g, stage: null, garment: null };
    });
    // Lager fertiger Ware
    const pal = pallet(); pal.position.set(L + 1.6, 0, 0); sc.add(pal);
    this.boxes = new THREE.Group(); this.boxes.position.set(L + 1.6, 0.15, 0); sc.add(this.boxes);
    this.lastBoxes = 0;
    this.setPreset('gesamt');
  }

  _labelAt(t, s, x, y, z) { const l = label(t, s); l.position.set(x, y, z); return l; }

  _buildStation(st, i) {
    const sc = this.scene, m = mats();
    const g = new THREE.Group(); g.position.x = st.s; sc.add(g);
    const view = { st, g, slots: [] };
    const sewing = ['overlock', 'steppstich', 'cover'].includes(st.machine);
    for (let k = 0; k < st.cap; k++) {
      const dx = k * 1.45;
      const slot = new THREE.Group(); slot.position.x = dx; g.add(slot);
      // Querumsetzer (Nebenschluss) mit Gurt
      slot.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.95), m.aluDark), 0.35, H - 0.04, SPUR_Z / 2 - 0.05));
      for (const sx of [0.05, 0.65]) slot.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.95), m.belt), sx, H - 0.017, SPUR_Z / 2 - 0.05));
      for (const sx of [0.08, 0.62]) for (const sz of [-0.15, -0.95]) slot.add(profile(H - 0.06, 'y', sx, (H - 0.06) / 2, sz, m.aluDark));
      // Roboter auf Sockel
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.25, 0.42), m.paintDark); ped.position.set(0.35, 0.125, ROBOT_Z); ped.castShadow = true; slot.add(ped);
      const rob = robot6(1); rob.position.set(0.35, 0.25, ROBOT_Z); slot.add(rob);
      const tool = new THREE.Group();
      tool.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.018, 0.24), m.aluDark));
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) tool.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.025, 10), m.rubber), -0.1 + a * 0.1, -0.02, -0.07 + b * 0.14));
      rob.userData.tool.add(tool);
      // Maschine / Ausrüstung
      let mach = null, table = null;
      if (sewing) {
        table = sewingTable(1.2, 0.6, 0.76, st.machine === 'cover' ? 3 : st.machine === 'overlock' ? 4 : 2, 0xd9c79a);
        table.position.set(0.35, 0, MACH_Z); slot.add(table);
        mach = sewingMachine(st.machine, 0xd9c79a);
        mach.position.set(0.35 + 0.05, 0.76, MACH_Z + 0.05); mach.rotation.y = 0; slot.add(mach);
        if (st.id.startsWith('aermel')) {
          // Ärmelzuführung: Dreh-Schiebeeinheit mit Vakuumplatte, Trennblech, Kantensensor
          const feeder = new THREE.Group();
          feeder.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08), m.alu), 0, 0.2, 0));
          feeder.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 20), m.paintDark), 0, 0.14, 0));
          const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), m.kapton); plate.position.y = 0.09; feeder.add(plate);
          feeder.position.set(0.1, 0.76, MACH_Z + 0.18); slot.add(feeder);
          view.feeder = { g: feeder, plate };
        }
      } else {
        const ctor = { falttisch: () => foldTable(1.0, 0.8, 0.85), wender: () => turner(0.85), pruefung: () => visionTunnel(0.9, 0.9, 0.85), presse: () => pressFolder(0.85), verpackung: () => bagger(0.85) }[st.machine];
        mach = ctor(); mach.position.set(0.35, 0, MACH_Z + 0.05); slot.add(mach);
        if (st.machine === 'pruefung') { const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), m.belt); t2.position.set(0.35, 0.85, MACH_Z + 0.05); slot.add(t2); }
      }
      // Schutzzaun, Lichtvorhang, Schaltschrank, Signalsäule
      slot.add(fence(1.35, 1.4, 'x').translateX(0.35).translateZ(MACH_Z - 0.55));
      const cab = cabinet(0.5, 1.6, 0.35); cab.position.set(-0.32, 0, MACH_Z - 0.2); cab.rotation.y = Math.PI / 2; slot.add(cab);
      const tower = signalTower(); tower.position.set(0.9, 1.6, MACH_Z - 0.4); slot.add(tower);
      slot.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.6, 0.03), m.safetyYellow), 0.95, 0.8, MACH_Z - 0.4));
      view.slots.push({ slot, rob, mach, table, tower, tool });
    }
    const lab = label(st.name, `${st.ct.toFixed(1)} s · ${st.cap}×`);
    lab.position.set(0.35 + (st.cap - 1) * 0.7, 2.25, MACH_Z + 0.2); g.add(lab);
    view.label = lab;
    return view;
  }

  setPreset(name) {
    this.follow = null;
    const L = this.sim.mainLen;
    const st = this.sim.stations.find((s) => s.id === name);
    const k = Math.max(1, 1.5 / Math.max(0.4, this.camera.aspect || 1.6)); // schmale Ansicht: weiter zurück
    let pos, tgt;
    if (name === 'gesamt') {
      const a = this.camera.aspect || 1.6;
      if (a >= 1.5) { // breite Ansicht: ganze Linie von vorne oben einpassen
        const W = L + 16, hf = Math.atan(Math.tan((21 * Math.PI) / 180) * a), d = (W / 2 / Math.tan(hf)) * 1.02;
        pos = [L / 2 - 7, d * 0.72, d * 0.69]; tgt = [L / 2 - 7, 0, -1.2];
      } else { pos = [-19, 15, 13]; tgt = [L * 0.33, 0, -1.6]; } // schmal: schräg entlang der Linie
    }
    else if (name === 'zuschnitt') { pos = [-8.4, 4.2 * k, 7 * k]; tgt = [-8.4, 0.5, -0.5]; }
    else if (name === 'kommission') { pos = [-0.6, 2.3 * k, 2.6 * k]; tgt = [-2.4, 0.85, -0.1]; }
    else if (name === 'follow') { this.follow = this.sim.carriers.find((c) => c.shirt !== null && c.track === 'main') || this.sim.carriers.find((c) => c.shirt !== null) || null; return; }
    else if (st) { const x = st.s + 0.35 + (st.cap - 1) * 0.72; pos = [x + 1.7 * k, 2.1 * k, 0.3 * k]; tgt = [x - 0.1, 0.85, -1.85]; }
    else return;
    this.camera.position.set(...pos); this.controls.target.set(...tgt); this.controls.update();
  }

  // Lage des Trägers in der Welt
  _carrierPose(c) {
    if (c.track === 'main') return { x: c.s, y: H + 0.004, z: 0 };
    if (c.track === 'station') { const sv = this.stationViews[this.sim.stations.indexOf(c.station)]; return { x: c.station.s + c.slot * 1.45 + 0.35, y: H + 0.004, z: SPUR_Z, sv }; }
    if (c.track === 'ret') return { x: c.s, y: 0.39, z: 0 };
    if (c.track === 'lift') return { x: this.sim.mainLen + 0.4, y: 0.39 + (H - 0.39) * Math.max(0, 1 - this.sim.lifts.end.t / 4), z: 0 };
    if (c.track === 'liftS') return { x: -1.0, y: 0.39 + (H - 0.39) * Math.min(1, this.sim.lifts.start.t / 4), z: 0 };
    if (c.track === 'load') return { x: -0.9, y: H + 0.004, z: 0 };
    return { x: 0, y: H, z: 0 };
  }

  _garment(cv, stage) {
    if (cv.stage === stage) return cv.garment;
    if (cv.garment) cv.g.remove(cv.garment.root), this.scene.remove(cv.garment.root);
    cv.garment = stage >= 0 ? this.kit.build(stage) : null;
    cv.stage = stage;
    return cv.garment;
  }

  update(sim, t) {
    if (!this.visible) return;
    const m = mats();
    // Vorstufe
    const sp = sim.spreader, cu = sim.cutter, mk = sim.marker, th = 0.00055;
    const spX0 = -11.6 + 0.4;
    const layers = sp.state === 'legen' ? sp.layer + sp.x : sp.state === 'fertig' || (sp.state === 'uebergabe' && cu.state === 'einziehen') ? sim.cfg.layers : 0;
    this.spreadStack.visible = layers > 0;
    this.spreadStack.scale.y = Math.max(1e-4, layers * th);
    this.spreadStack.position.set(spX0 + mk.length / 2, H + (layers * th) / 2, 0);
    const car = this.spreader.userData.carriage;
    const prog = sp.state === 'legen' ? ((sp.layer % 2 ? 1 - sp.x : sp.x)) : 0;
    car.position.x = 0.4 + prog * mk.length;
    this.spreader.userData.roll.scale.set(1, 1, 1);
    // Cutter-Stapel
    const onCut = cu.state === 'einziehen' || cu.state === 'schneiden' || cu.state === 'abgabe';
    this.cutStack.visible = onCut;
    const cutX = -7.9 + 0.3 + mk.length / 2;
    const ch = sim.cfg.layers * th;
    this.cutStackBox.scale.y = ch; this.cutStackBox.position.y = ch / 2;
    this.cutStack.position.set(cu.state === 'einziehen' ? cutX - 3.4 * (1 - Math.min(1, cu.t / 15)) : cu.state === 'abgabe' ? cutX + 3.6 * Math.min(1, cu.t / 12) : cutX, H, 0);
    this.cutStack.children.forEach((o) => { if (o.isLine) o.position.y = ch + 0.0005; });
    const cp = cu.state === 'schneiden' ? cu.progress : cu.state === 'abgabe' ? 1 : 0;
    const sCut = cp * this.cutCum[this.cutCum.length - 1];
    let k = 1; while (k < this.cutCum.length - 1 && this.cutCum[k] < sCut) k++;
    this.cutDone.geometry.setDrawRange(0, cp > 0 ? k + 1 : 0);
    const P = this.cutPath[Math.min(k, this.cutPath.length - 1)];
    const gan = this.cutterM.userData.gantry, head = this.cutterM.userData.head;
    gan.position.x = 0.3 + P[1] + (cu.state === 'schneiden' ? 0 : 0);
    head.position.z = P[0] - mk.width / 2;
    this.cutterM.userData.knife.position.y = 0.03 + (cu.state === 'schneiden' ? 0.004 * Math.sin(t * 120) : 0.03);
    // Abnahmetisch: Reststapel
    const perLayer = sim.cfg.shirtsPerMarker;
    const remLayers = Math.ceil(sim.cutStacks / perLayer);
    this.takeStack.visible = sim.cutStacks > 0;
    const th2 = Math.max(1e-4, remLayers * th);
    this.takeStackBox.scale.y = th2; this.takeStackBox.position.y = th2 / 2;
    this.takeStack.children.forEach((o) => { if (o.isLine) o.position.y = th2 + 0.0005; });
    this.takeStack.position.set(-4.4 + 0.9, H, 0);
    // Kommissionier-Roboter: zwischen Stapel und Beladeplatz
    const L = sim.loadSlot;
    this.kitRobots.forEach((r, i) => {
      const busy = L.carrier && L.T > 0;
      const f = busy ? ((L.t / L.T) * 5 + i * 0.5) % 1 : 0.5;
      const from = new THREE.Vector3(-3.5 - 0.15 * Math.sin(i + Math.floor(L.t)), H + th2 + 0.02, (i % 2 ? -0.3 : 0.3));
      const to = new THREE.Vector3(-0.9 + (i % 2 ? 0.12 : -0.12), H + 0.05, (i % 2 ? -0.1 : 0.1));
      const a = f < 0.5 ? f * 2 : 2 - f * 2;
      const p = from.clone().lerp(to, 0.5 - 0.5 * Math.cos(Math.PI * a)); p.y += Math.sin(Math.PI * a) * 0.25;
      r.userData.reach(r.worldToLocal(p.clone()), 0);
      r.userData.piece.visible = busy && f < 0.5;
    });
    this.labelKit.userData.update('Kommissionierung', `${sim.cutStacks} Shirts im Stapel`);
    this.labelSpread.userData.update('Legemaschine', sp.state === 'legen' ? `Lage ${sp.layer + 1}/${sim.cfg.layers}` : 'wartet auf Cutter');
    this.labelCut.userData.update('CNC-Cutter', cu.state === 'schneiden' ? `${Math.round(cu.progress * 100)} % geschnitten` : cu.state === 'leer' ? 'bereit' : cu.state);

    // Träger und Kleidungsstücke
    sim.carriers.forEach((c, i) => {
      const cv = this.carrierViews[i], pose = this._carrierPose(c);
      cv.g.position.set(pose.x, pose.y, pose.z);
      let stage = c.shirt !== null ? c.stage : -1;
      if (c.track === 'load' && sim.loadSlot.T > 0 && sim.loadSlot.t >= sim.loadSlot.T * 0.5) stage = 0;
      if (c.track === 'load' && sim.loadSlot.T === 0) stage = -1;
      let slotPhase = null, slotF = 0, st = null, slot = null;
      if (c.track === 'station') {
        st = c.station; slot = st.slots[c.slot];
        slotF = slot.T > 0 ? Math.min(1, slot.t / slot.T) : 1;
        slotPhase = slot.phase;
        if (slotF >= 0.85) stage = st.stage;
      }
      const gm = this._garment(cv, stage);
      if (!gm) return;
      if (!gm.root.parent) this.scene.add(gm.root);
      const rotOnCarrier = stage >= 1 && stage <= 6 ? Math.PI / 2 : 0;
      const carrierWorld = new THREE.Vector3(pose.x, pose.y + 0.03, pose.z + (stage >= 7 && stage <= 11 ? 0.12 : stage >= 12 ? 0.1 : 0));
      if (!st) { gm.root.position.copy(carrierWorld); gm.root.rotation.set(0, rotOnCarrier, 0); return; }
      this._stationAnim(st, c.slot, slotF, gm, carrierWorld, rotOnCarrier, stage, t);
    });
    // Stationen: Maschinen, Roboter, Signalsäulen, Beschriftung
    this.stationViews.forEach((sv) => {
      const st = sv.st;
      sv.slots.forEach((v, k) => {
        const sl = st.slots[k];
        const state = sl.repair > 0 ? 'fault' : sl.carrier ? (sl.t < sl.T ? 'busy' : 'wait') : 'idle';
        v.tower.userData.set(state === 'idle' ? 'wait' : state);
        const sewingNow = sl.carrier && sl.phase === 'bearbeiten' && sl.repair <= 0;
        if (v.mach?.userData.update) v.mach.userData.update(t, sewingNow, 3000);
        if (!sl.carrier) v.rob.userData.reach(new THREE.Vector3(0.0, 0.55, 0.5), 0);
        // Sonderanimationen
        const f = sl.T > 0 ? Math.min(1, sl.t / sl.T) : 0;
        const mid = sl.carrier ? Math.max(0, Math.min(1, (f - 0.22) / 0.63)) : 0;
        if (st.machine === 'falttisch' && v.mach.userData.flap) v.mach.userData.flap.rotation.x = -Math.PI * Math.sin(Math.PI * Math.min(1, mid * 1.2)) * (mid < 0.83 ? 1 : 0.0);
        if (st.machine === 'presse') { const cl = sl.carrier ? Math.max(0, Math.min(1, mid / 0.12, (1 - mid) / 0.12)) : 0; v.mach.userData.lid.rotation.x = -0.9 * (1 - (0.5 - 0.5 * Math.cos(Math.PI * cl))); }
        if (st.machine === 'verpackung') v.mach.userData.bar.position.y = 0.85 + 0.25 - 0.18 * Math.sin(Math.PI * mid);
      });
      const busy = st.slots.filter((s) => s.carrier).length;
      sv.label.userData.update(st.name, `${st.ct.toFixed(1)} s · ${st.count} Stk · ${busy}/${st.cap}`);
      sv.label.visible = this.showLabels;
    });
    // fertige Kartons auf der Palette
    const boxesN = Math.floor(sim.done / 12);
    if (boxesN !== this.lastBoxes) {
      while (this.boxes.children.length) this.boxes.remove(this.boxes.children[0]);
      for (let b = 0; b < Math.min(boxesN, 48); b++) {
        const bx = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.28), m.carton);
        bx.position.set(-0.4 + (b % 3) * 0.4, 0.13 + Math.floor(b / 12) * 0.27, -0.29 + (Math.floor(b / 3) % 4) * 0.29);
        bx.castShadow = true; this.boxes.add(bx);
      }
      this.lastBoxes = boxesN;
    }
    // Kamera folgt einem Träger
    if (this.follow) {
      const p = this._carrierPose(this.follow);
      const tgt = new THREE.Vector3(p.x, p.y, p.z);
      this.controls.target.lerp(tgt, 0.1);
      this.camera.position.lerp(new THREE.Vector3(p.x + 0.8, p.y + 1.6, p.z + 2.2), 0.05);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Bewegung des Kleidungsstücks und des Roboters in einer Station
  _stationAnim(st, slotIdx, f, gm, carrierWorld, rotOnCarrier, stage, t) {
    const sv = this.stationViews[this.sim.stations.indexOf(st)], v = sv.slots[slotIdx];
    const sewing = v.mach?.userData.needle && v.table;
    // Arbeitsposition an der Maschine
    let work = { p: new THREE.Vector3(st.s + slotIdx * 1.45 + 0.35, 0.86, MACH_Z + 0.05), yaw: 0 };
    let seamPose = null;
    const path = this.kit.paths[st.id];
    if (sewing && path) {
      const needle = v.mach.localToWorld(v.mach.userData.needle.clone());
      const sPhase = Math.max(0, Math.min(1, (f - 0.22) / 0.63));
      const pa = pathAt(path, sPhase * path.length);
      // Nahttangente (noch zu nähen) zeigt nach +z der Maschine → Teil wandert nach −z (Transportrichtung)
      const yaw = -Math.atan2(pa.t[0], pa.t[1]);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const wx = pa.p[0] * c + pa.p[1] * s, wz = -pa.p[0] * s + pa.p[1] * c;
      seamPose = { p: new THREE.Vector3(needle.x - wx, needle.y + 0.001, needle.z - wz), yaw };
      const p0 = pathAt(path, 0), y0 = -Math.atan2(p0.t[0], p0.t[1]);
      const c0 = Math.cos(y0), s0 = Math.sin(y0);
      work = { p: new THREE.Vector3(needle.x - (p0.p[0] * c0 + p0.p[1] * s0), needle.y + 0.001, needle.z - (-p0.p[0] * s0 + p0.p[1] * c0)), yaw: y0 };
    }
    const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
    let pos, yaw;
    const lerpYaw = (a, b, u) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * u; };
    if (f < 0.22) {
      const u = ease(f / 0.22);
      pos = carrierWorld.clone().lerp(work.p, u); pos.y += Math.sin(Math.PI * u) * 0.35; yaw = lerpYaw(rotOnCarrier, work.yaw, u);
    } else if (f < 0.85) {
      if (seamPose) { pos = seamPose.p; yaw = seamPose.yaw; }
      else { pos = work.p.clone(); yaw = work.yaw; if (st.machine === 'wender') { const u = (f - 0.22) / 0.63; pos.y += 0.9 * Math.sin(Math.PI * u); } }
    } else {
      const u = ease((f - 0.85) / 0.15);
      const from = seamPose ? seamPose.p : work.p;
      pos = from.clone().lerp(carrierWorld, u); pos.y += Math.sin(Math.PI * u) * 0.35; yaw = lerpYaw(seamPose ? seamPose.yaw : work.yaw, rotOnCarrier, u);
    }
    gm.root.position.copy(pos); gm.root.rotation.set(0, yaw, 0);
    // Falten: Vorderseite klappt über die Schulterlinie
    if (gm.front && st.machine === 'falttisch') {
      const u = Math.max(0, Math.min(1, (f - 0.3) / 0.45));
      gm.front.rotation.x = f >= 0.85 ? Math.PI : Math.PI * ease(u); gm.front.position.y = 0.004 * ease(u);
    }
    // Roboter greift das Teil (Werkzeug über dem Greifpunkt), außer während reiner Maschinenarbeit
    const grip = (gm.grip || new THREE.Vector3()).clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(pos);
    grip.y += 0.06;
    const rob = v.rob;
    const local = rob.worldToLocal(grip.clone());
    const holdDuringWork = sewing || st.machine === 'falttisch';
    if (f < 0.22 || f >= 0.85 || holdDuringWork) rob.userData.reach(local, yaw);
    else rob.userData.reach(new THREE.Vector3(0.1, 0.6, 0.45), 0);
  }
}
