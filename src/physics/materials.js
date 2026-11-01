// Materialdatenbank.
//
// Textilkennwerte sind typische Literatur-/Prüfwerte (KES-F, FAST, DIN EN ISO 9237,
// DIN 53887, ASTM D1388, DIN EN ISO 13934). Gespeichert wird in den in der
// Textilprüfung üblichen Einheiten; die Umrechnung nach SI erfolgt in toSI().
// Alle Werte lassen sich im UI durch eigene Messwerte ersetzen.
//
//  mass        Flächenmasse                        g/m²
//  thickness   Dicke (bei 0,5 kPa)                 mm
//  tensWarp    Zugsteifigkeit Kette (Sekante)      N/m   (Kraft je Breite / Dehnung)
//  tensWeft    Zugsteifigkeit Schuss               N/m
//  shear       Schersteifigkeit G (KES)            gf/cm/°
//  bendWarp    Biegesteifigkeit B Kette (KES)      gf·cm²/cm
//  bendWeft    Biegesteifigkeit B Schuss (KES)     gf·cm²/cm
//  muSteelS/K  Haft-/Gleitreibung gegen Stahl      –
//  muSelfS/K   Haft-/Gleitreibung Stoff auf Stoff  –
//  airPerm     Luftdurchlässigkeit bei 100 Pa      l/(m²·s)
//  epsR        rel. Permittivität (65 % r.F.)      –
//  needleHold  Haltekraft je Nadel (voll eingest.) N
//  cohesion    Lagenhaftung (Faserverhakung,
//              Elektrostatik)                      Pa
//  wetting     Benetzbarkeit/Wasseraufnahme 0…1    –   (Kryogreifer)
//  breakStrain Bruchdehnung                        %

import { UNIT } from './constants.js';

