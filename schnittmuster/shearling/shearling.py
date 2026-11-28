#!/usr/bin/env python3
"""Shearling-Fliegerjacke, oversized, Größe L – auf Basis der Körpermaße aus ../jacke.

Fit nach Referenzbild: weit und kastig, überschnittene Schulter, weite zweiteilige Ärmel,
Bund 8 cm mit Schnallenriegeln an den Seiten, Fell am Saum und an den Ärmeln nach außen
umgeschlagen, schräge Eingrifftaschen mit Fellpaspel, großer Kragen mit Kinnriemen,
durchgehender teilbarer Reißverschluss.

Shearling wird einlagig zugeschnitten (Fell nach unten), nie im Stoffbruch:
alle Teile sind Hälften und werden gegengleich zugeschnitten.

Konstruktion und Ausgabe nutzen die Werkzeuge aus ../jacke/grundschnitt.py.
Aufruf: python3 shearling.py
"""
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "jacke"))
import grundschnitt as g  # noqa: E402

# ---------------------------------------------------------------- Maße
KOERPER = {
    "Brustumfang": (106, "annahme Gr. L (wie Truckerschnitt)"),
    "Umfang auf Höhe Truckersaum": (96, "vorgabe"),
    "Schulterbreite (Jacke anliegend)": (50, "vorgabe Truckerschnitt"),
    "Armlänge ab Schulterpunkt": (64, "annahme Gr. L"),
    "Oberarmumfang": (34, "annahme Gr. L"),
}
FELL = 1.2          # Felldicke [cm]; kostet innen ca. 2·π·Dicke an Weite
NZ = 1.0            # Nahtzugabe Leder/Shearling
UMSCHLAG = 4.0      # Saum und Ärmelsaum: nach außen umschlagen, Fell zeigt
BUND_H = 8.0        # Bundhöhe (fertig)

S = dict(
    brust=136.0,          # 106 + 22 Oversize + ~8 für die Felldicke
    saum=128.0,           # Körper unten = Bundweite (Riegel ziehen zusammen)
    schulterbreite=60.0,  # 50 + 2 × 5 cm überschnitten
    rueckenlaenge=67.0,   # hintere Mitte Halsloch bis Unterkante Bund
    armloch_tiefe=30.0,
    halsweite_h=9.0, halsweite_v=8.7, hals_hoch_h=2.5, vorn_mehr=1.0, halstiefe_v=9.5,
    schulterneig_h=15.0, schulterneig_v=19.0, schulter_mehr_h=0.3,
    rueckenbreite=27.5, brustbreite=26.5,
    seite_h=dict(brust=34.5, saum=32.5),  # halbe Weiten Rücken
    # Ärmel
    aermellaenge=61.0,    # ab Kugeloberkante: Arm 64 − 5 überschnitten + 2 Zugabe für Volumen
    oberarm=56.0, aermelsaum=34.0, ellbogen=33.0, kugel_mehrweite=0.5,
    hinternaht_kugel=15.0, hinternaht_saum=0.45, ellbogen_mehrweite=0.5,
    # Tasche (Vorderteil-Koordinaten, ab vorderer Mitte)
    tasche_oben=(17.0, 37.0), tasche_unten=(20.0, 54.0), paspel=3.0,
    # Kragen
    kragen_hoehe_hm=13.0, kragen_hoehe_vorn=12.0, kragen_hub=1.5, kragen_ecke=3.0,
    kragen_klapp=2 / 3,     # Klappnaht (Steg/Fall) auf 2/3 der Kragenhöhe
    kragen_spreizung=1.0,   # Fall an der Außenkante je Schnitt aufspreizen (3 Schnitte)
)
S["seite_v"] = dict(brust=S["brust"] / 2 - S["seite_h"]["brust"], saum=S["saum"] / 2 - S["seite_h"]["saum"])


