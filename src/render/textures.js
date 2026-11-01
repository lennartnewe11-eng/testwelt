// Prozedurale Oberflächentexturen je Bindungsart (Canvas → THREE.CanvasTexture).
import * as THREE from 'three';

function shade(hex, f) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f)));
  return `#${c.getHexString()}`;
}

export function fabricTexture(pattern, color, size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, size, size);
  const dark = shade(color, 0.82), light = shade(color, 1.12);
  const n = 32, s = size / n;
  if (pattern === 'plain') {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? dark : light;
      g.fillRect(i * s + 0.5, j * s + 0.5, s - 1, s - 1);
    }
  } else if (pattern === 'twill') {
    g.lineWidth = s * 0.9;
    g.strokeStyle = dark;
    for (let k = -n; k < 2 * n; k += 2) { g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s + size, size); g.stroke(); }
    g.strokeStyle = light; g.lineWidth = s * 0.25;
    for (let k = -n; k < 2 * n; k += 2) { g.beginPath(); g.moveTo(k * s + s, 0); g.lineTo(k * s + s + size, size); g.stroke(); }
  } else if (pattern === 'satin') {
    const grd = g.createLinearGradient(0, 0, size, size);
    grd.addColorStop(0, light); grd.addColorStop(0.5, color); grd.addColorStop(1, light);
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    g.fillStyle = dark;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j += 5) g.fillRect(i * s, ((j + i * 2) % n) * s, s * 0.8, s * 0.35);
  } else if (pattern === 'knit') {
    g.strokeStyle = dark; g.lineWidth = s * 0.35;
    for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) {
      const x = i * s, y = j * s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + 2 * s); g.lineTo(x + 2 * s, y); g.stroke();
    }
  } else if (pattern === 'nonwoven') {
    for (let k = 0; k < 900; k++) {
      g.strokeStyle = Math.random() < 0.5 ? dark : light; g.lineWidth = 0.7;
      const x = Math.random() * size, y = Math.random() * size, a = Math.random() * Math.PI, l = 6 + Math.random() * 18;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  } else if (pattern === 'leather') {
    for (let k = 0; k < 2200; k++) {
      g.fillStyle = Math.random() < 0.55 ? dark : light;
      const x = Math.random() * size, y = Math.random() * size, r = 0.5 + Math.random() * 1.6;
      g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function gridTexture(base = '#9aa09d', line = '#868c89', size = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let k = 0; k < 3000; k++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  g.strokeStyle = line; g.lineWidth = 2;
  g.strokeRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