export const FABRICS = [
  {
    id: 'popeline', name: 'Baumwoll-Popeline', composition: '100 % CO', construction: 'Leinwandbindung',
    pattern: 'plain', color: '#dfe6ee',
    mass: 120, thickness: 0.25, tensWarp: 6000, tensWeft: 3800, shear: 0.75,
    bendWarp: 0.07, bendWeft: 0.045, muSteelS: 0.26, muSteelK: 0.21, muSelfS: 0.46, muSelfK: 0.38,
    airPerm: 60, epsR: 2.0, needleHold: 0.05, cohesion: 0.6, wetting: 0.9, breakStrain: 12,
  },
  {
    id: 'denim', name: 'Denim 12 oz', composition: '98 % CO / 2 % EL', construction: 'Köper 3/1',
    pattern: 'twill', color: '#3d5a80',
    mass: 400, thickness: 0.75, tensWarp: 14000, tensWeft: 7000, shear: 2.6,
    bendWarp: 1.2, bendWeft: 0.6, muSteelS: 0.31, muSteelK: 0.25, muSelfS: 0.56, muSelfK: 0.46,
    airPerm: 25, epsR: 2.1, needleHold: 0.25, cohesion: 1.0, wetting: 0.8, breakStrain: 18,
  },
  {
    id: 'jersey', name: 'Single Jersey', composition: '95 % CO / 5 % EL', construction: 'Rechts/Links-Maschenware',
    pattern: 'knit', color: '#e9c46a',
    mass: 180, thickness: 0.55, tensWarp: 900, tensWeft: 300, shear: 0.35,
    bendWarp: 0.03, bendWeft: 0.015, muSteelS: 0.30, muSteelK: 0.25, muSelfS: 0.52, muSelfK: 0.42,
    airPerm: 900, epsR: 2.0, needleHold: 0.04, cohesion: 1.5, wetting: 0.9, breakStrain: 90,
  },
  {
    id: 'satin', name: 'Polyester-Satin', composition: '100 % PES', construction: 'Atlas 5-bindig',
    pattern: 'satin', color: '#c9a7d8',
    mass: 90, thickness: 0.15, tensWarp: 6500, tensWeft: 4500, shear: 0.4,
    bendWarp: 0.03, bendWeft: 0.02, muSteelS: 0.16, muSteelK: 0.12, muSelfS: 0.21, muSelfK: 0.17,
    airPerm: 15, epsR: 3.0, needleHold: 0.04, cohesion: 0.2, wetting: 0.3, breakStrain: 25,
  },
  {
    id: 'chiffon', name: 'Seiden-Chiffon', composition: '100 % SE', construction: 'Leinwand, Kreppgarn',
    pattern: 'plain', color: '#f4d6d6',
    mass: 40, thickness: 0.10, tensWarp: 2000, tensWeft: 1600, shear: 0.15,
    bendWarp: 0.008, bendWeft: 0.006, muSteelS: 0.25, muSteelK: 0.20, muSelfS: 0.40, muSelfK: 0.34,
    airPerm: 2500, epsR: 2.5, needleHold: 0.01, cohesion: 0.3, wetting: 0.5, breakStrain: 20,
  },
  {
    id: 'wolle', name: 'Wollanzugstoff', composition: '100 % WO', construction: 'Köper 2/2',
    pattern: 'twill', color: '#5c5f66',
    mass: 250, thickness: 0.45, tensWarp: 4500, tensWeft: 3500, shear: 0.6,
    bendWarp: 0.12, bendWeft: 0.10, muSteelS: 0.28, muSteelK: 0.23, muSelfS: 0.55, muSelfK: 0.46,
    airPerm: 150, epsR: 2.2, needleHold: 0.12, cohesion: 3.0, wetting: 0.5, breakStrain: 30,
  },
  {
    id: 'vlies', name: 'Einlagevlies (PES)', composition: '100 % PES', construction: 'Vliesstoff, thermisch verfestigt',
    pattern: 'nonwoven', color: '#f2f2ee',
    mass: 50, thickness: 0.30, tensWarp: 3300, tensWeft: 2500, shear: 3.0,
    bendWarp: 0.10, bendWeft: 0.10, muSteelS: 0.40, muSteelK: 0.34, muSelfS: 0.62, muSelfK: 0.52,
    airPerm: 1500, epsR: 2.6, needleHold: 0.15, cohesion: 4.0, wetting: 0.4, breakStrain: 35,
  },
  {
    id: 'leder', name: 'Nappaleder 1,0 mm', composition: 'Rind, chromgegerbt', construction: 'Narbenleder',
    pattern: 'leather', color: '#8a4b2a',
    mass: 700, thickness: 1.0, tensWarp: 9000, tensWeft: 7000, shear: 4.0,
    bendWarp: 4.0, bendWeft: 3.5, muSteelS: 0.45, muSteelK: 0.38, muSelfS: 0.55, muSelfK: 0.48,
    airPerm: 1, epsR: 3.5, needleHold: 0.6, cohesion: 0.2, wetting: 0.2, breakStrain: 45,
  },
  {
    id: 'aramid', name: 'Aramidgewebe', composition: '100 % PPTA', construction: 'Leinwandbindung',
    pattern: 'plain', color: '#e3b23c',
    mass: 200, thickness: 0.30, tensWarp: 90000, tensWeft: 85000, shear: 1.5,
    bendWarp: 0.40, bendWeft: 0.40, muSteelS: 0.22, muSteelK: 0.18, muSelfS: 0.35, muSelfK: 0.30,
    airPerm: 40, epsR: 3.5, needleHold: 0.20, cohesion: 0.5, wetting: 0.4, breakStrain: 4,
  },
  {
    id: 'glas', name: 'Glasfasergewebe', composition: 'E-Glas', construction: 'Köper 2/2',
    pattern: 'twill', color: '#eef3f3',
    mass: 300, thickness: 0.28, tensWarp: 110000, tensWeft: 100000, shear: 0.9,
    bendWarp: 0.8, bendWeft: 0.8, muSteelS: 0.20, muSteelK: 0.16, muSelfS: 0.30, muSelfK: 0.25,
    airPerm: 80, epsR: 4.5, needleHold: 0.10, cohesion: 0.3, wetting: 0.6, breakStrain: 3,
  },
];

