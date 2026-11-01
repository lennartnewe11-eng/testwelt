// Simulationswelt: Halle, Stapeltisch, Nähtisch mit Industrienähmaschine, Portalroboter
// mit Greiferkopf und ein Stapel Zuschnitte. Zeitintegration mit festen Teilschritten.

import { G, AIR } from './constants.js';
import { fabricById } from './materials.js';
import { Cloth, rotY } from './cloth.js';
import { BoxCollider } from './colliders.js';
import { ClothContacts } from './collision.js';
import { GripperHead, defaultParams } from './grippers.js';
import { SewingMachine } from './sewing.js';
import { GantryRobot } from './robot.js';
import { SleeveFeeder } from './feeder.js';
import { tshirtPanel, seamPath, pathAt, distToPath, templateOutline, setInBody, fitSleeve } from './garments.js';
import { rotY as rotYc, pointInPolygon } from './cloth.js';

export const TABLE_TOP = 0.80;
export const STACK_POS = [-0.5, 0.05];
export const NEEDLE = [0.62, TABLE_TOP, -0.12];

export const DEFAULT_PROGRAM = `# Pick & Place zweier Zuschnitte und robotergeführte Naht
# Koordinaten in m (y = Höhe der Greiferfläche), Drehung in °

# 1. Lage vom Stapel nehmen
SPEED 0.5
ACCEL 2
MOVE -0.53 0.95 0.05 0      # über den Stapel, 3 cm außermittig gegriffen,
                            # damit der Rahmen später links der Nadelstange bleibt
SPEED 0.12
MOVE -0.53 0.81 0.05
TOUCH 0.01                  # Tastfahrt bis Kontakt mit der obersten Lage
GRIP ON
WAIT 0.3                    # Haltekraft aufbauen
SPEED 0.03
MOVEREL 0 0.04 0            # langsam abheben: mitgesaugte Unterlage fällt ab
WAIT 0.3
SPEED 0.5
MOVE -0.53 0.95 0.05
MOVE 0.455 0.95 0.12        # Transport zur Nähmaschine
SPEED 0.12
MOVE 0.455 0.815 0.12
TOUCH 0.01
SPEED 0.05
MOVEREL 0 0.003 -0.05       # Vorderkante unter den Nähfuß schieben
GRIP OFF
TABLEVAC ON                 # Saugtisch hält die untere Lage
WAIT 0.3
SPEED 0.2
MOVEREL -0.08 0.004 0       # erst seitlich weg vom Nähkopf …
SPEED 0.3
MOVEREL 0 0.12 0            # … dann anheben (sonst stößt der Rahmen an)

# 2. Lage holen und deckungsgleich auflegen
SPEED 0.5
MOVE -0.53 0.95 0.05
SPEED 0.12
MOVE -0.53 0.81 0.05
TOUCH 0.01
GRIP ON
WAIT 0.3
SPEED 0.03
MOVEREL 0 0.04 0
WAIT 0.3
SPEED 0.5
MOVE -0.53 0.95 0.05
MOVE 0.455 0.95 0.12
SPEED 0.12
MOVE 0.455 0.815 0.12
TOUCH 0.01
SPEED 0.05
MOVEREL 0 0.003 -0.05       # über die gehaltene 1. Lage schieben

# robotergeführte Naht: 20 cm, 600 1/min, 3 mm Stichlänge.
# SYNC koppelt die Z-Achse elektronisch an den Transporteur.
FOOT DOWN
TABLEVAC OFF
WAIT 0.2
SEW 0.20 600 3 SYNC
WAITSEW
FOOT UP
GRIP OFF
WAIT 0.4
SPEED 0.2
MOVEREL -0.08 0.004 0
SPEED 0.3
MOVEREL 0 0.12 0
HOME
`;

export const TSHIRT_PROGRAM = `# Kinder-T-Shirt (Kimonoschnitt, Gr. 104/110): Vorder- und Rückenteil
# liegen rechts auf rechts im Zuschnittstapel. Genäht wird die linke
# Seitennaht mit Ärmelunternaht in einem Zug – mit der Achselrundung.

SPEED 0.5
ACCEL 2
MOVE -0.5 0.95 0.05 0
SPEED 0.12
MOVE -0.5 0.81 0.05
TOUCH 0.01
GRIP ON                     # Nähschablone klemmt beide Teile (Nahtschlitz bleibt frei)
WAIT 0.4
SPEED 0.04
MOVEREL 0 0.03 0
SPEED 0.4
MOVE -0.5 0.95 0.05
# Nahtanfang 4 cm vor die Nadel, Nahtrichtung in Transportrichtung
ALIGNPATH seite_links 0.83 0.04
SPEED 0.12
TOUCH 0.01
SPEED 0.04
MOVEREL 0 0.002 -0.04       # Saumkante unter den Nähfuß schieben
FOOT DOWN
WAIT 0.2
# Der Roboter führt das Teil und dreht es in der Achselrundung um die Nadel
SEWPATH seite_links 500 3
FOOT UP
GRIP OFF
WAIT 0.3
SPEED 0.3
MOVEREL 0 0.12 0
HOME
`;

