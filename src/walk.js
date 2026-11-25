// Mode jalan kaki (first-person): seret untuk menoleh, WASD / tombol panah untuk berjalan.
// Tabrakan memakai raycast: ke depan terhadap dinding/kolom/railing, ke bawah terhadap lantai/tangga, ke atas terhadap plafon/atap.
//
// Tombol:
//   Shift          lari (saat terbang: turun)
//   Space          lompat; tekan dua kali cepat untuk mulai/berhenti terbang; saat terbang ditahan = naik
//   W dua kali     saat terbang: terbang cepat (berhenti begitu W dilepas)
//   Q              kunci kamera (kursor hilang, geser mouse langsung menoleh, tanpa klik-tahan)
// Terbang berhenti sendiri begitu kaki menyentuh lantai/tanah. Dinding, pagar, lantai, dan atap tetap menahan.
import * as THREE from 'three';

const EYE = 1.6;          // tinggi mata (m)
const RADIUS = 0.3;       // jarak minimum badan ke dinding
const STEP = 0.55;        // tinggi maksimum yang bisa dinaiki dalam satu langkah (anak tangga 17 cm aman)
const HEAD = 0.15;        // jarak minimum kepala ke plafon
const JUMP_V = 3.8;       // kecepatan awal lompat (m/s), tinggi lompatan ±0,74 m
const DOUBLE_TAP = 300;   // jeda maksimum dua kali tekan (ms)
const SPEED = { jalan: 2.2, lari: 4.5, terbang: 5.0, terbangCepat: 12.0, naikTurun: 4.0 };
const LOOK = 0.0025;      // kepekaan mouse saat kamera terkunci (radian per satuan gerak)
const LOOK_DRAG = 0.004;  // kepekaan seret (radian per piksel)
// Lonjakan gerak mouse palsu: di Chrome/Windows (terutama dua monitor atau mouse polling tinggi) pointer lock kadang melaporkan
// movementX ratusan piksel dalam satu kejadian, dan tanpa pointer lock movementX melompat saat kursor keluar-masuk jendela/iframe.
// Batas tetap (mis. 180 px) tidak adil untuk semua perangkat: satuan movementX berbeda antarbrowser (piksel CSS, piksel fisik),
// mouse DPI tinggi melaporkan angka lebih besar, dan di monitor 60 Hz satu kejadian membawa gerak 3x lebih banyak daripada di 165 Hz,
// sehingga gerakan cepat yang asli ikut terbuang. Karena itu penyaringnya relatif terhadap gerak barusan, bukan angka mutlak:
// kejadian yang jauh lebih besar dari gerak sebelumnya ditahan dulu, lalu diputuskan oleh kejadian berikutnya (lihat _look).
const SPIKE_RATIO = 5;     // dicurigai kalau lebih dari 5x gerak terbesar barusan
const SPIKE_FLOOR = 0.05;  // gerak di bawah 5% sisi pendek jendela tidak pernah dicurigai
const SPIKE_HOLD = 150;    // ms; kejadian yang ditahan dibuang kalau tidak ada lanjutan selama ini
const REF_HALF = 60;       // ms; "gerak terbesar barusan" meluruh setengahnya tiap 60 ms
// Tombol dibaca dari posisi fisiknya (e.code), bukan hurufnya (e.key): WASD tetap di tempat yang sama pada layout AZERTY, Dvorak,
// atau keyboard berbahasa lain (Arab, Rusia, Jepang dengan IME), dan keydown/keyup selalu cocok sehingga tidak ada tombol "macet".
const KODE = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', Space: ' ', ShiftLeft: 'shiftl', ShiftRight: 'shiftr',
  ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
};
const NAMA = ['w', 'a', 's', 'd', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];   // cadangan kalau e.code kosong
const smooth = (rate, dt) => (dt <= 0 ? 1 : 1 - Math.exp(-rate * dt));   // pelunakan yang hasilnya sama di semua frame rate

