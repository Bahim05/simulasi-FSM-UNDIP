# Alat bantu penyusun data Gedung G (bukan bagian aplikasi). Hasilnya data/gedung-g.json.
#
# Gedung G belum punya footage, jadi bentuknya dari denah G LT.1-LT.3 dan foto udara dari pengguna (22 Nov 2026).
# Bentuk dasarnya: badan memanjang 42 m (sumbu x) dengan blok tengah 18 x 21 m yang menonjol ke dua sisi,
# dua sayap miring 45 derajat di kedua ujung (Perpustakaan dan R. Pembantu Dekan 3) yang hanya dua lantai,
# lantai 3 hanya badan memanjang (blok ujung 12 x 12 m) dan blok tengah, teras dan drop-off beratap di sisi parkiran.
#
# Koordinat lokal mengikuti denah yang dibaca tegak (tulisan terbaca normal):
#   x dari dinding ujung Perpustakaan (x=0) ke dinding ujung R. Dosen (x=42);
#   z dari dinding luar Area Resepsionis (z=0, menghadap Gedung B) ke arah drop-off (z naik).
# Di kawasan gedung diputar -45 derajat: sumbu x mengarah ke tenggara, sayap Perpustakaan lurus ke barat,
# sayap R. PD3 lurus ke selatan (sejajar Gedung A, seperti di foto udara).
import json, math, os

D, UD, PR = "denah-gedung-g", "foto-udara-2026", "perkiraan"
H, SLAB = 4.0, 0.15
ELEV = {1: 1.2, 2: 5.2, 3: 9.2}     # lantai 1 rata dengan koridor dari Gedung B (tanpa anak tangga), sama dengan lantai 1 B
TOP3 = ELEV[3] + H + SLAB           # tepi bawah atap badan (lantai 3)
TOPW = ELEV[3] + SLAB               # tepi bawah atap sayap (dua lantai)
EXT, INT = 0.2, 0.15
KI = 0.1                            # muka luar kolom rata dengan muka luar dinding
S2 = math.sqrt(0.5)

def r2(v):
    return round(v, 3)

def pt(p):
    return [r2(p[0]), r2(p[1])]

def rect(x0, z0, x1, z1):
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

def add(p, d, t):
    return (p[0] + d[0] * t, p[1] + d[1] * t)

def dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])

# ---------- sayap (45 derajat) ----------
dW, dE = (-S2, S2), (S2, S2)                 # arah sayap Perpustakaan dan sayap R. PD3
A0, A1, AM = (0, 12), (6, 18), (3, 15)       # pangkal sayap Perpustakaan (garis miring 8,49 m)
B0, B1, BM = (36, 18), (42, 12), (39, 15)    # pangkal sayap R. PD3
LW = 12.0                                    # panjang sayap
KS = 7.76                                    # lantai 1 sayap PD3: batas ruang ujung (denah: 12 - 4,24)
WA = [A0, add(A0, dW, LW), add(A1, dW, LW), A1]        # sayap Perpustakaan
WB = [B1, add(B1, dE, LW), add(B0, dE, LW), B0]        # sayap R. PD3

O12 = [(0, 6), (12, 6), (12, 0), (30, 0), (30, 6), (42, 6), B1, add(B1, dE, LW), add(B0, dE, LW), B0, (30, 18), (30, 21),
       (12, 21), (12, 18), A1, add(A1, dW, LW), add(A0, dW, LW), A0]
O3 = [(0, 6), (12, 6), (12, 0), (30, 0), (30, 6), (42, 6), (42, 18), (30, 18), (30, 21), (12, 21), (12, 18), (0, 18)]

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

def bay_points(poly):
    """Titik kolom di tepi luar: tiap 6 m di tepi sejajar sumbu, tiap 4 m di sisi panjang sayap, 2 bentang di ujung sayap."""
    pts = []
    for a, b in edges(poly):
        L = dist(a, b)
        n = max(1, round(L / (6.0 if abs(a[0] - b[0]) < 1e-6 or abs(a[1] - b[1]) < 1e-6 else 4.0)))
        if L < 3.5:
            n = 1
        pts += [add(a, ((b[0] - a[0]) / L, (b[1] - a[1]) / L), L * i / n) for i in range(n)]
    return pts

