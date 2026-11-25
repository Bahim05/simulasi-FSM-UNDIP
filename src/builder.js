// Mengubah data JSON satu gedung menjadi objek 3D Three.js.
// Semua ukuran dibaca dari JSON (meter), jadi mengedit JSON = mengubah gedungnya.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

// ---------- pembuat geometri dasar ----------

// Kotak tegak dari titik a ke b di bidang datar, setinggi y0..y1, setebal thick.
// Dipakai untuk potongan dinding, kusen, dan daun pintu.
function wallBox(ax, az, bx, bz, y0, y1, thick) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  const g = new THREE.BoxGeometry(len, y1 - y0, thick);
  g.rotateY(Math.atan2(-dz, dx));            // sumbu panjang kotak diarahkan ke a->b
  g.translate((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
  return g;
}

// Kotak sejajar sumbu (untuk anak tangga dan bordes).
function boxXZ(x0, z0, x1, z1, y0, y1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

// Batang 3D dari p0 ke p1 (boleh miring), penampang w x h. Untuk railing tangga dan plat bawah tangga.
function beam(p0, p1, w, h) {
  const len = p0.distanceTo(p1);
  const g = new THREE.BoxGeometry(w, h, len);
  g.applyMatrix4(new THREE.Matrix4().lookAt(p1, p0, UP));   // sumbu z kotak = arah p0->p1
  g.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
  return g;
}

// Poligon denah [x,z] -> THREE.Shape. z dibalik karena Shape bekerja di bidang XY
// lalu diputar -90 derajat ke bidang XZ (lihat slabGeo).
function shapeOf(poly) {
  const s = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}

// Pelat lantai: poligon diekstrusi setebal depth, permukaan atasnya di y = top.
function slabGeo(poly, top, depth) {
  const g = new THREE.ExtrudeGeometry(shapeOf(poly), { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, top - depth, 0);
  return g;
}

function centroid(poly) {
  let x = 0, z = 0;
  poly.forEach(p => { x += p[0]; z += p[1]; });
  return [x / poly.length, z / poly.length];
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Gabungkan banyak geometri sebahan jadi satu mesh supaya ringan (sedikit draw call).
function merged(list, material, { cast = true, receive = true } = {}) {
  if (!list.length) return null;
  // geometri berindeks (kotak) dan tanpa indeks (ekstrusi, bidang buatan) harus diseragamkan sebelum digabung
  if (list.some(g => !g.index) && list.some(g => g.index)) list = list.map(g => (g.index ? g.toNonIndexed() : g));
  const m = new THREE.Mesh(mergeGeometries(list, false), material);
  list.forEach(g => g.dispose());
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Tekstur atap genteng sederhana yang digambar di canvas (tanpa file gambar).
function roofTexture(base) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 3);            // garis deretan genteng
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y + 3, 64, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Keramik lantai 60x60 cm (krem mengkilap dengan nat tipis). Dipakai dengan UV dalam meter.
let _tile = null;
function tileTexture() {
  if (_tile) return _tile;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.13)';
  g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 2, 128);
  _tile = new THREE.CanvasTexture(c);
  _tile.wrapS = _tile.wrapT = THREE.RepeatWrapping;
  _tile.repeat.set(1 / 0.6, 1 / 0.6);
  _tile.colorSpace = THREE.SRGBColorSpace;
  _tile.anisotropy = 4;
  return _tile;
}

// Papan kode ruang (teks putih di pelat biru tua), digambar di canvas.
function signWidth(text) { return Math.max(0.62, Math.min(1.5, 0.2 + text.length * 0.075)); }
function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = Math.round(signWidth(text) * 410); c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#1f3a5f'; g.fillRect(0, 0, c.width, 96);
  g.strokeStyle = '#c9d3df'; g.lineWidth = 4; g.strokeRect(6, 6, c.width - 12, 84);
  g.fillStyle = '#ffffff';
  g.font = `700 ${text.length > 6 ? 44 : 54}px Inter, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, 52, c.width - 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const FUNGSI = { kelas: 'Ruang kelas', lab: 'Laboratorium', kantor: 'Kantor', organisasi: 'Organisasi mahasiswa',
  ruang: 'Ruang lainnya', toilet: 'Kamar mandi', gudang: 'Gudang', sirkulasi: 'Sirkulasi', tangga: 'Tangga' };

// Nama pendek untuk label: kode untuk kelas, label/nama untuk ruang bernama, kode tanpa awalan untuk ruang servis.
export function shortName(kode, r) {
  if (r.label) return r.label;
  if (r.fungsi === 'kelas') return kode;
  return kode.replace(/^[A-Z]\d-/, '');
}

function letterTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.font = '800 104px Inter, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillText(text, 516, 70, 1000);          // bayangan tipis supaya huruf terlihat timbul
  g.fillStyle = '#34408f';
  g.fillText(text, 512, 66, 1000);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- tempelan dinding (papan pengumuman, poster, plakat, papan tulis) ----------
// Semua digambar di canvas supaya tetap ringan dan bisa diubah lewat data (jenis + teks).
const _tempelCache = new Map();
function tempelTexture(o) {
  const key = `${o.jenis}|${o.teks || ''}|${o.warna || ''}|${o.rata || ''}|${o.besarHuruf || ''}|${o.lebar}x${o.tinggi}`;
  if (_tempelCache.has(key)) return _tempelCache.get(key);
  const pxm = 220;                                            // piksel per meter
  const c = document.createElement('canvas');
  c.width = Math.max(32, Math.round(o.lebar * pxm)); c.height = Math.max(32, Math.round(o.tinggi * pxm));
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const rnd = (() => { let s = 7; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();   // acak tapi tetap
  const lines = (arr, x, y, size, color, weight = 700, gap = 1.35) => {
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    arr.forEach((t, i) => { g.font = `${weight} ${size[i] ?? size[0]}px Inter, Arial, sans-serif`; g.fillText(t, x, y + i * (size[0] * gap), W * 0.9); });
  };
  switch (o.jenis) {
    case 'papan-pengumuman': {                                // papan biru penuh kertas tempelan
      g.fillStyle = '#2f6fae'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#d8dde3'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
      for (let i = 0; i < 14; i++) {
        g.fillStyle = ['#efe6cf', '#f4f1ea', '#e8d6a8', '#cfe0ee', '#f2d7cf'][i % 5];
        const w = W * (0.15 + rnd() * 0.25), h = H * (0.1 + rnd() * 0.22);
        g.fillRect(rnd() * (W - w), rnd() * (H - h), w, h);
      }
      break;
    }
    case 'poster': {                                          // poster berbingkai hitam
      g.fillStyle = '#151515'; g.fillRect(0, 0, W, H);
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, o.warna || '#1d3b34'); grd.addColorStop(1, '#0d1714');
      g.fillStyle = grd; g.fillRect(10, 10, W - 20, H - 20);
      lines([o.teks || 'INFORMATIKA'], W / 2, H * 0.12, [Math.round(W * 0.11)], '#f2c94c', 800);
      for (let i = 0; i < 4; i++) { g.fillStyle = '#9cc3c9'; g.beginPath(); g.arc(W * (0.2 + i * 0.2), H * 0.5, W * 0.07, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e9efe9'; g.beginPath(); g.arc(W / 2, H * 0.8, W * 0.14, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'logo': {                                            // pelat logo (mis. hmif)
      g.fillStyle = '#4a5560'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#7b8792'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
      g.strokeStyle = '#8fd0f0'; g.lineWidth = W * 0.06; g.beginPath(); g.arc(W * 0.42, H * 0.38, W * 0.2, Math.PI * 0.6, Math.PI * 1.9); g.stroke();
      lines([o.teks || 'logo'], W / 2, H * 0.78, [Math.round(H * 0.24)], '#e9f4fb', 800);
      break;
    }
    case 'plakat': {                                          // papan nama departemen (footage lt 3 E): bingkai krem bertingkat,
      // kayu gelap di atas dan bawah, panel kayu merah di tengah dengan lambang Undip dan huruf baja mengilap
      g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#cfc6af'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const m = W * (0.025 + k * 0.03); g.strokeRect(m, m, W - 2 * m, H - 2 * m); }
      const ix = W * 0.12, iw = W * 0.76, iy = W * 0.12, ih = H - 2 * iy;
      const grain = (x, y, w, h, base, dark, light) => {
        g.fillStyle = base; g.fillRect(x, y, w, h);
        for (let yy = y; yy < y + h; yy += 3) { g.fillStyle = rnd() < 0.5 ? dark : light; g.globalAlpha = 0.25; g.fillRect(x, yy, w, 1 + rnd() * 2); }
        g.globalAlpha = 1;
      };
      grain(ix, iy, iw, ih * 0.24, '#2e2c2b', '#1d1c1b', '#45413e');                  // kayu gelap atas
      grain(ix, iy + ih * 0.24, iw, ih * 0.54, '#9d4a35', '#87402e', '#b2593f');      // panel merah
      grain(ix, iy + ih * 0.78, iw, ih * 0.22, '#2e2c2b', '#1d1c1b', '#45413e');      // kayu gelap bawah
      // lambang (perisai hijau tua berpinggir emas)
      const lx = W / 2, ly = iy + ih * 0.34, lr = iw * 0.09;
      g.fillStyle = '#c9a646'; g.beginPath(); g.moveTo(lx - lr * 1.05, ly - lr * 1.1); g.lineTo(lx + lr * 1.05, ly - lr * 1.1);
      g.lineTo(lx + lr * 1.05, ly + lr * 0.3); g.quadraticCurveTo(lx + lr, ly + lr * 1.15, lx, ly + lr * 1.35); g.quadraticCurveTo(lx - lr, ly + lr * 1.15, lx - lr * 1.05, ly + lr * 0.3); g.closePath(); g.fill();
      g.fillStyle = '#1e3326'; g.beginPath(); g.moveTo(lx - lr * 0.9, ly - lr * 0.95); g.lineTo(lx + lr * 0.9, ly - lr * 0.95);
      g.lineTo(lx + lr * 0.9, ly + lr * 0.28); g.quadraticCurveTo(lx + lr * 0.85, ly + lr * 1.0, lx, ly + lr * 1.18); g.quadraticCurveTo(lx - lr * 0.85, ly + lr * 1.0, lx - lr * 0.9, ly + lr * 0.28); g.closePath(); g.fill();
      g.fillStyle = '#e7e2d2'; g.beginPath(); g.arc(lx, ly + lr * 0.05, lr * 0.45, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d4772f'; g.beginPath(); g.arc(lx, ly - lr * 0.15, lr * 0.2, 0, Math.PI * 2); g.fill();
      // huruf baja (abu terang)
      // huruf baja (abu terang), lebar baris dibatasi lebar panel merah
      const t = (o.teks || 'DEPARTEMEN').split('|');
      g.textAlign = 'center'; g.textBaseline = 'middle';
      t.forEach((line, i) => {
        const size = Math.round(iw * (i ? 0.052 : 0.068));
        g.font = `800 ${size}px Inter, Arial, sans-serif`;
        const yy = iy + ih * 0.5 + i * iw * 0.095;
        g.fillStyle = 'rgba(40,20,15,0.5)'; g.fillText(line, W / 2 + 1.5, yy + 2, iw * 0.88);
        g.fillStyle = i ? '#e3e6e4' : '#eef0ee'; g.fillText(line, W / 2, yy, iw * 0.88);
      });
      break;
    }
    case 'lambang': {                                         // lambang Undip kecil (lencana bulat di atas tulisan)
      g.fillStyle = '#1c1d20'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c9a646'; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.46, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1e3326'; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.38, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e7e2d2'; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.18, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'papan-tulis': {
      g.fillStyle = '#b9bec4'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#f7f7f4'; g.fillRect(8, 8, W - 16, H - 16);
      // bekas kertas dan selotip yang menempel, label kecil di tepi atas (footage)
      for (let i = 0; i < 70; i++) { g.fillStyle = rnd() < 0.6 ? 'rgba(170,125,80,0.4)' : 'rgba(120,90,60,0.3)'; g.fillRect(12 + rnd() * (W - 30), 12 + rnd() * (H - 30), 4 + rnd() * 9, 3 + rnd() * 6); }
      for (const fx of [0.12, 0.42, 0.86]) { g.fillStyle = '#efe3c4'; g.fillRect(W * fx, H * 0.04, W * 0.09, H * 0.035); }
      break;
    }
    case 'papan-dart': {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
      ['#1b1b1b', '#e9e2cf', '#1b1b1b', '#c0392b', '#e9e2cf', '#1b1b1b'].forEach((col, i) => {
        g.fillStyle = col; g.beginPath(); g.arc(W / 2, H / 2, (W / 2 - 2) * (1 - i * 0.16), 0, Math.PI * 2); g.fill(); });
      break;
    }
    case 'tulisan': {                                         // huruf besar di bidang gelap (mis. di atas pintu)
      g.fillStyle = o.warna || '#1d1f22'; g.fillRect(0, 0, W, H);
      if (o.teks) {
        // sedikit bayangan supaya huruf terlihat timbul seperti huruf 3D di footage
        const ax = o.rata === 'kiri' ? W * 0.05 : W / 2;
        g.textAlign = o.rata === 'kiri' ? 'left' : 'center'; g.textBaseline = 'middle';
        g.font = `800 ${Math.round(H * (o.besarHuruf ?? 0.62))}px Inter, Arial, sans-serif`;
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(o.teks, ax + 3, H / 2 + 4, W * 0.9);
        g.fillStyle = '#f4f4f1'; g.fillText(o.teks, ax, H / 2, W * 0.9);
      }
      break;
    }
    case 'panel-kisi': {                                      // panel kisi kayu vertikal (bilah cokelat muda, celah gelap)
      g.fillStyle = '#6e4428'; g.fillRect(0, 0, W, H);
      const pitch = 15;                                        // ~7 cm per bilah
      for (let x = 0, k = 0; x < W; x += pitch, k++) {
        g.fillStyle = ['#c98d58', '#d39a63', '#c48552', '#cf955e'][k % 4]; g.fillRect(x + 3, 0, pitch - 4, H);
        g.fillStyle = 'rgba(255,240,215,0.18)'; g.fillRect(x + 4, 0, 2, H);
      }
      break;
    }
    case 'papan-putih': {                                     // papan putih bertulisan hitam (papan nama Departemen Matematika di jembatan F-B)
      g.fillStyle = o.warna || '#f4f4f0'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#d5d5cf'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
      const t = (o.teks || '').split('|');
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#1d1f22';
      t.forEach((line, i) => { const sz = Math.round(H * (i ? 0.15 : 0.22)); g.font = `800 ${sz}px Inter, Arial, sans-serif`;
        g.fillText(line, W * (i ? 0.1 : 0.05), H * (i ? 0.42 + i * 0.2 : 0.24), W * 0.9); });
      break;
    }
    case 'dinding-departemen': {                             // dinding nama departemen (footage lt 3 F): bilah kayu merah tua di kiri-kanan,
      // panel marmer putih di tengah dengan lambang Undip dan huruf biru, huruf tegak biru di bilah kanan
      g.fillStyle = '#6b2a1f'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 9) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,200,170,0.07)'; g.fillRect(x, 0, 3, H); }
      const mx = W * 0.2, mw = W * 0.6, my = H * 0.08, mh = H * 0.86;
      g.fillStyle = '#ecebe6'; g.fillRect(mx, my, mw, mh);
      for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(120,120,125,${0.08 + rnd() * 0.12})`; g.lineWidth = 1 + rnd() * 2;
        const x = mx + rnd() * mw, y = my + rnd() * mh; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60); g.stroke(); }
      g.fillStyle = '#c9a646'; g.beginPath(); g.arc(W / 2, my + mh * 0.2, mw * 0.08, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1e3326'; g.beginPath(); g.arc(W / 2, my + mh * 0.2, mw * 0.06, 0, Math.PI * 2); g.fill();
      const t = (o.teks || 'DEPARTEMEN').split('|');
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2c3f9a';
      t.forEach((line, i) => { const sz = Math.round(mw * (i === 1 ? 0.16 : i === 0 ? 0.075 : 0.045)); g.font = `800 ${sz}px Inter, Arial, sans-serif`;
        g.fillText(line, W / 2, my + mh * (0.36 + [0, 0.09, 0.2, 0.26][i] ?? 0.3), mw * 0.9); });
      if (t[1]) { g.font = `800 ${Math.round(W * 0.09)}px Inter, Arial, sans-serif`;
        [...t[1]].forEach((ch, i) => g.fillText(ch, W * 0.9, my + (i + 0.6) * (mh / t[1].length), W)); }
      g.fillStyle = '#4b6b3a'; for (const px of [mx + mw * 0.12, mx + mw * 0.88]) { g.beginPath(); g.arc(px, my + mh * 0.9, mw * 0.07, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'panel-kayu': {                                      // panel kayu polos cokelat muda berserat halus
      const grd = g.createLinearGradient(0, 0, W, 0);
      grd.addColorStop(0, o.warna || '#cf8a45'); grd.addColorStop(1, o.warna || '#e2a258');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 2) { g.fillStyle = rnd() < 0.5 ? 'rgba(120,60,20,0.08)' : 'rgba(255,230,190,0.07)'; g.fillRect(x, 0, 1 + rnd() * 2, H); }
      break;
    }
    default: {                                                // papan nama kecil / rambu
      g.fillStyle = o.warna || '#1f4f8f'; g.fillRect(0, 0, W, H);
      if (o.teks) lines(o.teks.split('|'), W / 2, H * (o.teks.includes('|') ? 0.33 : 0.5), [Math.round(H * (o.teks.includes('|') ? 0.3 : 0.45))], '#ffffff', 800);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  _tempelCache.set(key, t);
  return t;
}

// Perabot kecil di lantai (tempat sampah, kotak), dipakai untuk penanda yang terlihat di footage.
function buildPerabot(list, Y) {
  const grp = new THREE.Group();
  grp.name = 'perabot';
  for (const p of list || []) {
    const [x, z] = p.posisi;
    const m = new THREE.MeshStandardMaterial({ color: p.warna || '#2b2f33', roughness: 0.55 });
    if (p.jenis === 'tempat-sampah') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.6, 18), m);
      body.position.set(x, Y + 0.3, z);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.205, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
      lid.position.set(x, Y + 0.6, z);
      grp.add(body, lid);
    } else {
      const [w, d, h] = p.ukuran || [0.45, 0.45, 1.0];
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      box.position.set(x, Y + (p.dasar || 0) + h / 2, z);
      box.rotation.y = THREE.MathUtils.degToRad(p.arah || 0);
      grp.add(box);
    }
  }
  grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grp;
}

