// Mode jalan kaki (first-person): seret untuk menoleh, WASD / tombol panah untuk berjalan.
// Tabrakan memakai raycast: ke depan terhadap dinding/kolom/railing, ke bawah terhadap lantai/tangga.
import * as THREE from 'three';

const EYE = 1.6;          // tinggi mata (m)
const RADIUS = 0.3;       // jarak minimum badan ke dinding
const STEP = 0.55;        // tinggi maksimum yang bisa dinaiki dalam satu langkah (anak tangga 17 cm aman)

export class Walker {
  constructor(camera, dom, world) {
    this.camera = camera;
    this.dom = dom;
    this.world = world;               // { solids: Mesh[], walkables: Mesh[] }
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
    this.keys = {};
    this.active = false;
    this.ray = new THREE.Raycaster();
    this.drag = null;
    this._down = e => { this.drag = { x: e.clientX, y: e.clientY }; this.dom.setPointerCapture?.(e.pointerId); };
    this._move = e => {
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
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        this.keys[k] = on;
        e.preventDefault();
      }
    };
  }

  enter(pos, yaw) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.pitch = -0.08;
    this.vy = 0;
    this.active = true;
    this.dom.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('keydown', this._key);
    window.addEventListener('keyup', this._key);
    this.update(0);
  }

  exit() {
    this.active = false;
    this.keys = {};
    this.drag = null;
    this.dom.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('keydown', this._key);
    window.removeEventListener('keyup', this._key);
  }

  // Gerakan horizontal dengan "geser di sepanjang dinding" saat menabrak.
  _collide(move) {
    const len = move.length();
    if (len < 1e-6) return move;
    for (let pass = 0; pass < 2; pass++) {
      const dir = move.clone().normalize();
      let hitN = null;
      for (const h of [0.35, 1.25]) {        // setinggi lutut dan dada
        this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + h, this.pos.z), dir);
        this.ray.far = move.length() + RADIUS;
        const hit = this.ray.intersectObjects(this.world.solids, false)[0];
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

    const speed = k.shift ? 4.5 : 2.2;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = f.multiplyScalar(fwd).add(r.multiplyScalar(str));
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
    this.pos.add(this._collide(move));

    // cari lantai di bawah kaki (termasuk anak tangga)
    this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + STEP + 0.15, this.pos.z), new THREE.Vector3(0, -1, 0));
    this.ray.far = 40;
    const g = this.ray.intersectObjects(this.world.walkables, false)[0];
    const gy = g ? g.point.y : -0.2;
    if (gy >= this.pos.y - 0.02) {
      this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 14 + (dt === 0 ? 1 : 0));
      this.vy = 0;
    } else {
      this.vy -= 9.8 * dt;
      this.pos.y = Math.max(gy, this.pos.y + this.vy * dt);
      if (this.pos.y === gy) this.vy = 0;
    }

    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
