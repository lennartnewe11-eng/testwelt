#!/usr/bin/env python3
"""Grundschnitt Jacke (Trucker-Form, slim, Größe L): Vorderteil, Rücken, Ärmel
in zwei Varianten: Ärmel zweiteilig (hintere Ärmelnaht) oder einteilig.

Alle Maße in cm. Koordinaten: x nach rechts, y nach unten.
Rücken:    Ursprung = hintere Mitte am Halsausschnitt, x nach außen zur Seitennaht.
Vorderteil: Ursprung = vordere Mitte auf Höhe hintere Halsmitte, x nach außen.
           Brustlinie und Saum liegen bei Vorder- und Rückenteil auf gleicher Höhe.
Ärmel:     Ursprung = Kugelhöhe-Oberkante in der Ärmelmitte.

Erzeugt im selben Ordner je Variante <v> = zweiteilig | einteilig:
  grundschnitt_<v>_1zu1.svg   alle Teile 1:1 mit Maßen (für Plotter / Copyshop)
  grundschnitt_<v>_A4.pdf     Übersicht + zum Zusammenkleben gekachelte A4-Seiten
  grundschnitt_<v>_A0.pdf     eine große Seite 1:1 (Copyshop / Plotter)
  masse_<v>.json              verwendete Maße und Kontrollmaße der Teile

Aufruf: python3 grundschnitt.py
Benötigt: numpy, shapely, reportlab
"""
import json
import math
import os
from datetime import date

import numpy as np
from shapely.geometry import LineString, Point, Polygon

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- Maße
# "vorgabe": von dir genannt; "annahme": Größe L (Herren, DE 52/54) bis du nachmisst
KOERPER = {
    "Umfang auf Saumhöhe (dort endet die Jacke)": (96, "vorgabe"),
    "Brustumfang": (106, "annahme"),
    "Halsumfang": (41, "annahme"),
    "Oberarmumfang": (34, "annahme"),
    "Körpergröße": (180, "annahme"),
}

M = dict(
    # Jacke (Fertigmaße)
    vl_cf=59.0,          # Vorderlänge: vordere Mitte Halsausschnitt bis Saum (vorgabe)
    schulterbreite=50.0,  # Schulterpunkt zu Schulterpunkt, gerade gemessen (vorgabe 49–51)
    brust=114.0,         # Brustweite Jacke (Körper 106 + 8)
    saum=105.0,          # Saumweite (Körper auf Saumhöhe 96 + 9)
    halsweite_h=8.2,     # hintere Halslochbreite
    halsweite_v=7.9,     # vordere Halslochbreite
    hals_hoch_h=2.3,     # hintere Halslochhöhe (HPS über hinterer Mitte)
    vorn_mehr=1.0,       # vorderer Halspunkt liegt höher als hinterer (Brustwölbung)
    halstiefe_v=8.7,     # vordere Halslochtiefe unter HPS
    schulterneig_h=17.0,  # Grad
    schulterneig_v=22.0,  # Grad
    schulter_mehr_h=0.5,  # hintere Schulternaht länger (Einhalten)
    armloch_tiefe=26.0,  # hintere Mitte Hals bis Brustlinie
    rueckenbreite=22.0,  # halbe Rückenbreite Jacke
    brustbreite=20.5,    # halbe Brustbreite Jacke
    taille_y=46.0,       # Taillenlinie ab hinterer Mitte Hals (Orientierung, Knips)
    # Ärmel
    aermellaenge=64.0,   # Kugeloberkante bis Saum (Ärmelmitte)
    oberarm=42.0,        # Oberarmweite Ärmel
    aermelsaum=27.0,     # Saumweite Ärmel
    ellbogen=35.0,       # Ellbogenhöhe ab Kugeloberkante
    kugel_mehrweite=1.2,  # Mehrweite Kugel gegenüber Armloch (Denim: wenig)
    hinternaht_kugel=14.0,  # hintere Ärmelnaht beginnt so weit (Bogen) über der Unterarmnaht
    hinternaht_saum=0.45,   # Lage am Saum: Anteil der halben Saumweite hinter der Mitte
    ellbogen_mehrweite=1.0,  # Oberärmel an der hinteren Naht länger -> Ärmel biegt nach vorn
)
# Seitennaht: halbe Weiten auf Rücken / Vorderteil verteilt (Rücken etwas breiter)
SEITE_H = dict(brust=29.0, saum=26.5)
SEITE_V = dict(brust=M["brust"] / 2 - 29.0, saum=M["saum"] / 2 - 26.5)


def seitennaht(sc, ss):
    """Von der Brustlinie gleichmäßig zum engeren Saum; oben und unten senkrecht."""
    return bez(sc, sc + (0, 13), ss - (0, 15), ss, n=96)

NZ = 1.5    # Nahtzugabe
SAUMZ = 3.0  # Saumzugabe


# ---------------------------------------------------------------- Geometrie
def bez(p0, p1, p2, p3, n=48):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = (np.array(p, float) for p in (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def seg(a, b):
    return np.array([a, b], float)


def cat(*parts):
    out = [parts[0]]
    for p in parts[1:]:
        out.append(p[1:])
    return np.vstack(out)


def laenge(pts):
    return float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1)))


def bei(pts, s):
    """Punkt und Einheitstangente bei Bogenlänge s."""
    d = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    c = np.concatenate([[0], np.cumsum(d)])
    s = min(max(s, 0), c[-1])
    i = min(np.searchsorted(c, s, side="right") - 1, len(d) - 1)
    f = (s - c[i]) / d[i] if d[i] else 0
    p = pts[i] + f * (pts[i + 1] - pts[i])
    t = (pts[i + 1] - pts[i]) / d[i]
    return p, t


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def dirdeg(deg):
    r = math.radians(deg)
    return np.array([math.cos(r), math.sin(r)])


def perp(v):  # 90° im Uhrzeigersinn auf dem Bildschirm (y nach unten)
    return np.array([-v[1], v[0]])