def inset(poly, p):
    """Geser kolom di tepi luar ke dalam supaya muka luarnya rata dengan muka luar dinding."""
    ox = oz = 0.0
    for a, b in edges(poly):
        if on_seg(p, a, b) is not None:
            nx, nz = inward(poly, a, b)
            ox += nx * KI
            oz += nz * KI
    return [r2(p[0] + ox), r2(p[1] + oz)]

INNER = [(18, 6), (24, 6), (6, 12), (12, 12), (18, 12), (24, 12), (30, 12)]

def columns(poly):
    seen, out = set(), []
    for p in bay_points(poly) + INNER:
        k = (round(p[0], 2), round(p[1], 2))
        if k in seen:
            continue
        seen.add(k)
        out.append(inset(poly, p))
    return out

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
            out.append(W(f"G{no}-luar-{i}" + (f"-{j}" if len(spans) > 1 else ""), pa, pb, mine, luar=True))
    return out

def room(kode, nama, fungsi, poly, src=D, **kw):
    r = {"kode": kode, "nama": nama, "fungsi": fungsi, "poligon": [pt(p) for p in poly], "sumber": src}
    r.update(kw)
    return r

# ---------- tangga ----------
# Tangga utara (inti, di samping lobi, letak dari denah): kotak x 14,2-17,0, z 16,3-21, lajur sejajar sumbu z,
# naik dari sisi selasar (z=16,3) ke bordes yang menempel dinding luar z=21. Bawaan builder menaruh bordes di z kecil,
# jadi tangga disusun di bingkai yang diputar 180 derajat: (x', z') bingkai -> (-x', -z') gedung.
TN = {"x0": -14.2, "x1": -17.0, "zDepan": -16.3, "zBelakang": -20.85}
TN_Z0 = 16.3                                 # anak tangga pertama / tepi lubang tangga di lantai atas
TN_X = 17.2                                  # batas timur kotak tangga = tepi barat void lobi
# Tangga selatan (petak R. Dosen): lajur sejajar z, bordes menempel dinding luar z=6.
TS = {"x0": 30.2, "x1": 33.4, "zDepan": 11.8, "zBelakang": 6.2}
TS_X = 33.6                                  # sekat ruang tangga | R. Dosen / G304
TN_MID = -(TN["x0"] + TN["x1"]) / 2          # garis tengah dua lajur tangga utara