// Dinding miring (bidang tegak sepanjang a->b) dengan tepi bawah dan atas yang boleh miring.
// Dipakai untuk tembok setengah badan di tangga dan dinding pengisi di bawah tangga.
function slopedWall(arr, x0, z0, x1, z1, yb0, yb1, yt0, yt1, th) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  const sh = new THREE.Shape();
  sh.moveTo(0, yb0); sh.lineTo(len, yb1); sh.lineTo(len, yt1); sh.lineTo(0, yt0); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false });
  g.translate(0, 0, -th / 2);
  g.rotateY(Math.atan2(-uz, ux));
  g.translate(x0, 0, z0);
  arr.push(g);
}

// Warna lantai ruang menurut fungsi dan menurut sumber data
export const ROOM_COLORS = {
  fungsi: { kelas: '#e8e1d3', lab: '#d6e3cf', kantor: '#e2dbea', organisasi: '#f1dcc6', ruang: '#e5e1d8',
            toilet: '#cddbe2', gudang: '#ddd3c2', sirkulasi: '#d8d5cd', tangga: '#d2cec5' },
  sumber: { 'denah-2023': '#dcdcd6', 'koreksi-lapangan': '#f2b36b', 'footage-2026': '#8fc1ec' },
};

// ---------- pembangun utama ----------

export function buildGedung(data) {
  const T = data.tampilan;
  const mat = {
    wall: new THREE.MeshStandardMaterial({ color: T.dinding, roughness: 0.92 }),
    wallIn: new THREE.MeshStandardMaterial({ color: T.dindingDalam, roughness: 0.95 }),
    col: new THREE.MeshStandardMaterial({ color: T.kolom, roughness: 0.9 }),
    slab: new THREE.MeshStandardMaterial({ color: '#cfcdc6', roughness: 0.95 }),
    selasar: new THREE.MeshStandardMaterial({ color: T.selasar, map: tileTexture(), roughness: 0.35 }),
    frame: new THREE.MeshStandardMaterial({ color: T.kusen, roughness: 0.6, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9cc0d2', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false }),
    glassDark: new THREE.MeshStandardMaterial({ color: '#1f2428', roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.88 }),
    glassFrost: new THREE.MeshStandardMaterial({ color: '#eef1f2', roughness: 0.6, transparent: true, opacity: 0.86 }),   // kaca buram partisi
    plinth: new THREE.MeshStandardMaterial({ color: data.fondasi?.warna || '#4b5056', roughness: 0.9 }),
    door: new THREE.MeshStandardMaterial({ color: T.pintu, roughness: 0.7 }),
    trim: new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.5 }),
    handle: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.35, metalness: 0.5 }),
    rail: new THREE.MeshStandardMaterial({ color: T.pagar, roughness: 0.35, metalness: 0.25 }),
    stair: new THREE.MeshStandardMaterial({ color: '#efeee9', roughness: 0.9 }),
    stairDark: new THREE.MeshStandardMaterial({ color: '#26272a', roughness: 0.4 }),
    stairTop: new THREE.MeshStandardMaterial({ color: '#e6dfd2', map: tileTexture(), roughness: 0.35 }),
    tritBawah: new THREE.MeshStandardMaterial({ color: '#ece9e1', roughness: 0.9 }),
    kayu: new THREE.MeshStandardMaterial({ color: '#4b3b2d', roughness: 0.8 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#efeee9', roughness: 0.95 }),
    roof: new THREE.MeshStandardMaterial({ color: '#ffffff', map: roofTexture(T.atap), roughness: 0.85, side: THREE.DoubleSide }),
    fascia: new THREE.MeshStandardMaterial({ color: '#e9e9e4', roughness: 0.8 }),
    ridge: new THREE.MeshStandardMaterial({ color: '#3a3f3e', roughness: 0.8 }),
    collider: new THREE.MeshBasicMaterial({ visible: false }),
  };

  const root = new THREE.Group();
  root.name = 'gedung-' + data.id;
  const out = { root, data, floors: [], rooms: new Map(), solids: [], walkables: [], top: null, roof: null, materials: mat };

  const levels = data.lantai.map(f => f.elevasi);
  const nextElev = no => {
    const i = data.lantai.findIndex(f => f.no === no);
    return i + 1 < data.lantai.length ? data.lantai[i + 1].elevasi : null;
  };

  for (const f of data.lantai) {
    const g = new THREE.Group();
    g.name = 'lantai-' + f.no;
    g.userData.no = f.no;
    root.add(g);

    const Y = f.elevasi;
    const yTop = Y + f.tinggiPlafon;
    const P = { wall: [], wallIn: [], frame: [], glass: [], glassDark: [], glassFrost: [], door: [], rail: [], col: [], slab: [], selasar: [], stair: [],
      stairDark: [], stairTop: [], tritTop: [], tritBawah: [], kayu: [], walk: [], collider: [], signs: [], tempel: [], plinth: [],
      doorWarna: {}, trim: [], handle: [] };

    const roomByKode = new Map(f.ruang.map(r => [r.kode, r]));

    // --- dinding beserta pintu dan jendela ---
    for (const w of f.dinding) buildWall(w, Y, yTop, P, roomByKode);

    // --- pelat lantai per ruang (yang bukan void) dan permukaan ruang yang bisa dipilih ---
    const floorEntry = { no: f.no, group: g, data: f, roomMeshes: [], elev: Y };
    for (const r of f.ruang) {
      const [cx, cz] = centroid(r.poligon);
      let surface = null;
      if (!r.void) {
        P.slab.push(slabGeo(r.poligon, Y, f.no === 1 ? 0.35 : 0.15));
        const sg = new THREE.ShapeGeometry(shapeOf(r.poligon));
        sg.rotateX(-Math.PI / 2);
        sg.translate(0, Y + 0.006, 0);
        surface = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#e8e1d3', map: tileTexture(), roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1 }));
        surface.receiveShadow = true;
        surface.userData = { kode: r.kode, room: true };
        g.add(surface);
        floorEntry.roomMeshes.push(surface);
      }
      out.rooms.set(r.kode, { room: r, floor: f.no, elev: Y, center: new V3(cx, Y, cz), surface, area: polyArea(r.poligon) });
    }

    // --- selasar: pelat + balok tepi ---
    if (f.selasar) {
      const ys = f.elevasiSelasar;
      P.selasar.push(slabGeo(f.selasar.poligon, ys, f.no === 1 ? 0.3 : 0.15));
      // selasar tambahan: pelat lain di lantai yang sama (mis. selasar sayap, area drop-off), elevasi sendiri bila ada
      for (const s of f.selasar.tambahan || []) P.selasar.push(slabGeo(s.poligon, s.elevasi ?? ys, f.no === 1 ? 0.3 : 0.15));
    }
    // --- alas (fondasi) untuk gedung yang lantai 1-nya lebih tinggi dari tanah ---
    if (f.no === 1 && data.fondasi) {
      const d0 = data.fondasi.dasar ?? -0.22;
      for (const poly of [...f.ruang.map(r => r.poligon), f.selasar?.poligon].filter(Boolean)) {
        const top = (poly === f.selasar?.poligon ? f.elevasiSelasar - 0.3 : Y - 0.35) + 0.01;
        if (top - d0 > 0.05) P.plinth.push(slabGeo(poly, top, top - d0));
      }
      for (const s of f.selasar?.tambahan || []) {
        const top = (s.elevasi ?? f.elevasiSelasar) - 0.3 + 0.01;
        if (top - d0 > 0.05) P.plinth.push(slabGeo(s.poligon, top, top - d0));
      }
    }

    // --- kolom: dipotong per lantai supaya lantai atas bisa disembunyikan ---
    const k = data.kolom;
    const ne = nextElev(f.no);
    const cy0 = f.no === 1 ? k.dasar : Y;
    const cy1 = ne ?? k.puncak;
    for (const [x, z] of k.titik) P.col.push(boxXZ(x - k.ukuran / 2, z - k.ukuran / 2, x + k.ukuran / 2, z + k.ukuran / 2, cy0, cy1));
    // kolom tambahan: { titik, lantai: [dari, sampai], dasar?, puncak?, ukuran? }. Dipakai untuk gedung yang jumlah lantainya
    // tidak sama di semua bagian (sayap dua lantai, kanopi drop-off) dan untuk kolom yang posisinya beda per lantai.
    for (const kt of k.tambahan || []) {
      const [l0, l1] = kt.lantai || [1, 1];
      if (f.no < l0 || f.no > l1) continue;
      const u = (kt.ukuran ?? k.ukuran) / 2;
      const y0 = f.no === 1 ? (kt.dasar ?? k.dasar) : Y;
      const y1 = f.no === l1 && kt.puncak != null ? kt.puncak : (ne ?? k.puncak);
      for (const [x, z] of kt.titik) P.col.push(boxXZ(x - u, z - u, x + u, z + u, y0, y1));
    }

    // --- pagar dari data (dy relatif terhadap lantai) ---
    for (const p of f.pagar || []) {
      const a = new V3(p.a[0], Y + p.a[2], p.a[1]), b = new V3(p.b[0], Y + p.b[2], p.b[1]);
      if (p.jenis.startsWith('tembok')) buildParapet(a, b, P, p.tinggi ?? 1.0, p.jenis, p);
      else if (p.jenis === 'pegangan-dinding') buildHandrail(a, b, P, p.tinggi ?? 0.9);
      else buildRail(a, b, P, p.tinggi ?? 1.0);
    }

    // --- atap tritisan (genteng miring di depan selasar) yang menempel di lantai ini ---
    for (const tr of (data.tritisan || []).filter(t => t.lantai === f.no)) buildTritisan(tr, P);

    // --- tangga yang berangkat dari lantai ini ---
    for (const t of data.tangga.filter(t => t.dariLantai === f.no)) {
      const Y2 = levels[data.lantai.findIndex(x => x.no === t.keLantai)];
      // putar: tangga disusun di bingkai bawaan (lajur sejajar sumbu z) lalu diputar terhadap (0,0) gedung.
      // putar 90: (x, z) bingkai -> (z, -x) gedung, jadi tangga yang lajurnya sejajar sumbu x bisa dibuat.
      const mark = {};
      for (const [key, v] of Object.entries(P)) if (Array.isArray(v)) mark[key] = v.length;
      buildStair(t, Y, Y2, P);
      if (t.putar) {
        const m = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(t.putar));
        for (const [key, n] of Object.entries(mark)) for (let i = n; i < P[key].length; i++) if (P[key][i]?.isBufferGeometry) P[key][i].applyMatrix4(m);
      }
    }

    // --- rakit mesh ---
    const add = (m, list) => { if (m) { g.add(m); if (list) list.push(m); } };
    add(merged(P.wall, mat.wall), out.solids);
    add(merged(P.wallIn, mat.wallIn), out.solids);
    add(merged(P.col, mat.col), out.solids);
    add(merged(P.frame, mat.frame, { cast: false }));
    add(merged(P.glass, mat.glass, { cast: false, receive: false }));
    add(merged(P.glassDark, mat.glassDark, { cast: false }));
    add(merged(P.glassFrost, mat.glassFrost, { cast: false }));
    add(merged(P.plinth, mat.plinth), out.solids);
    add(merged(P.door, mat.door, { cast: false }));
    for (const [c, list] of Object.entries(P.doorWarna)) add(merged(list, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }), { cast: false }));
    add(merged(P.trim, mat.trim, { cast: false }));
    add(merged(P.handle, mat.handle, { cast: false }));
    add(merged(P.rail, mat.rail, { cast: false }));
    add(merged(P.slab, mat.slab), out.walkables);
    add(merged(P.selasar, mat.selasar), out.walkables);
    add(merged(P.stair, mat.stair), out.walkables);
    add(merged(P.stairDark, mat.stairDark), out.walkables);
    add(merged(P.stairTop, mat.stairTop, { cast: false }), out.walkables);
    add(merged(P.tritTop, mat.roof));
    add(merged(P.tritBawah, mat.tritBawah, { cast: false }));
    add(merged(P.kayu, mat.kayu, { cast: false }));
    for (const sg of P.signs) {
      const m = new THREE.Mesh(sg.geo, sg.huruf
        ? new THREE.MeshStandardMaterial({ map: letterTexture(sg.text), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })
        : new THREE.MeshStandardMaterial({ map: signTexture(sg.text), roughness: 0.5 }));
      m.userData.sign = sg.text;
      g.add(m);
    }
    // tempelan: satu muka bertekstur (sisi yang menghadap keluar), muka lain polos
    const plain = new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 0.7 });
    for (const tp of P.tempel) {
      const face = new THREE.MeshStandardMaterial({ map: tempelTexture(tp.o), roughness: 0.6 });
      const mats = [plain, plain, plain, plain, tp.side > 0 ? face : plain, tp.side > 0 ? plain : face];
      const m = new THREE.Mesh(tp.geo, mats);
      m.userData.tempelan = tp.o.jenis;
      g.add(m);
    }
    if (f.perabot?.length) g.add(buildPerabot(f.perabot, Y));
    const col = merged(P.collider, mat.collider, { cast: false, receive: false });
    if (col) { col.visible = false; col.userData.collider = true; add(col, out.solids); }

    out.floors.push(floorEntry);
  }

  // --- plafon lantai teratas + atap (bisa lebih dari satu, tiap atap punya titik asal dan sudut putar) ---
  const top = new THREE.Group();
  top.name = 'plafon-atas';
  const roofs = new THREE.Group();
  roofs.name = 'atap';
  for (const a of Array.isArray(data.atap) ? data.atap : [data.atap]) {
    const place = g => {
      const [ox, oz] = a.asal || [0, 0];
      g.position.set(ox, 0, oz);
      g.rotation.y = -THREE.MathUtils.degToRad(a.sudut || 0);   // sumbu x lokal diarahkan sesuai sudut atap
      return g;
    };
    const [bx0, bz0, bx1, bz1] = a.batasPlafon || a.batas;     // plafon tetap di badan gedung walau atapnya diperpanjang untuk dipotong
    if (a.plafonPoligon) {
      // plafon berbentuk bebas (koordinat gedung, tidak ikut asal/sudut atap): untuk atap yang plafonnya tidak persegi
      // atau yang bertumpuk dengan atap lain (supaya dua plafon tidak berimpit di tempat yang sama).
      for (const poly of a.plafonPoligon) {
        const m = new THREE.Mesh(slabGeo(poly, a.tepiBawah, 0.15), mat.ceiling);
        m.castShadow = m.receiveShadow = true;
        top.add(m);
      }
    } else {
      const cg = place(new THREE.Group());
      const ceil = new THREE.Mesh(boxXZ(bx0 - 0.2, bz0 - 0.2, bx1 + 0.2, bz1 + 0.2, a.tepiBawah - 0.15, a.tepiBawah), mat.ceiling);
      ceil.castShadow = ceil.receiveShadow = true;
      cg.add(ceil);
      top.add(cg);
    }
    if (a.jenis === 'datar') {
      const flat = new THREE.Mesh(boxXZ(bx0 - 0.25, bz0 - 0.25, bx1 + 0.25, bz1 + 0.25, a.tepiBawah, a.tepiBawah + 0.25), mat.ridge);
      flat.castShadow = flat.receiveShadow = true;
      roofs.add(place(new THREE.Group().add(flat)));
    } else {
      roofs.add(place(buildRoof(a, mat)));
    }
  }
  root.add(top);
  out.top = top;
  out.roof = roofs;
  root.add(roofs);

  root.updateMatrixWorld(true);
  return out;
}