class Teil:
    def __init__(self, name):
        self.name = name
        self.kanten = []   # (name, pts, zugabe)
        self.innen = []    # Hilfslinien, Knipse, Texte (lokale Koordinaten)

    def kante(self, name, pts, zugabe):
        self.kanten.append((name, np.asarray(pts, float), zugabe))

    def k(self, name):
        return next(p for n, p, _ in self.kanten if n == name)

    def naht(self):
        return cat(*[p for _, p, _ in self.kanten])

    def poly(self):
        return Polygon(self.naht())

    def schnitt(self):
        """Schnittkante: jede Kante um ihre Zugabe nach außen versetzt, Ecken auf Gehrung."""
        poly = self.poly()
        offs = []
        for _, pts, z in self.kanten:
            if z == 0:
                offs.append(pts.copy())
                continue
            ls = LineString(pts)
            op = None
            for d in (z, -z):
                oc = ls.offset_curve(d, join_style="mitre", mitre_limit=5)
                cand = np.array(oc.coords)
                if np.linalg.norm(cand[0] - pts[0]) > np.linalg.norm(cand[-1] - pts[0]):
                    cand = cand[::-1]
                if not poly.buffer(1e-3).contains(oc.interpolate(0.5, normalized=True)):
                    op = cand
                    break
            offs.append(op)
        n = len(offs)
        for i in range(n):
            a, b = offs[i], offs[(i + 1) % n]
            ecke = self.kanten[i][1][-1]
            zmax = max(self.kanten[i][2], self.kanten[(i + 1) % n][2])
            p = schnittpunkt(a[-2], a[-1], b[0], b[1])
            # spitze Ecken nicht als lange Spitze auslaufen lassen, sondern gerade abschneiden
            if p is not None and np.linalg.norm(p - ecke) <= 2.0 * zmax:
                a[-1] = p
                b[0] = p
        return np.vstack(offs)


def schnittpunkt(a1, a2, b1, b2):
    da, db = a2 - a1, b2 - b1
    den = da[0] * db[1] - da[1] * db[0]
    if abs(den) < 1e-9:
        return None
    t = ((b1[0] - a1[0]) * db[1] - (b1[1] - a1[1]) * db[0]) / den
    return a1 + t * da


# ---------------------------------------------------------------- Rücken
def ruecken():
    T = Teil("Rücken")
    cbn = np.array([0.0, 0.0])
    hps = np.array([M["halsweite_h"], -M["hals_hoch_h"]])
    sd = dirdeg(M["schulterneig_h"])
    lsh = (M["schulterbreite"] / 2 - hps[0]) / sd[0]
    sp = hps + lsh * sd
    y_brust = M["armloch_tiefe"]
    y_saum = M["halstiefe_v"] - M["hals_hoch_h"] - M["vorn_mehr"] + M["vl_cf"]
    rb = M["rueckenbreite"]
    sc = np.array([SEITE_H["brust"], y_brust])
    ss = np.array([SEITE_H["saum"], y_saum])
    yb = (sp[1] + y_brust) / 2 + 0.5

    # Halsloch kommt rechtwinklig zur Schulter an
    hals = bez(cbn, (4.5, 0), hps + 1.2 * np.array([-sd[1], sd[0]]), hps)
    schulter = seg(hps, sp)
    a_dir = np.array([-sd[1], sd[0]])  # rechtwinklig zur Schulter, nach unten
    arm = cat(bez(sp, sp + 4 * a_dir, (rb, yb - 4), (rb, yb)),
              bez((rb, yb), (rb, y_brust - 4), (rb + 2.0, y_brust), sc))
    seite = seitennaht(sc, ss)
    saum = seg(ss, (0, y_saum))
    bruch = seg((0, y_saum), cbn)

    T.kante("Halsloch", hals, NZ)
    T.kante("Schulter", schulter, NZ)
    T.kante("Armloch", arm, NZ)
    T.kante("Seitennaht", seite, NZ)
    T.kante("Saum", saum, SAUMZ)
    T.kante("Stoffbruch", bruch, 0)
    T.punkte = dict(hps=hps, sp=sp, sc=sc, ss=ss, y_brust=y_brust, y_saum=y_saum, yb=yb)
    return T


# ---------------------------------------------------------------- Vorderteil
def vorderteil():
    T = Teil("Vorderteil")
    hps = np.array([M["halsweite_v"], -M["hals_hoch_h"] - M["vorn_mehr"]])
    cfn = np.array([0.0, hps[1] + M["halstiefe_v"]])
    y_saum = cfn[1] + M["vl_cf"]
    sd = dirdeg(M["schulterneig_v"])
    lsh_h = (M["schulterbreite"] / 2 - M["halsweite_h"]) / dirdeg(M["schulterneig_h"])[0]
    lsh = lsh_h - M["schulter_mehr_h"]
    sp = hps + lsh * sd
    y_brust = M["armloch_tiefe"]
    bb = M["brustbreite"]
    sc = np.array([SEITE_V["brust"], y_brust])
    ss = np.array([SEITE_V["saum"], y_saum])
    yb = (sp[1] + y_brust) / 2 + 1.5
    a_dir = np.array([-sd[1], sd[0]])

    schulter = seg(hps, sp)
    arm = cat(bez(sp, sp + 4 * a_dir, (bb, yb - 4), (bb, yb)),
              bez((bb, yb), (bb, y_brust - 4), (bb + 2.0, y_brust), sc))
    seite = seitennaht(sc, ss)
    saum = seg(ss, (0, y_saum))
    vm = seg((0, y_saum), cfn)
    hals = bez(cfn, (4.6, cfn[1]), hps + 3.0 * a_dir, hps)

    T.kante("Schulter", schulter, NZ)
    T.kante("Armloch", arm, NZ)
    T.kante("Seitennaht", seite, NZ)
    T.kante("Saum", saum, SAUMZ)
    T.kante("Vordere Mitte", vm, NZ)
    T.kante("Halsloch", hals, NZ)
    T.punkte = dict(hps=hps, sp=sp, sc=sc, ss=ss, cfn=cfn, y_brust=y_brust, y_saum=y_saum, yb=yb)
    return T


# ---------------------------------------------------------------- Ärmel
def kugel(h, w):
    # vorne (links): tiefer ausgehöhlt; hinten (rechts): voller
    v = bez((-w, h), (-w + 7.6, h), (-6.4, 0), (0, 0))
    hi = bez((0, 0), (7.4, 0), (w - 6.2, h), (w, h))
    return v, hi


def rot_um(pts, P, th):
    """Drehung um P; th > 0 schwenkt Punkte unterhalb von P nach vorne (−x)."""
    c, sn = math.cos(th), math.sin(th)
    d = np.asarray(pts, float) - P
    return P + np.stack([d[..., 0] * c - d[..., 1] * sn, d[..., 0] * sn + d[..., 1] * c], axis=-1)