# ---------- lantai 1 ----------
def lantai1():
    no, Y = 1, ELEV[1]
    p = "G1"
    gudB = [(30, 13.5), (40.5, 13.5), B0, (30, 18)]
    pd3 = [B0, BM, add(BM, dE, KS), add(B0, dE, KS)]
    ujung = [add(B0, dE, KS), add(B1, dE, KS), add(B1, dE, LW), add(B0, dE, LW)]
    sel_pd3 = [BM, B1, add(B1, dE, KS), add(BM, dE, KS)]
    rooms = [
        room(f"{p}-PUS", "Perpustakaan", "perpustakaan", [(0, 6), (12, 6), (12, 18), A1, WA[2], WA[1], A0],
             catatan="Petak ujung barat laut dan sayap miring jadi satu ruang baca."),
        room(f"{p}-RSP", "Area Resepsionis", "lobi", [(12, 0), (30, 0), (30, 6), (27.6, 6), (27.6, 12), (12, 12)],
             catatan="Menghadap Gedung B; pintu kaca di tengah dinding timur laut menyambung ke koridor dari Gedung B."),
        room(f"{p}-PST", "Pojok Statistik", "kantor", rect(27.6, 6, 30, 12)),
        room(f"{p}-TGU", "Ruang tangga utara", "tangga", rect(12, 12, 18, 21)),
        room(f"{p}-LOB", "Lobby", "lobi", rect(18, 12, 24, 21), catatan="Lobi dua kali tinggi lantai: di atasnya void lantai 2 dan 3."),
        room(f"{p}-KOR", "Koridor", "sirkulasi", [(24, 12), (42, 12), (40.5, 13.5), (24, 13.5)]),
        room(f"{p}-TL", "Toilet", "toilet", [(24, 13.5), (27.6, 13.5), (27.6, 18), (30, 18), (30, 21), (24, 21)]),
        room(f"{p}-GDA", "Gudang", "gudang", rect(27.6, 13.5, 30, 18)),
        room(f"{p}-TGS", "Ruang tangga selatan", "tangga", rect(30, 6, TS_X, 12)),
        room(f"{p}-DSN", "R. Dosen", "kantor", rect(TS_X, 6, 42, 12)),
        room(f"{p}-GDB", "Gudang", "gudang", gudB),
        room(f"{p}-PD3", "R. Pembantu Dekan 3", "kantor", pd3,
             catatan="Separuh sayap sisi barat laut; separuh lainnya selasar terbuka berkolom (denah: SELASAR -0,05)."),
        room(f"{p}-UJS", "Ruang ujung sayap", "kantor", ujung, src=PR, catatan="Denah: ruang di ujung sayap, nama tidak terbaca."),
    ]
    walls = [
        W(f"{p}-pus-rsp", (12, 6), (12, 12), [door(3, 1.0, f"{p}-PUS", teks="Perpustakaan")]),
        W(f"{p}-pus-tgu", (12, 12), (12, 18), [door(3, 1.0, f"{p}-PUS")]),
        W(f"{p}-lorong-tangga", (14.2, TN_Z0), (14.2, 21), [], catatan="Dinding di sisi lajur pertama tangga utara (denah: garis x=14,2)."),
        W(f"{p}-rsp-tgu", (12, 12), (18, 12), [door(3, 1.4, f"{p}-TGU")]),
        W(f"{p}-rsp-lob", (18, 12), (24, 12), [door(3, 1.8, f"{p}-RSP", ganda=True, kaca=True)]),
        W(f"{p}-rsp-kor", (24, 12), (30, 12), []),
        W(f"{p}-pst", (27.6, 12), (27.6, 6), [door(1.5, 0.9, f"{p}-PST", teks="Pojok Statistik")]),
        W(f"{p}-pst-rsp", (27.6, 6), (30, 6), []),
        W(f"{p}-lob-tl", (24, 13.5), (24, 21), []),
        W(f"{p}-kor-tl", (24, 13.5), (30, 13.5), [door(1.8, 0.8, f"{p}-TL", teks="Toilet"), door(4.8, 0.8, f"{p}-GDA", teks="Gudang")]),
        W(f"{p}-tl-gda", (27.6, 13.5), (27.6, 18), []),
        W(f"{p}-gda-tl", (27.6, 18), (30, 18), []),
        W(f"{p}-pst-tgs", (30, 6), (30, 12), []),
        W(f"{p}-gda-gdb", (30, 13.5), (30, 18), []),
        W(f"{p}-tgs-dsn", (TS_X, 6), (TS_X, 12), []),
        W(f"{p}-dsn-kor", (TS_X, 12), (42, 12), [door(1.4, 0.9, f"{p}-DSN", teks="R. Dosen")]),
        W(f"{p}-kor-gdb", (30, 13.5), (40.5, 13.5), [door(3.0, 0.9, f"{p}-GDB", teks="Gudang")]),
        W(f"{p}-gdb-sayap", (40.5, 13.5), B0, []),
        # sayap R. PD3 lantai 1: sekat memanjang (ruang | selasar) dan sekat ruang ujung
        W(f"{p}-pd3-selasar", BM, add(BM, dE, KS),
          [door(1.6, 1.0, f"{p}-PD3", teks="R. PD 3"), {"jenis": "jendela", "t": 4.3, "lebar": 2.0, "ambang": 0.9, "tinggi": 1.7},
           {"jenis": "jendela", "t": 6.6, "lebar": 1.4, "ambang": 0.9, "tinggi": 1.7}], luar=True),
        W(f"{p}-ujs-selasar", add(BM, dE, KS), add(B1, dE, KS), [door(1.5, 0.9, f"{p}-UJS")], luar=True),
        W(f"{p}-pd3-ujs", add(B0, dE, KS), add(BM, dE, KS), [door(2.6, 0.8, f"{p}-UJS")]),
    ]
    cols = columns(O12)
    ext_doors = {
        (12, 0, 30, 0): [door(9, 1.8, f"{p}-RSP", ganda=True, kaca=True)],      # ke koridor Gedung B
        (30, 21, 12, 21): [door(9, 2.0, f"{p}-LOB", ganda=True, kaca=True)],    # pintu utama ke teras / drop-off
    }
    k_sel = tuple(pt(B1) + pt(add(B1, dE, LW)))
    skip = {k_sel: [(0, KS)]}                                                  # sisi selasar sayap PD3: terbuka
    walls += exterior(no, O12, rooms, walls, cols, ext_doors, skip)
    rails = []
    return {
        "no": no, "elevasi": Y, "elevasiSelasar": r2(Y - 0.05), "tinggiPlafon": H - SLAB,
        "denah": {"gambar": "assets/denah/G1.jpg", "batas": DB, "keterangan": "Denah Gedung G lantai 1, diluruskan ke skala 30 px per meter."},
        "ruang": rooms, "dinding": walls,
        "selasar": {"poligon": rect(17.6, 21, 24.4, 23.8),
                    "tambahan": [{"poligon": [pt(q) for q in sel_pd3], "nama": "Selasar sayap R. PD3"},
                                 {"poligon": rect(15.6, 23.8, 26.4, 30.6), "elevasi": 0.95, "nama": "Drop-off"}]},
        "pagar": rails,
    }, cols