// Dinding dengan bukaan. Bukaan memakai t = jarak pusat bukaan dari titik a (meter).
function buildWall(w, Y, yTop, P, rooms) {
  const [ax, az] = w.a, [bx, bz] = w.b;
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;      // arah dinding
  if (w.tinggi != null) yTop = Y + w.tinggi;             // dinding yang tidak setinggi plafon (partisi, dinding bawah tangga)
  if (w.dasar) Y += w.dasar;                             // dinding yang mulai di atas lantai
  if (w.tinggiAkhir != null) {
    // dinding miring: tinggi di titik a = tinggi, di titik b = tinggiAkhir (mis. dinding pengisi di bawah tangga)
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(len, w.tinggiAkhir); sh.lineTo(0, w.tinggi); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: w.tebal, bevelEnabled: false });
    g.translate(0, 0, -w.tebal / 2);
    g.rotateY(Math.atan2(-uz, ux));
    g.translate(ax, Y, az);
    (w.luar ? P.wall : P.wallIn).push(g);
    return;
  }
  const nx = -uz, nz = ux;                               // normal sisi kiri
  const at = t => [ax + ux * t, az + uz * t];
  const seg = (t0, t1, y0, y1, th, arr) => {
    if (t1 - t0 < 1e-3 || y1 - y0 < 1e-3) return;
    const [x0, z0] = at(t0), [x1, z1] = at(t1);
    arr.push(wallBox(x0, z0, x1, z1, y0, y1, th));
  };
  const th = w.tebal;
  const W = w.luar ? P.wall : P.wallIn;     // dinding luar abu-abu muda, dinding dalam putih gading
  const ext = th / 2;            // perpanjang ujung supaya sudut pertemuan dinding tertutup
  let cur = -ext;
  const ops = [...(w.bukaan || [])].sort((p, q) => p.t - q.t);

  // arah ke dalam ruang yang dilayani bukaan (untuk daun pintu, jendela ventilasi, papan nama)
  const roomSide = o => {
    const r = rooms.get(o.ruang);
    if (!r) return 1;
    const [cx, cz] = centroid(r.poligon);
    return Math.sign((cx - ax) * nx + (cz - az) * nz) || 1;
  };

  for (const o of ops) {
    const s = o.t - o.lebar / 2, e = o.t + o.lebar / 2;
    const isDoor = o.jenis.startsWith('pintu');
    const sill = isDoor ? 0 : (o.ambang ?? 1);
    const top = Math.min(yTop, Y + sill + o.tinggi);
    seg(cur, s, Y, yTop, th, W);                         // pilar dinding sebelum bukaan
    if (sill > 0) seg(s, e, Y, Y + sill, th, W);         // dinding di bawah jendela
    seg(s, e, top, yTop, th, W);                         // dinding di atas bukaan (ambang atas)

    // kusen
    const fw = 0.06, fd = th + 0.02;
    seg(s, s + fw, Y + sill, top, fd, P.frame);
    seg(e - fw, e, Y + sill, top, fd, P.frame);
    seg(s, e, top - fw, top, fd, P.frame);

    if (o.jenis === 'ventilasi') {
      // jendela ventilasi panjang: daun kaca engsel atas, dibuka miring 20 derajat ke luar
      seg(s, e, Y + sill, Y + sill + fw, fd, P.frame);
      const side = roomSide(o);
      const panes = Math.max(1, Math.round(o.lebar / 0.6));
      const pw = (o.lebar - 2 * fw) / panes;
      const ph = o.tinggi - 2 * fw;
      const ang = o.tertutup ? 0 : side * THREE.MathUtils.degToRad(20);      // tertutup: kaca rata dengan dinding
      for (let i = 0; i < panes; i++) {
        const tc = s + fw + pw * (i + 0.5);
        if (i > 0) seg(tc - pw / 2 - 0.015, tc - pw / 2 + 0.015, Y + sill, top, fd, P.frame);
        const [hx, hz] = at(tc);
        const ox = -nx * side * (th / 2), oz = -nz * side * (th / 2);      // engsel di muka luar dinding
        for (const [arr, w, d] of [[P.glassDark, pw - 0.05, 0.015], [P.frame, pw - 0.01, 0.03]]) {
          const g = new THREE.BoxGeometry(w, arr === P.glassDark ? ph - 0.06 : 0.04, d);
          if (arr === P.frame) g.translate(0, -ph + 0.02, 0);                 // palang bawah daun
          else g.translate(0, -ph / 2, 0);
          g.rotateX(ang);
          g.rotateY(Math.atan2(-uz, ux));
          g.translate(hx + ox, top - fw, hz + oz);
          arr.push(g);
        }
      }
    } else if (!isDoor) {
      seg(s, e, Y + sill, Y + sill + fw, fd, P.frame);
      seg(s + fw, e - fw, Y + sill + fw, top - fw, 0.02, o.buram ? P.glassFrost : P.glass);
      const panes = Math.max(1, Math.round(o.lebar / (o.buram ? 1.2 : 0.65)));   // tiang tengah tiap ~65 cm (partisi buram ~1,2 m)
      for (let i = 1; i < panes; i++) {
        const t = s + (o.lebar * i) / panes;
        seg(t - 0.02, t + 0.02, Y + sill, top, 0.05, P.frame);
      }
      if (o.tinggi > 1.2) seg(s, e, top - 0.47, top - 0.43, 0.05, P.frame);   // palang boven
    } else {
      // daun pintu dibuka 75 derajat ke arah ruang yang dilayani pintu
      const side = roomSide(o);
      const mx = nx * side, mz = nz * side;
      if (o.papanNama) {
        // papan kode ruang menempel di tembok sisi luar, tepat di atas pintu
        const [px, pz] = at(o.t);
        const off = th / 2 + 0.012;
        const text = o.papanTeks || o.ruang;
        const geo = new THREE.BoxGeometry(signWidth(text), 0.23, 0.02);
        geo.rotateY(Math.atan2(-uz, ux));
        geo.translate(px - mx * off, top + 0.2, pz - mz * off);
        P.signs.push({ geo, text });
      }
      // boven: kaca di atas daun pintu, di dalam kusen yang sama (gelap untuk pintu kelas, buram untuk KM)
      let leafTop = top - fw;
      if (o.boven) {
        const yb = top - o.boven;
        seg(s, e, yb - fw, yb, fd, P.frame);
        seg(s + fw, e - fw, yb, top - fw, 0.02, o.bovenGelap ? P.glassDark : P.glass);
        leafTop = yb - fw;
      }
      const ang = ((o.sudutBuka ?? 75) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
      const leaf = (t, dirSign, lw) => {
        const [hx0, hz0] = at(t);
        const hx = hx0 + mx * (th / 2), hz = hz0 + mz * (th / 2);   // engsel di muka dinding sisi ruang
        const dx = dirSign * ux * ca + mx * sa, dz = dirSign * uz * ca + mz * sa;
        const leafGeo = wallBox(hx, hz, hx + dx * lw, hz + dz * lw, Y + 0.01, leafTop, 0.04);
        if (o.warnaDaun) (P.doorWarna[o.warnaDaun] ||= []).push(leafGeo); else P.door.push(leafGeo);
        const along = d0 => [hx + dx * d0, hz + dz * d0];
        if (o.lisKaca) {
          // lis putih di tepi bebas daun dengan kaca gelap sempit (pintu Departemen Informatika, footage)
          const [ax_, az_] = along(lw - 0.2), [bx_, bz_] = along(lw - 0.03);
          P.trim.push(wallBox(ax_, az_, bx_, bz_, Y + 0.03, leafTop - 0.03, 0.05));
          const [cx_, cz_] = along(lw - 0.15), [ex_, ez_] = along(lw - 0.08);
          P.glassDark.push(wallBox(cx_, cz_, ex_, ez_, Y + 1.05, Y + 2.0, 0.056));
        }
        if (o.pegangan) {
          // pegangan batang hitam panjang di sisi luar (selasar), dekat tepi bebas daun
          const [gx, gz] = along(lw - 0.12), qx = gx - mx * 0.08, qz = gz - mz * 0.08;
          P.handle.push(boxXZ(qx - 0.015, qz - 0.015, qx + 0.015, qz + 0.015, Y + 0.7, Y + 1.5));
        }
      };
      if (o.jenis === 'pintu-ganda') {
        const lw = o.lebar / 2 - fw;
        leaf(s + fw, 1, lw);
        leaf(e - fw, -1, lw);
      } else {
        leaf(s + fw, 1, o.lebar - 2 * fw);
      }
    }
    cur = e;
  }
  seg(cur, len + ext, Y, yTop, th, W);

  // tempelan: papan tipis di muka dinding. sisi default = luar dari ruang yang disebut di o.ruang.
  for (const o of w.tempelan || []) {
    const side = o.sisi ?? -roomSide(o);
    const d = o.tebal ?? 0.025;
    const [px, pz] = at(o.t);
    const off = th / 2 + d / 2 + 0.003;
    const geo = new THREE.BoxGeometry(o.lebar, o.tinggi, d);
    geo.rotateY(Math.atan2(-uz, ux));
    geo.translate(px + nx * side * off, Y + (o.ambang ?? 1) + o.tinggi / 2, pz + nz * side * off);
    P.tempel.push({ geo, o, side });
  }
}

// Railing stainless: pegangan atas, satu palang tengah, tiang tiap ~1 m (seperti di footage).
// p0/p1 = titik dasar (boleh beda tinggi untuk railing tangga). Ditambah collider tak terlihat.
function buildRail(p0, p1, P, h = 1.0) {
  const lift = (p, dy) => new V3(p.x, p.y + dy, p.z);
  P.rail.push(beam(lift(p0, h), lift(p1, h), 0.045, 0.045));
  P.rail.push(beam(lift(p0, h * 0.5), lift(p1, h * 0.5), 0.025, 0.025));
  const hl = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const n = Math.max(1, Math.round(hl / 1.0));
  for (let i = 0; i <= n; i++) {
    const q = new V3().lerpVectors(p0, p1, i / n);
    P.rail.push(boxXZ(q.x - 0.02, q.z - 0.02, q.x + 0.02, q.z + 0.02, q.y, q.y + h));
  }
  P.collider.push(beam(lift(p0, h / 2), lift(p1, h / 2), 0.1, h));
}

// Pegangan tangan yang menempel di dinding: satu pipa dengan dudukan tiap ~1,2 m (tanpa collider).
function buildHandrail(p0, p1, P, h = 0.9) {
  const lift = (p, dy) => new V3(p.x, p.y + dy, p.z);
  P.rail.push(beam(lift(p0, h), lift(p1, h), 0.04, 0.04));
  const n = Math.max(1, Math.round(p0.distanceTo(p1) / 1.2));
  for (let i = 0; i <= n; i++) {
    const q = new V3().lerpVectors(p0, p1, i / n);
    P.rail.push(boxXZ(q.x - 0.015, q.z - 0.015, q.x + 0.015, q.z + 0.015, q.y + h - 0.08, q.y + h));
  }
}

// Tembok pembatas. jenis:
//   tembok-handrail : tembok polos ±90 cm + pegangan stainless bertiang di atasnya (selasar lt 2-3)
//   tembok-polos    : tembok polos dengan tutup atas (penghubung antar gedung)
//   tembok-roster   : tembok berlubang (model lama, masih didukung)
function buildParapet(p0, p1, P, h = 1.0, jenis = 'tembok-roster', spec = {}) {
  const y = p0.y, th = 0.15;
  const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const ux = (p1.x - p0.x) / len, uz = (p1.z - p0.z) / len;
  const at = t => [p0.x + ux * t, p0.z + uz * t];
  const seg = (t0, t1, y0, y1, d, arr = P.wall) => { const [x0, z0] = at(t0), [x1, z1] = at(t1); arr.push(wallBox(x0, z0, x1, z1, y0, y1, d)); };
  if (jenis === 'tembok-celah' && Math.abs(p1.y - p0.y) > 1e-3) {
    // tembok bercelah yang ikut miring (sisi ramp dan tangga jembatan): pita bawah dan atas miring, tiang di antara celah tegak
    const hw = Math.min(h, 0.9), yAt = t => p0.y + (p1.y - p0.y) * t / len;
    const sw = (t0, t1, d0, d1, d = th, arr = P.wall) => { const [x0, z0] = at(t0), [x1, z1] = at(t1);
      slopedWall(arr, x0, z0, x1, z1, yAt(t0) + d0, yAt(t1) + d0, yAt(t0) + d1, yAt(t1) + d1, d); };
    sw(-0.05, len + 0.05, -0.5, -0.15, 0.25, P.col);                       // balok tepi pelat, ikut miring
    sw(-0.05, len + 0.05, -0.15, 0.25);
    sw(-0.05, len + 0.05, hw - 0.17, hw - 0.05);
    sw(-0.07, len + 0.07, hw - 0.05, hw, th + 0.05);
    const pitch = 0.3, sl = 0.08, n = Math.max(0, Math.floor((len - 0.7) / pitch)), start = (len - n * pitch) / 2;
    let cur = -0.05;
    for (let i = 0; i <= n; i++) { const c = start + i * pitch; sw(cur, c - sl / 2, 0.24, hw - 0.16); cur = c + sl / 2; }
    sw(cur, len + 0.05, 0.24, hw - 0.16);
    P.rail.push(beam(new V3(p0.x, p0.y + hw + 0.14, p0.z), new V3(p1.x, p1.y + hw + 0.14, p1.z), 0.045, 0.045));
    const k = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= k; i++) { const t = (len * i) / k, [x, z] = at(t); P.rail.push(boxXZ(x - 0.018, z - 0.018, x + 0.018, z + 0.018, yAt(t) + hw, yAt(t) + hw + 0.14)); }
    sw(0, len, 0, hw + 0.2, 0.16, P.collider);
    return;
  }
  if (jenis === 'tembok-handrail') {
    // tembok putih berpipa pegangan; ikut miring kalau a dan b beda tinggi (ruas ramp/tangga jembatan). `spec.bawahA/bawahB` (tinggi
    // mutlak di a dan b) menurunkan muka tembok sampai bawah pelat, supaya tampak luar jembatan rata (tidak terlihat anak tangga berundak)
    const hw = Math.min(h, 0.9), dy = p1.y - p0.y, yAt = t => p0.y + dy * t / len;
    const hasB = spec.bawahA != null, bot = t => (hasB ? spec.bawahA + ((spec.bawahB ?? spec.bawahA) - spec.bawahA) * t / len : yAt(t));
    const sw = (t0, t1, f0, f1, d, arr = P.wall) => { const [x0, z0] = at(t0), [x1, z1] = at(t1); slopedWall(arr, x0, z0, x1, z1, f0(t0), f0(t1), f1(t0), f1(t1), d); };
    if (!hasB) sw(-0.05, len + 0.05, t => yAt(t) - 0.5, t => yAt(t) - 0.15, 0.25, P.col);   // balok tepi pelat di bawah tembok
    sw(-0.05, len + 0.05, bot, t => yAt(t) + hw - 0.05, th);
    sw(-0.07, len + 0.07, t => yAt(t) + hw - 0.05, t => yAt(t) + hw, th + 0.04);             // tutup atas tembok
    const hr = t => yAt(t) + hw + 0.17;                                                        // pipa pegangan
    P.rail.push(beam(new V3(p0.x, hr(0), p0.z), new V3(p1.x, hr(len), p1.z), 0.045, 0.045));
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) {
      const t = (len * i) / n, [x, z] = at(t);
      P.rail.push(boxXZ(x - 0.018, z - 0.018, x + 0.018, z + 0.018, yAt(t) + hw, hr(t)));
    }
    sw(0, len, t => Math.min(yAt(t), bot(t)), t => hr(t) + 0.05, 0.12, P.collider);
    return;
  }
  P.col.push(wallBox(p0.x, p0.z, p1.x, p1.z, y - 0.5, y - 0.15, 0.25));   // balok tepi pelat di bawah tembok
  // tulisan besar di muka kiri (normal kiri a->b), mis. "INFORMATIKA"
  if (spec.tulisan) {
    const T = spec.tulisan, side = T.sisi ?? 1;
    const hgt = T.tinggi ?? 0.4, wdt = hgt * 8;
    const [cx, cz] = at(T.t ?? len / 2);
    const g = new THREE.PlaneGeometry(wdt, hgt * 1.25);
    g.rotateY(Math.atan2(-uz, ux));
    const nx = -uz * side, nz = ux * side, off = 0.12;
    g.translate(cx + nx * off, y + h * 0.55, cz + nz * off);
    P.signs.push({ geo: g, text: T.teks, huruf: true });
  }
  if (jenis === 'tembok-polos') {
    seg(-0.05, len + 0.05, y, y + h - 0.06, 0.18);
    seg(-0.07, len + 0.07, y + h - 0.06, y + h, 0.24);
    return;
  }
  if (jenis === 'tembok-celah') {
    // tembok ±90 cm dengan celah vertikal 8 cm tiap 30 cm, tutup atas, dan pipa bertiang di atasnya
    const hw = Math.min(h, 0.9), yb = y + 0.25, yt = y + hw - 0.17;
    seg(-0.05, len + 0.05, y, yb, th);
    seg(-0.05, len + 0.05, yt, y + hw - 0.05, th);
    seg(-0.07, len + 0.07, y + hw - 0.05, y + hw, th + 0.05);
    const m = 0.35, pitch = 0.3, sw = 0.08;
    const n = Math.max(0, Math.floor((len - 2 * m) / pitch));
    const start = (len - n * pitch) / 2;
    let cur = -0.05;
    for (let i = 0; i <= n; i++) {
      const c = start + i * pitch;
      seg(cur, c - sw / 2, yb, yt, th);
      cur = c + sw / 2;
    }
    seg(cur, len + 0.05, yb, yt, th);
    const hr = y + hw + 0.14;
    P.rail.push(beam(new V3(p0.x, hr, p0.z), new V3(p1.x, hr, p1.z), 0.045, 0.045));
    const k = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= k; i++) {
      const [x, z] = at((len * i) / k);
      P.rail.push(boxXZ(x - 0.018, z - 0.018, x + 0.018, z + 0.018, y + hw, hr));
    }
    P.collider.push(wallBox(p0.x, p0.z, p1.x, p1.z, y, hr + 0.05, 0.16));
    return;
  }
  const yb = y + 0.35, yt = y + h - 0.15, ym = (yb + yt) / 2;
  seg(-0.05, len + 0.05, y, yb, th);                    // alas
  seg(-0.05, len + 0.05, yt, y + h - 0.05, th);          // ambang
  seg(-0.08, len + 0.08, y + h - 0.05, y + h, th + 0.06); // tutup atas sedikit lebih lebar
  seg(-0.05, len + 0.05, ym - 0.025, ym + 0.025, th);    // palang tengah, membagi lubang jadi dua baris
  const n = Math.max(1, Math.round(len / 0.3));          // tiang di antara lubang tiap 30 cm
  for (let i = 0; i <= n; i++) {
    const t = (len * i) / n;
    seg(t - 0.06, t + 0.06, yb, yt, th);
  }
}

// Satu anak tangga: badan putih, muka (riser) dan bibir hitam, injakan keramik krem.
// zf = tepi depan (bibir), dir = arah ke belakang injakan (+1 atau -1 pada sumbu z).
function stairStep(P, xa, xb, zf, dir, d, y0, y1, r, krem = false) {
  const z0 = Math.min(zf, zf + dir * d), z1 = Math.max(zf, zf + dir * d);
  P.stair.push(boxXZ(xa, z0, xb, z1, y0, y1 - 0.008));
  // riser: hitam (Gedung A) atau keramik krem dengan list gelap tipis di tepi (Gedung E)
  P[krem ? 'stairTop' : 'stairDark'].push(boxXZ(xa, Math.min(zf, zf - dir * 0.012), xb, Math.max(zf, zf - dir * 0.012), Math.max(y0, y1 - r), krem ? y1 - 0.035 : y1));
  if (krem) P.stairDark.push(boxXZ(xa, Math.min(zf, zf - dir * 0.014), xb, Math.max(zf, zf - dir * 0.014), y1 - 0.035, y1));
  const zn = zf + dir * 0.06;
  P.stairDark.push(boxXZ(xa, Math.min(zf, zn), xb, Math.max(zf, zn), y1 - 0.008, y1));                                       // bibir
  P.stairTop.push(boxXZ(xa, Math.min(zn, zf + dir * d), xb, Math.max(zn, zf + dir * d), y1 - 0.008, y1));                   // injakan
}