def g_setzen():
    """Parameter in das Konstruktionsmodul übertragen (Rumpf und Ärmel werden dort konstruiert)."""
    yk = S["rueckenlaenge"] - BUND_H  # Körper endet an der Bundnaht
    g.M.update(
        schulterbreite=S["schulterbreite"], armloch_tiefe=S["armloch_tiefe"],
        halsweite_h=S["halsweite_h"], halsweite_v=S["halsweite_v"], hals_hoch_h=S["hals_hoch_h"],
        vorn_mehr=S["vorn_mehr"], halstiefe_v=S["halstiefe_v"],
        schulterneig_h=S["schulterneig_h"], schulterneig_v=S["schulterneig_v"], schulter_mehr_h=S["schulter_mehr_h"],
        rueckenbreite=S["rueckenbreite"], brustbreite=S["brustbreite"], brust=S["brust"], saum=S["saum"],
        vl_cf=yk - S["halstiefe_v"] + S["hals_hoch_h"] + S["vorn_mehr"],
        aermellaenge=S["aermellaenge"], oberarm=S["oberarm"], aermelsaum=S["aermelsaum"], ellbogen=S["ellbogen"],
        kugel_mehrweite=S["kugel_mehrweite"], hinternaht_kugel=S["hinternaht_kugel"],
        hinternaht_saum=S["hinternaht_saum"], ellbogen_mehrweite=S["ellbogen_mehrweite"],
    )
    g.SEITE_H = S["seite_h"]
    g.SEITE_V = S["seite_v"]
    g.NZ = NZ
    g.SAUMZ = UMSCHLAG


def zugaben(T, werte):
    """Nahtzugaben einzelner Kanten setzen: {Kantenname: zugabe}."""
    T.kanten = [(n, p, werte.get(n, z)) for n, p, z in T.kanten]


def umbenennen(T, alt, neu):
    T.kanten = [(neu if n == alt else n, p, z) for n, p, z in T.kanten]


def rechteck(name, b, h, oben=NZ, unten=NZ, links=NZ, rechts=NZ):
    T = g.Teil(name)
    T.kante("Oben", g.seg((0, 0), (b, 0)), oben)
    T.kante("Rechts", g.seg((b, 0), (b, h)), rechts)
    T.kante("Unten", g.seg((b, h), (0, h)), unten)
    T.kante("Links", g.seg((0, h), (0, 0)), links)
    return T


def glaetten(pts, sigma=1.2, schritt=0.2):
    """Polylinie gleichmäßig abtasten und mit Gauß-Fenster (sigma in cm) glätten; Enden bleiben fest."""
    L = g.laenge(pts)
    m = max(int(L / schritt), 10)
    p = np.array([g.bei(pts, L * i / m)[0] for i in range(m + 1)])
    k = int(3 * sigma / schritt)
    w = np.exp(-0.5 * (np.arange(-k, k + 1) * schritt / sigma) ** 2)
    pad = np.vstack([2 * p[0] - p[k:0:-1], p, 2 * p[-1] - p[-2:-k - 2:-1]])  # gespiegelt fortsetzen
    q = np.stack([np.convolve(pad[:, j], w / w.sum(), mode="valid") for j in (0, 1)], axis=-1)
    q[0], q[-1] = p[0], p[-1]
    return q