def teilen(pts, s):
    """Polylinie bei Bogenlänge s teilen."""
    p, _ = bei(pts, s)
    d = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    c = np.concatenate([[0], np.cumsum(d)])
    i = int(np.searchsorted(c, s))
    return np.vstack([pts[:i], p]), np.vstack([p, pts[i:]])


def auf_linie(a, b, y):
    a, b = np.asarray(a, float), np.asarray(b, float)
    return a + (b - a) * (y - a[1]) / (b[1] - a[1])


def kugelhoehe(ah_v, ah_h, w):
    ziel = ah_v + ah_h + M["kugel_mehrweite"]
    lo, hi = 8.0, 24.0
    for _ in range(60):
        h = (lo + hi) / 2
        v, b = kugel(h, w)
        if laenge(v) + laenge(b) < ziel:
            lo = h
        else:
            hi = h
    return h


def aermel_einteilig(ah_v, ah_h):
    """Einteiliger Ärmel ohne hintere Naht."""
    w = M["oberarm"] / 2
    h = kugelhoehe(ah_v, ah_h, w)
    v, b = kugel(h, w)
    L, s = M["aermellaenge"], M["aermelsaum"] / 2
    T = Teil("Ärmel")
    T.kante("Unterarmnaht vorne", seg((-s, L), (-w, h)), NZ)
    T.kante("Armkugel", cat(v, b), NZ)
    T.kante("Unterarmnaht hinten", seg((w, h), (s, L)), NZ)
    T.kante("Ärmelsaum", seg((s, L), (-s, L)), SAUMZ)
    return T, dict(h=h, w=w, s=s, L=L, ye=M["ellbogen"])


def aermel(ah_v, ah_h):
    """Zweiteiliger Ärmel: Oberärmel + Hinterärmel, hintere Naht mit Ellbogen-Mehrweite."""
    w = M["oberarm"] / 2
    ziel = ah_v + ah_h + M["kugel_mehrweite"]
    lo, hi = 8.0, 24.0
    for _ in range(60):
        h = (lo + hi) / 2
        v, b = kugel(h, w)
        if laenge(v) + laenge(b) < ziel:
            lo = h
        else:
            hi = h
    v, b = kugel(h, w)
    L = M["aermellaenge"]
    s = M["aermelsaum"] / 2
    ye = M["ellbogen"]

    # hintere Naht: von der hinteren Kugel gerade zum Saum
    b1, b2 = teilen(b, laenge(b) - M["hinternaht_kugel"])
    ct = b2[0]
    sh = np.array([M["hinternaht_saum"] * s, L])
    su = auf_linie(ct, sh, ye)
    fh, fa = np.array([-s, L]), np.array([-w, h])
    pf = auf_linie(fa, fh, ye)  # Drehpunkt: Unterarmnaht vorne auf Ellbogenhöhe

    def hinternaht(th):
        sl, sb = rot_um(su, pf, th), rot_um(sh, pf, th)
        du, dl = unit(su - ct), unit(sb - sl)
        A, B = su - 5 * du, sl + 5 * dl
        return cat(seg(ct, A), bez(A, A + 2.5 * du, B - 2.5 * dl, B), seg(B, sb)), A, B, sb

    gerade = float(np.linalg.norm(sh - ct))
    lo, hi = 0.0, 0.2
    for _ in range(60):
        th = (lo + hi) / 2
        if laenge(hinternaht(th)[0]) - gerade < M["ellbogen_mehrweite"]:
            lo = th
        else:
            hi = th
    naht_o, A, B, sb = hinternaht(th)
    fh2 = rot_um(fh, pf, th)
    vorn = bez(fh2, fh2 + 2 / 3 * (pf - fh2), fa + 2 / 3 * (pf - fa), fa, n=96)

    O = Teil("Oberärmel")
    O.kante("Unterarmnaht", vorn, NZ)
    O.kante("Armkugel", cat(v, b1), NZ)
    O.kante("Hintere Ärmelnaht", naht_o, NZ)
    O.kante("Ärmelsaum", seg(sb, fh2), SAUMZ)

    H = Teil("Hinterärmel")
    H.kante("Hintere Ärmelnaht", seg(sh, ct), NZ)
    H.kante("Armkugel", b2, NZ)
    H.kante("Unterarmnaht", seg((w, h), (s, L)), NZ)
    H.kante("Ärmelsaum", seg((s, L), sh), SAUMZ)

    info = dict(h=h, w=w, s=s, L=L, ye=ye, th=th, ct=ct, sh=sh, su=su, pf=pf,
                a_oben=float(np.linalg.norm(A - ct)), b_unten=float(np.linalg.norm(sb - B)),
                vorschub=float(-(rot_um(np.array([0.0, L]), pf, th)[0])))
    return O, H, info


# ---------------------------------------------------------------- Markierungen
def knips(T, kname, s, von_ende=False, doppelt=False, zug=NZ):
    pts = T.k(kname)
    if von_ende:
        s = laenge(pts) - s
    out = []
    for ds in ([-0.35, 0.35] if doppelt else [0.0]):
        p, t = bei(pts, s + ds)
        n = perp(t)
        if T.poly().contains(Point(p + 0.05 * n)):
            n = -n
        out.append(("knips", np.array([p - 0.25 * n, p + (zug + 0.05) * n])))
    T.innen += out
    return out


def fadenlauf(T, a, b):
    a, b = np.array(a, float), np.array(b, float)
    d = unit(b - a)
    n = perp(d)
    T.innen.append(("faden", np.array([a, b])))
    m = (a + b) / 2 + 0.6 * n
    T.innen.append(("text", m, "FADENLAUF", 0.8, "middle", math.degrees(math.atan2(d[1], d[0])), "normal"))
    for p, dd in ((a, d), (b, -d)):
        T.innen.append(("faden", np.array([p + 1.2 * dd + 0.5 * n, p, p + 1.2 * dd - 0.5 * n])))


def hilfslinie(T, pts, text=None, at=None, rot=0, groesse=0.9, anker="start"):
    T.innen.append(("hilf", np.array(pts, float)))
    if text:
        T.innen.append(("text", np.array(at, float), text, groesse, anker, rot, "normal"))


def text(T, at, s, groesse=1.2, anker="middle", rot=0, gewicht="normal"):
    T.innen.append(("text", np.array(at, float), s, groesse, anker, rot, gewicht))