# ---------- lantai 2 ----------
def lantai2():
    no, Y = 2, ELEV[2]
    p = "G2"
    WAm = add(AM, dW, LW)
    rooms = [
        room(f"{p}-203", "Ruang G203", "kelas", rect(0, 6, 6, 12)),
        room(f"{p}-204", "Ruang G204", "kelas", rect(6, 6, 12, 12)),
        room(f"{p}-WA", "Women Area", "ibadah", [(0, 12), (3, 12), (3, 14), (2, 14)], catatan="Ruang kecil di pangkal sayap."),
        room(f"{p}-202", "Ruang G202", "kelas", [A0, AM, WAm, WA[1]]),
        room(f"{p}-201", "Ruang G201", "kelas", [AM, A1, WA[2], WAm]),
        room(f"{p}-205", "Ruang G205", "kelas", rect(6, 14.1, 12, 18)),
        room(f"{p}-SB", "Selasar barat", "sirkulasi", [(3, 12), (12, 12), (12, 14.1), (6, 14.1), A1, (2, 14), (3, 14)]),
        room(f"{p}-206", "Ruang G206", "kelas", rect(12, 0, 18, 9.2)),
        room(f"{p}-UB", "Unit Bisnis", "kantor", rect(12, 9.2, 15.9, 12)),
        room(f"{p}-207", "Ruang G207", "kelas", rect(18, 0, 24, 7.5), src=PR, catatan="Nomor ruang tidak terbaca di denah, diurutkan."),
        room(f"{p}-208", "Ruang G208", "kelas", rect(24, 0, 30, 12)),
        room(f"{p}-DP", "Dapur", "dapur", rect(12, 15.5, 14.2, 21), catatan="Di sebelah tangga utara."),
        room(f"{p}-TGU", "Tangga utara", "tangga", rect(14.2, TN_Z0, TN_X, 21), void=True),
        room(f"{p}-VOID", "Void lobi", "void", rect(TN_X, 15, 24, 21), void=True),
        room(f"{p}-TL", "Toilet", "toilet", rect(24, 15, 30, 21)),
        room(f"{p}-SEL", "Selasar", "sirkulasi", [(12, 12), (15.9, 12), (15.9, 9.2), (18, 9.2), (18, 7.5), (24, 7.5), (24, 12), (TS_X, 12),
                                                 (TS_X, 15), (TN_X, 15), (TN_X, TN_Z0), (14.2, TN_Z0), (14.2, 15.5), (12, 15.5)]),
        room(f"{p}-TGS", "Tangga selatan", "tangga", rect(30, 6, TS_X, 12), void=True),
        room(f"{p}-GD", "Gudang", "gudang", rect(30, 15, TS_X, 18), src=PR),
        room(f"{p}-DEP", "R. Departemen Biologi", "kantor", [(TS_X, 6), (42, 6), B1, WB[1], WB[2], B0, (TS_X, 18)],
             catatan="Satu ruang besar di petak ujung tenggara dan seluruh sayap."),
    ]
    walls = [
        W(f"{p}-203-204", (6, 6), (6, 12), []),
        W(f"{p}-kelas-sb", (0, 12), (12, 12), [door(4.5, 0.9, f"{p}-203", teks="G203"), door(10.2, 0.9, f"{p}-204", teks="G204")]),
        W(f"{p}-wa", (3, 12), (3, 14), [door(1.0, 0.8, f"{p}-WA", teks="Women Area")]),
        W(f"{p}-wa-atas", (2, 14), (3, 14), []),
        W(f"{p}-pangkal-sayap", A0, A1, [door(3.54, 0.9, f"{p}-202", teks="G202"), door(6.2, 0.9, f"{p}-201", teks="G201")]),
        W(f"{p}-201-202", AM, WAm, []),
        W(f"{p}-205-sb", (6, 14.1), (12, 14.1), [door(3.0, 0.9, f"{p}-205", teks="G205")]),
        W(f"{p}-205-segitiga", (6, 14.1), (6, 18), []),
        W(f"{p}-barat-tengah", (12, 6), (12, 12), []),
        W(f"{p}-205-dp", (12, 15.5), (12, 18), []),
        W(f"{p}-206-bawah", (12, 9.2), (18, 9.2), [door(5.0, 0.9, f"{p}-206", teks="G206")]),
        W(f"{p}-ub", (15.9, 9.2), (15.9, 12), [door(1.4, 0.9, f"{p}-UB", teks="Unit Bisnis")]),
        W(f"{p}-ub-sel", (12, 12), (15.9, 12), []),
        W(f"{p}-206-207", (18, 0), (18, 9.2), []),
        W(f"{p}-207-sel", (18, 7.5), (24, 7.5), [door(3.0, 0.9, f"{p}-207", teks="G207")]),
        W(f"{p}-207-208", (24, 0), (24, 12), [door(10.4, 0.9, f"{p}-208", teks="G208")]),
        W(f"{p}-208-sel", (24, 12), (30, 12), []),
        W(f"{p}-dp-atas", (12, 15.5), (14.2, 15.5), [door(1.1, 0.8, f"{p}-DP", teks="Dapur")]),
        W(f"{p}-dp-tangga", (14.2, 15.5), (14.2, 21), []),
        W(f"{p}-void-tl", (24, 15), (24, 21), []),
        W(f"{p}-tl-sel", (24, 15), (30, 15), [door(3.0, 0.8, f"{p}-TL", teks="Toilet")]),
        W(f"{p}-208-tgs", (30, 6), (30, 12), []),
        W(f"{p}-tgs-dep", (TS_X, 6), (TS_X, 12), []),
        W(f"{p}-dep-sel", (TS_X, 12), (TS_X, 18), [door(1.5, 1.2, f"{p}-DEP", ganda=True, teks="Dept. Biologi")]),
        W(f"{p}-gd-sel", (30, 15), (TS_X, 15), [door(1.8, 0.8, f"{p}-GD", teks="Gudang")]),
        W(f"{p}-tl-gd", (30, 15), (30, 18), []),
    ]
    cols = columns(O12)
    extra = {(30, 21, 12, 21): [(5.0, 13.0)]}     # dinding di atas kanopi drop-off: tanpa jendela
    walls += exterior(no, O12, rooms, walls, cols, extra=extra)
    rails = void_rails()
    return {
        "no": no, "elevasi": Y, "elevasiSelasar": r2(Y - 0.05), "tinggiPlafon": H - SLAB,
        "denah": {"gambar": "assets/denah/G2.jpg", "batas": DB, "keterangan": "Denah Gedung G lantai 2, diluruskan ke skala 30 px per meter."},
        "ruang": rooms, "dinding": walls, "pagar": rails,
    }, cols