def kragen(l_halb):
    """Großer Kragen aus zwei Teilen: Steg bis 2/3 der Höhe, darüber der Fall.
    An der Klappnaht klappt der Fall nach außen um (Fell zeigt); der Fall ist an der Außenkante
    aufgespreizt, damit er umgeklappt außen über dem Steg Platz hat."""
    lh, hub = S["halsweite_h"], S["kragen_hub"]

    def ansatz(xe):
        return g.cat(g.seg((0, 0), (lh, 0)), g.bez((lh, 0), (lh + 5, 0), (xe - 4, -hub * 0.6), (xe, -hub)))

    lo, hi = l_halb * 0.6, l_halb * 1.2
    for _ in range(60):
        xe = (lo + hi) / 2
        lo, hi = (xe, hi) if g.laenge(ansatz(xe)) < l_halb else (lo, xe)
    an = ansatz(xe)
    e = an[-1]
    hv, hm, r, f = S["kragen_hoehe_vorn"], S["kragen_hoehe_hm"], S["kragen_ecke"], S["kragen_klapp"]
    oben_v = e + np.array([0.6, -hv])           # vordere obere Ecke (vor dem Abrunden)
    oben = g.seg((0, -hm), oben_v)

    def gleich(pts, n=120):
        return np.array([g.bei(pts, g.laenge(pts) * i / (n - 1))[0] for i in range(n)])

    klapp = gleich(an) + f * (gleich(oben) - gleich(an))  # hintere Mitte -> Vorderkante
    s1 = klapp[-1]
    d1 = g.unit(e - oben_v)
    d2 = g.unit(np.array([0.0, -hm]) - oben_v)
    p1, p2 = oben_v + r * d1, oben_v + r * d2
    aussen = gleich(g.seg(p2, (0, -hm)), 60)

    ST = g.Teil("Kragensteg")
    ST.kante("Ansatz", an, NZ)
    ST.kante("Vorderkante", g.seg(e, s1), 0)
    ST.kante("Klappnaht", klapp[::-1], NZ)
    ST.kante("Hintere Mitte", g.seg((0, -f * hm), (0, 0)), NZ)

    def x_auf(pts, x):
        return pts[int(np.argmin(np.abs(pts[:, 0] - x)))].copy()

    schnitte = [(x_auf(klapp, x), x_auf(aussen, x)) for x in (5.0, 11.0, 17.0)]
    fall_k = [("Klappnaht", klapp, NZ),
              ("Vorderkante", g.cat(g.seg(s1, p1), g.bez(p1, p1 - 0.55 * r * d1, p2 - 0.55 * r * d2, p2, n=24)), 0),
              ("Außenkante", aussen, 0),
              ("Hintere Mitte", g.seg((0, -hm), (0, -f * hm)), NZ)]
    # y nach unten: positive Drehung um den Drehpunkt auf der Klappnaht öffnet die Außenkante
    fall_k, drehe, region, _ = g.formen(fall_k, schnitte, "unten", S["kragen_spreizung"], "Außenkante")
    FA = g.Teil("Kragenfall")
    for n_, p_, z_ in fall_k:
        if n_ == "Klappnaht":  # Knicke an den Drehpunkten ausgleichen
            p_ = glaetten(p_, 1.2)
        FA.kante(n_, p_, z_)

    def abbilden(p, k=None):
        """Punkt aus dem ungespreizten Kragen in den gespreizten Fall übertragen; mit Drehwinkel."""
        p = np.asarray(p, float)
        k = region(p) if k is None else k
        q, q2 = drehe(p, k), drehe(p + np.array([1.0, 0.0]), k)
        return q, math.degrees(math.atan2(q2[1] - q[1], q2[0] - q[0]))
    marken = [g.laenge(klapp[: int(np.argmin(np.linalg.norm(klapp - b_, axis=1))) + 1]) for b_, _ in schnitte]
    info = dict(e=e, lh=lh, s1=s1, steg_hm=f * hm, fall_hm=(1 - f) * hm, marken=marken,
                aussen_vorher=g.laenge(aussen), abbilden=abbilden)
    return ST, FA, info