def zahl(v, d=1):
    t = f"{round(v, d):.{d}f}"
    if "." in t:
        t = t.rstrip("0").rstrip(".")
    return t.replace(".", ",")


def lesbar(d):
    a = math.degrees(math.atan2(d[1], d[0]))
    if a > 90:
        a -= 180
    elif a < -90:
        a += 180
    return a


def masslinie(T, a, b, txt, t=0.5, g=0.7, unten=False):
    """Maßlinie mit Pfeilen; Text liest sich entlang der Linie."""
    a, b = np.array(a, float), np.array(b, float)
    d = unit(b - a)
    n = perp(d)
    T.innen.append(("mass", np.array([a, b])))
    for p, dd in ((a, d), (b, -d)):
        T.innen.append(("mass", np.array([p + 0.7 * dd + 0.25 * n, p, p + 0.7 * dd - 0.25 * n])))
    ar = math.radians(lesbar(d))
    u = np.array([math.sin(ar), -math.cos(ar)])  # "oben" des Textes
    m = a + (b - a) * t
    m = m - (0.25 + 0.75 * g) * u if unten else m + 0.25 * u
    T.innen.append(("text", m, txt, g, "middle", math.degrees(ar), "mass"))


def weite(T, y, txt, t=0.3, g=0.7, x0=-60, x1=60):
    """Waagerechte Maßlinie über die ganze Breite des Teils (Nahtlinie) auf Höhe y."""
    c = schnitt_bis_kante(T.poly(), y, x0, x1)
    a, b = c[0], c[-1]
    if a[0] > b[0]:
        a, b = b, a
    masslinie(T, a, b, f"{txt} {zahl(b[0] - a[0])}", t=t, g=g)
    return b[0] - a[0]


def nahtmass(T, kname, txt, f=0.5, rein=1.0, g=0.65, s0=None, s1=None):
    """Länge einer Naht (oder eines Abschnitts s0..s1) als Text an der Naht."""
    pts = T.k(kname)
    s0 = 0.0 if s0 is None else s0
    s1 = laenge(pts) if s1 is None else s1
    p, tg = bei(pts, s0 + f * (s1 - s0))
    n = perp(tg)
    if not T.poly().contains(Point(p + 0.05 * n)):
        n = -n
    ar = math.radians(lesbar(tg))
    u = np.array([math.sin(ar), -math.cos(ar)])
    q = p + rein * n
    if np.dot(u, n) > 0:  # Text wächst nach innen: Grundlinie näher an die Naht
        q = p + 0.45 * n
    T.innen.append(("text", q, f"{txt} {zahl(s1 - s0)}", g, "middle", math.degrees(ar), "mass"))


def bis_y(pts, y):
    """Bogenlänge vom Anfang bis zur Höhe y."""
    i = int(np.argmax(pts[:, 1] >= y))
    return laenge(pts[: i + 1])


def x_bei_y(pts, y):
    i = int(np.argmax(pts[:, 1] >= y))
    a, b = pts[i - 1], pts[i]
    return float(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]))


def schnitt_bis_kante(poly, y, x0, x1):
    ln = LineString([(x0, y), (x1, y)]).intersection(poly)
    c = np.array(ln.coords) if ln.geom_type == "LineString" else np.array(list(ln.geoms)[0].coords)
    return c


# ---------------------------------------------------------------- Aufbau
VARIANTEN = {
    "zweiteilig": "Ärmel zweiteilig (mit hinterer Ärmelnaht)",
    "einteilig": "Ärmel einteilig (ohne hintere Ärmelnaht)",
}


