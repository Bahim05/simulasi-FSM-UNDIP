# Alat bantu penyusun data Gedung F (bukan bagian aplikasi). Hasilnya data/gedung-f.json.
#
# Bentuk dari denah Gedung F LT.1-LT.3 dan foto udara pengguna (22 Nov 2026), direvisi dengan FIX FOOTAGE (24 Nov 2026):
# lantai 1 F 0,8 m di bawah lantai 1 A (2 m di bawah B, dari jumlah anak tangga penghubung F-B), pertemuan dua sayap
# (tangga U dengan bordes menempel dinding belakang, gudang di bawah lajur 2, lorong ke pintu belakang berteralis, toilet
# pria/wanita/difabel), papan nama departemen, meja belajar di selasar lt 2, dinding Statistika di lt 3.
# Sebelumnya:
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

D, UD, PR, FT = "denah-gedung-f", "foto-udara-2026", "perkiraan", "footage-2026"
H, SLAB = 4.0, 0.15
# FIX FOOTAGE 24 Nov 2026: F paling rendah (keterangan pengguna). Penghubung F-B di tiap lantai naik ±2 m ke B (dua kelompok
# ±6 anak tangga + ramp), dan jalur beratap F-A naik ke selasar A, jadi lantai 1 F diambil 0,8 m di bawah lantai 1 A.
ELEV = {1: -0.8, 2: 3.2, 3: 7.2}
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
X_KM0, X_KM1, Z_KM = 8.28, 10.28, 5.55   # blok KM/WC denah (828, 200); X_KM1 hanya dipakai untuk penempatan kolom
X_TG1 = 13.28                        # dinding barat R. Kerja = sisi timur ruang tangga (denah: 300)
Z_GD = 4.5                           # (denah lama) hanya dipakai untuk penempatan kolom
# pertemuan dua sayap mengikuti footage lobby, tangga, dan KM lt 1-3 (24 Nov 2026). Ukuran perkiraan dari video.
X_T0 = 4.6                           # dinding barat blok toilet dan ruang kecil (masuk ke ujung sayap R. Dosen)
Z_P, Z_W = 3.0, 4.4                  # sekat Toilet Pria | Toilet Wanita | ruang kecil (pintu toilet berdampingan menghadap lorong)
X_DIS, Z_DIS = 9.58, 2.0             # Toilet Difabel di pojok belakang lorong, pintu menghadap depan
X_SW = 10.88                         # dinding barat sumur tangga (sisi lorong belakang)
X_GD1, Z_GD1 = 12.08, 2.5            # gudang lt 1 di bawah lajur 2 tangga (pintu aluminium menghadap lobi)
X_R = {1: 16.78, 2: 17.48, 3: 16.78}  # sekat dua ruang sayap lurus (lt 1: 350, lt 2: 420, lt 3: 350)
# tangga pertemuan (footage): lajur 1 menempel dinding R. Kerja naik dari lobi ke belakang, bordes menempel dinding belakang
# (jendela berteralis di atasnya), lajur 2 berbalik ke depan; tembok setengah badan di antara lajur, tiang hias di anak tangga pertama
TJ = {"x0": 13.18, "x1": 10.98, "zDepan": 4.6, "zBelakang": 0.1}
# tangga luar di ujung sayap miring: di bingkai sayap (a, b), lajur sejajar dinding ujung, 2,8 m di luar dinding ujung
TE = {"x0": AB + 0.1, "x1": AB + 2.8, "zDepan": 11.0, "zBelakang": 6.0}
OUT = [J0, (LS, 0), (LS, DR), (X_TG1, DR), (X_TG1, Z_GD), (X_KM1, Z_GD), (X_KM1, Z_KM), (X_KM0, Z_KM), FJ, E1, E0]   # hanya untuk menempatkan kolom
RK = add(FJ, d, (FJ[0] - X_T0) / -d[0])   # titik dinding depan sayap R. Dosen di x = X_T0 (pojok ruang kecil dekat lobi)
def key(a, b): return (pt(a)[0], pt(a)[1], pt(b)[0], pt(b)[1])

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

