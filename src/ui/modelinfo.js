// Kurzbeschreibung des Physikmodells (Tab „Modell“).
export const MODEL_INFO = `
<section class="block"><h2>Was simuliert wird</h2>
<p class="note">Alle Größen in SI-Einheiten, Normfallbeschleunigung g = 9,80665 m/s², Luft bei 20 °C (ρ = 1,204 kg/m³). Die Materialkennwerte stammen aus typischen Prüfwerten (KES-F, FAST, DIN EN ISO 9237) und lassen sich durch eigene Messungen ersetzen.</p></section>
<section class="block"><h2>Textil</h2>
<table class="kv">
<tr><td>Masse</td><td>Flächenmasse ρ<sub>A</sub>, exakt auf Knoten verteilt</td></tr>
<tr><td>Zug</td><td>Zugsteifigkeit T Kette/Schuss [N/m], anisotrop</td></tr>
<tr><td>Scherung</td><td>Schersteifigkeit G (KES) [N/m/rad]</td></tr>
<tr><td>Biegung</td><td>Biegesteifigkeit B (KES) [N·m], geprüft mit ASTM D1388</td></tr>
<tr><td>Kontakt</td><td>Dicke, Coulomb-Reibung (Haften/Gleiten), Lagenhaftung</td></tr>
<tr><td>Luft</td><td>Druckwiderstand c<sub>d</sub> = 1,17 je Dreieck, Durchströmung nach Darcy</td></tr>
</table>
<p class="note">Löser: XPBD mit festen Teilschritten. Gewebe sind in der Ebene nahezu undehnbar; Zugdehnungen oberhalb einer Linienlast von 10 N/m werden durch eine hierarchische Dehnungsbegrenzung abgefangen. Die angezeigte Dehnung hat daher eine Auflösung von etwa 10 N/m geteilt durch die Zugsteifigkeit.</p></section>
<section class="block"><h2>Greifer</h2>
<table class="kv">
<tr><td>Vakuum</td><td>Leiternetzwerk: Pumpenkennlinie, Durchströmung je Lage, seitliche Leckage zwischen den Lagen</td></tr>
<tr><td>Nadel</td><td>Nadelanzahl × Auszugskraft × Eingriffsgrad je Lage</td></tr>
<tr><td>Elektroadhäsion</td><td>Maxwell-Spannung ½·ε₀·ε<sub>r</sub>·E², Abfall exp(−2π·z/Teilung)</td></tr>
<tr><td>Kryo</td><td>Eis-Haftfestigkeit × Benetzbarkeit, Durchfeuchtung tieferer Lagen</td></tr>
</table>
<p class="note">Versagen, wenn (F<sub>n</sub>/C<sub>n</sub>)² + (F<sub>t</sub>/C<sub>t</sub>)² &gt; 1. Die Lasten entstehen aus der Simulation (Gewicht, Trägheit, Luft, Reibung, Lagenhaftung). Auf- und Abbau der Haltekraft mit Zeitkonstanten je Greiferprinzip.</p></section>
<section class="block"><h2>Nähmaschine</h2>
<p class="note">Untertransport mit Transporteur (Reibschluss bis μ·F<sub>Fuß</sub>), Nähfuß bremst die obere Lage, Nadel fixiert die Lagen während des Einstichs. Jeder Stich verbindet die Lagen über einen nur zugtragenden Faden. Daraus entstehen Lagenverschiebung und Verdrehen am Werkstück.</p></section>
<section class="block"><h2>Kurvennähte und Schnittteile</h2>
<p class="note">Zuschnitte haben beliebige Konturen (z. B. T-Shirt-Vorder- und Rückenteil); die Netzknoten am Rand liegen auf der Schnittkante. Nahtbahnen entstehen aus der Kontur, versetzt um die Nahtzugabe. Bei SEWPATH dreht der Roboter das Teil laufend um die Nadel, sodass die Nahttangente in Transportrichtung zeigt; der Transporteur folgt dabei der Starrkörperbewegung des Teils. Gemessen wird die Abweichung jedes Einstichs von der Sollbahn im Zuschnitt.</p></section>
<section class="block"><h2>Ärmel einsetzen</h2>
<p class="note">Armloch (konkav) und Ärmelkugel (konvex) sind gegensinnig gekrümmt, die Kugel ist um die Mehrweite länger. Beide Teile lassen sich daher nicht gemeinsam starr führen. Der Roboter führt den Körper auf einem Werkstückträger entlang des Armlochs. Die Ärmelzuführung (segmentierte Vakuumplatte auf einer Dreh-Schiebeeinheit) führt den Ärmel gegenläufig entlang der Kugelbahn und gibt Segmente 1,8 cm vor der Nadel frei. Der Obertransport schiebt den Ärmel um das Mehrweitenverhältnis schneller (Mehrweite im mittleren Kugelbereich). Ein Trennblech entkoppelt die Lagen vor dem Fuß, ein Kantensensor überwacht die Ärmelkante. Der genähte Teil ist frei und stellt sich nach den Regeln der Physik auf.</p></section>
<section class="block"><h2>Weitere physikalische Effekte</h2>
<table class="kv">
<tr><td>Luftpolster</td><td>Quetschströmung nach Reynolds beim Annähern an Tisch oder Lage: p = 6μ·v·e(2a−e)/h³, parallel dazu Durchströmung des Stoffs. Dichte Stoffe schweben beim Ablegen, offene fallen sofort.</td></tr>
<tr><td>Fadenspannung</td><td>Stauchung der Naht ε = F/(T·1 cm), nur zugtragend; erzeugt Nahtkräuseln bei dünnen Stoffen.</td></tr>
<tr><td>Achsregelung</td><td>P-Lageregler (K<sub>v</sub>) mit Geschwindigkeitsvorsteuerung; der Schleppfehler geht in die Nahtabweichung ein.</td></tr>
<tr><td>Kollisionen</td><td>Greiferkopf gegen Nähkopf, Arm, Ständer, Nadel- und Fußstange (Warnung, der Roboter ist kinematisch).</td></tr>
<tr><td>Saugtisch</td><td>Unterdruck erhöht die Normalkraft der aufliegenden Lage, Reibschluss nach Coulomb.</td></tr>
<tr><td>Drucksteifigkeit</td><td>Fadenabschnitte unter Druck sind 20-mal weicher als auf Zug (Garne knicken, die Fläche beult aus). Erst dadurch kann sich Stoff in der Ebene biegen.</td></tr>
</table></section>
<section class="block"><h2>Grenzen</h2>
<p class="note">Keine Strömungssimulation (CFD), keine Temperatur- und Feuchteabhängigkeit, Maschinenteile und Tische sind starr. Netzauflösung 1–2 cm: Effekte kleiner als die Maschenweite (Einzelfäden, Kanten-Ausfransen) werden nicht abgebildet.</p></section>`;
