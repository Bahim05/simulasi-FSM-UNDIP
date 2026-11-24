# Alat bantu penyusun data Gedung F (bukan bagian aplikasi). Hasilnya data/gedung-f.json.
#
# Gedung F belum punya footage. Bentuk dari denah Gedung F LT.1-LT.3 dan foto udara pengguna (22 Nov 2026):
# "sayap lurus" denah 30,28 x 10 m (R. Seminar / Lab) dan "sayap miring" denah 30 derajat (R. Dosen; dinding belakang
# 25,6 m, dinding depan 28,8 m, dalam 10 m), selasar 2,8 m di sisi dalam sudut, tangga di pertemuan dua sayap dan
# tangga luar di ujung sayap R. Dosen. Atap genteng kemerahan hanya menutup ruang; selasar lantai 3 diberi atap sandar.
#
# ORIENTASI: denah dipakai apa adanya (TIDAK dicerminkan) lalu seluruh gedung diputar -30 derajat di kampus.json.
# Hasilnya sayap R. Dosen (miring di denah) sejajar Gedung A dan B di barat, dengan tangga luar di ujung baratnya
# (sesuai ingatan pengguna, 22 Nov 2026), dan sayap R. Seminar/Lab belok 30 derajat ke tenggara (arah belokan sesuai
# foto udara). Versi sebelumnya mencerminkan denah; ditinggalkan karena letak tangga jadi terbalik.
#
# Koordinat gedung = koordinat denah: (0,0) = sudut luar pertemuan dua dinding belakang; x sepanjang sayap lurus denah,
# z dari dinding belakang ke arah selasar.
import json, math, os

D, UD, PR = "denah-gedung-f", "foto-udara-2026", "perkiraan"
H, SLAB = 4.0, 0.15
ELEV = {1: 0.0, 2: 4.0, 3: 8.0}     # perkiraan: lantai 1 setinggi Gedung A (sebaris dengan A); belum dicek di lapangan
TOP = ELEV[3] + H + SLAB
EXT, INT = 0.2, 0.15
KI, KS = 0.1, 0.25                  # muka luar kolom rata dinding; kolom tepi selasar 0,25 m di dalam tepi
DR, SW = 10.0, 2.8                  # dalam ruang, lebar selasar
LS = 30.28                          # panjang sayap lurus (denah: 828 + 200 + 300 + 350 + 1350)
AB, AF = 25.6, 28.8                 # dinding belakang dan dinding depan sayap miring
ANG = math.radians(30)
d = (-math.cos(ANG), math.sin(ANG))  # arah sayap miring (denah)
n = (math.sin(ANG), math.cos(ANG))   # ke arah selasar sayap miring (denah)
def r2(v): return round(v, 3)
def pt(p): return [r2(p[0]), r2(p[1])]
def rect(x0, z0, x1, z1): return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
def WP(a, b): return (a * d[0] + b * n[0], a * d[1] + b * n[1])     # titik sayap miring: a sepanjang sayap dari (0,0), b ke selasar
J0 = (0.0, 0.0)
def dist(a, b): return math.hypot(b[0] - a[0], b[1] - a[1])
def add(p, dv, t): return (p[0] + dv[0] * t, p[1] + dv[1] * t)
E0, E1 = WP(AB, 0), WP(AB, DR)
A_FJ = AB - AF                       # a ujung dinding depan sayap miring di pertemuan (-3,2)
FJ = WP(A_FJ, DR)
X_KM0, X_KM1, Z_KM = 8.28, 10.28, 5.55   # toilet di pertemuan (denah: 828, 200)
X_TG1 = 13.28                        # dinding barat R. Kerja = sisi timur ruang tangga (denah: 300)
Z_GD = 4.5                           # dinding depan gudang di belakang bordes (perkiraan)
X_R = {1: 16.78, 2: 17.48, 3: 16.78}  # sekat dua ruang sayap lurus (lt 1: 350, lt 2: 420, lt 3: 350)
# tangga pertemuan (denah, belum dicerminkan): lajur sejajar z, naik dari sisi selasar ke bordes di depan gudang
TJ = {"x0": 13.18, "x1": 10.38, "zDepan": 9.9, "zBelakang": 4.6}
# tangga luar di ujung sayap miring: di bingkai sayap (a, b), lajur sejajar dinding ujung, 2,8 m di luar dinding ujung
TE = {"x0": AB + 0.1, "x1": AB + 2.8, "zDepan": 11.0, "zBelakang": 6.0}
OUT = [J0, (LS, 0), (LS, DR), (X_TG1, DR), (X_TG1, Z_GD), (X_KM1, Z_GD), (X_KM1, Z_KM), (X_KM0, Z_KM), FJ, E1, E0]