// Tangga U dengan bordes: lajur 1 naik dari depan (selasar) ke belakang,
// bordes di belakang, lajur 2 berbalik naik ke depan.
// Opsi: dindingBelakang (bordes menempel dinding -> pegangan dinding), sisiLuar 'dinding' | 'pagar' (sisi x1),
// dindingSisiX0 (sisi x0 berupa dinding -> pegangan dinding, default true).
function buildStair(t, Y, Y2, P) {
  const n = t.jumlahAnakTangga, half = n / 2;
  const r = (Y2 - Y) / n;                 // tinggi tanjakan
  const d = t.lebarInjakan;               // lebar injakan
  const treads = half - 1;
  const zLand = t.zDepan - treads * d;    // batas depan bordes
  const sg = Math.sign(t.x1 - t.x0) || 1;   // arah dari lajur 1 ke lajur 2 (boleh negatif)
  const xm = (t.x0 + t.x1) / 2, cw = t.celah ?? 0.12;
  const f1 = [t.x0 + sg * 0.08, xm - sg * cw / 2], f2 = [xm + sg * cw / 2, t.x1];
  const lo = r => Math.min(r[0], r[1]), hi = r => Math.max(r[0], r[1]);
  const solidBase = t.dariLantai === 1;

  for (let i = 1; i <= treads; i++) {
    const yt = Y + i * r;
    stairStep(P, lo(f1), hi(f1), t.zDepan - (i - 1) * d, -1, d, solidBase ? Y - 0.1 : yt - r - 0.1, yt, r, t.gaya === 'krem');
  }
  const yl = Y + half * r;
  const land = [t.x0 + sg * 0.08, t.x1];
  P.stair.push(boxXZ(lo(land), t.zBelakang + 0.08, hi(land), zLand, yl - 0.18, yl - 0.008));
  P.stairTop.push(boxXZ(lo(land), t.zBelakang + 0.08, hi(land), zLand, yl - 0.008, yl));
  P[t.gaya === 'krem' ? 'stairTop' : 'stairDark'].push(boxXZ(lo(f1), zLand - 0.012, hi(f1), zLand, yl - r, yl));     // riser terakhir lajur 1
  for (let j = 1; j <= treads; j++) {
    const yt = yl + j * r;
    stairStep(P, lo(f2), hi(f2), zLand + (j - 1) * d, 1, d, yt - r - 0.1, yt, r, t.gaya === 'krem');
  }
  // plat miring di bawah anak tangga
  const xc1 = (f1[0] + f1[1]) / 2, xc2 = (f2[0] + f2[1]) / 2;
  if (!solidBase) P.stair.push(beam(new V3(xc1, Y - 0.12, t.zDepan), new V3(xc1, yl - r - 0.12, zLand), hi(f1) - lo(f1), 0.15));
  P.stair.push(beam(new V3(xc2, yl - 0.12, zLand), new V3(xc2, Y2 - r - 0.12, t.zDepan), hi(f2) - lo(f2), 0.15));

  if (t.pembatas === 'tembok') {
    // tembok setengah badan di antara dua lajur (satu per lajur, mengikuti kemiringan masing-masing) + pipa pegangan
    const kh = 0.92, down = 0.32;
    slopedWall(P.wallIn, xm, t.zDepan, xm, zLand, solidBase ? Y : Y - down, solidBase ? Y : yl - down, Y + kh, yl + kh, cw);
    slopedWall(P.wallIn, xm, zLand, xm, t.zDepan, yl - down, Y2 - down, yl + kh, Y2 + kh, cw);
    P.rail.push(beam(new V3(xm, Y + kh + 0.04, t.zDepan), new V3(xm, yl + kh + 0.04, zLand), 0.05, 0.05));
    P.rail.push(beam(new V3(xm, yl + kh + 0.04, zLand), new V3(xm, Y2 + kh + 0.04, t.zDepan), 0.05, 0.05));
    if (t.tiangAwal) P.wallIn.push(boxXZ(xm - 0.13, t.zDepan - 0.05, xm + 0.13, t.zDepan + 0.2, Y, Y + 1.12));   // tiang hias di anak tangga pertama
  } else {
    // railing stainless di sisi dalam kedua lajur
    buildRail(new V3(f1[1] - sg * 0.02, Y, t.zDepan), new V3(f1[1] - sg * 0.02, yl, zLand), P, 0.95);
    buildRail(new V3(f2[0] + sg * 0.02, yl, zLand), new V3(f2[0] + sg * 0.02, Y2, t.zDepan), P, 0.95);
  }
  // sisi x0 (dinding): pegangan dinding sepanjang lajur 1 dan sisi bordes
  const xw = t.x0 + sg * 0.1;
  if (t.dindingSisiX0 !== false) {
    buildHandrail(new V3(xw, Y, t.zDepan), new V3(xw, yl, zLand), P);
    buildHandrail(new V3(xw, yl, zLand), new V3(xw, yl, t.zBelakang + 0.1), P);
  }
  // sisi x1: dinding (pegangan menempel) atau pagar
  const xr = t.x1 - sg * 0.04;
  if (t.sisiLuar === 'polos') {
    // sisi luar berupa dinding polos tanpa pegangan
  } else if (t.sisiLuar === 'tembok') {
    // tangga luar gedung: tembok pembatas di sisi luar lajur 2 dan bordes, berpipa pegangan
    const xo = t.x1 + sg * 0.04;
    slopedWall(P.wall, xo, t.zBelakang, xo, zLand, yl - 0.2, yl - 0.2, yl + 1.0, yl + 1.0, 0.15);
    slopedWall(P.wall, xo, zLand, xo, t.zDepan, yl - 0.35, Y2 - 0.35, yl + 1.0, Y2 + 1.0, 0.15);
    P.rail.push(beam(new V3(xo, yl + 1.04, zLand), new V3(xo, Y2 + 1.04, t.zDepan), 0.05, 0.05));
  } else if (t.sisiLuar === 'dinding') {
    buildHandrail(new V3(xr, yl, t.zBelakang + 0.1), new V3(xr, yl, zLand), P);
    buildHandrail(new V3(xr, yl, zLand), new V3(xr, Y2, t.zDepan), P);
  } else {
    buildRail(new V3(xr, yl, t.zBelakang + 0.1), new V3(xr, yl, zLand), P, 0.95);
    buildRail(new V3(xr, yl, zLand), new V3(xr, Y2, t.zDepan), P, 0.95);
  }
  // belakang bordes
  if (t.belakang === 'tembok') {
    slopedWall(P.wall, t.x0, t.zBelakang - 0.04, t.x1 + sg * 0.1, t.zBelakang - 0.04, yl - 0.2, yl - 0.2, yl + 1.0, yl + 1.0, 0.15);
  } else if (t.dindingBelakang) buildHandrail(new V3(xw, yl, t.zBelakang + 0.12), new V3(xr, yl, t.zBelakang + 0.12), P);
  else if (t.pagarBelakangBordes) buildRail(new V3(t.x0 + sg * 0.1, yl, t.zBelakang + 0.1), new V3(xr, yl, t.zBelakang + 0.1), P, 0.95);
}

// Atap tritisan: bidang genteng miring yang menjorok keluar dari tepi selasar, dengan kasau kayu di bawahnya.
// tr: { a:[x,z], b:[x,z], sisi: +1/-1 (arah keluar = normal kiri a->b dikali sisi), elevasi, lebar, turun, jarak }
function buildTritisan(tr, P) {
  const [ax, az] = tr.a, [bx, bz] = tr.b;
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  const nx = -uz * (tr.sisi ?? 1), nz = ux * (tr.sisi ?? 1);
  const off = tr.jarak ?? 0.1, W = tr.lebar ?? 1.3, D = tr.turun ?? 0.6;
  const y0 = tr.elevasi - 0.05, y1 = y0 - D;
  const pt = (t, s, dy = 0) => [ax + ux * t + nx * (off + s), (s / W) * (y1 - y0) + y0 + dy, az + uz * t + nz * (off + s)];
  const slope = Math.hypot(W, D);
  const quad = (arr, A, B, C, Dd, uv) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...Dd], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    arr.push(g);
  };
  // ujung: perpanjangan 0,1 m, atau dipotong miring mengikuti sudut belok ke potongan sebelah (sudutA/sudutB, derajat;
  // positif = sudut luar, tepi luar diperpanjang sampai garis bagi sudut, sehingga dua potongan bertemu tanpa celah)
  const ext = (deg, s) => deg ? (off + s) * Math.tan(THREE.MathUtils.degToRad(deg) / 2) : 0.1;
  const tA = s => -ext(tr.sudutA, s), tB = s => len + ext(tr.sudutB, s);
  // permukaan atas (genteng); urutan titik dibuat menghadap ke atas
  const T0 = pt(tA(0), 0), T1 = pt(tB(0), 0), T2 = pt(tB(W), W), T3 = pt(tA(W), W);
  const upFirst = (nx * uz - nz * ux) > 0;
  const uvTop = [0, slope * 0.5, len * 0.5, slope * 0.5, len * 0.5, 0, 0, slope * 0.5, len * 0.5, 0, 0, 0];
  if (upFirst) quad(P.tritTop, T0, T1, T2, T3, uvTop); else quad(P.tritTop, T1, T0, T3, T2, uvTop);
  // papan bawah (putih)
  const B0 = pt(tA(0), 0, -0.07), B1 = pt(tB(0), 0, -0.07), B2 = pt(tB(W), W, -0.07), B3 = pt(tA(W), W, -0.07);
  const uv0 = new Array(12).fill(0);
  if (upFirst) quad(P.tritBawah, B1, B0, B3, B2, uv0); else quad(P.tritBawah, B0, B1, B2, B3, uv0);
  // lisplang di tepi luar
  const [fx0, fy0, fz0] = pt(tA(W), W), [fx1, , fz1] = pt(tB(W), W);
  P.tritBawah.push(wallBox(fx0, fz0, fx1, fz1, fy0 - 0.2, fy0 + 0.02, 0.03));
  // kasau kayu tiap 0,6 m
  const k = Math.max(1, Math.round(len / 0.6));
  for (let i = 0; i <= k; i++) {
    const t = (len * i) / k;
    P.kayu.push(beam(new V3(...pt(t, 0, -0.11)), new V3(...pt(t, W - 0.05, -0.11)), 0.05, 0.07));
  }
}

// Atap perisai: empat bidang miring di atas batas gedung + tonjolan.
// Potong segitiga (posisi + uv) dengan beberapa bidang tegak; tiap bidang menyimpan sisi d >= 0.
function clipTriangles(pos, uv, cuts) {
  let P = [];
  for (let i = 0; i < pos.length / 9; i++) {
    P.push([0, 1, 2].map(k => ({ p: pos.slice(i * 9 + k * 3, i * 9 + k * 3 + 3), t: uv.slice(i * 6 + k * 2, i * 6 + k * 2 + 2) })));
  }
  const lerp = (u, v, f) => ({ p: u.p.map((x, k) => x + (v.p[k] - x) * f), t: u.t.map((x, k) => x + (v.t[k] - x) * f) });
  for (const c of cuts) {
    const d = v => c.nx * (v.p[0] - c.ax) + c.nz * (v.p[2] - c.az);
    const next = [];
    for (const poly of P) {
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const u = poly[k], v = poly[(k + 1) % poly.length], du = d(u), dv = d(v);
        if (du >= 0) out.push(u);
        if ((du >= 0) !== (dv >= 0)) out.push(lerp(u, v, du / (du - dv)));
      }
      if (out.length >= 3) next.push(out);
    }
    P = next;
  }
  const np = [], nt = [];
  for (const poly of P) for (let k = 1; k + 1 < poly.length; k++) for (const v of [poly[0], poly[k], poly[k + 1]]) { np.push(...v.p); nt.push(...v.t); }
  return [np, nt];
}
// Potong ruas garis 3D dengan bidang yang sama; null kalau seluruhnya terbuang.
function clipSegment(p, q, cuts) {
  for (const c of cuts) {
    const d = v => c.nx * (v[0] - c.ax) + c.nz * (v[2] - c.az);
    const dp = d(p), dq = d(q);
    if (dp < 0 && dq < 0) return null;
    if (dp < 0) p = p.map((x, k) => x + (q[k] - x) * (dp / (dp - dq)));
    else if (dq < 0) q = q.map((x, k) => x + (p[k] - x) * (dq / (dq - dp)));
  }
  return [p, q];
}

function buildRoof(a, mat) {
  const g = new THREE.Group();
  g.name = 'atap';
  // potong: garis (koordinat gedung) tempat atap berhenti, untuk menyatukan atap dua sayap yang membentuk sudut.
  // `simpan` = satu titik di sisi atap yang dipertahankan. Supaya jurai di ujung itu ikut terbuang, `batas` diperpanjang melewati garis potong.
  const [ox, oz] = a.asal || [0, 0], sr = THREE.MathUtils.degToRad(a.sudut || 0), cs = Math.cos(sr), sn = Math.sin(sr);
  const toL = q => { const dx = q[0] - ox, dz = q[1] - oz; return [dx * cs + dz * sn, -dx * sn + dz * cs]; };
  const cuts = (a.potong || []).map(c => {
    const A = toL(c.a), B = toL(c.b), S = toL(c.simpan);
    let nx = -(B[1] - A[1]), nz = B[0] - A[0];
    if (nx * (S[0] - A[0]) + nz * (S[1] - A[1]) < 0) { nx = -nx; nz = -nz; }
    return { ax: A[0], az: A[1], nx, nz };
  });
  // buang: poligon cembung (koordinat gedung) yang dikeluarkan dari atap, mis. bagian sayap yang masuk ke badan lantai 3.
  // Tiap tepi poligon jadi bidang potong dengan normal ke dalam poligon; bagian di luar poligon dipecah per tepi.
  const holes = (a.buang || []).map(poly => {
    const L = poly.map(toL);
    const cx = L.reduce((s, p) => s + p[0], 0) / L.length, cz = L.reduce((s, p) => s + p[1], 0) / L.length;
    return L.map((p, i) => {
      const q = L[(i + 1) % L.length];
      let nx = -(q[1] - p[1]), nz = q[0] - p[0];
      if (nx * (cx - p[0]) + nz * (cz - p[1]) < 0) { nx = -nx; nz = -nz; }
      return { ax: p[0], az: p[1], nx, nz };
    });
  });
  const flip = c => ({ ax: c.ax, az: c.az, nx: -c.nx, nz: -c.nz });
  const outsideTris = (pos, uv) => {
    for (const E of holes) {
      const np = [], nu = [];
      E.forEach((c, i) => { const [p, u] = clipTriangles(pos, uv, [...E.slice(0, i), flip(c)]); np.push(...p); nu.push(...u); });
      pos = np; uv = nu;
    }
    return [pos, uv];
  };
  const outsideSeg = (p, q) => {
    let parts = [[p, q]];
    for (const E of holes) parts = parts.flatMap(([a0, b0]) => E.map((c, i) => clipSegment(a0, b0, [...E.slice(0, i), flip(c)])).filter(Boolean));
    return parts;
  };
  const o = a.tonjolan;
  const X0 = a.batas[0] - o, Z0 = a.batas[1] - o, X1 = a.batas[2] + o, Z1 = a.batas[3] + o;
  const y = a.tepiBawah + 0.05;
  const D = Z1 - Z0;
  const rise = (D / 2) * Math.tan((a.kemiringan * Math.PI) / 180);
  const zc = (Z0 + Z1) / 2;
  const r1 = [X0 + D / 2, y + rise, zc], r2 = [X1 - D / 2, y + rise, zc];
  const e = [[X0, y, Z0], [X1, y, Z0], [X1, y, Z1], [X0, y, Z1]];
  const slope = Math.hypot(D / 2, rise);
  const pos = [], uv = [];
  // UV: u mengikuti tepi bawah, v mengikuti kemiringan (supaya garis genteng sejajar tepi)
  const tri = (p, q, s, uvs) => { pos.push(...p, ...q, ...s); uv.push(...uvs); };
  const sc = 0.5;
  const vy = p => ((p[1] - y) / rise) * slope * sc;
  // a.gablet = { ujung: [0] | [1] | [0, 1], lebar }: ujung perisai diberi gevel segitiga tegak (atap "limasan bergevel").
  // Bubungan diperpanjang `lebar` ke arah ujung, bidang samping ikut naik sampai bubungan baru ("telinga"),
  // dan bidang ujung berhenti di titik jurai setinggi kaki gevel. Gevelnya sendiri dibuat di bawah (dinding berkisi).
  const gab = [];
  for (const u of a.gablet?.ujung || []) {
    const gw = Math.min(a.gablet.lebar ?? 1.2, D / 2 - 0.3);
    const sgn = u === 0 ? 1 : -1, rEnd = u === 0 ? r1 : r2, xEnd = u === 0 ? X0 : X1;
    const s = 1 - gw / (D / 2);                                 // posisi kaki gevel di sepanjang jurai (0 = tepi bawah, 1 = bubungan)
    const xg = xEnd + sgn * s * (D / 2), yb = y + s * rise;
    const top = [xg, y + rise, zc], jn = [xg, yb, Z0 + s * (D / 2)], js = [xg, yb, Z1 - s * (D / 2)];
    gab.push({ u, top, jn, js, rEnd, eN: u === 0 ? e[0] : e[1], eS: u === 0 ? e[3] : e[2] });
    // telinga: segitiga di bidang samping utara dan selatan, antara ujung bubungan lama, ujung bubungan baru, dan kaki gevel
    tri(rEnd, top, jn, [rEnd[0] * sc, vy(rEnd), top[0] * sc, vy(top), jn[0] * sc, vy(jn)]);
    tri(rEnd, top, js, [rEnd[0] * sc, vy(rEnd), top[0] * sc, vy(top), js[0] * sc, vy(js)]);
  }
  const gabAt = u => gab.find(q => q.u === u);
  // sisi utara dan selatan (trapesium)
  tri(e[0], e[1], r2, [e[0][0] * sc, 0, e[1][0] * sc, 0, r2[0] * sc, vy(r2)]);
  tri(e[0], r2, r1, [e[0][0] * sc, 0, r2[0] * sc, vy(r2), r1[0] * sc, vy(r1)]);
  tri(e[2], e[3], r1, [e[2][0] * sc, 0, e[3][0] * sc, 0, r1[0] * sc, vy(r1)]);
  tri(e[2], r1, r2, [e[2][0] * sc, 0, r1[0] * sc, vy(r1), r2[0] * sc, vy(r2)]);
  // sisi barat dan timur (segitiga)
  tri(e[3], e[0], r1, [e[3][2] * sc, 0, e[0][2] * sc, 0, r1[2] * sc, vy(r1)]);
  tri(e[1], e[2], r2, [e[1][2] * sc, 0, e[2][2] * sc, 0, r2[2] * sc, vy(r2)]);
  const [cp0, cu0] = cuts.length ? clipTriangles(pos, uv, cuts) : [pos, uv];
  const [cp, cu] = holes.length ? outsideTris(cp0, cu0) : [cp0, cu0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2));
  geo.computeVertexNormals();
  // a.warna: warna genteng khusus untuk atap ini (mis. atap lobi yang lebih gelap dari atap sayap)
  const roofMat = a.warna ? new THREE.MeshStandardMaterial({ color: '#ffffff', map: roofTexture(a.warna), roughness: 0.85, side: THREE.DoubleSide }) : mat.roof;
  const roof = new THREE.Mesh(geo, roofMat);
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof);

  // bubungan dan jurai (garis gelap di pertemuan bidang), ikut terpotong
  const R = [];
  const v = p => new V3(...p);
  const seg = (p, q, w, h) => {
    const c = clipSegment(p, q, cuts);
    if (!c) return;
    for (const [s0, s1] of outsideSeg(c[0], c[1])) if (Math.hypot(s1[0] - s0[0], s1[2] - s0[2], s1[1] - s0[1]) > 0.05) R.push(beam(v(s0), v(s1), w, h));
  };
  // bubungan sampai ujung gevel; jurai di ujung bergevel berhenti di kaki gevel
  seg(gabAt(0)?.top || r1, gabAt(1)?.top || r2, 0.25, 0.18);
  for (const [p, q, u, k] of [[e[0], r1, 0, 'jn'], [e[3], r1, 0, 'js'], [e[1], r2, 1, 'jn'], [e[2], r2, 1, 'js']]) seg(p, gabAt(u)?.[k] || q, 0.2, 0.14);
  // jurai lembah/jurai luar di garis potong (pertemuan dua atap): garis dari tepi bawah ke bubungan
  for (const c of a.potong || []) if (c.jurai) {
    const yr = y + rise;
    const L2 = q => toL(q);
    const [p0, p1] = [L2(c.a), L2(c.b)];
    // titik di garis potong pada tepi z0, garis bubungan (zc), tepi z1
    const onZ = zz => { const t = (zz - p0[1]) / (p1[1] - p0[1]); return [p0[0] + (p1[0] - p0[0]) * t, zz]; };
    const [qa, qm, qb] = [onZ(Z0), onZ(zc), onZ(Z1)];
    R.push(beam(v([qa[0], y, qa[1]]), v([qm[0], yr, qm[1]]), 0.2, 0.14), beam(v([qm[0], yr, qm[1]]), v([qb[0], y, qb[1]]), 0.2, 0.14));
  }
  if (R.length) g.add(merged(R, mat.ridge, { receive: false }));
  // lisplang di sekeliling tepi (ikut terpotong)
  const F = [];
  for (const [p, q] of [[e[0], e[1]], [e[1], e[2]], [e[2], e[3]], [e[3], e[0]]]) {
    const c = clipSegment(p, q, cuts);
    if (!c) continue;
    for (const [s0, s1] of outsideSeg(c[0], c[1])) if (Math.hypot(s1[0] - s0[0], s1[2] - s0[2]) > 0.05) F.push(wallBox(s0[0], s0[2], s1[0], s1[2], y - 0.28, y + 0.02, 0.06));
  }
  if (F.length) g.add(merged(F, mat.fascia, { cast: false }));

  // gevel: segitiga tegak berbingkai putih, bidang dalam gelap dengan kisi silang putih (foto Gedung F, 23 Nov 2026)
  if (gab.length) {
    const white = [], dark = [];
    for (const q of gab) {
      const out = q.u === 0 ? -1 : 1;                     // arah keluar (ke ujung atap) di sumbu x lokal
      const x = q.top[0], yb = q.jn[1], yt = q.top[1], half = (q.js[2] - q.jn[2]) / 2;
      const P = (h, v, dx = 0) => [x + out * dx, yb + v, zc + h];      // h: geser sepanjang z, v: tinggi dari kaki gevel
      const H = yt - yb;
      const triGeo = (pts, arr) => {
        const gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
        gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pts.length * 2).fill(0), 2));   // supaya bisa digabung dengan kotak
        gg.computeVertexNormals(); arr.push(gg);
      };
      triGeo([P(-half, 0, 0.02), P(half, 0, 0.02), P(0, H, 0.02)], white);
      // bidang dalam, menjorok 25 cm dari bingkai
      const ins = 0.25, k = half / H;                      // k: setengah lebar per satuan tinggi
      const vb = ins, vt = H - ins / Math.sin(Math.atan2(H, half)), hb = (H - vb) * k - ins;
      if (vt > vb + 0.2 && hb > 0.2) {
        triGeo([P(-hb, vb, 0.04), P(hb, vb, 0.04), P(0, vt, 0.04)], dark);
        // kisi silang 45 derajat, dipotong ke segitiga dalam
        const inTri = (h, v) => v >= vb - 1e-6 && v <= vt && Math.abs(h) <= hb * (vt - v) / (vt - vb) + 1e-6;
        for (const dir of [1, -1]) for (let c = -2 * hb; c <= 2 * hb; c += 0.45) {
          // garis h = dir * (v - vb) + c, ambil bagian di dalam segitiga dengan sampling sederhana
          let start = null, last = null;
          for (let v = vb; v <= vt + 1e-6; v += 0.02) {
            const h = dir * (v - vb) + c, ok = inTri(h, v);
            if (ok && !start) start = [h, v];
            if (ok) last = [h, v];
            if ((!ok || v + 0.02 > vt) && start) {
              if (Math.hypot(last[0] - start[0], last[1] - start[1]) > 0.1) white.push(beam(new V3(...P(start[0], start[1], 0.07)), new V3(...P(last[0], last[1], 0.07)), 0.05, 0.04));
              start = null;
            }
          }
        }
      }
    }
    const gm = merged(white, mat.fascia, { cast: false }), dm = merged(dark, new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
    if (gm) { gm.material = gm.material.clone(); gm.material.side = THREE.DoubleSide; g.add(gm); }
    if (dm) g.add(dm);
  }
  return g;
}

