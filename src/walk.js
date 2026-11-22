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
const LOOK = 0.0025;      // kepekaan mouse saat kamera terkunci (radian per piksel)

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
    this.lastTap = { ' ': -1e9, w: -1e9 };

    this._down = e => {
      if (this.locked || this.freeLook) return;
      this.drag = { x: e.clientX, y: e.clientY };
      this.dom.setPointerCapture?.(e.pointerId);
    };
    this._move = e => {
      if (this.locked || this.freeLook) {
        this.yaw -= (e.movementX || 0) * LOOK;
        this.pitch = THREE.MathUtils.clamp(this.pitch - (e.movementY || 0) * LOOK, -1.3, 1.3);
        return;
      }
      if (!this.drag) return;
      this.yaw -= (e.clientX - this.drag.x) * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.drag.y) * 0.004, -1.3, 1.3);
      this.drag = { x: e.clientX, y: e.clientY };
    };
    this._up = () => { this.drag = null; };
    this._key = e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const on = e.type === 'keydown';
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(k)) {
        this.keys[k] = on;
        e.preventDefault();               // Space tidak menggulir halaman / menekan tombol yang sedang fokus
      }
      if (on && !e.repeat) this._press(k);
      if (!on && (k === 'w' || k === 'arrowup')) this._setFast(false);
    };
    this._lockChange = () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.dom;
      if (this.locked) this.freeLook = false;
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
    } else if (k === 'q') {
      this.toggleLock();
    }
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
    try {
      const p = this.dom.requestPointerLock?.();
      if (p && p.catch) p.catch(() => this._lockError());
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
    clearTimeout(this._lockTimer);
    if (this.locked) document.exitPointerLock?.();
    this.dom.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
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
    return Math.max(g ? g.point.y : -0.2, r ? r.point.y : -1e9);
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
    const k = this.keys;
    const fwd = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0);
    const str = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    const turn = (k.arrowleft ? 1 : 0) - (k.arrowright ? 1 : 0);
    this.yaw += turn * 1.8 * dt;

    const speed = this.flying ? (this.fast ? SPEED.terbangCepat : SPEED.terbang) : (k.shift ? SPEED.lari : SPEED.jalan);
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = f.multiplyScalar(fwd).add(r.multiplyScalar(str));
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
    this.pos.add(this._collide(move));

    const gy = this._groundY();
    if (this.flying) {
      // terbang: Space naik, Shift turun, tanpa gravitasi; mendarat (kembali jalan) begitu menyentuh lantai
      const vz = (k[' '] ? 1 : 0) - (k.shift ? 1 : 0);
      if (vz > 0) this.pos.y = this._ceilLimit(this.pos.y + vz * SPEED.naikTurun * dt);
      else if (vz < 0) this.pos.y = Math.max(gy, this.pos.y + vz * SPEED.naikTurun * dt);
      this.flyGrace = Math.max(0, (this.flyGrace || 0) - dt);
      if (gy >= this.pos.y - 0.01 && dt > 0 && (this.flyGrace === 0 || vz < 0)) {
        this.pos.y = gy;
        this.grounded = true;
        this.groundRef = gy;
        this._setFlying(false);
      }
    } else if (gy >= this.pos.y - 0.02 && this.vy <= 0) {
      this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 14 + (dt === 0 ? 1 : 0));
      this.vy = 0;
      this.grounded = true;
      this.groundRef = gy;
    } else {
      this.grounded = false;
      this.vy -= 9.8 * dt;
      let ny = this.pos.y + this.vy * dt;
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