def bauen(variante="zweiteilig"):
    R, V = ruecken(), vorderteil()
    ah_h, ah_v = laenge(R.k("Armloch")), laenge(V.k("Armloch"))
    ah = ah_h + ah_v
    mw = M["kugel_mehrweite"]
    # Schulterknips auf der Kugel: Mehrweite anteilig auf vorne/hinten
    s_schulter = ah_v + mw * ah_v / ah
    KN_V, KN_H = 8.0, 9.0  # Knipse im Armloch ab Seitennaht
    kopf = "Grundschnitt Jacke · Gr. L slim"

    # Rücken
    p = R.punkte
    fadenlauf(R, (6, 16), (6, p["y_saum"] - 8))
    for y, t in ((p["y_brust"], "Brustlinie"), (M["taille_y"], "Taillenlinie")):
        c = schnitt_bis_kante(R.poly(), y, 0, 40)
        hilfslinie(R, c, t, (c[0][0] + 9, y - 0.4), groesse=0.8)
    text(R, (15, 30.5), "RÜCKEN", 1.8, gewicht="bold")
    text(R, (15, 33.0), "1× im Stoffbruch", 1.1)
    text(R, (15, 35.0), kopf, 0.8)
    text(R, (15, 36.4), f"NZ {NZ:g} cm · Saum {SAUMZ:g} cm inkl.", 0.8)
    text(R, (15, 37.8), f"Schulterbreite gesamt {zahl(M['schulterbreite'])} cm", 0.8)
    text(R, (-0.6, 40), "STOFFBRUCH  · hintere Mitte", 1.0, rot=-90)
    knips(R, "Armloch", KN_H, von_ende=True, doppelt=True)
    knips(R, "Seitennaht", bis_y(R.k("Seitennaht"), M["taille_y"]))
    for y in (12, p["y_saum"] - 12):
        R.innen.append(("faden", np.array([(4.0, y - 2.5), (1.2, y - 2.5), (1.2, y + 2.5), (4.0, y + 2.5)])))
        R.innen.append(("faden", np.array([(1.8, y - 3.0), (1.2, y - 2.5), (1.8, y - 2.0)])))
        R.innen.append(("faden", np.array([(1.8, y + 2.0), (1.2, y + 2.5), (1.8, y + 3.0)])))
    masslinie(R, (0.6, 0), (0.6, p["y_saum"]), f"Rückenlänge {zahl(p['y_saum'])}", t=0.5, unten=True)
    weite(R, p["y_brust"], "½ Brust", t=0.6, x0=0)
    weite(R, M["taille_y"], "½ Weite Taillenhöhe", t=0.72, x0=0)
    weite(R, p["y_saum"] - 2.0, "½ Saum", t=0.6, x0=0)
    nahtmass(R, "Halsloch", "Halsloch", f=0.45)
    nahtmass(R, "Schulter", "Schulter")
    nahtmass(R, "Armloch", "Armloch", f=0.35)
    nahtmass(R, "Seitennaht", "Seitennaht", f=0.75)

    # Vorderteil
    p = V.punkte
    fadenlauf(V, (4.5, 18), (4.5, p["y_saum"] - 8))
    for y, t in ((p["y_brust"], "Brustlinie"), (M["taille_y"], "Taillenlinie")):
        c = schnitt_bis_kante(V.poly(), y, 0, 40)
        hilfslinie(V, c, t, (c[0][0] + 10, y - 0.4), groesse=0.8)
    text(V, (14, 30.5), "VORDERTEIL", 1.8, gewicht="bold")
    text(V, (14, 33.0), "2× zuschneiden (gegengleich)", 1.1)
    text(V, (14, 35.0), kopf, 0.8)
    text(V, (14, 36.4), "Übertritt/Beleg folgen mit den Details", 0.8)
    text(V, (2.3, 42), "VORDERE MITTE", 1.0, anker="middle", rot=-90)
    knips(V, "Armloch", KN_V, von_ende=True)
    knips(V, "Seitennaht", bis_y(V.k("Seitennaht"), M["taille_y"]))
    masslinie(V, (0.6, p["cfn"][1]), (0.6, p["y_saum"]), f"Vorderlänge {zahl(M['vl_cf'])}", t=0.25, unten=True)
    weite(V, p["y_brust"], "½ Brust", t=0.6, x0=0)
    weite(V, M["taille_y"], "½ Weite Taillenhöhe", t=0.72, x0=0)
    weite(V, p["y_saum"] - 2.0, "½ Saum", t=0.6, x0=0)
    nahtmass(V, "Halsloch", "Halsloch", f=0.6)
    nahtmass(V, "Schulter", "Schulter")
    nahtmass(V, "Armloch", "Armloch", f=0.35)
    nahtmass(V, "Seitennaht", "Seitennaht", f=0.75)

    kontrolle = {
        "Brustweite Jacke": M["brust"],
        "Weite in Taillenhöhe": round(2 * (x_bei_y(R.k("Seitennaht"), M["taille_y"]) + x_bei_y(V.k("Seitennaht"), M["taille_y"])), 1),
        "Saumweite Jacke": M["saum"],
        "Schulterbreite": M["schulterbreite"],
        "Vorderlänge ab Halsloch Mitte": round(laenge(V.k("Vordere Mitte")), 1),
        "Rückenlänge ab Halsloch Mitte": round(laenge(R.k("Stoffbruch")), 1),
        "Schulternaht vorne": round(laenge(V.k("Schulter")), 1),
        "Schulternaht hinten": round(laenge(R.k("Schulter")), 1),
        "Seitennaht vorne": round(laenge(V.k("Seitennaht")), 1),
        "Seitennaht hinten": round(laenge(R.k("Seitennaht")), 1),
        "Armloch vorne": round(ah_v, 1),
        "Armloch hinten": round(ah_h, 1),
    }

    if variante == "einteilig":
        A, p = aermel_einteilig(ah_v, ah_h)
        h, ye, w, sh, L = p["h"], p["ye"], p["w"], p["s"], p["L"]
        kv = laenge(A.k("Armkugel"))
        fadenlauf(A, (6, h + 3), (6, L - 7))
        hilfslinie(A, [(-w, h), (w, h)], "Oberarmlinie", (-w + 1.5, h - 0.4), groesse=0.8)
        xe = w - (w - sh) * (ye - h) / (L - h)
        hilfslinie(A, [(-xe, ye), (xe, ye)], "Ellbogenlinie", (-xe + 1.5, ye - 0.4), groesse=0.8)
        text(A, (-10.5, h + 9), "ÄRMEL", 1.8, gewicht="bold")
        text(A, (-10.5, h + 11.5), "2× zuschneiden (gegengleich)", 1.0)
        text(A, (-10.5, h + 13.3), kopf, 0.8)
        text(A, (-w + 4.5, h + 4), "vorne", 1.0)
        text(A, (w - 4.5, h + 4), "hinten", 1.0)
        knips(A, "Armkugel", KN_V + 0.2)
        knips(A, "Armkugel", KN_H + 0.3, von_ende=True, doppelt=True)
        knips(A, "Armkugel", s_schulter)
        knips(A, "Unterarmnaht hinten", laenge(seg((w, h), (sh, L))) * (ye - h) / (L - h))
        masslinie(A, (-0.8, 0), (-0.8, L), f"Ärmellänge {zahl(L)}", t=0.82)
        masslinie(A, (0.8, 0), (0.8, h), f"Kugelhöhe {zahl(h)}", t=0.55, unten=True)
        weite(A, h, "Oberarmweite", t=0.6)
        weite(A, ye, "Ellbogenweite", t=0.6)
        masslinie(A, (-sh, L), (sh, L), f"Saumweite {zahl(2 * sh)}", t=0.3)
        nahtmass(A, "Armkugel", "Kugel vorne", s1=s_schulter)
        nahtmass(A, "Armkugel", "Kugel hinten", s0=s_schulter)
        nahtmass(A, "Unterarmnaht vorne", "Unterarmnaht", f=0.3)
        nahtmass(A, "Unterarmnaht hinten", "Unterarmnaht", f=0.7)
        teile = [R, V, A]
        kontrolle.update({
            "Armkugel gesamt": round(kv, 1),
            "Mehrweite Kugel": round(kv - ah, 1),
            "Kugelhöhe": round(h, 1),
            "Ärmellänge": M["aermellaenge"],
            "Oberarmweite Ärmel": M["oberarm"],
            "Saumweite Ärmel": M["aermelsaum"],
            "Unterarmnaht": round(laenge(A.k("Unterarmnaht hinten")), 1),
        })
    else:
        AO, AH, p = aermel(ah_v, ah_h)
        kv = laenge(AO.k("Armkugel")) + laenge(AH.k("Armkugel"))
        xs = lambda y: auf_linie(p["ct"], p["sh"], y)[0]
        xb = lambda y: p["w"] - (p["w"] - p["s"]) * (y - p["h"]) / (p["L"] - p["h"])
        ye, h, L = p["ye"], p["h"], p["L"]

        # Oberärmel
        fadenlauf(AO, (3.2, h + 3), (3.2, L - 8))
        hilfslinie(AO, [(-p["w"], h), (xs(h), h)], "Oberarmlinie", (-p["w"] + 1.5, h - 0.4), groesse=0.8)
        hilfslinie(AO, [p["pf"], p["su"]], "Ellbogenlinie", (p["pf"][0] + 1.5, ye - 0.4), groesse=0.8)
        text(AO, (-10.5, h + 9), "OBERÄRMEL", 1.8, gewicht="bold")
        text(AO, (-10.5, h + 11.5), "2× zuschneiden (gegengleich)", 1.0)
        text(AO, (-10.5, h + 13.3), kopf, 0.8)
        text(AO, (-p["w"] + 4.5, h + 4), "vorne", 1.0)
        text(AO, (xs(ye + 4) - 1.2, ye + 4), "Mehrweite", 0.7, anker="end")
        text(AO, (xs(ye + 5) - 1.2, ye + 5), "einhalten", 0.7, anker="end")
        knips(AO, "Armkugel", KN_V + 0.2)
        knips(AO, "Armkugel", s_schulter)
        knips(AO, "Unterarmnaht", bis_y(AO.k("Unterarmnaht")[::-1], ye), von_ende=True)
        knips(AO, "Hintere Ärmelnaht", p["a_oben"])
        knips(AO, "Hintere Ärmelnaht", p["b_unten"], von_ende=True)
        knick = np.array([-0.8, ye])
        unten = rot_um(np.array([-0.8, L]), p["pf"], p["th"])
        masslinie(AO, (-0.8, 0), knick, "", t=0.5)
        masslinie(AO, knick, unten, f"Ärmellänge Mitte {zahl(ye + np.linalg.norm(unten - knick))} (64 + Ellbogenweite)", t=0.7)
        AO.innen = [e for e in AO.innen if not (e[0] == "text" and e[2] == "")]
        masslinie(AO, (0.8, 0), (0.8, h), f"Kugelhöhe {zahl(h)}", t=0.55, unten=True)
        weite(AO, h, "Oberarm", t=0.6)
        weite(AO, ye, "Ellbogen", t=0.6)
        sb, fh2 = AO.k("Ärmelsaum")[0], AO.k("Ärmelsaum")[-1]
        nn = perp(unit(sb - fh2))
        if not AO.poly().contains(Point((sb + fh2) / 2 + 0.1 * nn)):
            nn = -nn
        masslinie(AO, fh2, sb, f"Saum {zahl(np.linalg.norm(sb - fh2))}", t=0.25)
        nahtmass(AO, "Armkugel", "Kugel vorne", s1=s_schulter)
        nahtmass(AO, "Armkugel", "Kugel hinten", s0=s_schulter, f=0.45)
        nahtmass(AO, "Unterarmnaht", "Unterarmnaht", f=0.3)
        nahtmass(AO, "Hintere Ärmelnaht", "Hintere Naht", f=0.8)

        # Hinterärmel
        xm = (xs(ye) + xb(ye)) / 2
        fadenlauf(AH, (xm + 1.0, ye - 14), (xm + 1.0, ye + 20))
        hilfslinie(AH, [(xs(h), h), (p["w"], h)])
        hilfslinie(AH, [p["su"], (xb(ye), ye)])
        text(AH, (xm - 1.6, ye + 12), "HINTERÄRMEL", 1.3, rot=-90, gewicht="bold")
        text(AH, (xm - 0.2, ye + 12), "2× (gegengleich)", 0.8, rot=-90)
        text(AH, (xb(h + 3) - 1.2, h + 3), "hinten", 0.9, anker="end")
        knips(AH, "Armkugel", KN_H + 0.3, von_ende=True, doppelt=True)
        knips(AH, "Unterarmnaht", float(np.linalg.norm(np.array([xb(ye), ye]) - np.array([p["w"], h]))))
        knips(AH, "Hintere Ärmelnaht", p["a_oben"], von_ende=True)
        knips(AH, "Hintere Ärmelnaht", p["b_unten"])
        weite(AH, h, "Oberarm", t=0.5, g=0.55)
        weite(AH, ye, "Ellbogen", t=0.5, g=0.55)
        masslinie(AH, p["sh"], (p["s"], L), f"Saum {zahl(p['s'] - p['sh'][0])}", t=0.5, g=0.55)
        nahtmass(AH, "Armkugel", "Kugel", g=0.55, f=0.4)
        nahtmass(AH, "Unterarmnaht", "Unterarmnaht", f=0.6, g=0.6)
        nahtmass(AH, "Hintere Ärmelnaht", "Hintere Naht", f=0.25, g=0.6)
        teile = [R, V, AO, AH]
        kontrolle.update({
            "Armkugel gesamt": round(kv, 1),
            "Mehrweite Kugel": round(kv - ah, 1),
            "Kugelhöhe": round(h, 1),
            "Ärmellänge": M["aermellaenge"],
            "Oberarmweite Ärmel": M["oberarm"],
            "Saumweite Ärmel": M["aermelsaum"],
            "Unterarmnaht": round(laenge(AH.k("Unterarmnaht")), 1),
            "Hintere Ärmelnaht Oberärmel": round(laenge(AO.k("Hintere Ärmelnaht")), 1),
            "Hintere Ärmelnaht Hinterärmel": round(laenge(AH.k("Hintere Ärmelnaht")), 1),
            "Ellbogen-Mehrweite (einhalten)": round(laenge(AO.k("Hintere Ärmelnaht")) - laenge(AH.k("Hintere Ärmelnaht")), 1),
            "Vorschub am Ärmelsaum": round(p["vorschub"], 1),
        })
    kontrolle["Halsloch gesamt (für Kragen)"] = round(2 * (laenge(V.k("Halsloch")) + laenge(R.k("Halsloch"))), 1)
    return teile, kontrolle


