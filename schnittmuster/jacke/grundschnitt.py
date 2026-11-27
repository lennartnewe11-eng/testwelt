#!/usr/bin/env python3
"""Grundschnitt Jacke (Trucker-Form, slim, Größe L): Vorderteil, Rücken, Ärmel.

Alle Maße in cm. Koordinaten: x nach rechts, y nach unten.
Rücken:    Ursprung = hintere Mitte am Halsausschnitt, x nach außen zur Seitennaht.
Vorderteil: Ursprung = vordere Mitte auf Höhe hintere Halsmitte, x nach außen.
           Brustlinie und Saum liegen bei Vorder- und Rückenteil auf gleicher Höhe.
Ärmel:     Ursprung = Kugelhöhe-Oberkante in der Ärmelmitte.

Erzeugt im selben Ordner:
  grundschnitt_1zu1.svg   alle Teile 1:1 (für Plotter / Copyshop)
  grundschnitt_A4.pdf     Übersicht + zum Zusammenkleben gekachelte A4-Seiten
  grundschnitt_A0.pdf     eine große Seite 1:1 (Copyshop / Plotter)
  masse.json              verwendete Maße und Kontrollmaße der Teile

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
    saum=102.0,          # Saumweite (Körper auf Saumhöhe 96 + 6, schließt eng ab)
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
)
# Seitennaht: halbe Weiten auf Rücken / Vorderteil verteilt (Rücken etwas breiter)
SEITE_H = dict(brust=29.0, saum=26.0)
SEITE_V = dict(brust=M["brust"] / 2 - 29.0, saum=M["saum"] / 2 - 26.0)


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
            p = schnittpunkt(a[-2], a[-1], b[0], b[1])
            if p is not None:
                a[-1] = p
                b[0] = p
        return cat(*offs)


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


def aermel(ah_v, ah_h):
    T = Teil("Ärmel")
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
    kurve = cat(v, b)
    L = M["aermellaenge"]
    s = M["aermelsaum"] / 2
    T.kante("Unterarmnaht vorne", seg((-s, L), (-w, h))[::1], NZ)
    T.kante("Armkugel", kurve, NZ)
    T.kante("Unterarmnaht hinten", seg((w, h), (s, L)), NZ)
    T.kante("Ärmelsaum", seg((s, L), (-s, L)), SAUMZ)
    T.punkte = dict(h=h, w=w, s=s, L=L)
    return T


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
def bauen():
    R, V = ruecken(), vorderteil()
    ah_h, ah_v = laenge(R.k("Armloch")), laenge(V.k("Armloch"))
    A = aermel(ah_v, ah_h)
    ah = ah_h + ah_v
    mw = M["kugel_mehrweite"]
    kv = laenge(A.k("Armkugel"))
    # Schulterknips auf der Kugel: Mehrweite anteilig auf vorne/hinten
    s_schulter = ah_v + mw * ah_v / ah
    KN_V, KN_H = 8.0, 9.0  # Knipse im Armloch ab Seitennaht

    # Rücken
    p = R.punkte
    fadenlauf(R, (6, 16), (6, p["y_saum"] - 8))
    for y, t in ((p["y_brust"], "Brustlinie"), (M["taille_y"], "Taillenlinie")):
        c = schnitt_bis_kante(R.poly(), y, 0, 40)
        hilfslinie(R, c, t, (c[0][0] + 9, y - 0.4), groesse=0.8)
    text(R, (15, 30.5), "RÜCKEN", 1.8, gewicht="bold")
    text(R, (15, 33.0), "1× im Stoffbruch", 1.1)
    text(R, (15, 35.0), "Grundschnitt Jacke · Gr. L slim", 0.8)
    text(R, (15, 36.4), f"NZ {NZ:g} cm · Saum {SAUMZ:g} cm inkl.", 0.8)
    text(R, (-0.6, 40), "STOFFBRUCH  · hintere Mitte", 1.0, rot=-90)
    knips(R, "Armloch", KN_H, von_ende=True, doppelt=True)
    knips(R, "Seitennaht", bis_y(R.k("Seitennaht"), M["taille_y"]))
    # Pfeile Stoffbruch
    for y in (12, p["y_saum"] - 12):
        R.innen.append(("faden", np.array([(4.0, y - 2.5), (1.2, y - 2.5), (1.2, y + 2.5), (4.0, y + 2.5)])))
        R.innen.append(("faden", np.array([(1.8, y - 3.0), (1.2, y - 2.5), (1.8, y - 2.0)])))
        R.innen.append(("faden", np.array([(1.8, y + 2.0), (1.2, y + 2.5), (1.8, y + 3.0)])))

    # Vorderteil
    p = V.punkte
    fadenlauf(V, (4.5, 18), (4.5, p["y_saum"] - 8))
    for y, t in ((p["y_brust"], "Brustlinie"), (M["taille_y"], "Taillenlinie")):
        c = schnitt_bis_kante(V.poly(), y, 0, 40)
        hilfslinie(V, c, t, (c[0][0] + 10, y - 0.4), groesse=0.8)
    text(V, (14, 30.5), "VORDERTEIL", 1.8, gewicht="bold")
    text(V, (14, 33.0), "2× zuschneiden (gegengleich)", 1.1)
    text(V, (14, 35.0), "Grundschnitt Jacke · Gr. L slim", 0.8)
    text(V, (14, 36.4), "Übertritt/Beleg folgen mit den Details", 0.8)
    text(V, (0.9, 42), "VORDERE MITTE", 1.0, anker="middle", rot=-90)
    knips(V, "Armloch", KN_V, von_ende=True)
    knips(V, "Seitennaht", bis_y(V.k("Seitennaht"), M["taille_y"]))

    # Ärmel
    p = A.punkte
    fadenlauf(A, (0, p["h"] + 4), (0, p["L"] - 6))
    hilfslinie(A, [(-p["w"], p["h"]), (p["w"], p["h"])], "Oberarmlinie", (-p["w"] + 1.5, p["h"] - 0.4), groesse=0.8)
    ye = M["ellbogen"]
    xe_v = -p["w"] + (p["w"] - p["s"]) * (ye - p["h"]) / (p["L"] - p["h"])
    hilfslinie(A, [(xe_v, ye), (-xe_v, ye)], "Ellbogenlinie", (xe_v + 1.5, ye - 0.4), groesse=0.8)
    text(A, (0, p["h"] + 12), "ÄRMEL", 1.8, gewicht="bold")
    text(A, (0, p["h"] + 14.5), "2× zuschneiden (gegengleich)", 1.1)
    text(A, (0, p["h"] + 16.5), "Grundschnitt Jacke · Gr. L slim", 0.8)
    text(A, (-p["w"] + 4.5, p["h"] + 4), "vorne", 1.0)
    text(A, (p["w"] - 4.5, p["h"] + 4), "hinten", 1.0)
    kname = "Armkugel"
    knips(A, kname, KN_V + 0.2)                       # vorne einfach
    knips(A, kname, KN_H + 0.3, von_ende=True, doppelt=True)  # hinten doppelt
    knips(A, kname, s_schulter)                        # Schulterpunkt
    knips(A, "Unterarmnaht hinten", laenge(seg((p["w"], p["h"]), (p["s"], p["L"]))) * (ye - p["h"]) / (p["L"] - p["h"]))

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
        "Armkugel gesamt": round(kv, 1),
        "Mehrweite Kugel": round(kv - ah, 1),
        "Kugelhöhe": round(A.punkte["h"], 1),
        "Ärmellänge": M["aermellaenge"],
        "Oberarmweite Ärmel": M["oberarm"],
        "Saumweite Ärmel": M["aermelsaum"],
        "Unterarmnaht": round(laenge(A.k("Unterarmnaht hinten")), 1),
        "Halsloch gesamt (für Kragen)": round(2 * (laenge(V.k("Halsloch")) + laenge(R.k("Halsloch"))), 1),
    }
    return [R, V, A], kontrolle


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
}


def svg(elemente, W, H, pfad):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.2f}cm" height="{H:.2f}cm" '
           f'viewBox="0 0 {W:.3f} {H:.3f}">',
           f'<rect x="0" y="0" width="{W:.3f}" height="{H:.3f}" fill="#fff"/>']
    for e in elemente:
        if e[0] == "text":
            _, p, s, g, anker, rot, gew = e
            tr = f' transform="rotate({rot} {p[0]:.3f} {p[1]:.3f})"' if rot else ""
            out.append(f'<text x="{p[0]:.3f}" y="{p[1]:.3f}" font-family="Helvetica, Arial, sans-serif" '
                       f'font-size="{g}" font-weight="{gew}" text-anchor="{anker}"{tr}>{s}</text>')
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
            c.setFillColorRGB(0, 0, 0)
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


def pdf_gross(elemente, W, H, pfad):
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(pfad, pagesize=(W * cm, H * cm))
    c.setTitle("Grundschnitt Jacke 1:1")
    pdf_zeichnen(c, elemente, H)
    c.showPage()
    c.save()


def pdf_a4(elemente, W, H, pfad, kontrolle):
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
    c.setTitle("Grundschnitt Jacke – A4 zum Zusammenkleben")
    spalten = "ABCDEFGHIJKLMNOP"

    # Seite 1: Übersicht
    c.setFont("Helvetica-Bold", 18)
    c.drawString(2 * cm, (PH - 2.5) * cm, "Grundschnitt Jacke · Gr. L · slim")
    c.setFont("Helvetica", 10)
    zeilen = [
        "Vorderteil, Rücken, Ärmel · Nahtzugabe 1,5 cm, Saumzugabe 3 cm enthalten.",
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
    teile, kontrolle = bauen()
    elemente, W, H = layout(teile)
    svg(elemente, W, H, os.path.join(HERE, "grundschnitt_1zu1.svg"))
    pdf_gross(elemente, W, H, os.path.join(HERE, "grundschnitt_A0.pdf"))
    n, nx, ny = pdf_a4(elemente, W, H, os.path.join(HERE, "grundschnitt_A4.pdf"), kontrolle)
    with open(os.path.join(HERE, "masse.json"), "w", encoding="utf-8") as f:
        json.dump(dict(koerper={k: {"wert": v, "quelle": q} for k, (v, q) in KOERPER.items()},
                       konstruktion=M, kontrollmasse=kontrolle), f, ensure_ascii=False, indent=2)
    print(f"Blatt {W:.1f} × {H:.1f} cm, A4: {n} Seiten (Raster {nx}×{ny})")
    for k, v in kontrolle.items():
        print(f"  {k:32s} {v:6.1f} cm")


if __name__ == "__main__":
    main()