def inside(poly, x, z):
    c = False
    for i in range(len(poly)):
        (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % len(poly)]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            c = not c
    return c

def inward(poly, a, b):
    """Normal satuan tepi a-b yang mengarah ke dalam poligon."""
    L = dist(a, b)
    nx, nz = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
    mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    return (nx, nz) if inside(poly, mx + nx * 0.05, mz + nz * 0.05) else (-nx, -nz)

def on_seg(p, a, b, tol=0.03):
    L = dist(a, b)
    t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L
    if t < -tol or t > L + tol:
        return None
    qx, qz = a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L
    return t if math.hypot(p[0] - qx, p[1] - qz) < tol else None

def edges(poly):
    return [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]

def inset(poly, p):
    """Geser kolom di tepi luar ke dalam supaya muka luarnya rata dengan muka luar dinding."""
    ox = oz = 0.0
    for a, b in edges(poly):
        if on_seg(p, a, b) is not None:
            nx, nz = inward(poly, a, b)
            ox += nx * KI
            oz += nz * KI
    return [r2(p[0] + ox), r2(p[1] + oz)]

# ---------- bukaan ----------
def door(t, lebar=0.9, ruang=None, ganda=False, teks=None, kaca=False, src=D):
    o = {"jenis": "pintu-ganda" if ganda else "pintu", "t": r2(t), "lebar": lebar, "tinggi": 2.4 if ganda else 2.2,
         "boven": 0.5, "sumber": src}
    if ruang:
        o["ruang"] = ruang
    if teks:
        o["papanNama"], o["papanTeks"] = True, teks
    if kaca:
        o["warnaDaun"], o["lisKaca"], o["pegangan"] = "#6f8790", True, True
    return o

def W(id_, a, b, bukaan=(), luar=False, tebal=None, **kw):
    w = {"id": id_, "a": pt(a), "b": pt(b), "tebal": tebal or (EXT if luar else INT), "bukaan": list(bukaan), "sumber": kw.pop("sumber", D)}
    if luar:
        w["luar"] = True
    w.update(kw)
    return w

def room_at(rooms, x, z):
    for r in rooms:
        if inside(r["poligon"], x, z):
            return r
    return None

