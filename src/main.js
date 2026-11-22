// Aplikasi jelajah 3D FSM UNDIP. Semua gedung berstatus "dibuat" ditaruh bersama di kawasan
// sesuai posisi/rotasi di kampus.json, lengkap dengan penghubung antar gedung. Tiga mode tampilan:
//   kawasan : tampak luar dari atas (isometrik/atas/depan)
//   lantai  : satu lantai dipotong setinggi dada supaya isi ruangnya terlihat
//   jalan   : first-person, bisa berpindah gedung lewat penghubung
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildGedung, buildPenghubung, buildLansekap, pointInPoly, ROOM_COLORS, FUNGSI, shortName } from './builder.js';
import { Walker } from './walk.js';
import { createUI } from './ui.js';

const $ = s => document.querySelector(s);
const V3 = THREE.Vector3;

// Data bisa disisipkan langsung di halaman (window.__FSM_DATA__) atau diambil dari file JSON.
async function loadJSON(path) {
  const emb = window.__FSM_DATA__ && window.__FSM_DATA__[path];
  if (emb) return structuredClone(emb);
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Gagal memuat ${path} (HTTP ${r.status})`);
  return r.json();
}

const state = {
  mode: 'kawasan',
  floor: 1,
  view: 'iso',
  focusAll: false,     // true = kamera kawasan membingkai semua gedung, false = gedung yang dipilih
  selectedRoom: null,
  showRoof: true,
  showLabels: true,
  showOverlay: false,
  shadows: true,
  cut: 1.6,            // tinggi potongan dinding di mode lantai (m di atas lantai)
  colorBy: 'fungsi',
  panelOpen: true,
  panelBeforeWalk: true,
};

// Batas sumbu (x,z) dari kumpulan titik
function boxOf(points) {
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const [x, z] of points) {
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x);
    b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
  }
  return b;
}

async function init() {
  // ---------- renderer, kamera, kontrol ----------
  const host = $('#viewport');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1';
  document.body.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef0ec');
  scene.fog = new THREE.Fog('#eef0ec', 180, 420);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(86);
  controls.minDistance = 6;
  controls.maxDistance = 220;

  // ---------- data ----------
  const kampus = await loadJSON('data/kampus.json');
  const entries = [];
  for (const g of kampus.gedung.filter(g => g.status === 'dibuat')) entries.push({ meta: g, data: await loadJSON(g.file) });
  if (!entries.length) throw new Error('Belum ada gedung berstatus "dibuat" di data/kampus.json');

  // ---------- bangun tiap gedung lalu taruh di posisinya ----------
  const rooms = new Map();          // kode ruang -> { entry, info }; kode unik antar gedung (diawali huruf gedung)
  for (const e of entries) {
    e.built = buildGedung(e.data);
    e.group = new THREE.Group();
    e.group.name = 'tempat-' + e.data.id;
    const [px, pz] = e.meta.posisi || [0, 0];
    e.group.position.set(px, 0, pz);
    e.group.rotation.y = THREE.MathUtils.degToRad(e.meta.rotasi || 0);
    e.group.add(e.built.root);
    scene.add(e.group);
    e.group.updateMatrixWorld(true);
    const pts = [];
    for (const f of e.data.lantai) for (const poly of [...f.ruang.map(r => r.poligon), f.selasar?.poligon || []]) pts.push(...poly);
    e.box = boxOf(pts);                                                     // batas di koordinat gedung
    e.wbox = boxOf(pts.map(([x, z]) => { const v = e.group.localToWorld(new V3(x, 0, z)); return [v.x, v.z]; }));   // di kawasan
    for (const [kode, info] of e.built.rooms) rooms.set(kode, { entry: e, info });
  }
  const links = (kampus.penghubung || []).map(spec => {
    const b = buildPenghubung(spec, entries[0].data.tampilan);
    scene.add(b.root);
    return b;
  });
  // lansekap di luar gedung (undakan, selokan, plaza); dibangun langsung di koordinat kawasan
  const scapes = (kampus.lansekap || []).map(spec => { const b = buildLansekap(spec); scene.add(b.root); return b; });
  const all = boxOf([...entries.flatMap(e => [[e.wbox.x0, e.wbox.z0], [e.wbox.x1, e.wbox.z1]]), ...links.flatMap(l => l.spec.poligon)]);

  let sel = entries[0];             // gedung yang sedang dibuka di panel
  const elevOf = no => sel.data.lantai.find(f => f.no === no).elevasi;

  // ---------- cahaya ----------
  const hemi = new THREE.HemisphereLight('#ffffff', '#b8b2a5', 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e3', 2.3);
  const CA = new V3((all.x0 + all.x1) / 2, 0, (all.z0 + all.z1) / 2);
  const spanAll = Math.max(all.x1 - all.x0, all.z1 - all.z0);
  sun.position.set(CA.x + spanAll * 0.6, 70, CA.z + spanAll * 0.8);
  sun.target.position.copy(CA);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sb = spanAll * 0.62 + 8;
  Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 5, far: 260 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- tapak sederhana (tanpa pohon, sesuai arahan) ----------
  const flatGeo = (x0, z0, x1, z1, y) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    return g;
  };
  // bidang datar berlubang: lubang = tapak lansekap, supaya selokan dan undakan tidak tertutup tanah/paving
  const holedGeo = (x0, z0, x1, z1, y) => {
    const sh = new THREE.Shape([[x0, -z0], [x1, -z0], [x1, -z1], [x0, -z1]].map(([x, y]) => new THREE.Vector2(x, y)));
    for (const sc of scapes) sh.holes.push(new THREE.Path(sc.footprint.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    return g;
  };
  const ground = new THREE.Mesh(holedGeo(-400, -400, 400, 400, -0.22), new THREE.MeshStandardMaterial({ color: '#e4e5df', roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
  const paving = new THREE.Mesh(holedGeo(all.x0 - 5, all.z0 - 5, all.x1 + 5, all.z1 + 5, -0.205), new THREE.MeshStandardMaterial({ color: '#d7d8d1', roughness: 1 }));
  paving.receiveShadow = true;
  scene.add(paving);

  // ---------- label & overlay (anak dari grup gedung, jadi memakai koordinat gedung) ----------
  for (const e of entries) {
    const el = document.createElement('div');
    el.className = 'pin';
    el.textContent = e.data.id;
    el.addEventListener('click', ev => { ev.stopPropagation(); app.selectBuilding(e.meta.id); });
    e.pin = new CSS2DObject(el);
    e.pinEl = el;
    const roofTop = Math.max(...(Array.isArray(e.data.atap) ? e.data.atap : [e.data.atap]).map(a => a.tepiBawah));
    e.pin.position.set((e.box.x0 + e.box.x1) / 2, roofTop + 7, (e.box.z0 + e.box.z1) / 2);
    e.group.add(e.pin);

    for (const [kode, info] of e.built.rooms) {
      const r = info.room;
      const lab = document.createElement('div');
      lab.className = 'rlabel' + (r.sumber && r.sumber !== 'denah-2023' ? ' kl' : '');
      // kelas: kode + "Kelas"; ruang bernama: nama + fungsi; ruang servis sempit: kode saja agar tidak bertumpuk
      const servis = ['toilet', 'sirkulasi', 'tangga', 'gudang'].includes(r.fungsi);
      lab.innerHTML = r.fungsi === 'kelas' ? `<b>${kode}</b><small>Kelas</small>`
        : servis ? `<b>${shortName(kode, r)}</b>` : `<b>${shortName(kode, r)}</b><small>${FUNGSI[r.fungsi] || ''}</small>`;
      if (servis) lab.classList.add('mini');
      lab.title = `${e.data.nama} · ${r.nama}`;
      lab.addEventListener('click', ev => { ev.stopPropagation(); app.selectRoom(kode); });
      const o = new CSS2DObject(lab);
      o.position.set(info.center.x, info.elev + 0.15, info.center.z);
      o.visible = false;
      e.group.add(o);
      info.label = o;
      info.labelEl = lab;
    }

    e.overlays = new Map();
    for (const f of e.data.lantai) {
      if (!f.denah) continue;
      const [x0, z0, x1, z1] = f.denah.batas;
      const m = new THREE.MeshBasicMaterial({ color: '#d1157a', transparent: true, opacity: 0.95, depthWrite: false });
      const mesh = new THREE.Mesh(flatGeo(x0, z0, x1, z1, f.elevasi + 0.03), m);
      mesh.renderOrder = 3;
      mesh.visible = false;
      e.group.add(mesh);
      e.overlays.set(f.no, mesh);
      // garis denah dimuat saat overlay pertama kali dinyalakan (hemat memori)
      mesh.userData.load = () => {
        if (mesh.userData.loaded) return;
        mesh.userData.loaded = true;
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          x.globalCompositeOperation = 'difference';   // garis gelap di kertas jadi bagian yang tampak
          x.fillStyle = '#fff';
          x.fillRect(0, 0, c.width, c.height);
          m.alphaMap = new THREE.CanvasTexture(c);
          m.needsUpdate = true;
        };
        img.src = f.denah.gambar;
      };
    }
  }

  // ---------- jalan kaki: tabrakan & lantai dari semua gedung + penghubung ----------
  const walker = new Walker(camera, renderer.domElement, {
    solids: [...entries.flatMap(e => e.built.solids), ...links.flatMap(l => l.solids), ...scapes.flatMap(sc => sc.solids)],
    walkables: [...entries.flatMap(e => e.built.walkables), ...links.flatMap(l => l.walkables), ...scapes.flatMap(sc => sc.walkables), ground],
  });

  // ---------- ukuran layar & geser pusat pandang menjauhi panel ----------
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    const shift = state.panelOpen && w > 760 && state.mode !== 'jalan' ? 200 : 0;
    if (shift) camera.setViewOffset(w, h, -shift, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------- animasi kamera ----------
  let tween = null;
  const ease = t => 1 - Math.pow(1 - t, 3);
  function flyTo(pos, target, instant = false) {
    if (instant) { camera.position.copy(pos); controls.target.copy(target); controls.update(); tween = null; return; }
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, k: 0 };
  }
  function pose(view) {
    const inFloor = state.mode === 'lantai';
    const b = state.focusAll && !inFloor ? all : sel.wbox;
    const C = new V3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
    const k = Math.max(b.x1 - b.x0, b.z1 - b.z0, 20) / 45;      // Gedung A (45 m) jadi patokan jarak
    const y = inFloor ? elevOf(state.floor) : 4;
    const t = new V3(C.x, y, C.z);
    if (view === 'atas') return [new V3(C.x, y + (inFloor ? 64 : 80) * k, C.z + 0.01), t];
    if (view === 'depan') return [new V3(C.x, y + (inFloor ? 16 : 7) * k, C.z + (inFloor ? 48 : 60) * k), new V3(C.x, y + (inFloor ? 0 : 5), C.z)];
    return [new V3(C.x + (inFloor ? 14 : 30) * k, y + (inFloor ? 34 : 42) * k, C.z + (inFloor ? 38 : 62) * k), t];
  }

  // ---------- warna & sorot ruang ----------
  function recolor() {
    for (const [kode, { info }] of rooms) {
      const on = kode === state.selectedRoom && state.mode !== 'jalan';
      info.labelEl.classList.toggle('on', on);
      if (!info.surface) continue;
      const m = info.surface.material, r = info.room;
      const base = state.colorBy === 'sumber' ? ROOM_COLORS.sumber[r.sumber] : ROOM_COLORS.fungsi[r.fungsi] || '#ddd';
      m.color.set(on ? '#8db8ff' : base);
      m.emissive.set(on ? '#1b56c9' : '#000000');
      m.emissiveIntensity = on ? 0.25 : 0;
    }
  }

  // ---------- terapkan state ke scene ----------
  const clip = new THREE.Plane(new V3(0, -1, 0), 0);
  function apply() {
    const inFloor = state.mode === 'lantai';
    const walking = state.mode === 'jalan';
    const showRoof = !inFloor && (state.showRoof || walking);
    for (const e of entries) {
      for (const fl of e.built.floors) fl.group.visible = !inFloor || fl.no <= state.floor;
      e.built.top.visible = !inFloor;
      e.built.roof.visible = showRoof;
      e.pin.visible = state.mode === 'kawasan';
      e.pinEl.classList.toggle('on', e === sel);
      e.overlays.forEach((m, no) => {
        m.visible = inFloor && no === state.floor && state.showOverlay;
        if (m.visible) m.userData.load();
      });
    }
    for (const l of links) {
      for (const fl of l.floors) fl.group.visible = !inFloor || fl.no <= state.floor;
      l.roof.visible = showRoof;
    }
    clip.constant = elevOf(state.floor) + state.cut;
    renderer.clippingPlanes = inFloor ? [clip] : [];
    for (const { info } of rooms.values()) info.label.visible = inFloor && info.floor === state.floor && state.showLabels;
    sun.castShadow = state.shadows;
    hemi.intensity = walking ? 2.6 : 1.55;        // di dalam gedung lebih terang supaya ruang tidak gelap
    controls.enabled = !walking;
    document.body.classList.toggle('walking', walking);
    $('#walkhud').hidden = !walking;
    $('#modechip').textContent = walking ? 'Jalan kaki'
      : inFloor ? `Lantai ${state.floor} · ${sel.data.nama} dipilih` : (state.focusAll ? 'Kawasan · semua gedung' : 'Kawasan · ' + sel.data.nama);
    document.querySelectorAll('#viewDock button').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
    document.querySelectorAll('#floorDock button').forEach(b => b.classList.toggle('on', inFloor ? +b.dataset.floor === state.floor : b.dataset.floor === 'all'));
    recolor();
    resize();
    ui.update();
  }

  // ---------- posisi berdiri untuk "jalan ke ruang ini" (dihitung di koordinat gedung, lalu dibawa ke kawasan) ----------
  function toWorldPose(e, x, y, z, dirx, dirz) {
    const pos = e.group.localToWorld(new V3(x, y, z));
    const d = new V3(dirx, 0, dirz).applyQuaternion(e.group.quaternion);
    return { pos, yaw: Math.atan2(-d.x, -d.z) };
  }
  function standPoseFor(kode) {
    const { entry: e, info } = rooms.get(kode);
    const f = e.data.lantai.find(x => x.no === info.floor);
    for (const w of f.dinding) {
      const o = (w.bukaan || []).find(b => b.ruang === kode && b.jenis.startsWith('pintu'));
      if (!o) continue;
      const [ax, az] = w.a, [bx, bz] = w.b;
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      let nx = -uz, nz = ux;
      if ((info.center.x - ax) * nx + (info.center.z - az) * nz < 0) { nx = -nx; nz = -nz; }   // arah ke dalam ruang
      return toWorldPose(e, ax + ux * o.t - nx * 1.4, info.elev, az + uz * o.t - nz * 1.4, nx, nz);   // 1,4 m di luar pintu
    }
    return toWorldPose(e, info.center.x, info.elev, info.center.z, 0, 1);
  }

  // Gedung/penghubung tempat sebuah titik kawasan berada, beserta lantainya
  function locate(p) {
    for (const l of links) {
      // lantai penghubung yang poligonnya memuat titik ini, diambil yang tertinggi di bawah kaki
      const cand = l.spec.lantai.filter(x => pointInPoly(p.x, p.z, x.area || x.poligon || l.spec.poligon) && p.y >= x.elevasi - 1.4);
      if (cand.length) return { link: l, floor: cand[cand.length - 1].no };
    }
    for (const e of entries) {
      const q = e.group.worldToLocal(p.clone());
      const f = [...e.data.lantai].reverse().find(f => q.y >= f.elevasi - 0.6) || e.data.lantai[0];
      const r = f.ruang.find(r => pointInPoly(q.x, q.z, r.poligon));
      // di antara dua lantai (bordes/anak tangga) selalu dilaporkan sebagai tangga
      if (q.y - f.elevasi > 1.0 && f.ruang.some(x => x.fungsi === 'tangga' && pointInPoly(q.x, q.z, x.poligon) || r?.fungsi === 'gudang'))
        return { entry: e, floor: f.no, room: { fungsi: 'tangga', nama: 'Tangga', kode: '' } };
      if (r) return { entry: e, floor: f.no, room: r };
      if (f.selasar && pointInPoly(q.x, q.z, f.selasar.poligon)) return { entry: e, floor: f.no, selasar: true };
    }
    return null;
  }

  // ---------- API yang dipakai panel ----------
  const app = {
    state, kampus, entries,
    get data() { return sel.data; },
    get built() { return sel.built; },
    get bbox() { return sel.box; },
    elevOf,
    selectBuilding(id, fly = true) {
      const e = entries.find(x => x.meta.id === id);
      if (!e) return;
      if (state.mode === 'jalan') app.exitWalk(false);
      if (e !== sel) {
        sel = e;
        if (state.selectedRoom && rooms.get(state.selectedRoom).entry !== e) state.selectedRoom = null;
        ui.bind();
      }
      state.focusAll = false;
      apply();
      if (fly) flyTo(...pose(state.view));
      ui.showTab('gedung');
    },
    switchBuilding(id) { app.selectBuilding(id); },
    overview() {
      if (state.mode === 'jalan') app.exitWalk(false);
      state.focusAll = true;
      state.mode = 'kawasan';
      apply();
      flyTo(...pose(state.view));
    },
    setFloor(no) {
      if (state.mode === 'jalan') app.exitWalk(false);
      if (no == null) { state.mode = 'kawasan'; apply(); flyTo(...pose(state.view)); return; }
      state.mode = 'lantai';
      state.floor = no;
      if (state.selectedRoom && rooms.get(state.selectedRoom).info.floor !== no) state.selectedRoom = null;
      apply();
      flyTo(...pose(state.view));
    },
    enterBuilding() { state.focusAll = false; app.setFloor(1); ui.showTab('ruang'); },
    setView(v) { state.view = v; if (state.mode === 'jalan') app.exitWalk(false); apply(); flyTo(...pose(v)); },
    set(key, value) { state[key] = value; apply(); },
    setCut(v) { state.cut = v; clip.constant = elevOf(state.floor) + v; },
    selectRoom(kode, { focus = false } = {}) {
      state.selectedRoom = kode;
      if (!kode) return apply();
      const { entry, info } = rooms.get(kode);
      if (entry !== sel) { sel = entry; ui.bind(); }
      state.focusAll = false;
      if (state.mode !== 'lantai' || state.floor !== info.floor) {
        if (state.mode === 'jalan') app.exitWalk(false);
        state.mode = 'lantai';
        state.floor = info.floor;
        apply();
        flyTo(...pose(state.view));
      } else apply();
      if (focus) app.focusRoom(kode);
      ui.showTab('ruang');
    },
    focusRoom(kode) {
      const { entry, info } = rooms.get(kode);
      const c = entry.group.localToWorld(info.center.clone());
      const s = Math.max(10, Math.sqrt(info.area) * 1.6);
      flyTo(new V3(c.x + s * 0.35, c.y + s * 1.3, c.z + s * 1.25), c);
    },
    walk(kode) {
      let p;
      if (kode) { state.selectedRoom = kode; p = standPoseFor(kode); }
      else {
        const f = sel.data.lantai[0];
        const mj = sel.data.mulaiJalan || { posisi: [(sel.box.x0 + sel.box.x1) / 2, sel.box.z1 - 1], arah: 0 };
        const a = THREE.MathUtils.degToRad(mj.arah);
        p = toWorldPose(sel, mj.posisi[0], f.elevasiSelasar, mj.posisi[1], -Math.sin(a), -Math.cos(a));
      }
      state.panelBeforeWalk = state.panelOpen;
      if (state.panelOpen) ui.togglePanel(false);
      state.mode = 'jalan';
      apply();
      tween = null;
      walker.enter(p.pos, p.yaw);
    },
    exitWalk(reapply = true) {
      if (state.mode !== 'jalan') return;
      walker.exit();
      const where = locate(walker.pos);
      if (where?.entry && where.entry !== sel) { sel = where.entry; ui.bind(); }
      state.floor = where?.floor ?? sel.data.lantai.reduce((best, f) => (Math.abs(f.elevasi - walker.pos.y) < Math.abs(elevOf(best) - walker.pos.y) ? f.no : best), 1);
      state.mode = 'lantai';
      camera.rotation.set(0, 0, 0);
      if (state.panelBeforeWalk) ui.togglePanel(true);
      if (reapply) { apply(); flyTo(...pose(state.view)); }
    },
    togglePanel(open) { state.panelOpen = open; document.body.classList.toggle('panel-closed', !open); resize(); },
    whereAmI() {
      const w = locate(walker.pos);
      if (!w) {
        for (const sc of scapes) { const n = sc.where(walker.pos.x, walker.pos.z); if (n) return `${sc.spec.nama} · ${n}`; }
        return 'Di luar gedung';
      }
      if (w.link) return `Lantai ${w.floor} · ${w.link.spec.nama}`;
      const r = w.room;
      return `${w.entry.data.nama} · Lantai ${w.floor} · ${w.selasar ? 'Selasar' : r.fungsi === 'kelas' ? r.kode : r.nama}`;
    },
  };

  const ui = createUI(app);

  // ---------- kontrol kanan bawah ----------
  const fd = $('#floorDock');
  fd.innerHTML = `<button data-floor="all">Semua</button>` +
    [...sel.data.lantai].reverse().map(f => `<button data-floor="${f.no}">Lt ${f.no}</button>`).join('');
  fd.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) app.setFloor(b.dataset.floor === 'all' ? null : +b.dataset.floor);
  });
  $('#viewDock').addEventListener('click', e => { const b = e.target.closest('button'); if (b) app.setView(b.dataset.view); });
  $('#walkExit').addEventListener('click', () => app.exitWalk());
  // tombol arah layar sentuh: tahan = jalan
  $('#pad').querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); walker.keys[k] = true; };
    const off = () => { walker.keys[k] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (state.mode === 'jalan') app.exitWalk();
    else if (state.mode === 'lantai') app.setFloor(null);
  });

  // ---------- klik untuk memilih gedung / ruang ----------
  const ray = new THREE.Raycaster();
  let downAt = null;
  const visibleChain = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const entryOf = o => { for (; o; o = o.parent) { const e = entries.find(x => x.group === o); if (e) return e; } return null; };
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || state.mode === 'jalan') return;
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const inFloor = state.mode === 'lantai';
    const y0 = inFloor ? elevOf(state.floor) - 0.3 : -Infinity;
    const hits = ray.intersectObjects(entries.map(x => x.group), true).filter(h =>
      visibleChain(h.object) && !h.object.userData.collider && h.object.isMesh &&
      (!inFloor || (h.point.y <= clip.constant + 0.01 && h.point.y >= y0)));
    const h = hits[0];
    const ent = h && entryOf(h.object);
    if (!inFloor) { if (ent) app.selectBuilding(ent.meta.id, ent !== sel); return; }
    if (!ent) return app.selectRoom(null);
    const q = ent.group.worldToLocal(h.point.clone());
    const f = ent.data.lantai.find(x => x.no === state.floor);
    const kode = h.object.userData.kode || f.ruang.find(r => pointInPoly(q.x, q.z, r.poligon))?.kode;
    app.selectRoom(kode || null);
  });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const fwd = new V3(), upv = new V3();
  let whereT = 0;
  const needle = $('#compass .needle');
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state.mode === 'jalan') {
      walker.update(dt);
      whereT -= dt;
      if (whereT <= 0) { $('#where').textContent = app.whereAmI(); whereT = 0.25; }
    } else {
      if (tween) {
        tween.k = Math.min(1, tween.k + dt / 0.9);
        const k = ease(tween.k);
        camera.position.lerpVectors(tween.p0, tween.p1, k);
        controls.target.lerpVectors(tween.t0, tween.t1, k);
        if (tween.k >= 1) tween = null;
      }
      controls.update();
    }
    // kompas: utara = -z
    camera.getWorldDirection(fwd);
    if (Math.abs(fwd.y) > 0.9) { upv.set(0, 1, 0).applyQuaternion(camera.quaternion); fwd.copy(upv); }
    needle.style.transform = `rotate(${-Math.atan2(fwd.x, -fwd.z)}rad)`;
    renderer.render(scene, camera);
    labels.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // mulai dengan membingkai semua gedung
  state.focusAll = true;
  apply();
  flyTo(...pose('iso'), true);
  $('#loading').remove();
  frame();
  window.__app = app;   // memudahkan pengecekan dari console
  window.__walker = walker;
  window.__controls = controls;  // kamera orbit (dipakai skrip render uji)
}

init().catch(err => {
  console.error(err);
  const el = $('#loading');
  el.classList.add('err');
  el.textContent = 'Gagal memuat model.\n' + err.message +
    (location.protocol === 'file:' ? '\n\nBuka lewat server lokal (misalnya Live Server di VS Code), bukan dengan klik dua kali file HTML.' : '');
});