// Penghubung antar gedung (koordinat kawasan): pelat tiap lantai, kolom, tembok pembatas,
// atap tritisan di kedua sisi, dan atap datar bila ada.
// Penutup tegak di bawah ramp: prisma dari garis ramp sampai y0 (tanah/lantai), mengikuti kemiringan.
function slopedWallGeo(a, b, w, y0, y1 = y0) {
  const u = new V3(b.x - a.x, 0, b.z - a.z).normalize(), n = new V3(-u.z, 0, u.x).multiplyScalar(w / 2);
  const c = [a.clone().add(n), b.clone().add(n), b.clone().sub(n), a.clone().sub(n)];   // sudut atas
  const pos = [];
  const quad = (p, q, r, t) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z, p.x, p.y, p.z, r.x, r.y, r.z, t.x, t.y, t.z);
  // dasar boleh miring: y0 di sisi a, y1 di sisi b (bawah jembatan yang naik di ruas tangga); tutup bawah supaya tidak bolong dilihat dari bawah
  const lo = (p, i) => new V3(p.x, i === 0 || i === 3 ? y0 : y1, p.z), top = p => new V3(p.x, p.y - 0.16, p.z);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, p = c[i], q = c[j]; quad(lo(p, i), lo(q, j), top(q), top(p)); quad(top(p), top(q), lo(q, j), lo(p, i)); }
  quad(lo(c[0], 0), lo(c[1], 1), lo(c[2], 2), lo(c[3], 3)); quad(lo(c[3], 3), lo(c[2], 2), lo(c[1], 1), lo(c[0], 0));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push(pos[i * 3] + pos[i * 3 + 2], pos[i * 3 + 1]);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// Atap pelana sederhana: bubungan a-b di ketinggian `puncak`, tepi bawah di `tepiBawah`, lebar total `lebar`.
// bahan 'genteng' (seperti selasar) atau 'seng' (kanopi baja); rangka baja/kayu ditambah di bawahnya.
function buildGable(ap, P) {
  const a = new V3(ap.a[0], ap.puncak, ap.a[1]), b = new V3(ap.b[0], ap.puncak, ap.b[1]);
  const u = new V3().subVectors(b, a).setY(0).normalize(), n = new V3(-u.z, 0, u.x), hw = ap.lebar / 2;
  const drop = ap.puncak - ap.tepiBawah;
  const list = ap.bahan === 'seng' ? P.seng : P.genteng;
  const m0 = ap.mulai ?? 0;
  // ujung miring: miringA / miringB = geseran ujung sepanjang sumbu (meter) per meter ke arah +n (kiri sumbu a->b).
  // Dipakai kalau atap berhenti di tepi yang tidak tegak lurus sumbu, mis. tepi selasar gedung yang dipotong 45 derajat.
  const kA = ap.miringA ?? 0, kB = ap.miringB ?? 0;
  // naik: ujung b lebih tinggi dari ujung a (meter), untuk kanopi di atas jalan yang menanjak
  const nk = ap.naik ?? 0;
  const endA = (p, off) => p.addScaledVector(u, kA * off), endB = (p, off) => { p.addScaledVector(u, kB * off); p.y += nk; return p; };
  for (const sd of [1, -1]) {
    if (ap.sisiSaja && sd !== ap.sisiSaja) continue;
    const e0 = endA(a.clone().addScaledVector(n, sd * hw).setY(ap.tepiBawah), sd * hw), e1 = endB(b.clone().addScaledVector(n, sd * hw).setY(ap.tepiBawah), sd * hw);
    // tepi atas bidang: di garis bubungan, atau bergeser `mulai` (misalnya atap sayap yang menempel di sisi jembatan)
    const ta = endA(a.clone().addScaledVector(n, sd * m0), sd * m0), tb = endB(b.clone().addScaledVector(n, sd * m0), sd * m0);
    const pos = [ta, tb, e1, ta, e1, e0].flatMap(p => [p.x, p.y, p.z]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const slope = Math.hypot(hw - m0, drop);
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, slope, a.distanceTo(b), slope, a.distanceTo(b), 0, 0, slope, a.distanceTo(b), 0, 0, 0].map(v => v / 2), 2));
    g.computeVertexNormals();
    list.push(g.toNonIndexed ? g : g);
    if (ap.plafonMiring) {
      // papan plafon putih tepat di bawah bidang atap (dilihat dari bawah: putih di antara gording)
      const d = -0.07, q = [ta, tb, e1, e0].map(p => p.clone().setY(p.y + d));
      const gp = new THREE.BufferGeometry();
      gp.setAttribute('position', new THREE.Float32BufferAttribute([q[0], q[1], q[2], q[3]].flatMap(p => [p.x, p.y, p.z]), 3));
      gp.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));   // ikut digabung dengan balok yang punya uv
      gp.setIndex([0, 1, 2, 0, 2, 3]);
      gp.computeVertexNormals();
      P.plafon.push(gp);
    }
    if (ap.gording) {
      // gording kayu gelap memanjang (sejajar bubungan), beberapa baris per bidang atap
      for (let k = 0; k <= ap.gording; k++) {
        const f = k / ap.gording, p0 = new V3().lerpVectors(ta, e0, f), p1 = new V3().lerpVectors(tb, e1, f);
        P.kayu.push(beam(p0.setY(p0.y - 0.12), p1.setY(p1.y - 0.12), 0.08, 0.12));
      }
    } else {
      // usuk melintang di bawah bidang atap
      const nr = Math.max(2, Math.round(a.distanceTo(b) / (ap.bahan === 'seng' ? 2.2 : 0.6)));
      for (let k = 0; k <= nr; k++) {
        const t = k / nr, top = new V3().lerpVectors(ta, tb, t), bot = new V3().lerpVectors(e0, e1, t);
        (ap.bahan === 'seng' ? P.baja : P.kayu).push(beam(top.clone().setY(top.y - 0.06), bot.clone().setY(bot.y - 0.06), 0.06, 0.1));
      }
    }
  }
  if (ap.kudaKuda) {
    // kuda-kuda putih di tiap pasang kolom: balok tarik antar kolom, kaki kuda-kuda ke bubungan, tiang tengah, dua batang miring
    const len = a.distanceTo(b), hc = (ap.lebarKolom ?? ap.lebar - 1) / 2;
    const yAt = off => ap.puncak - drop * (Math.abs(off) / hw) - 0.16;     // tinggi bawah bidang atap pada jarak `off` dari bubungan
    const tMin = Math.abs(kA) * hw, tMax = len - Math.abs(kB) * hw;      // kuda-kuda tidak boleh keluar dari ujung miring
    for (let t = ap.kudaMulai ?? 0; t <= tMax + 1e-6; t += ap.kudaKuda) {
      if (t < tMin - 1e-6) continue;
      const c = a.clone().addScaledVector(u, t);
      const at = (off, y) => new V3(c.x + n.x * off, y, c.z + n.z * off);
      const yt = yAt(hc) - 0.12;
      P.plafon.push(beam(at(-hc, yt), at(hc, yt), 0.12, 0.16));
      for (const sd of [1, -1]) {
        P.plafon.push(beam(at(sd * hw, ap.tepiBawah - 0.16), at(0, ap.puncak - 0.16), 0.12, 0.16));
        P.plafon.push(beam(at(sd * hc * 0.5, yt), at(sd * hw * 0.42, yAt(hw * 0.42)), 0.09, 0.1));
      }
      P.plafon.push(beam(at(0, yt), at(0, ap.puncak - 0.16), 0.12, 0.12));
    }
  }
  if (!m0) (ap.bahan === 'seng' ? P.baja : P.plafon).push(beam(a.clone().setY(a.y - 0.08), b.clone().setY(b.y - 0.08 + nk), ap.bahan === 'seng' ? 0.1 : 0.5, 0.14));
}