def exterior(no, poly, rooms, inner_walls, cols, doors=None, skip=None, extra=None):
    """Dinding luar dari poligon tepi lantai. Jendela diisi otomatis di celah antara kolom, sekat, dan pintu;
    jenis jendela mengikuti ruang di baliknya (toilet/gudang = jendela tinggi kecil)."""
    doors, skip, extra = doors or {}, skip or {}, extra or {}
    out = []
    for i, (a, b) in enumerate(edges(poly)):
        key = (pt(a)[0], pt(a)[1], pt(b)[0], pt(b)[1])
        L = dist(a, b)
        ux, uz = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        nx, nz = inward(poly, a, b)
        ds = doors.get(key, [])
        blocked = [(-9, 0.45), (L - 0.45, L + 9)]
        for c in cols:
            t = on_seg((c[0] - nx * KI, c[1] - nz * KI), a, b, 0.12)
            if t is not None:
                blocked.append((t - 0.45, t + 0.45))
        for w in inner_walls:
            for e in (w["a"], w["b"]):
                t = on_seg(e, a, b, 0.05)
                if t is not None:
                    blocked.append((t - 0.35, t + 0.35))
        blocked += [(d["t"] - d["lebar"] / 2 - 0.3, d["t"] + d["lebar"] / 2 + 0.3) for d in ds]
        blocked += [(t0, t1) for t0, t1 in skip.get(key, [])]
        blocked += [(t0, t1) for t0, t1 in extra.get(key, [])]
        blocked.sort()
        free, cur = [], 0.0
        for s, e in blocked:
            if s > cur:
                free.append((cur, min(s, L)))
            cur = max(cur, e)
        ops = list(ds)
        for s, e in free:
            if e - s < 1.1:
                continue
            tm = (s + e) / 2
            r = room_at(rooms, a[0] + ux * tm + nx * 0.6, a[1] + uz * tm + nz * 0.6)
            kecil = r is not None and r["fungsi"] in ("toilet", "gudang")
            if kecil:
                ops.append({"jenis": "jendela-tinggi", "t": r2(tm), "lebar": r2(min(1.2, e - s - 0.3)), "ambang": 1.9, "tinggi": 0.6})
            elif r is not None and r["fungsi"] == "tangga":
                ops.append({"jenis": "jendela", "t": r2(tm), "lebar": r2(min(1.6, e - s - 0.4)), "ambang": 1.6, "tinggi": 1.4})
            else:
                ops.append({"jenis": "jendela", "t": r2(tm), "lebar": r2(min(2.2, e - s - 0.4)), "ambang": 0.9, "tinggi": 1.7})
        # bagian yang terbuka tidak diberi dinding: pecah tepi menjadi beberapa dinding
        spans, cur = [], 0.0
        for t0, t1 in sorted(skip.get(key, [])):
            if t0 > cur:
                spans.append((cur, t0))
            cur = max(cur, t1)
        if cur < L:
            spans.append((cur, L))
        for j, (s, e) in enumerate(spans):
            pa, pb = add(a, (ux, uz), s), add(a, (ux, uz), e)
            mine = [dict(o, t=r2(o["t"] - s)) for o in ops if s <= o["t"] <= e]
            out.append(W(f"F{no}-luar-{i}" + (f"-{j}" if len(spans) > 1 else ""), pa, pb, mine, luar=True))
    return out

def room(kode, nama, fungsi, poly, src=D, **kw):
    r = {"kode": kode, "nama": nama, "fungsi": fungsi, "poligon": [pt(p) for p in poly], "sumber": src}
    r.update(kw)
    return r


# ---------- kolom (koordinat denah) ----------
X_BACK = [0, 3.84, 7.07, 10.28, 13.28, 17.3, 20.55, 23.8, 27.05, LS]       # dinding belakang sayap lurus (denah)
X_FRONT = [13.28, 17.3, 20.55, 23.8, 27.05, LS]
X_SEL = [14.3, 17.5, 20.6, 23.8, 27.0]
A_BACK = [3.2 * k for k in range(9)]                                         # sayap miring, tiap 3,2 m
A_FRONT = [A_FJ + 3.2 * k for k in range(10)]

def columns():
    pts = [(x, 0) for x in X_BACK] + [(x, DR) for x in X_FRONT] + [(LS, 3.6), (LS, 6.75)]
    pts += [WP(a, 0) for a in A_BACK] + [WP(a, DR) for a in A_FRONT] + [WP(AB, 3.33), WP(AB, 6.67)]
    out, seen = [], set()
    for p in pts:
        k = (round(p[0], 2), round(p[1], 2))
        if k not in seen:
            seen.add(k)
            out.append(inset(OUT, p))
    return out

def sel_columns():
    # kolom tepi selasar, 0,25 m di dalam tepi
    return [[r2(x), r2(DR + SW - KS)] for x in X_SEL] + [[r2(LS - KS), r2(DR + SW - KS)]] + [pt(WP(a, DR + SW - KS)) for a in A_FRONT]

COLS = columns()
COLS_SEL = sel_columns()

def sel_poly(no):
    mid = [(X_KM1, Z_GD), (X_TG1, Z_GD)] if no == 1 else [(X_KM1, TJ["zDepan"]), (X_TG1, TJ["zDepan"])]
    return [pt(p) for p in [E1, FJ, (X_KM0, Z_KM), (X_KM1, Z_KM), *mid, (X_TG1, DR), (LS, DR), (LS, DR + SW), (X_TG1, DR + SW),
                            WP(A_FJ, DR + SW), WP(AB + 2.8, DR + SW), WP(AB + 2.8, TE["zDepan"]), WP(AB, TE["zDepan"])]]