# ---------------------------------------------------------------- Layout
def layout(teile):
    """Teile nebeneinander anordnen; liefert Liste von Grafikelementen in Blattkoordinaten."""
    gap = 4.0
    x = 2.0
    elemente = []
    boxen = []
    for T in teile:
        cut = T.schnitt()
        minx, miny = cut.min(axis=0)
        maxx, maxy = cut.max(axis=0)
        off = np.array([x - minx, 2.0 - miny])
        elemente.append(("schnitt", cut + off))
        elemente.append(("naht", T.naht() + off))
        for e in T.innen:
            if e[0] == "text":
                elemente.append(("text", e[1] + off) + e[2:])
            else:
                elemente.append((e[0], e[1] + off))
        boxen.append((x, 2.0, maxx - minx, maxy - miny))
        x += (maxx - minx) + gap
    # Kontrollquadrat 10 × 10 cm
    qx, qy = x - 2.0, 2.0
    q = np.array([(qx, qy), (qx + 10, qy), (qx + 10, qy + 10), (qx, qy + 10), (qx, qy)])
    elemente.append(("quadrat", q))
    elemente.append(("text", np.array([qx + 5, qy + 5.3]), "10 × 10 cm", 1.0, "middle", 0, "bold"))
    elemente.append(("text", np.array([qx + 5, qy + 12]), "nach dem Druck", 0.7, "middle", 0, "normal"))
    elemente.append(("text", np.array([qx + 5, qy + 13]), "nachmessen!", 0.7, "middle", 0, "normal"))
    W = x + 9.0
    H = max(b[1] + b[3] for b in boxen) + 2
    return elemente, W, H


