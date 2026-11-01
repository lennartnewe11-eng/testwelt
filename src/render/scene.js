// 3D-Darstellung der Nähzelle mit Three.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { fabricTexture, gridTexture } from './textures.js';
import { SOLIDS } from '../physics/materials.js';
import { NEEDLE, TABLE_TOP } from '../physics/world.js';
import { locateRest } from '../physics/cloth.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mats, profile, fence, cabinet, signalTower } from './models.js';

const VIEWS = {
  gesamt: { pos: [1.55, 2.0, 2.6], target: [0.05, 0.78, -0.05] },
  stapel: { pos: [-0.25, 1.3, 0.85], target: [-0.5, 0.8, 0.05] },
  naehen: { pos: [0.3, 1.15, 0.55], target: [0.55, 0.8, -0.08] },
  oben: { pos: [0.02, 2.6, 0.06], target: [0.02, 0.8, 0.05] },
};

export class SceneView {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Umgebungslicht für realistische Reflexe auf Metall und Satin
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.03, 30); // near nicht zu klein: Tiefenauflösung für dünne Lagen
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.setView('gesamt');

    this.scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x3a3d3c, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1.6, 3.2, 1.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera; sc.left = -1.9; sc.right = 1.9; sc.top = 1.6; sc.bottom = -1.6; sc.near = 0.5; sc.far = 7;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.002;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.6);
    fill.position.set(-2, 1.5, -1);
    this.scene.add(fill);

    this.static = new THREE.Group();
    this.dynamic = new THREE.Group();
    this.scene.add(this.static, this.dynamic);
    this.colorMode = 'material';
    this.showContacts = false;
    this._buildHall();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setTheme(dark) {
    const bg = dark ? 0x161a19 : 0xe4e8e6;
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.Fog(bg, 6, 14);
  }

  setView(name) {
    this.viewName = name;
    const v = VIEWS[name] || VIEWS.gesamt;
    // schmale Ansichten: Kamera entsprechend zurücknehmen
    const k = Math.max(1, 1.45 / Math.max(0.3, this.camera.aspect || 1.6));
    const d = v.pos.map((x, i) => v.target[i] + (x - v.target[i]) * k);
    this.camera.position.set(...d);
    this.controls.target.set(...v.target);
    this.controls.update();
  }

  resize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    const prev = this.camera.aspect;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.viewName && Math.abs(prev - this.camera.aspect) > 0.05) this.setView(this.viewName);
  }

  _mat(color, rough = 0.6, metal = 0.0) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }

  _box(w, h, d, mat, x, y, z, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = true;
    return m;
  }

  _buildHall() {
    const floorTex = gridTexture();
    floorTex.repeat.set(12, 12);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // Sicherheitsmarkierung um die Zelle
    const tape = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.6, 4, 1), new THREE.MeshBasicMaterial({ color: 0xd9a400 }));
    tape.rotation.x = -Math.PI / 2; tape.rotation.z = Math.PI / 4; tape.position.y = 0.001;
    tape.scale.set(1.15, 0.75, 1);
    this.scene.add(tape);
  }

  // Szene für eine (neue) Welt aufbauen
  // Detailgeometrie der Zelle (rein visuell, ohne Einfluss auf die Physik)
  _cellDetails(world) {
    const M = mats(), S = this.static, T = TABLE_TOP;
    const [nx, ny, nz] = NEEDLE;
    const add = (o) => { S.add(o); return o; };
    const bx = (w, h, d, mat, x, y, z) => add(this._box(w, h, d, mat, x, y, z));
    const cy = (r, h, mat, x, y, z, axis = 'y', seg = 24) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
      if (axis === 'x') o.rotation.z = Math.PI / 2; else if (axis === 'z') o.rotation.x = Math.PI / 2;
      o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return add(o);
    };
    // Tischgestelle aus Aluprofil 40×40 mit Stellfüßen, Zarge und Ablageboden
    for (const [cx, cz, hx, hz] of [[-0.5, 0.05, 0.35, 0.3], [0.55, -0.05, 0.45, 0.4]]) {
      const lh = T - 0.04 - 0.03;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = cx + sx * (hx - 0.05), z = cz + sz * (hz - 0.05);
        add(profile(lh, 'y', x, 0.03 + lh / 2, z));
        cy(0.025, 0.012, M.rubber, x, 0.006, z); cy(0.006, 0.03, M.steel, x, 0.022, z);
      }
      for (const sz of [-1, 1]) { add(profile(hx * 2 - 0.1, 'x', cx, T - 0.06, cz + sz * (hz - 0.05))); add(profile(hx * 2 - 0.1, 'x', cx, 0.16, cz + sz * (hz - 0.05))); }
      for (const sx of [-1, 1]) { add(profile(hz * 2 - 0.14, 'z', cx + sx * (hx - 0.05), T - 0.06, cz)); add(profile(hz * 2 - 0.14, 'z', cx + sx * (hx - 0.05), 0.16, cz)); }
      bx(hx * 2 - 0.12, 0.012, hz * 2 - 0.12, M.hpl, cx, 0.186, cz);
    }
    // Vakuumtisch: Saugbohrungen im Raster 25 mm (dunkle Punkte) um die Stichplatte
    const holeGeo = new THREE.CircleGeometry(0.0016, 10), holeMat = new THREE.MeshBasicMaterial({ color: 0x1a1d1c });
    const holes = new THREE.InstancedMesh(holeGeo, holeMat, 900); let hn = 0;
    const dm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), one = new THREE.Vector3(1, 1, 1);
    for (let x = 0.15; x <= 0.96 && hn < 900; x += 0.025) for (let z = -0.42; z <= 0.32 && hn < 900; z += 0.025) {
      if (Math.abs(z - nz) < 0.085 && x > nx - 0.06 && x < nx + 0.32) continue; // Stichplatte
      if (x > nx + 0.25 && Math.abs(z - nz) < 0.08) continue;
      dm.compose(new THREE.Vector3(x, T + 0.0002, z), q, one); holes.setMatrixAt(hn++, dm);
    }
    holes.count = hn; add(holes);
    // Stichplatte: Transporteur-Schlitze, Greiferschieber, Stichplattenschrauben
    const slot = new THREE.MeshBasicMaterial({ color: 0x0e0f10 });
    for (const dx of [-0.007, -0.0025, 0.0025, 0.007]) { const o = new THREE.Mesh(new THREE.PlaneGeometry(0.0016, 0.024), slot); o.rotation.x = -Math.PI / 2; o.position.set(nx + dx, T + 0.0004, nz + (Math.abs(dx) < 0.003 ? 0.006 : 0)); add(o); }
    bx(0.07, 0.0008, 0.07, M.alu, nx + 0.075, T + 0.0004, nz);
    for (const [dx, dz] of [[-0.03, -0.04], [-0.03, 0.04], [0.03, 0.045]]) cy(0.003, 0.001, M.blackSteel, nx + dx, T + 0.0005, nz + dz);
    // Nähkopf: Kopfdeckel, Fadenhebel, Spannung, Fadenführungen, Nählicht
    const fz = nz + 0.05;
    bx(0.085, 0.13, 0.004, M.steel, nx + 0.02, T + 0.2, fz + 0.002);
    this.takeup = bx(0.008, 0.045, 0.006, M.chrome, nx + 0.045, T + 0.25, fz + 0.007);
    cy(0.014, 0.008, M.chrome, nx + 0.11, T + 0.235, nz + 0.049, 'z'); cy(0.009, 0.012, M.chrome, nx + 0.11, T + 0.235, nz + 0.057, 'z'); cy(0.004, 0.03, M.blackSteel, nx + 0.11, T + 0.235, nz + 0.06, 'z');
    for (const x of [nx + 0.075, nx + 0.15]) cy(0.003, 0.012, M.chrome, x, T + 0.258, nz + 0.05, 'z');
    bx(0.035, 0.006, 0.022, M.lamp, nx + 0.035, T + 0.117, nz + 0.03);
    // Bedienfeld am Arm, Rückwärtstaste, Stichsteller am Ständer
    bx(0.07, 0.04, 0.004, M.plastic, nx + 0.24, T + 0.23, nz + 0.046); bx(0.05, 0.025, 0.002, M.screen, nx + 0.24, T + 0.232, nz + 0.049);
    bx(0.03, 0.012, 0.012, M.paintDark, nx + 0.295, T + 0.175, nz + 0.06);
    cy(0.018, 0.012, M.paintDark, nx + 0.33, T + 0.12, nz + 0.061, 'z'); bx(0.006, 0.03, 0.006, M.chrome, nx + 0.33, T + 0.13, nz + 0.068);
    // Direktantrieb (Servomotor) hinter dem Handrad, Steuerung unter dem Tisch
    cy(0.045, 0.055, M.blackSteel, nx + 0.44, T + 0.2, nz, 'x', 32); cy(0.02, 0.01, M.alu, nx + 0.472, T + 0.2, nz, 'x');
    bx(0.26, 0.12, 0.2, M.paintDark, nx + 0.15, T - 0.14, nz - 0.12); bx(0.06, 0.03, 0.002, M.screen, nx + 0.1, T - 0.13, nz - 0.019);
    // Garnständer mit zwei Konen und Fadenlauf zur Nadel
    const gx = nx + 0.33, gz = -0.4;
    add(profile(0.62, 'y', gx, T + 0.31, gz, M.steel));
    bx(0.26, 0.006, 0.12, M.paintDark, gx, T + 0.003, gz);
    bx(0.24, 0.01, 0.01, M.steel, gx, T + 0.6, gz);
    const coneMat = this._mat(0xe8e2d6, 0.85);
    for (const dx of [-0.08, 0.08]) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.15, 28), coneMat); cone.position.set(gx + dx, T + 0.084, gz); cone.castShadow = true; add(cone);
      cy(0.004, 0.18, M.steel, gx + dx, T + 0.09, gz);
      cy(0.006, 0.004, M.chrome, gx + dx, T + 0.6, gz + 0.006);
    }
    const thread = new THREE.BufferGeometry().setFromPoints([
      [gx - 0.08, T + 0.16, gz], [gx - 0.08, T + 0.6, gz + 0.006], [nx + 0.15, T + 0.27, nz + 0.05], [nx + 0.11, T + 0.235, nz + 0.062],
      [nx + 0.075, T + 0.258, nz + 0.056], [nx + 0.045, T + 0.27, fz + 0.01], [nx + 0.01, T + 0.16, fz + 0.004], [nx + 0.001, T + 0.06, nz + 0.004],
    ].map((a) => new THREE.Vector3(...a)));
    add(new THREE.Line(thread, new THREE.LineBasicMaterial({ color: 0xd8d0c0 })));
    // Schutzzaun (Rückseite und Seiten), Schaltschrank, Signalsäule
    const fb = fence(3.6, 1.6, 'x'); fb.position.set(0.1, 0, -1.25); add(fb);
    const fl = fence(2.2, 1.6, 'z'); fl.position.set(-1.7, 0, -0.15); add(fl);
    const fr = fence(2.2, 1.6, 'z'); fr.position.set(1.9, 0, -0.15); add(fr);
    const cab = cabinet(0.6, 1.8, 0.4); cab.position.set(1.35, 0, -1.5); add(cab);
    const tw = signalTower(); tw.position.set(1.15, 1.62, 0.6); add(tw); tw.userData.set?.('busy'); this.tower = tw;
    // Kabelkette am Portal
    for (let k = 0; k < 14; k++) bx(0.05, 0.03, 0.06, M.plastic, -0.95 + k * 0.07, 1.72, -0.58);
  }

  build(world) {
    this.world = world;
    for (const g of [this.static, this.dynamic]) {
      while (g.children.length) { const c = g.children.pop(); c.traverse?.((o) => { o.geometry?.dispose?.(); }); }
    }
    const steel = this._mat(0xaab1b8, 0.35, 0.8);
    const dark = this._mat(0x2b2f31, 0.5, 0.3);

    // Kollider-Körper (Tische, Maschine)
    for (const col of world.staticColliders) {
      if (!col.visual) continue;
      const s = SOLIDS[col.material];
      const color = col.color || (col.material === 'hpl' ? '#474d4b' : col.material === 'guss' ? '#5f6f68' : s.color);
      const mat = this._mat(color, col.material === 'stahl' ? 0.3 : 0.65, col.material === 'stahl' ? 0.7 : 0.05);
      // gerundete Kanten (Guss r = 12 mm, Tischplatte 3 mm); Abmessungen bleiben exakt die des Kolliders
      const r = col.material === 'guss' ? 0.012 : col.material === 'stahl' ? 0 : 0.003;
      const m = r > 0 ? new THREE.Mesh(new RoundedBoxGeometry(col.half[0] * 2, col.half[1] * 2, col.half[2] * 2, 3, r), mat) : this._box(col.half[0] * 2, col.half[1] * 2, col.half[2] * 2, mat, 0, 0, 0);
      m.position.set(...col.c); m.castShadow = m.receiveShadow = true;
      m.rotation.set(col.euler[1], col.euler[0], col.euler[2], 'YXZ');
      this.static.add(m);
    }
    this._cellDetails(world);
    // Nähmaschine: Handrad, Fadenrolle, Nadelstange, Nähfuß
    const [nx, ny, nz] = NEEDLE;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 40), this._mat(0x3b4442, 0.4, 0.4));
    wheel.rotation.z = Math.PI / 2; wheel.position.set(nx + 0.395, ny + 0.2, nz); wheel.castShadow = true;
    this.static.add(wheel);
    this.wheel = wheel;
    this.needleBar = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 12), steel);
    bar.position.y = 0.06;
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.035, 8), this._mat(0xe8ecef, 0.2, 1));
    needle.position.y = 0.0;
    this.needleBar.add(bar, needle);
    this.static.add(this.needleBar);
    this.footMesh = new THREE.Group();
    const foot = this._box(world.machine.half[0] * 2, 0.004, world.machine.half[1] * 2, steel, 0, 0.002, 0);
    const footBar = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 10), steel);
    footBar.position.set(0, 0.054, -0.005);
    this.footMesh.add(foot, footBar);
    this.static.add(this.footMesh);
    // Stichloch
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0025, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    hole.rotation.x = -Math.PI / 2; hole.position.set(nx, ny + 0.0003, nz);
    this.static.add(hole);

    // Portal
    const alu = this._mat(0xc4cacf, 0.45, 0.6), yellow = this._mat(0xd9a400, 0.5, 0.2);
    const H = 1.62;
    for (const z of [-0.5, 0.6]) {
      this.static.add(this._box(2.3, 0.08, 0.08, alu, 0.05, H, z));
      for (const x of [-1.05, 1.15]) this.static.add(this._box(0.08, H, 0.08, alu, x, H / 2, z));
    }
    this.bridge = this._box(0.1, 0.1, 1.2, yellow, 0, H + 0.08, 0.05);
    this.carriage = this._box(0.16, 0.14, 0.16, dark, 0, H + 0.02, 0);
    this.zAxis = this._box(0.06, 1, 0.06, alu, 0, 1, 0);
    this.static.add(this.bridge, this.carriage, this.zAxis);

    // Greiferkopf
    this.headGroup = new THREE.Group();
    const head = world.head;
    this.templateMesh = null;
    this.carrier = null; this.feederMesh = null; this.separator = null; this.sensor = null;
    const shapeMesh = (pts, mat, depth = 0.003) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      return new THREE.Mesh(geo, mat);
    };
    if (head.type === 'traeger' && head.template) {
      // Werkstückträger: dünnes Blech in Körperkontur mit Nahtschlitz, liegt unter dem Körper
      const m = shapeMesh(head.template.shape, new THREE.MeshStandardMaterial({ color: 0x8c969c, metalness: 0.7, roughness: 0.35, transparent: true, opacity: 0.85 }), 0.0005);
      m.receiveShadow = true;
      const g = new THREE.Group(); g.add(m);
      // Anfangslage: unter dem Körper auf dem Stapeltisch
      const bc = head.template.cloth, pz = bc.pose2D();
      let ru = 0, rv = 0, M = 0;
      for (let v = 0; v < bc.n; v++) { ru += bc.mass[v] * bc.rest[2 * v]; rv += bc.mass[v] * bc.rest[2 * v + 1]; M += bc.mass[v]; }
      const c = Math.cos(pz.theta), sn = Math.sin(pz.theta);
      const ox = pz.x - (ru / M * c + rv / M * sn), oz = pz.z - (-ru / M * sn + rv / M * c);
      g.position.set(ox, TABLE_TOP - 0.0003, oz); g.rotation.y = pz.theta;
      this.dynamic.add(g);
      this.carrier = g;
    }
    if (world.feeder) {
      const F = world.feeder, sl = world.garment.sleeve;
      this.feederMesh = shapeMesh(sl.outline, new THREE.MeshPhysicalMaterial({ color: 0xe0a33a, transparent: true, opacity: 0.3, roughness: 0.3, depthWrite: false }), 0.002);
      this.feederMesh.renderOrder = 6;
      this.feederMesh.visible = false;
      this.dynamic.add(this.feederMesh);
      const N = world.machine.needle;
      // Trennblech zwischen den Lagen vor dem Nähfuß
      const sep = this._box(0.25, 0.0004, 0.234, new THREE.MeshStandardMaterial({ color: 0xc9d1d6, metalness: 0.8, roughness: 0.25, transparent: true, opacity: 0.55 }), N[0] - 0.075, N[1] + 0.0012, N[2] + 0.133, false);
      sep.visible = false; this.dynamic.add(sep); this.separator = sep;
      // Kantensensor (Lichttaster) über der Ärmelkante
      const sen = new THREE.Group();
      sen.add(this._box(0.012, 0.02, 0.012, this._mat(0x2b2f31, 0.5, 0.2), 0, 0.04, 0));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.03, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      beam.position.y = 0.015; sen.add(beam);
      sen.position.set(N[0] + 0.01, N[1], N[2] + world.machine.edge.sensor);
      sen.visible = false; this.dynamic.add(sen); this.sensor = sen;
    }
    if (head.type === 'schablone' && head.template) {
      // Nähschablone: Acrylplatte in Teilekontur mit Nahtschlitz, Aufnahme in der Mitte
      const shape = new THREE.Shape(head.template.shape.map(([x, z]) => new THREE.Vector2(x, -z)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.003, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshPhysicalMaterial({ color: 0x9fd3e6, transparent: true, opacity: 0.38, roughness: 0.15, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
      this.templateMesh = new THREE.Mesh(geo, mat);
      this.templateMesh.position.y = 0.0004;
      this.templateMesh.renderOrder = 5;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0x2b7f99 }));
      this.templateMesh.add(edges);
      this.headGroup.add(this.templateMesh);
      this.headGroup.add(this._box(0.03, 0.04, 0.03, alu, 0, 0.022, 0), this._box(0.09, 0.02, 0.09, dark, 0, 0.052, 0));
    }
    // Rahmen aus Aluprofilen statt geschlossener Platte (Lage bleibt sichtbar)
    const rowsZ = [...new Set(head.elements.map((e) => +e.oz.toFixed(4)))];
    const colsX = [...new Set(head.elements.map((e) => +e.ox.toFixed(4)))];
    const flatTool = head.type === 'schablone' || head.type === 'traeger';
    if (head.type === 'traeger') this.headGroup.add(this._box(0.04, 0.03, 0.04, alu, 0, 0.015, 0), this._box(0.09, 0.02, 0.09, dark, 0, 0.04, 0));
    if (!flatTool) for (const z of rowsZ) this.headGroup.add(this._box(head.extent.x * 2, 0.012, 0.014, alu, 0, 0.036, z));
    if (!flatTool) for (const x of colsX) this.headGroup.add(this._box(0.014, 0.012, head.extent.z * 2, alu, x, 0.048, 0));
    if (!flatTool) this.headGroup.add(this._box(0.09, 0.02, 0.09, dark, 0, 0.062, 0));
    this.elementMeshes = [];
    const accent = new THREE.Color(0x0b8f88);
    for (const el of flatTool ? [] : head.elements) {
      const g = new THREE.Group();
      let body, face;
      const r = el.half;
      if (head.type === 'vakuum' || head.type === 'kryo') {
        body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.026, 20), steel);
        body.position.y = 0.017;
        face = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 0.005, 28), this._mat(head.type === 'kryo' ? 0x9fd3e6 : 0x1b1d1f, 0.8));
        face.position.y = 0.0025;
      } else {
        body = this._box(r * 1.6, 0.024, r * 1.6, steel, 0, 0.018, 0);
        face = this._box(r * 2, 0.005, r * 2, this._mat(head.type === 'ea' ? 0xc8822a : 0x2b2f31, 0.6, 0.1), 0, 0.0025, 0);
      }
      const glow = new THREE.Mesh(new THREE.TorusGeometry(Math.max(r, 0.008) * 1.08, 0.0012, 6, 32), new THREE.MeshBasicMaterial({ color: accent }));
      glow.rotation.x = Math.PI / 2; glow.position.y = 0.006; glow.visible = false;
      body.castShadow = face.castShadow = true;
      g.add(body, face, glow);
      g.position.set(el.ox, 0, el.oz);
      this.headGroup.add(g);
      this.elementMeshes.push({ g, glow, face });
    }
    this.dynamic.add(this.headGroup);

    // Stofflagen
    this.clothMeshes = world.cloths.map((c) => this._clothMesh(c));
    for (const m of this.clothMeshes) this.dynamic.add(m.mesh);

    // Naht
    this.seamGeom = new THREE.BufferGeometry();
    this.seamGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 4000), 3));
    this.seam = new THREE.LineSegments(this.seamGeom, new THREE.LineBasicMaterial({ color: 0xc0262d }));
    this.seam.frustumCulled = false;
    this.dynamic.add(this.seam);
    // Einstichpunkte zusätzlich als Punkte (Linien sind in WebGL nur 1 px breit)
    this.stitchPts = new THREE.Points(this.seamGeom, new THREE.PointsMaterial({ color: 0xc0262d, size: 0.0028, sizeAttenuation: true }));
    this.stitchPts.frustumCulled = false;
    this.dynamic.add(this.stitchPts);

    // Soll-Nahtlinie auf der obersten Lage (in Materialkoordinaten verankert)
    this.planned = null;
    const tplPath = head.template?.path;
    const topCloth = world.cloths.find((c) => c.stackIndex === 1);
    if (tplPath && topCloth) {
      const anchors = tplPath.points.map(([u, v]) => locateRest(topCloth, u, v)).filter(Boolean);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * anchors.length), 3));
      const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x14a37f, dashSize: 0.006, gapSize: 0.004 }));
      line.frustumCulled = false;
      this.dynamic.add(line);
      this.planned = { line, g, anchors, cloth: topCloth };
    }

    // Kontaktpunkte (Greiferbindungen)
    this.attGeom = new THREE.BufferGeometry();
    this.attGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 4000), 3));
    this.attPts = new THREE.Points(this.attGeom, new THREE.PointsMaterial({ color: 0xff3b6b, size: 0.006, depthTest: false }));
    this.attPts.frustumCulled = false;
    this.attPts.renderOrder = 10;
    this.dynamic.add(this.attPts);
  }

  _clothMesh(c) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(3 * c.n), uv = new Float32Array(2 * c.n), col = new Float32Array(3 * c.n);
    const texScale = 1 / 0.02; // 2 cm je Texturkachel -> Bindung sichtbar
    for (let v = 0; v < c.n; v++) { uv[2 * v] = (c.rest[2 * v] * texScale) / 4; uv[2 * v + 1] = (c.rest[2 * v + 1] * texScale) / 4; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(c.tri), 1));
    // benachbarte Lagen leicht unterschiedlich hell, damit Kanten im Stapel erkennbar sind
    const tint = '#' + new THREE.Color(c.tint).offsetHSL(0, 0, (c.stackIndex % 2 ? 0.04 : -0.04)).getHexString();
    const map = fabricTexture(c.fabric.pattern, tint);
    const mat = c.fabric.pattern === 'satin'
      ? new THREE.MeshPhysicalMaterial({ map, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.3, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ map, roughness: c.fabric.pattern === 'leather' ? 0.55 : 0.9, side: THREE.DoubleSide });
    mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return { mesh, geo, mat, map, cloth: c, strain: new Float64Array(c.n) };
  }

  setColorMode(mode) {
    this.colorMode = mode;
    for (const m of this.clothMeshes || []) {
      const vc = mode !== 'material';
      m.mat.vertexColors = vc;
      m.mat.map = vc ? null : m.map;
      m.mat.color.set(0xffffff);
      m.mat.needsUpdate = true;
    }
  }

  update(world) {
    const head = world.head, rp = head.pose;
    // Portal folgt dem Roboter
    this.bridge.position.x = rp.x;
    this.carriage.position.set(rp.x, 1.64, rp.z);
    const zTop = 1.6, zBot = rp.y + 0.046;
    this.zAxis.position.set(rp.x, (zTop + zBot) / 2, rp.z);
    this.zAxis.scale.y = Math.max(0.01, zTop - zBot);
    this.headGroup.position.set(rp.x, rp.y, rp.z);
    this.headGroup.rotation.y = rp.yaw;
    if (this.carrier) {
      // Träger folgt dem Kopf, solange angekoppelt; sonst bleibt er liegen
      const m = head.elements[0].att.length ? head.partMap?.() : null;
      if (m) {
        const [rx, rz] = [m.tx * Math.cos(rp.yaw) + m.tz * Math.sin(rp.yaw), -m.tx * Math.sin(rp.yaw) + m.tz * Math.cos(rp.yaw)];
        this.carrier.position.set(rp.x + rx, rp.y - 0.0006, rp.z + rz);
        this.carrier.rotation.y = rp.yaw + m.theta;
      }
    }
    if (this.feederMesh) {
      const F = world.feeder, on = F.on && F.frame;
      this.feederMesh.visible = !!on;
      if (on) { this.feederMesh.position.set(F.frame.tx, TABLE_TOP + 0.004, F.frame.tz); this.feederMesh.rotation.y = F.frame.theta; }
      const active = (world.machine.edge?.on || F.on) && !world.machine.footUp;
      this.separator.visible = active; this.sensor.visible = active;
    }
    if (this.templateMesh) {
      const m = head.partMap?.();
      if (m) { this.templateMesh.position.set(m.tx, 0.0004, m.tz); this.templateMesh.rotation.y = m.theta; }
      this.templateMesh.material.opacity = head.elements[0].act > 0.5 ? 0.45 : 0.25;
    }
    if (this.planned) {
      const { g, anchors, cloth } = this.planned, P = cloth.pos, T = cloth.tri, a = g.attributes.position.array;
      anchors.forEach((h, k) => {
        const i0 = 3 * T[3 * h.tri], i1 = 3 * T[3 * h.tri + 1], i2 = 3 * T[3 * h.tri + 2];
        for (let q = 0; q < 3; q++) a[3 * k + q] = h.b0 * P[i0 + q] + h.b1 * P[i1 + q] + h.b2 * P[i2 + q] + (q === 1 ? cloth.radius + 3e-4 : 0);
      });
      g.attributes.position.needsUpdate = true;
      this.planned.line.computeLineDistances();
    }
    head.elements.forEach((el, i) => {
      const em = this.elementMeshes[i];
      if (!em) return;
      em.glow.visible = el.act > 0.05;
      em.glow.material.color.setHSL(0.48, 0.85, 0.25 + 0.3 * el.act);
      em.glow.material.color.set(el.att.length ? 0x0fb8a9 : 0x0b6e69);
    });
    // Nähmaschine
    const m = world.machine, [nx, ny, nz] = m.needle;
    this.needleBar.position.set(nx, ny + 0.012 + 0.016 * (1 - m.needleDepth) - 0.006, nz);
    const footY = m.footUp ? ny + m.footLift : m.footY;
    this.footMesh.position.set(nx, footY, nz);
    this.wheel.rotation.x = -m.phase * 2 * Math.PI;
    if (this.takeup) this.takeup.position.y = TABLE_TOP + 0.25 + 0.012 * Math.sin(m.phase * 2 * Math.PI);
    this.tower?.userData.set?.(world.machine.sewing ? 'busy' : 'wait');

    // Stofflagen
    const cmode = this.colorMode;
    const plyColors = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
    for (const cm of this.clothMeshes) {
      const c = cm.cloth, p = c.pos, a = cm.geo.attributes.position.array;
      for (let k = 0; k < 3 * c.n; k++) a[k] = p[k];
      cm.geo.attributes.position.needsUpdate = true;
      cm.geo.computeVertexNormals();
      if (cmode !== 'material') {
        const col = cm.geo.attributes.color.array;
        if (cmode === 'dehnung') {
          c.nodeStrain(cm.strain);
          const lim = world.cfg.limitLoad / Math.min(c.m.Tw, c.m.Tf);
          for (let v = 0; v < c.n; v++) {
            const e = Math.max(0, Math.min(1, cm.strain[v] / Math.max(lim, 1e-4)));
            const cc = new THREE.Color().setHSL(0.62 - 0.62 * e, 0.75, 0.45 + 0.1 * e);
            col[3 * v] = cc.r; col[3 * v + 1] = cc.g; col[3 * v + 2] = cc.b;
          }
        } else {
          const cc = new THREE.Color(plyColors[(c.stackIndex - 1) % plyColors.length]);
          for (let v = 0; v < c.n; v++) {
            const k = c.attached[v] >= 0 ? 1.35 : 1;
            col[3 * v] = Math.min(1, cc.r * k); col[3 * v + 1] = Math.min(1, cc.g * k); col[3 * v + 2] = Math.min(1, cc.b * k);
          }
        }
        cm.geo.attributes.color.needsUpdate = true;
      }
    }
    // Naht (Stichpunkte auf der obersten Lage)
    const sp = m.stitchPoints, sa = this.seamGeom.attributes.position.array;
    let n = 0;
    for (let k = 1; k < sp.length && n < 3990; k++) {
      for (const s of [sp[k - 1], sp[k]]) {
        const c = s.cloth, T = c.tri, P = c.pos;
        const i0 = T[3 * s.tri] * 3, i1 = T[3 * s.tri + 1] * 3, i2 = T[3 * s.tri + 2] * 3;
        for (let q = 0; q < 3; q++) sa[3 * n + q] = s.b0 * P[i0 + q] + s.b1 * P[i1 + q] + s.b2 * P[i2 + q] + (q === 1 ? c.radius + 4e-4 : 0);
        n++;
      }
    }
    this.seamGeom.setDrawRange(0, n);
    this.seamGeom.attributes.position.needsUpdate = true;
    // Bindungspunkte
    const pa = this.attGeom.attributes.position.array;
    let q = 0;
    if (this.showContacts) {
      for (const el of head.elements) for (const at of el.att) {
        if (q >= 3990) break;
        const P = at.cloth.pos, v = 3 * at.v;
        pa[3 * q] = P[v]; pa[3 * q + 1] = P[v + 1]; pa[3 * q + 2] = P[v + 2]; q++;
      }
    }
    this.attGeom.setDrawRange(0, q);
    this.attGeom.attributes.position.needsUpdate = true;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