def exterior(no, poly, rooms, inner_walls, cols, doors=None, skip=None, extra=None, tag=""):
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
            out.append(W(f"F{no}-luar{tag}-{i}" + (f"-{j}" if len(spans) > 1 else ""), pa, pb, mine, luar=True))
    return out

def room(kode, nama, fungsi, poly, src=D, **kw):
    r = {"kode": kode, "nama": nama, "fungsi": fungsi, "poligon": [pt(p) for p in poly], "sumber": src}
    r.update(kw)
    return r


# ---------- kolom (koordinat denah) ----------
X_BACK = [0, 3.84, 7.07, 10.78, 13.28, 17.3, 20.55, 23.8, 27.05, LS]       # dinding belakang sayap lurus (denah; 10,28 digeser ke sisi pintu belakang)
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

COLS = columns() + [[10.78, 4.8]]     # kolom di lobi antara lorong belakang dan sumur tangga (footage lobby lt 1)
COLS_SEL = sel_columns()

def sel_poly(no):
    if no == 1:   # lobi, lorong belakang, depan gudang, dan lajur 1 tangga (anak tangga di atas lantai)
        mid = [(X_KM0, Z_DIS), (X_DIS, Z_DIS), (X_DIS, 0.1), (X_SW, 0.1), (X_SW, Z_GD1), (X_GD1, Z_GD1), (X_GD1, 0.1), (X_TG1, 0.1)]
    else:         # lantai atas: lorong servis dan lobi di depan sumur tangga
        mid = [(X_KM0, Z_DIS), (X_SW, Z_DIS), (X_SW, TJ["zDepan"]), (X_TG1, TJ["zDepan"])]
    return [pt(p) for p in [E1, FJ, (X_KM0, Z_KM), *mid, (X_TG1, DR), (LS, DR), (LS, DR + SW), (X_TG1, DR + SW),
                            WP(A_FJ, DR + SW), WP(AB + 2.8, DR + SW), WP(AB + 2.8, TE["zDepan"]), WP(AB, TE["zDepan"])]]

ROOMS = {
    1: [("KRJ", "R. Kerja / R. Hukum S2 Matematika", "kantor"), ("SEM", "R. Seminar / R. Sidang S2 dan Departemen Matematika", "rapat")],
    2: [("TRP", "R. Terapan & Analisis", "kantor"), ("LAB", "Lab Komputasi", "lab")],
    3: [("TKN", "R. Teknisi Laboratorium Komputasi", "kantor"), ("BACA", "R. Baca", "perpustakaan")],
}
DOSEN = {1: "R. Dosen 1", 2: "R. Dosen 2", 3: "R. Dosen 3"}
HIM = [WP(22.4, 6.8), WP(22.4, DR), WP(AB, DR), WP(AB, 6.8)]
# ruang kecil di samping lobi (pintu kayu menghadap lobi): papan nama lt 1 dan lt 2 terbaca di footage, lt 3 belum
RKM = {1: ("R. Kegiatan Mahasiswa Departemen Matematika", "R. Kegiatan Mhs"), 2: ("F205", "F205"), 3: ("Ruang dekat tangga", None)}
BR = (9.6, 12.8)          # rentang a (sayap R. Dosen) mulut penghubung F-B, di antara dua kolom tepi selasar (kawasan x 81,0-84,2)

def bench(x, z, w=1.8, arah=0):
    return {"jenis": "kotak", "posisi": [r2(x), r2(z)], "ukuran": [w, 0.5, 0.45], "arah": arah, "warna": "#8d9296", "sumber": FT,
            "catatan": "Kursi tunggu besi di selasar (footage)."}

def counter(x, z, w, arah=0):
    return {"jenis": "kotak", "posisi": [r2(x), r2(z)], "ukuran": [w, 0.55, 0.75], "arah": arah, "warna": "#5a3b28", "sumber": FT,
            "catatan": "Meja belajar menempel dinding, bersekat (footage selasar lt 2)."}