ROOMS = {
    1: [("KRJ", "R. Kerja / R. Hukum S2 Matematika", "kantor"), ("SEM", "R. Seminar / R. Sidang S2 dan Departemen Matematika", "rapat")],
    2: [("TRP", "R. Terapan & Analisis", "kantor"), ("LAB", "Lab Komputasi", "lab")],
    3: [("TKN", "R. Teknisi Laboratorium Komputasi", "kantor"), ("BACA", "R. Baca", "perpustakaan")],
}
DOSEN = {1: "R. Dosen 1", 2: "R. Dosen 2", 3: "R. Dosen 3"}
HIM = [WP(22.4, 6.8), WP(22.4, DR), WP(AB, DR), WP(AB, 6.8)]

def lantai(no):
    p = f"F{no}"
    xr = X_R[no]
    (k1, n1, f1), (k2, n2, f2) = ROOMS[no]
    dos = [J0, (X_KM0, 0), (X_KM0, Z_KM), FJ, E1, E0] if no < 3 else [J0, (X_KM0, 0), (X_KM0, Z_KM), FJ, HIM[1], HIM[0], HIM[3], E0]
    rooms = [
        room(f"{p}-DSN", DOSEN[no], "kantor", dos, catatan="Seluruh sayap miring satu ruang dosen (denah)."),
        room(f"{p}-KM", "KM/WC", "toilet", rect(X_KM0, 0, X_KM1, Z_KM)),
        room(f"{p}-GD", "Gudang", "gudang", rect(X_KM1, 0, X_TG1, Z_GD), src=PR, catatan="Petak di belakang tangga pertemuan; denah tidak menggambar isinya."),
        room(f"{p}-{k1}", n1, f1, rect(X_TG1, 0, xr, DR)),
        room(f"{p}-{k2}", n2, f2, rect(xr, 0, LS, DR)),
    ]
    if no == 3:
        rooms.append(room(f"{p}-HMS", "R. Himpunan Mahasiswa Statistika", "kantor", HIM))
    walls = [
        W(f"{p}-dosen-km", (X_KM0, 0), (X_KM0, Z_KM), []),
        W(f"{p}-km-gudang", (X_KM1, 0), (X_KM1, Z_GD), []),
        W(f"{p}-gudang-{k1}", (X_TG1, 0), (X_TG1, Z_GD), [door(2.25, 0.8, f"{p}-GD", teks="Gudang", src=PR)]),
        W(f"{p}-{k1}-{k2}", (xr, 0), (xr, DR), []),
    ]
    if no == 3:
        walls += [W(f"{p}-him-sisi", HIM[1], HIM[0], []), W(f"{p}-him-belakang", HIM[0], HIM[3], [])]
    dos_doors = [1.2, 5.0, 11.2, 26.8] if no < 3 else [1.2, 5.0, 11.2, 20.0]
    fd = [door(t, 1.0, f"{p}-DSN", teks=DOSEN[no] if t == 11.2 else None) for t in dos_doors]
    if no == 3:
        fd.append(door(27.2, 0.9, f"{p}-HMS", teks="Himpunan Statistika"))
    ext_doors = {
        tuple(pt(FJ) + pt(E1)): fd,
        (LS, DR, X_TG1, DR): [door(LS - xr - 1.0 if no == 2 else 1.98, 1.4, f"{p}-{k2}", ganda=True, teks=n2.split(" / ")[0]),
                              door(LS - xr - 4.5 if no != 2 else LS - xr - 7.0, 1.4, f"{p}-{k2}", ganda=True),
                              door(LS - X_TG1 - 0.62, 0.9, f"{p}-{k1}", teks=n1.split(" / ")[0])],
        (X_KM1, Z_KM, X_KM0, Z_KM): [door(1.0, 0.8, f"{p}-KM", teks="KM/WC")],
    }
    extra = {(X_TG1, DR, X_TG1, Z_GD): [(0, 9)], (X_TG1, Z_GD, X_KM1, Z_GD): [(0, 9)], (X_KM1, Z_GD, X_KM1, Z_KM): [(0, 9)]}
    walls += exterior(no, OUT, rooms, walls, COLS, ext_doors, extra=extra)
    rails = []
    if no > 1:
        dy, tb = -0.05, {"jenis": "tembok-celah", "tinggi": 0.9, "sumber": "foto-2026", "catatan": "Tembok pembatas putih bercelah tegak (foto 23 Nov 2026)."}
        e = DR + SW - 0.1
        rails += [{"a": [LS - 0.1, DR + 0.1, dy], "b": [LS - 0.1, e, dy], **tb},
                  {"a": [LS - 0.1, e, dy], "b": [X_TG1, e, dy], **tb},
                  {"a": [X_TG1, e, dy], "b": pt(WP(A_FJ, e)) + [dy], **tb},
                  {"a": pt(WP(A_FJ, e)) + [dy], "b": pt(WP(AB + 2.7, e)) + [dy], **tb},
                  {"a": pt(WP(AB + 2.7, e)) + [dy], "b": pt(WP(AB + 2.7, TE["zDepan"])) + [dy], **tb}]
    if no == 3:
        mj = (TJ["x0"] + TJ["x1"]) / 2
        rails += [{"a": [r2(mj - 0.06), TJ["zDepan"] - 0.05, 0], "b": [TJ["x0"], TJ["zDepan"] - 0.05, 0], "jenis": "besi", "sumber": PR,
                   "catatan": "Tepi lubang tangga pertemuan."},
                  {"a": pt(WP(TE["x0"], TE["zDepan"] - 0.05)) + [-0.05], "b": pt(WP((TE["x0"] + TE["x1"]) / 2 + 0.06, TE["zDepan"] - 0.05)) + [-0.05],
                   "jenis": "besi", "sumber": PR, "catatan": "Tepi lubang tangga luar."}]
    return {
        "no": no, "elevasi": ELEV[no], "elevasiSelasar": r2(ELEV[no] - 0.05), "tinggiPlafon": H if no == 3 else H - SLAB,
        "denah": {"gambar": f"assets/denah/F{no}.jpg", "batas": DB,
                  "keterangan": f"Denah Gedung F lantai {no}, diluruskan ke skala 30 px per meter."},
        "ruang": rooms, "dinding": walls, "selasar": {"poligon": sel_poly(no)}, "pagar": rails,
    }

