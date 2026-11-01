// Physikalische Konstanten (SI-Einheiten). Referenzzustand: 20 °C, 101,325 kPa, Meereshöhe.
export const G = 9.80665;                 // Normfallbeschleunigung [m/s²] (CGPM 1901)
export const GRAVITY = [0, -G, 0];        // y-Achse zeigt nach oben

export const AIR = {
  density: 1.204,                         // Luftdichte [kg/m³] bei 20 °C
  viscosity: 1.813e-5,                    // dynamische Viskosität [Pa·s]
  pressure: 101325,                       // Umgebungsdruck [Pa]
  temperature: 293.15,                    // [K]
  breakdownField: 3.0e6,                  // Durchschlagfeldstärke Luft [V/m]
};

export const EPS0 = 8.8541878128e-12;     // elektrische Feldkonstante [F/m]

// Umrechnungen der in der Textilprüfung üblichen Einheiten (KES-F / FAST) nach SI.
export const UNIT = {
  // Biegesteifigkeit B: gf·cm²/cm -> N·m (= N·m²/m)
  gfcm2PerCm: 9.80665e-5,
  // Schersteifigkeit G: gf/cm/° -> N/m/rad
  gfPerCmPerDeg: 0.980665 * 180 / Math.PI,
  // Luftdurchlässigkeit: l/(m²·s) bei 100 Pa -> Darcy-Leitwert m/(s·Pa)
  lPerM2sAt100Pa: 1e-3 / 100,
  gPerM2: 1e-3,                           // Flächenmasse g/m² -> kg/m²
  mm: 1e-3,
  lPerMin: 1e-3 / 60,                     // Volumenstrom l/min -> m³/s
};
