// Panel kiri: tab Gedung, Ruang, Tampilan, Referensi. Semua isi dibangkitkan dari data JSON.
import { ROOM_COLORS, FUNGSI, shortName } from './builder.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUMBER = { 'denah-2023': 'Denah 2023', 'koreksi-lapangan': 'Koreksi lapangan', 'footage-2026': 'Footage lapangan' };
const bukanDenah = src => src && src !== 'denah-2023';
const fmt = n => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

const ICON_FOCUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.5"/></svg>';
const ICON_SEARCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a8084" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

export function createUI(app) {
  let d = app.data;
  const st = app.state;
  const panel = document.getElementById('panel');
  const pill = document.getElementById('pill');
  const panes = Object.fromEntries([...panel.querySelectorAll('[data-pane]')].map(p => [p.dataset.pane, p]));
  let tab = 'gedung';
  let query = '';

  let rooms = [], nKelas = 0;
  // baca ulang gedung aktif (dipanggil saat berpindah gedung)
  function bind() {
    d = app.data;
    rooms = [...app.built.rooms.entries()];
    nKelas = rooms.filter(([, i]) => i.room.fungsi === 'kelas').length;
    query = '';
  }
  const ready = id => app.entries.find(e => e.meta.id === id);

  // ---------- Gedung ----------
  function resultsHTML() {
    const q = query.trim().toLowerCase();
    if (!q) {
      return `<div class="listhead"><span>Gedung & fasilitas</span><span>${app.kampus.gedung.length} lokasi</span></div>
      <ul class="list">${app.kampus.gedung.map(g => {
        const e = ready(g.id);
        const n = e ? (e.data.id === d.id ? `${rooms.length} ruang` : 'buka') : 'belum dibuat';
        return `<li><button ${e ? `data-building="${esc(g.id)}" class="${e.data.id === d.id ? 'on' : ''}"` : 'disabled'}>
          <span class="badge">${esc(g.id)}</span><span class="grow">${esc(g.nama)}</span><span class="n">${n}</span></button></li>`;
      }).join('')}</ul>`;
    }
    const hits = rooms.filter(([k, i]) => k.toLowerCase().includes(q) || i.room.nama.toLowerCase().includes(q)).slice(0, 30);
    if (!hits.length) return `<p class="under">Tidak ada ruang yang cocok dengan “${esc(query)}”.</p>`;
    return `<div class="listhead"><span>Hasil pencarian</span><span>${hits.length} ruang</span></div>
      <ul class="list">${hits.map(([k, i]) => roomRow(k, i, true)).join('')}</ul>`;
  }

  function renderGedung() {
    const opts = d.lantai.map(f => `<option value="${f.no}" ${st.mode === 'lantai' && st.floor === f.no ? 'selected' : ''}>Lantai ${f.no}</option>`).join('');
    panes.gedung.innerHTML = `
      <div class="bhead"><div class="badge big">${esc(d.id)}</div>
        <div><small>${esc(d.kategori)}</small><h2>${esc(d.nama)}</h2></div>
        <button class="iconbtn" data-act="reset" aria-label="Pusatkan kamera ke gedung">${ICON_FOCUS}</button></div>
      <p class="desc">${esc(d.deskripsi)}</p>
      <button class="btn" data-act="enter">Masuk gedung</button>
      <div class="row2"><button class="btn ghost" data-act="walk">Jalan kaki</button><button class="btn ghost" data-act="rooms">Daftar ruang</button></div>
      <div class="meta"><span>${d.lantai.length} lantai · ${rooms.length} ruang · bentang ${fmt(app.bbox.x1 - app.bbox.x0)} × ${fmt(app.bbox.z1 - app.bbox.z0)} m</span>
        <button class="link" data-act="ref">Rujukan</button></div>
      <label class="field"><span>Tampilkan</span>
        <select data-act="floor" aria-label="Pilih lantai"><option value="all" ${st.mode !== 'lantai' ? 'selected' : ''}>Semua lantai</option>${opts}</select></label>
      <div class="search">${ICON_SEARCH}<input type="search" id="q" placeholder="Cari ruang, mis. A201 atau gudang" aria-label="Cari ruang" value="${esc(query)}"></div>
      <div id="results">${resultsHTML()}</div>`;
  }

  // ---------- Ruang ----------
  function roomRow(k, i, withFloor = false) {
    const r = i.room;
    const kl = bukanDenah(r.sumber);
    return `<li><button data-room="${esc(k)}" class="${k === st.selectedRoom ? 'on' : ''}">
      <span class="code" title="${esc(shortName(k, r))}">${esc(r.fungsi === 'kelas' ? k : shortName(k, r))}</span>
      <span class="grow">${esc(r.fungsi === 'kelas' ? 'Ruang kelas' : r.nama)}<span class="sub">${withFloor ? `Lantai ${i.floor} · ` : ''}${fmt(i.area)} m²</span></span>
      <span class="dot ${kl ? 'kl' : ''}" title="${kl ? esc(SUMBER[r.sumber] || r.sumber) : ''}"></span></button></li>`;
  }

  function roomCard(k) {
    const i = app.built.rooms.get(k);
    if (!i) return '';
    const r = i.room;
    const xs = r.poligon.map(p => p[0]), zs = r.poligon.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), dp = Math.max(...zs) - Math.min(...zs);
    const kl = bukanDenah(r.sumber);
    return `<div class="rcard">
      <small style="color:var(--muted)">${esc(d.nama)} · Lantai ${i.floor}</small>
      <h3>${esc(r.fungsi === 'kelas' ? k : r.nama)}</h3><div class="nm">${esc(r.fungsi === 'kelas' ? r.nama : 'Kode data: ' + k)}</div>
      <dl class="kv">
        <dt>Fungsi</dt><dd>${esc(FUNGSI[r.fungsi] || r.fungsi)}</dd>
        <dt>Luas</dt><dd>${fmt(i.area)} m²</dd>
        <dt>Ukuran</dt><dd>${fmt(w)} × ${fmt(dp)} m</dd>
        <dt>Sumber</dt><dd><span class="tag ${kl ? 'kl' : ''}">${esc(SUMBER[r.sumber] || r.sumber)}</span></dd>
      </dl>
      ${r.catatan ? `<div class="note">${esc(r.catatan)}</div>` : ''}
      <div class="row2"><button class="btn ghost" data-act="focus">Fokus</button>
        <button class="btn" data-act="walkroom" ${r.void ? 'disabled' : ''}>Jalan ke sini</button></div>
    </div>`;
  }

  function renderRuang() {
    const f = st.mode === 'lantai' ? st.floor : (st.selectedRoom ? app.built.rooms.get(st.selectedRoom).floor : st.floor);
    const order = { kelas: 0, lab: 1, kantor: 2, organisasi: 3, ruang: 4, toilet: 5, gudang: 6, sirkulasi: 7, tangga: 8 };
    const list = rooms.filter(([, i]) => i.floor === f).sort((a, b) => (order[a[1].room.fungsi] - order[b[1].room.fungsi]) || a[0].localeCompare(b[0]));
    panes.ruang.innerHTML = `
      <div class="chips">${d.lantai.map(x => `<button data-floorchip="${x.no}" class="${x.no === f && st.mode === 'lantai' ? 'on' : ''}">Lantai ${x.no}</button>`).join('')}</div>
      ${st.selectedRoom ? roomCard(st.selectedRoom) : `<p class="under" style="text-align:left;margin:0 0 14px">Pilih ruang dari daftar atau klik lantainya di model. Titik oranye menandai data hasil koreksi lapangan.</p>`}
      <div class="listhead"><span>Lantai ${f}</span><span>${list.length} ruang</span></div>
      <ul class="list">${list.map(([k, i]) => roomRow(k, i)).join('')}</ul>`;
  }

  // ---------- Tampilan ----------
  const sw = (key, title, sub) => `<label class="toggle"><span>${title}${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="checkbox" class="switch" data-toggle="${key}" ${st[key] ? 'checked' : ''}></label>`;
  function renderTampilan() {
    const legend = st.colorBy === 'sumber'
      ? Object.entries(ROOM_COLORS.sumber).map(([k, c]) => `<span><i style="background:${c}"></i>${SUMBER[k]}</span>`).join('')
      : Object.entries(ROOM_COLORS.fungsi).map(([k, c]) => `<span><i style="background:${c}"></i>${FUNGSI[k]}</span>`).join('');
    panes.tampilan.innerHTML = `
      <div class="group"><h4>Sudut kamera</h4>
        <div class="seg">${[['iso', 'Isometrik'], ['atas', 'Atas'], ['depan', 'Depan']].map(([v, t]) => `<button data-view="${v}" class="${st.view === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="group"><h4>Lapisan</h4>
        ${sw('showRoof', 'Atap', 'Hanya terlihat di tampilan kawasan')}
        ${sw('showLabels', 'Label ruang', 'Kode ruang di mode lantai')}
        ${sw('showOverlay', 'Overlay denah asli', 'Garis denah 2023 ditempel di lantai untuk mengecek kesesuaian')}
        ${sw('shadows', 'Bayangan', 'Matikan kalau laptop terasa berat')}</div>
      <div class="group"><h4>Tinggi potongan dinding (mode lantai): <span id="cutv">${fmt(st.cut)} m</span></h4>
        <input type="range" min="0.6" max="3.85" step="0.05" value="${st.cut}" data-range="cut" aria-label="Tinggi potongan dinding"></div>
      <div class="group"><h4>Warna lantai ruang</h4>
        <div class="seg">${[['fungsi', 'Menurut fungsi'], ['sumber', 'Menurut sumber data']].map(([v, t]) => `<button data-colorby="${v}" class="${st.colorBy === v ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="legend">${legend}</div></div>`;
  }

  // ---------- Referensi ----------
  function renderReferensi() {
    const kl = [];
    let vents = 0;
    const lab = src => `<span class="tag kl">${esc(SUMBER[src] || src)}</span>`;
    for (const f of d.lantai) {
      for (const r of f.ruang) if (bukanDenah(r.sumber) && r.catatan) kl.push(`${lab(r.sumber)} <b>${esc(r.fungsi === 'kelas' ? r.kode : r.nama + ' (lt ' + f.no + ')')}</b>: ${esc(r.catatan)}`);
      for (const w of f.dinding) {
        if (bukanDenah(w.sumber) && w.catatan) kl.push(`${lab(w.sumber)} <b>Dinding lt ${f.no}</b>: ${esc(w.catatan)}`);
        for (const o of w.bukaan || []) if (o.jenis === 'ventilasi' && bukanDenah(o.sumber)) vents++;
      }
      const pg = (f.pagar || []).filter(p => bukanDenah(p.sumber) && p.catatan);
      const seen = new Set();
      for (const p of pg) if (!seen.has(p.catatan)) { seen.add(p.catatan); kl.push(`${lab(p.sumber)} <b>Pembatas lt ${f.no}</b>: ${esc(p.catatan)}`); }
    }
    if (vents) kl.push(`${lab('koreksi-lapangan')} <b>Ventilasi atas (${vents} jendela)</b>: sisi selasar ruang kelas tidak punya jendela besar, hanya jendela panjang gelap di atas yang bisa dibuka-tutup. Jendela besar hanya di dinding belakang.`);
    for (const t of d.tangga) if (bukanDenah(t.sumber)) kl.push(`${lab(t.sumber)} <b>Tangga lantai ${t.dariLantai} ke ${t.keLantai}</b>: ${esc(t.catatan)}`);
    for (const t of (d.tritisan || []).filter(t => t.lantai === 2)) if (bukanDenah(t.sumber)) kl.push(`${lab(t.sumber)} <b>Atap tritisan</b>: ${esc(t.catatan)}`);
    if ((Array.isArray(d.atap) ? d.atap : [d.atap]).some(a => bukanDenah(a.sumber))) kl.push(`${lab('koreksi-lapangan')} <b>Atap</b>: bentuk dan warna tidak ada di denah, mengikuti keterangan lapangan (perisai abu-abu gelap).`);
    panes.referensi.innerHTML = `<div class="ref">
      <div class="group"><h4>Denah asli yang dipakai</h4>
      ${d.lantai.filter(f => f.denah).map(f => `<figure><img src="${esc(f.denah.gambar)}" alt="Denah ${esc(d.nama)} lantai ${f.no}" loading="lazy">
        <figcaption>${esc(f.denah.keterangan)}</figcaption></figure>`).join('')}</div>
      <div class="group"><h4>Data di luar denah 2023 (${kl.length})</h4><ul>${kl.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="group"><h4>Tentang data</h4>
        ${Object.entries(d.sumberData).map(([k, v]) => `<p><span class="tag ${bukanDenah(k) ? 'kl' : ''}">${SUMBER[k] || k}</span> ${esc(v)}</p>`).join('')}
        <p>${esc(d.koordinat)}</p></div></div>`;
  }

  const renderers = { gedung: renderGedung, ruang: renderRuang, tampilan: renderTampilan, referensi: renderReferensi };

  function showTab(name) {
    tab = name;
    panel.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== name;
    renderers[name]();
    if (!st.panelOpen) togglePanel(true);
  }

  function update() {
    renderers[tab]();
    const crumb = st.mode === 'jalan' ? `${d.nama} · jalan kaki` : st.mode === 'lantai' ? `${d.nama} · Lantai ${st.floor}` : 'Jelajah kampus';
    document.getElementById('crumb').textContent = crumb;
    document.getElementById('pillCrumb').textContent = crumb;
    document.getElementById('status').textContent = `${d.nama} · ${nKelas} ruang kelas · ${rooms.length} ruang terdata`;
  }

  function togglePanel(open) {
    panel.hidden = !open;
    pill.hidden = open;
    app.togglePanel(open);
  }

  // ---------- event ----------
  panel.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  document.getElementById('collapse').addEventListener('click', () => togglePanel(false));
  pill.addEventListener('click', () => togglePanel(true));
  document.getElementById('toKawasan').addEventListener('click', () => { app.overview(); showTab('gedung'); });

  const body = panel.querySelector('.pbody');
  body.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.room) return app.selectRoom(t.dataset.room, { focus: true });
    if (t.dataset.building) return t.dataset.building === d.id ? showTab('gedung') : app.switchBuilding(t.dataset.building);
    if (t.dataset.floorchip) return app.setFloor(+t.dataset.floorchip);
    if (t.dataset.view) return app.setView(t.dataset.view);
    if (t.dataset.colorby) return app.set('colorBy', t.dataset.colorby);
    switch (t.dataset.act) {
      case 'enter': return app.enterBuilding();
      case 'walk': return app.walk(null);
      case 'rooms': return showTab('ruang');
      case 'ref': return showTab('referensi');
      case 'reset': return app.selectBuilding(d.id);
      case 'building': return showTab('gedung');
      case 'focus': return st.selectedRoom && app.focusRoom(st.selectedRoom);
      case 'walkroom': return st.selectedRoom && app.walk(st.selectedRoom);
    }
  });
  body.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.act === 'floor') app.setFloor(t.value === 'all' ? null : +t.value);
    if (t.dataset.toggle) app.set(t.dataset.toggle, t.checked);
  });
  body.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') { query = t.value; document.getElementById('results').innerHTML = resultsHTML(); }
    if (t.dataset.range === 'cut') {
      st.cut = +t.value;
      document.getElementById('cutv').textContent = fmt(st.cut) + ' m';
      app.setCut(st.cut);
    }
  });

  bind();
  return { update, showTab, togglePanel, bind };
}