DB = [-27.0, -3.0, 32.0, 28.0]

FLOORS = [lantai(no) for no in (1, 2, 3)]
C_REAL = [pt(q) for q in [J0, (LS, 0), (LS, DR), (2.68, DR), E1, E0]]   # plafon lt 3 di bawah atap sayap lurus (denah)

def trit(a, b, sisi, no, lebar=3.7, sudutA=None, sudutB=None, catatan=None):
    """Atap tingkat bawah di ketinggian plafon lt 3 (di bawah atap utama, menutup selasar lt 3 dan tangga ujung barat)."""
    t = {"a": pt(a), "b": pt(b), "sisi": sisi, "elevasi": ELEV[3] + H, "lantai": no, "lebar": lebar, "turun": 0.8 * lebar / 3.7, "jarak": 0.1,
         "sumber": "foto-2026", "catatan": catatan or "Atap tingkat bawah di atas selasar lt 3 (foto 23 Nov 2026)."}
    if sudutA: t["sudutA"] = sudutA
    if sudutB: t["sudutB"] = sudutB
    return t

def sudut_belok(p, q, r):
    """Besar belokan (derajat) di q untuk jalur p -> q -> r."""
    u1 = (q[0] - p[0], q[1] - p[1]); u2 = (r[0] - q[0], r[1] - q[1])
    cosv = (u1[0] * u2[0] + u1[1] * u2[1]) / (math.hypot(*u1) * math.hypot(*u2))
    return math.degrees(math.acos(max(-1, min(1, cosv))))

def trit_lantai(no):
    """Tritisan genteng di tepi luar selasar setinggi lantai `no` (di bawah tembok pembatas), seperti di foto: menerus dari
    dinding ujung barat (sebelah bordes tangga luar) sampai ujung tenggara, tidak membungkus ujung barat karena ada tangga."""
    e = DR + SW
    P = [WP(AB, e), WP(A_FJ, e), (X_TG1, e), (LS + 0.2, e)]
    s1, s2 = sudut_belok(*P[0:3]), sudut_belok(*P[1:4])          # belok ke dalam (sudut dalam) lalu ke luar
    base = {"sisi": 1, "elevasi": ELEV[no], "lantai": no, "lebar": 1.6, "turun": 0.65, "jarak": 0.02, "sumber": "foto-2026",
            "catatan": f"Tritisan di bawah tembok pembatas selasar lt {no} (foto 23 Nov 2026)."}
    return [{**base, "a": pt(P[0]), "b": pt(P[1]), "sudutB": r2(-s1)},
            {**base, "a": pt(P[1]), "b": pt(P[2]), "sudutA": r2(-s1), "sudutB": r2(s2)},
            {**base, "a": pt(P[2]), "b": pt(P[3]), "sudutA": r2(s2)}]