def void_rails():
    return [{"a": [TN_X + 0.05, TN_Z0, 0], "b": [TN_X + 0.05, 15.05, 0], "jenis": "besi", "sumber": PR, "catatan": "Tepi void di atas lobi."},
            {"a": [TN_X + 0.05, 15.05, 0], "b": [23.9, 15.05, 0], "jenis": "besi", "sumber": PR}]

# ---------- lantai 3 ----------
def lantai3():
    no, Y = 3, ELEV[3]
    p = "G3"
    rooms = [
        room(f"{p}-305", "Ruang G305", "kelas", rect(0, 6, 8.8, 12)),
        room(f"{p}-307", "Ruang G307", "kelas", rect(0, 12, 8.8, 18), src=PR, catatan="Denah menulis G305 untuk kedua ruang di petak ini."),
        room(f"{p}-GDU", "Gudang", "gudang", rect(8.8, 6, 12, 10.7)),
        room(f"{p}-LRU", "Lorong", "sirkulasi", rect(8.8, 10.7, 12, 18)),
        room(f"{p}-MR", "Meeting Room", "rapat", rect(12, 0, 26.5, 12)),
        room(f"{p}-GDM", "Gudang", "gudang", rect(26.5, 0, 30, 12)),
        room(f"{p}-GDI", "Gudang", "gudang", rect(12, 18, 14.2, 21)),
        room(f"{p}-TGU", "Tangga utara", "tangga", rect(14.2, TN_Z0, TN_X, 21), void=True),
        room(f"{p}-VOID", "Void lobi", "void", rect(TN_X, 15, 24, 21), void=True),
        room(f"{p}-TL1", "Toilet", "toilet", rect(24, 15, 27, 21)),
        room(f"{p}-TL2", "Toilet", "toilet", rect(27, 15, 30, 21)),
        room(f"{p}-SEL", "Selasar", "sirkulasi", [(12, 12), (30, 12), (30, 15), (TN_X, 15), (TN_X, TN_Z0), (14.2, TN_Z0), (14.2, 18), (12, 18)]),
        room(f"{p}-TGS", "Tangga selatan", "tangga", rect(30, 6, TS_X, 12), void=True),
        room(f"{p}-LRS", "Lorong", "sirkulasi", [(30, 12), (35.2, 12), (35.2, 18), (TS_X, 18), (TS_X, 15), (30, 15)]),
        room(f"{p}-GDS", "Gudang", "gudang", rect(30, 15, TS_X, 18)),
        room(f"{p}-304", "Ruang G304", "kelas", rect(TS_X, 6, 42, 12)),
        room(f"{p}-306", "Ruang G306", "kelas", rect(35.2, 12, 42, 18)),
    ]
    walls = [
        W(f"{p}-305-lr", (8.8, 6), (8.8, 18), [door(5.4, 0.9, f"{p}-305", teks="G305"), door(7.9, 0.9, f"{p}-307", teks="G307")]),
        W(f"{p}-305-307", (0, 12), (8.8, 12), []),
        W(f"{p}-gdu", (8.8, 10.7), (12, 10.7), [door(1.6, 0.8, f"{p}-GDU", teks="Gudang")]),
        W(f"{p}-utara-mr", (12, 6), (12, 12), []),
        W(f"{p}-mr-gdm", (26.5, 0), (26.5, 12), []),
        W(f"{p}-mr-sel", (12, 12), (30, 12), [door(5.1, 1.6, f"{p}-MR", ganda=True, teks="Meeting Room"), door(13.1, 1.6, f"{p}-MR", ganda=True),
                                             door(16.2, 0.8, f"{p}-GDM", teks="Gudang")]),
        W(f"{p}-gdi", (12, 18), (14.2, 18), [door(1.1, 0.8, f"{p}-GDI", teks="Gudang")]),
        W(f"{p}-gdi-tangga", (14.2, 18), (14.2, 21), []),
        W(f"{p}-void-tl", (24, 15), (24, 21), []),
        W(f"{p}-tl1-tl2", (27, 15), (27, 21), []),
        W(f"{p}-tl-sel", (24, 15), (30, 15), [door(1.5, 0.8, f"{p}-TL1", teks="Toilet"), door(4.5, 0.8, f"{p}-TL2", teks="Toilet")]),
        W(f"{p}-gdm-tgs", (30, 6), (30, 12), []),
        W(f"{p}-tl2-gds", (30, 15), (30, 18), []),
        W(f"{p}-tgs-304", (TS_X, 6), (TS_X, 12), []),
        W(f"{p}-304-lr", (TS_X, 12), (42, 12), [door(0.8, 0.9, f"{p}-304", teks="G304")]),
        W(f"{p}-gds", (30, 15), (TS_X, 15), [door(1.8, 0.8, f"{p}-GDS", teks="Gudang")]),
        W(f"{p}-gds-lr", (TS_X, 15), (TS_X, 18), []),
        W(f"{p}-306-lr", (35.2, 12), (35.2, 18), [door(4.5, 0.9, f"{p}-306", teks="G306")]),
    ]
    cols = columns(O3)
    walls += exterior(no, O3, rooms, walls, cols)
    rails = void_rails() + [
        {"a": [r2(TN_MID + 0.06), TN_Z0 - 0.05, 0], "b": [14.25, TN_Z0 - 0.05, 0], "jenis": "besi", "sumber": PR, "catatan": "Tepi lubang tangga utara."},
        {"a": [14.25, TN_Z0, 0], "b": [14.25, 17.95, 0], "jenis": "besi", "sumber": PR},
        {"a": [r2((TS["x0"] + TS["x1"]) / 2 + 0.06), 11.75, 0], "b": [TS["x0"], 11.75, 0], "jenis": "besi", "sumber": PR, "catatan": "Tepi lubang tangga selatan."},
    ]
    return {
        "no": no, "elevasi": Y, "elevasiSelasar": r2(Y - 0.05), "tinggiPlafon": H,
        "denah": {"gambar": "assets/denah/G3.jpg", "batas": DB, "keterangan": "Denah Gedung G lantai 3, diluruskan ke skala 30 px per meter."},
        "ruang": rooms, "dinding": walls, "pagar": rails,
    }, cols