// Starre Werkstoffe für Tische, Maschinen- und Greiferteile. Sie verformen sich bei den
// auftretenden Kräften um Größenordnungen weniger als Textilien (E-Modul GPa vs. kPa–MPa)
// und werden deshalb als starr modelliert. frictionFactor skaliert die Stoff-Stahl-Reibung.
export const SOLIDS = {
  stahl:    { name: 'Stahl, poliert',         density: 7850, E: 210e9, poisson: 0.30, frictionFactor: 1.0, color: '#b8bec6' },
  alu:      { name: 'Aluminium, eloxiert',    density: 2700, E: 70e9,  poisson: 0.33, frictionFactor: 1.05, color: '#a9b1ba' },
  hpl:      { name: 'HPL-Schichtstoff',       density: 1400, E: 10e9,  poisson: 0.30, frictionFactor: 1.15, color: '#d9d4c7' },
  ptfe:     { name: 'PTFE-beschichtet',       density: 2200, E: 0.5e9, poisson: 0.46, frictionFactor: 0.45, color: '#ece9e2' },
  gummi:    { name: 'Gummi (NBR)',            density: 1300, E: 5e6,   poisson: 0.49, frictionFactor: 2.2, color: '#222326' },
  buche:    { name: 'Buche, lackiert',        density: 720,  E: 14e9,  poisson: 0.35, frictionFactor: 1.25, color: '#c49a6c' },
  beton:    { name: 'Beton, versiegelt',      density: 2400, E: 30e9,  poisson: 0.20, frictionFactor: 1.6, color: '#8d8f8f' },
  guss:     { name: 'Grauguss (Maschine)',    density: 7200, E: 110e9, poisson: 0.26, frictionFactor: 1.05, color: '#6f7a72' },
};

export function fabricById(id) {
  return FABRICS.find((f) => f.id === id) || FABRICS[0];
}

// Umrechnung in SI-Einheiten für den Solver.
export function toSI(f) {
  return {
    ...f,
    rho: f.mass * UNIT.gPerM2,                       // kg/m²
    t: f.thickness * UNIT.mm,                        // m
    Tw: f.tensWarp, Tf: f.tensWeft,                  // N/m
    Gs: f.shear * UNIT.gfPerCmPerDeg,                // N/m/rad
    Bw: f.bendWarp * UNIT.gfcm2PerCm,                // N·m
    Bf: f.bendWeft * UNIT.gfcm2PerCm,                // N·m
    k: f.airPerm * UNIT.lPerM2sAt100Pa,              // m/(s·Pa)
  };
}

// Peirce-Biegelänge c = (B / w)^(1/3), w = Flächengewicht [N/m²] (ASTM D1388).
export function bendingLength(f, dir = 'warp') {
  const s = toSI(f);
  const B = dir === 'warp' ? s.Bw : s.Bf;
  return Math.cbrt(B / (s.rho * 9.80665));
}

// Felder für den Material-Editor im UI.
export const FABRIC_FIELDS = [
  ['mass', 'Flächenmasse', 'g/m²'],
  ['thickness', 'Dicke', 'mm'],
  ['tensWarp', 'Zugsteifigkeit Kette', 'N/m'],
  ['tensWeft', 'Zugsteifigkeit Schuss', 'N/m'],
  ['shear', 'Schersteifigkeit G', 'gf/cm/°'],
  ['bendWarp', 'Biegesteifigkeit B Kette', 'gf·cm²/cm'],
  ['bendWeft', 'Biegesteifigkeit B Schuss', 'gf·cm²/cm'],
  ['muSteelS', 'Haftreibung Stoff/Stahl', 'μ'],
  ['muSteelK', 'Gleitreibung Stoff/Stahl', 'μ'],
  ['muSelfS', 'Haftreibung Stoff/Stoff', 'μ'],
  ['muSelfK', 'Gleitreibung Stoff/Stoff', 'μ'],
  ['airPerm', 'Luftdurchlässigkeit (100 Pa)', 'l/m²s'],
  ['epsR', 'Permittivität εr', '–'],
  ['needleHold', 'Haltekraft je Nadel', 'N'],
  ['cohesion', 'Lagenhaftung', 'Pa'],
  ['wetting', 'Benetzbarkeit', '0…1'],
  ['breakStrain', 'Bruchdehnung', '%'],
];