export class Walker {
  constructor(camera, dom, world) {
    this.camera = camera;
    this.dom = dom;
    this.world = world;               // { solids: Mesh[], walkables: Mesh[], overhead: Object3D[] }
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
    this.keys = {};
    this.active = false;
    this.flying = false;
    this.fast = false;                // terbang cepat (W dua kali)
    this.grounded = true;
    this.groundRef = 0;               // tinggi lantai terakhir tempat berpijak (untuk pagar saat melompat)
    this.locked = false;              // kamera terkunci dengan pointer lock
    this.freeLook = false;            // cadangan kalau pointer lock ditolak: menoleh mengikuti mouse tanpa klik
    this.unlockAt = -1e9;             // waktu kunci kamera terakhir dilepas (Esc pertama hanya melepas kunci)
    this.onState = null;              // dipanggil saat status terbang / kunci kamera berubah (untuk HUD)
    this.ray = new THREE.Raycaster();
    this.drag = null;
    this.held = null;                 // kejadian gerak mouse yang sedang ditahan (calon lonjakan)
    this.lookRef = 0;                 // gerak terbesar barusan (meluruh), pembanding lonjakan
    this.lookRefT = 0;
    this.lastTap = { ' ': -1e9, w: -1e9 };

    this._down = e => {
      if (this.locked || this.freeLook) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;     // hanya tombol kiri (klik kanan/tengah tidak menyeret kamera)
      this.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try { this.dom.setPointerCapture?.(e.pointerId); } catch { /* pointer sudah tidak aktif (pena/sentuh di beberapa browser) */ }
    };
    this._move = e => {
      if (this.locked || this.freeLook) {
        const mx = e.movementX || 0, my = e.movementY || 0;
        if (this.skipLook) { this.skipLook = false; return; }   // kejadian pertama sesudah kunci/masuk jendela sering melompat
        this._look(mx, my, LOOK);
        return;
      }
      if (!this.drag || e.pointerId !== this.drag.id) return;
      // tombol sudah dilepas di luar jendela (pointerup tidak sampai): hentikan seret, jangan memutar kamera dari posisi lama
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) { this.drag = null; return; }
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this._look(dx, dy, LOOK_DRAG);
    };
    // hanya jari/pointer yang sedang menyeret yang menghentikan seret (layar sentuh: jari lain yang diangkat tidak memutus seret)
    this._up = e => { if (this.drag && (!e || e.pointerId === undefined || e.pointerId === this.drag.id)) this.drag = null; };
    // jendela kehilangan fokus (Alt+Tab, klik di luar, tab lain): lepas semua tombol supaya tidak terus berjalan/terbang sendiri
    this._blur = () => { this.keys = {}; this.drag = null; this.held = null; this._setFast(false); };
    this._vis = () => { if (document.hidden) this._blur(); };
    this._leave = e => { if (!e.relatedTarget) this.skipLook = true; };   // kursor keluar jendela (mode lihat tanpa pointer lock)
    this._key = e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.isComposing) return;            // sedang mengetik lewat IME (Jepang, Cina, dsb.)
      const on = e.type === 'keydown';
      const huruf = (e.key || '').toLowerCase();
      const k = e.code ? KODE[e.code] : (NAMA.includes(huruf) ? huruf : undefined);
      if (k) {
        this.keys[k] = on;
        e.preventDefault();               // Space tidak menggulir halaman / menekan tombol yang sedang fokus
        if (on && !e.repeat) this._press(k);
        if (!on && (k === 'w' || k === 'arrowup')) this._setFast(false);
      } else if (on && !e.repeat && (e.code === 'KeyQ' || huruf === 'q')) {
        // kunci kamera: tombol Q fisik, atau tombol berhuruf Q selama tidak dipakai untuk berjalan (AZERTY: Q = geser kiri)
        this.toggleLock();
      }
    };
    this._lockChange = () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.dom;
      if (this.locked) { this.freeLook = false; this.skipLook = true; }
      if (was && !this.locked) this.unlockAt = performance.now();
      this._emit();
    };
    this._lockError = () => { this.freeLook = true; this._emit(); };
  }

  // tombol yang ditekan (bukan ditahan): lompat, terbang, terbang cepat, kunci kamera
  _press(k) {
    const now = performance.now();
    if (k === ' ') {
      // Ketukan pertama yang dihitung untuk "Space dua kali" hanya lompatan dari lantai (atau ketukan saat terbang).
      // Space yang ditekan iseng saat masih melayang tidak dihitung, supaya tidak tiba-tiba terbang lalu langsung
      // mendarat lagi (terasa seperti "teleport") saat Space ditekan berulang sambil lari.
      const dbl = now - this.lastTap[' '] < DOUBLE_TAP;
      if (this.flying) {
        if (dbl) { this._setFlying(false); this.lastTap[' '] = -1e9; } else this.lastTap[' '] = now;
      } else if (this.grounded) {
        this.vy = JUMP_V; this.grounded = false; this.lastTap[' '] = now;
      } else if (dbl) {
        this._setFlying(true); this.lastTap[' '] = -1e9;
      }
    } else if (k === 'w' || k === 'arrowup') {
      const dbl = now - this.lastTap.w < DOUBLE_TAP;
      this.lastTap.w = dbl ? -1e9 : now;
      if (dbl && this.flying) this._setFast(true);
    }
  }

  // Penyaring lonjakan + putar kamera. Tidak bergantung pada satuan gerak, DPI mouse, maupun refresh rate monitor:
  //  - kejadian yang lebih dari SPIKE_RATIO kali gerak terbesar barusan (dan di atas SPIKE_FLOOR) ditahan, belum dipakai;
  //  - kejadian berikutnya memutuskan: kalau meneruskan gerak itu (arah searah, besarnya minimal 20%), yang ditahan dipakai,
  //    jadi gerak cepat yang asli hanya tertunda satu kejadian (±1 frame); kalau tidak (kecil, atau berbalik arah), yang ditahan
  //    dianggap lonjakan palsu dan dibuang. Lonjakan Chrome selalu tunggal di tengah gerak biasa, sedangkan gerak tangan manusia
  //    selalu menyebar ke banyak kejadian, jadi aturan ini memisahkan keduanya.
  _look(dx, dy, sens) {
    const now = performance.now();
    const m = Math.hypot(dx, dy);
    if (m === 0) return;
    const h = this.held;
    if (h) {
      this.held = null;
      if (m >= h.m * 0.2 && dx * h.dx + dy * h.dy > 0) this._turn(h.dx, h.dy, h.m, sens, h.t);
    }
    const ref = this.lookRef * 0.5 ** ((now - this.lookRefT) / REF_HALF);
    const floor = SPIKE_FLOOR * Math.min(innerWidth || 800, innerHeight || 600);
    if (m > floor && m > SPIKE_RATIO * ref) { this.held = { dx, dy, m, t: now }; return; }
    this._turn(dx, dy, m, sens, now);
  }

  _turn(dx, dy, m, sens, t) {
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -1.3, 1.3);
    this.lookRef = Math.max(m, this.lookRef * 0.5 ** ((t - this.lookRefT) / REF_HALF));
    this.lookRefT = t;
  }

  _setFlying(on) {
    if (this.flying === on) return;
    this.flying = on;
    this.vy = 0;
    if (on) {
      this.flyGrace = 0.3;                   // sebentar tidak dianggap mendarat (mulai terbang di tengah lompatan, dekat lantai)
    } else {
      this.fast = false;
    }
    this._emit();
  }

  _setFast(on) {
    if (this.fast === on) return;
    this.fast = on && this.flying;
    this._emit();
  }

  toggleLock() {
    if (this.locked) { document.exitPointerLock?.(); return; }
    if (this.freeLook) { this.freeLook = false; this.unlockAt = performance.now(); this._emit(); return; }
    // Pointer lock biasa (tanpa unadjustedMovement): gerak mentah itu satuannya hitungan sensor mouse, jadi mouse 3200 DPI memutar
    // 4x lebih cepat dari mouse kantor 800 DPI, dan hanya ada di Chrome/Edge. Gerak biasa mengikuti kecepatan kursor yang sudah diatur
    // tiap orang di sistem operasinya, sama di semua browser. Lonjakannya ditangani penyaring di _look.
    try {
      const q = this.dom.requestPointerLock?.();
      if (q && q.catch) q.catch(() => this._lockError());
      else if (!this.dom.requestPointerLock) this._lockError();
    } catch { this._lockError(); }
    // ada halaman (mis. di dalam iframe) yang diam saja tanpa error: kalau belum terkunci dalam 0,7 detik, pakai cadangan
    clearTimeout(this._lockTimer);
    this._lockTimer = setTimeout(() => { if (!this.locked && !this.freeLook && this.active) this._lockError(); }, 700);
  }

  // dipakai tombol Esc: lepaskan kunci kamera dulu. true = Esc ini sudah terpakai, jangan keluar dari jalan kaki.
  releaseLook() {
    if (this.locked) { document.exitPointerLock?.(); return true; }
    if (this.freeLook) { this.freeLook = false; this._emit(); return true; }
    return performance.now() - this.unlockAt < 500;     // Esc yang barusan dipakai browser untuk melepas pointer lock
  }

  _emit() { this.onState?.({ flying: this.flying, fast: this.fast, locked: this.locked || this.freeLook }); }

  enter(pos, yaw) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.pitch = -0.08;
    this.vy = 0;
    this.flying = this.fast = false;
    this.grounded = true;
    this.groundRef = pos.y;
    this.active = true;
    document.activeElement?.blur?.();       // supaya Space tidak "menekan" tombol Jalan kaki yang masih fokus
    this.dom.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._up);
    this.dom.addEventListener('lostpointercapture', this._up);
    window.addEventListener('blur', this._blur);
    document.addEventListener('visibilitychange', this._vis);
    document.addEventListener('mouseout', this._leave);
    window.addEventListener('keydown', this._key);
    window.addEventListener('keyup', this._key);
    document.addEventListener('pointerlockchange', this._lockChange);
    document.addEventListener('pointerlockerror', this._lockError);
    this._emit();
    this.update(0);
  }

  exit() {
    this.active = false;
    this.keys = {};
    this.drag = null;
    this.flying = this.fast = this.freeLook = false;
    this.held = null;
    clearTimeout(this._lockTimer);
    if (this.locked) document.exitPointerLock?.();
    this.dom.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._up);
    this.dom.removeEventListener('lostpointercapture', this._up);
    window.removeEventListener('blur', this._blur);
    document.removeEventListener('visibilitychange', this._vis);
    document.removeEventListener('mouseout', this._leave);
    window.removeEventListener('keydown', this._key);
    window.removeEventListener('keyup', this._key);
    document.removeEventListener('pointerlockchange', this._lockChange);
    document.removeEventListener('pointerlockerror', this._lockError);
    this._emit();
  }

  // lantai di bawah kaki (anak tangga sampai STEP di atas kaki juga terhitung). Atap ikut dihitung sebagai pijakan,
  // jadi kalau terbang lalu turun di atas atap, kita mendarat dan bisa berjalan di atasnya (tidak jatuh menembus).
  _groundY() {
    this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + STEP + 0.15, this.pos.z), new THREE.Vector3(0, -1, 0));
    this.ray.far = 60;
    const g = this.ray.intersectObjects(this.world.walkables, false)[0];
    const r = this.world.roofs?.length ? this.ray.intersectObjects(this.world.roofs, true)[0] : null;
    // Sinar tidak mengenai pijakan apa pun (celah tipis di sambungan dua bidang, atau di luar kawasan). Dulu tingginya dianggap tanah
    // dasar (-0,2): di halaman/kantin yang lebih rendah pejalan tersentak naik 1-2 m lalu jatuh lagi. Sekarang saat berjalan tinggi
    // pijakan terakhir dipertahankan; saat terbang tanah dasar tetap jadi batas mendarat kalau kita di atasnya.
    const base = g ? g.point.y : (this.flying ? Math.min(-0.2, this.pos.y - 0.05) : this.groundRef);
    return Math.max(base, r ? r.point.y : -1e9);
  }

  // tinggi kaki tertinggi yang masih menyisakan ruang kepala di bawah plafon/lantai atas/atap
  _ceilLimit(target) {
    const from = this.pos.y + EYE * 0.5;
    this.ray.set(new THREE.Vector3(this.pos.x, from, this.pos.z), new THREE.Vector3(0, 1, 0));
    this.ray.far = Math.max(0.01, target + EYE + HEAD - from);
    const h = this.ray.intersectObjects(this.world.overhead || this.world.walkables, true)[0];
    return h ? Math.max(this.pos.y, h.point.y - EYE - HEAD) : target;
  }

  // Gerakan horizontal dengan "geser di sepanjang dinding" saat menabrak.
  _collide(move) {
    const len = move.length();
    if (len < 1e-6) return move;
    // tinggi sinar: lutut dan dada; saat melompat ditambah sinar setinggi pagar dari lantai terakhir (pagar tetap menahan);
    // saat terbang ditambah sinar setinggi pinggang dan kepala terhadap lantai/atap (pelat lantai tidak bisa ditembus).
    const rays = [[0.35, this.world.solids], [1.25, this.world.solids]];
    if (!this.grounded && !this.flying) {
      const d = this.groundRef - this.pos.y;
      rays.push([d + 0.35, this.world.solids], [d + 0.85, this.world.solids]);
    }
    if (this.flying) {
      const over = this.world.overhead || this.world.walkables;
      rays.push([0.1, over], [0.9, over], [EYE + 0.1, over]);
    }
    for (let pass = 0; pass < 2; pass++) {
      const dir = move.clone().normalize();
      let hitN = null;
      for (const [h, list] of rays) {
        this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + h, this.pos.z), dir);
        this.ray.far = move.length() + RADIUS;
        const hit = this.ray.intersectObjects(list, true)[0];
        // normal permukaan dibawa ke koordinat dunia (gedung bisa diputar di kawasan)
        if (hit && hit.face) { hitN = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); break; }
      }
      if (!hitN) return move;
      hitN.y = 0;
      if (hitN.lengthSq() < 1e-6) return new THREE.Vector3();
      hitN.normalize();
      if (hitN.dot(dir) > 0) hitN.negate();
      move.addScaledVector(hitN, -move.dot(hitN));     // buang komponen yang menembus dinding
      if (move.length() < 1e-5) return move;
    }
    return new THREE.Vector3();
  }

  update(dt) {
    if (!this.active) return;
    if (this.held && performance.now() - this.held.t > SPIKE_HOLD) this.held = null;   // lonjakan tunggal tanpa lanjutan
    const k = this.keys;
    const shift = k.shift || k.shiftl || k.shiftr;
    const fwd = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0);
    const str = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    const turn = (k.arrowleft ? 1 : 0) - (k.arrowright ? 1 : 0);
    this.yaw += turn * 1.8 * dt;

    const speed = this.flying ? (this.fast ? SPEED.terbangCepat : SPEED.terbang) : (shift ? SPEED.lari : SPEED.jalan);
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = f.multiplyScalar(fwd).add(r.multiplyScalar(str));
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
    this.pos.add(this._collide(move));

    const gy = this._groundY();
    if (this.flying) {
      // terbang: Space naik, Shift turun, tanpa gravitasi; mendarat (kembali jalan) begitu menyentuh lantai
      const vz = (k[' '] ? 1 : 0) - (shift ? 1 : 0);
      if (vz > 0) this.pos.y = this._ceilLimit(this.pos.y + vz * SPEED.naikTurun * dt);
      else if (vz < 0) this.pos.y = Math.max(gy, this.pos.y + vz * SPEED.naikTurun * dt);
      this.flyGrace = Math.max(0, (this.flyGrace || 0) - dt);
      if (gy >= this.pos.y - 0.01 && dt > 0 && (this.flyGrace === 0 || vz < 0)) {
        // permukaan sedikit di atas kaki (tepi atap/anak tangga): naik halus dulu, baru mendarat (dulu langsung meloncat sampai 0,7 m)
        if (gy - this.pos.y > 0.05) this.pos.y += (gy - this.pos.y) * smooth(14, dt);
        else {
          this.pos.y = gy;
          this.grounded = true;
          this.groundRef = gy;
          this._setFlying(false);
        }
      }
    } else if (gy >= this.pos.y - 0.02 && this.vy <= 0) {
      this.pos.y += (gy - this.pos.y) * smooth(14, dt);
      this.vy = 0;
      this.grounded = true;
      this.groundRef = gy;
    } else {
      this.grounded = false;
      // rumus gerak jatuh eksak (y = v·t - ½·g·t²), bukan langkah Euler: tinggi lompatan dan lintasan jatuh sama persis
      // di laptop 20 fps, monitor 60 Hz, maupun 165/200 Hz
      let ny = this.pos.y + this.vy * dt - 4.9 * dt * dt;
      this.vy -= 9.8 * dt;
      if (this.vy > 0) {
        const lim = this._ceilLimit(ny);              // kepala terbentur plafon: berhenti naik
        if (lim < ny) { ny = lim; this.vy = 0; }
      }
      // saat masih naik, permukaan di atas kaki (tepi lantai/anak tangga yang lebih tinggi) tidak langsung dipijak;
      // baru dipijak ketika sudah turun, jadi badan tidak tersentak naik di tengah lompatan
      const floorY = this.vy > 0 && gy > this.pos.y ? -Infinity : gy;
      this.pos.y = Math.max(floorY, ny);
      if (this.pos.y === gy && this.vy <= 0) { this.vy = 0; this.grounded = true; this.groundRef = gy; }
    }

    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