DB = [-10.0, -2.0, 52.0, 32.0]   # batas gambar denah (meter lokal)

F1, C1 = lantai1()
F2, C2 = lantai2()
F3, C3 = lantai3()

# dinding lantai 2 yang tidak tertutup lantai 3 di atasnya (bagian sayap) dinaikkan sampai plafon atap sayap
def in_wing(w):
    ax, az = w["a"]; bx, bz = w["b"]
    L = math.hypot(bx - ax, bz - az)
    if w.get("luar"):
        nx, nz = inward(O12, (ax, az), (bx, bz))
    else:
        nx = nz = 0.0
    out = 0
    for k in (1, 2, 3):
        x, z = ax + (bx - ax) * k / 4 + nx * 0.15, az + (bz - az) * k / 4 + nz * 0.15
        out += not inside([pt(q) for q in O3], x, z)
    return out >= 2
for w in F2["dinding"]:
    if in_wing(w):
        w["tinggi"] = H

# kolom: badan ikut tiap lantai (posisi sedikit beda karena tepi luarnya beda), sayap dua lantai, kanopi satu lantai
KANOPI_Y = 4.6
kolom = {
    "ukuran": 0.4, "dasar": -0.2, "puncak": TOP3 - 0.15, "titik": [],
    "tambahan": [
        {"titik": C1, "lantai": [1, 1]},
        {"titik": C2, "lantai": [2, 2]},
        {"titik": C3, "lantai": [3, 3]},
        {"titik": [[18, 23.5], [24, 23.5], [18, 29.5], [24, 29.5]], "lantai": [1, 1], "puncak": KANOPI_Y - 0.15, "dasar": 0.6,
         "catatan": "Kolom teras dan drop-off (denah lantai 1)."},
    ],
}