def bauen():
    g_setzen()
    R, V = g.ruecken(), g.vorderteil()
    umbenennen(R, "Stoffbruch", "Hintere Mitte")
    umbenennen(R, "Saum", "Bundnaht")
    umbenennen(V, "Saum", "Bundnaht")
    zugaben(R, {"Hintere Mitte": NZ, "Bundnaht": NZ})
    zugaben(V, {"Bundnaht": NZ})
    ah_h, ah_v = g.laenge(R.k("Armloch")), g.laenge(V.k("Armloch"))
    AO, AH, ai = g.aermel(ah_v, ah_h)
    ah, mw = ah_h + ah_v, S["kugel_mehrweite"]
    s_schulter = ah_v + mw * ah_v / ah
    rp, vp = R.punkte, V.punkte
    yk = rp["y_saum"]
    STRICH = "STRICH (Fell) nach unten"

    # Rücken
    g.fadenlauf(R, (8, 14), (8, yk - 8), label=STRICH, g=0.7)
    for y, t in ((rp["y_brust"], "Brustlinie"),):
        c = g.schnitt_bis_kante(R.poly(), y, 0, 60)
        g.hilfslinie(R, c, t, (c[0][0] + 10, y - 0.4), groesse=0.8)
    g.text(R, (19, 36), "RÜCKEN", 1.8, gewicht="bold")
    g.text(R, (19, 38.5), "2× gegengleich (einlagig, Fell unten)", 0.9)
    g.text(R, (19, 40.3), "Shearling-Fliegerjacke · Gr. L oversized", 0.75)
    g.text(R, (19, 41.6), "NZ 1 cm · hintere Mittelnaht", 0.75)
    g.knips(R, "Armloch", 9.0, von_ende=True, doppelt=True, zug=NZ)
    g.masslinie(R, (0.6, 0), (0.6, yk), f"Rücken bis Bundnaht {g.zahl(yk)} (+ Bund {g.zahl(BUND_H)})", t=0.5, unten=True)
    g.weite(R, rp["y_brust"], "½ Brust", t=0.6, x0=0)
    g.weite(R, yk - 1.5, "½ unten", t=0.6, x0=0)
    g.nahtmass(R, "Halsloch", "Halsloch", f=0.45)
    g.nahtmass(R, "Schulter", "Schulter")
    g.nahtmass(R, "Armloch", "Armloch", f=0.35)
    g.nahtmass(R, "Seitennaht", "Seitennaht", f=0.75)

    # Vorderteil mit Tasche
    g.fadenlauf(V, (27.0, 24), (27.0, yk - 6), label=STRICH, g=0.7)
    c = g.schnitt_bis_kante(V.poly(), vp["y_brust"], 0, 60)
    g.hilfslinie(V, c, "Brustlinie", (c[0][0] + 9, vp["y_brust"] - 0.4), groesse=0.8)
    g.text(V, (9.5, 40.0), "VORDERTEIL", 1.8, gewicht="bold")
    g.text(V, (9.5, 42.3), "2× gegengleich", 0.9)
    g.text(V, (9.5, 43.6), "(einlagig, Fell unten)", 0.75)
    g.text(V, (9.5, 45.0), "vorne: teilbarer Reißverschluss", 0.6)
    g.text(V, (2.0, 47.5), "VORDERE MITTE · Reißverschluss", 0.7, rot=-90)
    g.knips(V, "Armloch", 8.0, von_ende=True, zug=NZ)
    to, tu, pw = np.array(S["tasche_oben"]), np.array(S["tasche_unten"]), S["paspel"]
    d = g.unit(tu - to)
    n = np.array([d[1], -d[0]])  # zur Seitennaht hin
    if n[0] < 0:
        n = -n
    V.innen.append(("stepp", np.array([to, tu])))
    V.innen.append(("hilf", np.array([to, to + pw * n, tu + pw * n, tu])))
    g.text(V, tuple((to + tu) / 2 + 1.6 * n), "Fellpaspel", 0.55, rot=g.lesbar(d))
    g.masslinie(V, to - 2.2 * n, tu - 2.2 * n, f"Eingriff {g.zahl(np.linalg.norm(tu - to))}", t=0.5, g=0.55)
    g.masslinie(V, (0.6, vp["cfn"][1]), (0.6, yk), f"Vorderlänge bis Bundnaht {g.zahl(yk - vp['cfn'][1])}", t=0.3, unten=True)
    g.weite(V, vp["y_brust"], "½ Brust", t=0.75, x0=0)
    g.weite(V, yk - 1.5, "½ unten", t=0.7, x0=0)
    g.nahtmass(V, "Halsloch", "Halsloch", f=0.6)
    g.nahtmass(V, "Schulter", "Schulter")
    g.nahtmass(V, "Armloch", "Armloch", f=0.35)
    g.nahtmass(V, "Seitennaht", "Seitennaht", f=0.8)

    # Ärmel (zweiteilig, hintere Naht)
    p = ai
    h, ye, L = p["h"], p["ye"], p["L"]
    xs = lambda y: g.auf_linie(p["ct"], p["sh"], y)[0]
    xb = lambda y: p["w"] - (p["w"] - p["s"]) * (y - h) / (L - h)
    g.fadenlauf(AO, (4.0, h + 3), (4.0, L - 10), label=STRICH, g=0.7)
    g.hilfslinie(AO, [(-p["w"], h), (xs(h), h)], "Oberarmlinie", (-p["w"] + 1.5, h - 0.4), groesse=0.8)
    g.hilfslinie(AO, [p["pf"], p["su"]], "Ellbogenlinie", (p["pf"][0] + 1.5, ye - 0.4), groesse=0.8)
    g.text(AO, (-11, h + 9), "OBERÄRMEL", 1.6, gewicht="bold")
    g.text(AO, (-11, h + 11.2), "2× gegengleich", 0.9)
    g.text(AO, (-11, h + 12.7), "(einlagig, Fell unten)", 0.75)
    g.text(AO, (-p["w"] + 4.5, h + 4), "vorne", 1.0)
    g.text(AO, (0, L - 1.2), "Saum 4 cm nach außen umschlagen (Fell zeigt)", 0.6)
    g.knips(AO, "Armkugel", 8.2, zug=NZ)
    g.knips(AO, "Armkugel", s_schulter, zug=NZ)
    g.knips(AO, "Unterarmnaht", g.bis_y(AO.k("Unterarmnaht")[::-1], ye), von_ende=True, zug=NZ)
    g.knips(AO, "Hintere Ärmelnaht", p["a_oben"], zug=NZ)
    g.knips(AO, "Hintere Ärmelnaht", p["b_unten"], von_ende=True, zug=NZ)
    g.masslinie(AO, (0.8, 0), (0.8, h), f"Kugelhöhe {g.zahl(h)}", t=0.55, unten=True)
    g.masslinie(AO, (-0.8, 0), (-0.8, L), f"Ärmellänge {g.zahl(L)}", t=0.82)
    g.weite(AO, h, "Oberarm", t=0.6)
    g.weite(AO, ye, "Ellbogen", t=0.6)
    g.nahtmass(AO, "Armkugel", "Kugel vorne", s1=s_schulter)
    g.nahtmass(AO, "Armkugel", "Kugel hinten", s0=s_schulter, f=0.45)
    g.nahtmass(AO, "Unterarmnaht", "Unterarmnaht", f=0.3)
    g.nahtmass(AO, "Hintere Ärmelnaht", "Hintere Naht", f=0.8)
    xm = (xs(ye) + xb(ye)) / 2
    g.fadenlauf(AH, (xm + 1.2, ye - 14), (xm + 1.2, ye + 18), label="STRICH", g=0.6)
    g.hilfslinie(AH, [(xs(h), h), (p["w"], h)])
    g.hilfslinie(AH, [p["su"], (xb(ye), ye)])
    g.text(AH, (xm - 1.6, ye + 10), "HINTERÄRMEL", 1.3, rot=-90, gewicht="bold")
    g.text(AH, (xm - 0.3, ye + 10), "2× gegengleich", 0.75, rot=-90)
    g.knips(AH, "Armkugel", 9.3, von_ende=True, doppelt=True, zug=NZ)
    g.knips(AH, "Unterarmnaht", float(np.linalg.norm(np.array([xb(ye), ye]) - np.array([p["w"], h]))), zug=NZ)
    g.knips(AH, "Hintere Ärmelnaht", p["a_oben"], von_ende=True, zug=NZ)
    g.knips(AH, "Hintere Ärmelnaht", p["b_unten"], zug=NZ)
    g.weite(AH, h, "Oberarm", t=0.5, g=0.55)
    g.weite(AH, ye, "Ellbogen", t=0.5, g=0.55)
    g.nahtmass(AH, "Unterarmnaht", "Unterarmnaht", f=0.6, g=0.6)
    g.nahtmass(AH, "Hintere Ärmelnaht", "Hintere Naht", f=0.25, g=0.6)

    # Bund (Fell unten 4 cm nach außen umschlagen)
    bh_r, bh_v = float(R.k("Bundnaht")[0][0]), float(V.k("Bundnaht")[0][0])
    BR = rechteck("Bund hinten", bh_r, BUND_H, unten=UMSCHLAG)
    BV = rechteck("Bund vorne", bh_v, BUND_H, unten=UMSCHLAG)
    for B, nm, laenge, seite in ((BR, "BUND HINTEN", bh_r, "hintere Mitte"), (BV, "BUND VORNE", bh_v, "vordere Mitte")):
        g.text(B, (laenge / 2, 3.2), nm, 1.0, gewicht="bold")
        g.text(B, (laenge / 2, 4.5), "2× gegengleich · unten 4 cm Fell nach außen umschlagen", 0.55)
        g.text(B, (0.6, 4.0), seite, 0.45, rot=-90)
        g.text(B, (laenge - 0.6, 4.0), "Seitennaht · Riegel", 0.45, rot=-90)
        g.masslinie(B, (0, 6.6), (laenge, 6.6), f"{g.zahl(laenge)}", t=0.5, g=0.55)
        g.masslinie(B, (laenge - 2.2, 0), (laenge - 2.2, BUND_H), f"{g.zahl(BUND_H)}", t=0.5, g=0.55, unten=True)

    # Kragen
    l_halb = g.laenge(R.k("Halsloch")) + g.laenge(V.k("Halsloch"))
    KSt, KFa, ki = kragen(l_halb)
    sh_, fh_ = ki["steg_hm"], ki["fall_hm"]
    g.knips(KSt, "Ansatz", ki["lh"], zug=NZ)
    for m_ in ki["marken"]:
        g.knips(KSt, "Klappnaht", m_, von_ende=True, zug=NZ)
        g.knips(KFa, "Klappnaht", m_, zug=NZ)
    g.fadenlauf(KSt, (3, -sh_ / 2 + 0.3), (11, -sh_ / 2 + 0.3), label=STRICH, g=0.5)
    g.text(KSt, (15.5, -sh_ / 2 - 1.2), "KRAGENSTEG", 1.1, gewicht="bold")
    g.text(KSt, (15.5, -sh_ / 2 - 0.2), "2× gegengleich · hintere Mitte genäht", 0.5)
    g.text(KSt, (15.5, -sh_ / 2 + 0.6), "Vorderkante roh", 0.42)
    g.text(KSt, (15.5, -sh_ / 2 + 1.3), "Fall an der Klappnaht nach außen umklappen", 0.42)
    g.text(KSt, (ki["lh"], 0.8), "Schulter", 0.5)
    g.masslinie(KSt, (0.6, 0), (0.6, -sh_), f"Steg {g.zahl(sh_)} (2/3)", t=0.5, g=0.5, unten=True)
    g.nahtmass(KSt, "Ansatz", "Ansatz", f=0.75, g=0.5)
    g.nahtmass(KSt, "Klappnaht", "Klappnaht", f=0.3, g=0.5, rein=0.7)
    ab = ki["abbilden"]
    g.fadenlauf(KFa, (1.6, -sh_ - fh_ * 0.7), (4.6, -sh_ - fh_ * 0.7), label="STRICH", g=0.3)
    for (x_, fy, txt, gr, gw) in ((14.0, 0.45, "KRAGENFALL", 0.85, "bold"),
                                  (14.0, 0.2, "2× gegengleich · Kanten roh", 0.42, "normal")):
        q, wk = ab((x_, -sh_ - fh_ * fy))
        g.text(KFa, tuple(q), txt, gr, rot=wk, gewicht=gw)
    g.masslinie(KFa, (0.6, -sh_), (0.6, -sh_ - fh_), f"Fall {g.zahl(fh_)}", t=0.5, g=0.45, unten=True)
    g.nahtmass(KFa, "Außenkante", "Außenkante", f=0.35, g=0.5)
    g.nahtmass(KFa, "Klappnaht", "Klappnaht", f=0.85, g=0.45, rein=0.6)

    # Kleinteile
    lo = float(np.linalg.norm(tu - to))
    TP = rechteck("Taschenpaspel", lo, pw)
    g.text(TP, (lo / 2, 1.0), "TASCHENPASPEL", 0.6, gewicht="bold")
    g.text(TP, (lo / 2, 1.9), "2× gegengleich · Fell nach außen", 0.45)
    g.text(TP, (lo / 2, 2.7), f"{g.zahl(lo)} × {g.zahl(pw)}", 0.45)
    TBt = rechteck("Taschenbeutel", 20.0, 24.0)
    g.text(TBt, (10, 9), "TASCHENBEUTEL", 0.9, gewicht="bold")
    g.text(TBt, (10, 10.3), "4× (Futter/Baumwollköper)", 0.6)
    g.text(TBt, (10, 11.4), "je Tasche 2 Teile", 0.6)
    g.masslinie(TBt, (0, 22.5), (20, 22.5), "20", g=0.55)
    g.masslinie(TBt, (1.5, 0), (1.5, 24), "24", g=0.55, unten=True)
    KR = rechteck("Kinnriemen", 30.0, 4.0)
    g.text(KR, (15, 1.8), "KINNRIEMEN 1× (Leder, doppelt)", 0.55, gewicht="bold")
    g.text(KR, (15, 2.8), "30 × 4 · Lochreihe am freien Ende", 0.45)
    KS = rechteck("Schnallenlasche", 8.0, 4.0)
    g.text(KS, (4, 1.8), "SCHNALLENLASCHE", 0.4, gewicht="bold")
    g.text(KS, (4, 2.7), "3× (Kinn + 2 Bund)", 0.4)
    RG = rechteck("Bundriegel", 15.0, 3.5)
    g.text(RG, (7.5, 1.6), "BUNDRIEGEL 2×", 0.5, gewicht="bold")
    g.text(RG, (7.5, 2.5), "15 × 3,5 · Lochreihe", 0.42)

    kv = g.laenge(AO.k("Armkugel")) + g.laenge(AH.k("Armkugel"))
    kontrolle = {
        "Brustweite (Leder)": S["brust"],
        "Brustweite innen (abzgl. Felldicke)": round(S["brust"] - 2 * math.pi * FELL, 1),
        "Weite unten / Bund": S["saum"],
        "Schulterbreite (überschnitten)": S["schulterbreite"],
        "Rückenlänge gesamt": S["rueckenlaenge"],
        "Vorderlänge gesamt": round(yk - vp["cfn"][1] + BUND_H, 1),
        "Bundhöhe": BUND_H,
        "Schulternaht vorne / hinten": f"{g.zahl(g.laenge(V.k('Schulter')))} / {g.zahl(g.laenge(R.k('Schulter')))}",
        "Seitennaht vorne / hinten": f"{g.zahl(g.laenge(V.k('Seitennaht')))} / {g.zahl(g.laenge(R.k('Seitennaht')))}",
        "Armloch gesamt": round(ah, 1),
        "Armkugel gesamt": round(kv, 1),
        "Kugelhöhe": round(h, 1),
        "Ärmellänge": S["aermellaenge"],
        "Oberarmweite Ärmel": S["oberarm"],
        "Saumweite Ärmel": S["aermelsaum"],
        "Hintere Ärmelnaht Ober-/Hinterärmel": f"{g.zahl(g.laenge(AO.k('Hintere Ärmelnaht')))} / {g.zahl(g.laenge(AH.k('Hintere Ärmelnaht')))}",
        "Halsloch gesamt": round(2 * l_halb, 1),
        "Kragenhöhe hintere Mitte / vorne": f"{g.zahl(S['kragen_hoehe_hm'])} / {g.zahl(S['kragen_hoehe_vorn'])}",
        "Kragensteg / Kragenfall (h. M.)": f"{g.zahl(ki['steg_hm'])} / {g.zahl(ki['fall_hm'])}",
        "Klappnaht Steg / Fall": f"{g.zahl(g.laenge(KSt.k('Klappnaht')))} / {g.zahl(g.laenge(KFa.k('Klappnaht')))}",
        "Außenkante Fall (vorher / gespreizt)": f"{g.zahl(ki['aussen_vorher'])} / {g.zahl(g.laenge(KFa.k('Außenkante')))}",
        "Taschen-Eingriff": round(lo, 1),
        "Reißverschluss teilbar ca.": round(yk - vp["cfn"][1] + BUND_H - 1, 0),
    }
    spalten = [[R, TP], [V, KR], [AO], [AH, KS], [(BR, "quer"), (BV, "quer")], ["quadrat", KSt, KFa, TBt, RG]]
    return spalten, kontrolle