def lantai(no):
    p = f"F{no}"
    xr = X_R[no]
    (k1, n1, f1), (k2, n2, f2) = ROOMS[no]
    xw = X_DIS if no == 1 else X_SW           # batas timur blok servis barat (lt 1: toilet difabel; lt 2-3: + gudang)
    outw = [J0, (xw, 0), (xw, Z_DIS), (X_KM0, Z_DIS), (X_KM0, Z_KM), FJ, E1, E0]
    oute = [(X_TG1, 0), (LS, 0), (LS, DR), (X_TG1, DR)]
    dos = [J0, (X_T0, 0), RK, E1, E0] if no < 3 else [J0, (X_T0, 0), RK, HIM[1], HIM[0], HIM[3], E0]
    rn, rt = RKM[no]
    rooms = [
        room(f"{p}-DSN", DOSEN[no], "kantor", dos, catatan="Sayap miring satu ruang dosen (denah), kecuali ujung timur untuk toilet dan ruang kecil (footage)."),
        room(f"{p}-RKM", rn, "organisasi" if no == 1 else "ruang", [(X_T0, Z_W), (X_KM0, Z_W), (X_KM0, Z_KM), FJ, RK], src=FT,
             catatan="Ruang kecil berpintu kayu menghadap lobi (footage). Ukuran perkiraan."),
        room(f"{p}-KMP", "Toilet Pria", "toilet", rect(X_T0, 0, X_KM0, Z_P), src=FT),
        room(f"{p}-KMW", "Toilet Wanita", "toilet", rect(X_T0, Z_P, X_KM0, Z_W), src=FT,
             catatan="Pintu Toilet Wanita dan Toilet Pria berdampingan menghadap lorong (footage). Letak di ujung sayap R. Dosen perkiraan."),
        room(f"{p}-KMD", "Toilet Difabel", "toilet", rect(X_KM0, 0, X_DIS, Z_DIS), src=FT,
             catatan="Pintu berpapan kursi roda di pojok belakang lorong, menghadap ke depan (footage)."),
        room(f"{p}-GD", "Gudang" if no == 1 else "Gudang Departemen Matematika" if no == 2 else "Gudang", "gudang",
             rect(X_SW, 0, X_GD1, Z_GD1) if no == 1 else rect(X_DIS, 0, X_SW, Z_DIS), src=FT,
             catatan="Di bawah lajur 2 tangga, pintu aluminium menghadap lobi (footage)." if no == 1 else
                     "Di samping Toilet Difabel (footage KM lt 2 dan lt 3); letak perkiraan."),
        room(f"{p}-{k1}", n1, f1, rect(X_TG1, 0, xr, DR)),
        room(f"{p}-{k2}", n2, f2, rect(xr, 0, LS, DR)),
    ]
    if no == 3:
        rooms.append(room(f"{p}-HMS", "R. Himpunan Mahasiswa Statistika", "kantor", HIM))
    walls = [
        W(f"{p}-dosen-servis", (X_T0, 0), RK, [], sumber=FT),
        W(f"{p}-pria-wanita", (X_T0, Z_P), (X_KM0, Z_P), [], sumber=FT),
        W(f"{p}-wanita-ruang", (X_T0, Z_W), (X_KM0, Z_W), [], sumber=FT),
        W(f"{p}-pria-difabel", (X_KM0, 0), (X_KM0, Z_DIS), [], sumber=FT),
        W(f"{p}-{k1}-{k2}", (xr, 0), (xr, DR), []),
    ]
    if no == 1:
        gd = {"jenis": "pintu-ganda", "t": r2((X_GD1 - X_SW) / 2), "lebar": 1.0, "tinggi": 2.05, "boven": 0, "ruang": f"{p}-GD",
              "warnaDaun": "#cfd4d4", "pegangan": True, "papanNama": True, "papanTeks": "Gudang", "sumber": FT}
        walls += [W(f"{p}-sumur-tangga", (X_SW, 0), (X_SW, TJ["zDepan"]), [], sumber=FT),
                  W(f"{p}-gudang-depan", (X_SW, Z_GD1), (X_GD1, Z_GD1), [gd], tinggi=2.3, tebal=0.08, sumber=FT,
                    catatan="Panel aluminium di bawah lajur 2 tangga (footage)."),
                  W(f"{p}-gudang-timur", (X_GD1, 0), (X_GD1, Z_GD1), [], tinggi=1.8, tebal=0.08, sumber=FT)]
    else:
        walls += [W(f"{p}-difabel-gudang", (X_DIS, 0), (X_DIS, Z_DIS), [], sumber=FT),
                  W(f"{p}-sumur-tangga", (X_SW, Z_DIS), (X_SW, TJ["zDepan"]), [], sumber=FT)]
    if no == 3:
        walls += [W(f"{p}-him-sisi", HIM[1], HIM[0], []), W(f"{p}-him-belakang", HIM[0], HIM[3], [])]
    # dinding belakang di pertemuan: pintu teralis ke parkir (lt 1) dan jendela berteralis di atas bordes (lt 1 dan lt 2)
    jb = []
    if no < 3:
        jb.append({"jenis": "jendela", "t": r2((TJ["x0"] + TJ["x1"]) / 2 - xw), "lebar": 2.0, "ambang": 2.95, "tinggi": 0.85, "sumber": FT,
                   "catatan": "Jendela memanjang berteralis besi di atas bordes, menghadap kanopi di belakang (footage tangga)."})
    if no == 1:
        jb.append({"jenis": "pintu", "t": 0.55, "lebar": 0.85, "tinggi": 2.2, "boven": 0.5, "warnaDaun": "#2b2f33", "sumber": FT,
                   "catatan": "Pintu belakang berteralis besi ke parkir motor dan kanopi (footage lobby lt 1)."})
    walls.append(W(f"{p}-belakang-pertemuan", (xw, 0), (X_TG1, 0), jb, luar=True, sumber=FT))
    # selasar: sekat Ruang Kerja Mahasiswa 2 di ujung tenggara lt 3, dinding Departemen Statistika di depan tangga lt 3
    if no == 3:
        walls.append(W(f"{p}-sekat-rkm2", (LS - 3.0, DR), (LS - 3.0, DR + 1.7), [], tinggi=1.6, tebal=0.12, sumber=FT,
                       tempelan=[{"jenis": "papan", "t": 0.85, "lebar": 1.0, "tinggi": 0.3, "ambang": 1.15, "sisi": 1,
                                  "teks": "Ruang Kerja Mahasiswa 2|Student Working Space 2", "warna": "#1f3a7a"}],
                       catatan="Sekat putih setengah tinggi; di baliknya meja kerja mahasiswa (footage koridor lt 3)."))
        walls.append(W(f"{p}-dinding-statistika", (10.6, 8.6), (12.6, 8.6), [], tinggi=3.1, tebal=0.3, sumber=FT,
                       tempelan=[{"jenis": "dinding-departemen", "t": 1.0, "lebar": 1.95, "tinggi": 2.7, "ambang": 0.15, "sisi": -1,
                                  "teks": "DEPARTEMEN|STATISTIKA|FAKULTAS SAINS DAN MATEMATIKA|UNIVERSITAS DIPONEGORO"}],
                       catatan="Dinding nama Departemen Statistika (bingkai kayu merah, panel marmer) tepat di depan anak tangga teratas (footage)."))
    dos_doors = [5.0, 11.2, 26.8] if no < 3 else [5.0, 11.2, 20.0]
    fd = [door(t, 1.0, f"{p}-DSN", teks=DOSEN[no] if t == 11.2 else None) for t in dos_doors]
    if no == 3:
        fd.append(door(27.2, 0.9, f"{p}-HMS", teks="Himpunan Statistika"))
    ext_doors = {
        key(FJ, E1): fd,
        key((LS, DR), (X_TG1, DR)): [door(LS - xr - 1.0 if no == 2 else 1.98, 1.4, f"{p}-{k2}", ganda=True, teks=n2.split(" / ")[0]),
                                     door(LS - xr - 4.5 if no != 2 else LS - xr - 7.0, 1.4, f"{p}-{k2}", ganda=True),
                                     door(LS - X_TG1 - 0.62, 0.9, f"{p}-{k1}", teks=n1.split(" / ")[0])],
        key((X_KM0, Z_DIS), (X_KM0, Z_KM)): [door(0.5, 0.8, f"{p}-KMP", teks="Toilet Pria", src=FT), door(1.6, 0.8, f"{p}-KMW", teks="Toilet Wanita", src=FT)],
        key((X_KM0, Z_KM), FJ): [door(0.8, 0.9, f"{p}-RKM", teks=rt, src=FT)],
        key((xw, Z_DIS), (X_KM0, Z_DIS)): [door(r2(xw - 8.93), 0.9, f"{p}-KMD", teks="Toilet Difabel", src=FT)]
                                          + ([door(r2(xw - 10.23), 0.8, f"{p}-GD", teks="Gudang", src=FT)] if no > 1 else []),
    }
    if no == 3:   # pintu kaca gudang lt 3 (footage)
        ext_doors[key((xw, Z_DIS), (X_KM0, Z_DIS))][1].update({"warnaDaun": "#6f8790", "lisKaca": True, "pegangan": True})
    allb = [(0, 99)]
    extra = {key((X_TG1, DR), (X_TG1, 0)): allb, key((xw, 0), (xw, Z_DIS)): allb, key((xw, Z_DIS), (X_KM0, Z_DIS)): allb,
             key((X_KM0, Z_DIS), (X_KM0, Z_KM)): allb, key((X_KM0, Z_KM), FJ): allb}
    walls += exterior(no, outw, rooms, walls, COLS, ext_doors, extra=extra, tag="w")
    walls += exterior(no, oute, rooms, walls, COLS, ext_doors, extra=extra, tag="e")
    # tempelan di dinding depan sayap R. Dosen (sisi selasar): papan informasi di lobi lt 1, papan nama departemen di depan penghubung F-B
    tp = {1: [{"jenis": "papan-pengumuman", "t": 2.0, "lebar": 2.2, "tinggi": 1.1, "ambang": 1.0, "ruang": f"{p}-RKM", "sumber": FT,
               "catatan": "Papan Informasi Departemen Matematika berbingkai merah (footage lobby lt 1)."}],
          2: [{"jenis": "plakat", "t": r2(sum(BR) / 2 - A_FJ), "lebar": 2.4, "tinggi": 1.7, "ambang": 0.8, "ruang": f"{p}-DSN", "sumber": FT,
               "teks": "PROGRAM STUDI SARJANA|DEPARTEMEN MATEMATIKA|FAKULTAS SAINS DAN MATEMATIKA",
               "catatan": "Papan nama kayu Departemen Matematika, tepat di ujung penghubung F-B lt 2 (footage)."}],
          3: [{"jenis": "plakat", "t": r2(sum(BR) / 2 - A_FJ), "lebar": 2.0, "tinggi": 1.5, "ambang": 0.9, "ruang": f"{p}-DSN", "sumber": FT,
               "teks": "DEPARTEMEN STATISTIKA|FAKULTAS SAINS DAN MATEMATIKA",
               "catatan": "Papan nama kayu Departemen Statistika di dekat ujung penghubung F-B lt 3 (footage)."}]}
    for w in walls:
        if w["a"] == pt(FJ) and w["b"] == pt(E1):
            w["tempelan"] = tp[no]
    rails = []
    if no > 1:
        dy, tb = -0.05, {"jenis": "tembok-celah", "tinggi": 0.9, "sumber": "foto-2026", "catatan": "Tembok pembatas putih bercelah tegak (foto 23 Nov 2026)."}
        e = DR + SW - 0.1
        rails += [{"a": [LS - 0.1, DR + 0.1, dy], "b": [LS - 0.1, e, dy], **tb},
                  {"a": [LS - 0.1, e, dy], "b": [X_TG1, e, dy], **tb},
                  {"a": [X_TG1, e, dy], "b": pt(WP(A_FJ, e)) + [dy], **tb},
                  # celah untuk penghubung F-B di antara dua kolom tepi selasar (footage)
                  {"a": pt(WP(A_FJ, e)) + [dy], "b": pt(WP(BR[0] - 0.08, e)) + [dy], **tb},
                  {"a": pt(WP(BR[1] + 0.08, e)) + [dy], "b": pt(WP(AB + 2.7, e)) + [dy], **tb},
                  {"a": pt(WP(AB + 2.7, e)) + [dy], "b": pt(WP(AB + 2.7, TE["zDepan"])) + [dy], **tb}]
    if no == 3:
        mj = (TJ["x0"] + TJ["x1"]) / 2
        rails += [{"a": [r2(mj - 0.06), TJ["zDepan"] - 0.05, 0], "b": [TJ["x0"], TJ["zDepan"] - 0.05, 0], "jenis": "besi", "sumber": PR,
                   "catatan": "Tepi lubang tangga pertemuan."},
                  {"a": pt(WP(TE["x0"], TE["zDepan"] - 0.05)) + [-0.05], "b": pt(WP((TE["x0"] + TE["x1"]) / 2 + 0.06, TE["zDepan"] - 0.05)) + [-0.05],
                   "jenis": "besi", "sumber": PR, "catatan": "Tepi lubang tangga luar."}]
    # perabot selasar (footage): kursi tunggu besi, meja belajar bersekat di lt 2, meja di balik sekat ujung tenggara lt 3
    zs = DR + 0.35
    if no == 1:
        perabot = [bench(16.2, zs), bench(22.6, zs), bench(27.5, zs)]
    elif no == 2:
        perabot = [counter(16.25, zs, 2.4), counter(21.5, zs, 3.6), counter(27.6, zs, 3.6)]
        perabot += [counter(*WP(4.9, DR + 0.35), 3.0, arah=30), counter(*WP(17.5, DR + 0.35), 5.0, arah=30)]
    else:
        perabot = [bench(16.2, zs), bench(24.3, zs), counter(LS - 1.4, DR + 1.3, 2.0, arah=90)]
    perabot = [dict(q, posisi=[r2(q["posisi"][0]), r2(q["posisi"][1])]) for q in perabot]
    return {
        "no": no, "elevasi": ELEV[no], "elevasiSelasar": r2(ELEV[no] - 0.05), "tinggiPlafon": H if no == 3 else H - SLAB,
        "denah": {"gambar": f"assets/denah/F{no}.jpg", "batas": DB,
                  "keterangan": f"Denah Gedung F lantai {no}, diluruskan ke skala 30 px per meter."},
        "ruang": rooms, "dinding": walls, "selasar": {"poligon": sel_poly(no)}, "pagar": rails, "perabot": perabot,
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
    cut = [WP(BR[1] + 0.2, e), WP(BR[0] - 0.2, e)]                   # terputus di mulut penghubung F-B (footage)
    return [{**base, "a": pt(P[0]), "b": pt(cut[0])},
            {**base, "a": pt(cut[1]), "b": pt(P[1]), "sudutB": r2(-s1)},
            {**base, "a": pt(P[1]), "b": pt(P[2]), "sudutA": r2(-s1), "sudutB": r2(s2)},
            {**base, "a": pt(P[2]), "b": pt(P[3]), "sudutA": r2(s2)}]

data = {
    "schema": "fsm-gedung@1",
    "id": "F",
    "nama": "Gedung F",
    "kategori": "Ruang dosen dan laboratorium",
    "deskripsi": "Gedung tiga lantai di timur Gedung A dan utara Gedung B, paling rendah di antara ketiganya (lantai 1 0,8 m di bawah A), berbentuk siku: sayap ruang dosen sejajar A dan B di barat, "
                 "lalu sayap R. Seminar / Lab belok 30 derajat menuju tenggara; selasar di sisi dalam menghadap halaman ke Gedung B. "
                 "Sayap barat berisi ruang dosen di tiap lantai; sayap tenggara berisi R. Seminar / R. Sidang (lt 1), Lab Komputasi (lt 2), "
                 "dan R. Baca (lt 3). Tangga, toilet, dan pintu belakang ke parkir di pertemuan dua sayap; tangga luar di ujung barat. "
                 "Penghubung ke Gedung B di tiap lantai dan jalur beratap ke Gedung A.",
    "sumberData": {
        D: "Denah Gedung F LT.1 sampai LT.3, skala 1:150 (folder Denah Gedung FSM/Terklasifikasi/Gedung F). Dipakai apa adanya, gedung diputar -30 derajat.",
        UD: "Foto udara pengguna (22 Nov 2026): letak di utara B dan timur A, atap genteng kemerahan, sayap yang serong menuju tenggara.",
        "ingatan-pengguna": "Pengguna (22 Nov 2026): tangga luar ada di ujung kiri (barat) sayap ruang dosen.",
        "foto-2026": "Foto pengguna 23 Nov 2026 (dari arah Gedung B): ujung barat dengan tangga luar terbuka bertembok pembatas, atap utama bergevel berkisi, atap tingkat bawah membungkus ujung barat, tritisan genteng di tepi selasar tiap lantai, tembok pembatas putih bercelah, kolom abu kebiruan.",
        FT: "FIX FOOTAGE pengguna (24 Nov 2026): lobby lt 1 dekat tangga dalam, tangga lt 1-2 dan lt 2-3, koridor lt 1-3, KM dan gudang lt 2-3, "
            "penghubung F-B (tinggi F terhadap B). Dipakai untuk tinggi lantai, susunan pertemuan dua sayap, papan nama, dan perabot selasar.",
        PR: "Perkiraan: ukuran toilet dan ruang kecil di pertemuan, jendela, letak pintu kecil di sayap.",
    },
    "koordinat": "Meter, sama dengan denah: (0,0) = sudut luar pertemuan dinding belakang dua sayap, x sepanjang sayap lurus denah (R. Seminar), "
                 "z dari dinding belakang ke arah selasar. Di kampus.json gedung diputar -30 derajat, jadi sayap R. Dosen mengarah ke barat "
                 "dan sayap R. Seminar ke tenggara. y ke atas dalam sistem kawasan (0 = lantai 1 Gedung A).",
    "ukuran": {"panjangSayapLurus": LS, "dindingBelakangSayapMiring": AB, "dindingDepanSayapMiring": AF, "kedalamanRuang": DR, "lebarSelasar": SW,
               "sudutSayap": 30, "tinggiLantai": H, "tebalPelat": SLAB},
    "tampilan": {"dinding": "#e6e5df", "dindingDalam": "#ecebe6", "kolom": "#a9b3c0", "lantai": "#e6e1d7",
                 "selasar": "#cdccc6", "atap": "#84473a", "kusen": "#3b464d", "pintu": "#7a3f2c", "pagar": "#b9c1cb"},
    # kolom tepi selasar di lantai 3 berhenti di bawah atap sandar (atap utama tidak menutup selasar)
    "fondasi": {"dasar": ELEV[1] - 0.6, "warna": "#4a4f55", "catatan": "Alas abu-abu gelap di bawah lantai 1 dan selasar (footage)."},
    "kolom": {"ukuran": 0.4, "dasar": ELEV[1] - 0.2, "puncak": TOP - 0.15, "titik": COLS,
              "tambahan": [{"titik": COLS_SEL, "lantai": [1, 2]},
                           {"titik": COLS_SEL, "lantai": [3, 3], "puncak": ELEV[3] + 3.3, "catatan": "Di bawah atap sandar selasar lt 3."}]},
    "lantai": FLOORS,
    "tangga": [
        {"id": f"TJ{f}", "dariLantai": f, "keLantai": f + 1, "x0": TJ["x0"], "x1": TJ["x1"], "zDepan": TJ["zDepan"], "zBelakang": TJ["zBelakang"],
         "jumlahAnakTangga": 24, "lebarInjakan": 0.28, "bentuk": "U dengan bordes", "dindingBelakang": True, "sisiLuar": "dinding",
         "pembatas": "tembok", "tiangAwal": True, "celah": 0.14, "sumber": FT,
         "catatan": "Tangga di pertemuan dua sayap (footage): lajur 1 menempel dinding R. Kerja naik dari lobi ke belakang, bordes menempel "
                    "dinding belakang berjendela teralis, lajur 2 berbalik ke depan; tembok setengah badan bertutup abu di antara lajur, "
                    "tiang hias putih di anak tangga pertama. Gudang di bawah lajur 2 (lt 1)."}
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