export function buildPenghubung(spec, T) {
  T = { ...T, ...(spec.tampilan || {}) };                          // warna khusus penghubung (mis. atap genteng merah bata F-B)
  const mat = {
    slab: new THREE.MeshStandardMaterial({ color: T.selasar, map: tileTexture(), roughness: 0.35 }),
    wall: new THREE.MeshStandardMaterial({ color: T.dinding, roughness: 0.92 }),
    col: new THREE.MeshStandardMaterial({ color: T.kolom, roughness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ color: T.pagar, roughness: 0.35, metalness: 0.25 }),
    roof: new THREE.MeshStandardMaterial({ color: '#ffffff', map: roofTexture(T.atap), roughness: 0.85, side: THREE.DoubleSide }),
    roofFlat: new THREE.MeshStandardMaterial({ color: '#e4e4df', roughness: 0.9 }),
    tritBawah: new THREE.MeshStandardMaterial({ color: '#ece9e1', roughness: 0.9 }),
    kayu: new THREE.MeshStandardMaterial({ color: '#4b3b2d', roughness: 0.8 }),
    ramp: new THREE.MeshStandardMaterial({ color: '#d9cdb5', roughness: 0.9 }),                      // ramp berbutir krem
    alas: new THREE.MeshStandardMaterial({ map: lansekapTexture(spec.alasBahan || spec.alasKolom?.bahan || 'granit'), roughness: 0.6 }),
    baja: new THREE.MeshStandardMaterial({ color: spec.warnaBaja || '#8a3d2c', roughness: 0.5, metalness: 0.3 }),   // rangka kanopi (merah bata kalau tidak ditentukan)
    seng: new THREE.MeshStandardMaterial({ color: '#b9bec1', roughness: 0.45, metalness: 0.4, side: THREE.DoubleSide }),
    plafon: new THREE.MeshStandardMaterial({ color: '#f1f0eb', roughness: 0.9, side: THREE.DoubleSide }),
    bangku: new THREE.MeshStandardMaterial({ color: '#6f7478', roughness: 0.4, metalness: 0.5 }),
    logam: new THREE.MeshStandardMaterial({ color: spec.warnaRangka || '#4d5256', roughness: 0.5, metalness: 0.4 }),
    kaca: new THREE.MeshStandardMaterial({ color: '#6f9cc2', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
    collider: new THREE.MeshBasicMaterial({ visible: false }),
  };
  const root = new THREE.Group();
  root.name = 'penghubung-' + spec.id;
  const out = { root, spec, floors: [], solids: [], walkables: [], roof: null };
  const lantai = spec.lantai;
  for (let i = 0; i < lantai.length; i++) {
    const lf = lantai[i];
    const g = new THREE.Group();
    g.userData.no = lf.no;
    root.add(g);
    const P = { wall: [], col: [], rail: [], collider: [], tritTop: [], tritBawah: [], kayu: [], alas: [], baja: [], seng: [], genteng: [], plafon: [], bangku: [], logam: [], kaca: [] };
    const poly = lf.poligon || spec.poligon;                         // tiap lantai boleh punya bentuk sendiri
    const slab = new THREE.Mesh(slabGeo(poly, lf.elevasi, lf.tebal ?? (lf.no === 1 ? 0.3 : 0.15)), mat.slab);
    slab.castShadow = slab.receiveShadow = true;
    g.add(slab);
    out.walkables.push(slab);
    // ramp (landai): pelat miring dari a (tinggi `dari`) ke b (tinggi `ke`), lebar tegak lurus garis a-b
    for (const rp of (spec.landai || []).filter(r => (r.lantai ?? 1) === lf.no)) {
      const a = new V3(rp.a[0], rp.dari, rp.a[1]), b = new V3(rp.b[0], rp.ke, rp.b[1]);
      const tb = rp.tebal ?? 0.16;                                           // tebal pelat ramp (jembatan lantai atas: ±0,4)
      const m = new THREE.Mesh(beam(new V3(a.x, a.y - tb / 2, a.z), new V3(b.x, b.y - tb / 2, b.z), rp.lebar, tb), mat.ramp);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      out.walkables.push(m);
      // dinding bawah ramp sampai tanah (supaya tidak melayang); `dinding: false` untuk ramp jembatan di lantai atas
      if (rp.dinding !== false) P.alas.push(slopedWallGeo(a, b, rp.lebar, rp.dasar ?? lf.elevasi - 0.25, rp.dasarB ?? rp.dasar ?? lf.elevasi - 0.25));
    }
    for (const st of (spec.anakTangga || []).filter(st => st.lantai === lf.no)) {
      const m = new THREE.Mesh(slabGeo(st.poligon, st.elevasi, st.tebal ?? (st.elevasi - lf.elevasi + 0.05)), mat.slab);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      out.walkables.push(m);
    }
    for (const p of (spec.pagar || []).filter(p => (p.lantai || [2, 3]).includes(lf.no))) {
      // titik pagar boleh [x, z] (di lantai) atau [x, z, y] (tinggi mutlak, untuk pegangan tangga/ramp)
      const pt = q => new V3(q[0], q[2] ?? lf.elevasi, q[1]);
      const a = pt(p.a), b = pt(p.b), jn = p.jenis || 'tembok-polos';
      if (jn === 'tembok-miring') {
        // tembok pembatas yang ikut miring (sisi tangga), tepi bawah 0,3 m di bawah anak tangga + pipa pegangan
        const h = p.tinggi ?? 1.0;
        slopedWall(P.wall, a.x, a.z, b.x, b.z, a.y - 0.3, b.y - 0.3, a.y + h, b.y + h, 0.15);
        P.rail.push(beam(new V3(a.x, a.y + h + 0.04, a.z), new V3(b.x, b.y + h + 0.04, b.z), 0.05, 0.05));
      } else if (jn === 'kaca') {
        // dinding kaca berangka (lorong penghubung C-K, footage): kaca dari a.y + dasar sampai a.y + dasar + tinggi, atau sampai `atas`
        // (tinggi mutlak, atas rata) kalau ada. Rangka aluminium di tepi bawah, tepi atas, dan tegak tiap ±1,3 m. Menahan pejalan.
        const d0 = p.dasar ?? 0.95, len = Math.hypot(b.x - a.x, b.z - a.z);
        const yb0 = a.y + d0, yb1 = b.y + d0, yt0 = p.atas ?? a.y + d0 + (p.tinggi ?? 2.0), yt1 = p.atas ?? b.y + d0 + (p.tinggi ?? 2.0);
        slopedWall(P.kaca, a.x, a.z, b.x, b.z, yb0, yb1, yt0, yt1, 0.03);
        P.logam.push(beam(new V3(a.x, yb0, a.z), new V3(b.x, yb1, b.z), 0.08, 0.08), beam(new V3(a.x, yt0, a.z), new V3(b.x, yt1, b.z), 0.08, 0.08));
        const n = Math.max(1, Math.round(len / 1.3));
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
          P.logam.push(boxXZ(x - 0.04, z - 0.04, x + 0.04, z + 0.04, yb0 + (yb1 - yb0) * t, yt0 + (yt1 - yt0) * t));
        }
        slopedWall(P.collider, a.x, a.z, b.x, b.z, Math.min(yb0, yb1) - d0, Math.min(yb0, yb1) - d0, Math.max(yt0, yt1), Math.max(yt0, yt1), 0.12);
      } else if (jn.startsWith('tembok')) buildParapet(a, b, P, p.tinggi ?? 1.0, jn, p);
      else if (jn === 'pegangan-dinding') buildHandrail(a, b, P, p.tinggi ?? 0.9);
      else buildRail(a, b, P, p.tinggi ?? 0.95);
    }
    // kolom dari lantai ini sampai lantai berikutnya (atau setinggi tembok pembatas di lantai teratas)
    const y1 = lf.kolomPuncak ?? (i + 1 < lantai.length ? lantai[i + 1].elevasi : lf.elevasi + 1.0);
    const y0 = lf.kolomDasar ?? (lf.no === 1 ? -0.2 : lf.elevasi);
    const ks = (spec.ukuranKolom ?? 0.4) / 2;
    for (const [x, z, ya, yb] of lf.kolom || spec.kolom || []) {
      // titik kolom boleh [x, z, bawah, atas] (tinggi mutlak) untuk penghubung yang lantainya berundak
      P.col.push(boxXZ(x - ks, z - ks, x + ks, z + ks, ya ?? y0, yb ?? y1));
      // alas kolom dari batu alam hitam (penghubung A-B lt 1, footage)
      const ka = spec.alasKolom?.lebar ? spec.alasKolom.lebar / 2 : ks + 0.05;
      if (spec.alasKolom && lf.no === 1) P.alas.push(boxXZ(x - ka, z - ka, x + ka, z + ka, y0, lf.elevasi + spec.alasKolom.tinggi));
    }
    // tiang baja kanopi (ramping) di atas lantai ini
    for (const tg of (spec.tiang || []).filter(t => t.lantai === lf.no))
      for (const [x, z, ya, yb] of tg.titik) P.baja.push(boxXZ(x - 0.06, z - 0.06, x + 0.06, z + 0.06, ya ?? lf.elevasi, yb ?? lf.elevasi + tg.tinggi));
    // atap pelana: dua bidang miring dari garis bubungan a-b, lebar total `lebar`
    for (const ap of (spec.atapPelana || []).filter(t => t.lantai === lf.no)) buildGable(ap, P);
    // bangku besi berderet di sepanjang garis a-b, menghadap ke kiri garis (hadap 1) atau kanan (-1)
    for (const bk of (spec.bangku || []).filter(t => t.lantai === lf.no)) {
      const a = new V3(bk.a[0], lf.elevasi, bk.a[1]), b = new V3(bk.b[0], lf.elevasi, bk.b[1]);
      const len = a.distanceTo(b), n = Math.max(1, Math.floor(len / 1.9));
      const u = new V3().subVectors(b, a).normalize(), nn = new V3(-u.z, 0, u.x).multiplyScalar(bk.hadap ?? 1);
      for (let k = 0; k < n; k++) {
        const c = a.clone().addScaledVector(u, (k + 0.5) * len / n);
        const at = (du, dn, y) => c.clone().addScaledVector(u, du).addScaledVector(nn, dn).setY(lf.elevasi + y);
        P.bangku.push(beam(at(-0.8, 0, 0.44), at(0.8, 0, 0.44), 0.45, 0.04));
        P.bangku.push(beam(at(-0.8, -0.24, 0.72), at(0.8, -0.24, 0.72), 0.04, 0.42));
        for (const du of [-0.7, 0.7]) { const q = at(du, 0, 0); P.logam.push(boxXZ(q.x - 0.03, q.z - 0.03, q.x + 0.03, q.z + 0.03, lf.elevasi, lf.elevasi + 0.44)); }
      }
    }
    for (const tr of (spec.tritisan || []).filter(t => t.lantai === lf.no)) buildTritisan(tr, P);
    // papan: pelat tipis bertekstur (jenis tempelan, mis. 'papan-putih') di titik a-b, menghadap ke kiri garis (sisi 1) atau kanan (-1)
    for (const pp of (spec.papan || []).filter(t => t.lantai === lf.no)) {
      const a = new V3(pp.a[0], 0, pp.a[1]), b = new V3(pp.b[0], 0, pp.b[1]), len = a.distanceTo(b);
      const u = new V3().subVectors(b, a).normalize(), sd = pp.sisi ?? 1, nn = new V3(-u.z, 0, u.x).multiplyScalar(sd);
      const geo = new THREE.BoxGeometry(len, pp.tinggi, 0.03);
      geo.rotateY(Math.atan2(-u.z, u.x));
      const c = a.clone().lerp(b, 0.5).addScaledVector(nn, pp.jarak ?? 0.1);
      geo.translate(c.x, pp.y + pp.tinggi / 2, c.z);
      const o = { jenis: pp.jenis || 'papan-putih', teks: pp.teks, lebar: len, tinggi: pp.tinggi };
      const face = new THREE.MeshStandardMaterial({ map: tempelTexture(o), roughness: 0.6 }), plain = new THREE.MeshStandardMaterial({ color: '#e9e9e4', roughness: 0.7 });
      const m = new THREE.Mesh(geo, [plain, plain, plain, plain, sd > 0 ? face : plain, sd > 0 ? plain : face]);
      m.castShadow = true; g.add(m);
    }
    for (const [list, m, solid] of [[P.wall, mat.wall, true], [P.col, mat.col, true], [P.rail, mat.rail], [P.tritTop, mat.roof],
      [P.tritBawah, mat.tritBawah], [P.kayu, mat.kayu], [P.alas, mat.alas, true], [P.baja, mat.baja], [P.seng, mat.seng],
      [P.genteng, mat.roof], [P.plafon, mat.plafon], [P.bangku, mat.bangku], [P.logam, mat.logam], [P.kaca, mat.kaca]]) {
      const mesh = merged(list, m);
      if (mesh) { if (m === mat.kaca) { mesh.castShadow = false; mesh.renderOrder = 2; } g.add(mesh); if (solid) out.solids.push(mesh); }
    }
    const col = merged(P.collider, mat.collider, { cast: false, receive: false });
    if (col) { col.visible = false; col.userData.collider = true; g.add(col); out.solids.push(col); }
    out.floors.push({ no: lf.no, group: g });
  }
  out.roof = new THREE.Group();
  if (spec.atap) {
    const xs = spec.poligon.map(p => p[0]), zs = spec.poligon.map(p => p[1]);
    const y = spec.atap.tepiBawah ?? 12.15;
    const roof = new THREE.Mesh(boxXZ(Math.min(...xs), Math.min(...zs) - 0.3, Math.max(...xs), Math.max(...zs) + 0.3, y - 0.3, y), mat.roofFlat);
    roof.castShadow = roof.receiveShadow = true;
    out.roof.add(roof);
  }
  root.add(out.roof);
  root.updateMatrixWorld(true);
  return out;
}

// ---------- lansekap: undakan, selokan, tembok, plaza di luar gedung ----------
// Penampang (daftar jalur sejajar) ditarik sepanjang garis `jalur`. Setiap jalur punya lebar, tinggi permukaan (atas),
// bahan permukaan (bahan) dan bahan muka tegak (muka). Tangga memotong beberapa jalur dan naik dari satu jalur ke jalur lain.
const _lsTex = new Map();
function lansekapTexture(key) {
  if (_lsTex.has(key)) return _lsTex.get(key);
  const N = 512, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = [...key].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) % 233280;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  // gambar sesuatu juga di salinan bergeser supaya tekstur menyambung saat diulang
  const wrap = draw => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); draw(); g.restore(); } };
  const blotch = (cols, n, rMin, rMax, alpha) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * N, y = rnd() * N, r = rMin + rnd() * (rMax - rMin), col = cols[i % cols.length];
      wrap(() => { g.globalAlpha = alpha; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; });
    }
  };
  let size = 1;                                         // ukuran satu ulangan tekstur (meter)
  switch (key) {
    case 'batu-kali': {                                 // batu hitam bersudut, besar-kecil, nat putih tebal (seperti di footage)
      size = 1.4;
      g.fillStyle = '#e8e5dd'; g.fillRect(0, 0, N, N);
      const nx = 6, ny = 5, cw = N / nx, ch = N / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const cx = (i + 0.5 + (rnd() - 0.5) * 0.35) * cw, cy = (j + 0.5 + (rnd() - 0.5) * 0.35) * ch;
        const k = 5 + Math.floor(rnd() * 3), rot = rnd() * Math.PI;
        const pts = [];
        for (let q = 0; q < k; q++) {
          const ang = rot + (q / k) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
          const rr = (0.5 + rnd() * 0.2);              // jari-jari relatif terhadap sel: batu hampir bersentuhan
          pts.push([cx + Math.cos(ang) * cw * rr, cy + Math.sin(ang) * ch * rr]);
        }
        const shade = 24 + Math.floor(rnd() * 30);
        wrap(() => {
          g.fillStyle = `rgb(${shade},${shade},${shade + 4})`;
          g.beginPath(); pts.forEach(([x, y], n) => n ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
        });
      }
      blotch(['#6b6b6b', '#d9d6cc'], 50, 4, 14, 0.12);
      break;
    }
    case 'paving-abu': {                                // paving block abu-abu tua susun tulang ikan (kantin, footage)
      size = 1;
      g.fillStyle = '#3d3f40'; g.fillRect(0, 0, N, N);
      const u = N / 10, cols = ['#6a6c6b', '#626463', '#717372', '#5c5e5d', '#686a66'];
      for (let r = 0; r < 10; r++) for (let k = 0; k < 10; k++) {
        g.fillStyle = cols[Math.floor(rnd() * cols.length)];
        if ((r + k) % 2) g.fillRect(k * u + 2, r * u + 2, u - 4, u * 2 - 4); else g.fillRect(k * u + 2, r * u + 2, u * 2 - 4, u - 4);
      }
      blotch(['#2f3132', '#8a8c88', '#4f5a44'], 90, 8, 34, 0.16);
      break;
    }
    case 'paving-merah': {                              // paving bata merah 20 x 10 cm, susun bergeser
      size = 1;
      g.fillStyle = '#5e2f29'; g.fillRect(0, 0, N, N);
      const bw = N / 5, bh = N / 10, cols = ['#8e4a3f', '#84443a', '#975246', '#7b3f36', '#8a5045'];
      for (let r = 0; r < 10; r++) for (let k = -1; k < 6; k++) {
        const x = k * bw + (r % 2 ? bw / 2 : 0);
        g.fillStyle = cols[Math.floor(rnd() * cols.length)];
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      }
      blotch(['#4a2420', '#b98a78', '#6d5a52'], 80, 8, 30, 0.14);      // aus dan kusam
      break;
    }
    case 'grass-block': {                                // paving grass block beton berlubang, rumput di lubang (video penghubung kantin-K)
      size = 0.8; g.fillStyle = '#9a968c'; g.fillRect(0, 0, N, N);
      const u = N / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 3 ? '#3f4a2c' : '#2f3324';
        g.fillRect(i * u + u * 0.22, j * u + u * 0.22, u * 0.56, u * 0.56);
      }
      blotch(['#7d7a70', '#56603c'], 70, 4, 18, 0.2);
      break;
    }
    case 'keramik-putih': {                              // keramik putih 40 cm, nat abu (panggung kantin B, footage)
      size = 1.6; g.fillStyle = '#b9b7b1'; g.fillRect(0, 0, N, N);
      const u = N / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = ['#e9e7e2', '#e4e2dc', '#eeece7'][(i * 3 + j) % 3]; g.fillRect(i * u + 2, j * u + 2, u - 4, u - 4); }
      break;
    }
    case 'putih': size = 1; g.fillStyle = '#ecebe6'; g.fillRect(0, 0, N, N); blotch(['#d8d6cf'], 30, 6, 20, 0.2); break;
    case 'tanah': size = 1.5; g.fillStyle = '#6e5440'; g.fillRect(0, 0, N, N); blotch(['#5a4433', '#82664f', '#4f6a3a', '#5d7a42'], 160, 4, 26, 0.35); break;
    case 'batu-hitam': {                                  // batu kali bulat hitam (alas kolom koridor)
      size = 0.5; g.fillStyle = '#3a3b3d'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 160; i++) { const x = rnd() * N, y = rnd() * N, rx = 14 + rnd() * 18, ry = 10 + rnd() * 14, col = ['#1f2022', '#2b2c2f', '#46474a', '#18191b'][i % 4];
        wrap(() => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.35, ry * 0.3, 0, 0, Math.PI * 2); g.fill(); }); }
      break;
    }
    case 'bata-merah': size = 1.5; g.fillStyle = '#a9584b'; g.fillRect(0, 0, N, N); blotch(['#8e463b', '#bf6c5c'], 60, 10, 40, 0.18); break;
    case 'rumput': size = 2; g.fillStyle = '#6d8a4a'; g.fillRect(0, 0, N, N); blotch(['#5d7a3e', '#7f9a57', '#55703a', '#86a05e', '#7a6a4a'], 260, 3, 22, 0.3); break;
    case 'aspal': size = 2; g.fillStyle = '#56585a'; g.fillRect(0, 0, N, N); blotch(['#4a4c4e', '#626466', '#3f4143'], 220, 2, 10, 0.25); break;
    case 'beton': size = 2; g.fillStyle = '#bdb8ae'; g.fillRect(0, 0, N, N); blotch(['#a7a297', '#cbc7be', '#9d988c'], 90, 8, 60, 0.16); break;
    case 'granit': {
      size = 0.6; g.fillStyle = '#2d2e31'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 1400; i++) { g.fillStyle = rnd() < 0.5 ? '#8b8d91' : '#18191b'; g.fillRect(rnd() * N, rnd() * N, 2 + rnd() * 3, 2 + rnd() * 3); }
      break;
    }
    case 'selokan': size = 1.5; g.fillStyle = '#6f6a60'; g.fillRect(0, 0, N, N); blotch(['#55604a', '#4c4840', '#7d786c'], 70, 10, 50, 0.3); break;
    default: g.fillStyle = '#cfcac0'; g.fillRect(0, 0, N, N);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / size, 1 / size);
  t.anisotropy = 4;
  _lsTex.set(key, t);
  return t;
}

// Satu muka segi empat dengan UV dalam meter (tekstur menyambung antar blok). pts berurutan, hint = arah hadap yang diinginkan.
function quadFace(pts, hint) {
  const [a, b, c] = pts;
  const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)).normalize();
  if (n.dot(hint) < 0) { pts = [...pts].reverse(); n.negate(); }
  const pos = [], uv = [], nor = [];
  const tx = -n.z, tz = n.x, tl = Math.hypot(tx, tz) || 1;
  for (const p of pts) {
    pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z);
    if (Math.abs(n.y) > 0.7) uv.push(p.x, -p.z);
    else uv.push((p.x * tx + p.z * tz) / tl, p.y);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