STIL = {
    "schnitt": dict(w=0.06, dash=None, col=(0, 0, 0)),
    "naht": dict(w=0.025, dash=(0.4, 0.25), col=(0.35, 0.35, 0.35)),
    "hilf": dict(w=0.02, dash=(1.0, 0.3, 0.2, 0.3), col=(0.2, 0.35, 0.7)),
    "faden": dict(w=0.035, dash=None, col=(0, 0, 0)),
    "knips": dict(w=0.05, dash=None, col=(0, 0, 0)),
    "quadrat": dict(w=0.04, dash=None, col=(0, 0, 0)),
    "mass": dict(w=0.02, dash=None, col=(0.72, 0.1, 0.1)),
}


def svg(elemente, W, H, pfad):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.2f}cm" height="{H:.2f}cm" '
           f'viewBox="0 0 {W:.3f} {H:.3f}">',
           f'<rect x="0" y="0" width="{W:.3f}" height="{H:.3f}" fill="#fff"/>']
    for e in elemente:
        if e[0] == "text":
            _, p, s, g, anker, rot, gew = e
            tr = f' transform="rotate({rot} {p[0]:.3f} {p[1]:.3f})"' if rot else ""
            fill = ' fill="rgb(184,26,26)"' if gew == "mass" else ""
            gw = "normal" if gew == "mass" else gew
            out.append(f'<text x="{p[0]:.3f}" y="{p[1]:.3f}" font-family="Helvetica, Arial, sans-serif" '
                       f'font-size="{g}" font-weight="{gw}" text-anchor="{anker}"{fill}{tr}>{s}</text>')
            continue
        st = STIL[e[0]]
        pts = " ".join(f"{x:.3f},{y:.3f}" for x, y in e[1])
        col = "rgb(%d,%d,%d)" % tuple(int(c * 255) for c in st["col"])
        dash = f' stroke-dasharray="{" ".join(map(str, st["dash"]))}"' if st["dash"] else ""
        tag = "polygon" if e[0] in ("schnitt", "naht") else "polyline"
        out.append(f'<{tag} points="{pts}" fill="none" stroke="{col}" stroke-width="{st["w"]}"'
                   f' stroke-linejoin="round"{dash}/>')
    out.append("</svg>")
    with open(pfad, "w", encoding="utf-8") as f:
        f.write("\n".join(out))


def pdf_zeichnen(c, elemente, H):
    from reportlab.lib.units import cm
    for e in elemente:
        if e[0] == "text":
            _, p, s, g, anker, rot, gew = e
            c.saveState()
            c.translate(p[0] * cm, (H - p[1]) * cm)
            c.rotate(-rot)
            c.setFillColorRGB(*((0.72, 0.1, 0.1) if gew == "mass" else (0, 0, 0)))
            c.setFont("Helvetica-Bold" if gew == "bold" else "Helvetica", g * cm)
            {"start": c.drawString, "middle": c.drawCentredString, "end": c.drawRightString}[anker](0, 0, s)
            c.restoreState()
            continue
        st = STIL[e[0]]
        c.setStrokeColorRGB(*st["col"])
        c.setLineWidth(st["w"] * cm)
        c.setDash([d * cm for d in st["dash"]] if st["dash"] else [])
        c.setLineJoin(1)
        pa = c.beginPath()
        pts = e[1]
        pa.moveTo(pts[0][0] * cm, (H - pts[0][1]) * cm)
        for x, y in pts[1:]:
            pa.lineTo(x * cm, (H - y) * cm)
        if e[0] in ("schnitt", "naht"):
            pa.close()
        c.drawPath(pa, stroke=1, fill=0)
    c.setDash([])


def pdf_gross(elemente, W, H, pfad, titel):
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(pfad, pagesize=(W * cm, H * cm))
    c.setTitle(f"Grundschnitt Jacke 1:1 – {titel}")
    pdf_zeichnen(c, elemente, H)
    c.showPage()
    c.save()