export const SLEEVE_PROGRAM = `# Ärmel flach einsetzen (T-Shirt Gr. 86, Single Jersey)
# Vorstation: Schulternähte geschlossen, Körper aufgeklappt auf einem
# Werkstückträger, linker Ärmel rechts auf rechts lose aufgelegt.
# Der Roboter führt den Körper entlang des Armlochs. Der Ärmel wird separat
# von der Ärmelzuführung (segmentierte Vakuumplatte auf Dreh-Schiebeeinheit)
# und dem Obertransport mit Mehrweitensteuerung geführt; ein Kantensensor
# vor der Nadel überwacht die Ärmelkante.

SPEED 0.4
ACCEL 1.2                   # sanft: der Ärmel liegt nur durch Reibung auf
MOVE -0.5 0.95 0.05 0
SPEED 0.12
MOVE -0.5 0.81 0.05
TOUCH 0.01                  # an den Werkstückträger ankoppeln
GRIP ON                     # Nadelleisten halten den Körper
WAIT 0.4
SPEED 0.05
MOVEREL 0 0.02 0
SPEED 0.3
MOVE -0.5 0.95 0.05
# Armlochanfang 4 cm vor die Nadel, Nahtrichtung in Transportrichtung
ALIGNPATH armloch_links 0.83 0.04
SPEED 0.1
TOUCH 0.01
SPEED 0.03
MOVEREL 0 0.001 -0.04       # Kanten unter den Nähfuß schieben
SLEEVEFEED ON               # Ärmelzuführung setzt auf, Kamera-Lagekorrektur, Trennblech
WAIT 0.5
FOOT DOWN
WAIT 0.2
SEWPATH armloch_links 400 2.5
SLEEVEFEED OFF
FOOT UP
GRIP OFF                    # Träger bleibt liegen, Roboter fährt weg
WAIT 0.3
SPEED 0.3
MOVEREL 0 0.12 0
HOME
`;

// Szenarien: setzen Material, Greifer, Raster und Programm passend vor
export const SCENARIOS = {
  rechteck: {
    name: 'Rechteckzuschnitte, gerade Naht',
    set: { scenario: 'rechteck', fabricId: 'popeline', plies: 4, gripper: 'vakuum', rows: 3, cols: 3, pitchX: 0.11, pitchZ: 0.14, rpm: 600, stitch: 3, pickPlies: 1, program: null },
  },
  aermel: {
    name: 'T-Shirt, Ärmel einsetzen (separates Teil)',
    set: { scenario: 'aermel', fabricId: 'jersey', plies: 2, gripper: 'traeger', gripperParams: {}, rows: 1, cols: 1, pitchX: 0.10, pitchZ: 0.13, rpm: 400, stitch: 2.5, pickPlies: 1, program: null },
  },
  tshirt: {
    name: 'T-Shirt, Kurvennaht (Seite + Ärmel)',
    set: { scenario: 'tshirt', fabricId: 'jersey', plies: 2, gripper: 'schablone', gripperParams: {}, rows: 1, cols: 1, pitchX: 0.10, pitchZ: 0.13, rpm: 500, stitch: 3, pickPlies: 2, program: null },
  },
};

export function applyScenario(cfg, id) {
  const sc = SCENARIOS[id] || SCENARIOS.rechteck;
  Object.assign(cfg, sc.set);
  cfg.gripperParams = { ...defaultParams(cfg.gripper), ...(sc.set.gripperParams || {}) };
  cfg.program = id === 'tshirt' ? TSHIRT_PROGRAM : id === 'aermel' ? SLEEVE_PROGRAM : DEFAULT_PROGRAM;
  return cfg;
}