export function buildLansekap(spec) {
  const root = new THREE.Group();
  root.name = 'lansekap-' + spec.id;
  const out = { root, spec, solids: [], walkables: [], footprint: null, strips: [] };
  const jalur = spec.jalur || { a: [0, 0], b: [1, 0] };               // lansekap boleh hanya berisi `bidang`
  const [ax, az] = jalur.a, [bx, bz] = jalur.b;
  const L = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / L, uz = (bz - az) / L;
  const s = spec.sisi ?? 1, ox = -uz * s, oz = ux * s;          // arah keluar (menjauhi gedung)
  const W = (t, v, y) => new V3(ax + ux * t + ox * v, y, az + uz * t + oz * v);
  const base = spec.dasar ?? -0.8;
  const F = {};                                                  // muka per bahan
  const put = (key, geo) => (F[key] ||= []).push(geo);
  const U = new V3(ux, 0, uz), O = new V3(ox, 0, oz), UP = new V3(0, 1, 0);

  // blok prisma t0..t1 x v0..v1 dari dasar sampai `atas`
  const prism = (t0, t1, v0, v1, top, kTop, kFront, kBack, kEnd) => {
    if (t1 - t0 < 1e-3 || v1 - v0 < 1e-3) return;
    put(kTop, quadFace([W(t0, v0, top), W(t1, v0, top), W(t1, v1, top), W(t0, v1, top)], UP));
    put(kFront, quadFace([W(t0, v0, base), W(t1, v0, base), W(t1, v0, top), W(t0, v0, top)], O.clone().negate()));
    put(kBack, quadFace([W(t0, v1, base), W(t1, v1, base), W(t1, v1, top), W(t0, v1, top)], O));
    put(kEnd, quadFace([W(t0, v0, base), W(t0, v1, base), W(t0, v1, top), W(t0, v0, top)], U.clone().negate()));
    put(kEnd, quadFace([W(t1, v0, base), W(t1, v1, base), W(t1, v1, top), W(t1, v0, top)], U));
  };

  // posisi tiap jalur dalam arah keluar
  let v = 0;
  const strips = (spec.penampang || []).map(p => { const st = { ...p, v0: v, v1: v + p.lebar }; v += p.lebar; return st; });
  out.strips = strips;
  const tangga = spec.tangga || [];
  const cuts = i => tangga.filter(tg => i > tg.dari && i < tg.ke).map(tg => [tg.t - tg.lebar / 2, tg.t + tg.lebar / 2]).sort((p, q) => p[0] - q[0]);
  strips.forEach((st, i) => {
    let cur = 0;
    const kf = st.muka || st.bahan, ke = st.ujung || kf;
    for (const [c0, c1] of [...cuts(i), [L, L]]) {
      prism(cur, Math.min(c0, L), st.v0, st.v1, st.atas, st.bahan, kf, i === strips.length - 1 ? (st.belakang || ke) : kf, ke);   // belakang: muka tepi terluar jalur terakhir
      cur = Math.max(cur, c1);
    }
  });

  // bidang: permukaan datar berbentuk poligon bebas (koordinat kawasan), sisi tegak sampai dasar.
  // Dipakai untuk lahan paving dan bedeng tanaman yang tidak sejajar jalur (mis. di samping koridor miring).
  const bidang = spec.bidang || [];
  for (const bd of bidang) {
    const pts = bd.poligon, kTop = bd.bahan, kSide = bd.muka || 'beton', bot = bd.dasar ?? base;
    // `miring: [a, b, c]` = permukaan bidang miring y = a*x + b*z + c (tanah miring); tanpa itu datar di `atas`
    const yAt = bd.miring ? (x, z) => bd.miring[0] * x + bd.miring[1] * z + bd.miring[2] : () => bd.atas;
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
    const pos = [], uv = [];
    for (const t3 of tri) {
      let [i0, i1, i2] = t3;
      const [p0, p1, p2] = [pts[i0], pts[i1], pts[i2]];
      // urutan titik dibuat menghadap ke atas
      if ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) > 0) [i1, i2] = [i2, i1];
      for (const k of [i0, i1, i2]) { pos.push(pts[k][0], yAt(pts[k][0], pts[k][1]), pts[k][1]); uv.push(pts[k][0], -pts[k][1]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex([...Array(pos.length / 3).keys()]);       // berindeks seperti quadFace supaya bisa digabung
    g.computeVertexNormals();
    put(kTop, g);
    // sisi: arah keluar dari urutan titik (luas bertanda), bukan dari titik tengah, supaya benar juga untuk poligon cekung
    let ar2 = 0;
    pts.forEach((p, k) => { const q = pts[(k + 1) % pts.length]; ar2 += p[0] * q[1] - q[0] * p[1]; });
    const sg = ar2 > 0 ? 1 : -1;
    pts.forEach((p, k) => {
      const q = pts[(k + 1) % pts.length];
      const hint = new V3(sg * (q[1] - p[1]), 0, -sg * (q[0] - p[0]));
      put(kSide, quadFace([new V3(p[0], bot, p[1]), new V3(q[0], bot, q[1]), new V3(q[0], yAt(q[0], q[1]), q[1]), new V3(p[0], yAt(p[0], p[1]), p[1])], hint));
    });
  }

  // tangga: anak tangga beton dari permukaan jalur `dari` ke jalur `ke`
  const P = { rail: [] };
  for (const tg of tangga) {
    const lo = strips[tg.dari], hi = strips[tg.ke];
    const rise = hi.atas - lo.atas, run = hi.v0 - lo.v1;
    const n = Math.max(2, Math.round(rise / (tg.tinggiAnak ?? 0.17)));
    const r = rise / n, d = run / (n - 1);
    const t0 = tg.t - tg.lebar / 2, t1 = tg.t + tg.lebar / 2;
    for (let j = 0; j < n - 1; j++) prism(t0, t1, lo.v1 + j * d, lo.v1 + (j + 1) * d, lo.atas + (j + 1) * r, tg.bahan || 'beton', tg.bahan || 'beton', 'beton', 'beton');
    if (tg.pegangan) for (const tt of [t0 + 0.08, t1 - 0.08]) {
      // pipa pegangan miring mengikuti tangga, tiang di kedua ujung
      const p0 = W(tt, lo.v1 + 0.15, lo.atas + r + 0.9), p1 = W(tt, hi.v0 + 0.2, hi.atas + 0.9);
      P.rail.push(beam(p0, p1, 0.045, 0.045));
      for (const [vv, yy] of [[lo.v1 + 0.15, lo.atas + r], [hi.v0 + 0.2, hi.atas]]) { const q = W(tt, vv, yy); P.rail.push(boxXZ(q.x - 0.022, q.z - 0.022, q.x + 0.022, q.z + 0.022, yy, yy + 0.92)); }
    }
  }

  const solidsMesh = [];
  for (const [key, list] of Object.entries(F)) {
    const m = merged(list, new THREE.MeshStandardMaterial({ map: lansekapTexture(key), roughness: key === 'granit' ? 0.35 : 0.9 }));
    if (m) { root.add(m); solidsMesh.push(m); }
  }
  const rail = merged(P.rail, new THREE.MeshStandardMaterial({ color: '#c6cacd', roughness: 0.35, metalness: 0.4 }));
  if (rail) root.add(rail);
  out.solids.push(...solidsMesh);
  out.walkables.push(...solidsMesh);

  // perabot: pot tanaman di undakan, bangku dan ayunan di plaza
  const pots = { pot: [], tanaman: [], tanamanKuning: [], potGelap: [], logam: [], kayu: [], putih: [] };
  for (const pr of spec.pot || []) {
    const st = strips[pr.jalur];
    let k = 0;
    for (let t = pr.mulai ?? 1; t < L - 0.5; t += pr.jarak, k++) {
      if (tangga.some(tg => Math.abs(t - tg.t) < tg.lebar / 2 + 0.4)) continue;
      const c = W(t, (st.v0 + st.v1) / 2, st.atas);
      const pot = new THREE.CylinderGeometry(0.17, 0.12, 0.26, 12);
      pot.translate(c.x, c.y + 0.13, c.z);
      (k % 3 === 1 ? pots.potGelap : pots.pot).push(pot);
      const daun = new THREE.IcosahedronGeometry(0.2, 1);
      daun.scale(1, 0.85 + (k % 3) * 0.15, 1);
      daun.translate(c.x, c.y + 0.42, c.z);
      (k % 4 === 2 ? pots.tanamanKuning : pots.tanaman).push(daun);
    }
  }
  for (const b of spec.perabot || []) {
    const st = strips[b.jalur ?? strips.length - 1];
    const c = W(b.t, st.v0 + b.v, st.atas);
    const ang = Math.atan2(-uz, ux) + THREE.MathUtils.degToRad(b.arah || 0);
    const place = (geo, dx, dy, dz) => { geo.translate(dx, dy, dz); geo.rotateY(ang); geo.translate(c.x, c.y, c.z); return geo; };
    if (b.jenis === 'bangku') {
      const len = b.panjang ?? 1.8;
      pots.kayu.push(place(new THREE.BoxGeometry(len, 0.05, 0.42), 0, 0.45, 0));
      pots.kayu.push(place(new THREE.BoxGeometry(len, 0.3, 0.04), 0, 0.72, -0.22));
      for (const sx of [-len / 2 + 0.1, len / 2 - 0.1]) pots.logam.push(place(new THREE.BoxGeometry(0.05, 0.45, 0.42), sx, 0.22, 0));
    } else if (b.jenis === 'ayunan') {
      const w = b.panjang ?? 2.4, h = 2.2;
      for (const sx of [-w / 2, w / 2]) for (const sz of [-0.7, 0.7]) {
        const leg = beam(new V3(sx, 0, sz), new V3(sx, h, 0), 0.07, 0.07);
        pots.putih.push(place(leg, 0, 0, 0));
      }
      pots.putih.push(place(beam(new V3(-w / 2, h, 0), new V3(w / 2, h, 0), 0.08, 0.08), 0, 0, 0));
      for (const sx of [-w / 4, w / 4]) {
        for (const dx of [-0.2, 0.2]) pots.logam.push(place(new THREE.BoxGeometry(0.015, h - 0.5, 0.015), sx + dx, (h + 0.5) / 2, 0));
        pots.kayu.push(place(new THREE.BoxGeometry(0.5, 0.04, 0.22), sx, 0.5, 0));
      }
    }
  }
  // benda: perabot dan bangunan kecil di koordinat kawasan (tidak terikat jalur), mis. di lahan terbuka depan Gedung A.
  // { jenis, x, z, y (tinggi alas), arah (derajat, sumbu panjang dari +x ke +z) , ... }
  Object.assign(pots, { pink: [], pinkTua: [], abu: [], atapDatar: [], kawat: [], alasPendopo: [], kayuMuda: [], merahBesi: [], merahMeja: [], krem: [], seng: [], atapMerah: [],
    kaca: [], kuning: [], oranye: [], payung: [], posterMerah: [], posterKuning: [], posterBiru: [], galon: [], plastik: [] });
  const keras = [], pijak = [];                                    // penghalang jalan kaki, dan permukaan yang bisa dipijak
  for (const b of spec.benda || []) {
    const ang = -THREE.MathUtils.degToRad(b.arah || 0), y0 = b.y ?? 1.05;
    const put2 = (arr, geo, dx, dy, dz, solid = false) => {
      geo.translate(dx, dy, dz); geo.rotateY(ang); geo.translate(b.x, y0, b.z); arr.push(geo);
      if (solid) keras.push(geo.clone());
      return geo;
    };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    if (b.jenis === 'paviliun') {
      // paviliun beratap datar (seperti di footage): 4 kolom, atap pelat gelap dengan dua garis sambungan terang, meja bar dan kursi
      const L = b.panjang ?? 9, Wd = b.lebar ?? 6.5, Hc = b.tinggi ?? 3.0, ins = b.jarakKolom ?? 1.2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put2(pots.abu, box(0.4, Hc, 0.4), sx * (L / 2 - ins), Hc / 2, sz * (Wd / 2 - ins), true);
      const roof = put2(pots.atapDatar, box(L, 0.22, Wd), 0, Hc + 0.11, 0);
      pijak.push(roof.clone());
      for (const sx of [-L / 6, L / 6]) put2(pots.putih, box(0.06, 0.03, Wd + 0.02), sx, Hc + 0.235, 0);
      put2(pots.putih, box(L + 0.04, 0.12, 0.05), 0, Hc + 0.06, Wd / 2);        // lisplang depan
      put2(pots.putih, box(L + 0.04, 0.12, 0.05), 0, Hc + 0.06, -Wd / 2);
      for (const sx of [-1.6, 1.6]) {
        put2(pots.kayu, box(1.6, 0.05, 0.6), sx, 1.05, 0, false);               // meja bar
        put2(pots.logam, box(0.08, 1.05, 0.08), sx, 0.52, 0, false);
        for (const k of [-0.55, 0, 0.55]) for (const sz of [-0.6, 0.6]) {
          put2(pots.kayu, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 10), sx + k, 0.75, sz);
          put2(pots.logam, box(0.04, 0.75, 0.04), sx + k, 0.37, sz);
        }
      }
    } else if (b.jenis === 'pendopo') {
      // pendopo taman depan Gedung B (foto 2026): alas beton merah muda keabuan, tiang kayu, atap datar tipis gelap,
      // plafon bilah kayu, kisi kayu mendatar di satu sisi pendek, bangku beton berdudukan kayu bentuk L.
      const L = b.panjang ?? 6.0, Wd = b.lebar ?? 5.0, ha = b.alas ?? 0.3, Hc = b.tinggi ?? 2.7;
      const alas = put2(pots.alasPendopo, box(L, ha, Wd), 0, ha / 2, 0, false);
      pijak.push(alas.clone());
      const xs = [-L / 2 + 0.25, 0, L / 2 - 0.25], zs = [-Wd / 2 + 0.25, Wd / 2 - 0.25];
      for (const x of xs) for (const z of zs) put2(pots.kayuMuda, box(0.14, Hc, 0.14), x, ha + Hc / 2, z, true);
      put2(pots.atapDatar, box(L + 0.6, 0.14, Wd + 0.6), 0, ha + Hc + 0.07, 0);
      for (const z of [-(Wd + 0.6) / 2, (Wd + 0.6) / 2]) put2(pots.atapDatar, box(L + 0.64, 0.24, 0.04), 0, ha + Hc + 0.02, z);
      for (const x of [-(L + 0.6) / 2, (L + 0.6) / 2]) put2(pots.atapDatar, box(0.04, 0.24, Wd + 0.64), x, ha + Hc + 0.02, 0);
      for (const z of zs) put2(pots.kayuMuda, box(L, 0.18, 0.12), 0, ha + Hc - 0.09, z);          // balok kayu memanjang
      for (let x = -L / 2 + 0.15; x <= L / 2 - 0.1; x += 0.28) put2(pots.kayuMuda, box(0.05, 0.06, Wd - 0.3), x, ha + Hc - 0.03, 0);  // plafon bilah
      const ks = b.sisiKisi ?? 1;                                                                  // kisi mendatar di ujung +x (1) atau -x (-1)
      for (let y = 0.5; y <= Hc - 0.3; y += 0.22) put2(pots.kayuMuda, box(0.04, 0.08, Wd - 0.5), ks * (L / 2 - 0.25), ha + y, 0);
      // bangku L: sepanjang sisi belakang (-z) dan sisi kisi
      const bs = (w, d, x, z) => { put2(pots.alasPendopo, box(w, 0.42, d), x, ha + 0.21, z, true); put2(pots.kayuMuda, box(w, 0.04, d), x, ha + 0.44, z);
        };
      bs(L - 1.2, 0.5, -ks * 0.35, -Wd / 2 + 0.6);
      put2(pots.alasPendopo, box(L - 1.2, 0.45, 0.12), -ks * 0.35, ha + 0.64, -Wd / 2 + 0.4, true);
      bs(0.5, Wd - 1.6, ks * (L / 2 - 0.75), 0.25);
      put2(pots.alasPendopo, box(0.12, 0.45, Wd - 1.6), ks * (L / 2 - 0.55), ha + 0.64, 0.25, true);
    } else if (b.jenis === 'los-kantin') {
      // los kantin (footage): rangka besi merah, atap seng datar sedikit miring, deretan meja dan bangku merah berdudukan keramik krem.
      // panjang sepanjang sumbu x lokal; `baris` = jumlah baris meja melintang; meja disusun tiap ±1,9 m sepanjang los.
      const L = b.panjang ?? 12, Wd = b.lebar ?? 5, Hc = b.tinggi ?? 2.8, jk = b.jarakKolom ?? 3.0, miring = b.miring ?? 0.25;
      const nx = Math.max(1, Math.round(L / jk));
      for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) {
        const x = -L / 2 + i * L / nx, hz = Hc + (sz > 0 ? 0 : miring);
        put2(pots.merahBesi, box(0.1, hz, 0.1), x, hz / 2, sz * (Wd / 2 - 0.1), true);
      }
      for (const sz of [-1, 1]) put2(pots.merahBesi, box(L, 0.12, 0.08), 0, Hc + (sz > 0 ? 0 : miring) - 0.06, sz * (Wd / 2 - 0.1));
      const roof = box(L + 0.4, 0.04, Wd + 0.5);
      roof.rotateX(Math.atan2(miring, Wd));
      put2(pots.seng, roof, 0, Hc + miring / 2 + 0.03, 0);
      for (let i = 0; i <= nx; i++) put2(pots.merahBesi, box(0.06, 0.08, Wd), -L / 2 + i * L / nx, Hc + miring / 2 - 0.03, 0);
      const rows = b.baris ?? 2, nt = Math.max(1, Math.floor((L - 0.6) / 1.9));
      for (let r = 0; r < rows; r++) {
        const z = -Wd / 2 + (r + 0.5) * Wd / rows;
        for (let j = 0; j < nt; j++) {
          const x = -L / 2 + 0.3 + (j + 0.5) * (L - 0.6) / nt;
          put2(pots.merahMeja, box(0.7, 0.72, 1.5), x, 0.36, z, true);                  // meja merah, bujur melintang
          put2(pots.krem, box(0.74, 0.03, 1.54), x, 0.735, z);
          for (const dx of [-0.65, 0.65]) { put2(pots.merahMeja, box(0.3, 0.42, 1.5), x + dx, 0.21, z); put2(pots.krem, box(0.32, 0.03, 1.52), x + dx, 0.435, z); }
        }
      }
    } else if (b.jenis === 'meja-kantin') {
      // meja kantin (foto 2026): badan meja dan bangku masif merah bata, permukaan keramik krem. Sumbu panjang = sumbu x lokal.
      // panjang 3,0 (meja panjang, 8 orang) atau 1,5 (meja setengah, 4 orang); bangku di kedua sisi panjang.
      const L = b.panjang ?? 3.0, bz = b.jarakBangku ?? 0.58;
      put2(pots.merahMeja, box(L - 0.1, 0.7, 0.5), 0, 0.35, 0, true);
      put2(pots.krem, box(L, 0.04, 0.74), 0, 0.72, 0);
      for (const sg of (b.bangku ?? [-1, 1])) {
        put2(pots.merahMeja, box(L - 0.1, 0.41, 0.24), 0, 0.205, sg * bz, true);
        put2(pots.krem, box(L, 0.03, 0.28), 0, 0.425, sg * bz);
      }
    } else if (b.jenis === 'atap-miring') {
      // atap seng miring di atas rangka besi merah (kantin, foto 2026). Semua koordinat kawasan mutlak:
      // atap: 4 titik [x, y, z] (bidang atas), tiang: [x, z, yBawah, yAtas], balok: [x1, y1, z1, x2, y2, z2], panel: 4 titik (seng terang).
      const slab = (q, t) => {
        let ar = 0; q.forEach((v, k) => { const w = q[(k + 1) % 4]; ar += v[0] * w[2] - w[0] * v[2]; });
        if (ar < 0) q = [...q].reverse();       // urutan titik dibuat berlawanan jarum jam (dilihat dari atas) supaya muka atas menghadap ke atas
        const T = q.map(([x, y, z]) => [x, y, z]), B = q.map(([x, y, z]) => [x, y - t, z]);
        const pos = [], uv = [];
        const tri = (a, c, d) => { for (const v of [a, c, d]) { pos.push(...v); uv.push(v[0], v[2]); } };
        tri(T[0], T[2], T[1]); tri(T[0], T[3], T[2]); tri(B[0], B[1], B[2]); tri(B[0], B[2], B[3]);
        for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; tri(T[k], T[k2], B[k2]); tri(T[k], B[k2], B[k]); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return g;
      };
      if (b.atap) pots.atapMerah.push(slab(b.atap, b.tebal ?? 0.05));
      // sisi bawah seng berlapis galvalum abu terang (foto kantin dari bawah)
      if (b.atap && b.bawah !== false) pots.seng.push(slab(b.atap.map(([x, y, z]) => [x, y - (b.tebal ?? 0.05) - 0.006, z]), 0.004));
      if (b.atap && b.rusuk) {
        // rusuk seng gelombang: batang tipis searah kemiringan (dari tepi tinggi atap[0]-atap[3] ke tepi rendah atap[1]-atap[2])
        const [A0, A1, A2, A3] = b.atap.map(v => new V3(...v)), n = Math.max(2, Math.round(A0.distanceTo(A3) / b.rusuk));
        for (let k = 0; k <= n; k++) {
          const t = k / n, hi = A0.clone().lerp(A3, t), lo = A1.clone().lerp(A2, t);
          pots.atapMerah.push(beam(hi.setY(hi.y + 0.012), lo.setY(lo.y + 0.012), 0.045, 0.028));
        }
      }
      for (const q of b.panel || []) pots.krem.push(slab(q.map(([x, y, z]) => [x, y + 0.012, z]), 0.01));
      for (const [x, z, y0t, y1t] of b.tiang || []) {
        const g = new THREE.CylinderGeometry(0.05, 0.05, y1t - y0t, 10);
        g.translate(x, (y0t + y1t) / 2, z);
        pots.merahBesi.push(g); keras.push(g.clone());
      }
      for (const [x1, y1, z1, x2, y2, z2] of b.balok || []) pots.merahBesi.push(beam(new V3(x1, y1, z1), new V3(x2, y2, z2), 0.08, 0.12));
    } else if (b.jenis === 'deret-kios') {
      // deretan kios kantin B (foto dan video kantin 2026): badan tembok putih, pintu gulung abu bergaris, papan nama merah menerus
      // di atas pintu, atap datar. Sumbu x lokal = arah deret, muka kios menghadap +z lokal. kaca: petak berjendela kaca penuh poster.
      const L = b.panjang ?? 9.6, D = b.dalam ?? 2.5, Hk = b.tinggi ?? 2.85, n = b.n ?? 4, zf = D / 2, w = L / n, hp = 2.3;
      put2(pots.putih, box(L, Hk, D - 0.12), 0, Hk / 2, -0.06, true);
      put2(pots.posterMerah, box(L + 0.06, Hk - hp - 0.05, 0.1), 0, (Hk + hp) / 2 + 0.02, zf - 0.03);
      put2(pots.atapDatar, box(L + 0.3, 0.08, D + 0.35), 0, Hk + 0.04, 0.1);
      for (let k = 0; k <= n; k++) put2(pots.putih, box(0.22, hp, 0.1), -L / 2 + k * w, hp / 2, zf - 0.05);
      for (let k = 0; k < n; k++) {
        const cx = -L / 2 + (k + 0.5) * w, ww = w - 0.24;
        if (b.kaca) {
          put2(pots.kaca, box(ww, hp - 0.35, 0.03), cx, 0.35 + (hp - 0.35) / 2, zf - 0.08);
          put2(pots.putih, box(ww, 0.35, 0.05), cx, 0.175, zf - 0.07);
          const cols = [pots.posterMerah, pots.posterKuning, pots.posterBiru, pots.krem];
          for (let q = 0; q < 6; q++) put2(cols[(q + k) % 4], box(0.42, 0.58, 0.01), cx - ww / 2 + 0.3 + (q % 3) * (ww - 0.6) / 2, q < 3 ? 1.75 : 1.05, zf - 0.06);
        } else {
          put2(pots.seng, box(ww, hp - 0.05, 0.03), cx, (hp - 0.05) / 2, zf - 0.08);
          for (let y = 0.15; y < hp - 0.1; y += 0.14) put2(pots.abu, box(ww, 0.015, 0.012), cx, y, zf - 0.06);
          put2(pots.abu, box(ww + 0.02, 0.12, 0.08), cx, hp - 0.04, zf - 0.07);                   // kotak gulungan
        }
      }
    } else if (b.jenis === 'kulkas') {
      // kulkas minuman berpintu kaca (video kantin): badan merah, pintu kaca terang di muka (+z lokal), papan putih di atas
      put2(pots.merahBesi, box(0.68, 1.9, 0.64), 0, 0.95, 0, true);
      put2(pots.plastik, box(0.54, 1.4, 0.02), 0, 0.92, 0.33);
      for (const y of [0.45, 0.8, 1.15, 1.5]) put2(pots.posterKuning, box(0.5, 0.06, 0.02), 0, y, 0.335);
      put2(pots.putih, box(0.68, 0.2, 0.03), 0, 1.76, 0.335);
    } else if (b.jenis === 'wastafel') {
      // wastafel ganda (foto kantin B): papan merah bata setinggi bahu menempel tembok, dua bak putih, kran logam
      const L = b.panjang ?? 1.3;
      put2(pots.merahMeja, box(L, 1.35, 0.12), 0, 0.675, -0.22, true);
      for (const sx of [-L / 4, L / 4]) {
        put2(pots.putih, box(0.48, 0.15, 0.4), sx, 0.8, 0.0);
        put2(pots.logam, box(0.05, 0.72, 0.05), sx, 0.36, -0.08);
        put2(pots.logam, box(0.03, 0.03, 0.22), sx, 1.02, -0.06);
      }
    } else if (b.jenis === 'kandang') {
      // kandang kawat berangka (foto kantin): galon (rangka hitam, atap seng datar) atau botol plastik (atap limas oranye)
      const w = b.lebar ?? 1.4, d = b.dalam ?? 1.0, h = b.tinggi ?? 1.8, rk = pots[b.rangka || 'kawat'];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put2(rk, box(0.05, h, 0.05), sx * (w / 2 - 0.025), h / 2, sz * (d / 2 - 0.025));
      for (const y of [0.05, h / 2, h - 0.03]) {
        for (const sz of [-1, 1]) put2(rk, box(w, 0.04, 0.04), 0, y, sz * (d / 2 - 0.025));
        for (const sx of [-1, 1]) put2(rk, box(0.04, 0.04, d), sx * (w / 2 - 0.025), y, 0);
      }
      for (let x = -w / 2 + 0.12; x < w / 2 - 0.05; x += 0.12) for (const sz of [-1, 1]) put2(rk, box(0.012, h, 0.012), x, h / 2, sz * (d / 2 - 0.02));
      for (let z = -d / 2 + 0.12; z < d / 2 - 0.05; z += 0.12) for (const sx of [-1, 1]) put2(rk, box(0.012, h, 0.012), sx * (w / 2 - 0.02), h / 2, z);
      if (b.isi === 'galon') {
        for (let i = 0; i < Math.floor(w / 0.32); i++) for (const lv of [0, 1]) {
          const g = new THREE.CylinderGeometry(0.13, 0.13, 0.48, 10); put2(pots.galon, g, -w / 2 + 0.2 + i * 0.32, 0.3 + lv * 0.52, 0);
        }
      } else if (b.isi === 'botol') put2(pots.plastik, box(w - 0.12, h * 0.55, d - 0.12), 0, h * 0.3, 0);
      if (b.atap === 'limas') {
        const cone = new THREE.ConeGeometry(Math.max(w, d) * 0.8, 0.45, 4, 1); cone.rotateY(Math.PI / 4); cone.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
        put2(pots.oranye, cone, 0, h + 0.22, 0);
      } else put2(pots.seng, box(w + 0.25, 0.05, d + 0.25), 0, h + 0.03, 0);
      keras.push(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(ang).translate(b.x, y0, b.z));
    } else if (b.jenis === 'hidran') {
      // lemari hidran merah dengan tulisan putih (video kantin)
      put2(pots.merahBesi, box(0.75, 1.2, 0.35), 0, 0.6, 0, true);
      put2(pots.putih, box(0.5, 0.1, 0.01), 0, 0.92, 0.18);
      put2(pots.abu, box(0.6, 0.02, 0.01), 0, 0.6, 0.18);
    } else if (b.jenis === 'tong-sampah') {
      // tong sampah plastik abu bertutup kuning (video kantin)
      put2(pots.abu, box(0.55, 0.85, 0.6), 0, 0.425, 0, true);
      put2(pots.kuning, box(0.58, 0.06, 0.64), 0, 0.88, 0);
    } else if (b.jenis === 'payung-limas') {
      // payung kantin C (foto): tiang tengah, kanopi persegi berbentuk limas coklat bata, rusuk logam
      const S = b.lebar ?? 2.4, Hc = b.tinggi ?? 2.25, hr = b.tinggiAtap ?? 0.75;
      put2(pots.logam, new THREE.CylinderGeometry(0.035, 0.035, Hc + hr, 8), 0, (Hc + hr) / 2, 0, true);
      const cone = new THREE.ConeGeometry(S / Math.SQRT2, hr, 4, 1, true); cone.rotateY(Math.PI / 4);
      const m = put2(pots.payung, cone, 0, Hc + hr / 2, 0);
      const back = m.clone(); back.setIndex([...back.index.array].reverse()); pots.payung.push(back);   // sisi bawah kanopi
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put2(pots.logam, beam(new V3(0, Hc + hr - 0.02, 0), new V3(sx * S / 2, Hc, sz * S / 2), 0.025, 0.025), 0, 0, 0);
    } else if (b.jenis === 'pendopo-putih') {
      // pendopo kecil di depan C (foto): tiang besi putih, ring balok putih, atap limas genteng metal merah,
      // satu meja keramik putih berkaki beton abu dan dua bangku besi putih
      const S = b.lebar ?? 3.4, Hc = b.tinggi ?? 2.4, hr = b.tinggiAtap ?? 0.9, e = S / 2 - 0.06;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put2(pots.putih, box(0.08, Hc, 0.08), sx * e, Hc / 2, sz * e, true);
      for (const s1 of [-1, 1]) { put2(pots.putih, box(S, 0.1, 0.08), 0, Hc - 0.05, s1 * e); put2(pots.putih, box(0.08, 0.1, S), s1 * e, Hc - 0.05, 0); }
      for (const t of [-S / 4, 0, S / 4]) put2(pots.putih, box(0.04, 0.05, S), t, Hc - 0.02, 0);
      const cone = new THREE.ConeGeometry((S + 0.7) / Math.SQRT2, hr, 4, 1, true); cone.rotateY(Math.PI / 4);
      const rf = put2(pots.atapMerah, cone, 0, Hc + hr / 2, 0);
      const rb = rf.clone(); rb.setIndex([...rb.index.array].reverse()); pots.atapMerah.push(rb);      // sisi bawah atap terlihat dari dalam
      put2(pots.putih, box(1.6, 0.05, 0.8), 0, 0.74, 0, true);
      put2(pots.abu, box(0.3, 0.7, 0.3), 0, 0.35, 0);
      for (const dz of [-0.75, 0.75]) {
        put2(pots.putih, box(1.5, 0.04, 0.32), 0, 0.45, dz, true);
        for (const dx of [-0.68, 0.68]) put2(pots.putih, box(0.04, 0.44, 0.3), dx, 0.22, dz);
      }
    } else if (b.jenis === 'gazebo-merah') {
      // gazebo kantin (foto): tiang besi putih, atap limas seng merah, meja dan bangku besi putih
      const S = b.lebar ?? 6, Hc = b.tinggi ?? 2.6, hr = b.tinggiAtap ?? 1.0;
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) if (sx || sz) put2(pots.putih, box(0.1, Hc, 0.1), sx * (S / 2 - 0.2), Hc / 2, sz * (S / 2 - 0.2), true);
      put2(pots.putih, box(0.12, Hc + hr * 0.6, 0.12), 0, (Hc + hr * 0.6) / 2, 0, true);
      const cone = new THREE.ConeGeometry((S + 0.8) / Math.SQRT2, hr, 4, 1);
      cone.rotateY(Math.PI / 4);
      put2(pots.atapMerah, cone, 0, Hc + hr / 2, 0);
      for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
        put2(pots.putih, box(1.4, 0.05, 0.8), x, 0.74, z, true);
        put2(pots.putih, box(0.06, 0.72, 0.06), x, 0.36, z);
        for (const dz of [-0.65, 0.65]) put2(pots.putih, box(1.4, 0.05, 0.3), x, 0.44, z + dz);
      }
    } else if (b.jenis === 'tugu') {
      // tugu persegi merah muda yang tinggi di atas alas berundak
      const h = b.tinggi ?? 11, w = b.lebar ?? 0.75;
      put2(pots.pinkTua, box(w + 1.0, 0.25, w + 1.0), 0, 0.125, 0, true);
      put2(pots.pink, box(w + 0.4, 0.4, w + 0.4), 0, 0.45, 0, true);
      put2(pots.pink, box(w, h, w), 0, 0.65 + h / 2, 0, true);
    } else if (b.jenis === 'rumah-kecil') {
      // rumah hewan / kandang kecil merah muda berkaki, atap pelana, depan berkawat
      const w = b.lebar ?? 1.0, d = b.dalam ?? 0.8, h = b.tinggi ?? 0.7;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put2(pots.kayu, box(0.06, 0.45, 0.06), sx * (w / 2 - 0.05), 0.225, sz * (d / 2 - 0.05));
      put2(pots.pink, box(w, 0.05, d), 0, 0.47, 0, true);
      put2(pots.kawat, box(w, h, d - 0.04), 0, 0.5 + h / 2, 0, true);
      for (const sx of [-1, 1]) put2(pots.pink, box(0.04, h, d), sx * w / 2, 0.5 + h / 2, 0);
      put2(pots.pink, box(w, h, 0.04), 0, 0.5 + h / 2, -d / 2);
      const ridge = 0.5 + h + w * 0.35;
      for (const sx of [-1, 1]) {
        const panel = box(Math.hypot(w / 2 + 0.1, w * 0.35) , 0.04, d + 0.2);
        panel.rotateZ(sx * Math.atan2(w * 0.35, w / 2 + 0.1));
        put2(pots.pinkTua, panel, -sx * (w / 4 + 0.05), (0.5 + h + ridge) / 2, 0);
      }
    } else if (b.jenis === 'bangku-segienam') {
      // bangku besi putih segi enam mengelilingi pot tanaman
      const r = b.jari ?? 1.0;
      for (let i = 0; i < 6; i++) {
        const a0 = (i * Math.PI) / 3, a1 = ((i + 1) * Math.PI) / 3;
        for (const [rr, yy] of [[r, 0.45], [r + 0.05, 0.8], [r * 0.55, 0.45]]) {
          const p0 = new V3(Math.cos(a0) * rr, yy, Math.sin(a0) * rr), p1 = new V3(Math.cos(a1) * rr, yy, Math.sin(a1) * rr);
          put2(pots.putih, beam(p0, p1, 0.05, 0.05), 0, 0, 0);
        }
        put2(pots.putih, box(0.05, 0.8, 0.05), Math.cos(a0) * r, 0.4, Math.sin(a0) * r, true);
        put2(pots.putih, box(0.05, 0.45, 0.05), Math.cos(a0) * r * 0.55, 0.22, Math.sin(a0) * r * 0.55);
      }
      put2(pots.potGelap, new THREE.CylinderGeometry(0.35, 0.3, 0.4, 12), 0, 0.2, 0, true);
      const daun = new THREE.IcosahedronGeometry(0.4, 1); daun.scale(1, 0.8, 1);
      put2(pots.tanaman, daun, 0, 0.7, 0);
    } else if (b.jenis === 'pot-bundar') {
      // bak tanaman bundar bertepi beton merah muda, berisi semak (tanpa pohon)
      const r = b.jari ?? 1.3;
      put2(pots.pinkTua, new THREE.CylinderGeometry(r, r, 0.35, 28), 0, 0.175, 0, true);
      put2(pots.tanaman, new THREE.CylinderGeometry(r - 0.12, r - 0.12, 0.05, 28), 0, 0.37, 0);
      const semak = new THREE.IcosahedronGeometry(r * 0.6, 1); semak.scale(1.1, 0.55, 1.1);
      put2(pots.tanaman, semak, 0, 0.6, 0);
    } else if (b.jenis === 'ayunan') {
      const w = b.panjang ?? 2.4, h = 2.2;
      for (const sx of [-w / 2, w / 2]) for (const sz of [-0.7, 0.7]) put2(pots.putih, beam(new V3(sx, 0, sz), new V3(sx, h, 0), 0.07, 0.07), 0, 0, 0);
      put2(pots.putih, beam(new V3(-w / 2, h, 0), new V3(w / 2, h, 0), 0.08, 0.08), 0, 0, 0);
      for (const sx of [-w / 4, w / 4]) {
        for (const dx of [-0.2, 0.2]) put2(pots.logam, box(0.015, h - 0.5, 0.015), sx + dx, (h + 0.5) / 2, 0);
        put2(pots.kayu, box(0.5, 0.04, 0.22), sx, 0.5, 0);
      }
    }
  }
  if (keras.length) {
    // penghalang tak terlihat dari benda padat (kolom paviliun, tugu, rumah kecil, bangku, bak tanaman)
    const m = new THREE.Mesh(mergeGeometries(keras.map(g => g.index ? g.toNonIndexed() : g), false), new THREE.MeshBasicMaterial({ visible: false }));
    root.add(m); out.solids.push(m);
  }
  if (pijak.length) {
    const m = new THREE.Mesh(mergeGeometries(pijak.map(g => g.index ? g.toNonIndexed() : g), false), new THREE.MeshBasicMaterial({ visible: false }));
    root.add(m); out.walkables.push(m);
  }
  const pm = { pot: '#d48a7c', potGelap: '#44494d', tanaman: '#5f8f45', tanamanKuning: '#c39a35', logam: '#5d6266', kayu: '#7a5434', putih: '#f1f1ee',
               pink: '#dba8a4', pinkTua: '#c98e8a', abu: '#7f8489', atapDatar: '#454b52', kawat: '#3e4144',
               alasPendopo: '#a8918e', kayuMuda: '#b9864f', merahBesi: '#9b2b25', merahMeja: '#8a2a24', krem: '#e8e0cf', seng: '#c3c6c7', atapMerah: '#a8443a',
               kaca: '#9fb6bf', kuning: '#d9b836', oranye: '#c9672e', payung: '#7a4434', posterMerah: '#c4392f', posterKuning: '#e2b545', posterBiru: '#3d76b0', galon: '#3a6fa8', plastik: '#b9d3df' };
  for (const [k, list] of Object.entries(pots)) {
    const m = merged(list, new THREE.MeshStandardMaterial({ color: pm[k], roughness: 0.75, flatShading: k.startsWith('tanaman') }));
    if (m) root.add(m);
  }

  // tapak jalur (untuk melubangi bidang tanah); bidang tidak perlu dilubangi karena permukaannya di atas tanah
  // `tapak` (poligon kawasan) dipakai kalau lansekap hanya berisi bidang tetapi permukaannya lebih rendah dari tanah dasar (-0,22)
  out.footprint = spec.tapak || (strips.length ? [[W(0, 0, 0).x, W(0, 0, 0).z], [W(L, 0, 0).x, W(L, 0, 0).z], [W(L, v, 0).x, W(L, v, 0).z], [W(0, v, 0).x, W(0, v, 0).z]] : null);
  // jalur tempat sebuah titik kawasan berada (untuk label "di mana saya")
  out.where = (x, z) => {
    const bd = bidang.find(q => pointInPoly(x, z, q.poligon));
    if (bd) return bd.nama;
    const dx = x - ax, dz = z - az, t = dx * ux + dz * uz, vv = dx * ox + dz * oz;
    if (t < 0 || t > L || vv < 0 || vv > v) return null;
    const tg = tangga.find(q => Math.abs(t - q.t) <= q.lebar / 2 && vv > strips[q.dari].v1 && vv < strips[q.ke].v0);
    return tg ? (tg.nama || 'Tangga') : strips.find(st => vv >= st.v0 && vv <= st.v1)?.nama;
  };
  root.updateMatrixWorld(true);
  return out;
}