def pdf_a4(elemente, W, H, pfad, kontrolle, titel):
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    PW, PH = 21.0, 29.7
    RAND = 1.2
    TW, TH = PW - 2 * RAND, PH - 2 * RAND
    nx, ny = math.ceil(W / TW), math.ceil(H / TH)
    # welche Kacheln enthalten etwas?
    belegt = set()
    for e in elemente:
        pts = e[1][None, :] if e[0] == "text" else e[1]
        for x, y in pts:
            belegt.add((int(x // TW), int(y // TH)))
    # Linien zwischen Punkten können Kacheln überspannen: Nachbarn auffüllen
    for e in elemente:
        if e[0] == "text":
            continue
        pts = e[1]
        for a, b in zip(pts[:-1], pts[1:]):
            for t in np.linspace(0, 1, 12):
                x, y = a + t * (b - a)
                belegt.add((int(x // TW), int(y // TH)))
    kacheln = [(i, j) for j in range(ny) for i in range(nx) if (i, j) in belegt]
    c = canvas.Canvas(pfad, pagesize=(PW * cm, PH * cm))
    c.setTitle(f"Grundschnitt Jacke – {titel} – A4 zum Zusammenkleben")
    spalten = "ABCDEFGHIJKLMNOP"

    # Seite 1: Übersicht
    c.setFont("Helvetica-Bold", 18)
    c.drawString(2 * cm, (PH - 2.5) * cm, "Grundschnitt Jacke · Gr. L · slim")
    c.setFont("Helvetica", 10)
    zeilen = [
        f"{titel} · Nahtzugabe 1,5 cm, Saumzugabe 3 cm enthalten.",
        "Rote Maße = Nahtlinie (ohne Zugaben), in cm.",
        "Drucken mit 100 % / „Tatsächliche Größe“ (nicht „An Seite anpassen“).",
        "Danach das Kontrollquadrat nachmessen: es muss genau 10 × 10 cm groß sein.",
        "Seiten nach Raster zusammenlegen (Spalte A, B, … von links; Reihe 1, 2, … von oben).",
        "Rand links und oben abschneiden, Schnittkante genau auf den Rahmen des Nachbarblatts legen, kleben.",
        "Leere Kacheln werden nicht gedruckt. Durchgezogene Linie = Schnittkante, gestrichelt = Nahtlinie.",
    ]
    for k, z in enumerate(zeilen):
        c.drawString(2 * cm, (PH - 3.6 - 0.6 * k) * cm, z)
    # Mini-Layout
    s = min(17.0 / (nx * TW), 9.0 / (ny * TH))
    ox, oy = 2.0, PH - 8.2
    c.saveState()
    c.setLineWidth(0.3)
    for e in elemente:
        if e[0] not in ("schnitt", "quadrat"):
            continue
        pa = c.beginPath()
        pts = e[1]
        pa.moveTo((ox + pts[0][0] * s) * cm, (oy - pts[0][1] * s) * cm)
        for x, y in pts[1:]:
            pa.lineTo((ox + x * s) * cm, (oy - y * s) * cm)
        c.drawPath(pa)
    c.setStrokeColorRGB(0.2, 0.35, 0.7)
    c.setFillColorRGB(0.2, 0.35, 0.7)
    c.setFont("Helvetica", 6)
    for i in range(nx):
        for j in range(ny):
            x0, y0 = ox + i * TW * s, oy - j * TH * s
            if (i, j) in belegt:
                c.rect(x0 * cm, (y0 - TH * s) * cm, TW * s * cm, TH * s * cm)
                c.drawCentredString((x0 + TW * s / 2) * cm, (y0 - TH * s / 2) * cm, f"{spalten[i]}{j + 1}")
    c.restoreState()
    # Kontrollmaße
    c.setFont("Helvetica-Bold", 11)
    ytab = oy - ny * TH * s - 1.5
    c.drawString(2 * cm, ytab * cm, "Kontrollmaße (Nahtlinie, ohne Zugaben)")
    c.setFont("Helvetica", 9)
    items = list(kontrolle.items())
    for k, (n, v) in enumerate(items):
        col, row = divmod(k, (len(items) + 1) // 2)
        c.drawString((2 + 9 * col) * cm, (ytab - 0.7 - 0.5 * row) * cm, n)
        c.drawRightString((10 + 9 * col) * cm, (ytab - 0.7 - 0.5 * row) * cm, f"{v:g} cm".replace(".", ","))
    c.setFont("Helvetica", 8)
    c.drawString(2 * cm, 1.5 * cm, f"Erstellt {date.today().strftime('%d.%m.%Y')} · {len(kacheln)} Druckseiten folgen")
    c.showPage()

    for n, (i, j) in enumerate(kacheln, start=1):
        c.saveState()
        c.translate(RAND * cm, RAND * cm)
        p = c.beginPath()
        p.rect(0, 0, TW * cm, TH * cm)
        c.clipPath(p, stroke=0)
        c.translate(-i * TW * cm, -(H - (j + 1) * TH) * cm)
        # Koordinaten: pdf_zeichnen nutzt (H - y); Kachel j deckt y in [j*TH, (j+1)*TH]
        pdf_zeichnen(c, elemente, H)
        c.restoreState()
        # Rahmen + Beschriftung
        c.setStrokeColorRGB(0.6, 0.6, 0.6)
        c.setLineWidth(0.4)
        c.setDash([])
        c.rect(RAND * cm, RAND * cm, TW * cm, TH * cm)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(RAND * cm, (PH - 0.8) * cm, f"{spalten[i]}{j + 1}")
        c.setFont("Helvetica", 7)
        c.drawRightString((PW - RAND) * cm, (PH - 0.8) * cm,
                          f"Grundschnitt Jacke L · Seite {n}/{len(kacheln)} · links an {spalten[i - 1] + str(j + 1) if i else '–'}, oben an {spalten[i] + str(j) if j else '–'}")
        # Passmarken in Rahmenmitte
        c.setStrokeColorRGB(0, 0, 0)
        for (x, y, dx, dy) in ((RAND + TW / 2, RAND, 0, 1), (RAND + TW / 2, RAND + TH, 0, -1),
                               (RAND, RAND + TH / 2, 1, 0), (RAND + TW, RAND + TH / 2, -1, 0)):
            c.line((x - 0.4 * dy) * cm, (y - 0.4 * dx) * cm, (x + 0.4 * dy) * cm, (y + 0.4 * dx) * cm)
            c.line(x * cm, y * cm, (x + 0.5 * dx) * cm, (y + 0.5 * dy) * cm)
        c.showPage()
    c.save()
    return len(kacheln), nx, ny


def main():
    for v, titel in VARIANTEN.items():
        teile, kontrolle = bauen(v)
        elemente, W, H = layout(teile)
        basis = os.path.join(HERE, f"grundschnitt_{v}")
        svg(elemente, W, H, basis + "_1zu1.svg")
        pdf_gross(elemente, W, H, basis + "_A0.pdf", titel)
        n, nx, ny = pdf_a4(elemente, W, H, basis + "_A4.pdf", kontrolle, titel)
        with open(os.path.join(HERE, f"masse_{v}.json"), "w", encoding="utf-8") as f:
            json.dump(dict(variante=titel,
                           koerper={k: {"wert": w, "quelle": q} for k, (w, q) in KOERPER.items()},
                           konstruktion=M, kontrollmasse=kontrolle), f, ensure_ascii=False, indent=2)
        print(f"{titel}: Blatt {W:.1f} × {H:.1f} cm, A4: {n} Seiten (Raster {nx}×{ny})")
        for k, w in kontrolle.items():
            print(f"  {k:32s} {w:6.1f} cm")


if __name__ == "__main__":
    main()