data = {
    "schema": "fsm-gedung@1",
    "id": "F",
    "nama": "Gedung F",
    "kategori": "Ruang dosen dan laboratorium",
    "deskripsi": "Gedung tiga lantai di timur Gedung A dan utara Gedung B, berbentuk siku: sayap ruang dosen sejajar A dan B di barat, "
                 "lalu sayap R. Seminar / Lab belok 30 derajat menuju tenggara; selasar di sisi dalam menghadap halaman ke Gedung B. "
                 "Sayap barat berisi ruang dosen di tiap lantai; sayap tenggara berisi R. Seminar / R. Sidang (lt 1), Lab Komputasi (lt 2), "
                 "dan R. Baca (lt 3). Tangga di pertemuan dua sayap dan tangga luar di ujung barat.",
    "sumberData": {
        D: "Denah Gedung F LT.1 sampai LT.3, skala 1:150 (folder Denah Gedung FSM/Terklasifikasi/Gedung F). Dipakai apa adanya, gedung diputar -30 derajat.",
        UD: "Foto udara pengguna (22 Nov 2026): letak di utara B dan timur A, atap genteng kemerahan, sayap yang serong menuju tenggara.",
        "ingatan-pengguna": "Pengguna (22 Nov 2026): tangga luar ada di ujung kiri (barat) sayap ruang dosen.",
        "foto-2026": "Foto pengguna 23 Nov 2026 (dari arah Gedung B): ujung barat dengan tangga luar terbuka bertembok pembatas, atap utama bergevel berkisi, atap tingkat bawah membungkus ujung barat, tritisan genteng di tepi selasar tiap lantai, tembok pembatas putih bercelah, kolom abu kebiruan.",
        PR: "Perkiraan tanpa footage: tinggi lantai 1, jendela, letak pintu kecil, gudang di belakang tangga, susunan tangga.",
    },
    "koordinat": "Meter, sama dengan denah: (0,0) = sudut luar pertemuan dinding belakang dua sayap, x sepanjang sayap lurus denah (R. Seminar), "
                 "z dari dinding belakang ke arah selasar. Di kampus.json gedung diputar -30 derajat, jadi sayap R. Dosen mengarah ke barat "
                 "dan sayap R. Seminar ke tenggara. y ke atas dalam sistem kawasan (0 = lantai 1 Gedung A).",
    "ukuran": {"panjangSayapLurus": LS, "dindingBelakangSayapMiring": AB, "dindingDepanSayapMiring": AF, "kedalamanRuang": DR, "lebarSelasar": SW,
               "sudutSayap": 30, "tinggiLantai": H, "tebalPelat": SLAB},
    "tampilan": {"dinding": "#e6e5df", "dindingDalam": "#ecebe6", "kolom": "#a9b3c0", "lantai": "#e6e1d7",
                 "selasar": "#cdccc6", "atap": "#84473a", "kusen": "#3b464d", "pintu": "#7a3f2c", "pagar": "#b9c1cb"},
    # kolom tepi selasar di lantai 3 berhenti di bawah atap sandar (atap utama tidak menutup selasar)
    "kolom": {"ukuran": 0.4, "dasar": -0.2, "puncak": TOP - 0.15, "titik": COLS,
              "tambahan": [{"titik": COLS_SEL, "lantai": [1, 2]},
                           {"titik": COLS_SEL, "lantai": [3, 3], "puncak": 11.3, "catatan": "Di bawah atap sandar selasar lt 3."}]},
    "lantai": FLOORS,
    "tangga": [
        {"id": f"TJ{f}", "dariLantai": f, "keLantai": f + 1, "x0": TJ["x0"], "x1": TJ["x1"], "zDepan": TJ["zDepan"], "zBelakang": TJ["zBelakang"],
         "jumlahAnakTangga": 24, "lebarInjakan": 0.28, "bentuk": "U dengan bordes", "dindingBelakang": True, "sisiLuar": "pagar", "sumber": D,
         "catatan": "Tangga di pertemuan dua sayap (denah: celah 3 m di antara KM/WC dan R. Kerja), naik dari selasar."}
        for f in (1, 2)] + [
        # bingkai sayap R. Dosen: sumbu x lokal = arah dari ujung sayap ke pertemuan (titik WP(a, b) = (-a, b)), lalu diputar +30 derajat
        {"id": f"TL{f}", "dariLantai": f, "keLantai": f + 1, "x0": -TE["x0"], "x1": -TE["x1"], "zDepan": TE["zDepan"], "zBelakang": TE["zBelakang"],
         "putar": 30, "jumlahAnakTangga": 24, "lebarInjakan": 0.28, "bentuk": "U dengan bordes", "belakang": "tembok", "sisiLuar": "tembok", "pembatas": "tembok", "gaya": "krem",
         "sumber": D, "catatan": "Tangga luar di ujung sayap R. Dosen (denah: lebar 2,8 m), lajur sejajar dinding ujung. Disusun di bingkai sayap lalu diputar 30 derajat."}
        for f in (1, 2)],
    # atap tingkat bawah: selasar kedua sayap (lebar 3,7), ujung barat di atas tangga luar (3,7), sisi belakang dan ujung tenggara
    # lebih sempit (1,5; tidak terlihat di foto, perkiraan). Tritisan lantai 2 dan 3 di tepi luar selasar.
    "tritisan": [trit((9.2, DR), (LS + 0.2, DR), 1, 3),
                 trit(FJ, E1, -1, 3, sudutB=90),
                 trit(E1, E0, -1, 3, sudutA=90, catatan="Atap tingkat bawah membungkus ujung barat, menaungi tangga luar (foto 23 Nov 2026)."),
                 trit(E0, J0, -1, 3, lebar=1.5, sudutB=30, catatan="Atap tingkat bawah sisi belakang (perkiraan)."),
                 trit(J0, (LS, 0), -1, 3, lebar=1.5, sudutA=30, sudutB=90, catatan="Atap tingkat bawah sisi belakang (perkiraan)."),
                 trit((LS, 0), (LS, DR), -1, 3, lebar=1.5, sudutA=90, catatan="Atap tingkat bawah ujung tenggara (perkiraan).")]
                + trit_lantai(2) + trit_lantai(3),
    # Atap utama: dua atap perisai (sayap lurus dan sayap miring denah) dipotong di garis bagi sudut pertemuan, seperti Gedung E.
    "atap": [
        {"jenis": "perisai", "asal": [0, 0], "sudut": 0, "batas": [-6.0, 0, LS, DR], "tepiBawah": TOP, "tonjolan": 0.9, "kemiringan": 30,
         "potong": [{"a": [0, 0], "b": [2.68, DR], "simpan": [10, 5], "jurai": True}], "plafonPoligon": [C_REAL],
         "gablet": {"ujung": [1], "lebar": 2.6},
         "sumber": UD, "catatan": "Sayap R. Seminar / Lab (lurus di denah, serong ke tenggara di kampus)"},
        # sumbu x lokal ke arah pertemuan (sudut -30), jadi sayap R. Dosen ada di x lokal negatif
        {"jenis": "perisai", "asal": [0, 0], "sudut": -30, "batas": [-AB, 0, 6.0, DR], "tepiBawah": TOP, "tonjolan": 0.9, "kemiringan": 30,
         "potong": [{"a": [0, 0], "b": [2.68, DR], "simpan": [-6.16, 9.33]}], "plafonPoligon": [],
         "gablet": {"ujung": [0], "lebar": 2.6},
         "sumber": UD, "catatan": "Sayap R. Dosen (miring di denah, sejajar A dan B di kampus)"},
    ],
    "mulaiJalan": {"posisi": pt((20.0, 11.4)), "arah": 0},
}

json.dump(data, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "gedung-f.json") if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == "alat"
               else "/home/claude/proj/data/gedung-f.json", "w"), ensure_ascii=False, indent=1)
for f in data["lantai"]:
    print(f["no"], f["elevasi"], len(f["ruang"]), "ruang", len(f["dinding"]), "dinding", [r["kode"] for r in f["ruang"]])
print("kolom", len(COLS), "+ selasar", len(COLS_SEL))