data = {
    "schema": "fsm-gedung@1",
    "id": "G",
    "nama": "Gedung G",
    "kategori": "Perpustakaan dan kantor",
    "deskripsi": "Gedung tiga lantai di barat daya Gedung B. Badan memanjang barat laut-tenggara dengan blok tengah yang menonjol: "
                 "Area Resepsionis menghadap Gedung B (disambung koridor beratap), lobi dan drop-off beratap menghadap parkiran. "
                 "Dua sayap miring dua lantai: Perpustakaan di ujung barat laut dan R. Pembantu Dekan 3 di ujung tenggara. "
                 "Lantai 3 hanya badan gedung, dengan Meeting Room di blok tengah.",
    "sumberData": {
        D: "Denah Gedung G LT.1 sampai LT.3, skala 1:150 (folder Denah Gedung FSM/Terklasifikasi/Gedung G).",
        UD: "Foto udara dan tempelan denah dari pengguna (22 Nov 2026): letak, arah, dan bentuk atap (genteng cokelat tua, puncak di blok tengah).",
        PR: "Perkiraan tanpa footage: tinggi jendela, letak pintu kecil, susunan tangga, nama ruang yang tidak terbaca.",
    },
    "koordinat": "Meter. x dari dinding ujung Perpustakaan (x=0) ke dinding ujung R. Dosen (x=42), z dari dinding luar Area Resepsionis (z=0) "
                 "ke arah drop-off. y ke atas dalam sistem kawasan (0 = lantai 1 Gedung A, lantai 1 G di y=1,2). Di kawasan gedung diputar -45 derajat.",
    "ukuran": {"panjangBadan": 42, "blokTengah": [18, 21], "petakUjung": 12, "panjangSayap": LW, "lebarSayap": 8.49, "tinggiLantai": H, "tebalPelat": SLAB},
    "tampilan": {"dinding": "#e3ddd2", "dindingDalam": "#efece6", "kolom": "#d2cbbf", "lantai": "#e6e1d7",
                 "selasar": "#cfcbc2", "atap": "#5a4334", "kusen": "#3b3f42", "pintu": "#6a4a35", "pagar": "#b9bdc0"},
    "fondasi": {"dasar": -0.22, "warna": "#5a564f", "catatan": "Alas di bawah lantai 1 (lantai 1 G sekitar 1,2 m di atas lantai 1 A)."},
    "kolom": kolom,
    "lantai": [F1, F2, F3],
    "tangga": [
        {"id": f"TU{f}", "dariLantai": f, "keLantai": f + 1, **TN, "putar": 180, "jumlahAnakTangga": 24, "lebarInjakan": 0.28,
         "bentuk": "U dengan bordes", "dindingBelakang": True, "sisiLuar": "pagar", "sumber": PR,
         "catatan": "Tangga inti di sebelah lobi (letak dari denah). Disusun di bingkai yang diputar 180 derajat: "
                    "naik dari sisi selasar (z=16,3) ke bordes yang menempel dinding luar, lalu berbalik di sisi void."}
        for f in (1, 2)] + [
        {"id": f"TS{f}", "dariLantai": f, "keLantai": f + 1, **TS, "jumlahAnakTangga": 24, "lebarInjakan": 0.28,
         "bentuk": "U dengan bordes", "dindingBelakang": True, "sisiLuar": "dinding", "sumber": PR,
         "catatan": "Tangga di petak tenggara (denah: di sebelah R. Dosen), bordes menempel dinding luar."}
        for f in (1, 2)],
    # Atap: badan memanjang + blok tengah (atap perisai bersilang, puncak di tengah seperti di foto udara),
    # dua sayap lebih rendah yang masuk ke dinding lantai 3, dan kanopi drop-off yang menempel di dinding lobi.
    "atap": [
        {"jenis": "perisai", "asal": [0, 0], "sudut": 0, "batas": [0, 6, 42, 18], "tepiBawah": TOP3, "tonjolan": 0.9, "kemiringan": 30,
         "plafonPoligon": [rect(0, 6, 12, 18), rect(30, 6, 42, 18)], "sumber": UD, "catatan": "Badan memanjang"},
        {"jenis": "perisai", "asal": [0, 0], "sudut": 90, "batas": [0, -30, 21, -12], "tepiBawah": TOP3, "tonjolan": 0.9, "kemiringan": 30,
         "plafonPoligon": [rect(12, 0, 30, 21)], "sumber": UD, "catatan": "Blok tengah (bubungan melintang, lebih tinggi)"},
        {"jenis": "perisai", "asal": pt(A1), "sudut": 135, "batas": [-5, 0, LW, 8.485], "tepiBawah": TOPW, "tonjolan": 0.9, "kemiringan": 30,
         "buang": [rect(0, 6, 12, 18)], "plafonPoligon": [[pt(A0), [0, 18], pt(A1), pt(add(A1, dW, LW)), pt(add(A0, dW, LW))]],
         "sumber": UD, "catatan": "Sayap Perpustakaan (dua lantai), masuk ke dinding petak ujung lantai 3"},
        {"jenis": "perisai", "asal": pt(B1), "sudut": 45, "batas": [-5, 0, LW, 8.485], "tepiBawah": TOPW, "tonjolan": 0.9, "kemiringan": 30,
         "buang": [rect(30, 6, 42, 18)], "plafonPoligon": [[pt(B1), pt(add(B1, dE, LW)), pt(add(B0, dE, LW)), pt(B0), [42, 18]]],
         "sumber": UD, "catatan": "Sayap R. PD3 (dua lantai)"},
        {"jenis": "perisai", "asal": [0, 0], "sudut": 90, "batas": [15, -24, 29.5, -18], "tepiBawah": KANOPI_Y, "tonjolan": 0.6, "kemiringan": 20,
         "potong": [{"a": [-50, 21.12], "b": [80, 21.12], "simpan": [21, 26]}], "plafonPoligon": [rect(17.4, 21.12, 24.6, 30.1)],
         "sumber": D, "catatan": "Kanopi teras dan drop-off (beratap, keterangan pengguna)"},
    ],
    "mulaiJalan": {"posisi": [21, 22.6], "arah": 0},
}

json.dump(data, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "gedung-g.json"), "w"), ensure_ascii=False, indent=1)
for f in data["lantai"]:
    print(f["no"], f["elevasi"], len(f["ruang"]), "ruang", len(f["dinding"]), "dinding", [r["kode"] for r in f["ruang"]])
print("kolom per lantai:", len(C1), len(C2), len(C3))