export function defaultConfig() {
  return {
    fabricId: 'popeline',
    customFabric: null,
    plies: 4,
    plyW: 0.30,
    plyL: 0.40,
    spacing: 0.0125,
    substeps: 16,
    iterations: 1,
    limitLoad: 10,       // Linienlast [N/m], ab der die Dehnungsbegrenzung greift
    gripper: 'vakuum',
    gripperParams: defaultParams('vakuum'),
    rows: 3, cols: 3, pitchX: 0.11, pitchZ: 0.14,
    rpm: 600, stitch: 3, footForce: 40, footMaterial: 'stahl',
    tableMaterial: 'hpl',
    tableVacPa: 800,     // wirksamer Unterdruck des Saugtischs [Pa]
    selfCollision: true,
    program: DEFAULT_PROGRAM,
    seed: 7,
    servoKv: 40,         // Lageregelung der Portalachsen [1/s]
    compressionFactor: 0.05, // Drucksteifigkeit / Zugsteifigkeit der Textilien
    threadTension: 1.2,  // Fadenspannung [N]
    airCushion: true,    // Luftpolster (Quetschströmung) beim Ablegen
    servoFF: 0.9,        // Geschwindigkeitsvorsteuerung (0 … 1)
    scenario: 'rechteck',
    pickPlies: 1,        // gewollte Lagen je Griff (Doppelgriff-Warnung darüber)
  };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export class World {
  constructor(cfg = defaultConfig()) {
    this.cfg = cfg;
    this.build();
  }

  build() {
    const c = this.cfg;
    this.t = 0;
    this.events = [];
    this.fabric = c.customFabric || fabricById(c.fabricId);
    const T = TABLE_TOP;
    this.colliders = [
      new BoxCollider({ name: 'Hallenboden', center: [0, -0.05, 0], half: [4, 0.05, 4], material: 'beton', visual: false }),
      new BoxCollider({ name: 'Stapeltisch', center: [STACK_POS[0], T - 0.02, STACK_POS[1]], half: [0.35, 0.02, 0.3], material: c.tableMaterial }),
      new BoxCollider({ name: 'Nähtisch', center: [0.55, T - 0.02, -0.05], half: [0.45, 0.02, 0.4], material: c.tableMaterial }),
      new BoxCollider({ name: 'Stichplatte', center: [NEEDLE[0] + 0.13, T - 0.004, NEEDLE[2]], half: [0.18, 0.004, 0.07], material: 'stahl', color: '#c9cdd2' }),
      new BoxCollider({ name: 'Nähkopf', center: [NEEDLE[0] + 0.02, T + 0.2, NEEDLE[2]], half: [0.05, 0.08, 0.05], material: 'guss' }),
      new BoxCollider({ name: 'Arm', center: [NEEDLE[0] + 0.2, T + 0.23, NEEDLE[2]], half: [0.16, 0.04, 0.045], material: 'guss' }),
      new BoxCollider({ name: 'Ständer', center: [NEEDLE[0] + 0.33, T + 0.12, NEEDLE[2]], half: [0.05, 0.12, 0.055], material: 'guss' }),
    ];
    this.colliders[2].vacuum = true; // Nähtisch mit Saugfeld
    this.tableColliders = this.colliders.slice(1, 4);
    this.staticColliders = this.colliders.slice();

    // Stapel aus Zuschnitten mit realistischer Legetoleranz (±1,5 mm, ±0,5°)
    const R = rng(c.seed);
    this.cloths = [];
    const t = this.fabric.thickness * 1e-3;
    this.paths = {};
    this.feeder = null;
    const tshirt = c.scenario === 'tshirt', sleeveSc = c.scenario === 'aermel';
    const plies = tshirt || sleeveSc ? 2 : c.plies;
    let shapes = [];
    if (tshirt) {
      const front = tshirtPanel({ neckDepth: 0.06 }), back = tshirtPanel({ neckDepth: 0.02 });
      shapes = [{ outline: back.outline, name: 'Rückenteil' }, { outline: front.outline, name: 'Vorderteil' }];
      for (const [k, chain] of Object.entries(front.chains)) this.paths[k] = seamPath(front.outline, chain, 0.01);
      this.garment = { front, back };
    } else {
      const W = c.plyW, L = c.plyL;
      const out = [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, L / 2], [-W / 2, L / 2]];
      // gerade Naht entlang der rechten Kante (vom vorderen zum hinteren Ende), 1 cm Zugabe
      this.rectOutline = out; this.rectChain = [[W / 2, -L / 2], [W / 2, L / 2]];
      this.paths.kante_rechts = seamPath(out, this.rectChain, 0.01);
    }
    if (sleeveSc) this._buildSleeveScene(c, T, t, R);
    else for (let i = 0; i < plies; i++) {
      const y = T + t * (i + 0.5) + 1e-5;
      const tol = tshirt ? 0.001 : 0.003; // paarweise geschnittene Teile liegen genauer
      const cloth = new Cloth({
        fabric: this.fabric, width: c.plyW, length: c.plyL, spacing: c.spacing,
        outline: tshirt ? shapes[i].outline : null,
        center: [STACK_POS[0] + (R() - 0.5) * tol, y, STACK_POS[1] + (R() - 0.5) * tol],
        yaw: ((R() - 0.5) * Math.PI) / 180, name: tshirt ? shapes[i].name : `Lage ${plies - i}`,
      });
      cloth.stackIndex = plies - i; // 1 = oberste
      cloth.compressionFactor = c.compressionFactor ?? 0.05;
      this.cloths.push(cloth);
    }
    this.cloths.sort((a, b) => a.stackIndex - b.stackIndex);
    this.cloths.reverse(); // unterste zuerst (Darstellungsreihenfolge egal)

    this.head = new GripperHead({ type: c.gripper, params: { ...defaultParams(c.gripper), ...c.gripperParams }, rows: c.rows, cols: c.cols, pitchX: c.pitchX, pitchZ: c.pitchZ });
    this.robot = new GantryRobot();
    this.machine = new SewingMachine({ needle: NEEDLE });
    // Saugtisch im Nähbereich: hält aufliegende Lagen über Unterdruck (erhöht die Normalkraft)
    this.tableVac = { on: false, pressure: c.tableVacPa ?? 800, region: [0.345, 0.625, -0.12, 0.25], top: T }; // Saugfeld unter der 1. Lage (Zonensteuerung)
    this.machine.tableVac = this.tableVac;
    this.machine.distToPath = distToPath;
    // Nähschablone / Werkstückträger passend zum Teil (Kontur, Nahtbahn, Schlitz)
    if (sleeveSc) {
      const path = this.paths.armloch_links, slot = (this.head.params.slot || 16) * 1e-3;
      this.head.setTemplate({ path, outline: this.garment.body.outline, cloth: this.bodyCloth, dist: (u, v) => distToPath(path, u, v), shape: templateOutline(this.garment.body.outline, this.garment.body.chains.armloch_links, 0.01 + slot), slot });
      this.machine.pathAt = pathAt;
      const slOut = this.garment.sleeve.outline;
      this.machine.setEdgeGuide({ cloth: this.sleeveCloth, path: this.paths.aermelkugel, capEdge: this.capEdge, bodyPath: path, bodyCloth: this.bodyCloth, inside: (u, v) => pointInPolygon(slOut, u, v) });
      // Platte hält den Ärmel auf Trennblechhöhe (Körper + 0,4 mm Blech)
      this.feeder = new SleeveFeeder({ cloth: this.sleeveCloth, path: this.paths.aermelkugel, pathAt, needle: NEEDLE, holdY: NEEDLE[1] + 2 * this.bodyCloth.radius + 0.4e-3 + this.sleeveCloth.radius });
      this.machine.feeder = this.feeder;
    } else {
      const pathName = tshirt ? 'seite_links' : 'kante_rechts';
      const path = this.paths[pathName];
      const outline = tshirt ? this.garment.front.outline : this.rectOutline;
      const chain = tshirt ? this.garment.front.chains.seite_links : this.rectChain;
      const slot = (this.head.params.slot || 16) * 1e-3;
      this.head.setTemplate({ path, outline, dist: (u, v) => distToPath(path, u, v), shape: templateOutline(outline, chain, 0.01 + slot), slot });
    }
    this.machineBoxes = this.colliders.filter((k) => ['Nähkopf', 'Arm', 'Ständer'].includes(k.name));
    this.head.tableVac = this.tableVac;
    Object.assign(this.machine, { rpm: c.rpm, stitchLength: c.stitch, footForce: c.footForce, footMaterial: c.footMaterial, threadTension: c.threadTension ?? 1.2 });
    this.contacts = new ClothContacts();
    this.contacts.selfCollision = c.selfCollision;
    this.kinematic = [...this.head.colliders, this.machine.foot];
    this.colliders.push(...this.kinematic);
    this.head.pose = { ...this.robot.pose };
    this.head.updateColliders();
    this.track = new Map(this.cloths.map((cl) => [cl.id, { state: 'Stapel', held: false, error: null, warnedStrain: false }]));
    this.cycle = { gripY: null, double: false };
    this.robot.load(c.program);
    this.stats = { maxSpeed: 0 };
  }

  log(msg, level = 'info') {
    this.events.push({ t: this.t, msg, level });
    if (this.events.length > 300) this.events.shift();
  }

  // Körper (aufgeklappt, auf Werkstückträger) mit lose aufgelegtem Ärmel, rechts auf rechts.
  // Der Ärmel wird so aufgelegt, dass Anfang und Richtung der Kugelnaht mit dem Armloch
  // übereinstimmen und beide Teile auf derselben Seite der Naht liegen.
  _buildSleeveScene(c, T, t, R) {
    const body = setInBody();
    this.paths.armloch_links = seamPath(body.outline, body.chains.armloch_links, 0.01);
    let sleeve = fitSleeve(this.paths.armloch_links.length, 0.02);
    const center = [STACK_POS[0], T + t / 2 + 1e-5, STACK_POS[1]];
    const bc = new Cloth({ fabric: this.fabric, spacing: c.spacing, outline: body.outline, holes: body.holes, center, yaw: 0, name: 'Körper' });
    bc.stackIndex = 2;
    bc.compressionFactor = c.compressionFactor ?? 0.05;
    // Lage des Ärmels im Körperkoordinatensystem bestimmen (ggf. gespiegelt = Rückseite oben)
    const place = (sl) => {
      const sp = seamPath(sl.outline, sl.chains.aermelkugel, 0.01);
      const bp = this.paths.armloch_links;
      const ts = pathAt(sp, 0).t, tb = pathAt(bp, 0).t;
      // rotY(ts, phi) = tb  ⇔  Winkel(ts) + phi = Winkel(tb)
      const phi = Math.atan2(tb[0], tb[1]) - Math.atan2(ts[0], ts[1]);
      const [rx, rz] = rotYc(sp.points[0][0], sp.points[0][1], phi);
      const tr = [bp.points[0][0] - rx, bp.points[0][1] - rz];
      // Liegen beide Teile auf derselben Seite der Naht? (Punkt links der Nahtrichtung im Teil?)
      const leftInside = (p, outline) => { const q = pathAt(p, 0.02); return pointInPolygon(outline, q.p[0] - q.t[1] * 0.012, q.p[1] + q.t[0] * 0.012); };
      const sideOk = leftInside(sp, sl.outline) === leftInside(bp, body.outline);
      return { sp, phi, tr, sideOk };
    };
    let pl = place(sleeve);
    if (!pl.sideOk) {
      const mir = (pts) => pts.map(([x, z]) => [-x, z]);
      sleeve = { outline: mir(sleeve.outline).reverse(), chains: { aermelkugel: mir(sleeve.chains.aermelkugel) } };
      pl = place(sleeve);
    }
    this.paths.aermelkugel = pl.sp;
    const sc = new Cloth({ fabric: this.fabric, spacing: c.spacing, outline: sleeve.outline, center: [center[0] + pl.tr[0], T + 1.5 * t + 2e-5, center[2] + pl.tr[1]], yaw: pl.phi, name: 'Ärmel' });
    sc.stackIndex = 1;
    sc.compressionFactor = c.compressionFactor ?? 0.05;
    // Knoten an der Kugelkante (für den Kantensensor)
    this.capEdge = new Uint8Array(sc.n);
    const chainPath = { points: sleeve.chains.aermelkugel };
    for (let v = 0; v < sc.n; v++) if (sc.border[v] && distToPath(chainPath, sc.rest[2 * v], sc.rest[2 * v + 1]) < 0.004) this.capEdge[v] = 1;
    this.cloths.push(bc, sc);
    this.bodyCloth = bc; this.sleeveCloth = sc;
    this.garment = { body, sleeve };
  }

  // Tastsensor: höchste Oberfläche unter den Greiferelementen (inkl. gehaltener Lagen).
  // Einmal pro Bildschritt berechnet; die Tastfahrt stoppt, sobald die Greiferfläche sie erreicht.
  _touchSurface() {
    const head = this.head;
    if (head.type === 'traeger') {
      // Träger liegt auf dem Tisch: Kontakt, wenn die Trägeroberseite die Tischplatte erreicht
      let top = -Infinity;
      for (const col of this.staticColliders) top = Math.max(top, col.topAt(head.pose.x, head.pose.z));
      return top;
    }
    let held = 0;
    const heldIds = new Set();
    for (const el of head.elements) for (const a of el.att) heldIds.add(a.cloth.id);
    for (const cl of this.cloths) if (heldIds.has(cl.id)) held += 2 * cl.radius;
    let top = -Infinity;
    for (const el of head.elements) {
      const [cx, , cz] = head.elementCenter(el);
      for (const col of this.staticColliders) top = Math.max(top, col.topAt(cx, cz));
      for (const cl of this.cloths) {
        if (heldIds.has(cl.id)) continue;
        const b = cl.aabb;
        if (b && (cx < b[0] - el.half || cx > b[3] + el.half || cz < b[2] - el.half || cz > b[5] + el.half)) continue;
        const p = cl.pos, r2 = Math.max(el.half, cl.h * 0.75) ** 2;
        for (let v = 0; v < cl.n; v++) {
          const dx = p[3 * v] - cx, dz = p[3 * v + 2] - cz;
          if (dx * dx + dz * dz > r2) continue;
          top = Math.max(top, p[3 * v + 1] + cl.radius);
        }
      }
    }
    return top + held;
  }

  headContact() { return (this._servoPose?.y ?? this.robot.pose.y) <= this.touchTop + 0.1e-3; }

  _updateSleep(frameDt) {
    const head = this.head, m = this.machine;
    for (const c of this.cloths) {
      const p = c.pos, b = c.aabb || (c.aabb = new Float64Array(6));
      b[0] = b[1] = b[2] = Infinity; b[3] = b[4] = b[5] = -Infinity;
      let vmax = 0, bx = 0, by = 0, bz = 0;
      const V = c.vel;
      for (let v = 0; v < c.n; v++) {
        const i = 3 * v;
        for (let k = 0; k < 3; k++) { const x = p[i + k]; if (x < b[k]) b[k] = x; if (x > b[3 + k]) b[3 + k] = x; }
        const s = V[i] * V[i] + V[i + 1] * V[i + 1] + V[i + 2] * V[i + 2];
        if (s > vmax) vmax = s;
        bx += V[i]; by += V[i + 1]; bz += V[i + 2];
      }
      c.vmax = Math.sqrt(vmax);
      c.vbulk = [bx / c.n, by / c.n, bz / c.n];
      let vr = 0;
      for (let v = 0; v < c.n; v++) {
        const i = 3 * v;
        const dx = V[i] - c.vbulk[0], dy = V[i + 1] - c.vbulk[1], dz = V[i + 2] - c.vbulk[2];
        const s = dx * dx + dy * dy + dz * dz;
        if (s > vr) vr = s;
      }
      c.vrel = Math.sqrt(vr);
    }
    const hx = head.extent.x + 0.03, hz = head.extent.z + 0.03, hp = head.pose;
    const hr = Math.hypot(hx, hz);
    // die beiden obersten Lagen unter einem tief stehenden Greiferkopf aufwecken
    const under = this.cloths.filter((c) => { const b = c.aabb; return hp.y - b[4] < 0.03 && hp.x + hr > b[0] && hp.x - hr < b[3] && hp.z + hr > b[2] && hp.z - hr < b[5]; })
      .sort((a, b) => b.aabb[4] - a.aabb[4]).slice(0, 2);
    for (const c of this.cloths) {
      const b = c.aabb;
      let disturbed = c.wake || c.attachedCount() > 0 || c.vmax > 0.012 || under.includes(c);
      if (!disturbed && (!m.footUp || m.sewing) && m.needle[0] > b[0] - 0.02 && m.needle[0] < b[3] + 0.02 && m.needle[2] > b[2] - 0.02 && m.needle[2] < b[5] + 0.02) disturbed = true;
      if (!disturbed) for (const o of this.cloths) {
        if (o === c || o.sleeping || o.vmax < 0.02) continue;
        const a = o.aabb;
        if (a[0] < b[3] + 0.01 && a[3] > b[0] - 0.01 && a[2] < b[5] + 0.01 && a[5] > b[2] - 0.01 && a[1] < b[4] + 0.03 && a[4] > b[1] - 0.03) { disturbed = true; break; }
      }
      c.wake = false;
      if (disturbed) { c.sleeping = false; c.sleepTimer = 0; }
      else {
        c.sleepTimer = (c.sleepTimer || 0) + frameDt;
        if (c.sleepTimer > 0.3 && !c.sleeping) { c.sleeping = true; c.vel.fill(0); }
      }
    }
  }

  // Aerodynamische Kräfte je Dreieck -> Beschleunigung je Knoten (cloth.acc).
  // Wird alle 4 Teilschritte neu berechnet (Kräfte ändern sich langsam).
  _drag(cloth, dt) {
    const p = cloth.pos, v = cloth.vel, w = cloth.w, T = cloth.tri;
    const acc = cloth.acc || (cloth.acc = new Float64Array(3 * cloth.n));
    acc.fill(0);
    const rho = AIR.density, Cd = 1.17, Cf = 0.02, kP = cloth.m.k;
    for (let t = 0; t < cloth.nTri; t++) {
      const a = T[3 * t] * 3, b = T[3 * t + 1] * 3, c = T[3 * t + 2] * 3;
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
      const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const n2 = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (n2 < 1e-14) continue;
      const A = 0.5 * n2;
      nx /= n2; ny /= n2; nz /= n2;
      const vx = (v[a] + v[b] + v[c]) / 3, vy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3, vz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3;
      const vn = vx * nx + vy * ny + vz * nz;
      const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
      const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
      // Druckwiderstand, reduziert um Durchströmung (Darcy): p = ½ρCd(|vn| − k·p)²
      const avn = Math.abs(vn);
      let pr = 0.5 * rho * Cd * avn * avn;
      for (let it = 0; it < 2; it++) { const ve = Math.max(0, avn - kP * pr); pr = 0.5 * rho * Cd * ve * ve; }
      const Fn = -Math.sign(vn) * pr * A;
      const Ft = 0.5 * rho * Cf * A * vt;
      const fx = (Fn * nx - Ft * tx) / 3, fy = (Fn * ny - Ft * ty) / 3, fz = (Fn * nz - Ft * tz) / 3;
      for (let q = 0; q < 3; q++) {
        const i = q === 0 ? a : q === 1 ? b : c;
        const wi = w[i / 3];
        if (!wi) continue;
        let ax = fx * wi, ay = fy * wi, az = fz * wi;
        // Widerstand darf die Normalgeschwindigkeit innerhalb des Intervalls nicht umkehren
        const an = Math.abs(ax * nx + ay * ny + az * nz) * dt;
        if (an > avn && avn > 0) { const s = avn / an; ax *= s; ay *= s; az *= s; }
        acc[i] += ax; acc[i + 1] += ay; acc[i + 2] += az;
      }
    }
  }

  step(frameDt) {
    const n = this.cfg.substeps;
    const dt = frameDt / n;
    const cloths = this.cloths;
    this._updateSleep(frameDt);
    // Kontaktsuche alle k Teilschritte; k so, dass sich keine Lage dazwischen mehr als ~3 mm bewegt
    let vmax = 0;
    for (const c of cloths) if (!c.sleeping) vmax = Math.max(vmax, c.vrel);
    for (const a of cloths) for (const b of cloths) {
      if (a === b || (a.sleeping && b.sleeping)) continue;
      const A = a.aabb, B = b.aabb, g = 0.02;
      if (A[0] > B[3] + g || A[3] < B[0] - g || A[1] > B[4] + g || A[4] < B[1] - g || A[2] > B[5] + g || A[5] < B[2] - g) continue;
      vmax = Math.max(vmax, Math.hypot(a.vbulk[0] - b.vbulk[0], a.vbulk[1] - b.vbulk[1], a.vbulk[2] - b.vbulk[2]));
    }
    const detectEvery = Math.max(Math.min(2, n), Math.min(n, Math.floor(3e-3 / Math.max(1e-9, 1.5 * vmax * dt))));
    this.stats.detectEvery = detectEvery;
    this.head.updateFrame(frameDt, cloths, this.t);
    for (const c of cloths) {
      const sig = c.attachedCount();
      if (sig !== c.tetherSig) { c.tetherSig = sig; c.updateTethers(); }
      // zulässige elastische Dehnung: Eigengewicht + 5 g Trägheitsreserve bei der Zugsteifigkeit
      c.tetherSlack = Math.min(0.05, (c.m.rho * G * 5 * Math.max(c.width, c.length)) / Math.min(c.m.Tw, c.m.Tf));
    }
    this.touchTop = this._touchSurface();

    const ctx = {
      head: this.head, machine: this.machine, contact: () => this.headContact(), log: (m, l) => this.log(m, l),
      paths: this.paths, pathAt, partMap: () => this.head.partMap(),
    };
    for (let s = 0; s < n; s++) {
      if (s % detectEvery === 0) {
        this.contacts.detect(cloths, Math.min(detectEvery, n - s) * dt);
      }
      this.t += dt;
      for (const k of this.kinematic) k.beginSubstep();
      const wasOn = this.head.elements.some((e) => e.on);
      const prevPose = { ...this.robot.pose };
      this.robot.update(this.t, dt, ctx);
      // Kurvennaht: Transporteur folgt der Starrkörperbewegung des geführten Teils
      if (this.robot.pathFollow) {
        const a = this._servoPrev || prevPose, b = this._servoNext(dt);
        this.machine.follow = (x, z) => {
          const [lx, lz] = rotY(x - a.x, z - a.z, -a.yaw);
          const [wx, wz] = rotY(lx, lz, b.yaw);
          return [b.x + wx - x, b.z + wz - z];
        };
      } else this.machine.follow = null;
      const isOn = this.head.elements.some((e) => e.on);
      if (!wasOn && isOn) this.cycle = { gripY: this.robot.pose.y, double: false, empty: false };
      if (this.robot.running && !this._runSeen) { this._runSeen = true; this.collided = false; }
      if (!this.robot.running) this._runSeen = false;
      // Lageregelung: Istlage folgt der Sollbahn mit P-Regler (Geschwindigkeitsverstärkung Kv)
      this.head.pose = this._servoNext(dt);
      this._servoPrev = { ...this.head.pose };
      this._servoDone = false;
      this.head.updateColliders();
      this.machine.update(this.t, dt);

      for (const c of cloths) {
        if (c.sleeping) continue;
        if (s % 4 === 0 || !c.acc) this._drag(c, dt * Math.min(4, n - s));
        const p = c.pos, pp = c.prev, v = c.vel, w = c.w, acc = c.acc;
        const sq = this.cfg.airCushion === false ? null : { a: Math.min(c.width, c.length) / 2 };
        const gb = c.gapBelow;
        for (let i = 0, N = c.n; i < N; i++) {
          const k = 3 * i;
          pp[k] = p[k]; pp[k + 1] = p[k + 1]; pp[k + 2] = p[k + 2];
          if (!w[i]) continue;
          v[k] += acc[k] * dt; v[k + 2] += acc[k + 2] * dt;
          v[k + 1] += (acc[k + 1] - G) * dt;
          // Luftpolster (Quetschströmung) beim Annähern an eine Fläche
          if (v[k + 1] < 0 && sq) {
            let gap = gb ? gb[i] : Infinity;
            if (p[k + 1] < TABLE_TOP + 0.012) {
              const top = this._tableTop(p[k], p[k + 2]);
              if (top > -1) gap = Math.min(gap, p[k + 1] - c.radius - top);
            }
            if (gap > 0 && gap < 5e-3) {
              const vn = -v[k + 1], e = Math.min(c.edgeDist[i], sq.a);
              const hEff = gap + 2e-4;                            // Rauheit: Luft entweicht auch durch die Oberflächenstruktur
              const pSq = (6 * AIR.viscosity * vn * e * (2 * sq.a - e)) / (hEff * hEff * hEff);
              const pr = 1 / (1 / Math.max(pSq, 1e-12) + c.m.k / vn); // parallel: seitlich + durch den Stoff
              v[k + 1] += Math.min(vn, (pr / c.m.rho) * dt);
            }
          }
          p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
        }
      }
      const iters = this.cfg.iterations || 1;
      for (const c of cloths) {
        if (c.sleeping) continue;
        c.resetLambda();
        for (let it = 0; it < iters; it++) c.solveInternal(dt, iters === 1);
        c.solveLimits(this.cfg.limitLoad);
      }
      this.machine.solve(cloths, dt, this.t);
      this.head.solve(dt);
      if (this.feeder?.on) {
        this.feeder.advance(this.machine.sewing ? this.machine.feedVelocity() * dt * this.machine.topFeedRatio() : 0, dt);
        this.feeder.solve(dt);
      }
      for (const c of cloths) if (!c.sleeping) c.solveTethers(c.tetherSlack);
      // Trennblech des Kantenführers: zwischen den Lagen vor dem Nähfuß keine Reibung
      this.contacts.frictionless = (this.machine.edge?.on || this.feeder?.on) && !this.machine.footUp ? this.machine.separatorZone : null;
      this.contacts.solve(cloths, dt);
      for (const col of this.colliders) {
        if (!col.enabled) continue;
        const ff = col.solid.frictionFactor;
        const br = Math.hypot(col.half[0], col.half[1], col.half[2]) + 0.03;
        for (const c of cloths) {
          if (c.sleeping) continue;
          const b = c.aabb;
          if (col.c[0] + br < b[0] || col.c[0] - br > b[3] || col.c[1] + br < b[1] || col.c[1] - br > b[4] || col.c[2] + br < b[2] || col.c[2] - br > b[5]) continue;
          // Saugtisch: Unterdruck erhöht die Normalkraft der aufliegenden Lage (Reibschluss)
          const vac = col.vacuum && this.tableVac.on ? { region: this.tableVac.region, pen: (this.tableVac.pressure / c.m.rho) * dt * dt } : null;
          col.collideCloth(c, c.m.muSteelS * ff, c.m.muSteelK * ff, vac);
        }
      }
      for (const c of cloths) if (!c.sleeping) c.solveLimits(this.cfg.limitLoad);
      this.machine.unpin();
      const inv = 1 / dt;
      for (const c of cloths) {
        if (c.sleeping) continue;
        const p = c.pos, pp = c.prev, v = c.vel;
        if (!Number.isFinite(p[0] + p[3 * (c.n >> 1) + 1] + p[3 * c.n - 1])) this._recover(c);
        for (let k = 0, N = 3 * c.n; k < N; k++) {
          let vk = (p[k] - pp[k]) * inv;
          if (vk > 20) vk = 20; else if (vk < -20) vk = -20;
          v[k] = vk;
        }
        c.damp(dt);
      }
      this.head.checkFailure(dt, this.t);
    }
    this._afterFrame();
  }

  // Istlage der Achsen für diesen Teilschritt (einmal je Teilschritt berechnet).
  // P-Lageregler mit Kv = 40 1/s (typisch für Servo-Linearachsen) und 90 % Geschwindigkeits-
  // vorsteuerung; der verbleibende Schleppfehler beträgt (1 − ff)·v/Kv.
  _servoNext(dt) {
    if (this._servoDone) return this._servoPose;
    const cmd = this.robot.pose, kv = this.cfg.servoKv ?? 40, ff = this.cfg.servoFF ?? 0.9;
    const f = this._servoFilt || { ...cmd };
    const k = 1 - Math.exp(-kv * dt);
    this._servoFilt = { x: f.x + (cmd.x - f.x) * k, y: f.y + (cmd.y - f.y) * k, z: f.z + (cmd.z - f.z) * k, yaw: f.yaw + (cmd.yaw - f.yaw) * k };
    // Geschwindigkeitsvorsteuerung (Anteil ff): nur der Rest folgt verzögert
    const F = this._servoFilt, mix = (a, b) => ff * a + (1 - ff) * b;
    this._servoPose = { x: mix(cmd.x, F.x), y: mix(cmd.y, F.y), z: mix(cmd.z, F.z), yaw: mix(cmd.yaw, F.yaw) };
    this.servoError = Math.hypot(cmd.x - this._servoPose.x, cmd.y - this._servoPose.y, cmd.z - this._servoPose.z);
    this._servoDone = true;
    return this._servoPose;
  }

  // Höchste Tischoberfläche unter (x, z) – für das Luftpolster
  _tableTop(x, z) {
    let top = -Infinity;
    for (const k of this.tableColliders || []) top = Math.max(top, k.topAt(x, z));
    return top;
  }

  // Kollisionsüberwachung Greiferkopf ↔ Nähmaschine (Roboter ist kinematisch, daher Warnung)
  _checkHeadCollision() {
    if (this.collided) return;
    if (this.head.type === 'schablone' || this.head.type === 'traeger') return; // Nähfuß läuft im Schlitz
    const yw = Math.abs(Math.cos(this.head.pose.yaw)), ys = Math.abs(Math.sin(this.head.pose.yaw));
    for (const k of this.head.colliders) {
      // achsparallele Hülle des gedrehten Quaders
      const ex = yw * k.half[0] + ys * k.half[2], ez = ys * k.half[0] + yw * k.half[2];
      for (const m of this.machineBoxes) {
        if (Math.abs(k.c[0] - m.c[0]) < ex + m.half[0] && Math.abs(k.c[2] - m.c[2]) < ez + m.half[2] && Math.abs(k.c[1] - m.c[1]) < k.half[1] + m.half[1]) {
          this.collided = true;
          this.log(`Kollision: Greiferkopf berührt ${m.name} der Nähmaschine`, 'error');
          return;
        }
      }
      // Nadelstange und Nähfußstange (Ø ca. 8 mm, vom Fuß bis zum Kopf)
      const N = this.machine.needle;
      if (Math.abs(k.c[0] - N[0]) < ex + 0.006 && Math.abs(k.c[2] - N[2]) < ez + 0.02 && k.c[1] - k.half[1] < N[1] + 0.12) {
        this.collided = true;
        this.log('Kollision: Greiferkopf an Nadel- oder Nähfußstange', 'error');
        return;
      }
    }
  }

  // Sicherheitsnetz: nicht-endliche Werte (numerische Instabilität) zurücksetzen
  _recover(c) {
    const p = c.pos, pp = c.prev;
    for (let k = 0; k < 3 * c.n; k++) if (!Number.isFinite(p[k])) p[k] = Number.isFinite(pp[k]) ? pp[k] : 0;
    c.vel.fill(0);
    if (!c.warnedNaN) { c.warnedNaN = true; this.log(`${c.name}: numerische Instabilität abgefangen`, 'error'); }
  }

  _afterFrame() {
    this._checkHeadCollision();
    for (const e of this.head.events.splice(0)) {
      const detail = `F_n ${e.Fn.toFixed(3)}/${e.Cn.toFixed(3)} N, F_t ${e.Ft.toFixed(3)}/${e.Ct.toFixed(3)} N`;
      if (e.type === 'separate') continue; // Unterlage löst sich – Zusammenfassung je Lage folgt
      this.log(`${e.cloth.name} löst sich von Greifer ${e.el + 1} (${detail})`, 'warn');
    }
    const anyOn = this.head.elements.some((e) => e.on);
    let heldCount = 0;
    for (const c of this.cloths) {
      const tr = this.track.get(c.id);
      const held = c.attachedCount() > 0;
      if (held) heldCount++;
      if (held && !tr.held) {
        tr.held = true; tr.prevState = tr.state;
        // als Unterlage mitgegriffen (durch die obere Lage hindurch)?
        const want = this.cfg.pickPlies || 1;
        tr.sub = this.head.elements.some((el) => el.frozen.get(c.id)?.ply >= want) && !this.head.elements.some((el) => el.frozen.get(c.id)?.ply < want);
        if (!tr.sub) { tr.state = 'gegriffen'; tr.error = null; tr.ideal = null; tr.pick = c.pose2D(); tr.gpick = { ...this.head.pose }; }
      } else if (!held && tr.held) {
        tr.held = false;
        if (tr.sub) {
          tr.state = tr.prevState || 'Stapel';
          this.log(`${c.name}: mitgesaugte Unterlage hat sich gelöst (Lagentrennung)`);
        } else if (anyOn) { tr.state = 'verloren'; this.log(`${c.name} verloren`, 'error'); }
        else {
          const g0 = tr.gpick, g1 = this.head.pose;
          const [dx, dz] = rotY(tr.pick.x - g0.x, tr.pick.z - g0.z, -g0.yaw);
          const [rx, rz] = rotY(dx, dz, g1.yaw);
          tr.ideal = { x: g1.x + rx, z: g1.z + rz, theta: tr.pick.theta - g0.yaw + g1.yaw };
          tr.state = 'abgelegt';
        }
      }
      if (!c.sleeping || tr.strain === undefined) {
        const st = c.strainStats();
        tr.strain = st.p99; tr.strainMax = st.max;
      }
      // über Stiche mit einer anderen Lage verbunden?
      if (!held && tr.state !== 'angenäht' && this.machine.joins.some((j) => j.ca === c || j.cb === c) && tr.state !== 'gegriffen') tr.state = 'angenäht';
      const strain = tr.strain;
      if (!tr.warnedStrain && strain > 0.5 * (c.fabric.breakStrain / 100)) {
        tr.warnedStrain = true;
        this.log(`${c.name}: Dehnung ${(strain * 100).toFixed(1)} % (> 50 % der Bruchdehnung)`, 'warn');
      }
      if (tr.ideal && !tr.error) {
        const speed = c.meanSpeed();
        if (speed < 0.004) {
          const pz = c.pose2D();
          let dth = pz.theta - tr.ideal.theta;
          dth = Math.atan2(Math.sin(dth), Math.cos(dth));
          tr.error = { dx: pz.x - tr.ideal.x, dz: pz.z - tr.ideal.z, dth };
        }
      }
    }
    if (this.cycle.gripY !== null && !this.cycle.double && heldCount > (this.cfg.pickPlies || 1) && this.robot.pose.y > this.cycle.gripY + 0.06) {
      this.cycle.double = true;
      this.log(`Doppelgriff: ${heldCount} Lagen gleichzeitig gegriffen`, 'error');
    }
    if (this.cycle.gripY !== null && !this.cycle.empty && heldCount === 0 && this.robot.pose.y > this.cycle.gripY + 0.01) {
      this.cycle.empty = true;
      this.log('Greifer angehoben, aber keine Lage gefasst (Haltekraft zu gering oder noch nicht aufgebaut)', 'warn');
    }
    if (!anyOn) this.cycle.gripY = null;
  }

  // Lage, die zuerst unter dem Stapel ausgegeben wird (für UI)
  plyReport() {
    return this.cloths.map((c) => {
      const tr = this.track.get(c.id);
      const pose = c.pose2D();
      return { cloth: c, name: c.name, state: tr.state, pose, strain: tr.strain || 0, strainMax: tr.strainMax || 0, error: tr.error, wav: c.waviness(), speed: c.meanSpeed() };
    }).sort((a, b) => a.cloth.stackIndex - b.cloth.stackIndex);
  }
}