def main():
    spalten, kontrolle = bauen()
    el, W, H = g.layout(spalten)
    basis = os.path.join(HERE, "shearling")
    titel = "Shearling-Fliegerjacke oversized"
    kopf = "Shearling-Fliegerjacke · Gr. L · oversized"
    g.svg(el, W, H, basis + "_1zu1.svg")
    g.pdf_gross(el, W, H, basis + "_A0.pdf", titel, kopf="Shearling-Fliegerjacke")
    n, nx, ny = g.pdf_a4(el, W, H, basis + "_A4.pdf", kontrolle, titel, kopf=kopf,
                         zugaben="NZ 1 cm, Säume 4 cm (nach außen umschlagen).",
                         kurz="Shearling-Fliegerjacke L")
    with open(os.path.join(HERE, "masse.json"), "w", encoding="utf-8") as f:
        json.dump(dict(koerper={k: {"wert": w, "quelle": q} for k, (w, q) in KOERPER.items()},
                       felldicke=FELL, konstruktion=S, kontrollmasse=kontrolle), f, ensure_ascii=False, indent=2)
    print(f"Blatt {W:.1f} × {H:.1f} cm, A4: {n} Seiten (Raster {nx}×{ny})")
    for k, w in kontrolle.items():
        print(f"  {k:36s} {w if isinstance(w, str) else f'{w:6.1f}'} cm")


if __name__ == "__main__":
    main()
